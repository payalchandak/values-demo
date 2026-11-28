import { allCases } from "../regression/dataset";
import type { StudyCase, Tag, Value } from "../../study/types";

/** Queries behind one GPT dot row. */
export const GPT_TRIALS = 10;

/**
 * Short choice labels for the four hand-labelled cases. Keys are id prefixes in cases.json.
 * Every other case shows its own choices. `k` is noted for reference.
 */
export const CASE_CHOICE_LABELS = [
  { prefix: "4b731f8c", k: 7, labels: ["Give chemotherapy", "Stop chemotherapy"] },
  { prefix: "7129cbd9", k: 3, labels: ["Amputate the leg", "Continue antibiotics"] },
  { prefix: "c66799aa", k: 10, labels: ["Start counseling", "Defer counseling"] },
  { prefix: "7bd46c3e", k: 0, labels: ["Transfer both", "Transfer one"] },
] as const;
type Labelled = (typeof CASE_CHOICE_LABELS)[number];
const labelOf = (prefix: string): Labelled => {
  const f = CASE_CHOICE_LABELS.find((l) => l.prefix === prefix);
  if (!f) throw new Error(`no labels for ${prefix}`);
  return f;
};

export interface DilemmaCard {
  id: string;
  header: string;
  choices: readonly [string, string];
  tags: readonly [Record<Value, Tag>, Record<Value, Tag>];
  /** Dots under choice 1. Choice 2 gets `GPT_TRIALS` minus this. */
  gptChoice1: number;
}

/** No dash characters on screen: swap them for a comma. */
function noDash(text: string, _where: string): string {
  return text.replace(/\s*[\u2013\u2014]\s*/g, ", ");
}

/** First sentence, as written. The same cut the opening uses for its header. */
function firstSentence(vignette: string, id: string): string {
  const match = vignette.match(/^.+?\.(?=\s)/);
  return noDash(match && vignette.startsWith(match[0]) ? match[0] : vignette, id);
}

function findByPrefix(prefix: string): StudyCase {
  const matches = allCases.filter((c) => c.id.startsWith(prefix));
  if (matches.length !== 1) throw new Error(`cases.json: expected one id starting with ${prefix}, found ${matches.length}`);
  return matches[0];
}

function toCard(raw: StudyCase, labels?: readonly [string, string]): DilemmaCard {
  const k = raw.modelChoice1Counts.gpt;
  if (!Number.isInteger(k) || k < 0 || k > GPT_TRIALS) {
    throw new Error(`${raw.id}: modelChoice1Counts.gpt is ${String(k)}`);
  }
  const [c1, c2] = labels ?? raw.choices;
  return {
    id: raw.id,
    header: firstSentence(raw.vignette, raw.id),
    choices: [noDash(c1, raw.id), noDash(c2, raw.id)],
    tags: raw.tags,
    gptChoice1: k,
  };
}

/** The opening's case is card 1 and is built by the scene. */
const OPENING_PREFIX = "0b5a2bcb";
const FIRST = "4b731f8c";
const LAST_TWO = ["c66799aa", "7bd46c3e"] as const;

/** Cards 2 to 50: chemotherapy, every other case as is, then weight counseling and embryo transfer. */
export const addedCases: readonly DilemmaCard[] = (() => {
  const named = new Set<string>([OPENING_PREFIX, FIRST, ...LAST_TWO]);
  const middle = allCases.filter((c) => ![...named].some((p) => c.id.startsWith(p)));
  const labelled = (prefix: string) => {
    const l = labelOf(prefix);
    return toCard(findByPrefix(prefix), l.labels);
  };
  const out = [
    labelled(FIRST),
    ...middle.map((c) => {
      const l = CASE_CHOICE_LABELS.find((x) => c.id.startsWith(x.prefix));
      return toCard(c, l?.labels);
    }),
    ...LAST_TWO.map(labelled),
  ];
  return out;
})();
