import allCases from "../../study/data/cases.json";
import opening from "../../study/data/opening.json";
import profiles from "../../study/data/profiles.json";
import type { StudyCase } from "../../study/types";
import { makePlaceholderCases } from "./placeholderCases";
import { pickForegroundCases } from "./pickForeground";

export const DEFAULT_PROFILE_KEY = "gpt";
const BACKGROUND_COUNT = 47;

/**
 * Real foreground trio (opening case, then two picked cases) followed by
 * seeded placeholder cards for the background of the stack.
 */
export function realStackCases(profileKey: string = DEFAULT_PROFILE_KEY): StudyCase[] {
  const cases = allCases as unknown as StudyCase[];
  const first = cases.find((c) => c.id === opening.caseId);
  if (!first) throw new Error(`Opening case ${opening.caseId} is not in cases.json`);
  return [first, ...pickForegroundCases(cases, opening.caseId, profileKey), ...makePlaceholderCases(BACKGROUND_COUNT)];
}

export function profileLabelFor(profileKey: string): string {
  return profiles.find((p) => p.key === profileKey)?.displayName ?? profileKey;
}
