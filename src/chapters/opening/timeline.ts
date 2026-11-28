import { beatStart, type Beat } from "../../types";
import { FADE_MS, MOVE_MS, VALUE_ORDER } from "../../design";
import type { Value } from "../../study/types";
import { openingCase } from "./openingCase";
import { openingRows } from "./openingRows";
import { triggerWords } from "./valueTriggers";

/**
 * Beats for the four opening chapters (data, ms from each chapter's start).
 * All timings are PROVISIONAL (TODO: tune after visual review).
 *
 * The scene is a pure function of one "opening time" T = chapter offset +
 * chapter-local elapsed, so pausing and seeking just work. Each chapter's
 * fade-outs finish exactly at the next chapter's start, so a seek to a
 * chapter start never shows stale content from the previous one.
 */

/**
 * How fast the opening case types, in characters per second.
 * Fast enough to read as typing, slow enough that phrases form as they land.
 */
const CASE_TYPE_CPS = 68;
/** Settled case on screen after the last character, before the chapter ends. */
const CASE_HOLD_MS = 3200;

/** Logo and title open together, hold, then the logo fades as the case starts. */
const LOGO_IN_MS = 560;
const LOGO_HOLD_MS = 1400;
const LOGO_FADE_MS = 700;
const caseAt = LOGO_IN_MS + LOGO_HOLD_MS;

const patientAt = caseAt;
const typedAt = patientAt + Math.ceil((openingCase.vignette.length / CASE_TYPE_CPS) * 1000);

const hook = [
  { name: "logo", startMs: 0 }, // NeurIPS mark and the paper title open together
  { name: "logoHold", startMs: LOGO_IN_MS },
  { name: "headline", startMs: 0 },
  { name: "logoRise", startMs: caseAt }, // logo fades as the case begins
  { name: "patient", startMs: patientAt },
  { name: "logoGone", startMs: caseAt + LOGO_FADE_MS },
  { name: "typed", startMs: typedAt }, // last character has landed
  { name: "end", startMs: typedAt + CASE_HOLD_MS },
] as const satisfies readonly Beat[];

/** Choices land, then a short still beat so the viewer can pick before the model answers. */
const OPTIONS_AT = 600;
const DECIDE_HOLD_MS = 2000;
const dilemma = [
  { name: "question", startMs: 0 }, // "What would you recommend?"
  { name: "options", startMs: OPTIONS_AT }, // two equal option cards
  { name: "hold", startMs: OPTIONS_AT + 500 }, // nothing moves: the viewer decides, no model answer yet
  { name: "end", startMs: OPTIONS_AT + DECIDE_HOLD_MS },
] as const satisfies readonly Beat[];

/** Two full turns of the provider mark, with "thinking…" in the panel. */
const SPIN_MS = 1600;
/** How fast the answer types, once the icon has stopped. */
const TYPE_MS_PER_CHAR = 16;
const THINK_AT = 500;
const REVEAL_AT = THINK_AT + SPIN_MS;
const REVEALED_AT = REVEAL_AT + openingCase.response.text.length * TYPE_MS_PER_CHAR;
const HIGHLIGHT_AT = REVEALED_AT + 1000;
const EXTRACT_AT = HIGHLIGHT_AT + 1000;
const EXTRACTED_AT = EXTRACT_AT + 1000;
/** The answer text shrinks away and the first dot lands next to the mark. */
export const COLLAPSE_MS = 300;
const COLLAPSE_AT = EXTRACTED_AT;
const FIRST_DOT_AT = COLLAPSE_AT + COLLAPSE_MS;
/**
 * Choice each repeated query shows, in run order. 0 = choice 1, 1 = choice 2.
 * Straight from the recorded runs (opening.json), so GPT's dots match its row
 * in the model rows and decisions.json.
 */
const SHOWN_CHOICES: readonly (0 | 1)[] = openingCase.decisions;
const shownChoice1 = SHOWN_CHOICES.filter((c) => c === 0).length;
if (SHOWN_CHOICES.length !== openingRows.models[0].trials || shownChoice1 !== openingRows.models[0].choice1) {
  throw new Error("timeline: GPT's recorded queries and decisions.json disagree");
}
/** Each repeat query: the mark turns once, then its dot lands. */
const RUN_COUNT = SHOWN_CHOICES.length;
const RERUNS_AT = FIRST_DOT_AT + 500;
/** The second decision takes its time; decisions 3 to 10 run much faster. */
const SLOW_RERUN = { spinMs: 450, gapMs: 120 } as const;
const FAST_RERUN = { spinMs: 200, gapMs: 40 } as const;

