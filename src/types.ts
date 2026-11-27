import type { ReactNode } from "react";
import type { MotionValue } from "framer-motion";

/** A named moment inside a chapter, in ms from the chapter's start. */
export interface Beat {
  name: string;
  startMs: number;
}

/** Playback state handed to `Chapter.render` on every frame. */
export interface ChapterContext {
  /** Chapter-local playback time in ms (frozen while paused). */
  elapsedMs: number;
  /** 0..1 through the chapter, derived from its last beat. */
  progress: number;
  isPaused: boolean;
  /**
   * The same chapter-local clock as a MotionValue (ms). Use it with
   * `useTransform` / `motion` styles to animate without re-rendering React.
   */
  time: MotionValue<number>;
}

/**
 * A chapter is a beat list (data) plus a render function. Its length is the
 * start of its last beat, so the last beat is the chapter's end marker.
 */
export interface Chapter {
  id: string;
  beats: readonly Beat[];
  render: (ctx: ChapterContext) => ReactNode;
}

export function chapterDuration(chapter: Pick<Chapter, "beats">): number {
  return chapter.beats[chapter.beats.length - 1]?.startMs ?? 0;
}

/** Start time of a named beat. Throws on an unknown name so typos surface early. */
export function beatStart(beats: readonly Beat[], name: string): number {
  const beat = beats.find((b) => b.name === name);
  if (!beat) throw new Error(`Unknown beat "${name}"`);
  return beat.startMs;
}
