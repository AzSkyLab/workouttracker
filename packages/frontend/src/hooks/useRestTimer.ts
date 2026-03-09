import { useState, useEffect, useRef, useCallback } from 'react';

const STORAGE_KEY = 'restTimer';

interface SavedTimerState {
  deadline: number;
  totalSeconds: number;
}

// Generate a WAV blob containing a square-wave beep pattern.
// HTML5 Audio elements claim the media session, which triggers audio ducking
// on Android (lowers other apps' volume while playing).
function createWavBlob(
  tones: Array<{ freq: number; dur: number; vol: number }>
): Blob {
  const sampleRate = 44100;
  const totalDuration = tones.reduce((sum, t) => sum + t.dur, 0);
  const numSamples = Math.floor(sampleRate * totalDuration);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // WAV header
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  // Generate samples for each tone segment
  let sampleOffset = 0;
  for (const tone of tones) {
    const segmentSamples = Math.floor(sampleRate * tone.dur);
    for (let i = 0; i < segmentSamples; i++) {
      const t = i / sampleRate;
      // Square wave: sign of sine
      const raw = tone.freq > 0
        ? (Math.sin(2 * Math.PI * tone.freq * t) >= 0 ? 1 : -1)
        : 0;
      // Fade in/out envelope to prevent clicks
      const fadeIn = Math.min(1, t * 80);
      const fadeOut = Math.min(1, (tone.dur - t) * 80);
      const sample = raw * tone.vol * fadeIn * fadeOut;
      view.setInt16(
        44 + (sampleOffset + i) * 2,
        Math.max(-32768, Math.min(32767, sample * 32767)),
        true
      );
    }
    sampleOffset += segmentSamples;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export function useRestTimer() {
  const [deadline, setDeadline] = useState<number | null>(null);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const tickAudioRef = useRef<HTMLAudioElement | null>(null);
  const doneAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlockedRef = useRef(false);
  const playedTicksRef = useRef<Set<number>>(new Set());
  const doneSoundPlayedRef = useRef(false);
  const clearTimeoutRef = useRef<number>();

  // Create audio elements on mount
  useEffect(() => {
    try {
      // Tick: single loud beep
      const tickBlob = createWavBlob([
        { freq: 880, dur: 0.2, vol: 0.9 },
      ]);
      // Done: triple beep — two short + one higher longer
      const doneBlob = createWavBlob([
        { freq: 880, dur: 0.15, vol: 0.95 },
        { freq: 0, dur: 0.1, vol: 0 },
        { freq: 880, dur: 0.15, vol: 0.95 },
        { freq: 0, dur: 0.1, vol: 0 },
        { freq: 1100, dur: 0.25, vol: 1.0 },
      ]);

      tickAudioRef.current = new Audio(URL.createObjectURL(tickBlob));
      doneAudioRef.current = new Audio(URL.createObjectURL(doneBlob));
      tickAudioRef.current.load();
      doneAudioRef.current.load();
    } catch {}

    return () => {
      [tickAudioRef, doneAudioRef].forEach((ref) => {
        if (ref.current) {
          ref.current.pause();
          URL.revokeObjectURL(ref.current.src);
        }
      });
    };
  }, []);

  // Unlock audio on first user interaction (required by iOS/mobile).
  useEffect(() => {
    const handleInteraction = () => {
      if (audioUnlockedRef.current) return;
      audioUnlockedRef.current = true;

      [tickAudioRef, doneAudioRef].forEach((ref) => {
        if (!ref.current) return;
        ref.current.volume = 0.01;
        ref.current.play().then(() => {
          ref.current!.pause();
          ref.current!.currentTime = 0;
          ref.current!.volume = 1.0;
        }).catch(() => {
          if (ref.current) ref.current.volume = 1.0;
        });
      });

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

  const playAudio = (ref: React.RefObject<HTMLAudioElement | null>) => {
    try {
      if (!ref.current) return;
      ref.current.currentTime = 0;
      ref.current.play().catch(() => {});
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
          playAudio(doneAudioRef);
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
        playAudio(tickAudioRef);
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
