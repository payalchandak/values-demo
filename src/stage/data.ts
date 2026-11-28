import { STACK_CARDS_SHOWN } from "../chapters/stack/caseCards";
import { pickForegroundCases } from "../chapters/stack/pickForeground";
import { allCases } from "../chapters/regression/dataset";
import { ALL_MODELS } from "../chapters/ending/profiles";
import openingJson from "../study/data/opening.json";
import type { Profile, StudyCase } from "../study/types";

/** The opening's case (Figure 1), pinned as the first foreground case. */
export const OPENING_CASE_ID = "0b5a2bcb-0946-461a-8ba1-8f29213f01c5";

export const gptProfile: Profile = (() => {
  const gpt = ALL_MODELS.find((p) => p.key === "gpt");
  if (!gpt) throw new Error('profiles.json has no model "gpt"');
  return gpt;
})();

const opening = allCases.find((c) => c.id === OPENING_CASE_ID);
if (!opening) throw new Error(`Opening case ${OPENING_CASE_ID} is not in cases.json`);

/**
 * The illustrative anorexia case the opening shows, as a study case: vignette,
 * choices and tags from opening.json. Its id is its own (opening.json shares an
 * id with a different case in cases.json). The model counts are those of the
 * case pinned above, as the table's first row has always shown.
 */
const illustrativeCase: StudyCase = {
  id: `${openingJson.caseId}-illustrative`,
  vignette: openingJson.vignette,
  choices: openingJson.choices as [string, string],
  tags: openingJson.tags as StudyCase["tags"],
  physicianVotesChoice1: openingJson.physicianSplit.choice1,
  modelChoice1Counts: { ...opening.modelChoice1Counts },
};

/**
 * The three foreground cases, picked once. Stack and regression both receive
 * exactly this trio: the opening case first, then the two picked by fit.
 */
export const foregroundCases: [StudyCase, StudyCase, StudyCase] = (() => {
  const [second, third] = pickForegroundCases(allCases, OPENING_CASE_ID, gptProfile);
  return [illustrativeCase, second, third];
})();

/**
 * The pile. The first three are the foreground trio. The rest are saved
 * summary cards, up to `STACK_CARDS_SHOWN` (see src/chapters/stack/caseCards.ts).
 */
export const stackCases: readonly StudyCase[] = [
  ...foregroundCases,
  ...allCases.filter((c) => !foregroundCases.includes(c)),
].slice(0, STACK_CARDS_SHOWN);
