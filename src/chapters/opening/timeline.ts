import { beatStart, type Beat } from "../../types";
import { VALUE_ORDER } from "../../design";
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

/** Two full turns of the provider mark, with "Thinking…" in the panel. */
const SPIN_MS = 1600;
/** How fast the answer types, once the icon has stopped. */
const TYPE_MS_PER_CHAR = 16;
const THINK_AT = 500;
const REVEAL_AT = THINK_AT + SPIN_MS;
const REVEALED_AT = REVEAL_AT + openingCase.response.text.length * TYPE_MS_PER_CHAR;
const HIGHLIGHT_AT = REVEALED_AT + 1000;
const EXTRACT_AT = HIGHLIGHT_AT + 1000;
const EXTRACTED_AT = EXTRACT_AT + 1000;
/**
 * The excerpted query's dot rises beside the mark, holds, and then the answer
 * shrinks away. The other nine arrive later, with the model rows.
 */
const FIRST_DOT_MS = 400;
const FIRST_DOT_HOLD_MS = 240;
const FIRST_DOT_AT = EXTRACTED_AT;
/** The answer text shrinks away once the first dot has landed. */
export const COLLAPSE_MS = 300;
const COLLAPSE_AT = FIRST_DOT_AT + FIRST_DOT_MS + FIRST_DOT_HOLD_MS;
/**
 * Choice each recorded query made, in run order. 0 = choice 1, 1 = choice 2.
 * Straight from the recorded runs (opening.json), so GPT's row matches
 * decisions.json. The first dot is that first query; the rest arrive together.
 */
const SHOWN_CHOICES: readonly (0 | 1)[] = openingCase.decisions;
const shownChoice1 = SHOWN_CHOICES.filter((c) => c === 0).length;
if (SHOWN_CHOICES.length !== openingRows.models[0].trials || shownChoice1 !== openingRows.models[0].choice1) {
  throw new Error("timeline: GPT's recorded queries and decisions.json disagree");
}
const firstChoice = SHOWN_CHOICES[0];
if (firstChoice !== 0 && firstChoice !== 1) throw new Error("timeline: the opening has no recorded GPT query");
/** Side the excerpted query lands on. 0 = choice 1, beside the mark. */
export const FIRST_DOT_CHOICE: 0 | 1 = firstChoice;

/** Turns of the provider mark before the answer types: two full turns. */
const FIRST_SPIN_DEG = 720;

/** Rotation of the provider mark in degrees at chapter-local time `e`. The thinking turn ends upright. */
export function markSpinDeg(e: number): number {
  return ramp(e, THINK_AT, REVEAL_AT) * FIRST_SPIN_DEG;
}

/**
 * The question leaves and the response arrives as one motion, from the model
 * chapter's start. The words fade in place first, so they are not clipped,
 * and the slot closes after they are gone. The response fades in across the same span.
 */
export const MODEL_HANDOFF_MS = 780;

export const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - ((-2 * x + 2) ** 3) / 2);

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
 * After the first dot lands and the answer collapses, the case tucks away.
 * GPT's other decisions and the other eleven models arrive together as dot
 * rows, then the physicians arrive
 * as one row of squares. These durations are local to this feature:
 * design/motion.ts is deliberately too short for them. Chapter-local ms.
 * TODO: tune after visual review (every value here).
 */
/** Rest after the answer collapses, before the case tucks. TODO: tune after visual review */
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
/** The full picture held, then the rows gather into choice 1 / split / choice 2. TODO: tune after visual review */
export const FULL_PICTURE_HOLD_MS = 2400;
/** Icons leave their rows and settle into the three groups. TODO: tune after visual review */
export const GATHER_MS = 1100;
/** The three groups held under the choices, before the next slide. TODO: tune after visual review */
export const SUMMARY_HOLD_MS = 2000;
/**
 * The values slide arrives over this span: the vignette opens and the grouped
 * icons fade out. They do not stay on that slide.
 * TODO: tune after visual review
 */
export const STRIP_MS = 1000;

