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

/** Extra height, at natural size, the first card gets for its decision row and caption. */
export const HERO_EXTRA = 46;
/** The first card's decision dots: the first lands this long into the chapter, then one per step. */
export const DECISION_START_MS = 250;
export const DECISION_STEP_MS = 100;
/** Each dot fades in over this long. */
export const DECISION_FADE_MS = 80;

/**
 * Everything positional lives in a Layout, in logical stage px. The renderer
 * scales the stage to fit its container and picks `wide` or `tall` from the
 * container's aspect ratio, so phones get a compact table
 * instead of a landscape stage shrunk to unreadable.
 */
export interface Layout {
  name: "wide" | "tall";
  stageW: number;
  stageH: number;
  center: { x: number; y: number };
  /** Face scale of the hero card, and of every card in the grid. */
  heroScale: number;
  gridScale: number;
  /** The grid of all cards: columns, and the gaps between cards (wide enough for the edge dots). */
  gridCols: number;
  gridGapX: number;
  gridGapY: number;
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
  gridCols: 9,
  gridGapX: 16,
  gridGapY: 12,
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
  gridCols: 5,
  gridGapX: 12,
  gridGapY: 12,
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

/** Room left of the leftmost card for its decision dots, and a matching inset on the right. */
const GRID_EDGE = DOT_SIZE + 10;
const GRID_GAP_X = 22;
const GRID_GAP_Y = 16;

/**
 * Widescreen grid: the largest cards that still fill the host. The stage is the
 * host itself (the renderer then scales by 1), so a wide monitor gets wide cards
 * instead of a fixed 1000×600 frame letterboxed in the middle.
 */
function wideLayout(width: number, height: number, n: number): Layout {
  const innerW = Math.max(80, width - GRID_EDGE * 2);
  const innerH = Math.max(80, height - 16);
  let best: { cols: number; scale: number; fill: number } | null = null;
  const colsMax = Math.min(14, Math.max(1, n));
  for (let cols = 4; cols <= colsMax; cols++) {
    const rows = Math.ceil(n / cols);
    const gapsX = (cols - 1) * GRID_GAP_X;
    const gapsY = (rows - 1) * GRID_GAP_Y;
    if (gapsX >= innerW || gapsY >= innerH) continue;
    const scale = Math.min((innerW - gapsX) / (cols * CARD_W), (innerH - gapsY) / (rows * CARD_H));
    if (scale <= 0) continue;
    const gridW = cols * CARD_W * scale + gapsX;
    const gridH = rows * CARD_H * scale + gapsY;
    const cand = { cols, scale, fill: (gridW * gridH) / (innerW * innerH) };
    // Prefer bigger cards. Within a few percent, prefer the grid that covers more of the screen.
    if (
      !best ||
      cand.scale > best.scale * 1.04 ||
      (cand.scale >= best.scale * 0.96 && cand.fill > best.fill)
    ) {
      best = cand;
    }
  }
  const picked = best ?? { cols: Math.min(9, n), scale: 0.32, fill: 0 };
  const gridScale = Math.min(1.25, picked.scale);
  const heroScale = Math.max(
    gridScale,
    Math.min(2.35, ((width - GRID_EDGE * 2) * 0.7) / CARD_W, ((height - 16) * 0.82) / (CARD_H + HERO_EXTRA)),
  );
  const rowW = Math.round(Math.min(1120, Math.max(560, width - 48)));
  const compactRows = rowW < 760;
  const rowH = compactRows ? 56 : 64;
  const headerH = compactRows ? 40 : 48;
  const headerY = 16;
  const rowGap = 12;
  const firstRow = headerY + headerH + 8;
  const rowTops = [0, 1, 2].map((i) => firstRow + i * (rowH + rowGap));
  const ellipsisY = rowTops[2] + rowH + 28;
  return {
    name: "wide",
    stageW: width,
    stageH: height,
    center: { x: width / 2, y: height / 2 },
    heroScale,
    gridScale,
    gridCols: picked.cols,
    gridGapX: GRID_GAP_X,
    gridGapY: GRID_GAP_Y,
    rowW,
    rowH,
    headerY,
    headerH,
    rowTops,
    ellipsisY,
    countLabelY: ellipsisY + 32,
    stackLabelY: height - 8,
    compactRows,
  };
}

/** Tall for portrait-ish containers. Widescreen builds a grid that fills the host. */
export const layoutFor = (width: number, height: number, count = 50): Layout => {
  if (width < 1 || height < 1) return WIDE;
  return width < height * 0.9 ? TALL : wideLayout(width, height, count);
};

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
  /** Card body (border/background) that stands in for the faces once the contents leave. */
  shellOpacity: number;
  /** Corner radius and border width of that body, in stage px. */
  shellRadius: number;
  shellBorder: number;
  /** Where the card sat in the grid: the contents start their journey here. */
  slotX: number;
  slotY: number;
  /**
   * 0..1 linear progress of this card's contents travelling to the table.
   * While it is above 0 and below 1 the contents are drawn as free-flying parts.
   */
  fly: number;
  /** True from the first moment of this card's journey: its faces and edge dots are replaced by parts. */
  flying: boolean;
  /** The finished row's own content (short name, tags, bar). Only the first three cards have one. */
  rowOpacity: number;
  /**
   * Edge markers: each edge carries one dot per model query (TRIALS). `dots`
   * of them have arrived; the first `choice1Count` of the column are choice 1,
   * the rest choice 2.
   */
  dots: number;
  choice1Count: number;
  markerOpacity: number;
  /** Natural-size extra height of the face (the first card's decision row), shrinking to 0 with the card. */
  extraH: number;
  /** Chapter ms since the first decision dot was due, and the row's opacity (only card 0 shows a row). */
  decisionMs: number;
  decisionOpacity: number;
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

/** Where each part of the table journey starts, as shares of the gather beat. */
const FLY_LEAD = 0.14;
const FLY_CASE = 0.22;
const FLY_WAVE = FLY_LEAD + FOREGROUND * FLY_CASE;

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

