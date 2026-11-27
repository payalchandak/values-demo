import { useRef, useState } from "react";
import Donut, { HeroText, SegmentPaths, dominantValue, donutScene, measureText, percentText, useBox, useFontEpoch } from "../../components/Donut";
import ProviderIcon from "../../components/ProviderIcon";
import { VALUES, VALUE_ORDER } from "../../design";
import type { Profile } from "../../study/types";
import { GALLERY_STARTS, GALLERY_TIMING, easeInOut, itemIn, ramp } from "./beats";
import { HERO_CHROME, HERO_ICON } from "./IndividualModels";
import { modelLogo } from "./icons";
import { assertIndividualPhysicians } from "./profiles";
import { EndingHeader, ModelLabel } from "./shared";

export const CLOSING_QUESTION = "When one model gives advice at scale, whose priorities does it repeat?";
export const KEY_LINE = "Each ring runs clockwise from the top: Autonomy, Beneficence, Nonmaleficence, Justice.";
export const MODELS_CAPTION = "Language models";
export const PHYSICIANS_CAPTION = "Physicians";

/**
 * TODO: the final paper URL must be supplied by the author. This is the
 * project repository for now; do not replace it with a guessed URL.
 */
export const PAPER_URL = "https://github.com/payalchandak/value-prism";

/* -------------------------------------------------------------------------- */
/*  Layout                                                                    */
/* -------------------------------------------------------------------------- */

const MAX_D = 150;
/** Compact donuts are never smaller than this. */
const MIN_D = 56;
/** One row stays on one line while its donuts are at least this big. */
const READABLE_D = 84;
const MIN_GAP = 8;
const MAX_GAP = 28;
const KEY_FS = 12;
const KEY_LH = 16;
const SECTION_H = 16;
const CAP_FS = 11;
const CAP_LH = 13;
const ICON = 20;
const GAP_KEY = 12;
const GAP_LABEL = 8;
const ROW_GAP = 14;
const SECTION_GAP = 20;

const modelBelow = (capLines: number) => 6 + ICON + 4 + capLines * CAP_LH;
const physicianBelow = (capLines: number) => 4 + capLines * CAP_LH;

export interface Placed {
  profile: Profile;
  /** Top-left of the donut. */
  x: number;
  y: number;
  /** Width of the caption column around the donut. */
  colW: number;
  caption: string;
}

export interface GalleryLayout {
  D: number;
  keyY: number;
  keyH: number;
  modelsLabelY: number;
  physiciansLabelY: number;
  models: Placed[];
  physicians: Placed[];
}

const dominantCaption = (p: Profile) => {
  const v = dominantValue(p.priorities);
  return `${VALUES[v].name} ${percentText(p.priorities[v])}`;
};

