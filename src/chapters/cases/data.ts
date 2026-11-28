import { allCases } from "../regression/dataset";
import type { StudyCase, Tag, Value } from "../../study/types";

/** Queries behind one GPT dot row. */
export const GPT_TRIALS = 10;

/**
 * Short choice labels for the four cases that follow the opening case, in play order.
 * Keys are id prefixes in cases.json. The opening case keeps its own wording.
 * Expected GPT counts for choice 1 are noted for reference and checked against the data.
 */
export const CASE_CHOICE_LABELS = [
  { prefix: "4b731f8c", k: 7, labels: ["Give chemotherapy", "Stop chemotherapy"] },
  { prefix: "7129cbd9", k: 3, labels: ["Amputate the leg", "Continue antibiotics"] },
  { prefix: "c66799aa", k: 10, labels: ["Start counseling", "Defer counseling"] },
  { prefix: "7bd46c3e", k: 0, labels: ["Transfer both", "Transfer one"] },
] as const;

export interface DilemmaCard {
  id: string;
  header: string;
  choices: readonly [string, string];
  tags: readonly [Record<Value, Tag>, Record<Value, Tag>];
  /** Dots under choice 1. Choice 2 gets `GPT_TRIALS` minus this. */
  gptChoice1: number;
}

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
  const matches = allCases.filter((c) => c.id.startsWith(prefix));
  if (matches.length !== 1) throw new Error(`cases.json: expected one id starting with ${prefix}, found ${matches.length}`);
  return matches[0];
}

function added(entry: (typeof CASE_CHOICE_LABELS)[number]): DilemmaCard {
  const raw = findByPrefix(entry.prefix);
  const k = raw.modelChoice1Counts.gpt;
  if (!Number.isInteger(k) || k < 0 || k > GPT_TRIALS) {
    throw new Error(`${raw.id}: modelChoice1Counts.gpt is ${String(k)}`);
  }
  noDash(entry.labels[0], entry.prefix);
  noDash(entry.labels[1], entry.prefix);
  return {
    id: raw.id,
    header: firstSentence(raw.vignette, raw.id),
    choices: [entry.labels[0], entry.labels[1]],
    tags: raw.tags,
    gptChoice1: k,
  };
}

/** Chemotherapy, amputation, weight counseling, embryo transfer. */
export const addedCases: readonly DilemmaCard[] = CASE_CHOICE_LABELS.map(added);
