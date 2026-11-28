import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { clamp01 } from "../../components/Donut";
import { VALUE_ORDER } from "../../design";
import Morph, { restingRowYs } from "../../stage/Morph";
import { MORPH_HANDOFF_MS } from "../../stage/morphBeats";
import type { Profile, Tag, Value } from "../../study/types";
import { beatStart } from "../../types";
import { HERO_CHROME } from "../ending/IndividualModels";
import { easeInOut } from "../ending/shared";
import CasesScene, { CARDS } from "../cases/CasesScene";
import {
  LAND_MS,
  SETTLE_MS,
  SHRINK_MS,
  VOTE_FLY_MS,
  casesBeats,
  isFast,
  landAt,
  valueLandAt,
  valueVoteAt,
  voteAt,
} from "../cases/beats";
import { castsVote, SHOWN_BAR, votesOf } from "../cases/votes";
import { RelationPill } from "../opening/OpeningScene";

const SHRINK_AT = beatStart(casesBeats, "shrink");
const SETTLE_AT = beatStart(casesBeats, "settle");

/** Room left above the pile for its paper edges, and between the pile and the value names, in px. */
const TOP_ROOM = 30;
const NAMES_GAP = 22;
/** Side by side: the bars' column width, the gap before it, and the margin at the viewport's edges, in px. */
const COLUMN_MIN = 230;
const COLUMN_MAX = 440;
/** How far past the card a judgment travels before it bends toward its bar, in px. */
const EXIT_PX = 36;
const COLUMN_GAP = 24;
const EDGE = 16;
/** Below this card scale, side by side wastes the card: the pile goes above the bars instead. */
const MIN_SIDE_SCALE = 0.6;
/** The pile lifts this far as it leaves, in px. */
const LEAVE_PX = 24;

const ramp = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));
const smooth = (x: number) => x * x * (3 - 2 * x);
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/**
 * One case's vote for each value. Summed over the cases it ranks the values
 * much as the regression does.
 */
