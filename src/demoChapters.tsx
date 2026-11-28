import type { Chapter } from "./types";
import Stage from "./stage/Stage";
import { SEGMENTS, SEGMENT_BEATS } from "./stage/plan";

/**
 * Every chapter renders the same `<Stage>` at the same place in the tree,
 * never keyed by chapter, so it persists for the whole demo. A chapter is just
 * its beats plus which clock position the stage is drawn at.
 *
 * Order: opening (4), cases with their votes, bars-to-donut morph, ending (2).
 */
export const chapters: Chapter[] = SEGMENTS.map((id) => ({
  id,
  beats: SEGMENT_BEATS[id],
  render: (ctx) => <Stage segment={id} ctx={ctx} />,
}));
