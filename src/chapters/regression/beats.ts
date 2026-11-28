import { FADE_MS } from "../../design/motion";
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
  { name: "expand", startMs: 6500 }, // one row opens
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

/** Profile headline, shared by the detail chapter and autoplay. */
export const PROFILE_HEADLINE = "A value profile, inferred from decisions.";

/** Chapter headlines, verbatim. Each takes over at the named beat. */
export const headlines: Partial<Record<RegressionBeat, string>> = {
  rows: "Decisions and trade-offs become data.",
  weights: "Which value weights explain these choices?",
  fit: PROFILE_HEADLINE,
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
const SWAP_MS = FADE_MS;

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

/* -------------------------------------------------------------------------- */
/*  Autoplay bridge                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Autoplay bridge between the stack table and the bars-to-ring morph:
 * "decisions and trade-offs in, four numbers out". The four numbers are one
 * more row of the table, a bar under each value column. No equation, no weights.
 */
export const COMPRESS_CAPTION = "Which priorities best explain these choices?";

/** Plain-language line under the priorities row. `cases` is how many cases the table summarises. */
export const PRIORITIES_CAPTION = (cases: number) => `One set of priorities best explains all ${cases} cases.`;

/**
 * Timings local to this transition. `design/motion.ts` is deliberately very
 * short (a cut, for UI changes), so the grow and the travel need their own.
 * TODO: tune after visual review
 */
export const COMPRESS_TIMING = {
  /** The table holds with the question; the four headers get a soft emphasis. */
  captionHoldMs: 2500,
  /** The headers ease to full emphasis over this long, from the start of the hold. */
  emphasisMs: 700,
  /** The rows dim, the case count and question fade, the summary row's label arrives. */
  ghostMs: 500,
  /** A bar grows under each value column. */
  growMs: 800,
  /** Table above, one priority bar under each of its columns, on one page. */
  togetherMs: 1800,
  /** The table fades while the bars and the header words flow into the bar list. */
  travelMs: 900,
} as const;

/** How faint the rows, their decision bars and the ellipsis get while the headers stay at full strength. */
export const GHOST_LEVEL = 0.4;
/** Share of the grow after which the percent numbers fade in, once the bars have settled. */
export const NUMBERS_AT = 0.75;

/**
 * When true, the bars start at an equal 25% each and ease to their fitted
 * lengths during the grow. No percent numbers show until they have settled.
 * Off by default.
 */
export const TILT_FROM_EQUAL = false;

/** Kept for existing imports: how long the question holds. */
export const CAPTION_HOLD_MS = COMPRESS_TIMING.captionHoldMs;

const ghostAt = COMPRESS_TIMING.captionHoldMs;
const growAt = ghostAt + COMPRESS_TIMING.ghostMs;
const togetherAt = growAt + COMPRESS_TIMING.growMs;
const travelAt = togetherAt + COMPRESS_TIMING.togetherMs;
const compressEnd = travelAt + COMPRESS_TIMING.travelMs;

/**
 * Autoplay between the stack table and the bars-to-ring morph.
 *   caption   the table holds under one question; the four headers get emphasis
 *   ghost     the table steps back, headers stay at full strength
 *   grow      a bar grows under each value column; the profile headline takes over
 *   together  the table and its four priorities, on one page
 *   travel    the table fades; the bars and the header words flow into the bar list
 *   end       chapter end marker
 */
export const compressBeats = [
  { name: "caption", startMs: 0 },
  { name: "ghost", startMs: ghostAt },
  { name: "grow", startMs: growAt },
  { name: "together", startMs: togetherAt },
  { name: "travel", startMs: travelAt },
  { name: "end", startMs: compressEnd },
] as const satisfies readonly Beat[];
