import { useMemo } from "react";
import { LayoutGroup, motionValue } from "framer-motion";
import { useChapterClock } from "../../useChapterClock";
import { createStackChapter } from "./index";

/**
 * Dev harness for `#/dev/stack`: the stack chapter alone, on the real chapter
 * clock, with a beat-seek bar. Click, Space and arrow keys behave as in the player.
 */
export default function StackDev() {
  // `?t=<ms>#/dev/stack` renders one frozen frame with no clock, for screenshots.
  const frozen = new URLSearchParams(window.location.search).get("t");
  if (frozen !== null) return <FrozenFrame ms={Number(frozen)} />;
  return <LiveDev />;
}

function FrozenFrame({ ms }: { ms: number }) {
  const chapter = useMemo(() => createStackChapter(), []);
  return (
    <div className="h-screen w-screen overflow-hidden bg-canvas px-10 py-6">
      {chapter.render({ elapsedMs: ms, progress: 0, isPaused: true, time: motionValue(ms) })}
    </div>
  );
}

function LiveDev() {
  const chapters = useMemo(() => [createStackChapter()], []);
  const clock = useChapterClock(chapters);
  const chapter = chapters[0];

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-canvas">
      <main className="mx-auto h-full w-full max-w-5xl px-6 pb-20 pt-6 md:px-10">
        <LayoutGroup>
          {chapter.render({
            elapsedMs: clock.elapsedMs,
            progress: clock.progress,
            isPaused: clock.isPaused,
            time: clock.time,
          })}
        </LayoutGroup>
      </main>

      <div
        data-playback-ui
        className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-1.5 border-t border-line bg-white/80 px-3 py-2 backdrop-blur"
      >
        <button
          type="button"
          onClick={clock.togglePause}
          className="rounded-md border border-line bg-white px-2.5 py-1 font-mono text-xs"
        >
          {clock.isPaused ? "play" : "pause"}
        </button>
        {chapter.beats.map((beat) => (
          <button
            key={beat.name}
            type="button"
            onClick={() => clock.seek(0, beat.name)}
            className="rounded-md border border-line bg-white px-2 py-1 font-mono text-xs text-gray-600 hover:bg-gray-50"
          >
            {beat.name}
          </button>
        ))}
        <span className="ml-2 font-mono text-xs tabular-nums text-gray-500">
          {Math.round(clock.elapsedMs)} ms
        </span>
      </div>
    </div>
  );
}
