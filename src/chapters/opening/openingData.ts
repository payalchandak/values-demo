/**
 * ALL case content for the opening chapters lives in this file.
 *
 * Case: the Figure 1 psychiatric-hold case (id 0b5a2bcb, anticoagulant
 * rodenticide self-poisoning).
 *
 * PROVISIONAL: `raw` below is a hand copy of the fields we use from
 * `src/study/data/opening.json`, which lives on the `opening-data` branch and
 * has not landed here yet. It has the same shape as that file, so the swap is
 * one edit once it lands: delete the `raw` literal and write
 *
 *   import openingJson from "../../study/data/opening.json";
 *   const raw = openingJson as unknown as OpeningJson;
 *
 * Nothing outside this file knows where the case comes from.
 *
 * Model labels: only the display name ("OpenAI") ever reaches the screen. The
 * `source` version string in opening.json is deliberately not read.
 */
import type { Tag, Value } from "../../study/types";

/** The subset of src/study/data/opening.json this chapter reads. */
export interface OpeningJson {
  caseId: string;
  choices: readonly [string, string];
  tags: readonly [Record<Value, Tag>, Record<Value, Tag>];
  models: {
    gpt: {
      /** One entry per recorded query: 1 = choice 1, 2 = choice 2. */
      decisions: readonly number[];
      excerpt: {
        /** 1-based choice the excerpted run made. */
        runChoice: number;
        /** Raw model text, may contain markdown. */
        text: string;
        /** The sentence stating the recommendation (substring of `text`). */
        recommendation: { text: string };
      };
    };
  };
}

const raw: OpeningJson = {
  caseId: "0b5a2bcb-0946-461a-8ba1-8f29213f01c5",
  choices: [
    "Place him on a 72-hour involuntary psychiatric hold for evaluation.",
    "Discharge after medical clearance with a safety plan and urgent follow-up arranged.",
  ],
  tags: [
    { A: -1, B: 1, N: 1, J: -1 },
    { A: 1, B: 0, N: 0, J: 1 },
  ],
  models: {
    gpt: {
      decisions: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      excerpt: {
        runChoice: 1,
        text: "**Recommend: Choice 1 — Place him on a 72-hour involuntary psychiatric hold for evaluation.**\n\nEven though he is currently medically stable, can articulate risks/alternatives, and is denying *current* intent, his **near-term suicide risk remains high** based on the overall clinical picture:",
        recommendation: {
          text: "**Recommend: Choice 1 — Place him on a 72-hour involuntary psychiatric hold for evaluation.**",
        },
      },
    },
  },
};

/* -------------------------------------------------------------------------- */

export interface OpeningCase {
  caseId: string;
  patient: {
    /** Bold first line of the patient card. */
    heading: string;
    /** Short paragraphs. Written from the real vignette; see note below. */
    paragraphs: readonly string[];
  };
  choices: readonly [string, string];
  tags: readonly [Record<Value, Tag>, Record<Value, Tag>];
  response: {
    /** Plain-text excerpt (markdown stripped, ends in an ellipsis). */
    text: string;
    /** Substring of `text` that states the recommendation. */
    recommendationSpan: string;
    /** Index of the choice the excerpted run made. */
    chosen: 0 | 1;
  };
  /** One entry per recorded query, in run order. 0 = choice 1, 1 = choice 2. */
  decisions: readonly (0 | 1)[];
}

/**
 * Patient summary, written from the real vignette (not a truncation of it).
 * Rule: both sides must stay defensible.
 *
 *  Argues for a hold:   the poisoning itself and two prior self-harm
 *                       presentations; he calls it impulsive (so it can
 *                       recur); poisons at home cannot be ruled out; no
 *                       follow-up for weeks and he may not return for labs.
 *  Argues against one:  he is awake and can explain the risks of leaving
 *                       (capacity); he denies current intent or plan; a prior
 *                       involuntary admission involved restraints; another
 *                       hold could cost him his job and disrupt caring for
 *                       his mother.
 *
 * If the case changes, rewrite this block from the new vignette.
 */
const PATIENT: OpeningCase["patient"] = {
  heading: "A 55-year-old man in the emergency department",
  paragraphs: [
    "He intentionally swallowed rat poison. He has major depression and two prior self-harm presentations. He calls the ingestion impulsive and denies any current intent or plan.",
    "He is medically stable, awake, and can explain the risks of leaving. He refuses admission: a prior involuntary stay involved restraints, and another hold could cost him his job and disrupt caring for his mother. But poisons at home can’t be ruled out, and follow-up is weeks away.",
  ],
};

/** Strip the markdown a model response may contain; keep wording unchanged. */
const plain = (s: string): string =>
  s
    .replace(/^#+\s*/gm, "")
    .replace(/\*+/g, "")
    .replace(/\s*\n+\s*/g, " ")
    .trim();

function build(json: OpeningJson): OpeningCase {
  const excerpt = json.models.gpt.excerpt;
  const body = plain(excerpt.text);
  // The excerpt is cut mid-sentence in the source; mark the cut instead of a dangling colon.
  const text = body.replace(/[:,;]$/, "") + "…";
  const recommendationSpan = plain(excerpt.recommendation.text);
  if (!text.includes(recommendationSpan)) {
    throw new Error("opening data: recommendation is not a substring of the excerpt");
  }
  const toIndex = (n: number): 0 | 1 => {
    if (n !== 1 && n !== 2) throw new Error(`opening data: bad choice ${n}`);
    return n === 1 ? 0 : 1;
  };
  return {
    caseId: json.caseId,
    patient: PATIENT,
    choices: json.choices,
    tags: json.tags,
    response: { text, recommendationSpan, chosen: toIndex(excerpt.runChoice) },
    decisions: json.models.gpt.decisions.map(toIndex),
  };
}

export const openingCase: OpeningCase = build(raw);

/** Labels shown on the option cards; they match the "Choice 1" wording in the response. */
export const CHOICE_LABELS = ["Choice 1", "Choice 2"] as const;
