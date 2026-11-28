import type { Beat } from "../../types";
import { CASE_COUNT } from "../cases/beats";

/** The pile holds before it moves up. */
export const HOLD_IN_MS = 300;
/** The pile shrinks to the top while the value names arrive below it. */
export const SHRINK_MS = 1100;
/** The first few cards vote one at a time, slowly enough to follow. */
export const SLOW_VOTES = 3;
/** Between one slow vote and the next. */
export const SLOW_STEP_MS = 1300;
/** A slow card lifts off the pile over this long. */
export const SLOW_PEEL_MS = 600;
/** A slow card's votes fly from the card to the bars over this long. */
export const FLY_MS = 750;
/** Every other card lifts off this far apart. */
export const FAST_STEP_MS = 55;
/** A fast card lifts off over this long. */
export const FAST_PEEL_MS = 160;
/** A vote eases into its bar over this long. */
export const LAND_MS = 300;
/** After the last vote, the tally settles into the four priorities. */
export const SETTLE_MS = 1300;
/** The finished profile holds before the ring. */
export const END_HOLD_MS = 900;

const shrink = HOLD_IN_MS;
const vote = shrink + SHRINK_MS;
const rest = vote + SLOW_VOTES * SLOW_STEP_MS;
const settle = rest + (CASE_COUNT - SLOW_VOTES) * FAST_STEP_MS + FAST_PEEL_MS + LAND_MS + 200;
const end = settle + SETTLE_MS + END_HOLD_MS;

/**
 *   hold    the finished pile, as the cases chapter left it
 *   shrink  the pile moves up and shrinks; the four value names arrive below
 *   vote    the top cards lift off one at a time; each choice's votes fly to the bars
 *   rest    every other card lifts off quickly and the bars keep moving
 *   settle  the tally settles into the four priorities; the percents arrive
 *   end     the profile, held: the ring's first frame
 */
export const voteBeats = [
  { name: "hold", startMs: 0 },
  { name: "shrink", startMs: shrink },
  { name: "vote", startMs: vote },
  { name: "rest", startMs: rest },
  { name: "settle", startMs: settle },
  { name: "end", startMs: end },
] as const satisfies readonly Beat[];

/** When the card `n` places from the top of the pile starts to lift off. */
export function leaveAt(n: number): number {
  if (n < SLOW_VOTES) return vote + n * SLOW_STEP_MS;
  return rest + (n - SLOW_VOTES) * FAST_STEP_MS;
}

/** When the votes of the card `n` places from the top are in the bars. */
export function landAt(n: number): number {
  return leaveAt(n) + (n < SLOW_VOTES ? FLY_MS : FAST_PEEL_MS);
}

export const peelMs = (n: number) => (n < SLOW_VOTES ? SLOW_PEEL_MS : FAST_PEEL_MS);

/** On-screen text. */
export const VOTE_HEADLINE = "Each choice is a vote.";
export const PROFILE_HEADLINE = "A value profile, inferred from decisions.";
export const VOTE_CAPTION = (n: number, total: number) => `${n} of ${total} cases counted`;
