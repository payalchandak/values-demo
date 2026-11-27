import { useLayoutEffect, useRef, useState } from "react";
import Radar, { PLOT_RADIUS_PER_WIDTH, RADAR_ASPECT } from "./Radar";
import { clamp01, easeInOut, EndingHeader, Legend, ModelLabel, useElementSize } from "./shared";
import { assertIndividualPhysicians } from "./profiles";
import { HELD_RADAR_OFFSET_Y, individualRadarWidth } from "./IndividualModels";
import type { Profile } from "../../study/types";

export const CLOSING_QUESTION = "When one model gives advice at scale, whose priorities does it repeat?";

/**
 * TODO: the final paper URL must be supplied by the author. This is the
 * project repository for now; do not replace it with a guessed URL.
 */
export const PAPER_URL = "https://github.com/payalchandak/value-prism";

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

const GAP = 16;
const MAX_RADAR = 150;
const MIN_RADAR = 40;
/** Below this, a row wraps onto a second line instead of shrinking further. */
const READABLE_RADAR = 84;
/** Space under a model radar (icon, name), under a physician radar (name), and above each row (caption). */
const MODEL_CHROME = 64;
const PHYSICIAN_CHROME = 26;
const CAPTION = 28;
const ROW_GAP = 12;
const SECTION_GAP = 28;

/** Rows needed for `n` items at `cols` per row. */
const rowsFor = (n: number, cols: number) => Math.ceil(n / cols);

interface RowsLayout {
  /** Rendered width of every radar (one size for all, so shapes stay comparable). */
  radar: number;
  modelCols: number;
  physicianCols: number;
}

/**
 * Largest single radar size such that both rows fit the stage. Each row is
 * one line when it can be and otherwise wraps into balanced lines (e.g. 6
 * becomes 3 + 3) rather than shrinking the radars to nothing.
 */
function layoutRows(width: number, height: number, nModels: number, nPhysicians: number): RowsLayout {
  const candidates: (RowsLayout & { lines: number })[] = [];
  for (const modelLines of [1, 2, 3]) {
    for (const physicianLines of [1, 2, 3]) {
      const modelCols = Math.ceil(nModels / modelLines);
      const physicianCols = Math.ceil(nPhysicians / physicianLines);
      const lines = rowsFor(nModels, modelCols) + rowsFor(nPhysicians, physicianCols);
      const widthFit = (cols: number) => (width - GAP * (cols - 1)) / cols;
      const fixed =
        2 * CAPTION +
        SECTION_GAP +
        rowsFor(nModels, modelCols) * MODEL_CHROME +
        rowsFor(nPhysicians, physicianCols) * PHYSICIAN_CHROME +
        (lines - 2) * ROW_GAP;
      const heightFit = (height - fixed) / (RADAR_ASPECT.compact * lines);
      const radar = Math.min(MAX_RADAR, widthFit(modelCols), widthFit(physicianCols), heightFit);
      candidates.push({ radar, modelCols, physicianCols, lines });
    }
  }
  // Prefer single rows: the fewest lines whose radars are still readable.
  const readable = candidates.filter((c) => c.radar >= READABLE_RADAR);
  const pool = readable.length > 0 ? readable : candidates;
  const best = pool.reduce((a, b) => {
    if (readable.length > 0 && a.lines !== b.lines) return a.lines < b.lines ? a : b;
    return a.radar >= b.radar ? a : b;
  });
  return { radar: Math.max(best.radar, MIN_RADAR), modelCols: best.modelCols, physicianCols: best.physicianCols };
}

/** Splits items into consecutive lines of `cols`. */
const toLines = <T,>(items: readonly T[], cols: number): T[][] => {
  const lines: T[][] = [];
  for (let i = 0; i < items.length; i += cols) lines.push(items.slice(i, i + cols));
  return lines;
};

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition active:scale-[0.98]";

