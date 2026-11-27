import { useId, useLayoutEffect } from "react";
import { isMotionValue, motion, useMotionValue, useTransform } from "framer-motion";
import type { MotionValue } from "framer-motion";
import type { Value } from "../study/types";
import { NEUTRAL, VALUES, VALUE_COLORS, VALUE_ORDER, valueInk } from "../design";

/* -------------------------------------------------------------------------- */
/*  Public API                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Radial length of one axis: a plain number, or a MotionValue to animate it.
 * Either way the number is a priority on the fixed 0 to `RADAR_SCALE_MAX` scale.
 */
export type RadarLength = number | MotionValue<number>;

export type RadarChartMode = "full" | "compact";

export interface RadarChartProps {
  /**
   * One radial length per value.
   *
   * - Numbers: drawn as given. Missing, non-finite, or out-of-range numbers
   *   draw nothing and show "Invalid data" (never clamped or renormalized).
   * - MotionValues: the polygon and dots follow them frame by frame with no
   *   React re-renders. They cannot be checked up front, so each frame's value
   *   is clamped to the chart's scale (non-finite becomes 0). Springs that
   *   overshoot therefore stop at the outer ring instead of leaving the plot.
   * - Numbers and MotionValues can be mixed per axis.
   */
  priorities: Readonly<Record<Value, RadarLength>>;
  /** Accessible name of the chart. */
  title: string;
  /** Accessible description (whose priorities, what they mean). */
  description: string;
  /**
   * `full`: value names and four reference rings with scale labels.
   * `compact`: A / B / N / J letters, two rings, no scale labels.
   */
  mode?: RadarChartMode;
  className?: string;
}

/** A priority of this value reaches the outer ring. Identical for every chart. */
export const RADAR_SCALE_MAX = 1;

/** Fixed axis order and direction (SVG degrees, 0 = right, 90 = down). A at the top, then clockwise. */
export const RADAR_AXES: readonly { value: Value; angle: number }[] = [
  { value: "A", angle: -90 },
  { value: "B", angle: 0 },
  { value: "N", angle: 90 },
  { value: "J", angle: 180 },
];

/* -------------------------------------------------------------------------- */
/*  Fixed geometry                                                            */
/* -------------------------------------------------------------------------- */

interface Geometry {
  /** Pixels (viewBox units) from center to the outer ring. */
  radius: number;
  fontSize: number;
  dotRadius: number;
  labelGap: number;
  /** Room for the left (J) and right (B) labels. Same on both sides so the plot is centered. */
  sideLabelWidth: number;
  padding: number;
  rings: readonly number[];
  showRingLabels: boolean;
  strokeWidth: number;
}

const GEOMETRY: Record<RadarChartMode, Geometry> = {
  full: {
    radius: 104,
    fontSize: 13,
    dotRadius: 5,
    labelGap: 12,
    // "Beneficence" at 13px/600 is about 80 wide; slack for fallback fonts.
    sideLabelWidth: 86,
    padding: 6,
    rings: [0.25, 0.5, 0.75, 1],
    showRingLabels: true,
    strokeWidth: 1.5,
  },
  compact: {
    radius: 38,
    fontSize: 13,
    dotRadius: 3.25,
    labelGap: 8,
    sideLabelWidth: 10,
    padding: 4,
    rings: [0.5, 1],
    showRingLabels: false,
    strokeWidth: 1.25,
  },
};

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** Fraction of the radius for a priority; always inside the plot. */
const toFraction = (priority: number): number =>
  Number.isFinite(priority) ? Math.min(1, Math.max(0, priority / RADAR_SCALE_MAX)) : 0;

const formatNumber = (n: number): string => String(Number(n.toFixed(3)));

/* -------------------------------------------------------------------------- */
/*  Hooks and parts                                                           */
/* -------------------------------------------------------------------------- */

/** Normalizes a number-or-MotionValue into a MotionValue (one render path for both). */
function useLength(input: RadarLength): MotionValue<number> {
  const own = useMotionValue(typeof input === "number" ? input : 0);
  useLayoutEffect(() => {
    if (typeof input === "number") own.set(input);
  }, [input, own]);
  return isMotionValue(input) ? input : own;
}

