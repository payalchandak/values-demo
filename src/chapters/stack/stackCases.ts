import allCases from "../../study/data/cases.json";
import opening from "../../study/data/opening.json";
import profiles from "../../study/data/profiles.json";
import type { Profile, StudyCase } from "../../study/types";
import { STACK_CARDS_SHOWN } from "./caseCards";
import { pickForegroundCases } from "./pickForeground";
import { fitOf, type CaseFit } from "./predict";

export const DEFAULT_PROFILE_KEY = "gpt";

export function profileFor(profileKey: string): Profile {
  const profile = (profiles as unknown as Profile[]).find((p) => p.key === profileKey);
  if (!profile) throw new Error(`No profile "${profileKey}" in profiles.json`);
  return profile;
}

export function profileLabelFor(profileKey: string): string {
  return profileFor(profileKey).displayName;
}

/**
 * Saved summary cards for the pile: the opening case, the two picked cases,
 * then the other cases in study order. `shown` defaults to `STACK_CARDS_SHOWN`.
 */
export function realStackCases(
  profileKey: string = DEFAULT_PROFILE_KEY,
  shown: number = STACK_CARDS_SHOWN,
): StudyCase[] {
  const cases = allCases as unknown as StudyCase[];
  const first = cases.find((c) => c.id === opening.caseId);
  if (!first) throw new Error(`Opening case ${opening.caseId} is not in cases.json`);
  const picked = pickForegroundCases(cases, opening.caseId, profileFor(profileKey));
  const foreground = [first, ...picked];
  const rest = cases.filter((c) => !foreground.includes(c));
  const count = Math.min(cases.length, Math.max(foreground.length, shown));
  return [...foreground, ...rest].slice(0, count);
}

/** Fit of the three foreground cases (the first three of `cases`) against a profile. */
export function foregroundFits(cases: readonly StudyCase[], profileKey: string): CaseFit[] {
  const profile = profileFor(profileKey);
  return cases.slice(0, 3).map((c) => fitOf(profile, c));
}
