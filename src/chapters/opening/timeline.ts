import { beatStart, type Beat } from "../../types";
import { openingCase } from "./openingCase";

/**
 * Beats for the five opening chapters (data, ms from each chapter's start).
 * All timings are PROVISIONAL (TODO: tune after visual review).
 *
 * The scene is a pure function of one "opening time" T = chapter offset +
 * chapter-local elapsed, so pausing and seeking just work. Each chapter's
 * fade-outs finish exactly at the next chapter's start, so a seek to a
 * chapter start never shows stale content from the previous one.
 */

/** Gap between repeat-query marks appearing. */
export const MARK_INTERVAL_MS = 450;

const hook = [
  { name: "label", startMs: 0 }, // small "NeurIPS 2026" label
  { name: "headline", startMs: 500 },
  { name: "patient", startMs: 3200 }, // patient card appears beneath
  { name: "end", startMs: 11000 },
] as const satisfies readonly Beat[];

const dilemma = [
  { name: "question", startMs: 0 }, // "What would you recommend?"
  { name: "options", startMs: 900 }, // two equal option cards
  { name: "hold", startMs: 2200 }, // nothing moves: the viewer decides, no model answer yet
  { name: "end", startMs: 11000 },
] as const satisfies readonly Beat[];

const model = [
  { name: "ask", startMs: 0 }, // headline: "Ask again."
  { name: "reveal", startMs: 1200 }, // response excerpt fades in by phrase group
  { name: "revealed", startMs: 3200 },
  { name: "highlight", startMs: 4200 }, // recommendation sentence sweeps
  { name: "extract", startMs: 5200 }, // its choice is outlined, OpenAI icon lands on it
  { name: "extracted", startMs: 6200 },
  { name: "marks", startMs: 7400 }, // repeat-query marks accumulate
  { name: "marksDone", startMs: 7400 + openingCase.decisions.length * MARK_INTERVAL_MS },
  { name: "end", startMs: 7400 + openingCase.decisions.length * MARK_INTERVAL_MS + 2600 },
] as const satisfies readonly Beat[];

const tradeoff = [
  { name: "statement", startMs: 0 }, // "Each choice prioritizes some values over others."
  { name: "choice1", startMs: 1500 }, // what choice 1 promotes / violates
  { name: "choice2", startMs: 3800 }, // what choice 2 promotes / violates
  { name: "end", startMs: 10500 },
] as const satisfies readonly Beat[];

const framework = [
  { name: "framework", startMs: 0 }, // the four principles
  { name: "A", startMs: 2000 },
  { name: "B", startMs: 3400 },
  { name: "N", startMs: 4800 },
  { name: "J", startMs: 6200 },
  { name: "all", startMs: 7600 }, // no emphasis: all four together
  { name: "end", startMs: 10000 },
] as const satisfies readonly Beat[];

export const OPENING_BEATS = { hook, dilemma, model, tradeoff, framework } as const;
export type OpeningChapterKey = keyof typeof OPENING_BEATS;

const ORDER: readonly OpeningChapterKey[] = ["hook", "dilemma", "model", "tradeoff", "framework"];

/** Start of each chapter on the shared opening clock. */
export const OFFSETS: Readonly<Record<OpeningChapterKey, number>> = (() => {
  let at = 0;
  const out = {} as Record<OpeningChapterKey, number>;
  for (const key of ORDER) {
    out[key] = at;
    at += OPENING_BEATS[key][OPENING_BEATS[key].length - 1].startMs;
  }
  return out;
})();

/** Absolute opening time of a named beat. Throws on unknown names. */
export const at = (chapter: OpeningChapterKey, beat: string): number =>
  OFFSETS[chapter] + beatStart(OPENING_BEATS[chapter], beat);

/** 0 before `start`, 1 after `end`, linear between. */
export const ramp = (t: number, start: number, end: number): number =>
  end <= start ? (t >= end ? 1 : 0) : Math.min(Math.max((t - start) / (end - start), 0), 1);

/** Visible 0..1: fades in over [inStart, inEnd], fades out over [outStart, outEnd]. */
export const visibility = (
  t: number,
  inStart: number,
  inEnd: number,
  outStart = Infinity,
  outEnd = Infinity,
): number => ramp(t, inStart, inEnd) * (1 - ramp(t, outStart, outEnd));
