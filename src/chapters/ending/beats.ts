import type { Beat } from "../../types";
import { INDIVIDUAL_MODEL_KEYS } from "./profiles";

/*
 * Durations and beats for the ending, as data. Every visual is a pure function
 * of chapter-local time through the functions below.
 */

export const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);
/** Gentle in and out, so a quarter of the time is already visibly under way. */
export const easeInOut = (t: number) => (1 - Math.cos(Math.PI * clamp01(t))) / 2;
export const ramp = (t: number, from: number, length: number) => (length <= 0 ? (t >= from ? 1 : 0) : clamp01((t - from) / length));

/* -------------------------------------------------------------------------- */
/*  Individual models: one donut, held, then morphed to the next model         */
/* -------------------------------------------------------------------------- */

// TODO: tune after visual review
export const INDIVIDUAL_TIMING = {
  /** How long each model is held, in INDIVIDUAL_MODEL_KEYS order. */
  holdMs: [3200, 3200, 3600],
  /** Sweep from one model's arcs to the next. */
  morphMs: 1200,
} as const;

if (INDIVIDUAL_TIMING.holdMs.length !== INDIVIDUAL_MODEL_KEYS.length) {
  throw new Error("INDIVIDUAL_TIMING.holdMs needs one hold per individual model.");
}

interface Step {
  key: string;
  holdStart: number;
  holdEnd: number;
}

const steps: Step[] = (() => {
  let at = 0;
  return INDIVIDUAL_MODEL_KEYS.map((key, i) => {
    const holdStart = at;
    const holdEnd = holdStart + INDIVIDUAL_TIMING.holdMs[i];
    at = holdEnd + INDIVIDUAL_TIMING.morphMs;
    return { key, holdStart, holdEnd };
  });
})();

/** `<key>` starts that model's hold, `to-<key>` starts the morph into it, `end` closes the chapter. */
export const individualBeats: readonly Beat[] = [
  ...steps.flatMap((s, i) => [
    ...(i > 0 ? [{ name: `to-${s.key}`, startMs: steps[i - 1].holdEnd }] : []),
    { name: s.key, startMs: s.holdStart },
  ]),
  { name: "end", startMs: steps[steps.length - 1].holdEnd },
].sort((a, b) => a.startMs - b.startMs);

export interface IndividualState {
  /** Indices into INDIVIDUAL_MODEL_KEYS. Equal during a hold. */
  from: number;
  to: number;
  /** Eased 0..1 progress of the morph; 0 in a hold. */
  t: number;
}

export function individualState(elapsedMs: number): IndividualState {
  const e = Math.max(0, elapsedMs);
  for (let i = 0; i < steps.length; i++) {
    if (i === steps.length - 1 || e < steps[i].holdEnd) return { from: i, to: i, t: 0 };
    const morphEnd = steps[i].holdEnd + INDIVIDUAL_TIMING.morphMs;
    if (e < morphEnd) return { from: i, to: i + 1, t: easeInOut((e - steps[i].holdEnd) / INDIVIDUAL_TIMING.morphMs) };
  }
  return { from: steps.length - 1, to: steps.length - 1, t: 0 };
}

/**
 * How visible a model's icon and name are at this time. They fade through with the
 * arcs: the old name is gone by the midpoint and the new one arrives after it, so two
 * names are never on top of each other.
 */
export function individualLabelWeight(elapsedMs: number, key: string): number {
  const index = INDIVIDUAL_MODEL_KEYS.indexOf(key as (typeof INDIVIDUAL_MODEL_KEYS)[number]);
  if (index < 0) return 0;
  const s = individualState(elapsedMs);
  if (s.from === s.to) return s.from === index ? 1 : 0;
  return index === s.from ? 1 - ramp(s.t, 0, 0.5) : index === s.to ? ramp(s.t, 0.5, 0.5) : 0;
}

/* -------------------------------------------------------------------------- */
/*  Gallery                                                                   */
/* -------------------------------------------------------------------------- */

// TODO: tune after visual review
export const GALLERY_TIMING = {
  /** The held donut shrinks and flies to its slot; the flight ends at flyMs and starts moving at flyDelayMs. */
  flyMs: 900,
  flyDelayMs: 150,
  /** The held donut's outside labels fade first, in place. */
  flyLabelFadeMs: 300,
  /** Key line and row captions fade in over this long. */
  captionFadeMs: 400,
  /** One donut fading in, and the gap between neighbours. */
  itemFadeMs: 300,
  itemStaggerMs: 90,
  /** Rows dim and the closing question comes in. */
  questionFadeMs: 500,
  /** Rows keep this much opacity behind the question. */
  dimmedOpacity: 0.12,
} as const;

const GALLERY_AT = {
  models: 500,
  physicians: 1700,
  hold: 3100,
  question: 9000,
  end: 13500,
} as const;

export const closingBeats = [
  { name: "fly", startMs: 0 },
  { name: "models", startMs: GALLERY_AT.models },
  { name: "physicians", startMs: GALLERY_AT.physicians },
  { name: "hold", startMs: GALLERY_AT.hold },
  { name: "question", startMs: GALLERY_AT.question },
  { name: "end", startMs: GALLERY_AT.end },
] as const satisfies readonly Beat[];

/** When item `i` of a row that starts at `rowStartMs` is fully in. */
export const itemIn = (elapsedMs: number, rowStartMs: number, i: number) =>
  ramp(elapsedMs, rowStartMs + i * GALLERY_TIMING.itemStaggerMs, GALLERY_TIMING.itemFadeMs);

export const GALLERY_STARTS = { models: GALLERY_AT.models, physicians: GALLERY_AT.physicians, question: GALLERY_AT.question } as const;
