/**
 * Where each value shows up inside the opening case: for A, B, N, J, the
 * sentence(s) of the vignette that trigger it. This is data; the scene only
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

export interface ValueTrigger {
  /** Exact substring of the vignette. */
  sentence: string;
}

export const TRIGGERS: Readonly<Record<Value, ValueTrigger>> = {
  A: {
    sentence: "She is eating only about 25% of her meals and refuses oral nutritional supplements.",
  },
  B: {
    sentence:
      "She agrees to “try harder tomorrow,” but her intake has not improved over 24 hours, and her weight has been stable since admission.",
  },
  N: {
    sentence: "Her abdomen is distended with absent bowel sounds, and she has had two episodes of vomiting today.",
  },
  // J is a placeholder: J is neutral (0) for both choices in this case.
  J: {
    sentence: "Her QTc interval is normal at 420 ms, indicating a stable heart rhythm.",
  },
};

export interface VignetteSegment {
  text: string;
  /** The value this segment triggers, or null for the rest of the vignette. */
  value: Value | null;
}

function build(): readonly VignetteSegment[] {
  const { vignette } = openingCase;

  const found = VALUE_ORDER.map((v) => {
    const { sentence } = TRIGGERS[v];
    const start = vignette.indexOf(sentence);
    if (start === -1) throw new Error(`valueTriggers: trigger for ${v} is not a substring of the vignette`);
    if (vignette.indexOf(sentence, start + 1) !== -1) {
      throw new Error(`valueTriggers: trigger for ${v} matches the vignette more than once`);
    }
    return { v, start, end: start + sentence.length };
  }).sort((a, b) => a.start - b.start);

  const segments: VignetteSegment[] = [];
  let cursor = 0;
  for (const { v, start, end } of found) {
    if (start < cursor) throw new Error(`valueTriggers: trigger for ${v} overlaps another trigger`);
    if (start > cursor) segments.push({ text: vignette.slice(cursor, start), value: null });
    segments.push({ text: vignette.slice(start, end), value: v });
    cursor = end;
  }
  if (cursor < vignette.length) segments.push({ text: vignette.slice(cursor), value: null });

  if (/[\u2013\u2014]/.test(vignette)) {
    throw new Error("valueTriggers: on-screen text contains a dash character");
  }
  return segments;
}

/** The vignette cut at the trigger sentences, in reading order. Joins back to the vignette exactly. */
export const VIGNETTE_SEGMENTS: readonly VignetteSegment[] = build();

const words = (s: string): number => s.trim().split(/\s+/).length;

/** Words in a value's trigger sentence (drives how long its beat is held). */
export const triggerWords = (v: Value): number => words(TRIGGERS[v].sentence);
