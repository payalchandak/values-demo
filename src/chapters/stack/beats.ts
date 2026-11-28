import { MOVE_MS } from "../../design/motion";
import type { Beat } from "../../types";

/**
 * The stack chapter's timeline, as data. Each beat is the START of a phase;
 * a phase runs until the next beat starts, and the last beat ("end") only
 * marks the chapter's end. Retime the chapter by editing `startMs` values
 * (or passing your own list to `createStackChapter`). Nothing in the
 * animation code knows a duration.
 *
 *   card       the opening's card, already on its single-column tag side, holding while its dots arrive
 *   turn       (empty: the card arrives already turned)
 *   values     (empty: the tag side already held in the opening)
 *   shrink     the card flips back and shrinks into the middle of the grid, becoming a
 *              title card
 *   reveal     the other cards appear one by one, spreading out from the first
 *   grid       every card is on screen and holds, so the titles can be read
 *   flip       every card flips to its tag-chip back, one after another (the structure)
 *   settle     all the tag backs sit so the trade-offs can be read
 *   markers    the red and dark decision dots come in along the other cards' edges, beside the tags
 *   observed   the dots are all in and hold
 *   gather     the grid becomes the table, one case at a time: the first card cross-fades into
 *              row 1; then card 2 and card 3 send their title, tags and decision dots to the
 *              Case, value and decision columns, one item after another; then every other
 *              card sweeps its contents into the ellipsis
 *   morph      the table holds, complete, for a beat
 *   highlight  the first row takes its highlight
 *   end        chapter end marker
 */
export const STACK_BEAT_NAMES = [
  "card",
  "turn",
  "values",
  "shrink",
  "reveal",
  "grid",
  "flip",
  "settle",
  "markers",
  "observed",
  "gather",
  "morph",
  "highlight",
  "end",
] as const;

export type StackBeatName = (typeof STACK_BEAT_NAMES)[number];

/** The hero card sits still before it shrinks. */
const CARD_HOLD_MS = 1600;
/** The hero card flips to its tag back. */
const TURN_MS = 0;
/** The hero's tag back holds so the values can be read. */
const VALUES_HOLD_MS = 0;
/** The hero card flips back and shrinks into the grid. */
const SHRINK_MS = 700;
/** The other cards appear one by one. Each card fades in over 30% of this (see the timeline). */
const REVEAL_MS = 3000;
/** The full grid holds so the titles can be read. */
const GRID_HOLD_MS = 1500;
/** Every card flips, staggered from the middle out. Each flip takes 45% of this. */
const FLIP_MS = 3000;
/** The tag backs stay up long enough to read the trade-offs before the decisions arrive. */
const TRADEOFF_HOLD_MS = 1600;
/** Dots cascade across the cards. */
const MARKERS_MS = 1600;
/** The finished dots hold before the table takes over. */
const DOTS_HOLD_MS = 800;
/** The grid becomes the table, one case at a time. */
const GATHER_MS = 7000;
/** The finished table holds before the first row is highlighted. */
const MORPH_MS = 150;

const turn = CARD_HOLD_MS;
const values = turn + TURN_MS;
const shrink = values + VALUES_HOLD_MS;
const reveal = shrink + SHRINK_MS;
const grid = reveal + REVEAL_MS;
const flip = grid + GRID_HOLD_MS;
const settle = flip + FLIP_MS;
const markers = settle + TRADEOFF_HOLD_MS;
const observed = markers + MARKERS_MS;
const gather = observed + DOTS_HOLD_MS;
const morph = gather + GATHER_MS;
const highlight = morph + MORPH_MS;
const end = highlight + MOVE_MS;

export const stackBeats: readonly Beat[] = [
  { name: "card", startMs: 0 },
  { name: "turn", startMs: turn },
  { name: "values", startMs: values },
  { name: "shrink", startMs: shrink },
  { name: "reveal", startMs: reveal },
  { name: "grid", startMs: grid },
  { name: "flip", startMs: flip },
  { name: "settle", startMs: settle },
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
