import { useLayoutEffect, useRef, useState } from "react";
import RadarChart from "./RadarChart";
import { clamp01, EndingHeader, Legend, ModelLabel, requestReplay, useElementSize } from "./shared";
import { individualRadarSize } from "./IndividualModels";
import { assertIndividualPhysicians } from "./profiles";
import type { Profile } from "../../study/types";

export const CLOSING_QUESTION = "When one model gives advice at scale, whose priorities does it repeat?";

/** TODO: replace with the final paper URL. */
export const PAPER_URL = "https://neurips.cc/";

export interface PhysiciansTiming {
  /** Length of the shrink from the single large radar into the model row. */
  shrinkMs: number;
  /** Physician row starts appearing. */
  physiciansStartMs: number;
  /** Delay between successive physician radars. */
  physicianStaggerMs: number;
  /** Fade-in length of one physician radar. */
  physicianFadeMs: number;
  /** Closing question starts fading in; the rows dim behind it. */
  questionStartMs: number;
  questionFadeMs: number;
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

const GAP = 20;
const MAX_RADAR = 150;
const ROW_CHROME = 84;
const ROW_GAP = 32;

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition active:scale-[0.98]";

export default function ModelsAndPhysicians({
  models,
  physicians,
  elapsedMs,
  timing,
}: {
  models: readonly Profile[];
  /** Individual physicians only. */
  physicians: readonly Profile[];
  elapsedMs: number;
  timing: PhysiciansTiming;
}) {
  // Hard guard: the pooled physician profile must never be drawn here.
  assertIndividualPhysicians(physicians);

  const body = useRef<HTMLDivElement>(null);
  const { width, height } = useElementSize(body);

  // One size for every radar in both rows, so shapes stay comparable.
  const perRow = Math.max(models.length, physicians.length);
  const radarSize = Math.max(
    // Height budget: two rows, each a radar plus ~72px of caption and label, and the gap between.
    Math.min(MAX_RADAR, (width - GAP * (perRow - 1)) / perRow, (height - 2 * ROW_CHROME - ROW_GAP) / 2),
    56,
  );

  // Chapter start: the model row begins at the previous chapter's radar scale,
  // centered on the stage, and shrinks into place. A pure function of time.
  const modelsRef = useRef<HTMLElement>(null);
  const [dy, setDy] = useState(0);
  useLayoutEffect(() => {
    const el = modelsRef.current;
    if (el) setDy(height / 2 - (el.offsetTop + el.offsetHeight / 2));
  }, [width, height, radarSize]);
  const shrink = easeOut(clamp01(elapsedMs / timing.shrinkMs));
  const scale = 1 + (Math.max(individualRadarSize(width, height) / radarSize, 1) - 1) * (1 - shrink);
  const shrinkOpacity = clamp01(elapsedMs / 250);
  // Caption and names wait until the radars are nearly in place.
  const namesIn = clamp01((shrink - 0.6) / 0.4);

  const rowsIn = (i: number) =>
    clamp01((elapsedMs - timing.physiciansStartMs - i * timing.physicianStaggerMs) / timing.physicianFadeMs);
  const captionIn = clamp01((elapsedMs - timing.physiciansStartMs) / timing.physicianFadeMs);

  const q = clamp01((elapsedMs - timing.questionStartMs) / timing.questionFadeMs);
  const rowsOpacity = 1 - 0.88 * q;

  return (
    <div className="flex h-full w-full flex-col">
      <EndingHeader label="Models and physicians" />

      <div ref={body} className="relative min-h-0 flex-1">
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ opacity: rowsOpacity, gap: ROW_GAP }}
          aria-hidden={q > 0.5}
        >
          {/* Models: the radars carry over from the previous chapter. */}
          <section
            ref={modelsRef}
            aria-label="Models"
            className="flex flex-col items-center gap-3"
            style={{ opacity: shrinkOpacity, transform: `translateY(${dy * (1 - shrink)}px) scale(${scale})` }}
          >
            <h2 className="font-mono text-xs uppercase tracking-widest text-gray-400" style={{ opacity: namesIn }}>
              Models
            </h2>
            <div className="flex items-start justify-center" style={{ gap: GAP }}>
              {models.map((model) => (
                <div key={model.key} className="flex flex-col items-center gap-2" style={{ width: radarSize }}>
                  <RadarChart priorities={model.priorities} size={radarSize} />
                  <div style={{ opacity: namesIn }}>
                    <ModelLabel profile={model} iconSize={radarSize < 100 ? 24 : 30} stacked />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Individual physicians, one radar each. */}
          <section aria-label="Individual physicians" className="flex flex-col items-center gap-3">
            <h2
              className="font-mono text-xs uppercase tracking-widest text-gray-400"
              style={{ opacity: captionIn }}
            >
              Individual physicians
            </h2>
            <div className="flex items-start justify-center" style={{ gap: GAP }}>
              {physicians.map((physician, i) => {
                const p = rowsIn(i);
                return (
                  <div
                    key={physician.key}
                    className="flex flex-col items-center gap-2"
                    style={{ width: radarSize, opacity: p, transform: `translateY(${(1 - p) * 14}px)` }}
                  >
                    <RadarChart priorities={physician.priorities} size={radarSize} />
                    <span className="text-xs text-gray-500">{physician.displayName}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Closing question */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-9 px-4 text-center"
          style={{
            opacity: q,
            transform: `translateY(${(1 - q) * 10}px)`,
            visibility: q > 0 ? "visible" : "hidden",
            pointerEvents: q > 0.9 ? "auto" : "none",
          }}
        >
          <p className="max-w-3xl text-balance text-3xl font-semibold leading-tight tracking-tight text-[#1B2433] sm:text-4xl md:text-5xl">
            {CLOSING_QUESTION}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              data-playback-ui
              href={PAPER_URL}
              target="_blank"
              rel="noopener noreferrer"
              tabIndex={q > 0.9 ? 0 : -1}
              className={`${buttonBase} bg-[#1B2433] text-white hover:bg-[#2b374d]`}
            >
              Read the paper
              <span aria-hidden="true">↗</span>
            </a>
            <button
              data-playback-ui
              type="button"
              tabIndex={q > 0.9 ? 0 : -1}
              onMouseDown={(e) => e.preventDefault()} // keep focus off the button so Space stays global
              onClick={requestReplay}
              className={`${buttonBase} border border-line bg-white text-[#1B2433] hover:bg-gray-50`}
            >
              <span aria-hidden="true">↺</span>
              Replay
            </button>
          </div>
        </div>
      </div>

      <div className="pb-1 pt-3" style={{ opacity: rowsOpacity }}>
        <Legend />
      </div>
    </div>
  );
}