  const shrinkP = easeInOut(span(t, times, "shrink", "reveal"));
  const revealP = span(t, times, "reveal", "grid");
  const flipP = span(t, times, "flip", "settle");
  const markersP = span(t, times, "markers", "observed");
  // The grid becomes the table one case at a time: the first three cards, one after
  // another, each into its own row; then everything else sweeps into the ellipsis.
  const flyP = span(t, times, "gather", "morph");
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
    const slotX = i === 0 ? lerp(L.center.x, slot.x, shrinkP) : slot.x;
    const slotY = i === 0 ? lerp(L.center.y, slot.y, shrinkP) : slot.y;
    const scale = i === 0 ? lerp(L.heroScale, L.gridScale, shrinkP) : L.gridScale;
    const base = i === 0 ? 1 : easeOut(clamp01((revealP - rank * 0.7) / 0.3));

    // 2. Flip every card to the tag side one after another. They stay there while the
    //    decisions arrive and while their contents leave for the table.
    const flipOut = easeInOut(clamp01((flipP - rank * 0.55) / 0.45));
    //    The hero also turns over once at the start (turnP), and back as it shrinks (shrinkP).
    const heroTurn = i === 0 ? 1 - shrinkP : 0;
    const flipLocal = flipOut + heroTurn;

    // 3. The journey. Strictly one case at a time for the rows, then a quick wave for the rest.
    const fly = foreground
      ? clamp01((flyP - (FLY_LEAD + i * FLY_CASE)) / FLY_CASE)
      : clamp01((flyP - (FLY_WAVE + rank * 0.08)) / 0.12);
    const flyingNow = fly > 0;
    const arrived = fly >= 1;
    const eased = easeInOut(fly);

    // A card widens into its table row as its turn starts. The rest dim while they wait, then empty out and fade.
    const rowCy = foreground ? L.rowTops[i] + L.rowH / 2 : 0;
    const widen = foreground ? easeInOut(clamp01(fly / 0.3)) : 0;
    const cx = lerp(slotX, L.center.x, widen);
    const cy = foreground ? lerp(slotY, rowCy, widen) : slotY;
    const w = foreground ? lerp(CARD_W * scale, L.rowW, widen) : CARD_W * scale;
    const h = foreground ? lerp(CARD_H * scale, L.rowH, widen) : CARD_H * scale;
    const waiting = foreground ? 1 : 1 - 0.88 * clamp01((flyP - 0.02) / 0.1);
    const opacity = foreground ? base : base * waiting * (1 - clamp01(eased * 1.8));

    // 4. Edge markers accumulate across every card, spreading out from the middle.
    const local = t < times.markers ? 0 : clamp01((markersP - rank * 0.55) / 0.45);
    //    The hero carries no edge dots at first (its decisions are a row inside the card); it joins the rest at the markers beat.
    const dots = Math.round(TRIALS * local);

