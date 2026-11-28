import { beatStart, type Beat } from "../../types";
import { VALUE_ORDER } from "../../design";
import type { Value } from "../../study/types";
import { openingCase } from "./openingCase";
import { openingRows } from "./openingRows";
import { triggerWords } from "./valueTriggers";
import { PHYSICIAN_VOTE_COUNT } from "./DoctorSplit";

/**
 * Beats for the four opening chapters (data, ms from each chapter's start).
 * All timings are PROVISIONAL (TODO: tune after visual review).
 *
 * The scene is a pure function of one "opening time" T = chapter offset +
 * chapter-local elapsed, so pausing and seeking just work. Each chapter's
 * fade-outs finish exactly at the next chapter's start, so a seek to a
 * chapter start never shows stale content from the previous one.
 */

/** Settled case on screen after the last character, before the chapter ends. */
const CASE_HOLD_MS = 800;

/**
 * How long after one character begins the next one begins, in ms.
 * Shorter than the ink fade, so several letters are always easing in together
 * and the line never stops between words.
 */
const CASE_ADVANCE_MS = 18;
/** How long a character takes to ease from nothing to full ink. */
export const CASE_INK_MS = 64;

/** The mark that closed the clause before character `i`, skipping the space and a closing quote. */
function clauseEnd(text: string, i: number): string {
  let j = i - 1;
  while (j >= 0 && (text[j] === " " || text[j] === "\n" || "”\"')".includes(text[j] ?? ""))) j--;
  return j >= 0 ? (text[j] ?? "") : "";
}

/**
 * Ms from the previous character's start until this one starts.
 * Words run together. A comma and a period only slow the same stream,
 * by less than the fade, so the ink never drops out.
 */
function advanceBefore(text: string, i: number): number {
  if (i === 0) return 0;
  const prev = text[i - 1] ?? "";
  const ch = text[i] ?? "";
  if (ch !== " " && ch !== "\n" && (prev === " " || prev === "\n")) {
    const ended = clauseEnd(text, i);
    if (".!?".includes(ended)) return CASE_ADVANCE_MS + 36;
    if (",;:".includes(ended)) return CASE_ADVANCE_MS + 16;
  }
  return CASE_ADVANCE_MS;
}

/** Ms from the start of typing when each character begins to appear. */
const CASE_INK_AT: readonly number[] = (() => {
  const text = openingCase.vignette;
  const atMs: number[] = [];
  let acc = 0;
  for (let i = 0; i < text.length; i++) {
    acc += advanceBefore(text, i);
    atMs.push(acc);
  }
  return atMs;
})();

const CASE_TYPE_MS = (CASE_INK_AT[CASE_INK_AT.length - 1] ?? 0) + CASE_INK_MS;

/** Logo and title open together, hold, then both fade out completely before the case types. */
const LOGO_IN_MS = 560;
const LOGO_HOLD_MS = 1400;
const LOGO_FADE_MS = 700;
const caseAt = LOGO_IN_MS + LOGO_HOLD_MS;
const logoGoneAt = caseAt + LOGO_FADE_MS;

/** The case types on a full-scene card once the lockup is completely gone. */
const patientAt = logoGoneAt;
const typedAt = patientAt + CASE_TYPE_MS;

const hook = [
  { name: "logo", startMs: 0 }, // NeurIPS mark and the paper title open together
  { name: "logoHold", startMs: LOGO_IN_MS },
  { name: "headline", startMs: 0 },
  { name: "logoRise", startMs: caseAt }, // logo and title start fading out together
  { name: "logoGone", startMs: logoGoneAt }, // nothing but the black canvas
  { name: "patient", startMs: patientAt }, // full-scene case card starts typing
  { name: "typed", startMs: typedAt }, // last character has landed
  { name: "end", startMs: typedAt + CASE_HOLD_MS },
] as const satisfies readonly Beat[];

