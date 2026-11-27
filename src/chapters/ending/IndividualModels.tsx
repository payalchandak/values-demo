import { useRef } from "react";
import Radar, { RADAR_ASPECT } from "./Radar";
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

/** Provider icon height and its gap below the radar (`gap-3`); the next chapter uses these to find the radar's center. */
const LABEL_ICON = 40;
const LABEL_GAP = 12;
const LABEL_BLOCK = 72;

/**
 * The held radar's center sits this far above the center of the stage body,
 * because the radar and its label are centered together.
 */
export const HELD_RADAR_OFFSET_Y = -(LABEL_GAP + LABEL_ICON) / 2;
const MAX_RADAR_WIDTH = 560;

/**
 * Rendered width of the held radar (full mode) for a given stage size.
 * Exported so the next chapter can shrink from exactly this.
 */
export const individualRadarWidth = (width: number, height: number) =>
  Math.max(
    Math.min(MAX_RADAR_WIDTH, width * 0.92, (height - LABEL_BLOCK - 24) / RADAR_ASPECT.full),
    120,
  );

export default function IndividualModels({
  models,
  elapsedMs,
}: {
  models: readonly Profile[];
  elapsedMs: number;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const { width, height } = useElementSize(viewport);
  const radarWidth = individualRadarWidth(width, height);

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
              <Radar profile={model} width={radarWidth} mode="full" />
              <ModelLabel profile={model} iconSize={LABEL_ICON} large />
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

      {/* Invisible spacer with the next chapter's legend, so both chapters' stage bodies match exactly. */}
      <div className="pb-1 pt-3 opacity-0" aria-hidden="true">
        <Legend />
      </div>
    </div>
  );
}
