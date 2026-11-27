import { useRef } from "react";
import RadarChart from "./RadarChart";
import { clamp01, easeInOut, EndingHeader, Legend, ModelLabel, useElementSize } from "./shared";
import type { Profile } from "../../study/types";

/** Time each model sits still in the center, then the time spent scrolling to the next. */
export const MODEL_HOLD_MS = 3500;
export const MODEL_SCROLL_MS = 800;
const PITCH_MS = MODEL_HOLD_MS + MODEL_SCROLL_MS;

/** Start of model `i`'s hold. */
export const modelStartMs = (i: number) => i * PITCH_MS;

/** The chapter ends when the last model's hold does (no scroll after the last). */
export const individualModelsEndMs = (count: number) => modelStartMs(count - 1) + MODEL_HOLD_MS;

/**
 * Scroll position in slots (0 = first model centered, 1 = second, ...).
 * A pure function of chapter time, so pausing and seeking are exact.
 */
export function scrollPosition(elapsedMs: number, count: number): number {
  const i = Math.min(Math.floor(elapsedMs / PITCH_MS), count - 1);
  const phase = elapsedMs - i * PITCH_MS;
  if (i >= count - 1 || phase < MODEL_HOLD_MS) return Math.max(i, 0);
  return i + easeInOut(clamp01((phase - MODEL_HOLD_MS) / MODEL_SCROLL_MS));
}

/** Gap reserved below the radar for the provider label. */
const LABEL_BLOCK = 72;
const MAX_RADAR = 400;

/** Radar size for a given stage size. Exported so the next chapter can shrink from exactly this. */
export const individualRadarSize = (width: number, height: number) =>
  Math.max(Math.min(MAX_RADAR, height - LABEL_BLOCK - 24, width * 0.9), 120);

export default function IndividualModels({
  models,
  elapsedMs,
}: {
  models: readonly Profile[];
  elapsedMs: number;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const { width, height } = useElementSize(viewport);
  const radarSize = individualRadarSize(width, height);

  const pos = scrollPosition(elapsedMs, models.length);
  const active = Math.round(pos);

  return (
    <div className="flex h-full w-full flex-col">
      <EndingHeader label="Individual models" />

      <div ref={viewport} className="relative min-h-0 flex-1 overflow-hidden">
        {/* The track scrolls; every slot is exactly one viewport tall, so the held profile is always dead center. */}
        <div
          className="absolute inset-x-0 top-0 will-change-transform"
          style={{ transform: `translateY(${-pos * height}px)` }}
        >
          {models.map((model, i) => (
            <div
              key={model.key}
              className="absolute inset-x-0 flex flex-col items-center justify-center gap-3"
              style={{ top: i * height, height }}
              aria-hidden={i !== active}
            >
              <RadarChart priorities={model.priorities} size={radarSize} />
              <ModelLabel profile={model} iconSize={40} large />
            </div>
          ))}
        </div>

        {/* Position dots */}
        <ol className="absolute right-0 top-1/2 flex -translate-y-1/2 flex-col gap-2" aria-hidden="true">
          {models.map((model, i) => (
            <li
              key={model.key}
              className={`h-1.5 w-1.5 rounded-full transition-colors ${i === active ? "bg-gray-800" : "bg-gray-300"}`}
            />
          ))}
        </ol>
      </div>

      <div className="pb-1 pt-3">
        <Legend />
      </div>
    </div>
  );
}
