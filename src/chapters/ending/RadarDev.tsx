import { useMemo } from "react";
import RadarChart, { RADAR_ENTRANCE_BEATS, RADAR_ENTRANCE_MS } from "../../components/RadarChart";
import { useChapterClock } from "../../useChapterClock";
import type { Chapter } from "../../types";
import { clamp01 } from "./shared";
import { ALL_PROFILES } from "./profiles";

/**
 * `#/dev/radar`: five profiles in full and compact, plus the near-uniform
 * physician, scrubbed by the entrance clock.
 *
 *   ?t=<ms>  one frozen frame (no clock)
 */

const SHOWN = ["gpt", "claude", "gemini", "P17", "P21"] as const;
const NEAR_UNIFORM = "P24";

const chapter: Chapter = {
  id: "radar",
  beats: RADAR_ENTRANCE_BEATS.map((beat) => ({ name: beat.name, startMs: beat.startMs })),
  render: () => null,
};

function profileByKey(key: string) {
  const found = ALL_PROFILES.find((profile) => profile.key === key);
  if (!found) throw new Error(`Missing profile "${key}"`);
  return found;
}

const shown = SHOWN.map((key) => profileByKey(key));
const nearUniform = profileByKey(NEAR_UNIFORM);

function entranceOf(elapsedMs: number): number {
  return clamp01(elapsedMs / RADAR_ENTRANCE_MS);
}

function Charts({ elapsedMs }: { elapsedMs: number }) {
  const progress = entranceOf(elapsedMs);
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-4">
      <header>
        <h1 className="text-lg font-semibold tracking-tight text-[#1B2433]">Radar</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">
          Same axes and the same 0 to 1 scale on every chart. The top value is larger, heavier, and darker.
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-[#1B2433]">Full</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {shown.map((profile) => (
            <figure key={profile.key} data-profile={profile.key} className="min-w-0">
              <RadarChart
                priorities={profile.priorities}
                mode="full"
                progress={progress}
                title={`${profile.displayName} priorities`}
                description={`Priorities of ${profile.displayName} on a fixed scale from 0 to 1.`}
              />
              <figcaption className="text-center text-sm font-semibold text-[#1B2433]">{profile.displayName}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-[#1B2433]">Compact</h2>
        <div className="flex flex-wrap gap-4">
          {shown.map((profile) => (
            <figure key={profile.key} data-profile={profile.key} className="w-[84px]">
              <RadarChart
                priorities={profile.priorities}
                mode="compact"
                progress={progress}
                title={`${profile.displayName} priorities`}
                description={`Priorities of ${profile.displayName} on a fixed scale from 0 to 1.`}
              />
              <figcaption className="text-center text-[10px] text-gray-600">{profile.displayName}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-[#1B2433]">Near uniform</h2>
        <div className="flex flex-wrap items-end gap-6">
          <figure data-profile={nearUniform.key} className="w-full max-w-sm">
            <RadarChart
              priorities={nearUniform.priorities}
              mode="full"
              progress={progress}
              title={`${nearUniform.displayName} priorities`}
              description={`Priorities of ${nearUniform.displayName} on a fixed scale from 0 to 1.`}
            />
            <figcaption className="text-center text-sm font-semibold text-[#1B2433]">{nearUniform.displayName}</figcaption>
          </figure>
          <figure data-profile={`${nearUniform.key}-compact`} className="w-[84px]">
            <RadarChart
              priorities={nearUniform.priorities}
              mode="compact"
              progress={progress}
              title={`${nearUniform.displayName} priorities`}
              description={`Priorities of ${nearUniform.displayName} on a fixed scale from 0 to 1.`}
            />
            <figcaption className="text-center text-[10px] text-gray-600">{nearUniform.displayName}</figcaption>
          </figure>
        </div>
      </section>
    </div>
  );
}

function BeatStrip({
  elapsedMs,
  onSeek,
}: {
  elapsedMs: number;
  onSeek: (ms: number) => void;
}) {
  return (
    <div
      data-playback-ui
      className="flex shrink-0 flex-wrap items-center gap-1.5 border-t border-line bg-white/90 px-3 py-2"
    >
      {RADAR_ENTRANCE_BEATS.map((beat) => (
        <button
          key={beat.name}
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onSeek(beat.startMs)}
          className="rounded-md border border-line bg-white px-2 py-1 font-mono text-xs text-gray-700 hover:bg-gray-50"
        >
          {beat.name}
        </button>
      ))}
      <span className="ml-2 font-mono text-xs tabular-nums text-gray-500">{Math.round(elapsedMs)} ms</span>
    </div>
  );
}

function Frozen({ ms }: { ms: number }) {
  return (
    <div className="flex h-full flex-col bg-canvas" data-testid="radar-dev">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Charts elapsedMs={ms} />
      </div>
      <BeatStrip
        elapsedMs={ms}
        onSeek={(next) => {
          const url = new URL(window.location.href);
          url.searchParams.set("t", String(next));
          window.location.assign(url);
        }}
      />
    </div>
  );
}

function Live() {
  const chapters = useMemo(() => [chapter], []);
  const clock = useChapterClock(chapters);
  return (
    <div className="flex h-full flex-col bg-canvas" data-testid="radar-dev">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Charts elapsedMs={clock.elapsedMs} />
      </div>
      <BeatStrip elapsedMs={clock.elapsedMs} onSeek={(ms) => {
        const beat = RADAR_ENTRANCE_BEATS.find((item) => item.startMs === ms);
        if (beat) clock.seek(0, beat.name);
      }} />
    </div>
  );
}

export default function RadarDev() {
  const frozen = new URLSearchParams(window.location.search).get("t");
  if (frozen !== null && Number.isFinite(Number(frozen))) return <Frozen ms={Number(frozen)} />;
  return <Live />;
}
