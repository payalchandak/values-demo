import { useEffect, useId, useLayoutEffect, useState } from "react";
import { isMotionValue, motion, useMotionValue, useTransform } from "framer-motion";
import type { MotionValue } from "framer-motion";
import type { Value } from "../study/types";
import { MOVE_MS, STAGGER_MS } from "../design/motion";
import { NEUTRAL, VALUES, VALUE_ORDER } from "../design";

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
   *   overshoot therefore stop at the outer boundary instead of leaving the plot.
   * - Numbers and MotionValues can be mixed per axis.
   */
  priorities: Readonly<Record<Value, RadarLength>>;
  /** Accessible name of the chart. */
  title: string;
  /** Accessible description (whose priorities, what they mean). */
  description: string;
  /**
   * `full`: value names, whole-number percents, and one dashed "equal weight" ring.
   * `compact`: A / B / N / J letters, a faint dashed ring, no percents.
   */
  mode?: RadarChartMode;
  className?: string;
  /**
   * Entrance, 0 to 1, a pure function of the chapter clock.
   * Spokes grow from the center in order A, B, N, J, and the top value
   * grows last with one small pulse. `1` is the settled chart.
   */
  progress?: number;
}

/** A priority of this value reaches the outer boundary. Identical for every chart. */
export const RADAR_SCALE_MAX = 1;

/** Fixed axis order and direction (SVG degrees, 0 = right, 90 = down). A at the top, then clockwise. */
export const RADAR_AXES: readonly { value: Value; angle: number }[] = [
  { value: "A", angle: -90 },
  { value: "B", angle: 0 },
  { value: "N", angle: 90 },
  { value: "J", angle: 180 },
];

/** Charcoal used for every mark on the chart. Emphasis is size, weight, and darkness. */
export const RADAR_INK = NEUTRAL.ink;
export const RADAR_MUTED = "rgba(27, 36, 51, 0.42)";
export const RADAR_FILL = "rgba(27, 36, 51, 0.2)";
export const RADAR_FONT = "Inter, ui-sans-serif, system-ui, sans-serif";

/* -------------------------------------------------------------------------- */
/*  Entrance                                                                  */
/* -------------------------------------------------------------------------- */

const HOME_GROW_MS = MOVE_MS;
const HOME_START_MS = [0, STAGGER_MS, STAGGER_MS * 2, STAGGER_MS * 3] as const;
const TOP_START_MS = STAGGER_MS * 3 + MOVE_MS;
const TOP_GROW_MS = MOVE_MS;
const PULSE_START_MS = TOP_START_MS + TOP_GROW_MS;
const PULSE_MS = MOVE_MS;
/** How far the top spoke and dot swell at the peak of the pulse, then settle. */
const PULSE_AMP = 0.18;

/** Clock length of the entrance. Progress 1 is this many ms after progress 0. */
export const RADAR_ENTRANCE_MS = PULSE_START_MS + PULSE_MS;

/**
 * Seek points for the entrance. Letter beats are the moment that spoke has
 * arrived when it is not the top value. The top value waits until `pulse`.
 */
export const RADAR_ENTRANCE_BEATS: readonly { name: string; startMs: number }[] = [
  { name: "start", startMs: 0 },
  { name: "A", startMs: HOME_START_MS[0] + HOME_GROW_MS },
  { name: "B", startMs: HOME_START_MS[1] + HOME_GROW_MS },
  { name: "N", startMs: HOME_START_MS[2] + HOME_GROW_MS },
  { name: "J", startMs: HOME_START_MS[3] + HOME_GROW_MS },
  { name: "pulse", startMs: PULSE_START_MS + PULSE_MS / 2 },
  { name: "settled", startMs: RADAR_ENTRANCE_MS },
];

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** Spoke reveal (0 to 1) and the top value's pulse (0 at rest, 1 at the peak). */
export function radarMotion(
  progress: number,
  axisIndex: number,
  topIndex: number,
): { reveal: number; pulse: number } {
  if (!(progress < 1)) return { reveal: 1, pulse: 0 };
  const elapsed = Math.max(0, progress) * RADAR_ENTRANCE_MS;
  const top = axisIndex === topIndex;
  const start = top ? TOP_START_MS : HOME_START_MS[axisIndex]!;
  const grow = top ? TOP_GROW_MS : HOME_GROW_MS;
  const reveal = easeOut(clamp01((elapsed - start) / grow));
  if (!top) return { reveal, pulse: 0 };
  const u = clamp01((elapsed - PULSE_START_MS) / PULSE_MS);
  const pulse = u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u);
  return { reveal, pulse };
}

