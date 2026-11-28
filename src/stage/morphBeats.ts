import { FADE_MS } from "../design/motion";
import type { Beat } from "../types";

/**
 * Bars-to-donut, played at the start of the individual-models chapter. It is
 * not its own chapter: the cases chapter hands straight to the donut. Every
 * visual in `Morph` is a pure function of the time passed in.
 *
 * The bars do not rest in one horizontal line. They sweep through that strip
 * and bend into the ring.
 *
 *   bars    the four priority bars from the cases chapter, briefly
 *   stack   the bars sweep into a strip as long as the ring's circumference
 *   bend    the strip bends into the ring, first segment starting at 12 o'clock
 *   labels  names and percents fade in outside; the provider icon lands in the hole
 *   end     the hero donut, where the first model's hold begins
 */
export const MORPH_TIMING = {
  /** The cases chapter already held this profile. */
  holdMs: 240,
  /** Sweep into the strip. The horizontal line is passed through, not held. */
  stackMs: 380,
  settleMs: 0,
  bendMs: 1000,
  labelsMs: 450,
  /** The first model's hold is the dwell on the finished ring. */
  endHoldMs: 0,
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

/** When the ring is fully formed. The first model's hold starts here. */
export const MORPH_LEAD_MS = end;

/** The cases chapter's last frame cross-fades into the bars over this long at the start. */
export const MORPH_HANDOFF_MS = FADE_MS;
