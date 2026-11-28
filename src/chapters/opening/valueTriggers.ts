/**
 * Where each value shows up inside the opening case: for A, B, N, J, the
 * span(s) of the vignette that trigger it (J has none). This is data; the scene only
 * renders it.
 *
 * Guards (run when this module is first imported, so a bad edit fails the
 * dev server, the build's first import, and every scene render at once):
 *  - every trigger is an exact substring of the vignette;
 *  - triggers do not overlap;
 *  - no on-screen string here contains an en or em dash.
 */
import { VALUE_ORDER } from "../../design";
import type { Value } from "../../study/types";
import { openingCase } from "./openingCase";

/** Exact substrings of the vignette per value, in reading order. A value may have none. */
export const TRIGGERS: Readonly<Record<Value, readonly string[]>> = {
  A: ["She is eating only about 25% of her meals and refuses oral nutritional supplements."],
  B: [
    "admitted for bradycardia and orthostatic hypotension",
    "her intake has not improved over 24 hours, and her weight has been stable since admission.",
  ],
  N: ["Her abdomen is distended with absent bowel sounds, and she has had two episodes of vomiting today."],
  J: [],
};

export interface VignetteSegment {
  text: string;
  /** The value this segment triggers, or null for the rest of the vignette. */
  value: Value | null;
  /** Words in this value's earlier spans (0 for its first span). */
  wordsBefore: number;
  /** Words across all of this value's spans. */
  wordsTotal: number;
}

const words = (s: string): number => s.trim().split(/\s+/).length;

function build(): readonly VignetteSegment[] {
  const { vignette } = openingCase;

  const found = VALUE_ORDER.flatMap((v) => {
    const total = TRIGGERS[v].reduce((n, sp) => n + words(sp), 0);
    let before = 0;
    return TRIGGERS[v].map((sentence) => {
      const start = vignette.indexOf(sentence);
      if (start === -1) throw new Error(`valueTriggers: a trigger for ${v} is not a substring of the vignette`);
      if (vignette.indexOf(sentence, start + 1) !== -1) {
        throw new Error(`valueTriggers: a trigger for ${v} matches the vignette more than once`);
      }
      const f = { v, start, end: start + sentence.length, before, total };
      before += words(sentence);
      return f;
    });
  }).sort((a, b) => a.start - b.start);

  const segments: VignetteSegment[] = [];
  let cursor = 0;
  for (const { v, start, end, before, total } of found) {
    if (start < cursor) throw new Error(`valueTriggers: a trigger for ${v} overlaps another trigger`);
    if (start > cursor) segments.push({ text: vignette.slice(cursor, start), value: null, wordsBefore: 0, wordsTotal: 0 });
    segments.push({ text: vignette.slice(start, end), value: v, wordsBefore: before, wordsTotal: total });
    cursor = end;
  }
  if (cursor < vignette.length) {
    segments.push({ text: vignette.slice(cursor), value: null, wordsBefore: 0, wordsTotal: 0 });
  }

  if (/[\u2013\u2014]/.test(vignette)) {
    throw new Error("valueTriggers: on-screen text contains a dash character");
  }
  return segments;
}

/** The vignette cut at the trigger spans, in reading order. Joins back to the vignette exactly. */
export const VIGNETTE_SEGMENTS: readonly VignetteSegment[] = build();

/** Total words across a value's spans (drives how long its beat is held; 0 for none). */
export const triggerWords = (v: Value): number => TRIGGERS[v].reduce((n, sp) => n + words(sp), 0);
