import type { Beat } from "../../types";

/** Still on the opening's last frame before the card draws around it. */
export const FRAME_MS = 600;
/** The white card fades in and the group narrows. */
export const BOX_MS = 1000;
/** The card moves up and shrinks while the value names arrive below it. */
export const SHRINK_MS = 1100;
/** One value's judgment flies from its pill to its bar over this long. */
export const VOTE_FLY_MS = 540;
/** Shown cases send their values one after another, this far apart. */
export const VOTE_STAGGER_MS = 380;
/** A card's votes, from the first leaving to the last landing. */
export const FLY_MS = VOTE_FLY_MS + VOTE_STAGGER_MS * 3;
/** A vote eases into its bar over this long. */
export const LAND_MS = 300;
/**
 * A shown case's votes leave it this long after it starts to come in.
 * The wait covers the dots landing, the winning choice locking in, and each
 * voting value lighting up before it leaves.
 */
export const VOTE_DELAY_MS = 2000;
/** How long each case is held, from the moment it starts to flash in. Tune here. */
export const CASE_HOLD_MS = 4400;
/** The winning choice starts to lock in this long before the first vote leaves. */
export const WIN_LEAD_MS = 700;
/** How long that lock takes. */
export const WIN_MS = 300;
/** A voting value starts to light this long before its own vote leaves. */
export const ACT_LEAD_MS = 360;
/** How long a value takes to light. */
export const ACT_MS = 200;
/** A new card slides up and fades in over the pile. */
export const IN_MS = 450;
/** Dots on a new case land this far apart. */
export const DOT_STAGGER_MS = 70;
/** How long one dot takes to appear. */
export const DOT_IN_MS = 220;
/** After the last vote, the tally settles into the four priorities and the pile lifts away. */
export const SETTLE_MS = 1300;
/** The finished profile holds before the ring. */
export const END_HOLD_MS = 900;

/** Cards in all: the opening's case, then 49 more. */
export const CASE_COUNT = 50;
/** Cards 4 to 49 (index 3 to 48) are skipped through. The rest are shown at full pace. */
export const isFast = (i: number) => i >= 3 && i <= CASE_COUNT - 2;
/** Skipped cards land one after another, too quick to read but not a strobe. */
export const FAST_STEP_MS = 110;
/** A skipped card's soft fade in. */
export const FAST_IN_MS = 260;
/** The skip, start to last blank card. */
export const SKIP_MS = (CASE_COUNT - 5) * FAST_STEP_MS;

const box = FRAME_MS;
const shrink = box + BOX_MS;
/** The opening's case votes once the card has settled and its winning choice can lock in. */
const vote = shrink + SHRINK_MS + 1100;
const case2 = vote + FLY_MS + 500;
/** When the skip begins: after cases 2 and 3 have each been held. */
export const SKIP_START = case2 + CASE_HOLD_MS * 2;

/** Start of card `i` (1 to 49), as an index into this list. */
export const CASE_STARTS: readonly number[] = (() => {
  const out: number[] = [case2, case2 + CASE_HOLD_MS];
  for (let i = 3; i < CASE_COUNT; i++) out.push(isFast(i) ? SKIP_START + (i - 3) * FAST_STEP_MS : SKIP_START + SKIP_MS + 200);
  return out;
})();

/** When card `i`'s first vote leaves it. A skipped card votes as it lands. */
export function voteAt(i: number): number {
  if (i === 0) return vote;
  return CASE_STARTS[i - 1] + (isFast(i) ? 0 : VOTE_DELAY_MS);
}

/** When value `k` on a shown card leaves. Skipped cards send every value at once. */
export function valueVoteAt(i: number, k: number): number {
  return voteAt(i) + (isFast(i) ? 0 : k * VOTE_STAGGER_MS);
}

/** When value `k`'s vote is in its bar. */
export function valueLandAt(i: number, k: number): number {
  return valueVoteAt(i, k) + (isFast(i) ? FAST_IN_MS : VOTE_FLY_MS);
}

/** When card `i`'s votes are all in the bars. */
export function landAt(i: number): number {
  return voteAt(i) + (isFast(i) ? FAST_IN_MS : FLY_MS);
}

const settle = landAt(CASE_COUNT - 1) + 600;
const end = settle + SETTLE_MS + END_HOLD_MS;

/**
 *   frame   the opening's last frame
 *   box     the white card draws around it
 *   shrink  the card moves up and shrinks; the four value names arrive below
 *   vote    the opening's case votes: the winning choice locks in, then each value it
 *           judged lights and flies to its bar
 *   case2, case3  each case lands on the pile, is read, then votes the same way
 *   skip    46 cases flash through, each voting as it lands
 *   case50  the last case, shown and voting at full pace
 *   settle  the tally settles into the four priorities; the pile lifts away
 *   end     the profile, held: the ring's first frame
 */
export const casesBeats = [
  { name: "frame", startMs: 0 },
  { name: "box", startMs: box },
  { name: "shrink", startMs: shrink },
  { name: "vote", startMs: vote },
  { name: "case2", startMs: CASE_STARTS[0] },
  { name: "case3", startMs: CASE_STARTS[1] },
  { name: "skip", startMs: CASE_STARTS[2] },
  { name: "case50", startMs: CASE_STARTS[CASE_COUNT - 2] },
  { name: "settle", startMs: settle },
  { name: "end", startMs: end },
] as const satisfies readonly Beat[];
