import { OPENING_BEATS, OFFSETS as OPENING_OFFSETS, type OpeningChapterKey } from "../chapters/opening/timeline";
import { stackBeats } from "../chapters/stack/beats";
import { compressBeats, PROFILE_HEADLINE } from "../chapters/regression/beats";
import { closingBeats, individualBeats } from "../chapters/ending";
import { FADE_MS } from "../design/motion";
import { beatStart, chapterDuration, type Beat } from "../types";
import { morphBeats } from "./morphBeats";

/** Chapter ids, in play order: opening (4), stack, regression bridge, morph, ending (2). */
export const SEGMENTS = [
  "opening-hook",
  "opening-dilemma",
  "opening-model",
  "opening-framework",
  "stack",
  "regression",
  "morph",
  "individual-models",
  "models-and-physicians",
] as const;
export type SegmentId = (typeof SEGMENTS)[number];

export const OPENING_KEY: Partial<Record<SegmentId, OpeningChapterKey>> = {
  "opening-hook": "hook",
  "opening-dilemma": "dilemma",
  "opening-model": "model",
  "opening-framework": "framework",
};

export const SEGMENT_BEATS: Record<SegmentId, readonly Beat[]> = {
  "opening-hook": OPENING_BEATS.hook,
  "opening-dilemma": OPENING_BEATS.dilemma,
  "opening-model": OPENING_BEATS.model,
  "opening-framework": OPENING_BEATS.framework,
  stack: stackBeats,
  regression: compressBeats,
  morph: morphBeats,
  "individual-models": individualBeats,
  "models-and-physicians": closingBeats,
};

/** Start of each chapter on the whole-demo clock. */
export const SEGMENT_OFFSET: Record<SegmentId, number> = (() => {
  let at = 0;
  const out = {} as Record<SegmentId, number>;
  for (const id of SEGMENTS) {
    out[id] = at;
    at += chapterDuration({ beats: SEGMENT_BEATS[id] });
  }
  return out;
})();

export const isOpening = (id: SegmentId) => id in OPENING_KEY;
export const openingTime = (id: SegmentId, elapsedMs: number) => OPENING_OFFSETS[OPENING_KEY[id]!] + elapsedMs;

/** End of the four opening chapters on the shared opening clock: sum of their durations. */
export const OPENING_END_MS =
  OPENING_OFFSETS.framework + chapterDuration({ beats: OPENING_BEATS.framework });

/* -------------------------------------------------------------------------- */
/*  Headlines from the stack on (the opening draws its own, in the scene)     */
/* -------------------------------------------------------------------------- */

/** Verbatim. */
export const STACK_HEADLINES = {
  start: "Do language models prioritize certain values?",
  markers: "Observe decisions across cases.",
  flip: "Each case has annotated value trade-offs.",
} as const;
export const INDIVIDUAL_HEADLINE = "Different models. Different priorities.";

export interface HeadlineEntry {
  at: number;
  text: string;
}

const stackAt = (name: string) => SEGMENT_OFFSET.stack + beatStart(stackBeats, name);

/** Whole-demo times at which the headline changes. "" clears it (the closing question takes over). */
export const HEADLINE_ENTRIES: readonly HeadlineEntry[] = [
  { at: stackAt("card"), text: STACK_HEADLINES.start },
  { at: stackAt("markers"), text: STACK_HEADLINES.markers },
  { at: stackAt("flip"), text: STACK_HEADLINES.flip },
  { at: SEGMENT_OFFSET.regression + beatStart(compressBeats, "profile"), text: PROFILE_HEADLINE },
  { at: SEGMENT_OFFSET["individual-models"], text: INDIVIDUAL_HEADLINE },
  { at: SEGMENT_OFFSET["models-and-physicians"] + beatStart(closingBeats, "question"), text: "" },
];

const HEADLINE_SWAP_MS = FADE_MS;

export interface HeadlineState {
  current: string;
  previous: string;
  /** 0 = only `previous`, 1 = only `current`. */
  mix: number;
}

/** The headline in force at whole-demo time `t`, cross-fading from the one before it. */
export function headlineAt(t: number): HeadlineState {
  let i = -1;
  HEADLINE_ENTRIES.forEach((e, k) => {
    if (t >= e.at) i = k;
  });
  if (i < 0) return { current: "", previous: "", mix: 1 };
  const cur = HEADLINE_ENTRIES[i];
  return {
    current: cur.text,
    previous: HEADLINE_ENTRIES[i - 1]?.text ?? "",
    mix: Math.min(1, Math.max(0, (t - cur.at) / HEADLINE_SWAP_MS)),
  };
}
