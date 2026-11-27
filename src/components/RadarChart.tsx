import { useId } from "react";
import type {
  NormalizedPriorities,
  PerValue,
  ValueDefinition,
  ValueId,
} from "../data/demoData";

export type RadarChartMode = "full" | "compact";

export interface RadarChartProps {
  /**
   * Normalized priorities for ONE decision-maker (not raw regression weights).
   * Plotted exactly as given on a fixed 0–1 radial scale: never renormalized,
   * never rescaled to the profile's own maximum, and 0 is a real value.
   * If any entry is missing, non-finite, or outside [0, 1], no shape is drawn
   * and the chart shows an explicit "Invalid data" state instead.
   */
  priorities: NormalizedPriorities;
  /** Source of axis labels and colors (see `valueDefinitions`). */
  values: PerValue<ValueDefinition>;
  /** Accessible name of the chart. */
  title: string;
  /** Accessible description of the chart (what it shows / whose priorities). */
  description: string;
  /**
   * `full`: full value names, four reference rings with scale labels.
   * `compact`: A / B / N / J letters, two rings, no scale labels.
   * Full names remain available to assistive technology in both modes.
   */
  mode?: RadarChartMode;
  /** Sizing/positioning hook. The SVG fills the width of its container. */
  className?: string;
}

/* -------------------------------------------------------------------------- */
/*  Fixed layout                                                              */
/* -------------------------------------------------------------------------- */

interface AxisSpec {
  id: ValueId;
  /** Direction in degrees, SVG convention (0 = right, 90 = down). */
  angle: number;
  /** Compact-mode letter. */
  letter: string;
  /** Where the label sits relative to its anchor point. */
  placement: "top" | "right" | "bottom" | "left";
}

/** Axis order matches the paper: Beneficence top, then clockwise. Never data-driven. */
const AXES: readonly AxisSpec[] = [
  { id: "beneficence", angle: -90, letter: "B", placement: "top" },
  { id: "autonomy", angle: 0, letter: "A", placement: "right" },
  { id: "justice", angle: 90, letter: "J", placement: "bottom" },
  { id: "nonmaleficence", angle: 180, letter: "N", placement: "left" },
];

interface Geometry {
  /** Radius that represents priority = 1. Identical for every profile. */
  radius: number;
  fontSize: number;
  markerRadius: number;
  /** Distance from the axis tip to the label anchor. */
  labelGap: number;
  /**
   * Space reserved for the left (Nonmaleficence / N) and right
   * (Autonomy / A) labels, in viewBox units. Reserved per side so the visible
   * content, not just the plot center, is balanced in the box. Sized from
   * measured text (13px/600: Nonmaleficence = 103, Autonomy = 65) plus slack
   * for fallback fonts; they exist only so labels cannot clip.
   */
  labelWidthLeft: number;
  labelWidthRight: number;
  padding: number;
  rings: readonly number[];
  showRingLabels: boolean;
  strokeWidth: number;
}

const GEOMETRY: Record<RadarChartMode, Geometry> = {
  full: {
    radius: 104,
    fontSize: 13,
    markerRadius: 4.5,
    labelGap: 12,
    labelWidthLeft: 110,
    labelWidthRight: 72,
    padding: 6,
    rings: [0.25, 0.5, 0.75, 1],
    showRingLabels: true,
    strokeWidth: 1.5,
  },
  compact: {
    radius: 38,
    fontSize: 13,
    markerRadius: 3,
    labelGap: 8,
    labelWidthLeft: 12,
    labelWidthRight: 12,
    padding: 4,
    rings: [0.5, 1],
    showRingLabels: false,
    strokeWidth: 1.25,
  },
};

/** Neutral palette (slate). Value colors are used only for markers and labels. */
const NEUTRAL = {
  axis: "#cbd5e1",
  ring: "#e2e8f0",
  scaleText: "#64748b",
  fill: "rgba(71, 85, 105, 0.16)",
  outline: "#475569",
  halo: "#ffffff",
} as const;

/* -------------------------------------------------------------------------- */
/*  Validation                                                                */
/* -------------------------------------------------------------------------- */

type IssueKind = "missing" | "not-finite" | "out-of-range";

interface Issue {
  id: ValueId;
  kind: IssueKind;
  value: unknown;
}

/**
 * Checks each axis without coercing or clamping. Typed as `unknown` per entry
 * on purpose: data can arrive malformed at runtime even when the type says
 * `number`. The sum is deliberately NOT checked or enforced; the chart plots
 * what it is given on the fixed scale.
 */
