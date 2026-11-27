import type { Beat } from "../../types";

/**
 * Beats are data. A chapter's length is the start of its last beat, and every
 * visual in the chapter is a pure function of chapter-local time, so seeking
 * and pausing always show a consistent frame.
 */
// TODO: tune after visual review
export const regressionBeats = [
  { name: "rows", startMs: 0 }, // placeholder case rows appear
  { name: "weights", startMs: 2000 }, // four shared weight bars rise
  { name: "links", startMs: 4500 }, // each weight connects to every row
  { name: "expand", startMs: 6500 }, // one row opens
  { name: "tradeoffs", startMs: 7800 }, // its case trade-offs are highlighted
  { name: "weighted", startMs: 10000 }, // × shared value weights
  { name: "predicted", startMs: 12500 }, // = predicted choice probability
  { name: "observed", startMs: 15000 }, // beside the observed frequency
  { name: "equation", startMs: 18500 }, // the equation appears
  { name: "fit", startMs: 23500 }, // table gives way to the four fitted weights
  { name: "exponentiate", startMs: 28500 }, // softmax step 1: exp(w / τ)
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
export const easeInOut = (p: number): number => {
  const x = clamp01(p);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

/** Eased `segment`, the usual choice for motion. */
export const motionAt = (elapsedMs: number, name: RegressionBeat, maxMs?: number): number =>
  easeOut(segment(elapsedMs, name, maxMs));

/** Narration shown above the card: the latest beat reached that has a caption. */
export const captions: Partial<Record<RegressionBeat, string>> = {
  rows: "Each row is one case: how its two options trade off the four values.",
  weights: "Four weights, one per value. The same four for every case.",
  expand: "Take one case.",
  weighted: "Its trade-offs, scaled by the shared weights, set how likely Option 1 is.",
  observed: "Compare that prediction with how often physicians actually chose Option 1.",
  equation: "That is the whole model, applied to every case.",
  fit: "Fit the weights so predictions track what was observed, across all cases at once.",
  exponentiate: "Weights can be negative. Exponentiating makes every value positive.",
  normalize: "Divide by the total so the four values share 100%.",
  priorities: "Four nonnegative priorities that sum to 1.",
};

export function captionAt(elapsedMs: number): string {
  let text = "";
  for (const beat of regressionBeats) {
    if (beat.startMs > elapsedMs) break;
    const c = captions[beat.name];
    if (c) text = c;
  }
  return text;
}
