import { valueDefinitions, type ValueId } from "../../data/demoData";
import type { Delta, Profile, StudyCase, Tag, Value } from "../../study/types";

/**
 * Placeholder content for the regression chapter, written against the study
 * contract (`src/study/types.ts`). Swap `placeholderCases` / `placeholderProfile`
 * for real study data; nothing else in the chapter hard-codes a number.
 */

/** Display order of the four values everywhere in the chapter. */
export const VALUE_ORDER: readonly Value[] = ["A", "B", "N", "J"];

const VALUE_ID: Record<Value, ValueId> = {
  A: "autonomy",
  B: "beneficence",
  N: "nonmaleficence",
  J: "justice",
};

export const valueMeta = (v: Value) => ({
  code: v,
  label: valueDefinitions[VALUE_ID[v]].label,
  color: valueDefinitions[VALUE_ID[v]].color,
});

/** Softmax temperature from the study contract: priorities = softmax(weights / τ). */
export const TEMPERATURE = 0.262;

/** Physicians per case behind `physicianVotesChoice1`. */
export const PHYSICIANS_PER_CASE = 25;

/* -------------------------------------------------------------------------- */
/*  Math                                                                      */
/* -------------------------------------------------------------------------- */

export const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));

/** `tags[0] − tags[1]`, per value: how Option 1 differs from Option 2. */
export function deltaOf(c: StudyCase): Delta {
  const out = {} as Delta;
  for (const v of VALUE_ORDER) out[v] = (c.tags[0][v] - c.tags[1][v]) as Delta[Value];
  return out;
}

/** The linear predictor Σ w·Δ for one case under one set of shared weights. */
export function logit(weights: Record<Value, number>, delta: Delta): number {
  return VALUE_ORDER.reduce((sum, v) => sum + weights[v] * delta[v], 0);
}

export function predictedChoice1(weights: Record<Value, number>, c: StudyCase): number {
  return sigmoid(logit(weights, deltaOf(c)));
}

export interface SoftmaxSteps {
  /** exp(w / τ): strictly positive. */
  exps: Record<Value, number>;
  /** Σ exp(w / τ). */
  sum: number;
  /** exp / sum: nonnegative, sums to 1. */
  priorities: Record<Value, number>;
}

export function softmaxSteps(weights: Record<Value, number>, tau = TEMPERATURE): SoftmaxSteps {
  const exps = {} as Record<Value, number>;
  let sum = 0;
  for (const v of VALUE_ORDER) {
    exps[v] = Math.exp(weights[v] / tau);
    sum += exps[v];
  }
  const priorities = {} as Record<Value, number>;
  for (const v of VALUE_ORDER) priorities[v] = exps[v] / sum;
  return { exps, sum, priorities };
}

/* -------------------------------------------------------------------------- */
/*  Placeholder rows                                                          */
/* -------------------------------------------------------------------------- */

/** A tag pair (Option 1, Option 2) that realizes a given difference. */
const TAGS_FOR_DELTA: Record<number, [Tag, Tag]> = {
  2: [1, -1],
  1: [1, 0],
  0: [0, 0],
  [-1]: [0, 1],
  [-2]: [-1, 1],
};

function placeholderCase(id: string, d: Delta, physicianVotesChoice1: number): StudyCase {
  const tags0 = {} as Record<Value, Tag>;
  const tags1 = {} as Record<Value, Tag>;
  for (const v of VALUE_ORDER) [tags0[v], tags1[v]] = TAGS_FOR_DELTA[d[v]];
  return {
    id,
    vignette: "Placeholder case",
    choices: ["Option 1", "Option 2"],
    tags: [tags0, tags1],
    physicianVotesChoice1,
    modelChoice1Counts: {},
  };
}

// TODO: replace with real study data
export const placeholderCases: readonly StudyCase[] = [
  placeholderCase("placeholder-1", { A: 2, B: 1, N: -2, J: 0 }, 13),
  // The case that expands: a genuine trade-off, observed ≈ predicted.
  placeholderCase("placeholder-2", { A: 1, B: 2, N: -1, J: -1 }, 15),
  placeholderCase("placeholder-3", { A: -1, B: 0, N: 2, J: 1 }, 16),
  placeholderCase("placeholder-4", { A: 0, B: -2, N: 1, J: 2 }, 12),
  placeholderCase("placeholder-5", { A: 1, B: -1, N: 2, J: -2 }, 21),
];

/** Index (into `placeholderCases`) of the row that expands. */
export const FOCUS_ROW = 1;

const placeholderWeights: Record<Value, number> = { A: 0.42, B: 0.18, N: 0.5, J: -0.08 };

// TODO: replace with real study data
export const placeholderProfile: Profile = {
  key: "placeholder-pooled-physicians",
  kind: "pooled-physician",
  displayName: "Physicians",
  weights: placeholderWeights,
  priorities: softmaxSteps(placeholderWeights).priorities,
};
