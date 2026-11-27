/**
 * The opening case, read from src/study/data/opening.json (the Figure 1
 * psychiatric-hold case, 0b5a2bcb). Everything the opening chapters show about
 * the case is that file's vignette and choices, verbatim.
 *
 * Model labels: only the display name ("OpenAI") ever reaches the screen. The
 * `source` version string in opening.json is never read.
 */
import openingJson from "../../study/data/opening.json";
import type { Tag, Value } from "../../study/types";

/** The fields of opening.json this chapter reads. */
interface OpeningJson {
  caseId: string;
  /** Full case text. */
  vignette: string;
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
  /** The full vignette, verbatim from opening.json. */
  vignette: string;
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
 * Display form of model text: markdown markers removed and line breaks folded
 * to spaces. Words are never altered; `build` throws if a dash is left on screen.
 */
const plain = (s: string): string =>
  s
    .replace(/^#+\s*/gm, "")
    .replace(/\*+/g, "")
    .replace(/\s*\n+\s*/g, " ")
    .trim();

function toIndex(n: number): 0 | 1 {
  if (n !== 1 && n !== 2) throw new Error(`opening.json: bad choice ${n}`);
  return n === 1 ? 0 : 1;
}

function build(json: OpeningJson): OpeningCase {
  const { text: fullText, recommendation, runChoice } = json.models.gpt.excerpt;
  // The real text has an em dash inside the marked recommendation ("Choice 1 \u2014
  // Place him ..."). The quote is not altered: the excerpt starts after the
  // dash, and the marked offsets move with it, so the recommendation is still
  // the verbatim words that follow the dash.
  const dash = fullText.indexOf("\u2014");
  if (dash !== -1 && (dash < recommendation.start || dash >= recommendation.end)) {
    throw new Error("opening.json: the em dash is outside the marked recommendation");
  }
  const skip = dash === -1 ? 0 : fullText.slice(dash + 1).match(/^\s*/)![0].length + dash + 1;
  const text = fullText.slice(skip);
  const markStart = Math.max(recommendation.start, skip) - skip;
  const markEnd = recommendation.end - skip;
  // Cut by the marked offsets first, so the recommendation sentence is exactly
  // the one the data marks, then clean each piece for display.
  const before = plain(text.slice(0, markStart));
  const span = plain(text.slice(markStart, markEnd));
  const after = plain(text.slice(markEnd));
  // The excerpt is cut mid-sentence in the source; show the cut as an ellipsis.
  const display = [before, span, after.replace(/[:,;]$/, "") + "\u2026"]
    .filter((part) => part !== "")
    .join(" ");
  const shown: string[] = [display, json.vignette, json.choices[0], json.choices[1]];
  if (shown.some((s) => /[\u2013\u2014]/.test(s))) {
    throw new Error("opening.json: on-screen text contains a dash character");
  }
  return {
    caseId: json.caseId,
    vignette: json.vignette,
    choices: json.choices,
    tags: json.tags,
    response: { text: display, recommendationSpan: span, chosen: toIndex(runChoice) },
    decisions: json.models.gpt.decisions.map(toIndex),
  };
}

export const openingCase: OpeningCase = build(raw);
