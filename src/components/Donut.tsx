import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { NEUTRAL, VALUES, VALUE_ORDER } from "../design";
import type { Value } from "../study/types";

/*
 * A monochrome donut of the four value priorities. Segments run clockwise from
 * 12 o'clock in the fixed order Autonomy, Beneficence, Nonmaleficence, Justice.
 * Every frame is a pure function of its props, so it scrubs and pauses.
 *
 * Everything the bars-to-ring morph needs (ring geometry, the bend of a straight
 * strip into the ring, the hero label layout) lives here too, so that the last
 * frame of the morph is the hero donut by construction.
 */

export type Priorities = Record<Value, number>;
export type DonutMode = "hero" | "compact";

/* -------------------------------------------------------------------------- */
/*  Look                                                                      */
/* -------------------------------------------------------------------------- */

export const DONUT_INK = NEUTRAL.ink;
export const DONUT_MUTED = NEUTRAL.inkMuted;
/** Opacity of a segment that is not the largest. The largest is drawn at 1. */
export const LIGHT_OPACITY = 0.22;
/** Gap between neighbouring segments, in degrees of the full turn. */
export const GAP_DEG = 3;
/** Ring thickness as a fraction of its outer radius. */
export const RING_THICKNESS = 0.3;
export const FONT_STACK = '"Inter", ui-sans-serif, system-ui, sans-serif';

const NAME_FS = 13;
const PCT_FS = 17;
/** Label type grows a little with the frame so it reads on a large stage. */
export const heroFonts = (width: number) => {
  const k = Math.min(Math.max(width / 600, 1), 1.3);
  return { nameFs: NAME_FS * k, pctFs: PCT_FS * k };
};
const LABEL_GAP = 10;
const LABEL_PAD = 6;
const EDGE = 6;
const RING_KEEPOUT = 6;
/** Largest hero ring (outer radius, px). */
const HERO_MAX_R = 150;
const HERO_MIN_R = 28;

const TAU = Math.PI * 2;
export const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* -------------------------------------------------------------------------- */
/*  Data helpers                                                              */
/* -------------------------------------------------------------------------- */

/** Linear interpolation of two priority vectors. Sums stay 1 (re-divided only to absorb float error). */
export function mixPriorities(from: Priorities, to: Priorities, t: number): Priorities {
  const out = {} as Priorities;
  let sum = 0;
  for (const v of VALUE_ORDER) {
    out[v] = lerp(from[v], to[v], t);
    sum += out[v];
  }
  if (sum > 0) for (const v of VALUE_ORDER) out[v] /= sum;
  return out;
}

/** The largest value; the first in the fixed order wins a tie. */
export function dominantValue(p: Priorities): Value {
  let best = VALUE_ORDER[0];
  for (const v of VALUE_ORDER) if (p[v] > p[best]) best = v;
  return best;
}

/** Whole-number percent text, e.g. "81%". */
export const percentText = (p: number) => `${Math.round(p * 100)}%`;

export interface Span {
  value: Value;
  /** Start and end as fractions of a full turn, clockwise from 12 o'clock. */
  u0: number;
  u1: number;
}

/** Segment spans: the first starts at 12 o'clock, a gap follows each one. */
export function ringSpans(p: Priorities): Span[] {
  const gap = GAP_DEG / 360;
  const usable = 1 - VALUE_ORDER.length * gap;
  let u = 0;
  return VALUE_ORDER.map((value) => {
    const u0 = u;
    const u1 = u0 + p[value] * usable;
    u = u1 + gap;
    return { value, u0, u1 };
  });
}

