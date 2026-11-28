import { FADE_MS } from "../design/motion";

/** Clamp to 0..1. */
const clamp01 = (n: number): number => Math.min(Math.max(n, 0), 1);

/** 0 before `start`, 1 after `end`, linear in between. Pure: no timers. */
const ramp = (t: number, start: number, end: number): number =>
  end <= start ? (t >= end ? 1 : 0) : clamp01((t - start) / (end - start));

/** Short fade used for the small labels, in ms. */
const LABEL_FADE_MS = FADE_MS;

/**
 * Window boundaries of the response chapter, in ms from the chapter's start.
 * Built from the chapter's beats (see `demoChapters.tsx`), not stored in data.
 */
export interface ModelResponseTiming {
  /** Icon appears and spins, with "Thinking…", until the answer starts. */
  thinkStartMs: number;
  /** First character of the answer. Phrase-group fades also start here. */
  revealStartMs: number;
  /** Answer is fully on screen. */
  revealEndMs: number;
  /** Fade-in length of a single phrase group. */
  groupFadeMs: number;
  /** Recommendation span highlight sweeps across this window. */
  highlightStartMs: number;
  highlightEndMs: number;
  /** Matching recommendation card is outlined across this window. */
  outlineStartMs: number;
  outlineEndMs: number;
}

export interface ResponseProgress {
  /** Elapsed time used. */
  elapsedMs: number;
  /** 0..1 sweep of the recommendation-span highlight. */
  highlight: number;
  /** 0..1 progress of the matching card's outline. */
  outline: number;
  /** True once the matching card should read as selected. */
  extracted: boolean;
  /** Opacity of the "Identify the recommendation" label (only while extracting). */
  identifyOpacity: number;
  /** Opacity of the "Extracted choice" label. */
  extractedOpacity: number;
}

/**
 * Everything the response chapter shows is a pure function of the chapter's elapsed
 * time. No timers live here, so whatever supplies `elapsedMs` (the playback
 * clock) fully controls pausing, scrubbing, and replay.
 */
export function getResponseProgress(
  e: number,
  timing: ModelResponseTiming,
): ResponseProgress {
  const outline = ramp(e, timing.outlineStartMs, timing.outlineEndMs);
  return {
    elapsedMs: e,
    highlight: ramp(e, timing.highlightStartMs, timing.highlightEndMs),
    outline,
    extracted: e >= timing.outlineStartMs,
    identifyOpacity:
      ramp(e, timing.highlightStartMs, timing.highlightStartMs + LABEL_FADE_MS) *
      (1 - ramp(e, timing.outlineStartMs, timing.outlineStartMs + LABEL_FADE_MS)),
    extractedOpacity: ramp(e, timing.outlineStartMs, timing.outlineStartMs + LABEL_FADE_MS),
  };
}
