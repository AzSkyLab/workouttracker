import { useState, useEffect, useRef, useCallback } from 'react';

const STORAGE_KEY = 'restTimer';

interface SavedTimerState {
  deadline: number;
  totalSeconds: number;
}

// Generate a WAV blob containing a waveform pattern.
// HTML5 Audio elements claim the media session, which requests audio focus
// on Android and pauses/mutes other apps while playing.
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

// Build a single continuous ~5s countdown WAV.
// Playing one long audio (instead of short individual beeps) makes Android
// grant full AUDIOFOCUS_GAIN which pauses/mutes other audio apps.
//
// Timeline (audio seconds → timer remaining):
//   t=0.0: start (near-silent background to establish audio focus)
//   t=1.0: tick beep  (aligns with remaining=3)
//   t=2.0: tick beep  (remaining=2)
//   t=3.0: tick beep  (remaining=1)
//   t=4.0: done triple beep (remaining=0)
//   t=5.0: end
//
// Playback starts at audioOffset = 4.0 - actualSecondsRemaining
function createCountdownWav(): Blob {
  // Near-silent low-freq background keeps audio session active between beeps
  const bg = (dur: number) => ({ freq: 50, dur, vol: 0.003 });
  return createWavBlob([
    // 0.0 – 1.0: background (claim audio focus, other apps pause)
    bg(1.0),
    // 1.0: tick beep
    { freq: 880, dur: 0.15, vol: 0.95 },
    // gap to 2.0
    bg(0.85),
    // 2.0: tick beep
    { freq: 880, dur: 0.15, vol: 0.95 },
    // gap to 3.0
    bg(0.85),
    // 3.0: tick beep
    { freq: 880, dur: 0.15, vol: 0.95 },
    // gap to 4.0
    bg(0.85),
    // 4.0: done triple beep
    { freq: 880, dur: 0.12, vol: 1.0 },
    bg(0.08),
    { freq: 880, dur: 0.12, vol: 1.0 },
    bg(0.08),
    { freq: 1100, dur: 0.2, vol: 1.0 },
    // trailing background to let audio focus settle
    bg(0.4),
  ]);
}

export function useRestTimer() {
  const [deadline, setDeadline] = useState<number | null>(null);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const countdownAudioRef = useRef<HTMLAudioElement | null>(null);
  const countdownBlobUrlRef = useRef<string | null>(null);
  const audioUnlockedRef = useRef(false);
  const countdownStartedRef = useRef(false);
  const doneFiredRef = useRef(false);
  const clearTimeoutRef = useRef<number>();

  // Create countdown audio element on mount
  useEffect(() => {
    try {
      const blob = createCountdownWav();
      const url = URL.createObjectURL(blob);
      countdownBlobUrlRef.current = url;
      countdownAudioRef.current = new Audio(url);
      countdownAudioRef.current.load();
    } catch {}

    return () => {
      if (countdownAudioRef.current) {
        countdownAudioRef.current.pause();
      }
      if (countdownBlobUrlRef.current) {
        URL.revokeObjectURL(countdownBlobUrlRef.current);
      }
    };
  }, []);

  // Unlock audio on first user interaction (required by iOS/mobile).
  useEffect(() => {
    const handleInteraction = () => {
      if (audioUnlockedRef.current) return;
      audioUnlockedRef.current = true;

      if (countdownAudioRef.current) {
        countdownAudioRef.current.volume = 0.01;
        countdownAudioRef.current.play().then(() => {
          countdownAudioRef.current!.pause();
          countdownAudioRef.current!.currentTime = 0;
          countdownAudioRef.current!.volume = 1.0;
        }).catch(() => {
          if (countdownAudioRef.current) countdownAudioRef.current.volume = 1.0;
        });
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
      const actualRemaining = (deadline - Date.now()) / 1000;
      const remaining = Math.max(0, Math.ceil(actualRemaining));
      setRemainingSeconds(remaining);

      if (remaining <= 0) {
        if (!doneFiredRef.current) {
          doneFiredRef.current = true;
          setIsComplete(true);

          // If countdown audio hasn't started yet (very short timer),
          // start it now at the done-beep offset
          if (!countdownStartedRef.current && countdownAudioRef.current) {
            countdownStartedRef.current = true;
            countdownAudioRef.current.currentTime = 4.0;
            countdownAudioRef.current.play().catch(() => {});
          }

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

      // Start the continuous countdown audio ~4.5s before the end.
      // The audio is 5s long with beeps at t=1,2,3 and done at t=4.
      // audioOffset = 4.0 - actualRemaining syncs beeps to the countdown.
      if (actualRemaining <= 4.5 && !countdownStartedRef.current && countdownAudioRef.current) {
        countdownStartedRef.current = true;
        const offset = Math.max(0, 4.0 - actualRemaining);
        countdownAudioRef.current.currentTime = offset;
        countdownAudioRef.current.play().catch(() => {});
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

    // Stop any currently playing countdown audio
    if (countdownAudioRef.current) {
      countdownAudioRef.current.pause();
      countdownAudioRef.current.currentTime = 0;
    }

    const newDeadline = Date.now() + seconds * 1000;
    setDeadline(newDeadline);
    setTotalSeconds(seconds);
    setIsComplete(false);
    countdownStartedRef.current = false;
    doneFiredRef.current = false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ deadline: newDeadline, totalSeconds: seconds }));
  }, []);

  const cancelTimer = useCallback(() => {
    if (clearTimeoutRef.current) {
      clearTimeout(clearTimeoutRef.current);
    }

    // Stop any currently playing countdown audio
    if (countdownAudioRef.current) {
      countdownAudioRef.current.pause();
      countdownAudioRef.current.currentTime = 0;
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