/** Choices land, then a short still beat so the viewer can pick before the model answers. */
const OPTIONS_AT = 600;
/** The full-scene case card shrinks to its place while the question fades in. Ends before the options. */
export const CASE_SHRINK_MS = 500;
/** The choices finish landing, then a short still hold before the physician icons. */
const OPTIONS_LANDED_MS = 680;
const HEADING_HOLD_MS = 400;
const HEADING_AT = OPTIONS_AT + OPTIONS_LANDED_MS + HEADING_HOLD_MS;
/** Still hold with the heading up, before the physician icons. */
export const HEADING_SWAP_MS = 500;
/** Physician icons arrive one at a time, in a fixed interleaved order. */
const VOTES_AT = HEADING_AT + HEADING_SWAP_MS;
export const VOTE_GAP_MS = 100;
/** One icon fading in. */
export const VOTE_IN_MS = 180;
const VOTES_DONE_AT = VOTES_AT + (PHYSICIAN_VOTE_COUNT - 1) * VOTE_GAP_MS + VOTE_IN_MS;
const VOTES_HOLD_MS = 1600;
/** Opening time at which physician icon number `i` (0-based, in vote order) starts to appear. */
export const voteStartMs = (i: number): number => at("dilemma", "votes") + i * VOTE_GAP_MS;
const dilemma = [
  { name: "question", startMs: 0 }, // "Doctors disagree on this decision"
  { name: "options", startMs: OPTIONS_AT }, // two equal option cards
  { name: "hold", startMs: OPTIONS_AT + 500 }, // nothing moves: the viewer decides, no model answer yet
  { name: "heading", startMs: HEADING_AT }, // heading holds before the physician icons
  { name: "votes", startMs: VOTES_AT }, // physician icons appear one at a time under each option
  { name: "voted", startMs: VOTES_DONE_AT }, // all 25 are in
  { name: "end", startMs: VOTES_DONE_AT + VOTES_HOLD_MS },
] as const satisfies readonly Beat[];

/** Two full turns of the provider mark, with "Thinking…" in the panel. */
const SPIN_MS = 1600;
/**
 * How long the answer takes to stream, once the icon has stopped.
 * Fast enough to read as a quick generation, still slow enough that the
 * words arrive rather than appear at once.
 */
const REVEAL_MS = Math.min(3200, Math.max(1400, openingCase.response.text.length * 3));
const THINK_AT = 500;
const REVEAL_AT = THINK_AT + SPIN_MS;
const REVEALED_AT = REVEAL_AT + REVEAL_MS;
const HIGHLIGHT_AT = REVEALED_AT + 1000;
/** Settle on the final suggestion, then mark it, before the choice is outlined. */
const EXTRACT_AT = HIGHLIGHT_AT + 1700;
const EXTRACTED_AT = EXTRACT_AT + 1000;
/**
 * The excerpted query's dot rises beside the mark, holds, and then the answer
 * shrinks away. The other nine arrive later, with the model rows.
 */
const FIRST_DOT_MS = 400;
const FIRST_DOT_HOLD_MS = 240;
const FIRST_DOT_AT = EXTRACTED_AT;
/** The answer fades in place, then its slot closes, once the first dot has landed. */
export const COLLAPSE_MS = 560;
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
  let deg = ramp(e, THINK_AT, REVEAL_AT) * FIRST_SPIN_DEG;
  for (const spin of REPEAT_SPINS) deg += ramp(e, spin.start, spin.end) * 360;
  return deg;
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
    responseEnter: easeInOut(Math.min(1, Math.max(0, (rise - 0.4) / 0.6))), // after the case has begun to tuck, so the scene never grows past the viewport
  };
}

/**
 * After the first dot lands and the answer collapses, GPT's other decisions arrive. These durations are local to this feature:
 * design/motion.ts is deliberately too short for them. Chapter-local ms.
 * TODO: tune after visual review (every value here).
 */
