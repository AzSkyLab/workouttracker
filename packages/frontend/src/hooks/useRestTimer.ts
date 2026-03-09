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

  // Audio helpers - use Web Audio API oscillators so they don't claim the
  // media session and won't pause YouTube Music or other audio apps.
  const ensureAudioContext = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
    } catch {}
  };

  const playBeep = (frequency: number, duration: number, volume: number) => {
    try {
      const ctx = audioCtxRef.current;
      if (!ctx) return;

      // Try to resume if suspended — may work if close to a user gesture
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
        return; // Will play next tick if resume succeeds
      }
      if (ctx.state !== 'running') return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.frequency.value = frequency;
      osc.type = 'square';

      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch {}
  };

  const vibrate = () => {
    try {
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }
    } catch {}
  };

  // Unlock AudioContext on first user interaction (required by iOS/mobile).
  // This must happen during a direct user gesture — not after an async call.
  useEffect(() => {
    const handleInteraction = () => {
      ensureAudioContext();
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
          // Triple beep alert
          playBeep(880, 0.2, 0.9);
          setTimeout(() => playBeep(880, 0.2, 0.9), 300);
          setTimeout(() => playBeep(1100, 0.35, 1.0), 600);
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
        playBeep(660, 0.2, 0.7);
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

    // Resume AudioContext during this user gesture (required by iOS)
    ensureAudioContext();
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
