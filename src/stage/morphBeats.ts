import { FADE_MS } from "../design/motion";
import type { Beat } from "../types";

/**
 * Bars-to-donut morph, as data. Every visual in `Morph` is a pure function of
 * chapter-local time, so it plays, pauses and scrubs on the chapter clock.
 *
 *   bars    the four priority bars from the regression chapter, held
 *   stack   the bars slide into one row and stack end to end into a strip as
 *           long as the ring's circumference (each segment keeps its length)
 *   bend    the strip bends into the ring, first segment starting at 12 o'clock
 *   labels  names and percents fade in outside; the provider icon lands beneath
 *   end     the hero donut, held
 */
// TODO: tune after visual review
export const MORPH_TIMING = {
  holdMs: 1200,
  stackMs: 1000,
  /** The stacked strip rests this long before it bends. */
  settleMs: 300,
  bendMs: 1400,
  labelsMs: 600,
  endHoldMs: 800,
} as const;

const stack = MORPH_TIMING.holdMs;
const bend = stack + MORPH_TIMING.stackMs + MORPH_TIMING.settleMs;
const labels = bend + MORPH_TIMING.bendMs;
const end = labels + MORPH_TIMING.labelsMs + MORPH_TIMING.endHoldMs;

export const morphBeats = [
  { name: "bars", startMs: 0 },
  { name: "stack", startMs: stack },
  { name: "bend", startMs: bend },
  { name: "labels", startMs: labels },
  { name: "end", startMs: end },
] as const satisfies readonly Beat[];

/** The regression card cross-fades into the bars over this long at the start. */
export const MORPH_HANDOFF_MS = FADE_MS;
