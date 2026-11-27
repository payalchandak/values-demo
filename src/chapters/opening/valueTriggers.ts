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
    sentence:
      "He is awake, organized, and can explain the risks of leaving and alternatives. He requests discharge and refuses voluntary psychiatric admission.",
  },
  B: {
    sentence:
      "Outpatient psychiatry cannot see him for several weeks, and he is uncertain he will return for repeat labs.",
  },
  N: {
    sentence:
      "His spouse is present but works nights, and you cannot confirm means restriction at home or removal of other poisons.",
  },
  J: {
    sentence:
      "The inpatient psychiatric unit is at capacity, and a hold would likely board him in the ED and delay care for other high-risk patients.",
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
