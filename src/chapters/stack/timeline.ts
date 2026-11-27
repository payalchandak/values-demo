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
  /** Face scale of the hero card, of every card in the grid, and of the foreground trio. */
  heroScale: number;
  gridScale: number;
  trioScale: number;
  /** The grid of all cards: columns, and the gaps between cards (wide enough for the edge dots). */
  gridCols: number;
  gridGapX: number;
  gridGapY: number;
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
  gridScale: 0.32,
  trioScale: 1,
  gridCols: 9,
  gridGapX: 16,
  gridGapY: 12,
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
  gridScale: 0.24,
  trioScale: 0.9,
  gridCols: 5,
  gridGapX: 12,
  gridGapY: 12,
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

/**
 * Grid slots for all n cards. Card i takes the i-th slot out from the centre,
 * so card 0 (the hero) lands in the middle, the next two sit beside it, and
 * the rest spread outward. Flip and dot order follow the card index, so
 * both radiate from the middle.
 */
function gridSlots(n: number, layout: Layout) {
  const cols = Math.min(layout.gridCols, n);
  const rows = Math.ceil(n / cols);
  const pitchX = CARD_W * layout.gridScale + layout.gridGapX;
  const pitchY = CARD_H * layout.gridScale + layout.gridGapY;
  const slots: { x: number; y: number; d: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = layout.center.x + (c - (cols - 1) / 2) * pitchX;
      const y = layout.center.y + (r - (rows - 1) / 2) * pitchY;
      slots.push({ x, y, d: Math.hypot(x - layout.center.x, y - layout.center.y) });
    }
  }
  return slots.sort((a, b) => a.d - b.d).slice(0, n);
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
  const slots = gridSlots(n, L);

  const turnP = easeInOut(span(t, times, "turn", "values"));
  const shrinkP = easeInOut(span(t, times, "shrink", "reveal"));
  const revealP = span(t, times, "reveal", "grid");
  const flipP = span(t, times, "flip", "settle");
  const markersP = span(t, times, "markers", "observed");
  const gatherP = easeInOut(span(t, times, "gather", "morph"));
  const morphP = span(t, times, "morph", "highlight");
  const highlightP = easeInOut(span(t, times, "highlight", "end"));
  const labelP = span(t, times, "shrink", "reveal");

  const cards: CardFrame[] = [];
  for (let i = 0; i < n; i++) {
    const foreground = i < FOREGROUND;
    // 0 for the first card, 1 for the last: how far out from the middle this card sits.
    const rank = n > 1 ? i / (n - 1) : 0;
    const slot = slots[i];

    // 1. Placement. The hero starts big in the middle and shrinks into its slot.
    //    Every other card sits in its slot and fades in during the reveal, from the middle out.
    let cx = i === 0 ? lerp(L.center.x, slot.x, shrinkP) : slot.x;
    let cy = i === 0 ? lerp(L.center.y, slot.y, shrinkP) : slot.y;
    let scale = i === 0 ? lerp(L.heroScale, L.gridScale, shrinkP) : L.gridScale;
    const base = i === 0 ? 1 : easeOut(clamp01((revealP - rank * 0.7) / 0.3));
    // The first three leave the grid for the trio; the rest fade away as they go.
    if (foreground) {
      cx = lerp(cx, L.trio[i].x, gatherP);
      cy = lerp(cy, L.trio[i].y, gatherP);
      scale = lerp(scale, L.trioScale, gatherP);
    }
    const opacity = foreground ? base : base * (1 - clamp01(gatherP * 1.5));
    const rot = 0;

    // 2. Flip every card to the tag side one after another. They stay there while the
    //    decisions arrive; only the trio flips back, as it leaves the grid.
    const flipOut = easeInOut(clamp01((flipP - rank * 0.55) / 0.45));
    //    The hero also turns over once at the start (turnP), and back as it shrinks (shrinkP).
    const heroTurn = i === 0 ? turnP - shrinkP : 0;
    const flipLocal = flipOut + heroTurn - (foreground ? gatherP : 0);

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

    // 4. Edge markers accumulate across every card, spreading out from the middle.
    const local = t < times.markers ? 0 : clamp01((markersP - rank * 0.55) / 0.45);
    const dots = Math.round(TRIALS * local);
    const markerOpacity = 1 - clamp01(morphLocal / 0.3);

    cards.push({
      index: i,
      cx,
      cy,
      w,
      h,
      rot,
      zIndex: foreground ? 1000 - i : 500 - i,
      faceScale: scale,
      flipDeg: flipLocal * 180,
      opacity,
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
    stackLabel: easeOut(clamp01((labelP - 0.4) / 0.6)) * (1 - clamp01(gatherP * 1.5)),
    headerOpacity: clamp01((morphP - 0.5) / 0.4),
    ellipsisOpacity: clamp01((morphP - 0.6) / 0.3),
    countLabelOpacity: clamp01((morphP - 0.75) / 0.25),
  };
}
