import { VALUE_ORDER } from "../../design";
import { TEMPERATURE } from "../../study/verify";
import type { Delta, Profile, StudyCase, Value } from "../../study/types";

/**
 * Pure math for the regression chapter. No study numbers live here: weights,
 * priorities, tags, and counts all come from the `Profile` / `StudyCase` props
 * (see `dataset.ts` for where the real ones are loaded).
 */

export { TEMPERATURE, VALUE_ORDER };

/** Model queries per case (the denominator of `modelChoice1Counts`). */
export const MODEL_RUNS = 10;

export const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));

/** `tags[0] - tags[1]`, per value: how Option 1 differs from Option 2. */
export function deltaOf(c: StudyCase): Delta {
  const diff = (v: Value) => c.tags[0][v] - c.tags[1][v];
  const toStep = (n: number): Delta[Value] => {
    if (n === -2 || n === -1 || n === 0 || n === 1 || n === 2) return n;
    throw new Error(`tag difference ${n} is outside -2..2 (case ${c.id})`);
  };
  return { A: toStep(diff("A")), B: toStep(diff("B")), N: toStep(diff("N")), J: toStep(diff("J")) };
}

/** The linear predictor w . delta for one case under one set of shared weights. */
export function logit(weights: Record<Value, number>, delta: Delta): number {
  return VALUE_ORDER.reduce((sum, v) => sum + weights[v] * delta[v], 0);
}

export interface SoftmaxSteps {
  /** exp(w / tau): strictly positive. */
  exps: Record<Value, number>;
  /** Sum of the exps. */
  sum: number;
  /** exp / sum: nonnegative, sums to 1. */
  priorities: Record<Value, number>;
}

export function softmaxSteps(weights: Record<Value, number>, tau = TEMPERATURE): SoftmaxSteps {
  const exps = {
    A: Math.exp(weights.A / tau),
    B: Math.exp(weights.B / tau),
    N: Math.exp(weights.N / tau),
    J: Math.exp(weights.J / tau),
  };
  const sum = exps.A + exps.B + exps.N + exps.J;
  return {
    exps,
    sum,
    priorities: { A: exps.A / sum, B: exps.B / sum, N: exps.N / sum, J: exps.J / sum },
  };
}

/** Largest absolute gap between the softmax of `profile.weights` and `profile.priorities`. */
export function priorityMismatch(profile: Profile): number {
  const computed = softmaxSteps(profile.weights).priorities;
  return Math.max(...VALUE_ORDER.map((v) => Math.abs(computed[v] - profile.priorities[v])));
}

/** Observed share of Option 1 for this profile on this case, as a count out of `MODEL_RUNS`. */
export function observedCount(c: StudyCase, profile: Profile): number | undefined {
  return c.modelChoice1Counts[profile.key];
}

/** The model's predicted P(Option 1) on a case: sigma(w . delta). */
export function predictedChoice1(c: StudyCase, profile: Profile): number {
  return sigmoid(logit(profile.weights, deltaOf(c)));
}

/**
 * |predicted - observed| for one case, or undefined when the profile has no
 * observed count for it.
 */
export function fitGap(c: StudyCase, profile: Profile): number | undefined {
  const k = observedCount(c, profile);
  return k === undefined ? undefined : Math.abs(predictedChoice1(c, profile) - k / MODEL_RUNS);
}

/**
 * Index of the row the prediction matches best (smallest gap). Ties go to the
 * earlier row; rows without an observed count are skipped. Falls back to 0 when
 * no row has one.
 */
export function bestFitIndex(rows: readonly StudyCase[], profile: Profile): number {
  let best = 0;
  let bestGap = Infinity;
  rows.forEach((row, i) => {
    const gap = fitGap(row, profile);
    if (gap !== undefined && gap < bestGap) {
      best = i;
      bestGap = gap;
    }
  });
  return best;
}
