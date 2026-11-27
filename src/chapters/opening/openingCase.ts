/**
 * The opening case, read from src/study/data/opening.json (the Figure 1
 * psychiatric-hold case, 0b5a2bcb). Everything the opening chapters show about
 * the case comes through this file; the only text written by hand is the
 * patient summary below.
 *
 * Model labels: only the display name ("OpenAI") ever reaches the screen. The
 * `source` version string in opening.json is never read.
 */
import openingJson from "../../study/data/opening.json";
import type { Tag, Value } from "../../study/types";

/** The fields of opening.json this chapter reads. */
interface OpeningJson {
  caseId: string;
  choices: readonly [string, string];
  tags: readonly [Record<Value, Tag>, Record<Value, Tag>];
  models: {
    gpt: {
      /** One entry per recorded query, in run order: 1 = choice 1, 2 = choice 2. */
      decisions: readonly number[];
      excerpt: {
        /** 1-based choice the excerpted run made. */
        runChoice: number;
        /** Raw model text; may contain markdown. */
        text: string;
        /** Marked recommendation sentence: character offsets into `text`. */
        recommendation: { start: number; end: number };
      };
    };
  };
}

const raw = openingJson as unknown as OpeningJson;

export interface OpeningCase {
  caseId: string;
  patient: {
    /** Bold first line of the patient card. */
    heading: string;
    /** Short paragraphs. */
    paragraphs: readonly string[];
  };
  /** Exact choice wording from the case. */
  choices: readonly [string, string];
  tags: readonly [Record<Value, Tag>, Record<Value, Tag>];
  response: {
    /** Display text of the excerpt (markdown stripped, ends in an ellipsis). */
    text: string;
    /** Substring of `text`: the marked recommendation sentence. */
    recommendationSpan: string;
    /** Index of the choice the excerpted run made. */
    chosen: 0 | 1;
  };
  /** The recorded decisions, in run order. 0 = choice 1, 1 = choice 2. */
  decisions: readonly (0 | 1)[];
}

/**
 * Patient summary, written from the real vignette in src/study/data
 * (clinical tone, nothing beyond the points below).
 *
 *  For a hold:      intentional poisoning described as impulsive; two prior
 *                   self-harm presentations; means at home unconfirmed;
 *                   outpatient follow-up weeks away.
 *  Against a hold:  he can explain the risks and denies current intent; his
 *                   job and caregiving; a prior hold with restraints.
 *  Context:         the inpatient unit is at capacity, so a hold would board
 *                   him in the ED and delay other high-risk patients.
 */
const PATIENT: OpeningCase["patient"] = {
  heading: "A 55-year-old man in the ED",
  paragraphs: [
    "He presented after intentional self-poisoning with an anticoagulant rodenticide, which he describes as impulsive. He has two prior self-harm presentations. Means restriction at home cannot be confirmed, and outpatient psychiatry cannot see him for several weeks.",
    "He can explain the risks of leaving and denies current intent. He reports a prior involuntary admission with restraints, and another hold could cost him his job and disrupt caregiving for his mother. The inpatient psychiatric unit is at capacity, so a hold would board him in the ED and delay care for other high-risk patients.",
  ],
};

/**
 * Display form of model text: markdown markers removed, line breaks folded to
 * spaces, and em dashes written as a spaced hyphen (no em dashes on screen).
 */
const plain = (s: string): string =>
  s
    .replace(/^#+\s*/gm, "")
    .replace(/\*+/g, "")
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\s*\u2014\s*/g, " - ")
    .trim();

function toIndex(n: number): 0 | 1 {
  if (n !== 1 && n !== 2) throw new Error(`opening.json: bad choice ${n}`);
  return n === 1 ? 0 : 1;
}

function build(json: OpeningJson): OpeningCase {
  const { text, recommendation, runChoice } = json.models.gpt.excerpt;
  // Cut by the marked offsets first, so the recommendation sentence is exactly
  // the one the data marks, then clean each piece for display.
  const before = plain(text.slice(0, recommendation.start));
  const span = plain(text.slice(recommendation.start, recommendation.end));
  const after = plain(text.slice(recommendation.end));
  // The excerpt is cut mid-sentence in the source; show the cut as an ellipsis.
  const display = [before, span, after.replace(/[:,;]$/, "") + "\u2026"]
    .filter((part) => part !== "")
    .join(" ");
  const shown: string[] = [
    display,
    json.choices[0],
    json.choices[1],
    PATIENT.heading,
    ...PATIENT.paragraphs,
  ];
  if (shown.some((s) => /[\u2013\u2014]/.test(s))) {
    throw new Error("opening.json: on-screen text contains a dash character");
  }
  return {
    caseId: json.caseId,
    patient: PATIENT,
    choices: json.choices,
    tags: json.tags,
    response: { text: display, recommendationSpan: span, chosen: toIndex(runChoice) },
    decisions: json.models.gpt.decisions.map(toIndex),
  };
}

export const openingCase: OpeningCase = build(raw);

/** Labels on the option cards; they match the "Choice 1" wording in the response. */
export const CHOICE_LABELS = ["Choice 1", "Choice 2"] as const;
