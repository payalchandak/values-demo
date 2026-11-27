import { useEffect, useMemo } from "react";
import { LayoutGroup } from "framer-motion";
import Hud from "../../components/Hud";
import PausedBadge from "../../components/PausedBadge";
import { useChapterClock } from "../../useChapterClock";
import { regressionBeats } from "./beats";
import { bestFitIndex, fitGap, priorityMismatch } from "./data";
import { DEFAULT_PROFILE_KEY, allCases, profileByKey } from "./dataset";
import { regressionChapter, type RegressionProps } from "./RegressionChapter";

/**
 * Dev-only rows: the trio the stack chapter shows, first one highlighted. The
 * chapter itself never names a case; integration passes the picker's output.
 */
const DEV_CASE_PREFIXES = ["0b5a2bcb", "0c790bb1", "1f92a8ed"] as const;
const PRIORITY_TOLERANCE = 0.001;
const MAX_EXPANDED_GAP = 0.25;

function devRows(): RegressionProps["rows"] {
  const [a, b, c] = DEV_CASE_PREFIXES.map((prefix) => {
    const matches = allCases.filter((x) => x.id.startsWith(prefix));
    const [match] = matches;
    if (matches.length !== 1 || !match) {
      throw new Error(`Expected exactly one case starting with ${prefix}, found ${matches.length}`);
    }
    return match;
  });
  if (!a || !b || !c) throw new Error("Expected three dev cases");
  return [a, b, c];
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
  // expandedIndex is left to the chapter's default (best fit) on purpose.
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

  // The expanded row should be a case where the prediction visibly fits.
  const expandedIndex = bestFitIndex(rows, profile);
  const expandedRow = rows[expandedIndex];
  const gap = expandedRow ? fitGap(expandedRow, profile) : undefined;
  const gapWarning =
    gap === undefined
      ? `The expanded row (${expandedRow?.id ?? "none"}) has no observed count for "${profile.key}".`
      : gap > MAX_EXPANDED_GAP
        ? `The expanded row (${expandedRow?.id}) fits poorly: |predicted - k/10| = ${gap.toFixed(2)} > ${MAX_EXPANDED_GAP}.`
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

      <div className="fixed inset-x-3 top-9 z-40 flex flex-col gap-1">
        {mismatchError && (
          <div
            role="alert"
            className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-800"
          >
            {mismatchError}
          </div>
        )}
        {gapWarning && (
          <div
            role="status"
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900"
          >
            Warning: {gapWarning}
          </div>
        )}
      </div>

      <main className="mx-auto h-full w-full max-w-5xl px-6 pb-24 pt-14 md:px-10">
        <LayoutGroup>
          <div className="h-full w-full">
            {chapter.render({
              elapsedMs: clock.elapsedMs,
              progress: clock.progress,
              isPaused: clock.isPaused,
              time: clock.time,
              restart: clock.restart,
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
