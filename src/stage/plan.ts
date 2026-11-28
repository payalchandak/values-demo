import { casesBeats } from "../chapters/cases/beats";
import { OPENING_BEATS, OFFSETS as OPENING_OFFSETS, type OpeningChapterKey } from "../chapters/opening/timeline";
import { PROFILE_HEADLINE, VOTE_HEADLINE } from "../chapters/vote/beats";
import { closingBeats, individualBeats } from "../chapters/ending";
import { FADE_MS } from "../design/motion";
import { beatStart, chapterDuration, type Beat } from "../types";
import { MORPH_LEAD_MS, morphBeats } from "./morphBeats";

/**
 * Chapter ids, in play order: opening (4), cases (each one voting), then the
 * donut. The bars bend into that donut at the start of individual-models,
 * rather than as their own chapter. Reorder freely.
 */
export const SEGMENTS = [
  "opening-hook",
  "opening-dilemma",
  "opening-framework",
  "opening-model",
  "cases",
  "individual-models",
  "models-and-physicians",
] as const;
export type SegmentId = (typeof SEGMENTS)[number];

export const OPENING_KEY: Partial<Record<SegmentId, OpeningChapterKey>> = {
  "opening-hook": "hook",
  "opening-dilemma": "dilemma",
  "opening-framework": "framework",
  "opening-model": "model",
};

export const SEGMENT_BEATS: Record<SegmentId, readonly Beat[]> = {
  "opening-hook": OPENING_BEATS.hook,
  "opening-dilemma": OPENING_BEATS.dilemma,
  "opening-framework": OPENING_BEATS.framework,
  "opening-model": OPENING_BEATS.model,
  cases: casesBeats,
  "individual-models": [
    ...morphBeats.filter((b) => b.name !== "end"),
    ...individualBeats.map((b) => ({ name: b.name, startMs: b.startMs + MORPH_LEAD_MS })),
  ],
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
  OPENING_OFFSETS.model + chapterDuration({ beats: OPENING_BEATS.model });

/* -------------------------------------------------------------------------- */
/*  Headlines from the cases on (the opening draws its own, in the scene)      */
/* -------------------------------------------------------------------------- */

export const INDIVIDUAL_HEADLINE = "Different models. Different priorities.";

export interface HeadlineEntry {
  at: number;
  text: string;
}

const casesAt = (name: string) => SEGMENT_OFFSET.cases + beatStart(casesBeats, name);

/** Whole-demo times at which the headline changes. "" clears it (the closing question takes over). */
export const HEADLINE_ENTRIES: readonly HeadlineEntry[] = [
  { at: casesAt("shrink"), text: VOTE_HEADLINE },
  { at: casesAt("settle"), text: PROFILE_HEADLINE },
  { at: SEGMENT_OFFSET["individual-models"] + MORPH_LEAD_MS, text: INDIVIDUAL_HEADLINE },
  { at: SEGMENT_OFFSET["models-and-physicians"] + beatStart(closingBeats, "question"), text: "" },
].slice().sort((a, b) => a.at - b.at);

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