/** Per-value emphasis in [LIGHT_OPACITY, 1], cross-faded between the two states. */
export function emphasisAt(from: Priorities, to: Priorities, t: number): Record<Value, number> {
  const a = dominantValue(from);
  const b = dominantValue(to);
  const out = {} as Record<Value, number>;
  for (const v of VALUE_ORDER) out[v] = lerp(v === a ? 1 : LIGHT_OPACITY, v === b ? 1 : LIGHT_OPACITY, t);
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Ring geometry                                                             */
/* -------------------------------------------------------------------------- */

const fix = (n: number) => n.toFixed(3);

/** Annular sector from turn fraction u0 to u1. */
export function sectorPath(cx: number, cy: number, rOut: number, rIn: number, u0: number, u1: number): string {
  const at = (r: number, u: number) => `${fix(cx + r * Math.sin(u * TAU))} ${fix(cy - r * Math.cos(u * TAU))}`;
  const large = u1 - u0 > 0.5 ? 1 : 0;
  return `M${at(rOut, u0)}A${fix(rOut)} ${fix(rOut)} 0 ${large} 1 ${at(rOut, u1)}L${at(rIn, u1)}A${fix(rIn)} ${fix(rIn)} 0 ${large} 0 ${at(rIn, u0)}Z`;
}

/** Radii for a ring of outer radius R. */
export const ringRadii = (R: number) => ({ rOut: R, rIn: R * (1 - RING_THICKNESS), rMid: R * (1 - RING_THICKNESS / 2), thick: R * RING_THICKNESS });

/* -------------------------------------------------------------------------- */
/*  The bend: a straight strip as long as the ring's circumference, curled     */
/*  into the ring. The centerline keeps its length and its centroid stays at   */
/*  the ring's center; at bend = 1 it is exactly the ring, first segment       */
/*  starting at 12 o'clock.                                                    */
/* -------------------------------------------------------------------------- */

const bendOmega = (b: number) => Math.PI * b * b;

/** Centerline point of a unit-length strip (arc length 1), relative to its middle. */
function rawBend(u: number, b: number): [number, number] {
  const k = TAU * b;
  const w = bendOmega(b);
  const s = u - 0.5;
  if (k < 1e-6) return [Math.cos(w) * s, Math.sin(w) * s];
  return [(Math.sin(k * s + w) - Math.sin(w)) / k, (Math.cos(w) - Math.cos(k * s + w)) / k];
}

function bendCentroid(b: number): [number, number] {
  const k = TAU * b;
  if (k < 1e-4) return [0, 0];
  const w = bendOmega(b);
  const x = ((Math.cos(w - k / 2) - Math.cos(w + k / 2)) / k - Math.sin(w)) / k;
  const y = (Math.cos(w) - (Math.sin(w + k / 2) - Math.sin(w - k / 2)) / k) / k;
  return [x, y];
}

export interface Bend {
  /** Strip centerline length (the ring's circumference at the mid radius). */
  length: number;
  thick: number;
  /** Centerline point at turn fraction u, and the unit normal pointing toward the ring's center. */
  at: (u: number) => { x: number; y: number; nx: number; ny: number };
}

/** The strip bent to `b` in [0, 1], centered on (cx, cy). */
export function bendStrip(b: number, R: number, cx: number, cy: number): Bend {
  const { rMid, thick } = ringRadii(R);
  const length = TAU * rMid;
  const k = TAU * b;
  const w = bendOmega(b);
  const [mx, my] = bendCentroid(b);
  return {
    length,
    thick,
    at: (u) => {
      const [x, y] = rawBend(u, b);
      const theta = k * (u - 0.5) + w;
      return { x: cx + (x - mx) * length, y: cy + (y - my) * length, nx: -Math.sin(theta), ny: Math.cos(theta) };
    },
  };
}

/** Outline of the strip between u0 and u1 at bend b. */
export function bentSegmentPath(bend: Bend, u0: number, u1: number): string {
  const n = Math.max(2, Math.ceil((u1 - u0) * 120) + 1);
  const half = bend.thick / 2;
  const outer: string[] = [];
  const inner: string[] = [];
  for (let i = 0; i <= n; i++) {
    const p = bend.at(lerp(u0, u1, i / n));
    outer.push(`${fix(p.x - p.nx * half)} ${fix(p.y - p.ny * half)}`);
    inner.push(`${fix(p.x + p.nx * half)} ${fix(p.y + p.ny * half)}`);
  }
  return `M${outer.join("L")}L${inner.reverse().join("L")}Z`;
}

/** Largest distance of the bending strip from the ring center, over all bends, per unit of outer radius. */
const BEND_EXTENT = (() => {
  let ex = 0;
  let ey = 0;
  for (let i = 0; i <= 40; i++) {
    const bend = bendStrip(i / 40, 1, 0, 0);
    for (let j = 0; j <= 80; j++) {
      const p = bend.at(j / 80);
      for (const s of [-1, 1]) {
        ex = Math.max(ex, Math.abs(p.x + s * p.nx * (bend.thick / 2)));
        ey = Math.max(ey, Math.abs(p.y + s * p.ny * (bend.thick / 2)));
      }
    }
  }
  return { x: ex, y: ey };
})();

/* -------------------------------------------------------------------------- */
/*  Text measuring                                                            */
/* -------------------------------------------------------------------------- */

export type Measure = (text: string, fontSize: number, weight: number) => number;

let canvas: CanvasRenderingContext2D | null | undefined;
export const measureText: Measure = (text, fontSize, weight) => {
  if (canvas === undefined) canvas = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  if (!canvas) return text.length * fontSize * 0.58;
  canvas.font = `${weight} ${fontSize}px ${FONT_STACK}`;
  return canvas.measureText(text).width;
};

/** Bumps once web fonts have loaded, so measured layouts are redone with the real font. */
export function useFontEpoch(): number {
  const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) setEpoch((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return epoch;
}

/** Live content-box size of an element. */
export function useBox(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setSize((s) => (s.width === el.clientWidth && s.height === el.clientHeight ? s : { width: el.clientWidth, height: el.clientHeight }));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/* -------------------------------------------------------------------------- */
/*  Hero layout                                                               */
/* -------------------------------------------------------------------------- */

export interface HeroFrame {
  cx: number;
  cy: number;
  /** Outer radius. */
  R: number;
}

/**
 * The ring that fits a frame: big as it can be while the straight strip, every
 * bend of it, and the labels all stay inside.
 */
export function heroFrame(width: number, height: number, measure: Measure = measureText): HeroFrame {
  const { nameFs, pctFs } = heroFonts(width);
  let nameW = 0;
  for (const v of VALUE_ORDER) nameW = Math.max(nameW, measure(VALUES[v].name, nameFs, 500));
  const labelW = Math.max(nameW, measure("100%", pctFs, 700));
  const labelH = nameFs * 1.25 + 2 + pctFs * 1.25;
  const R = Math.min(
    HERO_MAX_R,
    (width / 2 - EDGE) / BEND_EXTENT.x,
    (height / 2 - EDGE) / BEND_EXTENT.y,
    width / 2 - EDGE - LABEL_GAP - labelW,
    height / 2 - EDGE - LABEL_GAP - labelH,
  );
  return { cx: width / 2, cy: height / 2, R: Math.max(R, HERO_MIN_R) };
}

export interface HeroLabel {
  value: Value;
  name: string;
  pct: string;
  bold: boolean;
  left: number;
  top: number;
  w: number;
  h: number;
  anchor: "start" | "middle" | "end";
  /** Text x for `anchor`, and baselines of the two lines. */
  x: number;
  nameY: number;
  pctY: number;
  nameFs: number;
  pctFs: number;
}

export interface Rect {
  left: number;
  top: number;
  w: number;
  h: number;
}

/** Nudges boxes apart, off the ring, and inside the frame. Mutates and returns the boxes. */
export function nudgeApart<T extends Rect>(boxes: T[], width: number, height: number, ring?: { cx: number; cy: number; r: number }): T[] {
  const clampBox = (b: T) => {
    b.left = Math.min(Math.max(b.left, EDGE), Math.max(EDGE, width - EDGE - b.w));
    b.top = Math.min(Math.max(b.top, EDGE), Math.max(EDGE, height - EDGE - b.h));
  };
  boxes.forEach(clampBox);
  for (let iter = 0; iter < 160; iter++) {
    let moved = false;
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const dx = Math.min(a.left + a.w, b.left + b.w) - Math.max(a.left, b.left) + LABEL_PAD;
        const dy = Math.min(a.top + a.h, b.top + b.h) - Math.max(a.top, b.top) + LABEL_PAD;
        if (dx <= 0 || dy <= 0) continue;
        moved = true;
        // Separate along the shorter way out, preferring vertical (labels are wide and short).
        if (dy <= dx * 1.6) {
          const dir = a.top + a.h / 2 <= b.top + b.h / 2 ? 1 : -1;
          a.top -= (dir * dy) / 2;
          b.top += (dir * dy) / 2;
        } else {
          const dir = a.left + a.w / 2 <= b.left + b.w / 2 ? 1 : -1;
          a.left -= (dir * dx) / 2;
          b.left += (dir * dx) / 2;
        }
      }
    }
    if (ring) {
      for (const b of boxes) {
        const nx = Math.min(Math.max(ring.cx, b.left), b.left + b.w);
        const ny = Math.min(Math.max(ring.cy, b.top), b.top + b.h);
        const d = Math.hypot(nx - ring.cx, ny - ring.cy);
        const want = ring.r + RING_KEEPOUT;
        if (d < want) {
          moved = true;
          let ux = b.left + b.w / 2 - ring.cx;
          let uy = b.top + b.h / 2 - ring.cy;
          const len = Math.hypot(ux, uy) || 1;
          ux /= len;
          uy /= len;
          b.left += ux * (want - d);
          b.top += uy * (want - d);
        }
      }
    }
    boxes.forEach(clampBox);
    if (!moved) break;
  }
  return boxes;
}

export interface DonutSegment {
  value: Value;
  u0: number;
  u1: number;
  p: number;
  emphasis: number;
  path: string;
}

export interface DonutScene {
  mode: DonutMode;
  width: number;
  height: number;
  cx: number;
  cy: number;
  R: number;
  rIn: number;
  segments: DonutSegment[];
  /** Hero only. */
  labels: HeroLabel[];
}

export interface SceneInput {
  from: Priorities;
  to: Priorities;
  t: number;
  mode: DonutMode;
  /** Compact: the diameter. Hero: the frame's width and height. */
  width: number;
  height?: number;
  measure?: Measure;
}

/** Everything a donut frame draws, as data. */
export function donutScene({ from, to, t, mode, width, height = width, measure = measureText }: SceneInput): DonutScene {
  const tt = clamp01(t);
  const p = mixPriorities(from, to, tt);
  const emphasis = emphasisAt(from, to, tt);
  const frame: HeroFrame = mode === "hero" ? heroFrame(width, height, measure) : { cx: width / 2, cy: width / 2, R: width / 2 };
  const { cx, cy, R } = frame;
  const { rOut, rIn } = ringRadii(R);
  const spans = ringSpans(p);
  const segments: DonutSegment[] = spans.map((s) => ({
    value: s.value,
    u0: s.u0,
    u1: s.u1,
    p: p[s.value],
    emphasis: emphasis[s.value],
    path: sectorPath(cx, cy, rOut, rIn, s.u0, s.u1),
  }));
  if (mode === "compact") {
    return { mode, width, height: width, cx, cy, R, rIn, segments, labels: [] };
  }

  const top = dominantValue(p);
  const { nameFs, pctFs } = heroFonts(width);
  const boxes: HeroLabel[] = spans.map((s) => {
    const a = ((s.u0 + s.u1) / 2) * TAU;
    const sin = Math.sin(a);
    const cos = Math.cos(a);
    const name = VALUES[s.value].name;
    const pct = percentText(p[s.value]);
    const w = Math.max(measure(name, nameFs, 500), measure(pct, pctFs, 700));
    const h = nameFs * 1.25 + 2 + pctFs * 1.25;
    const ax = cx + (R + LABEL_GAP) * sin;
    const ay = cy - (R + LABEL_GAP) * cos;
    const kx = Math.max(-1, Math.min(1, sin * 2.2));
    const ky = Math.max(-1, Math.min(1, cos * 2.2));
    return {
      value: s.value,
      name,
      pct,
      bold: s.value === top,
      left: ax + (w * (kx - 1)) / 2,
      top: ay - h * (0.5 + 0.5 * ky),
      w,
      h,
      anchor: kx > 0.3 ? "start" : kx < -0.3 ? "end" : "middle",
      x: 0,
      nameY: 0,
      pctY: 0,
      nameFs,
      pctFs,
    };
  });
  nudgeApart(boxes, width, height, { cx, cy, r: R });
  for (const b of boxes) {
    b.x = b.anchor === "start" ? b.left : b.anchor === "end" ? b.left + b.w : b.left + b.w / 2;
    b.nameY = b.top + nameFs * 0.95;
    b.pctY = b.top + nameFs * 1.25 + 2 + pctFs * 0.95;
  }
  return {
    mode,
    width,
    height,
    cx,
    cy,
    R,
    rIn,
    segments,
    labels: boxes,
  };
}

/** Diameter of a mark that sits in the hole, with air between it and the ring. */
export function centerMarkSize(rIn: number): number {
  return Math.round(Math.min(rIn * 0.9, 96));
}

/* -------------------------------------------------------------------------- */
/*  Drawing                                                                   */
/* -------------------------------------------------------------------------- */

/** Segment shapes of a scene. */
export function SegmentPaths({ scene }: { scene: DonutScene }) {
  return (
    <>
      {scene.segments.map((s) => (
        <path key={s.value} d={s.path} fill={DONUT_INK} fillOpacity={s.emphasis} />
      ))}
    </>
  );
}

/** Outside labels of a hero scene. The hole is left empty for the model mark. */
export function HeroText({ scene, opacity = 1 }: { scene: DonutScene; opacity?: number }) {
  if (scene.mode !== "hero" || opacity <= 0) return null;
  return (
    <g style={{ opacity }} fontFamily={FONT_STACK}>
      {scene.labels.map((l) => (
        <g key={l.value} data-donut-label={l.value}>
          <text x={l.x} y={l.nameY} textAnchor={l.anchor} fontSize={l.nameFs} fontWeight={500} fill={DONUT_MUTED}>
            {l.name}
          </text>
          <text x={l.x} y={l.pctY} textAnchor={l.anchor} fontSize={l.pctFs} fontWeight={l.bold ? 700 : 500} fill={l.bold ? DONUT_INK : DONUT_MUTED}>
            {l.pct}
          </text>
        </g>
      ))}
    </g>
  );
}

/** A box exactly covering the hole, centered on the ring. Children fill it. */
export function DonutHole({
  cx,
  cy,
  rIn,
  opacity = 1,
  children,
}: {
  cx: number;
  cy: number;
  rIn: number;
  opacity?: number;
  children: ReactNode;
}) {
  const mark = centerMarkSize(rIn);
  return (
    <div
      className="pointer-events-none absolute"
      style={{ left: cx - mark / 2, top: cy - mark / 2, width: mark, height: mark, opacity }}
    >
      {children}
    </div>
  );
}

export interface DonutProps {
  /** Priorities at t = 0 and t = 1. Pass the same object twice for a still ring. */
  from: Priorities;
  to: Priorities;
  /** 0..1 progress from `from` to `to`; the caller does the easing. */
  t: number;
  mode: DonutMode;
  /** Compact: diameter in px (default 56). */
  size?: number;
  /** Hero: frame size in px. Measured from the parent when omitted. */
  width?: number;
  height?: number;
  /** Fades the outside labels (hero), for a donut that is leaving hero size. */
  labelOpacity?: number;
  title?: string;
  /** Drawn in the hole. Receives the mark diameter in px. Hero only. */
  center?: (mark: number) => ReactNode;
}

export default function Donut({ from, to, t, mode, size = 56, width, height, labelOpacity = 1, title, center }: DonutProps) {
  const ref = useRef<HTMLDivElement>(null);
  const box = useBox(ref);
  useFontEpoch();
  const w = mode === "compact" ? size : (width ?? box.width);
  const h = mode === "compact" ? size : (height ?? box.height);
  const measured = mode === "compact" || (width !== undefined && height !== undefined);
  const scene = w > 0 && h > 0 ? donutScene({ from, to, t, mode, width: w, height: h }) : null;
  const p = mixPriorities(from, to, clamp01(t));
  const label = title ?? `Priorities: ${VALUE_ORDER.map((v) => `${VALUES[v].name} ${percentText(p[v])}`).join(", ")}`;
  return (
    <div
      ref={measured ? undefined : ref}
      className="relative"
      style={measured ? { width: w, height: h } : { width: "100%", height: "100%" }}
      data-donut={mode}
    >
      {scene && (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} className="block">
          <SegmentPaths scene={scene} />
          <HeroText scene={scene} opacity={labelOpacity} />
        </svg>
      )}
      {scene && center && mode === "hero" && (
        <DonutHole cx={scene.cx} cy={scene.cy} rIn={scene.rIn}>
          {center(centerMarkSize(scene.rIn))}
        </DonutHole>
      )}
    </div>
  );
}
