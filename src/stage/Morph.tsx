import { useRef } from "react";
import {
  DONUT_INK,
  DONUT_MUTED,
  FONT_STACK,
  HeroText,
  LIGHT_OPACITY,
  SegmentPaths,
  DonutHole,
  bendStrip,
  bentSegmentPath,
  centerMarkSize,
  clamp01,
  dominantValue,
  donutScene,
  measureText,
  ringRadii,
  ringSpans,
  useBox,
  useFontEpoch,
} from "../components/Donut";
import { HERO_CHROME } from "../chapters/ending/IndividualModels";
import { easeInOut, ModelMark, ModelName } from "../chapters/ending/shared";
import { NEUTRAL, VALUES, VALUE_ORDER } from "../design";
import type { Profile } from "../study/types";
import { beatStart } from "../types";
import { MORPH_HANDOFF_MS, MORPH_TIMING, morphBeats } from "./morphBeats";

const TAU = Math.PI * 2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Priority bars: thickness, row pitch and the longest the bar track gets, before scaling. */
const BAR_THICK = 16;
const BAR_PITCH = 40;
const BAR_TRACK_MAX = 300;
const NAME_FS = 14;
const PERCENT_FS = 13;
const INSET = 8;
const GAP = 8;

/** Small line under the four priority bars. Fades with the bar labels. */
const BAR_SUBCAPTION = "Relative priorities across the four values.";

const at = (name: string) => beatStart(morphBeats, name);

/**
 * The regression chapter's four priority bars slide into one row and stack end
 * to end into a strip as long as the ring's circumference, the strip bends into
 * the ring, and names and percents fade in outside while the model mark lands
 * in the hole. The last frame is the hero donut, drawn by the same functions
 * the hero uses, in the same frame.
 *
 * The regression chapter also draws this at MORPH_HANDOFF_MS with `barGrow` to
 * grow the bars in, so the first frame here is exactly where that chapter ends.
 */
