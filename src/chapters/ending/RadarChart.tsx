/**
 * LOCAL STUB of the shared radar chart, used only by the ending chapters.
 *
 * The real chart will live at `src/components/RadarChart` and take exactly
 * these props. (The file at that path today has an older API, so it cannot be
 * imported yet.) Every ending file imports from `./RadarChart`; once the
 * primitives branch lands, replace this file's body with
 *
 *   export { default } from "../../components/RadarChart";
 *
 * and delete the rest.
 *
 * Contract the stub honors, which the real chart must too:
 *  - every chart uses the same fixed 0–1 radial scale and the same axes, so
 *    shapes are directly comparable and never rescaled to their own maximum;
 *  - axis order is the paper's: B top, A right, J bottom, N left;
 *  - labels are the single letters A / B / N / J at every size, so the chart
 *    scales cleanly as one object (the chapters show a legend with full names).
 */

import type { Value } from "../../study/types";

export interface RadarChartProps {
  priorities: Record<Value, number>;
  /** Outer width and height in px. */
  size?: number;
  /** Outline and fill color of the data shape. */
  color?: string;
}

const AXES: readonly { id: Value; angle: number }[] = [
  { id: "B", angle: -90 },
  { id: "A", angle: 0 },
  { id: "J", angle: 90 },
  { id: "N", angle: 180 },
];

/** Stub-only copy of the design tokens' value colors. */
const VALUE_COLORS: Record<Value, string> = {
  A: "#2F6DB5",
  B: "#A26710",
  N: "#187C76",
  J: "#7B4FA8",
};

const VIEW = 100;
const C = VIEW / 2;
const R = 33; // radius of priority = 1

const rad = (deg: number) => (deg * Math.PI) / 180;
const at = (angle: number, fraction: number) => ({
  x: C + R * fraction * Math.cos(rad(angle)),
  y: C + R * fraction * Math.sin(rad(angle)),
});
const poly = (fractions: readonly number[]) =>
  AXES.map(({ angle }, i) => {
    const p = at(angle, fractions[i]);
    return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  }).join(" ");

export default function RadarChart({
  priorities,
  size = 200,
  color = "#475569",
}: RadarChartProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      role="img"
      aria-label={`Priorities: ${AXES.map(({ id }) => `${id} ${priorities[id].toFixed(2)}`).join(", ")}`}
      className="block"
    >
      {[0.5, 1].map((ring) => (
        <polygon
          key={ring}
          points={poly(AXES.map(() => ring))}
          fill="none"
          stroke={ring === 1 ? "#CBD5E1" : "#E2E8F0"}
          strokeWidth={0.6}
        />
      ))}
      {AXES.map(({ id, angle }) => {
        const tip = at(angle, 1);
        return <line key={id} x1={C} y1={C} x2={tip.x} y2={tip.y} stroke="#CBD5E1" strokeWidth={0.6} />;
      })}
      <polygon
        points={poly(AXES.map(({ id }) => priorities[id]))}
        fill={color}
        fillOpacity={0.16}
        stroke={color}
        strokeWidth={1.1}
        strokeLinejoin="round"
      />
      {AXES.map(({ id, angle }) => {
        const p = at(angle, priorities[id]);
        return <circle key={id} cx={p.x} cy={p.y} r={1.2} fill={color} />;
      })}
      {AXES.map(({ id, angle }) => {
        const tip = at(angle, 1);
        const label = at(angle, 1.3);
        return (
          <g key={id}>
            <circle cx={tip.x} cy={tip.y} r={1.8} fill={VALUE_COLORS[id]} stroke="#fff" strokeWidth={0.6} />
            <text
              x={label.x}
              y={label.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={7}
              fontWeight={600}
              fill={VALUE_COLORS[id]}
            >
              {id}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
