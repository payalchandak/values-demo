import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { DONUT_INK, DONUT_MUTED, FONT_STACK, clamp01 } from "../../components/Donut";
import { VALUE_ORDER } from "../../design";
import Morph from "../../stage/Morph";
import { MORPH_HANDOFF_MS } from "../../stage/morphBeats";
import type { Profile, Value } from "../../study/types";
import { beatStart } from "../../types";
import { easeInOut } from "../ending/shared";
import CasesScene, { CARDS } from "../cases/CasesScene";
import {
  FLY_MS,
  LAND_MS,
  SETTLE_MS,
  SHRINK_MS,
  casesBeats,
  isFast,
  landAt,
  voteAt,
} from "../cases/beats";
import { GPT_TRIALS } from "../cases/data";
import { VOTE_CAPTION } from "./beats";

const SHRINK_AT = beatStart(casesBeats, "shrink");
const VOTE_AT = beatStart(casesBeats, "vote");
const SETTLE_AT = beatStart(casesBeats, "settle");

/** Room left above the pile for its paper edges, and between the pile and the value names, in px. */
const TOP_ROOM = 30;
const NAMES_GAP = 22;
/** Side by side: the bars' column width, the gap before it, and the margin at the viewport's edges, in px. */
const COLUMN_MIN = 230;
const COLUMN_MAX = 440;
/** Beside the bars, votes arc over the value names and drop onto the bars without crossing them: the curve's control point, in px from the bar's left end and above the names. */
const ARC_RIGHT_PX = 50;
const ARC_UP_PX = 90;
const COLUMN_GAP = 24;
const EDGE = 16;
/** Below this card scale, side by side wastes the card: the pile goes above the bars instead. */
const MIN_SIDE_SCALE = 0.6;
/** A vote in flight, in px. */
const VOTE_PX = 11;
/** The pile lifts this far as it leaves, in px. */
const LEAVE_PX = 24;

const ramp = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));
const smooth = (x: number) => x * x * (3 - 2 * x);
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/**
 * One case's vote for each value: how much more Choice 1 favors the value than
 * Choice 2, times how far GPT leaned to Choice 1 (k of 10, centred). Summed over
 * the cases it ranks the values much as the regression does.
 */
const VOTES: Record<Value, number>[] = CARDS.map((card) => {
  const lean = card.gptChoice1 / GPT_TRIALS - 0.5;
  const out = {} as Record<Value, number>;
  for (const v of VALUE_ORDER) out[v] = (card.tags[0][v] - card.tags[1][v]) * lean;
  return out;
});
const TOTAL = Object.fromEntries(
  VALUE_ORDER.map((v) => [v, VOTES.reduce((sum, c) => sum + c[v], 0)]),
) as Record<Value, number>;
const TOP_TOTAL = Math.max(1e-6, ...VALUE_ORDER.map((v) => TOTAL[v]));

interface Box {
  left: number;
  top: number;
  w: number;
  h: number;
}