export default function ModelsAndPhysicians({
  models,
  anchorKey,
  physicians,
  elapsedMs,
  timing,
  onReplay,
  showHeader = true,
  sharedIconFor,
}: {
  /** Restart the whole demo (the player's `ctx.restart`). */
  onReplay: () => void;
  /** False when the stage supplies the headline. */
  showHeader?: boolean;
  /** Key of the model whose icon the stage draws (leaves a slot instead). */
  sharedIconFor?: string;
  models: readonly Profile[];
  /** The model held at the end of the previous chapter; the row shrinks out from its radar. */
  anchorKey: string;
  /** Individual physicians only. */
  physicians: readonly Profile[];
  elapsedMs: number;
  timing: PhysiciansTiming;
}) {
  // Hard guard: the pooled physician profile must never be drawn here.
  assertIndividualPhysicians(physicians);
  if (!models.some((m) => m.key === anchorKey)) throw new Error(`Anchor model "${anchorKey}" is not in the model row.`);

  const body = useRef<HTMLDivElement>(null);
  const { width, height } = useElementSize(body);
  const { radar, modelCols, physicianCols } = layoutRows(width, height, models.length, physicians.length);

  // Chapter start: the row begins exactly where the previous chapter left off:
  // the anchor model's radar is at the same center and the same plot size as
  // the held radar, and the row shrinks out from it. A pure function of time.
  const modelsRef = useRef<HTMLElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [shift, setShift] = useState({ dx: 0, dy: 0, ox: 0, oy: 0 });
  useLayoutEffect(() => {
    const section = modelsRef.current;
    const anchor = anchorRef.current;
    const stage = body.current;
    if (!section || !anchor || !stage) return;
    const live = section.style.transform;
    section.style.transform = "none"; // measure the resting layout
    const s = section.getBoundingClientRect();
    const a = anchor.getBoundingClientRect();
    const b = stage.getBoundingClientRect();
    section.style.transform = live;
    const ax = a.left + a.width / 2;
    const ay = a.top + a.height / 2;
    setShift({
      dx: b.left + b.width / 2 - ax,
      dy: b.top + b.height / 2 + HELD_RADAR_OFFSET_Y - ay,
      ox: ax - s.left,
      oy: ay - s.top,
    });
  }, [width, height, radar, modelCols, models.length]);
  const heldPlotRadius = PLOT_RADIUS_PER_WIDTH.full * individualRadarWidth(width, height);
  const rowPlotRadius = PLOT_RADIUS_PER_WIDTH.compact * radar;
  const shrink = easeInOut(clamp01(elapsedMs / timing.shrinkMs));
  const scale = 1 + (Math.max(heldPlotRadius / rowPlotRadius, 1) - 1) * (1 - shrink);
  // Everything but the anchor fades in once the row has shrunk enough to be on screen.
  const othersOpacity = clamp01((shrink - 0.8) / 0.2);
  // Caption and names wait until the radars are nearly in place.
  const namesIn = clamp01((shrink - 0.6) / 0.4);

  const physicianIn = (i: number) =>
    clamp01((elapsedMs - timing.physiciansStartMs - i * timing.physicianStaggerMs) / timing.physicianFadeMs);
  const captionIn = clamp01((elapsedMs - timing.physiciansStartMs) / timing.physicianFadeMs);

  const q = clamp01((elapsedMs - timing.questionStartMs) / timing.questionFadeMs);
  const rowsOpacity = 1 - 0.88 * q;

  return (
    <div className="flex h-full w-full flex-col">
      {showHeader && <EndingHeader label="Models and physicians" />}

      <div ref={body} className="relative min-h-0 flex-1">
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ opacity: rowsOpacity, gap: SECTION_GAP }}
          aria-hidden={q > 0.5}
        >
          {/* Models: one labeled row (wrapping only when the stage is too narrow). */}
          <section
            ref={modelsRef}
            aria-label="Models"
            className="flex flex-col items-center"
            style={{
              gap: ROW_GAP,
              transformOrigin: `${shift.ox}px ${shift.oy}px`,
              transform: `translate(${shift.dx * (1 - shrink)}px, ${shift.dy * (1 - shrink)}px) scale(${scale})`,
            }}
          >
            <h2
              className="font-mono text-xs uppercase tracking-widest text-gray-400"
              style={{ opacity: namesIn }}
            >
              Models
            </h2>
            {toLines(models, modelCols).map((line, li) => (
              <div key={li} className="flex items-start justify-center" style={{ gap: GAP }}>
                {line.map((model) => (
                  <div
                    key={model.key}
                    className="flex flex-col items-center gap-2"
                    style={{ width: radar, opacity: model.key === anchorKey ? 1 : othersOpacity }}
                  >
                    <div ref={model.key === anchorKey ? anchorRef : undefined}>
                      <Radar profile={model} width={radar} mode="compact" />
                    </div>
                    <div style={{ opacity: namesIn }}>
                      <ModelLabel profile={model} iconSize={radar < 70 ? 24 : 30} stacked iconSlot={model.key === sharedIconFor} />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </section>

          {/* Individual physicians, one radar each. Never the pooled profile. */}
          <section aria-label="Individual physicians" className="flex flex-col items-center" style={{ gap: ROW_GAP }}>
            <h2
              className="font-mono text-xs uppercase tracking-widest text-gray-400"
              style={{ opacity: captionIn }}
            >
              Individual physicians
            </h2>
            {toLines(physicians, physicianCols).map((line, li) => (
              <div key={li} className="flex items-start justify-center" style={{ gap: GAP }}>
                {line.map((physician) => {
                  const i = physicians.indexOf(physician);
                  const p = physicianIn(i);
                  return (
                    <div
                      key={physician.key}
                      className="flex flex-col items-center gap-1"
                      style={{ width: radar, opacity: p, transform: `translateY(${(1 - p) * 14}px)` }}
                    >
                      <Radar profile={physician} width={radar} mode="compact" />
                      <span className="text-xs text-gray-500">{physician.displayName}</span>
                    </div>
                  );
                })}
              </div>
            ))}
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
              onClick={onReplay}
              className={`${buttonBase} border border-line bg-white text-[#1B2433] hover:bg-gray-50`}
            >
              <span aria-hidden="true">↺</span>
              Replay
            </button>
          </div>
        </div>
      </div>

      <div className="pb-1 pt-3" style={{ opacity: rowsOpacity * namesIn }}>
        <Legend />
      </div>
    </div>
  );
}
