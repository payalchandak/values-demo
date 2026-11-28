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
/** Cards 4 to 49 (index 3 to 48) are skipped through. The rest are shown at full pace. */
export const isFast = (i: number) => i >= 3 && i <= CASE_COUNT - 2;
/** Skipped cards land as plain blank cards, one after another. */
export const FAST_STEP_MS = 60;
/** A skipped card's soft fade in. */
export const FAST_IN_MS = 320;
/** The skip, start to last blank card. */
export const SKIP_MS = (CASE_COUNT - 5) * FAST_STEP_MS;

const box = FRAME_MS;
/** The anorexia case is not held: the next case follows as soon as the card has drawn. */
const case2 = box + BOX_MS;
/** When the skip begins: after cases 2 and 3 have each been held. */
export const SKIP_START = case2 + CASE_HOLD_MS * 2;

/** Start of card `i` (1 to 49), as an index into this list. */
export const CASE_STARTS: readonly number[] = (() => {
  const out: number[] = [case2, case2 + CASE_HOLD_MS];
  for (let i = 3; i < CASE_COUNT; i++) out.push(isFast(i) ? SKIP_START + (i - 3) * FAST_STEP_MS : SKIP_START + SKIP_MS + 200);
  return out;
})();

const hold = CASE_STARTS[CASE_COUNT - 2] + CASE_HOLD_MS;

export const casesBeats = [
  { name: "frame", startMs: 0 },
  { name: "box", startMs: box },
  { name: "case2", startMs: CASE_STARTS[0] },
  { name: "case3", startMs: CASE_STARTS[1] },
  { name: "skip", startMs: CASE_STARTS[2] },
  { name: "case50", startMs: CASE_STARTS[CASE_COUNT - 2] },
  { name: "hold", startMs: hold },
  { name: "end", startMs: hold + HOLD_MS },
] as const satisfies readonly Beat[];
