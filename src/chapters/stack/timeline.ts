import type { StackBeatTimes } from "./beats";

/**
 * Pure timeline: (chapter-local ms, beat times, vote counts) -> frame.
 * No state, no timers, no durations. The same input always gives the same
 * frame, which is what makes pause and seek exact.
 */

export const CARD_W = 280;
export const CARD_H = 196;

/** Queries per model per case: one marker dot each. */
export const TRIALS = 10;
export const DOT_SIZE = 8;
export const DOT_PITCH = 13;

export const FOREGROUND = 3;

/**
 * Everything positional lives in a Layout, in logical stage px. The renderer
 * scales the stage to fit its container and picks `wide` or `tall` from the
 * container's aspect ratio, so phones get a stacked trio and a compact table
 * instead of a landscape stage shrunk to unreadable.
 */
export interface Layout {
  name: "wide" | "tall";
  stageW: number;
  stageH: number;
  center: { x: number; y: number };
  /** Face scale of the hero card, of the shrunk card, and of the foreground trio. */
  heroScale: number;
  fanScale: number;
  trioScale: number;
  /** Foreground trio centres. Card 0 is the first row of the table. */
  trio: readonly { x: number; y: number }[];
  rowW: number;
  rowH: number;
  headerY: number;
  headerH: number;
  rowTops: readonly number[];
  ellipsisY: number;
  countLabelY: number;
  stackLabelY: number;
  /** Narrow row content (value initials, smaller type). */
  compactRows: boolean;
}

export const WIDE: Layout = {
  name: "wide",
  stageW: 1000,
  stageH: 600,
  center: { x: 500, y: 300 },
  heroScale: 2.2,
  fanScale: 1,
  trioScale: 1,
  trio: [
    { x: 180, y: 300 },
    { x: 500, y: 300 },
    { x: 820, y: 300 },
  ],
  rowW: 820,
  rowH: 60,
  headerY: 114,
  headerH: 44,
  rowTops: [166, 240, 314],
  ellipsisY: 410,
  countLabelY: 456,
  stackLabelY: 552,
  compactRows: false,
};

export const TALL: Layout = {
  name: "tall",
  stageW: 400,
  stageH: 680,
  center: { x: 200, y: 310 },
  heroScale: 1.35,
  fanScale: 0.62,
  trioScale: 0.9,
  trio: [
    { x: 200, y: 100 },
    { x: 200, y: 296 },
    { x: 200, y: 492 },
  ],
  rowW: 340,
  rowH: 64,
  headerY: 136,
  headerH: 44,
  rowTops: [192, 270, 348],
  ellipsisY: 458,
  countLabelY: 504,
  stackLabelY: 640,
  compactRows: true,
};

/** Tall for portrait-ish containers, wide otherwise. */
export const layoutFor = (width: number, height: number): Layout => (width < height * 0.9 ? TALL : WIDE);

export interface CardFrame {
  index: number;
  /** Centre and size of the card box, in stage px. */
  cx: number;
  cy: number;
  w: number;
  h: number;
  /** Degrees. */
  rot: number;
  zIndex: number;
  /** Uniform scale applied to the card faces (hero card is bigger). */
  faceScale: number;
  /** 0 to 180. Front face below 90, back face above. */
  flipDeg: number;
  /** Whole-card opacity (background fade). 0 means do not render. */
  opacity: number;
  faceOpacity: number;
  /** Row chrome (border/background) that replaces the faces during the morph. */
  shellOpacity: number;
  rowOpacity: number;
  /**
   * Edge markers: each edge carries one dot per model query (TRIALS). `dots`
   * of them have arrived; the first `choice1Count` of the column are choice 1,
   * the rest choice 2.
   */
  dots: number;
  choice1Count: number;
  markerOpacity: number;
  /** 0..1 fill of the observed-frequency bar. */
  freqFill: number;
  /** 0..1 highlight (only ever non-zero on card 0). */
  highlight: number;
}