/** Rest after the answer collapses, before the spins start. TODO: tune after visual review */
export const SPINS_DELAY_MS = 500;
/** One dot fading in as its spin ends. TODO: tune after visual review */
export const MODEL_ROW_IN_MS = 160;
/** Each remaining query is one full turn of the mark. The first few are slower, the rest quick. TODO: tune after visual review */
const REPEAT_SLOW_SPINS = 3;
const REPEAT_SLOW_MS = 650;
const REPEAT_FAST_MS = 380;
const REPEAT_GAP_MS = 60;
/** GPT's ten decisions held for reading. TODO: tune after visual review */
export const DECISIONS_HOLD_MS = 2400;
/**
 * Physician icons fade, then the slot they held eases to the value labels.
 * The slot does not collapse, so the heading, the case and the choices stay
 * where the dilemma left them.
 */
export const VOTES_FADE_MS = 350;
export const VOTES_CLOSE_MS = 500;
/**
 * On a narrow screen the full case card settles into the focused vignette
 * over this span from the framework chapter's start. A wide screen shows the same text, so nothing moves.
 */
export const CASE_SETTLE_MS = 600;

const MODELS_AT = COLLAPSE_AT + COLLAPSE_MS + SPINS_DELAY_MS;

/** Chapter-local start and end of the spin behind query `n` (1 = the second query). */
const REPEAT_SPINS: readonly { start: number; end: number }[] = (() => {
  const out: { start: number; end: number }[] = [];
  let at = MODELS_AT;
  for (let n = 1; n < SHOWN_CHOICES.length; n++) {
    const dur = n <= REPEAT_SLOW_SPINS ? REPEAT_SLOW_MS : REPEAT_FAST_MS;
    out.push({ start: at, end: at + dur });
    at += dur + REPEAT_GAP_MS;
  }
  return out;
})();
const LAST_DOT_AT = REPEAT_SPINS[REPEAT_SPINS.length - 1].end + MODEL_ROW_IN_MS;

const model = [
  { name: "ask", startMs: 0 }, // "Doctors disagree on this decision" starts leaving; the response eases in with it
  { name: "think", startMs: THINK_AT }, // mark spins; the panel is arriving with it
  { name: "reveal", startMs: REVEAL_AT }, // answer starts typing
  { name: "revealed", startMs: REVEALED_AT }, // last character is on screen
  { name: "highlight", startMs: HIGHLIGHT_AT }, // recommendation sentence sweeps
  { name: "extract", startMs: EXTRACT_AT }, // its choice is outlined
  { name: "extracted", startMs: EXTRACTED_AT },
  { name: "firstDot", startMs: FIRST_DOT_AT }, // the excerpt's dot rises beside the mark
  { name: "collapse", startMs: COLLAPSE_AT }, // answer fades in place, then its slot closes; the first dot stays
  { name: "models", startMs: MODELS_AT }, // the mark spins once per remaining query; each spin ends in a dot
  { name: "end", startMs: LAST_DOT_AT + DECISIONS_HOLD_MS }, // hold the tucked case, the labels, and GPT's dots
] as const satisfies readonly Beat[];

const round100 = (ms: number): number => Math.round(ms / 100) * 100;

/*
 * The framework chapter walks the four values one at a time. It starts from the
 * dilemma's last frame with no reset: the heading changes, the physician icons
 * fade out, and the case and options stay where they are. Inside each value's window:
 *   <v>           its name and definition replace the heading; the vignette is plain
 *   <v>Highlight  the tint starts across its trigger sentence; the rest dims
 *   <v>Chip1      its label lands under Choice 1
 *   <v>Chip2      its label lands under Choice 2
 * The tint travels one word at a time for the per-word allowance, then holds.
 * It stays when the next value begins. The next value begins once the second
 * label has landed: its name replaces the previous name, and its own tint is
 * added. Labels already added stay under the choices.
 */