interface Frame {
  cx: number;
  cy: number;
  radius: number;
}

const vertexX = (f: Frame, angle: number, length: number): number =>
  f.cx + f.radius * toFraction(length) * Math.cos(toRadians(angle));
const vertexY = (f: Frame, angle: number, length: number): number =>
  f.cy + f.radius * toFraction(length) * Math.sin(toRadians(angle));

function VertexDot({
  length,
  value,
  angle,
  frame,
  r,
}: {
  length: MotionValue<number>;
  value: Value;
  angle: number;
  frame: Frame;
  r: number;
}) {
  const cx = useTransform(length, (l) => vertexX(frame, angle, l));
  const cy = useTransform(length, (l) => vertexY(frame, angle, l));
  return (
    <motion.circle
      cx={cx}
      cy={cy}
      r={r}
      fill={VALUE_COLORS[value]}
      stroke={NEUTRAL.surface}
      strokeWidth={1.5}
      data-value={value}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Four-axis radar chart of one decision-maker's priorities.
 *
 * - Axes are always A, B, N, J (top, right, bottom, left); never data-driven.
 * - The scale is fixed (outer ring = `RADAR_SCALE_MAX`) and the plot sits at
 *   the same place every time, so charts are directly comparable.
 * - The polygon is neutral; only the vertex dots and axis labels use value colors.
 * - Every radial length may be a MotionValue for animation.
 *
 * Responsive SVG: it scales with its container's width.
 */
export default function RadarChart({
  priorities,
  title,
  description,
  mode = "full",
  className,
}: RadarChartProps) {
  const uid = useId();
  const titleId = `${uid}-title`;
  const descId = `${uid}-desc`;

  const g = GEOMETRY[mode];
  const compact = mode === "compact";

  // Fixed viewBox: depends only on `mode`, never on data.
  const reserveX = g.radius + g.labelGap + g.sideLabelWidth + g.padding;
  const reserveY = g.radius + g.labelGap + g.fontSize + g.padding;
  const frame: Frame = { cx: reserveX, cy: reserveY, radius: g.radius };
  const width = reserveX * 2;
  const height = reserveY * 2;

  const lengthA = useLength(priorities.A);
  const lengthB = useLength(priorities.B);
  const lengthN = useLength(priorities.N);
  const lengthJ = useLength(priorities.J);
  const lengths: Record<Value, MotionValue<number>> = {
    A: lengthA,
    B: lengthB,
    N: lengthN,
    J: lengthJ,
  };

  const polygonPoints = useTransform(
    [lengthA, lengthB, lengthN, lengthJ],
    (latest: number[]) =>
      RADAR_AXES.map(
        ({ angle }, i) =>
          `${vertexX(frame, angle, latest[i]).toFixed(2)},${vertexY(frame, angle, latest[i]).toFixed(2)}`,
      ).join(" "),
  );

  // Validation applies to plain numbers only (see `priorities` docs).
  const invalid = VALUE_ORDER.filter((v) => {
    const input: unknown = priorities[v];
    if (isMotionValue(input)) return false;
    return typeof input !== "number" || !Number.isFinite(input) || input < 0 || input > RADAR_SCALE_MAX;
  });
  const valid = invalid.length === 0;
  const animated = VALUE_ORDER.some((v) => isMotionValue(priorities[v]));

  const summary = !valid
    ? `Chart not drawn because the data are invalid for: ${invalid.map((v) => VALUES[v].name).join(", ")}.`
    : animated
      ? "Values animate."
      : `Priorities on a 0 to ${RADAR_SCALE_MAX} scale: ${VALUE_ORDER.map(
          (v) => `${VALUES[v].name} ${formatNumber(priorities[v] as number)}`,
        ).join(", ")}.`;

  const ringPoints = (fraction: number): string =>
    RADAR_AXES.map(
      ({ angle }) =>
        `${(frame.cx + g.radius * fraction * Math.cos(toRadians(angle))).toFixed(2)},${(
          frame.cy +
          g.radius * fraction * Math.sin(toRadians(angle))
        ).toFixed(2)}`,
    ).join(" ");

  const labelPosition = (angle: number) => {
    const tipX = frame.cx + g.radius * Math.cos(toRadians(angle));
    const tipY = frame.cy + g.radius * Math.sin(toRadians(angle));
    switch (angle) {
      case -90:
        return { x: tipX, y: tipY - g.labelGap, anchor: "middle", dy: "0" } as const;
      case 90:
        return { x: tipX, y: tipY + g.labelGap + g.fontSize * 0.8, anchor: "middle", dy: "0" } as const;
      case 0:
        return { x: tipX + g.labelGap, y: tipY, anchor: "start", dy: "0.35em" } as const;
      default:
        return { x: tipX - g.labelGap, y: tipY, anchor: "end", dy: "0.35em" } as const;
    }
  };

  return (
    <svg
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
      viewBox={`0 0 ${width} ${height}`}
      className={`block h-auto w-full ${className ?? ""}`.trim()}
      data-mode={mode}
    >
      <title id={titleId}>{title}</title>
      <desc id={descId}>{`${description} ${summary}`}</desc>

      {/* Reference rings (diamonds, matching the polygon's straight edges). */}
      {g.rings.map((ring) => (
        <polygon
          key={ring}
          points={ringPoints(ring)}
          fill="none"
          stroke={ring === 1 ? NEUTRAL.axis : NEUTRAL.ring}
          strokeWidth={0.75}
        />
      ))}

      {/* Axes. */}
      {RADAR_AXES.map(({ value, angle }) => (
        <line
          key={value}
          x1={frame.cx}
          y1={frame.cy}
          x2={frame.cx + g.radius * Math.cos(toRadians(angle))}
          y2={frame.cy + g.radius * Math.sin(toRadians(angle))}
          stroke={NEUTRAL.axis}
          strokeWidth={0.75}
        />
      ))}

      {/* Scale labels on the A-B edge of each ring. */}
      {g.showRingLabels &&
        g.rings.map((ring) => (
          <text
            key={ring}
            x={frame.cx + (g.radius * ring) / 2 + 3}
            y={frame.cy - (g.radius * ring) / 2 - 2}
            fontSize={10}
            fill={NEUTRAL.inkFaint}
            stroke={NEUTRAL.surface}
            strokeWidth={3}
            paintOrder="stroke"
            aria-hidden="true"
          >
            {formatNumber(ring * RADAR_SCALE_MAX)}
          </text>
        ))}

      {/* Data shape: neutral fill and outline, with value-colored vertex dots. */}
      {valid ? (
        <>
          <motion.polygon
            points={polygonPoints}
            fill={NEUTRAL.polygonFill}
            stroke={NEUTRAL.polygonStroke}
            strokeWidth={g.strokeWidth}
            strokeLinejoin="round"
          />
          {RADAR_AXES.map(({ value, angle }) => (
            <VertexDot
              key={value}
              length={lengths[value]}
              value={value}
              angle={angle}
              frame={frame}
              r={g.dotRadius}
            />
          ))}
        </>
      ) : (
        <text
          x={frame.cx}
          y={frame.cy}
          textAnchor="middle"
          dy="0.35em"
          fontSize={compact ? 9 : 13}
          fontWeight={600}
          fill={NEUTRAL.inkFaint}
          stroke={NEUTRAL.surface}
          strokeWidth={4}
          paintOrder="stroke"
          aria-hidden="true"
        >
          Invalid data
        </text>
      )}

      {/* Axis labels at the fixed tips. */}
      {RADAR_AXES.map(({ value, angle }) => {
        const pos = labelPosition(angle);
        return (
          <text
            key={value}
            x={pos.x}
            y={pos.y}
            dy={pos.dy}
            textAnchor={pos.anchor}
            fontSize={g.fontSize}
            fontWeight={600}
            style={{ fill: valueInk(value) }}
          >
            {compact && <title>{VALUES[value].name}</title>}
            {compact ? VALUES[value].letter : VALUES[value].name}
          </text>
        );
      })}
    </svg>
  );
}
