import { FADE_MS, MOVE_MS } from "../design/motion";
import type { Beat } from "../types";

/**
 * Bars-to-radar morph, as data. Every visual in `Morph` is a pure function of
 * chapter-local time, so it plays, pauses and scrubs on the chapter clock.
 *
 *   bars     the four normalized priority bars, held
 *   rotate   each bar swings about its start into its radial length on the fixed axes
 *   polygon  the neutral polygon draws; vertex dots appear in value colors
 *   resolve  cross-fade into GPT's radar, the first individual profile
 */
// TODO: tune after visual review
/** The four bars sit still before they swing onto the axes. */
const BARS_HOLD_MS = 1800;
const rotate = BARS_HOLD_MS;
const polygon = rotate + MOVE_MS;
const resolve = polygon + MOVE_MS;
const end = resolve + FADE_MS;

export const morphBeats = [
  { name: "bars", startMs: 0 },
  { name: "rotate", startMs: rotate },
  { name: "polygon", startMs: polygon },
  { name: "resolve", startMs: resolve },
  { name: "end", startMs: end },
] as const satisfies readonly Beat[];

export const MORPH_RESOLVE_MS = FADE_MS;
/** The regression card cross-fades into the bars over this long at the start. */
export const MORPH_HANDOFF_MS = FADE_MS;
