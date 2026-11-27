import { useMemo } from "react";
import { LayoutGroup, motionValue } from "framer-motion";
import { useChapterClock } from "../../useChapterClock";
import { createStackChapter } from "./index";
import { MAX_FIT_GAP, type CaseFit } from "./predict";
import {
  DEFAULT_PROFILE_KEY,
  foregroundFits,
  profileLabelFor,
  realStackCases,
} from "./stackCases";

/** Real foreground trio plus seeded background cards, for the dev page. */
function useDevChapter() {
  return useMemo(() => {
    const cases = realStackCases(DEFAULT_PROFILE_KEY);
    const label = profileLabelFor(DEFAULT_PROFILE_KEY);
    return {
      label,
      fits: foregroundFits(cases, DEFAULT_PROFILE_KEY),
      chapter: createStackChapter({ cases, profileKey: DEFAULT_PROFILE_KEY, profileLabel: label }),
    };
  }, []);
}

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

/** Foreground cases: id, observed k/10, predicted P(choice 1) and the gap. */
function FitHeader({ label, fits }: { label: string; fits: readonly CaseFit[] }) {
  return (
    <header className="mx-auto w-full max-w-5xl px-6 pt-3 md:px-10" data-testid="fit-header">
      <table className="w-full font-mono text-[11px] tabular-nums text-gray-600">
        <thead>
          <tr className="text-left text-gray-400">
            <th className="font-normal">case</th>
            <th className="font-normal">{label} k/10</th>
            <th className="font-normal">P(1)</th>
            <th className="font-normal">gap</th>
          </tr>
        </thead>
        <tbody>
          {fits.map((f, i) => (
            <tr key={f.id}>
              <td className="text-gray-900">{f.id.slice(0, 8)}</td>
              <td>{f.count}/10</td>
              <td>{f.predicted.toFixed(3)}</td>
              <td className={f.gap > MAX_FIT_GAP ? "text-amber-700" : undefined}>
                {f.gap.toFixed(3)}
                {i === 0 && f.gap > MAX_FIT_GAP ? " (opening, pinned)" : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </header>
  );
}

function FrozenFrame({ ms }: { ms: number }) {
  const { chapter, fits, label } = useDevChapter();
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-canvas">
      <FitHeader label={label} fits={fits} />
      <main className="mx-auto min-h-0 w-full max-w-5xl flex-1 px-6 py-3 md:px-10">
        {chapter.render({ elapsedMs: ms, progress: 0, isPaused: true, time: motionValue(ms), restart: () => {} })}
      </main>
    </div>
  );
}

function LiveDev() {
  const { chapter, fits, label } = useDevChapter();
  const chapters = useMemo(() => [chapter], [chapter]);
  const clock = useChapterClock(chapters);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-canvas">
      <FitHeader label={label} fits={fits} />
      <main className="mx-auto min-h-0 w-full max-w-5xl flex-1 px-6 pb-20 pt-3 md:px-10">
        <LayoutGroup>
          {chapter.render({
            elapsedMs: clock.elapsedMs,
            progress: clock.progress,
            isPaused: clock.isPaused,
            time: clock.time,
            restart: clock.restart,
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
