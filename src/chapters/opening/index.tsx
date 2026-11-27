import type { Chapter } from "../../types";
import OpeningScene from "./OpeningScene";
import { OFFSETS, OPENING_BEATS, type OpeningChapterKey } from "./timeline";

/**
 * Opening chapters 1 to 4 of the storyboard. Every chapter renders the same
 * persistent scene at its own point on the shared opening clock, so the
 * patient card, headline, and option cards carry over between chapters.
 */
const make = (key: OpeningChapterKey, id: string): Chapter => ({
  id,
  beats: OPENING_BEATS[key],
  render: (ctx) => <OpeningScene t={OFFSETS[key] + ctx.elapsedMs} />,
});

export const openingChapters: Chapter[] = [
  make("hook", "opening-hook"),
  make("dilemma", "opening-dilemma"),
  make("model", "opening-model"),
  make("framework", "opening-framework"),
];
