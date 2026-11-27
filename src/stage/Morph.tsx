import { useLayoutEffect, useRef, useState } from "react";
import {
  RADAR_AXES,
  RADAR_FILL,
  RADAR_FONT,
  RADAR_INK,
  RADAR_MUTED,
  RADAR_STYLE,
  percentText,
  placeAxisLabel,
  placeEqualWeight,
  radarMetrics,
  radarRingPoints,
  topValue,
  useRadarFontEpoch,
} from "../components/RadarChart";
import { NEUTRAL, VALUES, VALUE_COLORS, VALUE_ORDER, valueInk } from "../design";
import Radar, { RADAR_ASPECT } from "../chapters/ending/Radar";
import { individualRadarWidth } from "../chapters/ending/IndividualModels";
import { clamp01, easeInOut, Legend, ModelLabel, useElementSize } from "../chapters/ending/shared";
import type { Profile } from "../study/types";
import { beatStart } from "../types";
import { MORPH_HANDOFF_MS, MORPH_RESOLVE_MS, morphBeats } from "./morphBeats";

/* The radar's own fixed frame (see RadarChart GEOMETRY.full), in viewBox units. */
const W = 416;
const H = 270;
const CX = W / 2;
const CY = H / 2;
const R = 104;

if (
  W !== radarMetrics.full.width ||
  H !== radarMetrics.full.height ||
  CX !== radarMetrics.full.cx ||
  CY !== radarMetrics.full.cy ||
  R !== radarMetrics.full.radius
) {
  throw new Error("Morph radar frame does not match RadarChart.");
}

/** Bar layout before rotating: fallback left edge, row pitch, thickness, and the length of a priority of 1. */
const BAR_X = 104;
const BAR_PITCH = 40;
const BAR_THICK = 16;
const BAR_TRACK = 230;
const STEM_THICK = 3;
const LABEL_INSET = 8;
const LABEL_GAP = 8;

/** Small line under the four priority bars. Fades with the bar labels. */
const BAR_SUBCAPTION = "Relative priorities across the four values.";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const span = (t: number, from: string, to: string) =>
  clamp01((t - beatStart(morphBeats, from)) / (beatStart(morphBeats, to) - beatStart(morphBeats, from)));

const rad = (deg: number) => (deg * Math.PI) / 180;

let measureCanvas: CanvasRenderingContext2D | null = null;
const textWidth = (text: string, font: string) => {
  if (!measureCanvas) measureCanvas = document.createElement("canvas").getContext("2d");
  if (!measureCanvas) return 0;
  measureCanvas.font = font;
  return measureCanvas.measureText(text).width;
};
const svgLength = (svg: SVGSVGElement | null, selector: string) => {
  if (!svg) return 0;
  let max = 0;
  for (const node of svg.querySelectorAll<SVGTextElement>(selector)) {
    try {
      max = Math.max(max, node.getComputedTextLength());
    } catch {
      /* not laid out yet */
    }
  }
  return max;
};

/**
 * The four normalized priority bars rotate onto the radar's axes, the polygon
 * draws, and the whole thing resolves into the profile's real radar (the same
 * chart, size and position the first individual profile uses).
 */
