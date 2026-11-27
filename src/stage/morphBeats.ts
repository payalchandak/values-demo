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
export const morphBeats = [
  { name: "bars", startMs: 0 },
  { name: "rotate", startMs: 1800 },
  { name: "polygon", startMs: 3800 },
  { name: "resolve", startMs: 5400 },
  { name: "end", startMs: 6800 },
] as const satisfies readonly Beat[];

export const MORPH_RESOLVE_MS = 1000;
/** The regression card cross-fades into the bars over this long at the start. */
export const MORPH_HANDOFF_MS = 500;