/** GPT's row is already there, so only the rest arrive. */
const ARRIVING_ROWS = openingRows.models.length - 1;
const PHYSICIAN_COUNT = openingRows.physicians.total;

const TUCK_AT = COLLAPSE_AT + COLLAPSE_MS + TUCK_DELAY_MS;
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
  { name: "firstDot", startMs: FIRST_DOT_AT }, // the excerpt's dot rises beside the mark
  { name: "collapse", startMs: COLLAPSE_AT }, // answer shrinks away; the first dot stays
  { name: "tuck", startMs: TUCK_AT }, // the case collapses to its one-line header; room opens for the rows
  { name: "models", startMs: MODELS_AT }, // GPT's decisions and the other models arrive together
  { name: "modelsHold", startMs: MODELS_HOLD_AT }, // all twelve rows visible, held for reading
  { name: "physicians", startMs: PHYSICIANS_AT }, // the physician row arrives, one square at a time
  { name: "hold", startMs: FULL_AT }, // the full picture, held
  { name: "summarize", startMs: FULL_AT + FULL_PICTURE_HOLD_MS }, // dots fold in; icons gather into the three groups
  { name: "summarized", startMs: FULL_AT + FULL_PICTURE_HOLD_MS + GATHER_MS },
  { name: "end", startMs: FULL_AT + FULL_PICTURE_HOLD_MS + GATHER_MS + SUMMARY_HOLD_MS },
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

/**
 * How a value's name and definition arrive and leave. Longer than a fade so
 * the handoff reads as motion. The next value still begins on this window.
 */
export const VALUE_ENTER_MS = 480;
/**
 * How a label under a choice opens. The row grows with this, and the pill
 * settles inside it. The next value waits until Choice 2 has finished.
 */
export const PILL_ENTER_MS = 460;

/** How long the tint takes to travel across a value's trigger sentence. */
export function highlightSweepMs(v: Value): number {
  return HIGHLIGHT_PER_WORD_MS * triggerWords(v);
}

const framework = (() => {
  const beats: Beat[] = [{ name: "framework", startMs: 0 }]; // "Clinical decisions require ..."
  let cursor = 1800; // the grouped models have left; hold the slide, then the values
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
    cursor = chip2 + PILL_ENTER_MS;
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
 * Model rows 2 to 12 (index 0 is the first arriving row, GPT's mark is already
 * there). 0 before it arrives, 1 once it has settled. Opening time `t`.
 */
export function modelRowEnter(t: number, index: number): number {
  const start = at("model", "models") + index * MODEL_ROW_STAGGER_MS;
  return ramp(t, start, start + MODEL_ROW_IN_MS);
}

/**
 * The excerpted query's dot, 0..1. It rises beside the mark once the decision
 * is identified, and it is fully up before the answer shrinks. Chapter-local ms.
 */
export function firstDotEnter(elapsedMs: number): number {
  const start = beatStart(OPENING_BEATS.model, "firstDot");
  return easeInOut(ramp(elapsedMs, start, start + FIRST_DOT_MS));
}

/**
 * GPT's remaining decision dots, 0..1. The first has already landed. These fade
 * in with the other model rows, once the case has tucked. Chapter-local ms.
 */
export function gptDecisionsEnter(elapsedMs: number): number {
  const start = beatStart(OPENING_BEATS.model, "models");
  return ramp(elapsedMs, start, start + MODEL_ROW_IN_MS);
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

/**
 * 0 while the rows are still the picture, 1 once the icons have gathered into
 * choice 1, the split, and choice 2. Opening time `t`.
 */
export function gatherProgress(t: number): number {
  const start = at("model", "summarize");
  return ramp(t, start, start + GATHER_MS);
}

/** 0 at the values slide's start, 1 once the grouped icons have faded out. */
export function stripProgress(t: number): number {
  const start = at("framework", "framework");
  return ramp(t, start, start + STRIP_MS);
}

/** The physician mark leaves with the clouds, a little ahead of the models. */
export function physicianSummaryOpacity(t: number): number {
  const start = at("framework", "framework");
  return 1 - ramp(t, start, start + STRIP_MS * 0.45);
}
