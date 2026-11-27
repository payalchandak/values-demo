import { MOVE_MS } from "../../design/motion";
import type { Beat } from "../../types";

/**
 * The stack chapter's timeline, as data. Each beat is the START of a phase;
 * a phase runs until the next beat starts, and the last beat ("end") only
 * marks the chapter's end. Retime the chapter by editing `startMs` values
 * (or passing your own list to `createStackChapter`). Nothing in the
 * animation code knows a duration.
 *
 *   card       one full-size case card, holding
 *   shrink     the card shrinks to stack size
 *   fan        the other cases fan out behind it, "N dilemmas" label arrives
 *   markers    choice markers accumulate along card edges
 *   lift       two more cards slide out of the fan beside the first
 *   flip       the three foreground cards flip to their tag-chip backs
 *   fade       the background stack fades away
 *   morph      the three cards morph into table rows, ellipsis + count label
 *   highlight  the first row takes its highlight
 *   end        chapter end marker
 */
export const STACK_BEAT_NAMES = [
  "card",
  "shrink",
  "fan",
  "markers",
  "lift",
  "flip",
  "fade",
  "morph",
  "highlight",
  "end",
] as const;

export type StackBeatName = (typeof STACK_BEAT_NAMES)[number];

/** The hero card sits still before it shrinks. */
const CARD_HOLD_MS = 1200;
/** Dots cascade across the stack. */
const MARKERS_MS = 260;
/** Three staggered flips. Each flip lasts MOVE_MS (see the 0.6 divisor in the timeline). */
const FLIP_MS = 250;
/** Three staggered morphs into rows. Each morph lasts MOVE_MS (see the 0.76 divisor). */
const MORPH_MS = 200;

const shrink = CARD_HOLD_MS;
const fan = shrink + MOVE_MS;
const markers = fan + MOVE_MS;
const lift = markers + MARKERS_MS;
const flip = lift + MOVE_MS;
const fade = flip + FLIP_MS;
const morph = fade + MOVE_MS;
const highlight = morph + MORPH_MS;
const end = highlight + MOVE_MS;

export const stackBeats: readonly Beat[] = [
  { name: "card", startMs: 0 },
  { name: "shrink", startMs: shrink },
  { name: "fan", startMs: fan },
  { name: "markers", startMs: markers },
  { name: "lift", startMs: lift },
  { name: "flip", startMs: flip },
  { name: "fade", startMs: fade },
  { name: "morph", startMs: morph },
  { name: "highlight", startMs: highlight },
  { name: "end", startMs: end },
];

export type StackBeatTimes = Record<StackBeatName, number>;

/** Validate a beat list (every stack beat present, in order) and index it by name. */
export function resolveBeats(beats: readonly Beat[]): StackBeatTimes {
  const times = {} as StackBeatTimes;
  let previous = -Infinity;
  for (const name of STACK_BEAT_NAMES) {
    const beat = beats.find((b) => b.name === name);
    if (!beat) throw new Error(`Stack chapter is missing beat "${name}"`);
    if (beat.startMs < previous) {
      throw new Error(`Stack beat "${name}" starts before the beat before it`);
    }
    previous = beat.startMs;
    times[name] = beat.startMs;
  }
  return times;
}