interface Layout {
  /** This scene's own size: the scene zone, widened to the viewport. */
  root: { w: number; h: number };
  /** The scene zone the next chapter draws in, relative to this scene's box. */
  zone: Box;
  /** The stage, relative to this scene's box. The pile is drawn in it, as the cases chapter drew it. */
  stage: Box;
  /** The pile's card, in stage coordinates, before any transform. */
  card: Box;
  /** Left end and vertical centre of each bar, relative to this scene's box. */
  bars: Record<Value, { x: number; cy: number }>;
  /** Top of the value names, and the line under the bars. */
  namesTop: number;
  captionCy: number;
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.5;
function sameLayout(a: Layout | null, b: Layout): boolean {
  if (!a) return false;
  const boxes = (x: Box, y: Box) => near(x.left, y.left) && near(x.top, y.top) && near(x.w, y.w) && near(x.h, y.h);
  return (
    near(a.root.w, b.root.w) &&
    near(a.root.h, b.root.h) &&
    boxes(a.zone, b.zone) &&
    boxes(a.stage, b.stage) &&
    boxes(a.card, b.card) &&
    near(a.namesTop, b.namesTop) &&
    near(a.captionCy, b.captionCy) &&
    VALUE_ORDER.every((v) => near(a.bars[v].x, b.bars[v].x) && near(a.bars[v].cy, b.bars[v].cy))
  );
}

/** Layout offset of `el` inside `ancestor`, ignoring transforms. */
function offsetWithin(el: HTMLElement, ancestor: HTMLElement): { left: number; top: number } {
  let left = 0;
  let top = 0;
  let node: HTMLElement | null = el;
  while (node && node !== ancestor) {
    left += node.offsetLeft;
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { left, top };
}

function measure(root: HTMLElement, pileHost: HTMLElement | null, probe: HTMLElement | null): Layout | null {
  const stageEl = root.closest<HTMLElement>("[data-stage]");
  const zoneEl = root.parentElement;
  const shell = pileHost?.querySelector<HTMLElement>("[data-pile]");
  if (!stageEl || !zoneEl || !shell || !pileHost || !probe) return null;
  const box = root.getBoundingClientRect();
  const s = stageEl.getBoundingClientRect();
  const z = zoneEl.getBoundingClientRect();
  const at = offsetWithin(shell, pileHost);
  const bars = {} as Layout["bars"];
  let namesTop = Infinity;
  for (const v of VALUE_ORDER) {
    const bar = probe.querySelector(`[data-anchor="bar-${v}"]`);
    const name = probe.querySelector(`[data-anchor="bar-name-${v}"]`);
    if (!bar || !name) return null;
    const r = bar.getBoundingClientRect();
    bars[v] = { x: r.left - box.left, cy: r.top + r.height / 2 - box.top };
    namesTop = Math.min(namesTop, name.getBoundingClientRect().top - box.top);
  }
  const sub = probe.querySelector('[data-anchor="bar-subcaption"]')?.getBoundingClientRect();
  return {
    root: { w: root.clientWidth, h: root.clientHeight },
    zone: { left: z.left - box.left, top: z.top - box.top, w: z.width, h: z.height },
    stage: { left: s.left - box.left, top: s.top - box.top, w: s.width, h: s.height },
    card: { left: at.left, top: at.top, w: shell.offsetWidth, h: shell.offsetHeight },
    bars,
    namesTop,
    captionCy: sub ? sub.top + sub.height / 2 - box.top : namesTop + 200,
  };
}

interface Placement {
  /** Where the bars are drawn while the cases vote, relative to this scene's box. */
  column: Box;
  /** The pile's scale and centre once it has moved. */
  scale: number;
  centre: { x: number; y: number };
  /** Card beside the bars (wide stages), or above them. */
  side: boolean;
}

/**
 * On a wide viewport the card stays as large as it was, up to full size, on the
 * left, and the bars take a narrow column on the right, the two centred
 * together across the viewport. Otherwise the card shrinks above the bars,
 * which keep the scene zone.
 */
function place(layout: Layout): Placement {
  const { card, zone, root } = layout;
  const barsCy = VALUE_ORDER.reduce((sum, v) => sum + layout.bars[v].cy, 0) / VALUE_ORDER.length;

  // The card comes first: the column only grows into room the full-size card leaves.
  const room = root.w - EDGE * 2 - COLUMN_GAP;
  const columnW = Math.min(COLUMN_MAX, Math.max(COLUMN_MIN, room - card.w));
  const sideScale = Math.min(1, (room - columnW) / card.w, (root.h - TOP_ROOM - EDGE) / card.h);
  if (sideScale >= MIN_SIDE_SCALE) {
    const rootW = root.w;
    const rootH = root.h;
    const cardW = card.w * sideScale;
    const left = (rootW - (cardW + COLUMN_GAP + columnW)) / 2;
    const half = (card.h * sideScale) / 2;
    const cy = Math.min(Math.max(barsCy, TOP_ROOM + half), rootH - EDGE - half);
    return {
      column: { left: left + cardW + COLUMN_GAP, top: 0, w: columnW, h: rootH },
      scale: sideScale,
      centre: { x: left + cardW / 2, y: cy },
      side: true,
    };
  }

  const bottom = layout.namesTop - NAMES_GAP;
  const scale = Math.min(1, Math.max(0.2, (bottom - TOP_ROOM) / card.h), (zone.w - 16) / card.w);
  return { column: zone, scale, centre: { x: zone.left + zone.w / 2, y: (TOP_ROOM + bottom) / 2 }, side: false };
}

const lerpBox = (a: Box, b: Box, p: number): Box => ({
  left: lerp(a.left, b.left, p),
  top: lerp(a.top, b.top, p),
  w: lerp(a.w, b.w, p),
  h: lerp(a.h, b.h, p),
});
const boxStyle = (b: Box): CSSProperties => ({ left: b.left, top: b.top, width: b.w, height: b.h });

/**
 * The opening's case, drawn into a card, moves beside (or above) the value bars. Each
 * case then lands on the pile and votes: its choice adds to the values it
 * favored and takes from the ones it went against. The tally grows in the
 * ring's own bars, then settles into the fitted priorities as the pile lifts
 * away, so the last frame is the ring chapter's first.
 */
export default function VoteScene({ elapsedMs, profile }: { elapsedMs: number; profile: Profile }) {
  const t = Math.max(0, elapsedMs);
  const rootRef = useRef<HTMLDivElement>(null);
  const pileRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const next = measure(root, pileRef.current, probeRef.current);
    if (next) setLayout((prev) => (sameLayout(prev, next) ? prev : next));
  });
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const remeasure = () => {
      const next = measure(root, pileRef.current, probeRef.current);
      if (next) setLayout((prev) => (sameLayout(prev, next) ? prev : next));
    };
    const ro = new ResizeObserver(remeasure);
    ro.observe(root);
    void document.fonts?.ready.then(remeasure);
    return () => ro.disconnect();
  }, []);

  // The running tally. Bars show what is above zero, scaled so the leader ends at its own priority.
  const p = profile.priorities;
  const lead = Math.max(...VALUE_ORDER.map((v) => p[v]));
  const settle = easeInOut(ramp(t, SETTLE_AT, SETTLE_AT + SETTLE_MS));
  let counted = 0;
  const running = Object.fromEntries(VALUE_ORDER.map((v) => [v, 0])) as Record<Value, number>;
  CARDS.forEach((_, i) => {
    const w = smooth(ramp(t, isFast(i) ? voteAt(i) : landAt(i) - LAND_MS, landAt(i)));
    if (w >= 0.5) counted += 1;
    for (const v of VALUE_ORDER) running[v] += VOTES[i][v] * w;
  });
  const shares = Object.fromEntries(
    VALUE_ORDER.map((v) => [v, lerp((Math.max(0, running[v]) / TOP_TOTAL) * lead, p[v], settle)]),
  ) as Record<Value, number>;

  const shrink = easeInOut(ramp(t, SHRINK_AT, SHRINK_AT + SHRINK_MS));
  const namesIn = smooth(ramp(t, SHRINK_AT + SHRINK_MS * 0.6, SHRINK_AT + SHRINK_MS + 200));
  const numbersIn = smooth(ramp(t, SETTLE_AT + SETTLE_MS * 0.6, SETTLE_AT + SETTLE_MS));
  const captionIn = smooth(ramp(t, VOTE_AT - 300, VOTE_AT)) * (1 - smooth(ramp(t, SETTLE_AT, SETTLE_AT + SETTLE_MS * 0.5)));
  const leave = smooth(ramp(t, SETTLE_AT, SETTLE_AT + SETTLE_MS * 0.4));
  // Beside the card, the bars wait for it to clear before they move to the centre.
  const regroup = easeInOut(ramp(t, SETTLE_AT + SETTLE_MS * 0.25, SETTLE_AT + SETTLE_MS));

  const placement = layout && place(layout);
  const side = placement?.side ?? false;

  let pileStyle: CSSProperties = {};
  let pileCentre = { x: 0, y: 0 };
  /** Where a card's votes leave from: its right edge beside the bars, its centre above them. */
  let voteFrom = { x: 0, y: 0 };
  if (layout && placement) {
    const { stage, card } = layout;
    const from = { x: stage.left + card.left + card.w / 2, y: stage.top + card.top + card.h / 2 };
    const dx = (placement.centre.x - from.x) * shrink;
    const dy = (placement.centre.y - from.y) * shrink;
    const scale = lerp(1, placement.scale, shrink);
    pileCentre = { x: from.x + dx, y: from.y + dy };
    voteFrom = side ? { x: pileCentre.x + (card.w * scale) / 2, y: pileCentre.y } : pileCentre;
    const away = leave * LEAVE_PX;
    pileStyle = {
      ...boxStyle(stage),
      opacity: 1 - leave,
      transformOrigin: `${card.left + card.w / 2}px ${card.top + card.h / 2}px`,
      transform: `translate(${dx - (side ? away : 0)}px, ${dy - (side ? 0 : away)}px) scale(${scale})`,
    };
  }

  // Only the cases shown at full pace send their votes flying; skipped ones just move the bars.
  const votes =
    layout &&
    CARDS.map((_, i) => {
      if (isFast(i)) return null;
      const fly = ramp(t, voteAt(i), voteAt(i) + FLY_MS);
      if (fly <= 0 || fly >= 1) return null;
      const e = easeInOut(fly);
      const fade = smooth(ramp(fly, 0, 0.15)) * (1 - smooth(ramp(fly, 0.85, 1)));
      return VALUE_ORDER.map((v, k) => {
        const vote = VOTES[i][v];
        if (Math.abs(vote) < 1e-6) return null;
        const spread = (k - 1.5) * VOTE_PX * 2;
        // Beside the bars, votes leave the card's edge in a row above the names.
        const x0 = voteFrom.x + (side ? VOTE_PX + k * VOTE_PX * 2 : spread);
        const y0 = side ? layout.namesTop - ARC_UP_PX / 3 : voteFrom.y;
        const x1 = layout.bars[v].x + VOTE_PX;
        const y1 = layout.bars[v].cy;
        let x = lerp(x0, x1, e);
        let y = lerp(y0, y1, e);
        if (side) {
          const cx = x1 + ARC_RIGHT_PX;
          const cy = layout.namesTop - ARC_UP_PX;
          x = (1 - e) ** 2 * x0 + 2 * (1 - e) * e * cx + e ** 2 * x1;
          y = (1 - e) ** 2 * y0 + 2 * (1 - e) * e * cy + e ** 2 * y1;
        }
        return (
          <div
            key={`${i}-${v}`}
            className="absolute"
            style={{
              left: x - VOTE_PX / 2,
              top: y - VOTE_PX / 2,
              width: VOTE_PX,
              height: VOTE_PX,
              borderRadius: VOTE_PX,
              boxSizing: "border-box",
              background: vote > 0 ? DONUT_INK : "#fff",
              border: `1.5px solid ${DONUT_INK}`,
              opacity: fade,
            }}
          />
        );
      });
    });

  const column = placement?.column;
  // The bars leave their column for the scene zone as the tally settles, so the last frame is the ring's first.
  const barsBox = layout && column && lerpBox(column, layout.zone, side ? regroup : settle);

  return (
    <div className="relative h-full w-full">
      <div
        ref={rootRef}
        className="absolute inset-y-0"
        style={{ left: `calc(50% - 50vw + ${EDGE}px)`, width: `calc(100vw - ${EDGE * 2}px)` }}
      >
        <div ref={probeRef} data-probe aria-hidden className="pointer-events-none invisible absolute" style={column ? boxStyle(column) : { inset: 0 }}>
          <Morph profile={profile} elapsedMs={MORPH_HANDOFF_MS} />
        </div>
        <div className="absolute" style={barsBox ? boxStyle(barsBox) : { inset: 0 }}>
          <Morph
            profile={profile}
            elapsedMs={MORPH_HANDOFF_MS}
            names={namesIn}
            numbers={numbersIn}
            shares={shares}
          />
        </div>
        <div
          ref={pileRef}
          aria-hidden={t >= SETTLE_AT}
          className="pointer-events-none absolute"
          style={layout ? pileStyle : { inset: 0 }}
        >
          <CasesScene elapsedMs={t} />
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-0 z-10">
          {votes}
          {layout && column && (
            <div
              className="absolute text-center"
              style={{
                left: column.left,
                width: column.w,
                top: layout.captionCy,
                transform: "translateY(-50%)",
                fontFamily: FONT_STACK,
                fontSize: 13,
                color: DONUT_MUTED,
                opacity: captionIn,
              }}
            >
              {VOTE_CAPTION(counted, CARDS.length)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
