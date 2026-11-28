import { useLayoutEffect, useRef, useState } from "react";
import { NEUTRAL, VALUES, VALUE_ORDER } from "../../design";
import type { Value } from "../../study/types";
import { DONUT_INK, LIGHT_OPACITY, dominantValue } from "../../components/Donut";
import Morph from "../../stage/Morph";
import { MORPH_HANDOFF_MS } from "../../stage/morphBeats";
import type { Profile } from "../../study/types";
import { beatStart } from "../../types";
import { CHARCOAL } from "../opening/charcoal";
import { CASE_COUNT } from "../cases/beats";
import { GPT_TRIALS } from "../cases/data";
import { EMIT_MS, ENTER_MS, LABELS_MS, ON_RAY_MS, prismBeats, RAY_GROW_MS, SETTLE_MS, TO_PRISM_MS } from "./beats";

/** One dot per GPT decision: ten queries on each of the fifty cases. */
const DOTS = CASE_COUNT * GPT_TRIALS;
const DOT_R = 2.2;
/** Edges drawn for the small pile the dots leave from. */
const PILE_EDGES = 8;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ramp = (t: number, a: number, b: number) => (b <= a ? (t >= b ? 1 : 0) : clamp01((t - a) / (b - a)));
const smooth = (x: number) => x * x * (3 - 2 * x);
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const at = (name: string) => beatStart(prismBeats, name);

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
type Bars = Record<Value, Box>;

/** Deterministic spread in [0, 1): the same dot always lands in the same place. */
const spread = (k: number, salt: number) => (((k + 1) * 0.6180339887 + salt * 0.7548776662) % 1 + 1) % 1;

/** Which value's ray dot `k` takes, in proportion to the profile's priorities. */
function rayOf(k: number, p: Record<Value, number>): number {
  const u = spread(k, 3);
  let acc = 0;
  for (let i = 0; i < VALUE_ORDER.length; i++) {
    acc += p[VALUE_ORDER[i]];
    if (u < acc) return i;
  }
  return VALUE_ORDER.length - 1;
}

function layout(W: number, H: number) {
  const cy = H * 0.48;
  const pileW = Math.min(W * 0.16, 140);
  const pile = { x: W * 0.13 - pileW / 2, y: cy - pileW * 0.35, w: pileW, h: pileW * 0.7 };
  const side = Math.min(W * 0.17, H * 0.3, 160);
  const pc = { x: W * 0.42, y: cy };
  const hgt = (side * Math.sqrt(3)) / 2;
  const top = { x: pc.x, y: pc.y - (hgt * 2) / 3 };
  const left = { x: pc.x - side / 2, y: pc.y + hgt / 3 };
  const right = { x: pc.x + side / 2, y: pc.y + hgt / 3 };
  const entry = { x: (top.x + left.x) / 2, y: (top.y + left.y) / 2 };
  const exit = { x: (top.x + right.x) / 2, y: (top.y + right.y) / 2 };
  const fanX = W * 0.92;
  const fanH = Math.min(H * 0.62, 360);
  return { pile, pc, top, left, right, entry, exit, side, fanX, fanH, cy };
}

/**
 * GPT's decisions as light through a prism. The fifty cases sit as a small
 * pile; each of the 500 decisions leaves it as a dot, runs into the prism and
 * comes out on one of four value rays, each as wide as its priority. The rays
 * then straighten into the profile's bars, drawn by `Morph` exactly as the
 * morph chapter starts.
 */
