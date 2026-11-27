import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMotionValue } from "framer-motion";
import { beatStart, chapterDuration, type Chapter } from "./types";

/** Longest frame delta the clock will accept (e.g. after a backgrounded tab). */
const MAX_FRAME_MS = 100;

/**
 * Real-clock playback engine. Owns the current chapter and a chapter-local
 * clock in ms. Pausing freezes the clock; seeking sets it exactly.
 * Autoplays on mount. Any viewer input pauses; resuming is explicit.
 */
export function useChapterClock(chapters: readonly Chapter[]) {
  const count = chapters.length;
  const durations = useMemo(() => chapters.map(chapterDuration), [chapters]);

  const [chapterIndex, setChapterIndex] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  /** True only once the viewer has paused (never for the initial state or the final hold). */
  const [pausedByViewer, setPausedByViewer] = useState(false);
  const time = useMotionValue(0);

  // Refs are the source of truth so event handlers and the rAF loop never see stale state.
  const chapterRef = useRef(0);
  const elapsedRef = useRef(0);
  const pausedRef = useRef(false);

  const commit = useCallback(
    (chapter: number, elapsed: number) => {
      chapterRef.current = chapter;
      elapsedRef.current = elapsed;
      time.set(elapsed);
      setChapterIndex(chapter);
      setElapsedMs(elapsed);
    },
    [time],
  );

  const setPaused = useCallback((paused: boolean, byViewer: boolean) => {
    pausedRef.current = paused;
    setIsPaused(paused);
    setPausedByViewer(paused && byViewer);
  }, []);

  const isEnded = useCallback(
    () =>
      chapterRef.current === count - 1 && elapsedRef.current >= durations[count - 1],
    [count, durations],
  );

  /** Pause on viewer input; does nothing to the clock position. */
  const pause = useCallback(() => setPaused(true, true), [setPaused]);

  /** Jump the clock to a beat (default: chapter start) and pause. */
  const seek = useCallback(
    (chapter: number, beat?: string) => {
      const index = Math.min(Math.max(chapter, 0), count - 1);
      const target = chapters[index];
      const startMs = beat ? beatStart(target.beats, beat) : (target.beats[0]?.startMs ?? 0);
      commit(index, startMs);
      setPaused(true, true);
    },
    [chapters, count, commit, setPaused],
  );

  const next = useCallback(() => {
    if (chapterRef.current >= count - 1) pause();
    else seek(chapterRef.current + 1);
  }, [count, pause, seek]);

  const prev = useCallback(() => seek(chapterRef.current - 1), [seek]);

  const restart = useCallback(() => {
    commit(0, 0);
    setPaused(false, false);
  }, [commit, setPaused]);

  const togglePause = useCallback(() => {
    if (!pausedRef.current) {
      pause();
    } else {
      // Pressing play at the very end restarts from the top.
      if (isEnded()) commit(0, 0);
      setPaused(false, false);
    }
  }, [pause, isEnded, commit, setPaused]);

  // The clock: only runs while playing.
  useEffect(() => {
    if (isPaused) return;
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(now - last, MAX_FRAME_MS);
      last = now;

      let chapter = chapterRef.current;
      let elapsed = elapsedRef.current + dt;
      while (elapsed >= durations[chapter]) {
        if (chapter === count - 1) {
          commit(chapter, durations[chapter]);
          setPaused(true, false); // finished: hold on the last frame
          return;
        }
        elapsed -= durations[chapter];
        chapter += 1;
      }
      commit(chapter, elapsed);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPaused, durations, count, commit, setPaused]);

  // Viewer input. Space toggles, arrows move between chapters, anything else pauses.
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
      } else if (!["Shift", "Control", "Alt", "Meta", "CapsLock"].includes(e.key)) {
        pause();
      }
    };
    // Stop Space from "clicking" a focused button on key release.
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") e.preventDefault();
    };
    // Clicks anywhere pause, except on the transport controls (which act themselves).
    const onPointerDown = (e: PointerEvent) => {
      if (e.target instanceof Element && e.target.closest("[data-playback-ui]")) return;
      pause();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [togglePause, next, prev, pause]);

  const duration = durations[chapterIndex] ?? 0;
  const progress = duration > 0 ? Math.min(elapsedMs / duration, 1) : 1;

  return {
    chapterIndex,
    elapsedMs,
    progress,
    isPaused,
    pausedByViewer,
    time,
    seek,
    next,
    prev,
    restart,
    togglePause,
  };
}
