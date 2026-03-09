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
  const clearTimeoutRef = useRef<number>();

  // Create/resume AudioContext. Uses Web Audio API oscillators which play
  // ALONGSIDE other audio apps (no media session claim, no pausing music).
  const getAudioContext = (): AudioContext | null => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
      return audioCtxRef.current;
    } catch {
      return null;
    }
  };

  // Unlock AudioContext on first user interaction (required by iOS).
  // AudioContext does NOT claim the media session, so this won't pause music.
  useEffect(() => {
    const handleInteraction = () => {
      getAudioContext();
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
  // Square waves are piercing and cut through background music.
  const playBeep = (frequency: number, duration: number, volume: number) => {
    try {
      const ctx = getAudioContext();
      if (!ctx || ctx.state !== 'running') return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.frequency.value = frequency;
      osc.type = 'square';

      // Start at full volume, hold, then quick fade out
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.setValueAtTime(volume, ctx.currentTime + duration * 0.8);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch {}
  };

  // Triple beep pattern for timer completion
  const playDoneSound = () => {
    try {
      const ctx = getAudioContext();
      if (!ctx || ctx.state !== 'running') return;

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
    } catch {}
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
      return;
    }

    const update = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemainingSeconds(remaining);

      if (remaining <= 0) {
        if (!doneSoundPlayedRef.current) {
          doneSoundPlayedRef.current = true;
          setIsComplete(true);
          playDoneSound();
          vibrate();
          localStorage.removeItem(STORAGE_KEY);
          // Auto-dismiss after 3 seconds
          clearTimeoutRef.current = window.setTimeout(() => {
            setDeadline(null);
            setIsComplete(false);
          }, 3000);
        }
        return;
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
