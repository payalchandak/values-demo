import { useEffect, useMemo } from "react";
import { LayoutGroup } from "framer-motion";
import Hud from "../../components/Hud";
import PausedBadge from "../../components/PausedBadge";
import type { StudyCase } from "../../study/types";
import { useChapterClock } from "../../useChapterClock";
import { regressionBeats } from "./beats";
import { priorityMismatch } from "./data";
import { DEFAULT_PROFILE_KEY, allCases, profileByKey } from "./dataset";
import { regressionChapter, type RegressionProps } from "./RegressionChapter";

/** The opening case. The integration agent will swap in the final picker. */
const OPENING_CASE_ID = "0b5a2bcb-0946-461a-8ba1-8f29213f01c5";
const PRIORITY_TOLERANCE = 0.001;

/** The first three cases in cases.json, with the opening case moved to the front. */
function devRows(): RegressionProps["rows"] {
  const opening = allCases.find((c) => c.id === OPENING_CASE_ID);
  if (!opening) throw new Error(`Opening case ${OPENING_CASE_ID} is not in cases.json`);
  const rest: StudyCase[] = allCases.filter((c) => c.id !== OPENING_CASE_ID).slice(0, 2);
  const [second, third] = rest;
  if (!second || !third) throw new Error("cases.json has fewer than three cases");
  return [opening, second, third];
}

/**
 * `#/dev/regression`: the chapter alone, on the real chapter clock, with the
 * usual transport plus a jump-to-beat strip.
 *
 *   ?beat=weighted   open paused on that beat
 *   ?profile=claude  show a different profile (default: gpt)
 *
 * Jumping pauses on that beat's first frame; press Space to play on from there.
 */
export default function RegressionDev() {
  const params = new URLSearchParams(window.location.search);
  const profileKey = params.get("profile") ?? DEFAULT_PROFILE_KEY;
  const profile = useMemo(() => profileByKey(profileKey), [profileKey]);
  const rows = useMemo(devRows, []);
  // Stable identity: the clock memoizes on this array.
  const chapters = useMemo(() => [regressionChapter({ rows, profile })], [rows, profile]);

  const clock = useChapterClock(chapters);
  const chapter = chapters[clock.chapterIndex];

  const { seek } = clock;
  useEffect(() => {
    const beat = new URLSearchParams(window.location.search).get("beat");
    if (beat && regressionBeats.some((b) => b.name === beat)) seek(0, beat);
  }, [seek]);

  // The published priorities must equal softmax(weights / 0.262).
  const mismatch = priorityMismatch(profile);
  const mismatchError =
    mismatch > PRIORITY_TOLERANCE
      ? `Computed priorities differ from profile.priorities for "${profile.key}" by ${mismatch.toFixed(4)} (tolerance ${PRIORITY_TOLERANCE}).`
      : null;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-canvas">
      <PausedBadge visible={clock.isPaused && clock.pausedByViewer} />

      <nav
        data-playback-ui
        className="fixed inset-x-0 top-0 z-40 flex gap-1 overflow-x-auto border-b border-line bg-white/80 px-3 py-1 backdrop-blur-md"
      >
        {regressionBeats.slice(0, -1).map((beat) => (
          <button
            key={beat.name}
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => clock.seek(0, beat.name)}
            className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] text-gray-600 transition hover:bg-gray-900/5 hover:text-gray-900"
          >
            {beat.name}
          </button>
        ))}
      </nav>

      {mismatchError && (
        <div
          role="alert"
          className="fixed inset-x-3 top-9 z-40 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-800"
        >
          {mismatchError}
        </div>
      )}

      <main className="mx-auto h-full w-full max-w-5xl px-6 pb-24 pt-14 md:px-10">
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
