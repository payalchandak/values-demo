import type { Beat } from "../../types";

/** Still on the opening's last frame before the card draws around it. */
export const FRAME_MS = 600;
/** The white card fades in and the group narrows. */
export const BOX_MS = 1000;
/** How long each case is held, from the moment it starts to flash in. Tune here. */
export const CASE_HOLD_MS = 2600;
/** A new card slides up and fades in over the pile. */
export const IN_MS = 450;
/** Dots on a new case land this far apart. */
export const DOT_STAGGER_MS = 70;
/** How long one dot takes to appear. */
export const DOT_IN_MS = 220;
/** Hold after the last case. */
export const HOLD_MS = 2200;

/** Cards in all: the opening's case, then 49 more. */
export const CASE_COUNT = 50;
/** Cards 3 to 48 (index 2 to 47) are skipped through. Everything else is shown at full pace. */
export const isFast = (i: number) => i >= 2 && i <= CASE_COUNT - 3;
/** Time between skipped cards. */
export const FAST_STEP_MS = 210;
/** A skipped card's slide in. */
export const FAST_IN_MS = 750;
/** Pause between the skip and the second to last case. */
export const SKIP_END_MS = FAST_STEP_MS;

const box = FRAME_MS;
/** The anorexia case is held for a full beat once the box has finished. */
const case2 = box + BOX_MS + CASE_HOLD_MS;
const skip = case2 + CASE_HOLD_MS;

/** Start of card `i` (1 to 49), as an index into this list. Card 0 is the opening's own frame. */
export const CASE_STARTS: readonly number[] = (() => {
  const out: number[] = [case2];
  let t = skip;
  for (let i = 2; i < CASE_COUNT; i++) {
    if (isFast(i)) {
      out.push(t);
      t += FAST_STEP_MS;
    } else {
      if (isFast(i - 1)) t += SKIP_END_MS - FAST_STEP_MS;
      out.push(t);
      t += CASE_HOLD_MS;
    }
  }
  return out;
})();

const caseSecondLast = CASE_STARTS[CASE_COUNT - 3];
const caseLast = CASE_STARTS[CASE_COUNT - 2];
const hold = caseLast + CASE_HOLD_MS;

export const casesBeats = [
  { name: "frame", startMs: 0 },
  { name: "box", startMs: box },
  { name: "case2", startMs: case2 },
  { name: "skip", startMs: skip },
  { name: "case49", startMs: caseSecondLast },
  { name: "case50", startMs: caseLast },
  { name: "hold", startMs: hold },
  { name: "end", startMs: hold + HOLD_MS },
] as const satisfies readonly Beat[];
