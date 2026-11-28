import allCases from "../../study/data/cases.json";
import type { StudyCase, Tag, Value } from "../../study/types";

/** Queries behind one GPT dot row. */
export const GPT_TRIALS = 10;

/**
 * Short labels for the two added cases. The opening case keeps its own wording.
 * Keys are id prefixes in cases.json.
 */
export const CASE_CHOICE_LABELS = {
  c66799aa: ["Start weight counseling", "Defer weight counseling"],
  "4b731f8c": ["Proceed with chemotherapy", "Cancel chemotherapy"],
} as const;

export type AddedCasePrefix = keyof typeof CASE_CHOICE_LABELS;

export interface DilemmaCard {
  id: string;
  header: string;
  choices: readonly [string, string];
  tags: readonly [Record<Value, Tag>, Record<Value, Tag>];
  /** Dots under choice 1. Choice 2 gets `GPT_TRIALS` minus this. */
  gptChoice1: number;
}

const ADD_ORDER: readonly AddedCasePrefix[] = ["c66799aa", "4b731f8c"];

function noDash(text: string, where: string): string {
  if (/[\u2013\u2014]/.test(text)) throw new Error(`${where} has a dash character on screen`);
  return text;
}

/** First sentence, as written. The same cut the opening uses for its header. */
function firstSentence(vignette: string, id: string): string {
  const match = vignette.match(/^.+?\.(?=\s)/);
  if (!match || !vignette.startsWith(match[0])) throw new Error(`${id}: no first sentence`);
  return noDash(match[0], id);
}

function findByPrefix(prefix: string): StudyCase {
  const matches = (allCases as unknown as StudyCase[]).filter((c) => c.id.startsWith(prefix));
  if (matches.length !== 1) throw new Error(`cases.json: expected one id starting with ${prefix}, found ${matches.length}`);
  return matches[0];
}

function added(prefix: AddedCasePrefix): DilemmaCard {
  const raw = findByPrefix(prefix);
  const labels = CASE_CHOICE_LABELS[prefix];
  const k = raw.modelChoice1Counts.gpt;
  if (!Number.isInteger(k) || k < 0 || k > GPT_TRIALS) {
    throw new Error(`${raw.id}: modelChoice1Counts.gpt is ${String(k)}`);
  }
  noDash(labels[0], prefix);
  noDash(labels[1], prefix);
  return {
    id: raw.id,
    header: firstSentence(raw.vignette, raw.id),
    choices: [labels[0], labels[1]],
    tags: raw.tags,
    gptChoice1: k,
  };
}

/** Weight counseling, then uncertain chemo. */
export const addedCases: readonly DilemmaCard[] = ADD_ORDER.map(added);
