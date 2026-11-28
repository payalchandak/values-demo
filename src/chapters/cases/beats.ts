import type { Beat } from "../../types";

/** Still on the opening's last frame before the card draws around it. */
export const FRAME_MS = 400;
/** The white card fades in and the group narrows. */
export const BOX_MS = 700;
/** Wide screens: each new card fades in. */
export const CARD_MS = 600;
/** Narrow screens: each card cross-fades into the next. */
export const NARROW_MS = 2000;
/** Dots on a new card land one after another. */
export const DOT_STAGGER_MS = 60;
/** How long one new dot takes to appear. */
export const DOT_IN_MS = 160;
/** Hold after the last card is in. */
export const HOLD_MS = 2000;

const second = FRAME_MS + BOX_MS;
const third = second + NARROW_MS;
const hold = third + NARROW_MS;

export const casesBeats = [
  { name: "frame", startMs: 0 },
  { name: "box", startMs: FRAME_MS },
  { name: "second", startMs: second },
  { name: "third", startMs: third },
  { name: "hold", startMs: hold },
  { name: "end", startMs: hold + HOLD_MS },
] as const satisfies readonly Beat[];
