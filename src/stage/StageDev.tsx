import { LayoutGroup, motionValue } from "framer-motion";
import Stage from "./Stage";
import { SEGMENTS, SEGMENT_BEATS, type SegmentId } from "./plan";
import { chapterDuration } from "../types";

/**
 * `?chapter=<id>&t=<ms>#/dev/stage`: one frozen frame of the integrated stage,
 * in the same frame the player uses (no HUD, no clock). Used by `check:fit`,
 * which reads the chapter list from `window.__chapters`.
 */
export default function StageDev() {
  const q = new URLSearchParams(window.location.search);
  const requested = q.get("chapter") ?? SEGMENTS[0];
  const segment = (SEGMENTS as readonly string[]).includes(requested) ? (requested as SegmentId) : SEGMENTS[0];
  const t = Number(q.get("t") ?? 0);
  (window as unknown as { __chapters: unknown }).__chapters = SEGMENTS.map((id) => ({
    id,
    durationMs: chapterDuration({ beats: SEGMENT_BEATS[id] }),
    beats: SEGMENT_BEATS[id].map((b) => b.startMs),
  }));
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-canvas">
      <main
        className={
          segment === "stack"
            ? "mx-auto h-full w-full px-4 pb-24 pt-8 md:px-6"
            : "mx-auto h-full w-full max-w-5xl px-6 pb-24 pt-8 md:px-10"
        }
      >
        <LayoutGroup>
          <div className="h-full w-full">
            <Stage
              segment={segment}
              ctx={{ elapsedMs: t, progress: 0, isPaused: true, time: motionValue(t), restart: () => {} }}
            />
          </div>
        </LayoutGroup>
      </main>
    </div>
  );
}