/* -------------------------------------------------------------------------- */
/*  Fixed geometry                                                            */
/* -------------------------------------------------------------------------- */

interface Geometry {
  radius: number;
  /** Largest label size the viewBox reserves room for. */
  fontSize: number;
  labelGap: number;
  sideLabelWidth: number;
  padding: number;
}

const GEOMETRY: Record<RadarChartMode, Geometry> = {
  full: {
    radius: 104,
    fontSize: 13,
    labelGap: 12,
    sideLabelWidth: 86,
    padding: 6,
  },
  compact: {
    radius: 30,
    fontSize: 16,
    labelGap: 3,
    sideLabelWidth: 14,
    padding: 4,
  },
};

export interface RadarMetrics {
  width: number;
  height: number;
  cx: number;
  cy: number;
  radius: number;
}

function metricsOf(mode: RadarChartMode): RadarMetrics {
  const g = GEOMETRY[mode];
  const reserveX = g.radius + g.labelGap + g.sideLabelWidth + g.padding;
  const reserveY = g.radius + g.labelGap + g.fontSize + g.padding;
  return { width: reserveX * 2, height: reserveY * 2, cx: reserveX, cy: reserveY, radius: g.radius };
}

/** ViewBox and plot radius for each mode. Full mode stays 416 by 270. */
export const radarMetrics: Record<RadarChartMode, RadarMetrics> = {
  full: metricsOf("full"),
  compact: metricsOf("compact"),
};

interface Style {
  spokeRest: number;
  spokeTop: number;
  spokeRestOpacity: number;
  dotRest: number;
  dotTop: number;
  polygon: number;
  outerOpacity: number;
  dashOpacity: number;
  dash: string;
  fontRest: number;
  fontTop: number;
  /** Gap from the outer tip to the label, in viewBox units. */
  labelGap: number;
}

export const RADAR_STYLE: Record<RadarChartMode, Style> = {
  full: {
    spokeRest: 1.25,
    spokeTop: 3.75,
    spokeRestOpacity: 0.38,
    dotRest: 6,
    dotTop: 8.5,
    polygon: 2.5,
    outerOpacity: 0.16,
    dashOpacity: 0.5,
    dash: "4 3.2",
    fontRest: 11,
    fontTop: 16,
    labelGap: 8,
  },
  compact: {
    spokeRest: 1.05,
    spokeTop: 2.5,
    spokeRestOpacity: 0.4,
    dotRest: 3.3,
    dotTop: 4.7,
    polygon: 1.6,
    outerOpacity: 0.16,
    dashOpacity: 0.32,
    dash: "2 2",
    fontRest: 13,
    fontTop: 16,
    labelGap: 3,
  },
};

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** Fraction of the radius for a priority; always inside the plot. */
const toFraction = (priority: number): number =>
  Number.isFinite(priority) ? Math.min(1, Math.max(0, priority / RADAR_SCALE_MAX)) : 0;

const formatNumber = (n: number): string => String(Number(n.toFixed(3)));

/** Whole-number percent of a 0 to 1 priority. */
export function percentText(priority: number): string {
  const unit = Number.isFinite(priority) ? Math.min(1, Math.max(0, priority)) : 0;
  return `${Math.round(unit * 100)}%`;
}

function topIndexOf(lengths: readonly number[]): number {
  let best = 0;
  for (let i = 1; i < lengths.length; i++) {
    if (toFraction(lengths[i]!) > toFraction(lengths[best]!)) best = i;
  }
  return best;
}

/** Highest priority. Ties keep the earlier axis in A, B, N, J order. */
export function topValue(priorities: Readonly<Record<Value, number>>): Value {
  return VALUE_ORDER[topIndexOf(VALUE_ORDER.map((v) => priorities[v]))]!;
}

/* -------------------------------------------------------------------------- */
/*  Label fit                                                                 */
/* -------------------------------------------------------------------------- */