function findIssues(priorities: NormalizedPriorities): Issue[] {
  const issues: Issue[] = [];
  for (const { id } of AXES) {
    const value: unknown = priorities[id];
    if (value === undefined || value === null) {
      issues.push({ id, kind: "missing", value });
    } else if (typeof value !== "number" || !Number.isFinite(value)) {
      issues.push({ id, kind: "not-finite", value });
    } else if (value < 0 || value > 1) {
      issues.push({ id, kind: "out-of-range", value });
    }
  }
  return issues;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** Up to 3 decimals, no trailing zeros. */
const formatNumber = (n: number): string => String(Number(n.toFixed(3)));

const describeIssue = (issue: Issue, label: string): string => {
  switch (issue.kind) {
    case "missing":
      return `${label} is missing`;
    case "not-finite":
      return `${label} is not a finite number`;
    case "out-of-range":
      return `${label} is outside 0 to 1 (${String(issue.value)})`;
  }
};

/** Darkened value color so label text stays readable on a light background. */
const labelColor = (color: string): string => `color-mix(in srgb, ${color} 72%, #000)`;

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Four-axis radar chart of one decision-maker's normalized priorities.
 *
 * Responsive SVG (scales with its container's width). All profiles share one
 * fixed 0–1 radial scale, so shapes are directly comparable.
 */
export default function RadarChart({
  priorities,
  values,
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

  // The viewBox is sized so every label fits inside; the plot center sits
  // wherever that puts it (same place for every profile in a given mode).
  const sideReserve = g.radius + g.labelGap + g.padding;
  const cx = sideReserve + g.labelWidthLeft;
  const width = cx + sideReserve + g.labelWidthRight;
  const halfHeight = g.radius + g.labelGap + g.fontSize + g.padding;
  const cy = halfHeight;
  const height = halfHeight * 2;

  const point = (angle: number, fraction: number) => ({
    x: cx + g.radius * fraction * Math.cos(toRadians(angle)),
    y: cy + g.radius * fraction * Math.sin(toRadians(angle)),
  });
  const pointsAttr = (fractions: readonly number[]): string =>
    AXES.map(({ angle }, i) => {
      const p = point(angle, fractions[i]);
      return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    }).join(" ");

  const issues = findIssues(priorities);
  const valid = issues.length === 0;

  const summary = valid
    ? `Normalized priorities on a 0 to 1 scale: ${AXES.map(
        ({ id }) => `${values[id].label} ${formatNumber(priorities[id])}`,
      ).join(", ")}.`
    : `Chart not drawn because the data are invalid: ${issues
        .map((issue) => describeIssue(issue, values[issue.id].label))
        .join("; ")}.`;

  const labelPosition = (axis: AxisSpec) => {
    const offset = g.labelGap;
    const tip = point(axis.angle, 1);
    switch (axis.placement) {
      case "top":
        return { x: tip.x, y: tip.y - offset, anchor: "middle", dy: "0" } as const;
      case "bottom":
        return { x: tip.x, y: tip.y + offset + g.fontSize * 0.8, anchor: "middle", dy: "0" } as const;
      case "right":
        return { x: tip.x + offset, y: tip.y, anchor: "start", dy: "0.35em" } as const;
      case "left":
        return { x: tip.x - offset, y: tip.y, anchor: "end", dy: "0.35em" } as const;
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
          points={pointsAttr(AXES.map(() => ring))}
          fill="none"
          stroke={ring === 1 ? NEUTRAL.axis : NEUTRAL.ring}
          strokeWidth={0.75}
        />
      ))}

      {/* Axes. */}
      {AXES.map(({ id, angle }) => {
        const tip = point(angle, 1);
        return (
          <line
            key={id}
            x1={cx}
            y1={cy}
            x2={tip.x}
            y2={tip.y}
            stroke={NEUTRAL.axis}
            strokeWidth={0.75}
          />
        );
      })}

      {/* Scale labels sit on the top-right edge of each ring. */}
      {g.showRingLabels &&
        g.rings.map((ring) => (
          <text
            key={ring}
            x={cx + (g.radius * ring) / 2 + 3}
            y={cy - (g.radius * ring) / 2 - 2}
            fontSize={10}
            fill={NEUTRAL.scaleText}
            stroke={NEUTRAL.halo}
            strokeWidth={3}
            paintOrder="stroke"
            aria-hidden="true"
          >
            {formatNumber(ring)}
          </text>
        ))}

      {/* Data shape: neutral fill + neutral outline, only for valid data. */}
      {valid ? (
        <>
          <polygon
            points={pointsAttr(AXES.map(({ id }) => priorities[id]))}
            fill={NEUTRAL.fill}
            stroke={NEUTRAL.outline}
            strokeWidth={g.strokeWidth}
            strokeLinejoin="round"
          />
          {AXES.map(({ id, angle }) => {
            const p = point(angle, priorities[id]);
            return (
              <circle
                key={id}
                cx={p.x}
                cy={p.y}
                r={compact ? 1.5 : 2.25}
                fill={NEUTRAL.outline}
              />
            );
          })}
        </>
      ) : (
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dy="0.35em"
          fontSize={compact ? 9 : 13}
          fontWeight={600}
          fill={NEUTRAL.scaleText}
          stroke={NEUTRAL.halo}
          strokeWidth={4}
          paintOrder="stroke"
          aria-hidden="true"
        >
          Invalid data
        </text>
      )}

      {/* Value-colored endpoint markers and labels at the fixed axis tips. */}
      {AXES.map((axis) => {
        const definition = values[axis.id];
        const tip = point(axis.angle, 1);
        const pos = labelPosition(axis);
        return (
          <g key={axis.id}>
            <circle
              cx={tip.x}
              cy={tip.y}
              r={g.markerRadius}
              fill={definition.color}
              stroke={NEUTRAL.halo}
              strokeWidth={1.25}
            />
            <text
              x={pos.x}
              y={pos.y}
              dy={pos.dy}
              textAnchor={pos.anchor}
              fontSize={g.fontSize}
              fontWeight={600}
              style={{ fill: labelColor(definition.color) }}
            >
              {compact && <title>{definition.label}</title>}
              {compact ? axis.letter : definition.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