export interface StackFrame {
  cards: CardFrame[];
  stackLabel: number;
  headerOpacity: number;
  ellipsisOpacity: number;
  countLabelOpacity: number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** 0..1 progress through the phase that runs from beat `from` to beat `to`. */
function span(t: number, times: StackBeatTimes, from: keyof StackBeatTimes, to: keyof StackBeatTimes) {
  const a = times[from];
  const b = times[to];
  if (b <= a) return t >= b ? 1 : 0;
  return clamp01((t - a) / (b - a));
}

export function computeFrame(
  t: number,
  times: StackBeatTimes,
  /** Queries (out of TRIALS) where the selected model chose choice 1, one per case. */
  choice1Counts: readonly number[],
  layout: Layout,
): StackFrame {
  const L = layout;
  const n = choice1Counts.length;

  const shrinkP = easeInOut(span(t, times, "shrink", "label"));
  const labelLinear = span(t, times, "label", "lift");
  const liftP = easeInOut(span(t, times, "lift", "flip"));
  const flipP = span(t, times, "flip", "settle");
  const unflipP = span(t, times, "unflip", "markers");
  const markersP = span(t, times, "markers", "observed");
  const fadeP = easeInOut(span(t, times, "fade", "morph"));
  const morphP = span(t, times, "morph", "highlight");
  const highlightP = easeInOut(span(t, times, "highlight", "end"));

  const heroScale = lerp(L.heroScale, L.fanScale, shrinkP);

  const cards: CardFrame[] = [];
  for (let i = 0; i < n; i++) {
    const foreground = i < FOREGROUND;

    // Only the foreground trio is drawn. The other cases never fan out.
    // The two side cards wait stacked on the hero, then slide out to the trio.
    let cx = L.center.x;
    let cy = L.center.y;
    let rot = 0;
    let scale = foreground ? heroScale : L.fanScale;
    if (foreground) {
      cx = lerp(cx, L.trio[i].x, liftP);
      cy = lerp(cy, L.trio[i].y, liftP);
      scale = lerp(scale, L.trioScale, liftP);
    }

    // 2. Flip to the tag side, then back to the decision side (foreground only), staggered by card.
    const flipOut = foreground ? easeInOut(clamp01((flipP - i * 0.2) / 0.6)) : 0;
    const flipBack = foreground ? easeInOut(clamp01((unflipP - i * 0.2) / 0.6)) : 0;
    const flipLocal = flipOut - flipBack;

    // 3. Morph into a table row (foreground only), staggered by row.
    const morphLocal = foreground ? easeInOut(clamp01((morphP - i * 0.12) / 0.76)) : 0;
    const row = foreground ? L.rowTops[i] + L.rowH / 2 : 0;
    cx = foreground ? lerp(cx, L.center.x, morphLocal) : cx;
    cy = foreground ? lerp(cy, row, morphLocal) : cy;
    const w = lerp(CARD_W * scale, L.rowW, morphLocal);
    const h = lerp(CARD_H * scale, L.rowH, morphLocal);

    // Faces give way to the row shell early in the morph; row content arrives late.
    const swap = clamp01(morphLocal / 0.25);
    const rowOpacity = clamp01((morphLocal - 0.6) / 0.35);

    // 4. Edge markers accumulate across the foreground trio.
    const delay = foreground ? (i / (FOREGROUND + 2)) * 0.55 : 1;
    const local = !foreground || t < times.markers ? 0 : clamp01((markersP - delay) / 0.45);
    const dots = Math.round(TRIALS * local);
    const markerOpacity = 1 - clamp01(morphLocal / 0.3);

    cards.push({
      index: i,
      cx,
      cy,
      w,
      h,
      rot,
      zIndex: foreground ? 1000 - i : 0,
      faceScale: scale,
      flipDeg: flipLocal * 180,
      opacity: foreground ? 1 : 0,
      faceOpacity: 1 - swap,
      shellOpacity: swap,
      rowOpacity,
      dots,
      choice1Count: choice1Counts[i],
      markerOpacity,
      freqFill: i < FOREGROUND ? easeOut(clamp01((morphLocal - 0.55) / 0.45)) : 0,
      highlight: i === 0 ? highlightP : 0,
    });
  }

  return {
    cards,
    stackLabel: easeOut(clamp01((labelLinear - 0.4) / 0.6)) * (1 - fadeP),
    headerOpacity: clamp01((morphP - 0.5) / 0.4),
    ellipsisOpacity: clamp01((morphP - 0.6) / 0.3),
    countLabelOpacity: clamp01((morphP - 0.75) / 0.25),
  };
}
