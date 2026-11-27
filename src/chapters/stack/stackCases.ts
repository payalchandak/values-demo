import allCases from "../../study/data/cases.json";
import opening from "../../study/data/opening.json";
import profiles from "../../study/data/profiles.json";
import type { Profile, StudyCase } from "../../study/types";
import { makePlaceholderCases } from "./placeholderCases";
import { pickForegroundCases } from "./pickForeground";
import { fitOf, type CaseFit } from "./predict";

export const DEFAULT_PROFILE_KEY = "gpt";
const BACKGROUND_COUNT = 47;

export function profileFor(profileKey: string): Profile {
  const profile = (profiles as unknown as Profile[]).find((p) => p.key === profileKey);
  if (!profile) throw new Error(`No profile "${profileKey}" in profiles.json`);
  return profile;
}

export function profileLabelFor(profileKey: string): string {
  return profileFor(profileKey).displayName;
}

/**
 * Real foreground trio (opening case, then two picked cases) followed by
 * seeded placeholder cards for the background of the stack.
 */
export function realStackCases(profileKey: string = DEFAULT_PROFILE_KEY): StudyCase[] {
  const cases = allCases as unknown as StudyCase[];
  const first = cases.find((c) => c.id === opening.caseId);
  if (!first) throw new Error(`Opening case ${opening.caseId} is not in cases.json`);
  const picked = pickForegroundCases(cases, opening.caseId, profileFor(profileKey));
  return [first, ...picked, ...makePlaceholderCases(BACKGROUND_COUNT)];
}

/** Fit of the three foreground cases (the first three of `cases`) against a profile. */
export function foregroundFits(cases: readonly StudyCase[], profileKey: string): CaseFit[] {
  const profile = profileFor(profileKey);
  return cases.slice(0, 3).map((c) => fitOf(profile, c));
}