/** Turn windows of the mark for decisions 2 to N (index 0 is decision 2), in chapter-local ms. */
const RERUNS: readonly { startMs: number; endMs: number }[] = (() => {
  const out: { startMs: number; endMs: number }[] = [];
  let at = RERUNS_AT;
  for (let i = 0; i < RUN_COUNT - 1; i++) {
    const { spinMs, gapMs } = i === 0 ? SLOW_RERUN : FAST_RERUN;
    out.push({ startMs: at, endMs: at + spinMs });
    at += spinMs + gapMs;
  }
  return out;
})();
const RERUNS_DONE_AT = RERUNS.length > 0 ? RERUNS[RERUNS.length - 1].endMs + FAST_RERUN.gapMs : RERUNS_AT;

/** Turns of the provider mark before the first answer types: two full turns. */
const FIRST_SPIN_DEG = 720;

/**
 * One dot per repeated query, in chapter-local ms. Choice 1 dots sit with the
 * mark; the choice 2 dot sits on the other side. The first lands as the answer
 * collapses. Each later one lands as a turn of the mark ends.
 */
export const RUN_DOTS: readonly { startMs: number; choice: 0 | 1 }[] = SHOWN_CHOICES.map((choice, i) => ({
  startMs: i === 0 ? FIRST_DOT_AT - MOVE_MS : RERUNS[i - 1].endMs,
  choice,
}));

/** Rotation of the provider mark in degrees at chapter-local time `e`. Cumulative, so every turn ends upright. */
export function markSpinDeg(e: number): number {
  let deg = ramp(e, THINK_AT, REVEAL_AT) * FIRST_SPIN_DEG;
  for (const turn of RERUNS) {
    const p = ramp(e, turn.startMs, turn.endMs);
    deg += p * p * (3 - 2 * p) * 360;
  }
  return deg;
}

/**
 * The question leaves and the response arrives as one motion, from the model
 * chapter's start. The words fade in place first, so they are not clipped,
 * and the slot closes after they are gone. The response fades in across the same span.
 */
export const MODEL_HANDOFF_MS = 780;

const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - ((-2 * x + 2) ** 3) / 2);

/**
 * Chapter-local handoff at the start of the model chapter.
 * Fade the question, bring the response in with it, then close the empty slot.
 */
export function modelHandoff(elapsedMs: number): {
  questionFade: number;
  questionCollapse: number;
  responseEnter: number;
} {
  const rise = ramp(elapsedMs, 0, MODEL_HANDOFF_MS);
  return {
    questionFade: easeInOut(Math.min(1, rise / 0.5)),
    questionCollapse: easeInOut(Math.min(1, Math.max(0, (rise - 0.46) / 0.54))),
    responseEnter: easeInOut(Math.min(1, rise / 0.72)),
  };
}

/**
 * After the repeat queries the case tucks away, the other eleven models arrive
 * as dot rows under GPT's, then the physicians arrive as one row of squares.
 * These are local to this feature: design/motion.ts is deliberately too short
 * for them. Chapter-local ms. TODO: tune after visual review (every value here).
 */
/** Rest after the last dot before the case tucks. TODO: tune after visual review */
export const TUCK_DELAY_MS = 500;
/** The case card shrinks to its one-line header. TODO: tune after visual review */
export const TUCK_MS = 450;
/** Gap between one model row arriving and the next. TODO: tune after visual review */
export const MODEL_ROW_STAGGER_MS = 120;
/** One model row fading and settling in. TODO: tune after visual review */
export const MODEL_ROW_IN_MS = 240;
/** All twelve rows on screen, held for reading. TODO: tune after visual review */
export const MODELS_HOLD_MS = 2500;
/** Gap between one physician square arriving and the next. TODO: tune after visual review */
export const PHYSICIAN_STAGGER_MS = 40;
/** One physician square fading in; also the MD badge and the separator. TODO: tune after visual review */
export const PHYSICIAN_IN_MS = 160;
/** The full picture held before the framework chapter. TODO: tune after visual review */
export const FULL_PICTURE_HOLD_MS = 3500;

/** GPT's row is already there, so only the rest arrive. */
const ARRIVING_ROWS = openingRows.models.length - 1;
const PHYSICIAN_COUNT = openingRows.physicians.total;

const TUCK_AT = RERUNS_DONE_AT + TUCK_DELAY_MS;
const MODELS_AT = TUCK_AT + TUCK_MS;
const MODELS_HOLD_AT = MODELS_AT + (ARRIVING_ROWS - 1) * MODEL_ROW_STAGGER_MS + MODEL_ROW_IN_MS;
const PHYSICIANS_AT = MODELS_HOLD_AT + MODELS_HOLD_MS;
const FULL_AT = PHYSICIANS_AT + (PHYSICIAN_COUNT - 1) * PHYSICIAN_STAGGER_MS + PHYSICIAN_IN_MS;

