import { useState, useEffect, useRef } from 'react';

// Generate a beep as an AudioBuffer (routes through system output including Bluetooth)
function createBeepBuffer(ctx: AudioContext, frequency: number, duration: number, volume: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(1, numSamples, sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const fadeIn = Math.min(1, t * 50);
    const fadeOut = Math.min(1, (duration - t) * 50);
    const envelope = fadeIn * fadeOut;
    data[i] = Math.sin(2 * Math.PI * frequency * t) * volume * envelope;
  }

  return buffer;
}

export interface StopwatchState {
  time: number;
  isRunning: boolean;
  targetTime: number | null;
}

export function useStopwatch() {
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [targetTime, setTargetTime] = useState<number | null>(null);
  const intervalRef = useRef<number>();
  const audioContextRef = useRef<AudioContext | null>(null);
  const tickBufferRef = useRef<AudioBuffer | null>(null);
  const doneBufferRef = useRef<AudioBuffer | null>(null);
  const keepAliveRef = useRef<{ osc: OscillatorNode; gain: GainNode } | null>(null);
  const timerIdRef = useRef(0); // Tracks active timer to prevent stale onended suspends

  // Initialize AudioContext and buffers (must be called during user gesture for iOS)
  const ensureAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
      tickBufferRef.current = createBeepBuffer(audioContextRef.current, 600, 0.25, 0.8);
      doneBufferRef.current = createBeepBuffer(audioContextRef.current, 900, 0.6, 1.0);
    }
    return audioContextRef.current;
  };

  // Ensure AudioContext is running before playing audio
  const ensureResumed = async () => {
    const ctx = audioContextRef.current;
    if (ctx && ctx.state === 'suspended') {
      await ctx.resume();
    }
  };

  // Near-inaudible oscillator to keep Bluetooth A2DP codec from sleeping
  const startKeepAlive = async () => {
    const ctx = audioContextRef.current;
    if (!ctx || keepAliveRef.current) return;

    await ensureResumed();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 200;
    gain.gain.value = 0.001; // ~-60dB, keeps codec active but inaudible
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    keepAliveRef.current = { osc, gain };
  };

  const stopKeepAlive = () => {
    if (!keepAliveRef.current) return;
    try { keepAliveRef.current.osc.stop(); } catch { /* already stopped */ }
    keepAliveRef.current.osc.disconnect();
    keepAliveRef.current.gain.disconnect();
    keepAliveRef.current = null;
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopKeepAlive();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    // Load saved state from localStorage
    const saved = localStorage.getItem('stopwatch');
    if (saved) {
      try {
        const { time: savedTime, isRunning: savedRunning, targetTime: savedTarget } = JSON.parse(saved);
        setTime(savedTime);
        setIsRunning(savedRunning);
        setTargetTime(savedTarget);
      } catch (e) {
        console.error('Failed to parse saved stopwatch state', e);
      }
    }
  }, []);

  useEffect(() => {
    // Save state to localStorage
    localStorage.setItem('stopwatch', JSON.stringify({ time, isRunning, targetTime }));
  }, [time, isRunning, targetTime]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = window.setInterval(() => {
        setTime((prev) => {
          if (prev <= 0) return 0;
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning]);

  useEffect(() => {
    // Auto-stop when countdown reaches 0
    if (targetTime !== null && time <= 0 && isRunning) {
      setIsRunning(false);
    }
  }, [time, targetTime, isRunning]);

  // Start Bluetooth keepalive ~5s before beeps to warm up A2DP codec
  useEffect(() => {
    if (isRunning && targetTime !== null && time <= 5 && time > 0) {
      startKeepAlive();
    }
  }, [time, isRunning, targetTime]);

  // Reactive sound playback when countdown reaches 3, 2, 1, 0
  useEffect(() => {
    if (!isRunning || targetTime === null) return;

    if (time === 3 || time === 2 || time === 1) {
      playBuffer(tickBufferRef.current, false);
    } else if (time === 0) {
      playBuffer(doneBufferRef.current, true);
    }
  }, [time, isRunning, targetTime]);

  // Play an AudioBuffer through the AudioContext
  const playBuffer = async (buffer: AudioBuffer | null, isFinalBeep: boolean) => {
    const ctx = audioContextRef.current;
    if (!buffer || !ctx) return;
    try {
      await ensureResumed();
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();

      // After final beep: stop keepalive and suspend to avoid pausing music on iOS
      if (isFinalBeep) {
        const currentTimerId = timerIdRef.current;
        source.onended = () => {
          // Only suspend if no new timer has started since this beep
          if (timerIdRef.current === currentTimerId) {
            stopKeepAlive();
            ctx.suspend();
          }
        };
      }
    } catch {
      // Playback failed
    }
  };

  const start = () => setIsRunning(true);

  const pause = () => {
    setIsRunning(false);
  };

  const reset = () => {
    stopKeepAlive();
    setTime(0);
    setIsRunning(false);
    setTargetTime(null);
  };

  const startWithPreset = (seconds: number) => {
    // Increment timer ID so previous timer's onended won't suspend our context
    timerIdRef.current++;

    // Create AudioContext during user gesture (required by iOS/Safari)
    const ctx = ensureAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    setTime(seconds);
    setTargetTime(seconds);
    setIsRunning(true);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = targetTime ? ((targetTime - time) / targetTime) * 100 : 0;
  const isComplete = targetTime !== null && time <= 0;
  const isCountingDown = targetTime !== null && isRunning && time > 0;
  const isLastSeconds = isCountingDown && time <= 3;

  return {
    time,
    isRunning,
    targetTime,
    isComplete,
    isLastSeconds,
    start,
    pause,
    reset,
    startWithPreset,
    formatTime,
    progress,
  };
}