const NAME_MS = 1500; // name and definition in the heading, vignette still plain
/** The framework heading holds once the physician icons have left, so it can be read. */
const FRAMEWORK_HEADING_READ_MS = 1000;
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
  // The heading swaps while the physician icons leave. The settled heading then holds before the values.
  const beats: Beat[] = [{ name: "framework", startMs: 0 }];
  const settledAt = Math.max(HEADING_SWAP_MS, VOTES_FADE_MS + VOTES_CLOSE_MS);
  let cursor = settledAt + FRAMEWORK_HEADING_READ_MS;
  for (const v of VALUE_ORDER) {
    const highlight = cursor + NAME_MS;
    // A value with no span has no highlight beat and no still hold: its labels follow its name.
    const words = triggerWords(v);
    const chip1 = words > 0 ? highlight + round100(HIGHLIGHT_BASE_MS + HIGHLIGHT_PER_WORD_MS * words) : highlight;
    const chip2 = chip1 + CHIP_GAP_MS;
    beats.push(
      { name: v, startMs: cursor },
      ...(words > 0 ? [{ name: `${v}Highlight`, startMs: highlight }] : []),
      { name: `${v}Chip1`, startMs: chip1 },
      { name: `${v}Chip2`, startMs: chip2 },
    );
    cursor = chip2 + PILL_ENTER_MS;
  }
  beats.push({ name: "all", startMs: cursor }); // heading returns; four tints remain, four labels on each choice
  beats.push({ name: "end", startMs: cursor + 2500 }); // hold the tinted case and labels, then the model answers
  return beats as readonly Beat[];
})();

export const OPENING_BEATS = { hook, dilemma, framework, model } as const;
export type OpeningChapterKey = keyof typeof OPENING_BEATS;

const ORDER: readonly OpeningChapterKey[] = ["hook", "dilemma", "framework", "model"];

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

/** How many characters have begun to appear at opening time `t`. */
export function caseCharsAt(t: number): number {
  const start = at("hook", "patient");
  const n = CASE_INK_AT.length;
  if (n === 0 || t <= start) return 0;
  const elapsed = t - start;
  const last = CASE_INK_AT[n - 1] ?? 0;
  if (elapsed >= last) return n;
  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((CASE_INK_AT[mid] ?? 0) <= elapsed) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** 0..1 ink of character `index` at opening time `t`. Eases out, so it settles rather than popping. */
export function caseInkOpacity(t: number, index: number): number {
  const begin = CASE_INK_AT[index];
  if (begin === undefined) return 0;
  const x = (t - at("hook", "patient") - begin) / CASE_INK_MS;
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return 1 - (1 - x) ** 2;
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
 * The excerpted query's dot, 0..1. It rises beside the mark once the decision
 * is identified, and it is fully up before the answer fades. Chapter-local ms.
 */
export function firstDotEnter(elapsedMs: number): number {
  const start = beatStart(OPENING_BEATS.model, "firstDot");
  return easeInOut(ramp(elapsedMs, start, start + FIRST_DOT_MS));
}

/** Dot for query `index` (1 = the second), 0..1. It lands as that query's spin ends. Chapter-local ms. */
export function decisionDotEnter(elapsedMs: number, index: number): number {
  const spin = REPEAT_SPINS[index - 1];
  return spin ? ramp(elapsedMs, spin.end - MODEL_ROW_IN_MS, spin.end) : 1;
}

/**
 * Physician icons leaving, from the framework chapter's start. `fade` is their
 * opacity loss. `close` eases the slot they held to the value-label height.
 * Both 0..1. The column does not shrink.
 */
export function votesOut(t: number): { fade: number; close: number } {
  const start = at("framework", "framework");
  return {
    fade: easeInOut(ramp(t, start, start + VOTES_FADE_MS)),
    close: easeInOut(ramp(t, start + VOTES_FADE_MS, start + VOTES_FADE_MS + VOTES_CLOSE_MS)),
  };
}

/** 0 at the framework chapter's start, 1 once the focused vignette has replaced the full case card. */
export function caseSettle(t: number): number {
  const start = at("framework", "framework");
  return easeInOut(ramp(t, start, start + CASE_SETTLE_MS));
}

/** 0..1: how far physician icon number `i` (in vote order) has appeared at opening time `t`. */
export const voteEnter = (t: number, i: number): number => ramp(t, voteStartMs(i), voteStartMs(i) + VOTE_IN_MS);