const chunk = <T,>(items: readonly T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

/**
 * Both rows share one donut size, as large as fits. Each row wraps into
 * balanced lines (3 + 3 and 4 + 4 on a phone) rather than shrinking the donuts.
 */
export function layoutGallery(W: number, H: number, models: readonly Profile[], physicians: readonly Profile[]): GalleryLayout {
  const keyLines = Math.max(1, Math.ceil(measureText(KEY_LINE, KEY_FS, 400) / Math.max(W - 8, 1)));
  const keyH = keyLines * KEY_LH;

  const candidates = new Map<string, { D: number; mc: number; pc: number; lines: number }>();
  for (const ml of [1, 2, 3]) {
    for (const pl of [1, 2, 3]) {
      const mc = Math.ceil(models.length / ml);
      const pc = Math.ceil(physicians.length / pl);
      const mLines = Math.ceil(models.length / mc);
      const pLines = Math.ceil(physicians.length / pc);
      const fixed =
        keyH + GAP_KEY + 2 * (SECTION_H + GAP_LABEL) + SECTION_GAP + mLines * modelBelow(2) + pLines * physicianBelow(2) + (mLines + pLines - 2) * ROW_GAP;
      const wfit = (c: number) => (W - (c - 1) * MIN_GAP) / c;
      const D = Math.min(MAX_D, wfit(mc), wfit(pc), (H - fixed) / (mLines + pLines));
      candidates.set(`${mLines}/${pLines}`, { D, mc, pc, lines: mLines + pLines });
    }
  }
  const all = [...candidates.values()];
  const readable = all.filter((c) => c.D >= READABLE_D);
  const pool = readable.length > 0 ? readable : all;
  const best = pool.reduce((a, b) => {
    if (readable.length > 0 && a.lines !== b.lines) return a.lines < b.lines ? a : b;
    return a.D >= b.D ? a : b;
  });
  const D = Math.max(Math.min(best.D, MAX_D), MIN_D);

  const gapFor = (cols: number) => (cols > 1 ? Math.min(Math.max((W - cols * D) / (cols - 1), MIN_GAP), MAX_GAP) : 0);
  const capLinesFor = (items: readonly Profile[], cols: number) => {
    const colW = D + gapFor(cols) - 4;
    return Math.min(2, Math.max(1, ...items.map((p) => Math.ceil(measureText(dominantCaption(p), CAP_FS, 400) / colW))));
  };
  const mCap = capLinesFor(models, best.mc);
  const pCap = capLinesFor(physicians, best.pc);
  const mLinesN = Math.ceil(models.length / best.mc);
  const pLinesN = Math.ceil(physicians.length / best.pc);
  const mPitch = D + modelBelow(mCap) + ROW_GAP;
  const pPitch = D + physicianBelow(pCap) + ROW_GAP;
  const total =
    keyH + GAP_KEY + 2 * (SECTION_H + GAP_LABEL) + SECTION_GAP + mLinesN * mPitch - ROW_GAP + pLinesN * pPitch - ROW_GAP;
  let y = Math.max(0, (H - total) / 2);

  const keyY = y;
  y += keyH + GAP_KEY;
  const modelsLabelY = y;
  y += SECTION_H + GAP_LABEL;
  const place = (items: readonly Profile[], cols: number, rowY: number, pitch: number): Placed[] => {
    const gap = gapFor(cols);
    return chunk(items, cols).flatMap((line, li) => {
      const lineW = line.length * D + (line.length - 1) * gap;
      return line.map((profile, k) => ({
        profile,
        x: (W - lineW) / 2 + k * (D + gap),
        y: rowY + li * pitch,
        colW: D + gap - 4,
        caption: dominantCaption(profile),
      }));
    });
  };
  const placedModels = place(models, best.mc, y, mPitch);
  y += mLinesN * mPitch - ROW_GAP + SECTION_GAP;
  const physiciansLabelY = y;
  y += SECTION_H + GAP_LABEL;
  const placedPhysicians = place(physicians, best.pc, y, pPitch);
  return { D, keyY, keyH, modelsLabelY, physiciansLabelY, models: placedModels, physicians: placedPhysicians };
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition active:scale-[0.98]";

export default function ModelsAndPhysicians({
  models,
  anchorKey,
  physicians,
  elapsedMs,
  onReplay,
  showHeader = true,
}: {
  /** Restart the whole demo (the player's `ctx.restart`). */
  onReplay: () => void;
  /** False when the stage supplies the headline. */
  showHeader?: boolean;
  /** Row 1, in display order. */
  models: readonly Profile[];
  /** The model held at the end of the previous chapter; its donut flies to its slot. */
  anchorKey: string;
  /** Row 2, in display order. Individual physicians only. */
  physicians: readonly Profile[];
  elapsedMs: number;
}) {
  // Hard guard: the pooled physician profile must never be drawn here.
  assertIndividualPhysicians(physicians);
  const anchorIndex = models.findIndex((m) => m.key === anchorKey);
  if (anchorIndex < 0) throw new Error(`Anchor model "${anchorKey}" is not in the model row.`);
  const anchor = models[anchorIndex];

  useFontEpoch();
  const body = useRef<HTMLDivElement>(null);
  const { width: W, height: H } = useBox(body);
  const [hovered, setHovered] = useState<string | null>(null);

  const e = Math.max(0, elapsedMs);
  const T = GALLERY_TIMING;
  const q = ramp(e, GALLERY_STARTS.question, T.questionFadeMs);
  const rowsOpacity = 1 - (1 - T.dimmedOpacity) * q;
  const fly = easeInOut(ramp(e, T.flyDelayMs, T.flyMs - T.flyDelayMs));
  const landed = e >= T.flyMs;
  const labelFade = 1 - ramp(e, 0, T.flyLabelFadeMs);

  const layout = W > 0 && H > 0 ? layoutGallery(W, H, models, physicians) : null;

  // The held hero donut's frame: the same one the previous chapter measured. Its labels fade in
  // place; its ring then shrinks and flies to its slot.
  const heroH = Math.max(H - HERO_CHROME, 0);
  let flier = null;
  if (layout && !landed && heroH > 0) {
    const scene = donutScene({ from: anchor.priorities, to: anchor.priorities, t: 0, mode: "hero", width: W, height: heroH });
    const slot = layout.models[anchorIndex];
    const scale = lerp(1, layout.D / 2 / scene.R, fly);
    const dx = lerp(0, slot.x + layout.D / 2 - scene.cx, fly);
    const dy = lerp(0, slot.y + layout.D / 2 - scene.cy, fly);
    // One svg, so the ring is drawn at exactly the coordinates the hero uses.
    flier = (
      <svg aria-hidden="true" className="absolute left-0 top-0 block" width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <g transform={`translate(${scene.cx + dx} ${scene.cy + dy}) scale(${scale}) translate(${-scene.cx} ${-scene.cy})`}>
          <SegmentPaths scene={scene} />
        </g>
        <HeroText scene={scene} opacity={labelFade} />
      </svg>
    );
  }

  const shown = hovered && q < 0.5 ? [...(layout?.models ?? []), ...(layout?.physicians ?? [])].find((it) => it.profile.key === hovered) : undefined;

  /** The held model's donut is whole the moment it lands (`donutOpacity`); its icon, name and caption fade in with `opacity`. */
  const item = (it: Placed, opacity: number, isModel: boolean, donutOpacity = opacity) => {
    const { profile } = it;
    const logo = isModel ? modelLogo(profile) : null;
    return (
      <div
        key={profile.key}
        data-gallery-item={profile.key}
        className="absolute flex flex-col items-center"
        style={{ left: it.x + layout!.D / 2 - it.colW / 2, top: it.y, width: it.colW }}
        onMouseEnter={() => setHovered(profile.key)}
        onMouseLeave={() => setHovered((h) => (h === profile.key ? null : h))}
        onClick={() => setHovered((h) => (h === profile.key ? null : profile.key))}
      >
        <div style={{ opacity: donutOpacity }}>
          <Donut from={profile.priorities} to={profile.priorities} t={0} mode="compact" size={layout!.D} />
        </div>
        {logo && (
          <div className="mt-1.5 flex items-center gap-1.5" style={{ opacity }}>
            <ProviderIcon src={logo.src} alt={logo.alt} size={ICON} />
            <span className="whitespace-nowrap text-xs font-semibold text-[#1B2433]">{profile.displayName}</span>
          </div>
        )}
        <span className="mt-1 text-balance text-center text-[11px] leading-[13px] text-gray-500" style={{ opacity }}>
          {it.caption}
        </span>
      </div>
    );
  };

  return (
    <div className="flex h-full w-full flex-col">
      {showHeader && <EndingHeader label="Models and physicians" />}

      <div ref={body} className="relative min-h-0 flex-1">
        {layout && (
          <div className="absolute inset-0" style={{ opacity: rowsOpacity }} aria-hidden={q > 0.5}>
            <p
              className="absolute inset-x-0 text-balance text-center text-xs leading-4 text-gray-500"
              style={{ top: layout.keyY, opacity: ramp(e, 0, T.captionFadeMs) }}
            >
              {KEY_LINE}
            </p>
            <h2
              className="absolute inset-x-0 text-center font-mono text-[11px] uppercase leading-4 tracking-widest text-gray-400"
              style={{ top: layout.modelsLabelY, opacity: ramp(e, 0, T.captionFadeMs) }}
            >
              {MODELS_CAPTION}
            </h2>
            <h2
              className="absolute inset-x-0 text-center font-mono text-[11px] uppercase leading-4 tracking-widest text-gray-400"
              style={{ top: layout.physiciansLabelY, opacity: ramp(e, GALLERY_STARTS.physicians, T.captionFadeMs) }}
            >
              {PHYSICIANS_CAPTION}
            </h2>

            {layout.models.map((it, i) =>
              it.profile.key === anchorKey
                ? item(it, ramp(e, T.flyMs, T.itemFadeMs), true, landed ? 1 : 0)
                : item(it, itemIn(e, GALLERY_STARTS.models, i), true),
            )}
            {layout.physicians.map((it, i) => item(it, itemIn(e, GALLERY_STARTS.physicians, i), false))}

            {shown && (
              <dl
                className="pointer-events-none absolute z-10 w-36 rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-sm"
                style={{
                  left: Math.min(Math.max(shown.x + layout.D / 2 - 72, 2), Math.max(2, W - 146)),
                  top: shown.y > H / 2 ? Math.max(2, shown.y - 84) : shown.y + layout.D + 6,
                }}
              >
                {VALUE_ORDER.map((v) => (
                  <div key={v} className="flex justify-between gap-3 leading-5">
                    <dt className="text-gray-500">{VALUES[v].name}</dt>
                    <dd className="font-semibold tabular-nums text-[#1B2433]">{percentText(shown.profile.priorities[v])}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}

        {/* The donut held at the end of the last chapter, shrinking and flying to its slot. */}
        {flier && (
          <div className="pointer-events-none absolute inset-0" style={{ opacity: rowsOpacity }}>
            {flier}
            <div className="absolute inset-x-0 bottom-0 grid place-items-center" style={{ height: HERO_CHROME, opacity: labelFade }}>
              <ModelLabel profile={anchor} iconSize={HERO_ICON} large stacked />
            </div>
          </div>
        )}

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
              onMouseDown={(ev) => ev.preventDefault()} // keep focus off the button so Space stays global
              onClick={onReplay}
              className={`${buttonBase} border border-line bg-white text-[#1B2433] hover:bg-gray-50`}
            >
              <span aria-hidden="true">↺</span>
              Replay
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