let fontEpoch = 0;
const fontListeners = new Set<() => void>();
if (typeof document !== "undefined" && document.fonts) {
  void document.fonts.ready.then(() => {
    fontEpoch += 1;
    fontListeners.forEach((listen) => listen());
  });
}

/** Bumps once the webfont is ready so label sizes can be remeasured. */
export function useRadarFontEpoch(): number {
  const [epoch, setEpoch] = useState(fontEpoch);
  useEffect(() => {
    const update = () => setEpoch(fontEpoch);
    fontListeners.add(update);
    update();
    return () => {
      fontListeners.delete(update);
    };
  }, []);
  return epoch;
}

let measureCanvas: HTMLCanvasElement | null = null;

function measureWidth(text: string, size: number, weight: number): number {
  if (typeof document === "undefined") return text.length * size * 0.56;
  measureCanvas ??= document.createElement("canvas");
  const ctx = measureCanvas.getContext("2d");
  if (!ctx) return text.length * size * 0.56;
  ctx.font = `${weight} ${size}px ${RADAR_FONT}`;
  return ctx.measureText(text).width;
}

/** Largest size in `max`..`min` whose text fits in `budget` px, leaving a little slack. */
function fitSize(text: string, weight: number, max: number, min: number, budget: number): number {
  const slack = 3;
  for (let size = max; size > min; size -= 0.5) {
    if (measureWidth(text, size, weight) <= budget - slack) return size;
  }
  return min;
}

interface Pt {
  x: number;
  y: number;
}
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const orient = (a: Pt, b: Pt, c: Pt) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

function insideConvex(p: Pt, poly: readonly Pt[]): boolean {
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    if (orient(a, b, p) < -0.2) return false;
  }
  return true;
}

function segmentsHit(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  return ((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0));
}

function boxCorners(box: Box): Pt[] {
  return [
    { x: box.x, y: box.y },
    { x: box.x + box.w, y: box.y },
    { x: box.x + box.w, y: box.y + box.h },
    { x: box.x, y: box.y + box.h },
  ];
}

function boxHitsPoly(box: Box, poly: readonly Pt[]): boolean {
  const corners = boxCorners(box);
  if (corners.some((c) => insideConvex(c, poly))) return true;
  if (poly.some((p) => p.x >= box.x && p.x <= box.x + box.w && p.y >= box.y && p.y <= box.y + box.h)) return true;
  const edges: [Pt, Pt][] = [
    [corners[0]!, corners[1]!],
    [corners[1]!, corners[2]!],
    [corners[2]!, corners[3]!],
    [corners[3]!, corners[0]!],
  ];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    if (edges.some(([c, d]) => segmentsHit(a, b, c, d))) return true;
  }
  return false;
}

function boxHitsSegment(box: Box, a: Pt, b: Pt): boolean {
  if (
    (a.x >= box.x && a.x <= box.x + box.w && a.y >= box.y && a.y <= box.y + box.h) ||
    (b.x >= box.x && b.x <= box.x + box.w && b.y >= box.y && b.y <= box.y + box.h)
  ) {
    return true;
  }
  const corners = boxCorners(box);
  const edges: [Pt, Pt][] = [
    [corners[0]!, corners[1]!],
    [corners[1]!, corners[2]!],
    [corners[2]!, corners[3]!],
    [corners[3]!, corners[0]!],
  ];
  return edges.some(([c, d]) => segmentsHit(a, b, c, d));
}

