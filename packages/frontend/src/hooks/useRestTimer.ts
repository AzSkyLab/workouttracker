import { useState, useEffect, useRef, useCallback } from 'react';

const STORAGE_KEY = 'restTimer';

interface SavedTimerState {
  deadline: number;
  totalSeconds: number;
}

export function useRestTimer() {
  const [deadline, setDeadline] = useState<number | null>(null);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playedTicksRef = useRef<Set<number>>(new Set());
  const doneSoundPlayedRef = useRef(false);
  const audioResumedForCountdownRef = useRef(false);
  const clearTimeoutRef = useRef<number>();

  // Create AudioContext (must be called during user gesture on iOS).
  // After creation, immediately suspend to avoid holding the audio session.
  const ensureAudioContext = (): AudioContext | null => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      return audioCtxRef.current;
    } catch {
      return null;
    }
  };

  // Resume AudioContext for active sound playback.
  // On iOS, this activates the audio session (may pause other apps).
  const resumeAudioContext = async (): Promise<AudioContext | null> => {
    const ctx = ensureAudioContext();
    if (!ctx) return null;
    try {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      return ctx;
    } catch {
      return null;
    }
  };

  // Suspend AudioContext to release the iOS audio session.
  // This allows other apps (YouTube Music, etc.) to resume playback.
  const suspendAudioContext = () => {
    const ctx = audioCtxRef.current;
    if (ctx && ctx.state === 'running') {
      ctx.suspend().catch(() => {});
    }
  };

  // Unlock AudioContext on first user interaction (required by iOS).
  // Create it, briefly resume (to satisfy the gesture requirement), then
  // immediately suspend so we don't hold the audio session.
  useEffect(() => {
    const handleInteraction = () => {
      const ctx = ensureAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().then(() => {
          // Immediately suspend — we just needed iOS to "unlock" the context
          ctx.suspend().catch(() => {});
        }).catch(() => {});
      }
      document.removeEventListener('touchstart', handleInteraction);
      document.removeEventListener('click', handleInteraction);
    };
    document.addEventListener('touchstart', handleInteraction, { passive: true });
    document.addEventListener('click', handleInteraction);
    return () => {
      document.removeEventListener('touchstart', handleInteraction);
      document.removeEventListener('click', handleInteraction);
    };
  }, []);

  // Play a loud square-wave beep via Web Audio API oscillator.
  // Caller must ensure AudioContext is running before calling this.
  const playBeep = (frequency: number, duration: number, volume: number) => {
    try {
      const ctx = audioCtxRef.current;
      if (!ctx || ctx.state !== 'running') return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.frequency.value = frequency;
      osc.type = 'square';

      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.setValueAtTime(volume, ctx.currentTime + duration * 0.8);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch {}
  };

  // Triple beep pattern for timer completion.
  // Returns the total duration of the sound so caller knows when to suspend.
  const playDoneSound = (): number => {
    try {
      const ctx = audioCtxRef.current;
      if (!ctx || ctx.state !== 'running') return 0;

      const scheduleBeep = (freq: number, startTime: number, dur: number, vol: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'square';
        gain.gain.setValueAtTime(vol, ctx.currentTime + startTime);
        gain.gain.setValueAtTime(vol, ctx.currentTime + startTime + dur * 0.8);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + dur);
        osc.start(ctx.currentTime + startTime);
        osc.stop(ctx.currentTime + startTime + dur);
      };

      // Two short beeps + one higher longer beep
      scheduleBeep(880, 0, 0.12, 1.0);
      scheduleBeep(880, 0.2, 0.12, 1.0);
      scheduleBeep(1100, 0.4, 0.25, 1.0);
      return 0.65 + 0.1; // last beep ends at 0.65s + small buffer
    } catch {
      return 0;
    }
  };

  const vibrate = () => {
    try {
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }
    } catch {}
  };

  // Load persisted timer on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const { deadline: d, totalSeconds: t }: SavedTimerState = JSON.parse(saved);
      const remainingSec = Math.ceil((d - Date.now()) / 1000);
      if (remainingSec > -5) {
        setDeadline(d);
        setTotalSeconds(t);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Timer update loop — uses deadline-based calculation so the timer
  // stays accurate even when the browser tab is backgrounded.
  useEffect(() => {
    if (deadline === null) {
      setRemainingSeconds(0);
      setIsComplete(false);
      audioResumedForCountdownRef.current = false;
      return;
    }

    const update = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemainingSeconds(remaining);

      if (remaining <= 0) {
        if (!doneSoundPlayedRef.current) {
          doneSoundPlayedRef.current = true;
          setIsComplete(true);
          const soundDuration = playDoneSound();
          vibrate();
          localStorage.removeItem(STORAGE_KEY);

          // Suspend AudioContext after done sound finishes to release
          // the iOS audio session (allows music to resume)
          if (soundDuration > 0) {
            setTimeout(() => {
              suspendAudioContext();
              audioResumedForCountdownRef.current = false;
            }, soundDuration * 1000 + 200);
          } else {
            suspendAudioContext();
            audioResumedForCountdownRef.current = false;
          }

          // Auto-dismiss after 3 seconds
          clearTimeoutRef.current = window.setTimeout(() => {
            setDeadline(null);
            setIsComplete(false);
          }, 3000);
        }
        return;
      }

      // At ~5 seconds remaining, resume AudioContext for the countdown beeps.
      // This is the ONLY moment we activate the audio session.
      if (remaining <= 5 && !audioResumedForCountdownRef.current) {
        audioResumedForCountdownRef.current = true;
        resumeAudioContext(); // async but fire-and-forget; it'll be ready by 3s mark
      }

      // Tick sounds at 3, 2, 1 seconds
      if (remaining <= 3 && !playedTicksRef.current.has(remaining)) {
        playedTicksRef.current.add(remaining);
        playBeep(880, 0.15, 0.95);
      }
    };

    update();
    const interval = setInterval(update, 250);

    // Recalculate immediately when page becomes visible again
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        update();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [deadline]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (clearTimeoutRef.current) {
        clearTimeout(clearTimeoutRef.current);
      }
    };
  }, []);

  const startTimer = useCallback((seconds: number) => {
    if (!seconds || seconds <= 0) return;

    // Cancel any pending auto-dismiss
    if (clearTimeoutRef.current) {
      clearTimeout(clearTimeoutRef.current);
    }

    const newDeadline = Date.now() + seconds * 1000;
    setDeadline(newDeadline);
    setTotalSeconds(seconds);
    setIsComplete(false);
    playedTicksRef.current.clear();
    doneSoundPlayedRef.current = false;
    audioResumedForCountdownRef.current = false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ deadline: newDeadline, totalSeconds: seconds }));
  }, []);

  const cancelTimer = useCallback(() => {
    if (clearTimeoutRef.current) {
      clearTimeout(clearTimeoutRef.current);
    }
    setDeadline(null);
    setTotalSeconds(0);
    setRemainingSeconds(0);
    setIsComplete(false);
    // Suspend audio context if it was resumed for countdown
    if (audioResumedForCountdownRef.current) {
      suspendAudioContext();
      audioResumedForCountdownRef.current = false;
    }
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const progress = totalSeconds > 0 ? ((totalSeconds - remainingSeconds) / totalSeconds) * 100 : 0;
  const isRunning = deadline !== null && remainingSeconds > 0;
  const isLastSeconds = isRunning && remainingSeconds <= 3;

  return {
    remainingSeconds,
    totalSeconds,
    isRunning,
    isComplete,
    isLastSeconds,
    progress,
    startTimer,
    cancelTimer,
    formatTime,
  };
}

export type RestTimerReturn = ReturnType<typeof useRestTimer>;