export default function Morph({
  profile,
  elapsedMs,
  barGrow = 1,
  names = 1,
  numbers = 1,
  barShare,
}: {
  profile: Profile;
  elapsedMs: number;
  /** 0..1 length of the horizontal bars. The stage leaves this at 1. */
  barGrow?: number;
  /** 0..1 opacity of the bar names, and of the percents with the line under the bars. */
  names?: number;
  numbers?: number;
  /** Shares the bars are drawn at (default: the profile's own priorities). The ring always uses the profile's. */
  barShare?: Profile["priorities"];
}) {
  useFontEpoch();
  const t = Math.max(0, elapsedMs);
  const viewport = useRef<HTMLDivElement>(null);
  const { width: W, height: H } = useBox(viewport);

  const p = profile.priorities;
  const share = barShare ?? p;
  const enter = clamp01(t / MORPH_HANDOFF_MS);
  const stackP = clamp01((t - at("stack")) / MORPH_TIMING.stackMs);
  // Bars first spread into their end-to-end places (staircase), then drop into one row.
  const xP = easeInOut(clamp01(stackP / 0.6));
  const yP = easeInOut(clamp01((stackP - 0.6) / 0.4));
  const bendP = easeInOut(clamp01((t - at("bend")) / MORPH_TIMING.bendMs));
  const labelP = easeInOut(clamp01((t - at("labels")) / MORPH_TIMING.labelsMs));
  const textOpacity = 1 - clamp01(xP * 2.5);
  const nameOpacity = textOpacity * names;
  const numberOpacity = textOpacity * numbers;

  let svg = null;
  let hole = null;
  if (W > 0 && H > 0) {
    const scene = donutScene({ from: p, to: p, t: 0, mode: "hero", width: W, height: H });
    const { cx, cy, R } = scene;
    const { rMid, thick } = ringRadii(R);
    const C = TAU * rMid;
    const spans = ringSpans(p);
    const top = dominantValue(p);
    const opacityOf = (v: (typeof VALUE_ORDER)[number]) => (v === top ? 1 : LIGHT_OPACITY);

    // Bar layout, centered on the frame.
    const s = Math.min(Math.max(W / 420, 1), 1.5);
    const f = Math.min(s, 1.25);
    const nameW = Math.max(...VALUE_ORDER.map((v) => measureText(VALUES[v].name, NAME_FS * f, 600)));
    const pctW = Math.max(...VALUE_ORDER.map((v) => measureText(`${Math.round(p[v] * 100)}%`, PERCENT_FS * f, 400)));
    const track = Math.min(Math.max(W - 2 * INSET - nameW - pctW - 2 * GAP, 48), BAR_TRACK_MAX * s);
    const barX = cx - (nameW + GAP + track + GAP + pctW) / 2 + nameW + GAP;
    const rowY = (i: number) => cy + (i - 1.5) * BAR_PITCH * s;
    const stripLeft = cx - C / 2;

    const bars = VALUE_ORDER.map((v, i) => {
      const span = spans[i];
      const len0 = share[v] * track * barGrow;
      const x = lerp(barX, stripLeft + span.u0 * C, xP);
      const len = lerp(len0, (span.u1 - span.u0) * C, xP);
      const y = lerp(rowY(i), cy, yP);
      const h = lerp(BAR_THICK * s, thick, easeInOut(stackP));
      return { v, i, x, len, y, h, rx: lerp(4, 0, easeInOut(stackP)) };
    });

    const drawBars = bendP <= 0;
    const drawBent = bendP > 0 && bendP < 1;
    const bend = drawBent ? bendStrip(bendP, R, cx, cy) : null;

    svg = (
      <svg
        aria-hidden="true"
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="absolute inset-0 block"
        style={enter < 1 ? { opacity: enter } : undefined}
        data-testid="morph-svg"
      >
        {drawBars &&
          bars.map((b) => (
            <rect key={b.v} x={b.x} y={b.y - b.h / 2} width={Math.max(b.len, 0)} height={b.h} rx={b.rx} fill={DONUT_INK} fillOpacity={opacityOf(b.v)} />
          ))}
        {bend &&
          spans.map((sp) => <path key={sp.value} d={bentSegmentPath(bend, sp.u0, sp.u1)} fill={DONUT_INK} fillOpacity={opacityOf(sp.value)} />)}
        {bendP >= 1 && <SegmentPaths scene={scene} />}

        {nameOpacity > 0 && (
          <g style={{ opacity: nameOpacity }} fontFamily={FONT_STACK}>
            {bars.map((b) => (
              <text
                key={b.v}
                data-anchor={`bar-name-${b.v}`}
                x={barX - GAP}
                y={rowY(b.i)}
                dy="0.35em"
                textAnchor="end"
                fontSize={NAME_FS * f}
                fontWeight={600}
                fill={DONUT_INK}
              >
                {VALUES[b.v].name}
              </text>
            ))}
          </g>
        )}
        {numberOpacity > 0 && (
          <g style={{ opacity: numberOpacity }} fontFamily={FONT_STACK}>
            {bars.map((b) => (
              <text key={b.v} x={barX + share[b.v] * track * barGrow + GAP} y={rowY(b.i)} dy="0.35em" fontSize={PERCENT_FS * f} fill={DONUT_MUTED}>
                {Math.round(p[b.v] * 100)}%
              </text>
            ))}
            <text x={cx} y={rowY(3) + 36 * s} textAnchor="middle" fontSize={12 * f} fill={NEUTRAL.inkFaint}>
              {BAR_SUBCAPTION}
            </text>
          </g>
        )}

        <HeroText scene={scene} opacity={labelP} />
      </svg>
    );
    // The slot stays mounted for the whole morph so the stage icon can fly into
    // the hole as the labels arrive. Its own opacity is the stage's.
    hole = (
      <DonutHole cx={scene.cx} cy={scene.cy} rIn={scene.rIn}>
        <ModelMark profile={profile} size={centerMarkSize(scene.rIn)} slot />
      </DonutHole>
    );
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div ref={viewport} className="relative min-h-0 flex-1">
        {svg}
        {hole}
      </div>
      <div className="grid shrink-0 place-items-center" style={{ height: HERO_CHROME, opacity: labelP }}>
        <ModelName profile={profile} large />
      </div>
    </div>
  );
}
