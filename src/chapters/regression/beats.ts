import type { Beat } from "../../types";

/**
 * Beats are data. A chapter's length is the start of its last beat, and every
 * visual in the chapter is a pure function of chapter-local time, so seeking
 * and pausing always show a consistent frame.
 */
// TODO: tune after visual review
export const regressionBeats = [
  { name: "rows", startMs: 0 }, // three case rows, an ellipsis, and "50 cases"
  { name: "weights", startMs: 2000 }, // four shared weight bars rise
  { name: "links", startMs: 4500 }, // each weight connects to every row
  { name: "expand", startMs: 6500 }, // the opening case opens
  { name: "tradeoffs", startMs: 7800 }, // its case trade-offs are highlighted
  { name: "weighted", startMs: 10000 }, // x shared value weights
  { name: "predicted", startMs: 12500 }, // = predicted choice probability
  { name: "observed", startMs: 15000 }, // beside the observed frequency
  { name: "equation", startMs: 18500 }, // the equation appears
  { name: "fit", startMs: 23500 }, // table gives way to the four fitted weights
  { name: "exponentiate", startMs: 28500 }, // softmax step 1: exp(w / tau)
  { name: "normalize", startMs: 33000 }, // softmax step 2: divide by the sum
  { name: "priorities", startMs: 37500 }, // four nonnegative priority bars
  { name: "end", startMs: 42500 }, // hold
] as const satisfies readonly Beat[];

export type RegressionBeat = (typeof regressionBeats)[number]["name"];

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);

/**
 * 0..1 progress through a beat: 0 before it starts, 1 once it has ended.
 * `maxMs` caps the ramp so a long beat can still finish its motion early and
 * then hold.
 */
export function segment(elapsedMs: number, name: RegressionBeat, maxMs = Infinity): number {
  const i = regressionBeats.findIndex((b) => b.name === name);
  const start = regressionBeats[i].startMs;
  const next = regressionBeats[i + 1]?.startMs ?? start;
  const span = Math.min(next - start, maxMs);
  if (span <= 0) return elapsedMs >= start ? 1 : 0;
  return clamp01((elapsedMs - start) / span);
}

export const easeOut = (p: number): number => 1 - Math.pow(1 - clamp01(p), 3);

/** Eased `segment`, the usual choice for motion. */
export const motionAt = (elapsedMs: number, name: RegressionBeat, maxMs?: number): number =>
  easeOut(segment(elapsedMs, name, maxMs));

/* -------------------------------------------------------------------------- */
/*  On-screen text                                                            */
/* -------------------------------------------------------------------------- */

/** Chapter headlines, verbatim. Each takes over at the named beat. */
export const headlines: Partial<Record<RegressionBeat, string>> = {
  rows: "Decisions and trade-offs become data.",
  weights: "Which value weights explain these choices?",
  fit: "A value profile, inferred from decisions.",
};

/** Per-beat captions, each 8 words or fewer. `model` is the profile's display name. */
export const captions = (model: string): Partial<Record<RegressionBeat, string>> => ({
  rows: "Each row is one case's trade-offs.",
  weights: "Four weights, shared by every case.",
  expand: "Take one case.",
  weighted: "Trade-offs times weights give a choice probability.",
  observed: `Compare with how often ${model} chose Option 1.`,
  equation: "That is the whole model.",
  fit: "Fit one set of weights to every case.",
  exponentiate: "Exponentiate: every value becomes positive.",
  normalize: "Divide by the total to share 100%.",
  priorities: "Four nonnegative priorities that sum to 1.",
});

/** How long text takes to cross-fade when a new line takes over. */
const SWAP_MS = 350;

export interface TextState {
  current: string;
  /** The line being replaced (empty when there was none). */
  previous: string;
  /** 0 = only `previous`, 1 = only `current`. */
  mix: number;
}

/** The line in force at `elapsedMs`, with a cross-fade from the line before it. */
export function textAt(
  table: Partial<Record<RegressionBeat, string>>,
  elapsedMs: number,
): TextState {
  let current = "";
  let previous = "";
  let since = 0;
  for (const beat of regressionBeats) {
    if (beat.startMs > elapsedMs) break;
    const text = table[beat.name];
    if (text !== undefined) {
      previous = current;
      current = text;
      since = beat.startMs;
    }
  }
  return { current, previous, mix: previous ? clamp01((elapsedMs - since) / SWAP_MS) : 1 };
}
