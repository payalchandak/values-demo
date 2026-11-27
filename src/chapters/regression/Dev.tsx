import { useEffect } from "react";
import { LayoutGroup } from "framer-motion";
import Hud from "../../components/Hud";
import PausedBadge from "../../components/PausedBadge";
import { useChapterClock } from "../../useChapterClock";
import { regressionBeats } from "./beats";
import { regressionChapter } from "./RegressionChapter";

// Stable identity: the clock memoizes on this array.
const chapters = [regressionChapter];

/**
 * `#/dev/regression`: the chapter alone, on the real chapter clock, with the
 * usual transport plus a jump-to-beat strip. Jumping pauses on that beat's
 * first frame; press Space to play on from there.
 */
export default function RegressionDev() {
  const clock = useChapterClock(chapters);
  const chapter = chapters[clock.chapterIndex];

  // `/?beat=weighted#/dev/regression` opens paused on that beat.
  const { seek } = clock;
  useEffect(() => {
    const beat = new URLSearchParams(window.location.search).get("beat");
    if (beat && regressionBeats.some((b) => b.name === beat)) seek(0, beat);
  }, [seek]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-canvas">
      <PausedBadge visible={clock.isPaused && clock.pausedByViewer} />

      <main className="mx-auto h-full w-full max-w-5xl px-6 pb-24 pt-8 md:px-10">
        <LayoutGroup>
          <div className="h-full w-full">
            {chapter.render({
              elapsedMs: clock.elapsedMs,
              progress: clock.progress,
              isPaused: clock.isPaused,
              time: clock.time,
            })}
          </div>
        </LayoutGroup>
      </main>

      <nav
        data-playback-ui
        className="fixed bottom-5 left-5 z-50 flex max-w-[calc(100vw-12rem)] flex-wrap gap-1 rounded-2xl border border-line bg-white/70 p-1.5 backdrop-blur-md"
      >
        {regressionBeats.slice(0, -1).map((beat) => (
          <button
            key={beat.name}
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => clock.seek(0, beat.name)}
            className="rounded-full px-2 py-0.5 font-mono text-[10px] text-gray-600 transition hover:bg-gray-900/5 hover:text-gray-900"
          >
            {beat.name}
          </button>
        ))}
      </nav>

      <Hud
        count={1}
        currentStep={0}
        progress={clock.progress}
        isPaused={clock.isPaused}
        onPrev={clock.prev}
        onNext={clock.next}
        onToggle={clock.togglePause}
        onRestart={clock.restart}
        onSeek={(i) => clock.seek(i)}
      />
    </div>
  );
}