export default function Morph({
  profile,
  elapsedMs,
  barGrow = 1,
}: {
  profile: Profile;
  elapsedMs: number;
  /** 0..1 length of the horizontal bars. The stage leaves this at 1. */
  barGrow?: number;
}) {
  useRadarFontEpoch();
  const t = Math.max(0, elapsedMs);
  const viewport = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const { width, height } = useElementSize(viewport);
  const radarWidth = individualRadarWidth(width, height);
  // Label column is the longest value name, in viewBox units, so it fits at every scale.
  const [labelWidth, setLabelWidth] = useState(0);
  const [percentWidth, setPercentWidth] = useState(0);
  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const read = () => {
      const names = VALUE_ORDER.map((v) => VALUES[v].name);
      const percents = VALUE_ORDER.map((v) => `${Math.round(profile.priorities[v] * 100)}%`);
      const lw = Math.max(svgLength(svg, "[data-bar-label]"), names.reduce((max, name) => Math.max(max, textWidth(name, "600 13px Inter")), 0));
      const pw = Math.max(
        svgLength(svg, "[data-bar-percent]"),
        percents.reduce((max, label) => Math.max(max, textWidth(label, "400 12px Inter")), 0),
      );
      if (lw > 0) setLabelWidth((w) => (Math.abs(w - lw) < 0.5 ? w : lw));
      if (pw > 0) setPercentWidth((w) => (Math.abs(w - pw) < 0.5 ? w : pw));
    };
    read();
    let cancel = false;
    document.fonts?.ready.then(() => {
      if (!cancel) read();
    });
    return () => {
      cancel = true;
    };
  }, [width, height, profile]);

  const barX = labelWidth > 0 ? LABEL_INSET + labelWidth + LABEL_GAP : BAR_X;
  const barTrack =
    labelWidth > 0 && percentWidth > 0
      ? Math.max(48, W - barX - LABEL_GAP - percentWidth - LABEL_INSET)
      : BAR_TRACK;

  const enter = clamp01(t / MORPH_HANDOFF_MS);
  const rotate = easeInOut(span(t, "rotate", "polygon"));
  const polygon = easeInOut(span(t, "polygon", "resolve"));
  const resolve = clamp01((t - beatStart(morphBeats, "resolve")) / MORPH_RESOLVE_MS);

  const rows = VALUE_ORDER.map((v, i) => {
    const p = profile.priorities[v];
    const axis = RADAR_AXES.find((a) => a.value === v)!.angle;
    const ox = lerp(barX, CX, rotate);
    const oy = lerp(CY + (i - 1.5) * BAR_PITCH, CY, rotate);
    const angle = lerp(0, axis, rotate);
    const length = lerp(p * barTrack, p * R, rotate) * barGrow;
    const tipX = CX + p * R * Math.cos(rad(axis));
    const tipY = CY + p * R * Math.sin(rad(axis));
    return { v, p, axis, ox, oy, angle, length, tipX, tipY, rowY: CY + (i - 1.5) * BAR_PITCH };
  });

  const polyPoints = rows.map((r) => `${r.tipX.toFixed(2)},${r.tipY.toFixed(2)}`).join(" ");
  const ringOpacity = clamp01(rotate / 0.5);
  const textOpacity = 1 - clamp01(rotate / 0.35);
  const stemOpacity = 1 - clamp01((polygon - 0.5) / 0.5);
  // While bars grow in over a fading table, hold the words back until the rows are gone.
  const labelMix = barGrow < 1 ? Math.max(0, (barGrow - 0.45) / 0.55) : 1;

  const top = topValue(profile.priorities);
  const equalWeight = placeEqualWeight(profile.priorities);
  const full = RADAR_STYLE.full;

  return (
    <div className="flex h-full w-full flex-col">
      <div ref={viewport} className="relative min-h-0 flex-1 overflow-hidden">
        <div
          className="absolute inset-x-0 top-0 flex flex-col items-center justify-center gap-3"
          style={{ height }}
        >
          <div className="relative" style={{ width: radarWidth, height: radarWidth * RADAR_ASPECT.full }}>
            <div style={{ opacity: resolve }}>
              <Radar profile={profile} width={radarWidth} mode="full" progress={1} />
            </div>
            <svg
              ref={svgRef}
              aria-hidden="true"
              viewBox={`0 0 ${W} ${H}`}
              className="absolute inset-0 block h-full w-full"
              style={{ opacity: (1 - resolve) * enter }}
              data-testid="morph-svg"
            >
              <g style={{ opacity: ringOpacity }}>
                <polygon
                  points={radarRingPoints("full", 1)}
                  fill="none"
                  stroke={RADAR_INK}
                  strokeOpacity={full.outerOpacity}
                  strokeWidth={1}
                />
                <polygon
                  points={radarRingPoints("full", 0.25)}
                  fill="none"
                  stroke={RADAR_INK}
                  strokeOpacity={full.dashOpacity}
                  strokeWidth={1}
                  strokeDasharray={full.dash}
                />
                {rows.map((r) => {
                  const emphasized = r.v === top;
                  return (
                    <line
                      key={r.v}
                      x1={CX}
                      y1={CY}
                      x2={r.tipX}
                      y2={r.tipY}
                      stroke={RADAR_INK}
                      strokeWidth={emphasized ? full.spokeTop : full.spokeRest}
                      strokeOpacity={emphasized ? 1 : full.spokeRestOpacity}
                      strokeLinecap="round"
                    />
                  );
                })}
                {rows.map((r) => {
                  const emphasized = r.v === top;
                  const pct = percentText(r.p);
                  const place = placeAxisLabel("full", r.v, emphasized, pct);
                  const name = VALUES[r.v].name;
                  const shared = {
                    textAnchor: place.anchor,
                    fontFamily: RADAR_FONT,
                    fontSize: place.fontSize,
                    fontWeight: place.fontWeight,
                    fill: place.fill,
                  } as const;
                  return place.stacked ? (
                    <g key={r.v}>
                      <text x={place.x} y={place.splitY - 1} dominantBaseline="text-after-edge" {...shared}>
                        {name}
                      </text>
                      <text x={place.x} y={place.splitY + 1} dominantBaseline="text-before-edge" {...shared}>
                        {pct}
                      </text>
                    </g>
                  ) : (
                    <text key={r.v} x={place.x} y={place.y} dominantBaseline={place.baseline} {...shared}>
                      {name} {pct}
                    </text>
                  );
                })}
                <text
                  x={equalWeight.x}
                  y={equalWeight.y}
                  textAnchor="start"
                  dominantBaseline="middle"
                  fontFamily={RADAR_FONT}
                  fontSize={10}
                  fontWeight={500}
                  fill={RADAR_MUTED}
                  stroke={NEUTRAL.surface}
                  strokeWidth={3}
                  paintOrder="stroke"
                >
                  equal weight
                </text>
              </g>

              {/* Bars, then stems: the same four shapes rotating about their start. */}
              <g style={{ opacity: stemOpacity }}>
                {rows.map((r) => (
                  <g key={r.v} transform={`translate(${r.ox} ${r.oy}) rotate(${r.angle})`}>
                    <rect
                      x={0}
                      y={-lerp(BAR_THICK, STEM_THICK, rotate) / 2}
                      width={r.length}
                      height={lerp(BAR_THICK, STEM_THICK, rotate)}
                      rx={lerp(4, 1.5, rotate)}
                      fill={VALUE_COLORS[r.v]}
                    />
                  </g>
                ))}
              </g>

              <g style={{ opacity: textOpacity * labelMix }}>
                {rows.map((r) => (
                  <g key={r.v}>
                    <text
                      data-bar-label=""
                      x={barX - LABEL_GAP}
                      y={r.rowY}
                      dy="0.35em"
                      textAnchor="end"
                      fontSize={13}
                      fontWeight={600}
                      style={{ fill: valueInk(r.v) }}
                    >
                      {VALUES[r.v].name}
                    </text>
                    <text
                      data-bar-percent=""
                      x={barX + r.p * barTrack * barGrow + LABEL_GAP}
                      y={r.rowY}
                      dy="0.35em"
                      fontSize={12}
                      fill={NEUTRAL.inkMuted}
                    >
                      {Math.round(r.p * 100)}%
                    </text>
                  </g>
                ))}
              </g>

              {/* Polygon: outline draws, fill follows, charcoal dots arrive. */}
              <polygon
                points={polyPoints}
                fill={RADAR_FILL}
                stroke={RADAR_INK}
                strokeWidth={full.polygon}
                strokeLinejoin="round"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - polygon}
                style={{ fillOpacity: clamp01((polygon - 0.4) / 0.6) }}
              />
              {rows.map((r) => (
                <circle
                  key={r.v}
                  cx={r.tipX}
                  cy={r.tipY}
                  r={(r.v === top ? full.dotTop : full.dotRest) * clamp01(polygon * 2)}
                  fill={RADAR_INK}
                />
              ))}
            </svg>
            <p
              className="pointer-events-none absolute inset-x-0 text-center text-xs leading-snug text-gray-500"
              style={{
                top: ((CY + 1.5 * BAR_PITCH + 26) / H) * radarWidth * RADAR_ASPECT.full,
                opacity: textOpacity * labelMix,
              }}
            >
              {BAR_SUBCAPTION}
            </p>
          </div>
          <div style={{ opacity: resolve }}>
            {/* The stage's persistent icon lands on this slot as the radar resolves. */}
            <ModelLabel profile={profile} iconSize={40} large iconSlot />
          </div>
        </div>
      </div>

      {/* Same invisible legend spacer as the individual profiles, so both stage bodies match. */}
      <div className="pb-1 pt-3 opacity-0" aria-hidden="true">
        <Legend />
      </div>
    </div>
  );
}
