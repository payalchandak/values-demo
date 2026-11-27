import type { StackBeatTimes } from "./beats";

/**
 * Pure timeline: (chapter-local ms, beat times, vote counts) -> frame.
 * No state, no timers, no durations. The same input always gives the same
 * frame, which is what makes pause and seek exact.
 */

/** Logical stage size. The renderer scales this box to fit its container. */
export const STAGE_W = 1000;
export const STAGE_H = 600;

export const CARD_W = 280;
export const CARD_H = 196;
/** Scale of the single hero card before it shrinks to stack size. */
export const HERO_SCALE = 2.2;

export const VOTES_TOTAL = 25;
export const DOT_PITCH = 7;

/** Fan geometry: cards rotate about a pivot below the stack. */
const CENTER = { x: STAGE_W / 2, y: 300 };
const FAN_RADIUS = 300;
const FAN_HALF_ANGLE = 34; // degrees
const FAN_MAX_STEP = 4; // degrees between neighbouring cards
const PIVOT = { x: CENTER.x, y: CENTER.y + FAN_RADIUS };

/** Foreground trio, left to right. Card 0 is the first row of the table. */
const TRIO_X = [CENTER.x - 320, CENTER.x, CENTER.x + 320];

/** Table geometry. */
export const ROW_W = 820;
export const ROW_H = 60;
export const HEADER_Y = 114;
export const HEADER_H = 44;
const ROW_TOPS = [166, 240, 314];
export const ELLIPSIS_Y = 410;
export const COUNT_LABEL_Y = 456;
export const STACK_LABEL_Y = 552;

export const FOREGROUND = 3;

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
   * Edge markers: each edge carries one dot per physician vote. `dots` of the
   * VOTES_TOTAL have arrived; the first `choice1Votes` of the column are
   * choice 1, the rest choice 2.
   */
  dots: number;
  choice1Votes: number;
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
 * Fan slots for the background cards. Cases 1..n-1 take slots from the
 * middle outward, so cases 1 and 2 sit just behind the first card and are
 * the ones that lift out to join the foreground trio.
 */
function fanSlots(backgroundCount: number) {
  const mid = (backgroundCount - 1) / 2;
  const step = backgroundCount > 1 ? Math.min((2 * FAN_HALF_ANGLE) / (backgroundCount - 1), FAN_MAX_STEP) : 0;
  const order = Array.from({ length: backgroundCount }, (_, j) => j).sort((p, q) => {
    const dp = Math.abs(p - mid);
    const dq = Math.abs(q - mid);
    return dp !== dq ? dp - dq : q - p;
  });
  // order[k] = slot index for background card k (case k + 1).
  return order.map((j) => ({ slot: j, angle: (j - mid) * step, depth: Math.abs(j - mid) }));
}

const onArc = (angleDeg: number) => {
  const r = (angleDeg * Math.PI) / 180;
  return { x: PIVOT.x + FAN_RADIUS * Math.sin(r), y: PIVOT.y - FAN_RADIUS * Math.cos(r) };
};

export function computeFrame(
  t: number,
  times: StackBeatTimes,
  /** Physician votes for choice 1 (out of VOTES_TOTAL), one per case. */
  votesChoice1: readonly number[],
): StackFrame {
  const n = votesChoice1.length;
  const slots = fanSlots(n - 1);

  const shrinkP = easeInOut(span(t, times, "shrink", "fan"));
  const fanLinear = span(t, times, "fan", "markers");
  const fanP = easeInOut(fanLinear);
  const markersP = span(t, times, "markers", "lift");
  const liftP = easeInOut(span(t, times, "lift", "flip"));
  const flipP = span(t, times, "flip", "fade");
  const fadeP = easeInOut(span(t, times, "fade", "morph"));
  const morphP = span(t, times, "morph", "highlight");
  const highlightP = easeInOut(span(t, times, "highlight", "end"));

  const heroScale = lerp(HERO_SCALE, 1, shrinkP);
  const backgroundOpacity = t < times.fan ? 0 : 1 - fadeP;

  const cards: CardFrame[] = [];
  for (let i = 0; i < n; i++) {
    const foreground = i < FOREGROUND;
    const slot = i > 0 ? slots[i - 1] : undefined;

    // 1. Base placement: hero card, fan slot, or trio slot.
    let cx = CENTER.x;
    let cy = CENTER.y;
    let rot = 0;
    let scale = i === 0 ? heroScale : 1;
    if (slot) {
      const angle = slot.angle * fanP;
      const p = onArc(angle);
      cx = p.x;
      cy = p.y;
      rot = angle;
    }
    if (foreground) {
      cx = lerp(cx, TRIO_X[i], liftP);
      cy = lerp(cy, CENTER.y, liftP);
      rot = lerp(rot, 0, liftP);
    }

    // 2. Flip (foreground only): staggered across the flip phase.
    const flipLocal = foreground ? easeInOut(clamp01((flipP - i * 0.2) / 0.6)) : 0;

    // 3. Morph into a table row (foreground only), staggered by row.
    const morphLocal = foreground ? easeInOut(clamp01((morphP - i * 0.12) / 0.76)) : 0;
    const row = foreground ? ROW_TOPS[i] + ROW_H / 2 : 0;
    cx = foreground ? lerp(cx, CENTER.x, morphLocal) : cx;
    cy = foreground ? lerp(cy, row, morphLocal) : cy;
    const w = lerp(CARD_W * scale, ROW_W, morphLocal);
    const h = lerp(CARD_H * scale, ROW_H, morphLocal);

    // Faces give way to the row shell early in the morph; row content arrives late.
    const swap = clamp01(morphLocal / 0.25);
    const rowOpacity = clamp01((morphLocal - 0.6) / 0.35);

    // 4. Edge markers accumulate left to right across the stack; the foreground trio leads.
    const rank = foreground ? i : FOREGROUND + (slot?.slot ?? 0);
    const delay = (rank / (n + FOREGROUND)) * 0.55;
    const local = t < times.markers ? 0 : clamp01((markersP - delay) / 0.45);
    const dots = Math.round(VOTES_TOTAL * local);
    const markerOpacity = 1 - clamp01(morphLocal / 0.3);

    const bgOpacity = foreground ? 1 : backgroundOpacity;

    cards.push({
      index: i,
      cx,
      cy,
      w,
      h,
      rot,
      zIndex: foreground ? 1000 - i : 500 - (slot?.depth ?? 0),
      faceScale: scale,
      flipDeg: flipLocal * 180,
      opacity: bgOpacity,
      faceOpacity: 1 - swap,
      shellOpacity: swap,
      rowOpacity,
      dots,
      choice1Votes: votesChoice1[i],
      markerOpacity,
      freqFill: i < FOREGROUND ? easeOut(clamp01((morphLocal - 0.55) / 0.45)) : 0,
      highlight: i === 0 ? highlightP : 0,
    });
  }

  return {
    cards,
    stackLabel: easeOut(clamp01((fanLinear - 0.4) / 0.6)) * (1 - fadeP),
    headerOpacity: clamp01((morphP - 0.5) / 0.4),
    ellipsisOpacity: clamp01((morphP - 0.6) / 0.3),
    countLabelOpacity: clamp01((morphP - 0.75) / 0.25),
  };
}