const model = [
  { name: "ask", startMs: 0 }, // "What would you recommend?" starts leaving; the response eases in with it
  { name: "think", startMs: THINK_AT }, // mark spins; the panel is arriving with it
  { name: "reveal", startMs: REVEAL_AT }, // answer starts typing
  { name: "revealed", startMs: REVEALED_AT }, // last character is on screen
  { name: "highlight", startMs: HIGHLIGHT_AT }, // recommendation sentence sweeps
  { name: "extract", startMs: EXTRACT_AT }, // its choice is outlined
  { name: "extracted", startMs: EXTRACTED_AT },
  { name: "collapse", startMs: COLLAPSE_AT }, // answer shrinks away, first dot lands
  { name: "reruns", startMs: RERUNS_AT }, // the mark turns again for each repeat query
  { name: "rerunsDone", startMs: RERUNS_DONE_AT },
  { name: "tuck", startMs: TUCK_AT }, // the case collapses to its one-line header; room opens for the rows
  { name: "models", startMs: MODELS_AT }, // the other models arrive, one row at a time
  { name: "modelsHold", startMs: MODELS_HOLD_AT }, // all twelve rows visible, held for reading
  { name: "physicians", startMs: PHYSICIANS_AT }, // the physician row arrives, one square at a time
  { name: "hold", startMs: FULL_AT }, // the full picture, held
  { name: "end", startMs: FULL_AT + FULL_PICTURE_HOLD_MS },
] as const satisfies readonly Beat[];

const round100 = (ms: number): number => Math.round(ms / 100) * 100;

/*
 * The framework chapter walks the four values one at a time. Its first beat is
 * the reset: the model answer leaves and the plain vignette arrives with the
 * headline. Inside each value's window:
 *   <v>           its full name and definition appear; the vignette is plain
 *   <v>Highlight  the tint starts across its trigger sentence; the rest dims
 *   <v>Chip1      its label lands under Choice 1
 *   <v>Chip2      its label lands under Choice 2
 * The tint travels one word at a time for the per-word allowance, then holds.
 * It stays when the next value begins. The next value begins once the second
 * label has landed: its name replaces the previous name, and its own tint is
 * added. Labels already added stay under the choices.
 */
const NAME_MS = 1500; // name and definition on a plain vignette
const HIGHLIGHT_BASE_MS = 900; // still hold of the fully tinted sentence, before the first label
const HIGHLIGHT_PER_WORD_MS = 180; // the tint crosses one word in this long
const CHIP_GAP_MS = 700; // Choice 1 label, then Choice 2 label

/** How long the tint takes to travel across a value's trigger sentence. */
export function highlightSweepMs(v: Value): number {
  return HIGHLIGHT_PER_WORD_MS * triggerWords(v);
}

const framework = (() => {
  const beats: Beat[] = [{ name: "framework", startMs: 0 }]; // "Clinical decisions require ..."
  let cursor = 1200;
  for (const v of VALUE_ORDER) {
    const highlight = cursor + NAME_MS;
    const chip1 = highlight + round100(HIGHLIGHT_BASE_MS + HIGHLIGHT_PER_WORD_MS * triggerWords(v));
    const chip2 = chip1 + CHIP_GAP_MS;
    beats.push(
      { name: v, startMs: cursor },
      { name: `${v}Highlight`, startMs: highlight },
      { name: `${v}Chip1`, startMs: chip1 },
      { name: `${v}Chip2`, startMs: chip2 },
    );
    cursor = chip2 + FADE_MS;
  }
  beats.push({ name: "all", startMs: cursor }); // names cleared; four tints remain, four labels on each choice
  beats.push({ name: "end", startMs: cursor + 5000 });
  return beats as readonly Beat[];
})();

export const OPENING_BEATS = { hook, dilemma, model, framework } as const;
export type OpeningChapterKey = keyof typeof OPENING_BEATS;

const ORDER: readonly OpeningChapterKey[] = ["hook", "dilemma", "model", "framework"];

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

/** How many characters of the case are visible at opening time `t`. */
export function caseCharsAt(t: number): number {
  const start = at("hook", "patient");
  const end = at("hook", "typed");
  const n = openingCase.vignette.length;
  if (t >= end) return n;
  if (t <= start || end <= start) return 0;
  return Math.min(n, Math.ceil(((t - start) / (end - start)) * n));
}

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

/**
 * Model rows 2 to 12 (index 0 is the first arriving row, GPT's is already
 * there). 0 before it arrives, 1 once it has settled. Opening time `t`.
 */
export function modelRowEnter(t: number, index: number): number {
  const start = at("model", "models") + index * MODEL_ROW_STAGGER_MS;
  return ramp(t, start, start + MODEL_ROW_IN_MS);
}

/** Physician square `index` (left side first, then right), 0..1. Opening time `t`. */
export function physicianEnter(t: number, index: number): number {
  const start = at("model", "physicians") + index * PHYSICIAN_STAGGER_MS;
  return ramp(t, start, start + PHYSICIAN_IN_MS);
}

/** The MD badge, the hairline and the caption arrive together at the physicians beat. */
export function physicianRowEnter(t: number): number {
  const start = at("model", "physicians");
  return ramp(t, start, start + PHYSICIAN_IN_MS);
}