const VOTES: Record<Value, number>[] = CARDS.map((card) => votesOf(card));
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
  /** Top of the value names. */
  namesTop: number;
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
  return {
    root: { w: root.clientWidth, h: root.clientHeight },
    zone: { left: z.left - box.left, top: z.top - box.top, w: z.width, h: z.height },
    stage: { left: s.left - box.left, top: s.top - box.top, w: s.width, h: s.height },
    card: { left: at.left, top: at.top, w: shell.offsetWidth, h: shell.offsetHeight },
    bars,
    namesTop,
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

interface ValueRows {
  /** Y centre of each value, in this scene's box. */
  scene: number[];
  /** Same centres, in the bars' frame. */
  frame: number[];
  /** Distance between centres while they span the card. */
  pitch: number;
}

/**
 * Beside the card, the four values split its height evenly: the same gap from
 * the card's top to the first name, between names, and from the last name to
 * the card's bottom. As the tally settles they ease back onto the ring's
 * resting rows, so the last frame is still the ring's first.
 */
function valueRows(layout: Layout, placement: Placement, barsBox: Box, regroup: number): ValueRows | null {
  if (!placement.side) return null;
  const pitch = (layout.card.h * placement.scale) / VALUE_ORDER.length;
  const home = restingRowYs(layout.zone.w, Math.max(0, layout.zone.h - HERO_CHROME));
  const scene = VALUE_ORDER.map((_, i) => {
    const along = placement.centre.y + (i - 1.5) * pitch;
    return lerp(along, layout.zone.top + home[i], regroup);
  });
  return { scene, frame: scene.map((y) => y - barsBox.top), pitch };
}

interface PillAt {
  value: Value;
  tag: Tag;
  x: number;
  y: number;
  font: number;
}

function isValue(s: string | undefined): s is Value {
  return s === "A" || s === "B" || s === "N" || s === "J";
}

function isTag(n: number): n is Tag {
  return n === -1 || n === 0 || n === 1;
}

/** Where each voting pill sits, in this scene's box. The anchor is unscaled, so the flight starts on the pill. */
function measurePills(root: HTMLElement, pile: HTMLElement | null): PillAt[] {
  if (!pile) return [];
  const box = root.getBoundingClientRect();
  const out: PillAt[] = [];
  pile.querySelectorAll<HTMLElement>("[data-vote-pill]").forEach((el) => {
    const value = el.dataset.votePill;
    const tag = Number(el.dataset.voteTag);
    if (!isValue(value) || !isTag(tag)) return;
    const rect = el.getBoundingClientRect();
    const css = parseFloat(getComputedStyle(el).fontSize);
    const scale = el.offsetHeight > 0 ? rect.height / el.offsetHeight : 1;
    out.push({
      value,
      tag,
      x: rect.left + rect.width / 2 - box.left,
      y: rect.top + rect.height / 2 - box.top,
      font: (Number.isFinite(css) ? css : 13) * scale,
    });
  });
  return out;
}

function samePills(a: readonly PillAt[], b: readonly PillAt[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((p, i) => {
    const q = b[i];
    return p.value === q.value && p.tag === q.tag && near(p.x, q.x) && near(p.y, q.y) && near(p.font, q.font);
  });
}

const quad = (a: number, c: number, b: number, e: number) => (1 - e) ** 2 * a + 2 * (1 - e) * e * c + e ** 2 * b;

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
  const [pills, setPills] = useState<PillAt[]>([]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const next = measure(root, pileRef.current, probeRef.current);
    if (next) setLayout((prev) => (sameLayout(prev, next) ? prev : next));
    const nextPills = measurePills(root, pileRef.current);
    setPills((prev) => (samePills(prev, nextPills) ? prev : nextPills));
  });
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const remeasure = () => {
      const next = measure(root, pileRef.current, probeRef.current);
      if (next) setLayout((prev) => (sameLayout(prev, next) ? prev : next));
      const nextPills = measurePills(root, pileRef.current);
      setPills((prev) => (samePills(prev, nextPills) ? prev : nextPills));
    };
    const ro = new ResizeObserver(remeasure);
    ro.observe(root);
    void document.fonts?.ready.then(remeasure);
    return () => ro.disconnect();
  }, []);

  // The running tally. Bars show what is above zero, scaled so the leader ends at its own priority.
  // Watched cases (the first three and the last) also add a fixed step for each
  // promote and each violate, so the landing itself is visible before the settle.
  const p = profile.priorities;
  const lead = Math.max(...VALUE_ORDER.map((v) => p[v]));
  const settle = easeInOut(ramp(t, SETTLE_AT, SETTLE_AT + SETTLE_MS));
  const running = Object.fromEntries(VALUE_ORDER.map((v) => [v, 0])) as Record<Value, number>;
  const shown = Object.fromEntries(VALUE_ORDER.map((v) => [v, 0])) as Record<Value, number>;
  CARDS.forEach((card, i) => {
    VALUE_ORDER.forEach((v, k) => {
      const arrive = isFast(i) ? landAt(i) : valueLandAt(i, k);
      const begin = isFast(i) ? voteAt(i) : arrive - LAND_MS;
      const w = smooth(ramp(t, begin, arrive));
      running[v] += VOTES[i][v] * w;
      if (!isFast(i) && castsVote(card, v)) shown[v] += SHOWN_BAR * w;
    });
  });
  const shares = Object.fromEntries(
    VALUE_ORDER.map((v) => [
      v,
      lerp(Math.min(1, (Math.max(0, running[v]) / TOP_TOTAL) * lead + shown[v]), p[v], settle),
    ]),
  ) as Record<Value, number>;

  const shrink = easeInOut(ramp(t, SHRINK_AT, SHRINK_AT + SHRINK_MS));
  const namesIn = smooth(ramp(t, SHRINK_AT + SHRINK_MS * 0.6, SHRINK_AT + SHRINK_MS + 200));
  const numbersIn = smooth(ramp(t, SETTLE_AT + SETTLE_MS * 0.6, SETTLE_AT + SETTLE_MS));
  const leave = smooth(ramp(t, SETTLE_AT, SETTLE_AT + SETTLE_MS * 0.4));
  // Beside the card, the bars wait for it to clear before they move to the centre.
  const regroup = easeInOut(ramp(t, SETTLE_AT + SETTLE_MS * 0.25, SETTLE_AT + SETTLE_MS));

  const placement = layout && place(layout);
  const side = placement?.side ?? false;

  let pileStyle: CSSProperties = {};
  if (layout && placement) {
    const { stage, card } = layout;
    const from = { x: stage.left + card.left + card.w / 2, y: stage.top + card.top + card.h / 2 };
    const dx = (placement.centre.x - from.x) * shrink;
    const dy = (placement.centre.y - from.y) * shrink;
    const scale = lerp(1, placement.scale, shrink);
    const away = leave * LEAVE_PX;
    pileStyle = {
      ...boxStyle(stage),
      opacity: 1 - leave,
      transformOrigin: `${card.left + card.w / 2}px ${card.top + card.h / 2}px`,
      transform: `translate(${dx - (side ? away : 0)}px, ${dy - (side ? 0 : away)}px) scale(${scale})`,
    };
  }

  const column = placement?.column;
  // The bars leave their column for the scene zone as the tally settles, so the last frame is the ring's first.
  const barsBox = layout && column ? lerpBox(column, layout.zone, side ? regroup : settle) : null;
  const rows = layout && placement && barsBox ? valueRows(layout, placement, barsBox, regroup) : null;

  // Shown cases send the winning choice's judgments, one value at a time, from the lit pill.
  // Skipped cases only move the bars.
  const votes =
    layout &&
    CARDS.map((_, i) => {
      if (isFast(i)) return null;
      return VALUE_ORDER.map((v, k) => {
        if (Math.abs(VOTES[i][v]) < 1e-6) return null;
        const depart = valueVoteAt(i, k);
        const fly = ramp(t, depart, depart + VOTE_FLY_MS);
        if (fly <= 0 || fly >= 1) return null;
        const pill = pills.find((item) => item.value === v);
        if (!pill) return null;
        const e = easeInOut(fly);
        const fade = smooth(ramp(fly, 0, 0.12)) * (1 - smooth(ramp(fly, 0.62, 1)));
        const x0 = pill.x;
        const y0 = pill.y;
        const x1 = layout.bars[v].x + 8;
        const y1 = rows ? rows.scene[k] : layout.bars[v].cy;
        // Leave sideways, clear of the case text, and only then bend up or down to the bar.
        const cardRight = placement ? placement.centre.x + (layout.card.w * lerp(1, placement.scale, shrink)) / 2 : x0;
        const x = quad(x0, side ? Math.min(cardRight + EXIT_PX, x1) : (x0 + x1) / 2, x1, e);
        const y = quad(y0, side ? y0 : (y0 + y1) / 2, y1, e);
        const scale = lerp(1, 0.62, smooth(ramp(fly, 0.25, 1)));
        return (
          <div
            key={`${i}-${v}`}
            className="absolute"
            style={{
              left: x,
              top: y,
              fontSize: pill.font,
              opacity: fade,
              transform: `translate(-50%, -50%) scale(${scale})`,
              filter: "drop-shadow(0 8px 14px rgba(16,24,40,0.16))",
              zIndex: k + 1,
            }}
          >
            <RelationPill tag={pill.tag} />
          </div>
        );
      });
    });

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
            rowYs={rows?.frame}
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
        </div>
      </div>
    </div>
  );
}
