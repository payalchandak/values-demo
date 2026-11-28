import type { Beat } from "../../types";

/**
 * The prism chapter, as data. Every visual is a pure function of chapter time.
 *
 *   enter    the case pile shrinks to the left; the prism draws in the middle
 *   stream   GPT's 500 decisions leave the pile as dots and run into the prism
 *   split    the dots leave the far side as four rays, one per value, each as wide as its priority
 *   settle   the rays straighten into the four priority bars; pile and prism fade
 *   labels   value names and percents come in
 *   end      the profile, held
 */

/** The pile shrinks away and the prism draws. */
export const ENTER_MS = 900;
/** All 500 dots leave the pile across this window. */
export const EMIT_MS = 2400;
/** One dot's run from the pile to the prism. */
export const TO_PRISM_MS = 900;
/** One dot's run from the prism to the end of its ray. */
export const ON_RAY_MS = 1000;
/** The rays open from the prism to their full length. */
export const RAY_GROW_MS = 900;
/** The rays straighten into bars. */
export const SETTLE_MS = 1200;
/** Names and percents fade in. */
export const LABELS_MS = 600;
/** The profile holds. */
export const END_HOLD_MS = 2200;

const stream = ENTER_MS;
const split = stream + TO_PRISM_MS;
const settle = stream + EMIT_MS + TO_PRISM_MS + ON_RAY_MS;
const labels = settle + SETTLE_MS;

export const prismBeats = [
  { name: "enter", startMs: 0 },
  { name: "stream", startMs: stream },
  { name: "split", startMs: split },
  { name: "settle", startMs: settle },
  { name: "labels", startMs: labels },
  { name: "end", startMs: labels + LABELS_MS + END_HOLD_MS },
] as const satisfies readonly Beat[];

export const PRISM_HEADLINES = {
  stream: "Every decision mixes four values.",
  split: "ValuePRISM separates them.",
} as const;