    cards.push({
      index: i,
      cx,
      cy,
      w,
      h,
      rot: 0,
      zIndex: foreground ? 1000 - i : 500 - i,
      faceScale: scale,
      flipDeg: flipLocal * 180,
      opacity,
      faceOpacity: flyingNow ? 0 : 1,
      shellOpacity: flyingNow ? 1 : 0,
      shellRadius: lerp(12 * scale, 12, widen),
      shellBorder: lerp(scale, 1, widen),
      slotX,
      slotY,
      fly,
      flying: flyingNow,
      rowOpacity: foreground && arrived ? 1 : 0,
      dots,
      choice1Count: choice1Counts[i],
      markerOpacity: flyingNow ? 0 : 1,
      extraH: i === 0 ? HERO_EXTRA * (1 - shrinkP) : 0,
      decisionMs: t - DECISION_START_MS,
      decisionOpacity: i === 0 ? 1 - clamp01(shrinkP / 0.35) : 0,
      freqFill: foreground && arrived ? 1 : 0,
      highlight: i === 0 ? highlightP : 0,
    });
  }

  return {
    cards,
    stackLabel: easeOut(clamp01((labelP - 0.4) / 0.6)) * (1 - clamp01(flyP * 12)),
    headerOpacity: clamp01((flyP - 0.02) / 0.1),
    ellipsisOpacity: clamp01((flyP - 0.88) / 0.12),
    countLabelOpacity: clamp01((flyP - 0.9) / 0.1),
  };
}

/* -------------------------------------------------------------------------- */
/*  Where the contents of a row land                                           */
/* -------------------------------------------------------------------------- */

/**
 * Column widths of a table row, shared by the row's own content and the parts that fly into it.
 * Wide `caseW` fits the longest short name ("BRCA embryo screening", 165px at 14px) on one line.
 * Compact `caseW` is the same goal at 12px; `rowGrid` shrinks it when the row is too narrow to spare it.
 */
export const ROW_GRID = {
  wide: { pad: 20, caseW: 180, valueW: 96, freqPad: 20, gap: 12, countW: 48, chipW: 44, chipH: 26, barH: 10, chipRadius: 8, text: 14 },
  compact: { pad: 12, caseW: 156, valueW: 32, freqPad: 10, gap: 8, countW: 36, chipW: 26, chipH: 22, barH: 8, chipRadius: 6, text: 12 },
} as const;

/** Shortest decision bar kept when a narrow row gives width to the case name. */
const MIN_BAR = 36;

/** The row's columns for this layout. Narrow rows keep a bar and give the rest to the name. */
export function rowGrid(L: Layout) {
  const g = L.compactRows ? ROW_GRID.compact : ROW_GRID.wide;
  if (!L.compactRows) return g;
  const reserved = 2 * g.pad + 4 * g.valueW + g.freqPad + g.gap + g.countW + MIN_BAR;
  const caseW = Math.min(g.caseW, Math.max(88, L.rowW - reserved));
  return { ...g, caseW };
}

/** Positions, in stage px, of every item in one table row (or in a row-shaped place). */
export interface RowTargets {
  /** Left edge and vertical centre of the case's short name. */
  caseX: number;
  caseW: number;
  cy: number;
  /** Horizontal centre of each value's cell, in `VALUES` order. */
  chipX: readonly number[];
  chipW: number;
  chipH: number;
  chipRadius: number;
  /** The decision bar. */
  barX: number;
  barW: number;
  barH: number;
  /** Right edge of the "k/10" count. */
  countRight: number;
  countW: number;
  text: number;
}

/** Where the items of a table row land, for a row whose vertical centre is `cy`. */
export function rowTargets(L: Layout, cy: number): RowTargets {
  const g = rowGrid(L);
  const left = (L.stageW - L.rowW) / 2;
  const valuesLeft = left + g.pad + g.caseW;
  const freqLeft = valuesLeft + 4 * g.valueW;
  const freqW = L.rowW - 2 * g.pad - g.caseW - 4 * g.valueW;
  return {
    caseX: left + g.pad,
    caseW: g.caseW,
    cy,
    chipX: [0, 1, 2, 3].map((v) => valuesLeft + g.valueW * v + g.valueW / 2),
    chipW: g.chipW,
    chipH: g.chipH,
    chipRadius: g.chipRadius,
    barX: freqLeft + g.freqPad,
    barW: freqW - g.freqPad - g.gap - g.countW,
    barH: g.barH,
    countRight: freqLeft + freqW,
    countW: g.countW,
    text: g.text,
  };
}
