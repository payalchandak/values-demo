import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Content-agnostic playback engine: tracks the current step, pause state and
 * elapsed progress within the step, and auto-advances when a step's duration
 * elapses. Progress is time-accurate (pausing freezes it; resuming continues).
 */
export function usePlayback(durations: number[]) {
  const count = durations.length;
  const [currentStep, setCurrentStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1 within current step

  const elapsed = useRef(0);
  const currentStepRef = useRef(currentStep);
  currentStepRef.current = currentStep;
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  const durationsRef = useRef(durations);
  durationsRef.current = durations;

  const goTo = useCallback(
    (index: number) => {
      elapsed.current = 0;
      setProgress(0);
      const clamped = Math.min(Math.max(index, 0), count - 1);
      currentStepRef.current = clamped;
      setCurrentStep(clamped);
    },
    [count],
  );

  // Manual stepping always pauses.
  const next = useCallback(() => {
    setIsPaused(true);
    goTo(currentStepRef.current + 1);
  }, [goTo]);

  const prev = useCallback(() => {
    setIsPaused(true);
    goTo(currentStepRef.current - 1);
  }, [goTo]);

  // Scrubbing (jumping to an arbitrary step) also pauses.
  const seek = useCallback(
    (index: number) => {
      setIsPaused(true);
      goTo(index);
    },
    [goTo],
  );

  const restart = useCallback(() => {
    goTo(0);
    setIsPaused(false);
  }, [goTo]);

  const togglePause = useCallback(() => {
    // Pressing play on the finished last step restarts the demo.
    const finished =
      currentStepRef.current === count - 1 &&
      elapsed.current >= durationsRef.current[count - 1];
    if (isPausedRef.current && finished) goTo(0);
    setIsPaused(!isPausedRef.current);
  }, [count, goTo]);

  // Auto-advance clock.
  useEffect(() => {
    if (isPaused) return;
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      elapsed.current += now - last;
      last = now;
      const duration = durationsRef.current[currentStep];
      const p = Math.min(elapsed.current / duration, 1);
      setProgress(p);

      if (p >= 1) {
        if (currentStep < count - 1) {
          elapsed.current = 0;
          setProgress(0);
          setCurrentStep(currentStep + 1);
        } else {
          setIsPaused(true); // finished: hold on the last step
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [currentStep, isPaused, count]);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) togglePause();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      }
    };
    // Stop Space from "clicking" a focused HUD button on key release.
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") e.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [togglePause, next, prev]);

  return { currentStep, isPaused, progress, seek, next, prev, restart, togglePause };
}