function boxHitsBox(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function pointOnAxis(metrics: RadarMetrics, angle: number, fraction: number): Pt {
  return {
    x: metrics.cx + metrics.radius * fraction * Math.cos(toRadians(angle)),
    y: metrics.cy + metrics.radius * fraction * Math.sin(toRadians(angle)),
  };
}

export interface AxisLabelPlacement {
  /** Anchor for the name (and, when not stacked, the percent on the same line). */
  x: number;
  y: number;
  /** Side axes put the percent on its own line, centered on the axis. */
  stacked: boolean;
  /** Split line for a stacked label. The name sits above it, the percent below. */
  splitY: number;
  anchor: "start" | "middle" | "end";
  baseline: "text-after-edge" | "text-before-edge" | "middle";
  fontSize: number;
  fontWeight: number;
  fill: string;
}

/**
 * Label anchor outside the outer boundary, so the text grows away from the
 * plot and cannot cover the polygon. Side labels are stacked so a long name
 * still fits the margin. The top value uses the largest size that fits.
 */
export function placeAxisLabel(
  mode: RadarChartMode,
  value: Value,
  emphasized: boolean,
  percent: string,
): AxisLabelPlacement {
  const metrics = radarMetrics[mode];
  const style = RADAR_STYLE[mode];
  const angle = RADAR_AXES.find((axis) => axis.value === value)!.angle;
  const tip = pointOnAxis(metrics, angle, 1);
  const gap = style.labelGap;
  const name = mode === "compact" ? VALUES[value].letter : VALUES[value].name;
  const weight = emphasized ? 700 : 500;
  const fill = emphasized ? RADAR_INK : RADAR_MUTED;
  const stacked = mode === "full" && (angle === 0 || angle === 180);
  const inline = stacked ? name : mode === "compact" ? name : `${name} ${percent}`;
  const sideBudget =
    metrics.width / 2 - metrics.radius - gap - 2;
  const inlineBudget = metrics.width - 8;
  const budget = stacked || mode === "compact" ? (angle === -90 || angle === 90 ? inlineBudget : sideBudget) : inlineBudget;
  const fontSize = emphasized
    ? fitSize(inline, weight, style.fontTop, style.fontRest, budget)
    : style.fontRest;

  if (angle === -90) {
    return {
      x: tip.x,
      y: tip.y - gap,
      stacked: false,
      splitY: tip.y - gap,
      anchor: "middle",
      baseline: "text-after-edge",
      fontSize,
      fontWeight: weight,
      fill,
    };
  }
  if (angle === 90) {
    return {
      x: tip.x,
      y: tip.y + gap,
      stacked: false,
      splitY: tip.y + gap,
      anchor: "middle",
      baseline: "text-before-edge",
      fontSize,
      fontWeight: weight,
      fill,
    };
  }
  const x = angle === 0 ? tip.x + gap : tip.x - gap;
  return {
    x,
    y: tip.y,
    stacked,
    splitY: tip.y,
    anchor: angle === 0 ? "start" : "end",
    // Compact letters sit on the axis. Full side labels stack off this split.
    baseline: "middle",
    fontSize,
    fontWeight: weight,
    fill,
  };
}

/** Outer boundary or dashed equal-weight ring, as a polygon point string. */
export function radarRingPoints(mode: RadarChartMode, fraction: number): string {
  const metrics = radarMetrics[mode];
  return RADAR_AXES.map(({ angle }) => {
    const at = pointOnAxis(metrics, angle, fraction);
    return `${at.x.toFixed(2)},${at.y.toFixed(2)}`;
  }).join(" ");
}

function labelBoxes(priorities: readonly number[], mode: RadarChartMode): Box[] {
  const boxes: Box[] = [];
  const pad = 2;
  RADAR_AXES.forEach(({ value }, i) => {
    const emphasized = i === topIndexOf(priorities);
    const percent = percentText(priorities[i]!);
    const place = placeAxisLabel(mode, value, emphasized, percent);
    const name = mode === "compact" ? VALUES[value].letter : VALUES[value].name;
    const texts = place.stacked ? [name, percent] : [mode === "compact" ? name : `${name} ${percent}`];
    texts.forEach((text, line) => {
      const w = measureWidth(text, place.fontSize, place.fontWeight);
      const h = place.fontSize * 1.05;
      const x = place.anchor === "middle" ? place.x - w / 2 : place.anchor === "end" ? place.x - w : place.x;
      let y = place.y - h;
      if (!place.stacked && place.baseline === "text-before-edge") y = place.y;
      if (place.stacked && line === 0) y = place.splitY - 1 - h;
      if (place.stacked && line === 1) y = place.splitY + 1;
      boxes.push({ x: x - pad, y: y - pad, w: w + pad * 2, h: h + pad * 2 });
    });
  });
  return boxes;
}

const EQUAL_WEIGHT = "equal weight";

/** Where the "equal weight" label sits so it misses the polygon, spokes, and value labels. */
export function placeEqualWeight(priorities: Readonly<Record<Value, number>>): Pt {
  const metrics = radarMetrics.full;
  const lengths = VALUE_ORDER.map((v) => priorities[v]);
  const poly = RADAR_AXES.map(({ angle }, i) => pointOnAxis(metrics, angle, toFraction(lengths[i]!)));
  const center = { x: metrics.cx, y: metrics.cy };
  const fontSize = 10;
  const w = measureWidth(EQUAL_WEIGHT, fontSize, 500) + 4;
  const h = fontSize * 1.2;
  const labels = labelBoxes(lengths, "full");
  const dots = RADAR_AXES.map(({ angle }, i) => {
    const at = pointOnAxis(metrics, angle, toFraction(lengths[i]!));
    const r = i === topIndexOf(lengths) ? RADAR_STYLE.full.dotTop : RADAR_STYLE.full.dotRest;
    return { ...at, r };
  });

  const clear = (box: Box) => {
    if (box.x < 2 || box.y < 2 || box.x + box.w > metrics.width - 2 || box.y + box.h > metrics.height - 2) return false;
    const padded = { x: box.x - 3, y: box.y - 3, w: box.w + 6, h: box.h + 6 };
    if (boxHitsPoly(padded, poly)) return false;
    if (poly.some((vertex) => boxHitsSegment(padded, center, vertex))) return false;
    if (
      dots.some((dot) =>
        boxHitsBox(padded, { x: dot.x - dot.r, y: dot.y - dot.r, w: dot.r * 2, h: dot.r * 2 }),
      )
    ) {
      return false;
    }
    if (labels.some((label) => boxHitsBox(box, label))) return false;
    return true;
  };

  const mid = pointOnAxis(metrics, -45, 0.25);
  const normal = { x: Math.SQRT1_2, y: -Math.SQRT1_2 };
  for (let step = 0; step <= 40; step++) {
    const x = mid.x + normal.x * (6 + step * 4);
    const y = mid.y + normal.y * (6 + step * 4) - h / 2;
    const box = { x, y, w, h };
    if (clear(box)) return { x, y: y + h / 2 };
  }
  return { x: metrics.cx + metrics.radius * 0.42, y: metrics.cy - metrics.radius * 0.72 };
}

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

function useProgress(progress: number): MotionValue<number> {
  const settled = !(progress < 1) ? 1 : Math.max(0, progress);
  const mv = useMotionValue(settled);
  useLayoutEffect(() => {
    mv.set(!(progress < 1) ? 1 : Math.max(0, progress));
  }, [progress, mv]);
  return mv;
}

interface ArmProps {
  index: number;
  angle: number;
  value: Value;
  length: MotionValue<number>;
  top: MotionValue<number>;
  progress: MotionValue<number>;
  mode: RadarChartMode;
  showData: boolean;
}

function RadarArm({ index, angle, value, length, top, progress, mode, showData }: ArmProps) {
  const metrics = radarMetrics[mode];
  const style = RADAR_STYLE[mode];
  const compact = mode === "compact";
  const name = compact ? VALUES[value].letter : VALUES[value].name;

  const x2 = useTransform([length, progress, top], (latest: number[]) => {
    const reveal = showData ? radarMotion(latest[1]!, index, latest[2]!).reveal : 0;
    return pointOnAxis(metrics, angle, toFraction(latest[0]!) * reveal).x;
  });
  const y2 = useTransform([length, progress, top], (latest: number[]) => {
    const reveal = showData ? radarMotion(latest[1]!, index, latest[2]!).reveal : 0;
    return pointOnAxis(metrics, angle, toFraction(latest[0]!) * reveal).y;
  });
  const spokeWidth = useTransform([progress, top], (latest: number[]) => {
    const motion = radarMotion(latest[0]!, index, latest[1]!);
    if (!showData || motion.reveal === 0) return 0;
    const emphasized = index === latest[1];
    const base = emphasized ? style.spokeTop : style.spokeRest;
    return base * (emphasized ? 1 + PULSE_AMP * motion.pulse : 1);
  });
  const spokeOpacity = useTransform([progress, top], (latest: number[]) => {
    const motion = radarMotion(latest[0]!, index, latest[1]!);
    if (!showData || motion.reveal === 0) return 0;
    return index === latest[1] ? motion.reveal : style.spokeRestOpacity * motion.reveal;
  });
  const dotR = useTransform([progress, top], (latest: number[]) => {
    const motion = radarMotion(latest[0]!, index, latest[1]!);
    if (!showData) return 0;
    const emphasized = index === latest[1];
    const base = emphasized ? style.dotTop : style.dotRest;
    return base * motion.reveal * (emphasized ? 1 + PULSE_AMP * motion.pulse : 1);
  });
  const labelOpacity = useTransform([progress, top], (latest: number[]) => {
    if (!showData) return 1;
    return radarMotion(latest[0]!, index, latest[1]!).reveal;
  });
  const fontSize = useTransform([length, progress, top], (latest: number[]) => {
    const emphasized = showData && index === latest[2];
    return placeAxisLabel(mode, value, emphasized, percentText(latest[0]!)).fontSize;
  });
  const fontWeight = useTransform([progress, top], (latest: number[]) => {
    const emphasized = showData && index === latest[1];
    return emphasized ? 700 : 500;
  });
  const fill = useTransform([progress, top], (latest: number[]) => {
    const emphasized = showData && index === latest[1];
    return emphasized ? RADAR_INK : RADAR_MUTED;
  });
  const inline = useTransform([length, progress, top], (latest: number[]) => {
    const emphasized = showData && index === latest[2];
    const place = placeAxisLabel(mode, value, emphasized, percentText(latest[0]!));
    if (!showData || compact || place.stacked) return name;
    return `${name} ${percentText(latest[0]!)}`;
  });
  const percent = useTransform(length, (l: number) => percentText(l));
  const place = placeAxisLabel(mode, value, false, "0%");
  const stacked = !compact && (angle === 0 || angle === 180);

  return (
    <g data-radar-arm={value}>
      {showData && (
        <motion.line
          x1={metrics.cx}
          y1={metrics.cy}
          x2={x2}
          y2={y2}
          stroke={RADAR_INK}
          strokeWidth={spokeWidth}
          strokeOpacity={spokeOpacity}
          strokeLinecap="round"
          data-radar-spoke={value}
        />
      )}
      {showData && (
        <motion.circle cx={x2} cy={y2} r={dotR} fill={RADAR_INK} data-radar-dot={value} />
      )}
      <motion.text
        x={place.x}
        y={stacked ? place.splitY - 1 : place.y}
        textAnchor={place.anchor}
        dominantBaseline={stacked ? "text-after-edge" : place.baseline}
        fontFamily={RADAR_FONT}
        fontSize={fontSize}
        fontWeight={fontWeight}
        fill={fill}
        opacity={labelOpacity}
        data-radar-label={value}
      >
        {inline}
      </motion.text>
      {stacked && showData && (
        <motion.text
          x={place.x}
          y={place.splitY + 1}
          textAnchor={place.anchor}
          dominantBaseline="text-before-edge"
          fontFamily={RADAR_FONT}
          fontSize={fontSize}
          fontWeight={fontWeight}
          fill={fill}
          opacity={labelOpacity}
          data-radar-percent={value}
        >
          {percent}
        </motion.text>
      )}
    </g>
  );
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Four-axis radar chart of one decision-maker's priorities.
 *
 * - Axes are always A, B, N, J (top, right, bottom, left); never data-driven.
 * - The scale is fixed (outer boundary = `RADAR_SCALE_MAX`) and the plot sits at
 *   the same place every time, so charts are directly comparable.
 * - Everything is charcoal. The top value is larger, heavier, and darker.
 * - Every radial length may be a MotionValue for animation.
 * - `progress` scrubs the entrance. It is a pure function of the chapter clock.
 *
 * Responsive SVG: it scales with its container's width.
 */
export default function RadarChart({
  priorities,
  title,
  description,
  mode = "full",
  className,
  progress = 1,
}: RadarChartProps) {
  const uid = useId();
  const titleId = `${uid}-title`;
  const descId = `${uid}-desc`;
  useRadarFontEpoch();

  const compact = mode === "compact";
  const metrics = radarMetrics[mode];
  const style = RADAR_STYLE[mode];

  const lengthA = useLength(priorities.A);
  const lengthB = useLength(priorities.B);
  const lengthN = useLength(priorities.N);
  const lengthJ = useLength(priorities.J);
  const lengths = [lengthA, lengthB, lengthN, lengthJ];
  const progressMv = useProgress(progress);
  const topMv = useTransform([lengthA, lengthB, lengthN, lengthJ], (latest: number[]) => topIndexOf(latest));

  const polygonPoints = useTransform(
    [lengthA, lengthB, lengthN, lengthJ, progressMv, topMv],
    (latest: number[]) => {
      const top = latest[5]!;
      const p = latest[4]!;
      return RADAR_AXES.map(({ angle }, i) => {
        const reveal = radarMotion(p, i, top).reveal;
        const at = pointOnAxis(metrics, angle, toFraction(latest[i]!) * reveal);
        return `${at.x.toFixed(2)},${at.y.toFixed(2)}`;
      }).join(" ");
    },
  );
  const polygonOpacity = useTransform(
    [lengthA, lengthB, lengthN, lengthJ, progressMv, topMv],
    (latest: number[]) => {
      const top = latest[5]!;
      const p = latest[4]!;
      const shown = RADAR_AXES.some((_, i) => radarMotion(p, i, top).reveal > 0);
      return shown ? 1 : 0;
    },
  );

  const equalPoint = useTransform([lengthA, lengthB, lengthN, lengthJ], (latest: number[]) =>
    placeEqualWeight({ A: latest[0]!, B: latest[1]!, N: latest[2]!, J: latest[3]! }),
  );
  const equalX = useTransform(equalPoint, (point) => point.x);
  const equalY = useTransform(equalPoint, (point) => point.y);

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
    RADAR_AXES.map(({ angle }) => {
      const at = pointOnAxis(metrics, angle, fraction);
      return `${at.x.toFixed(2)},${at.y.toFixed(2)}`;
    }).join(" ");

  const settled = !(progress < 1) ? 1 : Math.max(0, progress);

  return (
    <svg
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
      viewBox={`0 0 ${metrics.width} ${metrics.height}`}
      className={`block h-auto w-full ${className ?? ""}`.trim()}
      data-mode={mode}
      data-progress={settled}
    >
      <title id={titleId}>{title}</title>
      <desc id={descId}>{`${description} ${summary}`}</desc>

      <polygon
        points={ringPoints(1)}
        fill="none"
        stroke={RADAR_INK}
        strokeOpacity={style.outerOpacity}
        strokeWidth={1}
        data-radar-outer=""
      />
      <polygon
        points={ringPoints(0.25)}
        fill="none"
        stroke={RADAR_INK}
        strokeOpacity={style.dashOpacity}
        strokeWidth={1}
        strokeDasharray={style.dash}
        data-radar-equal=""
      />

      {valid ? (
        <motion.polygon
          points={polygonPoints}
          fill={RADAR_FILL}
          stroke={RADAR_INK}
          strokeWidth={style.polygon}
          strokeLinejoin="round"
          opacity={polygonOpacity}
          data-radar-polygon=""
        />
      ) : (
        <text
          x={metrics.cx}
          y={metrics.cy}
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily={RADAR_FONT}
          fontSize={compact ? 9 : 13}
          fontWeight={600}
          fill={RADAR_MUTED}
          stroke={NEUTRAL.surface}
          strokeWidth={4}
          paintOrder="stroke"
          aria-hidden="true"
        >
          Invalid data
        </text>
      )}

      {RADAR_AXES.map(({ value, angle }, index) => (
        <RadarArm
          key={value}
          index={index}
          angle={angle}
          value={value}
          length={lengths[index]!}
          top={topMv}
          progress={progressMv}
          mode={mode}
          showData={valid}
        />
      ))}

      {!compact && (
        <motion.text
          x={equalX}
          y={equalY}
          textAnchor="start"
          dominantBaseline="middle"
          fontFamily={RADAR_FONT}
          fontSize={10}
          fontWeight={500}
          fill={RADAR_MUTED}
          stroke={NEUTRAL.surface}
          strokeWidth={3}
          paintOrder="stroke"
          data-equal-weight=""
        >
          {EQUAL_WEIGHT}
        </motion.text>
      )}
    </svg>
  );
}
