import type { Beat } from "../../types";

/** Still on the opening's last frame before the card draws around it. */
export const FRAME_MS = 600;
/** The white card fades in and the group narrows. */
export const BOX_MS = 1000;
/** How long each case is held, from the moment it starts to flash in. Tune here. */
export const CASE_HOLD_MS = 2600;
/** The old content fades out. */
export const OUT_MS = 300;
/** The new content fades in, after the old one is gone. */
export const IN_MS = 450;
/** Dots on a new case land this far apart. */
export const DOT_STAGGER_MS = 70;
/** How long one dot takes to appear. */
export const DOT_IN_MS = 220;
/** Hold after the last case. */
export const HOLD_MS = 2200;

const box = FRAME_MS;
/** The anorexia case is held for a full beat once the box has finished. */
const case2 = box + BOX_MS + CASE_HOLD_MS;
const case3 = case2 + CASE_HOLD_MS;
const case4 = case3 + CASE_HOLD_MS;
const case5 = case4 + CASE_HOLD_MS;
const hold = case5 + CASE_HOLD_MS;

/** Start of case 2 to 5 (index 1 to 4). Case 1 has no entry: it is the opening's own frame. */
export const CASE_STARTS = [case2, case3, case4, case5] as const;

export const casesBeats = [
  { name: "frame", startMs: 0 },
  { name: "box", startMs: box },
  { name: "case2", startMs: case2 },
  { name: "case3", startMs: case3 },
  { name: "case4", startMs: case4 },
  { name: "case5", startMs: case5 },
  { name: "hold", startMs: hold },
  { name: "end", startMs: hold + HOLD_MS },
] as const satisfies readonly Beat[];
