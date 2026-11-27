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
 *   shrink     the card shrinks into the middle of the grid; "N dilemmas" label arrives
 *   reveal     the other cards appear one by one, spreading out from the first
 *   grid       every card is on screen and holds
 *   flip       every card flips to its tag-chip back, one after another (the structure)
 *   settle     all the tag backs sit so the trade-offs can be read
 *   unflip     every card flips back to the decision side, all together
 *   markers    the red and dark decision dots come in along the card edges
 *   observed   the dots are all in and hold
 *   gather     the first three cards move out of the grid, the rest fade away
 *   morph      the three cards morph into table rows, ellipsis + count label
 *   highlight  the first row takes its highlight
 *   end        chapter end marker
 */
export const STACK_BEAT_NAMES = [
  "card",
  "shrink",
  "reveal",
  "grid",
  "flip",
  "settle",
  "unflip",
  "markers",
  "observed",
  "gather",
  "morph",
  "highlight",
  "end",
] as const;

export type StackBeatName = (typeof STACK_BEAT_NAMES)[number];

/** The hero card sits still before it shrinks. */
const CARD_HOLD_MS = 1200;
/** The hero card shrinks into the grid. */
const SHRINK_MS = 500;
/** The other cards appear one by one. Each card fades in over 30% of this (see the timeline). */
const REVEAL_MS = 2200;
/** The full grid holds before the flip. */
const GRID_HOLD_MS = 800;
/** Every card flips, staggered from the middle out. Each flip takes 45% of this. */
const FLIP_MS = 3000;
/** The tag backs stay up long enough to read the trade-offs. */
const TRADEOFF_HOLD_MS = 2400;
/** Every card flips back at the same time. */
const UNFLIP_MS = 700;
/** Dots cascade across the cards. */
const MARKERS_MS = 1600;
/** The finished dots hold before the table takes over. */
const DOTS_HOLD_MS = 800;
/** The trio leaves the grid. */
const GATHER_MS = 450;
/** Three staggered morphs into rows. Each morph lasts MOVE_MS (see the 0.76 divisor). */
const MORPH_MS = 200;

const shrink = CARD_HOLD_MS;
const reveal = shrink + SHRINK_MS;
const grid = reveal + REVEAL_MS;
const flip = grid + GRID_HOLD_MS;
const settle = flip + FLIP_MS;
const unflip = settle + TRADEOFF_HOLD_MS;
const markers = unflip + UNFLIP_MS;
const observed = markers + MARKERS_MS;
const gather = observed + DOTS_HOLD_MS;
const morph = gather + GATHER_MS;
const highlight = morph + MORPH_MS;
const end = highlight + MOVE_MS;

export const stackBeats: readonly Beat[] = [
  { name: "card", startMs: 0 },
  { name: "shrink", startMs: shrink },
  { name: "reveal", startMs: reveal },
  { name: "grid", startMs: grid },
  { name: "flip", startMs: flip },
  { name: "settle", startMs: settle },
  { name: "unflip", startMs: unflip },
  { name: "markers", startMs: markers },
  { name: "observed", startMs: observed },
  { name: "gather", startMs: gather },
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
