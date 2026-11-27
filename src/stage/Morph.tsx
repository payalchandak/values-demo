import { useRef } from "react";
import { RADAR_AXES } from "../components/RadarChart";
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

/** Bar layout before rotating: left edge, row pitch, thickness, and the length of a priority of 1. */
const BAR_X = 104;
const BAR_PITCH = 40;
const BAR_THICK = 16;
const BAR_TRACK = 230;
const STEM_THICK = 3;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const span = (t: number, from: string, to: string) =>
  clamp01((t - beatStart(morphBeats, from)) / (beatStart(morphBeats, to) - beatStart(morphBeats, from)));

const rad = (deg: number) => (deg * Math.PI) / 180;

/**
 * The four normalized priority bars rotate onto the radar's axes, the polygon
 * draws, and the whole thing resolves into the profile's real radar (the same
 * chart, size and position the first individual profile uses).
 */
export default function Morph({ profile, elapsedMs }: { profile: Profile; elapsedMs: number }) {
  const t = Math.max(0, elapsedMs);
  const viewport = useRef<HTMLDivElement>(null);
  const { width, height } = useElementSize(viewport);
  const radarWidth = individualRadarWidth(width, height);

  const enter = clamp01(t / MORPH_HANDOFF_MS);
  const rotate = easeInOut(span(t, "rotate", "polygon"));
  const polygon = easeInOut(span(t, "polygon", "resolve"));
  const resolve = clamp01((t - beatStart(morphBeats, "resolve")) / MORPH_RESOLVE_MS);

  const rows = VALUE_ORDER.map((v, i) => {
    const p = profile.priorities[v];
    const axis = RADAR_AXES.find((a) => a.value === v)!.angle;
    const ox = lerp(BAR_X, CX, rotate);
    const oy = lerp(CY + (i - 1.5) * BAR_PITCH, CY, rotate);
    const angle = lerp(0, axis, rotate);
    const length = lerp(p * BAR_TRACK, p * R, rotate);
    const tipX = CX + p * R * Math.cos(rad(axis));
    const tipY = CY + p * R * Math.sin(rad(axis));
    return { v, p, axis, ox, oy, angle, length, tipX, tipY, rowY: CY + (i - 1.5) * BAR_PITCH };
  });

  const polyPoints = rows.map((r) => `${r.tipX.toFixed(2)},${r.tipY.toFixed(2)}`).join(" ");
  const ringOpacity = clamp01(rotate / 0.5);
  const textOpacity = 1 - clamp01(rotate / 0.35);
  const stemOpacity = 1 - clamp01((polygon - 0.5) / 0.5);

  const ringPoints = (f: number) =>
    RADAR_AXES.map(
      ({ angle }) => `${(CX + R * f * Math.cos(rad(angle))).toFixed(2)},${(CY + R * f * Math.sin(rad(angle))).toFixed(2)}`,
    ).join(" ");

  return (
    <div className="flex h-full w-full flex-col">
      <div ref={viewport} className="relative min-h-0 flex-1 overflow-hidden">
        <div
          className="absolute inset-x-0 top-0 flex flex-col items-center justify-center gap-3"
          style={{ height }}
        >
          <div className="relative" style={{ width: radarWidth, height: radarWidth * RADAR_ASPECT.full }}>
            <div style={{ opacity: resolve }}>
              <Radar profile={profile} width={radarWidth} mode="full" />
            </div>
            <svg
              aria-hidden="true"
              viewBox={`0 0 ${W} ${H}`}
              className="absolute inset-0 block h-full w-full"
              style={{ opacity: (1 - resolve) * enter }}
              data-testid="morph-svg"
            >
              <g style={{ opacity: ringOpacity }}>
                {[0.25, 0.5, 0.75, 1].map((f) => (
                  <polygon
                    key={f}
                    points={ringPoints(f)}
                    fill="none"
                    stroke={f === 1 ? NEUTRAL.axis : NEUTRAL.ring}
                    strokeWidth={0.75}
                  />
                ))}
                {RADAR_AXES.map(({ value, angle }) => (
                  <line
                    key={value}
                    x1={CX}
                    y1={CY}
                    x2={CX + R * Math.cos(rad(angle))}
                    y2={CY + R * Math.sin(rad(angle))}
                    stroke={NEUTRAL.axis}
                    strokeWidth={0.75}
                  />
                ))}
                {RADAR_AXES.map(({ value, angle }) => {
                  const tx = CX + R * Math.cos(rad(angle));
                  const ty = CY + R * Math.sin(rad(angle));
                  const pos =
                    angle === -90
                      ? { x: tx, y: ty - 12, anchor: "middle", dy: "0" }
                      : angle === 90
                        ? { x: tx, y: ty + 12 + 13 * 0.8, anchor: "middle", dy: "0" }
                        : angle === 0
                          ? { x: tx + 12, y: ty, anchor: "start", dy: "0.35em" }
                          : { x: tx - 12, y: ty, anchor: "end", dy: "0.35em" };
                  return (
                    <text
                      key={value}
                      x={pos.x}
                      y={pos.y}
                      dy={pos.dy}
                      textAnchor={pos.anchor as "middle" | "start" | "end"}
                      fontSize={13}
                      fontWeight={600}
                      style={{ fill: valueInk(value) }}
                    >
                      {VALUES[value].name}
                    </text>
                  );
                })}
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

              <g style={{ opacity: textOpacity }}>
                {rows.map((r) => (
                  <g key={r.v}>
                    <text
                      x={BAR_X - 8}
                      y={r.rowY}
                      dy="0.35em"
                      textAnchor="end"
                      fontSize={13}
                      fontWeight={600}
                      style={{ fill: valueInk(r.v) }}
                    >
                      {VALUES[r.v].name}
                    </text>
                    <text x={BAR_X + r.p * BAR_TRACK + 8} y={r.rowY} dy="0.35em" fontSize={12} fill={NEUTRAL.inkMuted}>
                      {Math.round(r.p * 100)}%
                    </text>
                  </g>
                ))}
              </g>

              {/* Polygon: outline draws, fill follows, dots arrive in value colors. */}
              <polygon
                points={polyPoints}
                fill={NEUTRAL.polygonFill}
                stroke={NEUTRAL.polygonStroke}
                strokeWidth={1.5}
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
                  r={5 * clamp01(polygon * 2)}
                  fill={VALUE_COLORS[r.v]}
                  stroke={NEUTRAL.surface}
                  strokeWidth={1.5}
                />
              ))}
            </svg>
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
