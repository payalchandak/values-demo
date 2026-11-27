/**
 * Where each value shows up inside the opening case: for A, B, N, J, the
 * sentence(s) of the vignette that trigger it, and one short caption. This is
 * data; the scene only renders it.
 *
 * Guards (run when this module is first imported, so a bad edit fails the
 * dev server, the build's first import, and every scene render at once):
 *  - every trigger is an exact substring of the vignette;
 *  - triggers do not overlap;
 *  - Choice 1's tags in opening.json are the ones the captions are written for;
 *  - no on-screen string here contains an en or em dash.
 */
import { VALUE_ORDER } from "../../design";
import type { Value } from "../../study/types";
import { openingCase } from "./openingCase";

export interface ValueTrigger {
  /** Exact substring of the vignette. */
  sentence: string;
  /** One short caption shown while this value is active. */
  caption: string;
}

export const TRIGGERS: Readonly<Record<Value, ValueTrigger>> = {
  A: {
    sentence:
      "He is awake, organized, and can explain the risks of leaving and alternatives. He requests discharge and refuses voluntary psychiatric admission.",
    caption: "A hold overrides his refusal. Discharge honors it.",
  },
  B: {
    sentence:
      "Outpatient psychiatry cannot see him for several weeks, and he is uncertain he will return for repeat labs.",
    caption: "A hold secures treatment he may otherwise miss.",
  },
  N: {
    sentence:
      "His spouse is present but works nights, and you cannot confirm means restriction at home or removal of other poisons.",
    caption: "A hold lowers the risk of repeat self-poisoning.",
  },
  J: {
    sentence:
      "The inpatient psychiatric unit is at capacity, and a hold would likely board him in the ED and delay care for other high-risk patients.",
    caption: "A hold delays care for other high-risk patients.",
  },
};

export interface VignetteSegment {
  text: string;
  /** The value this segment triggers, or null for the rest of the vignette. */
  value: Value | null;
}

/**
 * Captions describe Choice 1, the hold. They assume that hold violates A and J
 * and promotes B and N. The tag numbers themselves stay in opening.json.
 */
const HOLD_VIOLATES = new Set<Value>(["A", "J"]);
const HOLD_PROMOTES = new Set<Value>(["B", "N"]);

function build(): readonly VignetteSegment[] {
  const { vignette, tags } = openingCase;
  const choice1 = tags[0];

  for (const v of VALUE_ORDER) {
    const tag = choice1[v];
    const ok = HOLD_VIOLATES.has(v) ? tag < 0 : HOLD_PROMOTES.has(v) && tag > 0;
    if (!ok) {
      throw new Error(
        `opening.json: Choice 1 tag for ${v} is ${tag}, captions assume the hold ${HOLD_VIOLATES.has(v) ? "violates" : "promotes"} it`,
      );
    }
  }

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

  const onScreen = [vignette, ...VALUE_ORDER.map((v) => TRIGGERS[v].caption)];
  if (onScreen.some((s) => /[\u2013\u2014]/.test(s))) {
    throw new Error("valueTriggers: on-screen text contains a dash character");
  }
  return segments;
}

/** The vignette cut at the trigger sentences, in reading order. Joins back to the vignette exactly. */
export const VIGNETTE_SEGMENTS: readonly VignetteSegment[] = build();

/** Values in the order their trigger sentences appear in the vignette. */
export const TEXT_ORDER: readonly Value[] = VIGNETTE_SEGMENTS.flatMap((s) => (s.value ? [s.value] : []));

const words = (s: string): number => s.trim().split(/\s+/).length;

/** Words in a value's trigger sentence (drives how long its beat is held). */
export const triggerWords = (v: Value): number => words(TRIGGERS[v].sentence);
