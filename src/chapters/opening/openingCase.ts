/**
 * The opening case, read from src/study/data/opening.json (the illustrative
 * anorexia case, 0b5a2bcb). Everything the opening chapters show about
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
    /** Display text of the excerpt. Markdown is removed; paragraph and list breaks stay. */
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
 * Display form of model text: markdown markers removed. Paragraph breaks and
 * list lines stay. Words are never altered; `build` throws if a dash is left
 * on screen.
 */
const plain = (s: string): string =>
  s
    .replace(/^#+\s*/gm, "")
    .replace(/\*+/g, "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n");

/** Join the pieces around the marked sentence without eating a line break. */
const joinParts = (parts: readonly string[]): string => {
  let out = "";
  for (const part of parts) {
    if (part === "") continue;
    if (out.length > 0 && !/\s$/.test(out) && !/^\s/.test(part)) out += " ";
    out += part;
  }
  return out.trim();
};

function toIndex(n: number): 0 | 1 {
  if (n !== 1 && n !== 2) throw new Error(`opening.json: bad choice ${n}`);
  return n === 1 ? 0 : 1;
}

function build(json: OpeningJson): OpeningCase {
  const { text: fullText, recommendation, runChoice } = json.models.gpt.excerpt;
  // An em dash inside the marked sentence is the one character the screen
  // never shows. The excerpt starts after it, and the offsets move with the
  // cut, so the sentence is still the words the data marked.
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
  const span = plain(text.slice(markStart, markEnd)).trim();
  const after = plain(text.slice(markEnd));
  // A cut excerpt (trailing colon or comma) keeps an ellipsis. A finished
  // sentence is shown as written.
  const tail = after.replace(/[:,;](?=\s*$)/, "");
  const finished = /[.!?]\s*$/.test(tail || span);
  const ending = finished ? tail : `${tail.replace(/\s*$/, "")}\u2026`;
  const display = joinParts([before, span, ending]);
  if (span.length === 0 || display.split(span).length !== 2) {
    throw new Error("opening.json: the recommendation sentence is not in the displayed response once");
  }
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
