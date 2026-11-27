import { beatStart, type Beat } from "../../types";
import { FADE_MS, STAGGER_MS, VALUE_ORDER } from "../../design";
import { openingCase } from "./openingCase";
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

/** Gap between repeat-query marks appearing. */
export const MARK_INTERVAL_MS = STAGGER_MS;

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

const dilemma = [
  { name: "question", startMs: 0 }, // "What would you recommend?"
  { name: "options", startMs: 900 }, // two equal option cards
  { name: "hold", startMs: 2200 }, // nothing moves: the viewer decides, no model answer yet
  { name: "end", startMs: 11000 },
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
const MARKS_AT = EXTRACTED_AT + 1200;

const model = [
  { name: "ask", startMs: 0 }, // "What would you recommend?" leaves; no headline yet
  { name: "think", startMs: THINK_AT }, // thinking panel; the question has already left
  { name: "reveal", startMs: REVEAL_AT }, // answer starts typing
  { name: "revealed", startMs: REVEALED_AT }, // last character is on screen
  { name: "highlight", startMs: HIGHLIGHT_AT }, // recommendation sentence sweeps
  { name: "extract", startMs: EXTRACT_AT }, // its choice is outlined, OpenAI icon lands on it
  { name: "extracted", startMs: EXTRACTED_AT },
  { name: "marks", startMs: MARKS_AT }, // repeat-query marks accumulate
  { name: "marksDone", startMs: MARKS_AT + openingCase.decisions.length * MARK_INTERVAL_MS },
  { name: "end", startMs: MARKS_AT + openingCase.decisions.length * MARK_INTERVAL_MS + 2600 },
] as const satisfies readonly Beat[];

const round100 = (ms: number): number => Math.round(ms / 100) * 100;

/*
 * The framework chapter walks the four values one at a time. Its first beat is
 * the reset: the model answer leaves and the plain vignette arrives with the
 * headline. Inside each value's window:
 *   <v>           its full name and definition appear; the vignette is plain
 *   <v>Highlight  its trigger sentence is highlighted, the rest dims
 *   <v>Chip1      its label lands on Choice 1
 *   <v>Chip2      its label lands on Choice 2
 * The next value begins once the second label has landed. That beat clears
 * the highlight and starts over. The labels already added stay on the choices.
 */
const NAME_MS = 1500; // name and definition on a plain vignette
const HIGHLIGHT_BASE_MS = 900; // plus a reading allowance per word of the trigger sentence
const HIGHLIGHT_PER_WORD_MS = 180;
const CHIP_GAP_MS = 700; // Choice 1 label, then Choice 2 label

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
  beats.push({ name: "all", startMs: cursor }); // highlight cleared, plain vignette, four labels on each choice
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