export default function PrismScene({ elapsedMs, profile }: { elapsedMs: number; profile: Profile }) {
  const t = Math.max(0, elapsedMs);
  const rootRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ W: 0, H: 0 });
  const [bars, setBars] = useState<Bars | null>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      const o = root.getBoundingClientRect();
      setSize((prev) => (Math.abs(prev.W - o.width) < 0.5 && Math.abs(prev.H - o.height) < 0.5 ? prev : { W: o.width, H: o.height }));
      const next = {} as Bars;
      for (const v of VALUE_ORDER) {
        const el = root.querySelector(`[data-anchor="bar-${v}"]`);
        if (!el) return;
        const r = el.getBoundingClientRect();
        next[v] = { x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height };
      }
      setBars((prev) =>
        prev && VALUE_ORDER.every((v) => Math.abs(prev[v].x - next[v].x) < 0.5 && Math.abs(prev[v].y - next[v].y) < 0.5 && Math.abs(prev[v].w - next[v].w) < 0.5)
          ? prev
          : next,
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    const mo = new MutationObserver(measure);
    mo.observe(root, { subtree: true, childList: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, []);

  const p = profile.priorities;
  const topValue = dominantValue(p);
  const inkOf = (v: Value) => (v === topValue ? 1 : LIGHT_OPACITY);

  const enterP = smooth(ramp(t, 0, ENTER_MS));
  const splitAt = at("split");
  const rayP = smooth(ramp(t, splitAt, splitAt + RAY_GROW_MS));
  const settleAt = at("settle");
  const settleP = smooth(ramp(t, settleAt, settleAt + SETTLE_MS));
  const labelsP = smooth(ramp(t, at("labels"), at("labels") + LABELS_MS));
  // Pile, prism and dots give way to the bars.
  const sceneFade = 1 - smooth(ramp(t, settleAt, settleAt + SETTLE_MS * 0.6));
  const barsIn = smooth(ramp(t, settleAt + SETTLE_MS * 0.85, settleAt + SETTLE_MS));

  const { W, H } = size;
  let svg = null;
  if (W > 0 && H > 0 && bars) {
    const g = layout(W, H);

    // Ray ends: stacked at the prism's far face, fanned at the right.
    const total = VALUE_ORDER.reduce((s, v) => s + p[v], 0) || 1;
    const exitSpan = g.side * 0.32;
    const gap = g.fanH * 0.06;
    const fanSpan = g.fanH - gap * (VALUE_ORDER.length - 1);
    let e0 = g.exit.y - exitSpan / 2;
    let f0 = g.cy - g.fanH / 2;
    const rays = VALUE_ORDER.map((v) => {
      const share = p[v] / total;
      const eTop = e0;
      const eBot = e0 + exitSpan * share;
      // Every ray keeps a hairline, so a small priority still reads as a ray.
      const fH = Math.max(fanSpan * share, 3);
      const fTop = f0;
      const fBot = f0 + fH;
      e0 = eBot;
      f0 = fBot + gap;
      const x1 = lerp(g.exit.x, g.fanX, rayP);
      const yTop = lerp(eTop, fTop, rayP);
      const yBot = lerp(eBot, fBot, rayP);
      const b = bars[v];
      const bh = b.h;
      const quad: Pt[] = [
        { x: lerp(g.exit.x, b.x, settleP), y: lerp(eTop, b.y, settleP) },
        { x: lerp(x1, b.x + b.w, settleP), y: lerp(yTop, b.y, settleP) },
        { x: lerp(x1, b.x + b.w, settleP), y: lerp(yBot, b.y + bh, settleP) },
        { x: lerp(g.exit.x, b.x, settleP), y: lerp(eBot, b.y + bh, settleP) },
      ];
      return { v, quad, mid: (s: number) => ({ x: lerp(g.exit.x, g.fanX, s), y: lerp((eTop + eBot) / 2, (fTop + fBot) / 2, s) }), fH };
    });

    // The dots.
    const dots: { x: number; y: number; o: number }[] = [];
    const streamAt = at("stream");
    const pileOut = { x: g.pile.x + g.pile.w, y: g.pile.y + g.pile.h / 2 };
    for (let k = 0; k < DOTS; k++) {
      const born = streamAt + (k / DOTS) * EMIT_MS;
      if (t < born) break;
      const a = (t - born) / TO_PRISM_MS;
      const jitter = (spread(k, 1) - 0.5) * g.pile.h * 0.8;
      if (a < 1) {
        const q = smooth(clamp01(a));
        dots.push({ x: lerp(pileOut.x, g.entry.x, q), y: lerp(pileOut.y + jitter, g.entry.y, q), o: clamp01(a * 4) * 0.85 });
        continue;
      }
      const b = (t - born - TO_PRISM_MS) / ON_RAY_MS;
      if (b >= 1) continue;
      const ray = rays[rayOf(k, p)];
      const m = ray.mid(clamp01(b) * rayP);
      const lane = (spread(k, 2) - 0.5) * ray.fH * clamp01(b);
      dots.push({ x: m.x, y: m.y + lane, o: (1 - clamp01((b - 0.75) / 0.25)) * 0.85 });
    }

    const poly = (q: Pt[]) => q.map((pt) => `${pt.x},${pt.y}`).join(" ");
    const showRays = rayP > 0 && barsIn < 1;
    svg = (
      <svg aria-hidden="true" width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 block">
        <g opacity={enterP * sceneFade}>
          {Array.from({ length: PILE_EDGES }, (_, i) => {
            const d = PILE_EDGES - 1 - i;
            return (
              <rect
                key={i}
                x={g.pile.x + d * 1.2}
                y={g.pile.y - d * 3}
                width={g.pile.w - d * 2.4}
                height={g.pile.h}
                rx={8}
                fill="#fff"
                stroke={NEUTRAL.line}
              />
            );
          })}
          <text x={g.pile.x + g.pile.w / 2} y={g.pile.y + g.pile.h + 22} textAnchor="middle" fontSize={12} fill={NEUTRAL.inkFaint}>
            50 cases
          </text>
        </g>

        {showRays &&
          rays.map((r) => (
            <polygon
              key={r.v}
              points={poly(r.quad)}
              fill={DONUT_INK}
              fillOpacity={lerp(0.12, 1, settleP) * inkOf(r.v) + (1 - settleP) * 0.06}
              opacity={1 - barsIn}
            />
          ))}

        <g opacity={sceneFade}>
          {rays.map((r) => {
            const end = r.mid(1);
            return (
              <text
                key={r.v}
                x={end.x}
                y={end.y}
                dy="0.35em"
                textAnchor="end"
                fontSize={12}
                fontWeight={600}
                fill={DONUT_INK}
                opacity={smooth(ramp(t, splitAt + RAY_GROW_MS * 0.6, splitAt + RAY_GROW_MS))}
                transform={`translate(${-8} 0)`}
              >
                {VALUES[r.v].name}
              </text>
            );
          })}
          {dots.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={DOT_R} fill={CHARCOAL} opacity={d.o} />
          ))}
          <g opacity={enterP}>
            <polygon
              points={poly([g.top, g.right, g.left])}
              fill="#fff"
              fillOpacity={0.85}
              stroke={NEUTRAL.ink}
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
            <text x={g.pc.x} y={g.left.y + 24} textAnchor="middle" fontSize={13} fontWeight={600} fill={NEUTRAL.ink}>
              ValuePRISM
            </text>
          </g>
        </g>
      </svg>
    );
  }

  return (
    <div ref={rootRef} className="relative h-full w-full">
      <div className="absolute inset-0">
        <Morph profile={profile} elapsedMs={MORPH_HANDOFF_MS} bars={barsIn} names={labelsP} numbers={labelsP} />
      </div>
      {svg}
    </div>
  );
}
