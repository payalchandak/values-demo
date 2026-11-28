import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { DONUT_INK, DONUT_MUTED, FONT_STACK, clamp01 } from "../../components/Donut";
import { VALUE_ORDER } from "../../design";
import Morph from "../../stage/Morph";
import { MORPH_HANDOFF_MS } from "../../stage/morphBeats";
import type { Profile, Value } from "../../study/types";
import { beatStart, chapterDuration } from "../../types";
import { easeInOut } from "../ending/shared";
import CasesScene, { CARDS, type Peel } from "../cases/CasesScene";
import { casesBeats } from "../cases/beats";
import { GPT_TRIALS } from "../cases/data";
import {
  FLY_MS,
  LAND_MS,
  SETTLE_MS,
  SHRINK_MS,
  SLOW_VOTES,
  VOTE_CAPTION,
  landAt,
  leaveAt,
  peelMs,
  voteBeats,
} from "./beats";

const CASES_END = chapterDuration({ beats: casesBeats });
const SHRINK_AT = beatStart(voteBeats, "shrink");
const VOTE_AT = beatStart(voteBeats, "vote");
const SETTLE_AT = beatStart(voteBeats, "settle");

/** Room left above the pile for its paper edges, and between the pile and the value names, in px. */
const TOP_ROOM = 30;
const NAMES_GAP = 22;
/** A vote in flight, in px. */
const VOTE_PX = 11;

const ramp = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));
const smooth = (x: number) => x * x * (3 - 2 * x);
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** Card `i`, counted from the top of the finished pile (the last case is on top). */
const fromTop = (i: number) => CARDS.length - 1 - i;

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
  const shell = pileHost?.querySelector<HTMLElement>("[data-pile]");
  if (!stageEl || !shell || !pileHost || !probe) return null;
  const box = root.getBoundingClientRect();
  const s = stageEl.getBoundingClientRect();
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
    stage: { left: s.left - box.left, top: s.top - box.top, w: s.width, h: s.height },
    card: { left: at.left, top: at.top, w: shell.offsetWidth, h: shell.offsetHeight },
    bars,
    namesTop,
    captionCy: sub ? sub.top + sub.height / 2 - box.top : namesTop + 200,
  };
}

/**
 * The finished pile moves up, and its cards lift off one at a time. Each case
 * votes: its choice adds to the values it favored and takes from the ones it
 * went against. The tally grows in the ring's own bars, then settles into the
 * fitted priorities, so the last frame is the ring chapter's first.
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

  const peel: Peel = (i) => {
    const n = fromTop(i);
    return smooth(ramp(t, leaveAt(n), leaveAt(n) + peelMs(n)));
  };

  // The running tally. Bars show what is above zero, scaled so the leader ends at its own priority.
  const p = profile.priorities;
  const lead = Math.max(...VALUE_ORDER.map((v) => p[v]));
  const settle = easeInOut(ramp(t, SETTLE_AT, SETTLE_AT + SETTLE_MS));
  let counted = 0;
  const running = Object.fromEntries(VALUE_ORDER.map((v) => [v, 0])) as Record<Value, number>;
  CARDS.forEach((_, i) => {
    const n = fromTop(i);
    const w = smooth(ramp(t, landAt(n) - LAND_MS, landAt(n)));
    if (w >= 0.5) counted += 1;
    for (const v of VALUE_ORDER) running[v] += VOTES[i][v] * w;
  });
  const shares = Object.fromEntries(
    VALUE_ORDER.map((v) => [v, lerp((Math.max(0, running[v]) / TOP_TOTAL) * lead, p[v], settle)]),
  ) as Record<Value, number>;

  const shrink = easeInOut(ramp(t, SHRINK_AT, SHRINK_AT + SHRINK_MS));
  const namesIn = smooth(ramp(t, SHRINK_AT + SHRINK_MS * 0.4, SHRINK_AT + SHRINK_MS));
  const numbersIn = smooth(ramp(t, SETTLE_AT + SETTLE_MS * 0.6, SETTLE_AT + SETTLE_MS));
  const captionIn = smooth(ramp(t, VOTE_AT - 300, VOTE_AT)) * (1 - smooth(ramp(t, SETTLE_AT, SETTLE_AT + SETTLE_MS * 0.5)));

  // Where the pile goes: centred above the value names, as large as fits.
  let pileStyle: CSSProperties = {};
  let pileCentre = { x: 0, y: 0 };
  if (layout) {
    const { stage, card } = layout;
    const rootW = rootRef.current?.clientWidth ?? stage.w;
    const top = TOP_ROOM;
    const bottom = layout.namesTop - NAMES_GAP;
    const scale = Math.min(1, Math.max(0.2, (bottom - top) / card.h), (rootW - 16) / card.w);
    const from = { x: stage.left + card.left + card.w / 2, y: stage.top + card.top + card.h / 2 };
    const to = { x: rootW / 2, y: (top + bottom) / 2 };
    const dx = (to.x - from.x) * shrink;
    const dy = (to.y - from.y) * shrink;
    pileCentre = { x: from.x + dx, y: from.y + dy };
    pileStyle = {
      left: stage.left,
      top: stage.top,
      width: stage.w,
      height: stage.h,
      transformOrigin: `${card.left + card.w / 2}px ${card.top + card.h / 2}px`,
      transform: `translate(${dx}px, ${dy}px) scale(${lerp(1, scale, shrink)})`,
    };
  }

  const votes =
    layout &&
    Array.from({ length: SLOW_VOTES }, (_, n) => {
      const i = CARDS.length - 1 - n;
      const fly = ramp(t, leaveAt(n), leaveAt(n) + FLY_MS);
      if (fly <= 0 || fly >= 1) return null;
      const e = easeInOut(fly);
      const fade = smooth(ramp(fly, 0, 0.15)) * (1 - smooth(ramp(fly, 0.85, 1)));
      return VALUE_ORDER.map((v, k) => {
        const vote = VOTES[i][v];
        if (Math.abs(vote) < 1e-6) return null;
        const sx = pileCentre.x + (k - 1.5) * VOTE_PX * 2;
        const x = lerp(sx, layout.bars[v].x + VOTE_PX, e);
        const y = lerp(pileCentre.y, layout.bars[v].cy, e);
        return (
          <div
            key={`${n}-${v}`}
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

  return (
    <div ref={rootRef} className="relative h-full w-full">
      <div ref={probeRef} data-probe aria-hidden className="pointer-events-none invisible absolute inset-0">
        <Morph profile={profile} elapsedMs={MORPH_HANDOFF_MS} />
      </div>
      <div className="absolute inset-0">
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
        aria-hidden={t >= VOTE_AT}
        className="pointer-events-none absolute"
        style={layout ? pileStyle : { inset: 0 }}
      >
        <CasesScene elapsedMs={CASES_END} peel={peel} />
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-0 z-10">
        {votes}
        {layout && (
          <div
            className="absolute left-0 right-0 text-center"
            style={{
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
  );
}
