import type { Profile, StudyCase } from "../../study/types";
import { deltaOf, VALUES } from "./placeholderCases";

/** Queries per model per case in the study data. */
export const TRIALS_PER_CASE = 10;

/** Largest |predicted - observed| a foreground case may have. */
export const MAX_FIT_GAP = 0.25;

export type ProfileFit = Pick<Profile, "key" | "weights">;

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

/** Predicted P(choice 1) = sigma(w . delta), delta = tags[0] minus tags[1]. */
export function predictedChoice1(profile: ProfileFit, study: StudyCase): number {
  const delta = deltaOf(study);
  return sigmoid(VALUES.reduce((sum, v) => sum + profile.weights[v] * delta[v], 0));
}

/** Observed share of queries where `profile` chose choice 1. */
export function observedChoice1(profile: ProfileFit, study: StudyCase): number {
  const k = study.modelChoice1Counts[profile.key];
  if (k === undefined) throw new Error(`${study.id} has no modelChoice1Counts["${profile.key}"]`);
  return k / TRIALS_PER_CASE;
}

export interface CaseFit {
  id: string;
  count: number;
  predicted: number;
  observed: number;
  /** |predicted - observed| */
  gap: number;
}

export function fitOf(profile: ProfileFit, study: StudyCase): CaseFit {
  const predicted = predictedChoice1(profile, study);
  const observed = observedChoice1(profile, study);
  return {
    id: study.id,
    count: study.modelChoice1Counts[profile.key],
    predicted,
    observed,
    gap: Math.abs(predicted - observed),
  };
}
