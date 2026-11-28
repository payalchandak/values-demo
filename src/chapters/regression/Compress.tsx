import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { flushSync } from "react-dom";
import { DONUT_INK, FONT_STACK, clamp01 } from "../../components/Donut";
import { VALUE_ORDER } from "../../design";
import { stackCases } from "../../stage/data";
import Morph from "../../stage/Morph";
import { MORPH_HANDOFF_MS } from "../../stage/morphBeats";
import type { Profile, Value } from "../../study/types";
import { beatStart, chapterDuration } from "../../types";
import { easeInOut } from "../ending/shared";
import StackStage, { type TableHandoff } from "../stack/StackStage";
import { stackBeats } from "../stack/beats";
import {
  COMPRESS_CAPTION,
  COMPRESS_TIMING,
  GHOST_LEVEL,
  NUMBERS_AT,
  TABLE_GAP_PX,
  TILT_FROM_EQUAL,
  compressBeats,
  easeOut,
} from "./beats";

const STACK_END = chapterDuration({ beats: stackBeats });
const GHOST_AT = beatStart(compressBeats, "ghost");
const TRAVEL_AT = beatStart(compressBeats, "travel");
const GROW_AT = beatStart(compressBeats, "grow");
const SETTLE_AT = beatStart(compressBeats, "settle");
const END_AT = chapterDuration({ beats: compressBeats });

/** Bars start at this share each when TILT_FROM_EQUAL is on. */
const EQUAL_SHARE = 0.25;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ramp = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));
const smooth = (x: number) => x * x * (3 - 2 * x);

/* -------------------------------------------------------------------------- */
/*  Measured layout: where each header word is, where its bar label goes,      */
/*  and how far below the table the priorities have to sit                     */
/* -------------------------------------------------------------------------- */

/** Everything is in px, relative to the bridge's own box. `cy` is the vertical centre of the text. */
interface WordAnchor {
  value: Value;
  from: { text: string; left: number; cy: number; fontPx: number; family: string; weight: string; spacingEm: number; color: string };
  to: { text: string; left: number; cy: number; fontPx: number };
}

interface Anchors {
  words: Partial<Record<Value, WordAnchor>>;
  /** How far down the priorities sit while the table is still on the page. */
  dock: number;
}

const NO_ANCHORS: Anchors = { words: {}, dock: 0 };
const round = (x: number) => Math.round(x * 10) / 10;

/**
 * Reads the real table (header words, data-anchor "hdr-<value>", and its
 * last row, "row-2") and a hidden copy of the morph's first frame (bar
 * labels, "bar-name-<value>", and the line under the bars). Nothing is
 * hard-coded, so it holds at any viewport and in either table layout.
 */
function measure(root: HTMLElement, table: HTMLElement | null, probe: HTMLElement | null, prev: Anchors, settled: boolean): Anchors {
  const box = root.getBoundingClientRect();
  const words: Anchors["words"] = { ...prev.words };
  for (const v of VALUE_ORDER) {
    const head = table?.querySelector<HTMLElement>(`[data-anchor="hdr-${v}"]`);
    const bar = probe?.querySelector<Element>(`[data-anchor="bar-name-${v}"]`);
    const old = prev.words[v];
    if (!head && !bar) continue;
    let from = old?.from;
    let to = old?.to;
    if (head) {
      const r = head.getBoundingClientRect();
      const cs = getComputedStyle(head);
      const unscaled = parseFloat(cs.fontSize);
      // The stage is scaled to fit; offsetWidth is the layout width before that scale.
      const scale = head.offsetWidth > 0 ? r.width / head.offsetWidth : 1;
      const spacing = parseFloat(cs.letterSpacing);
      const measured = {
        text: head.textContent ?? "",
        left: round(r.left - box.left),
        cy: round(r.top + r.height / 2 - box.top),
        fontPx: round(unscaled * scale),
        family: cs.fontFamily,
        weight: cs.fontWeight,
        spacingEm: Number.isFinite(spacing) ? round(spacing / unscaled) : 0,
        color: cs.color,
      };
      // Ink eases in with the emphasis; take it once it has settled.
      from = settled || !old ? measured : { ...measured, family: old.from.family, weight: old.from.weight, color: old.from.color };
    }
    if (bar) {
      const r = bar.getBoundingClientRect();
      to = {
        text: bar.textContent ?? "",
        left: round(r.left - box.left),
        cy: round(r.top + r.height / 2 - box.top),
        fontPx: round(parseFloat(getComputedStyle(bar).fontSize)),
      };
    }
    if (from && to) words[v] = { value: v, from, to };
  }

  let dock = prev.dock;
  const bottom = table?.querySelector<HTMLElement>('[data-anchor="row-2"]');
  const first = probe?.querySelector<Element>('[data-anchor="bar-name-A"]');
  const line = probe?.querySelector<Element>('[data-anchor="bar-subcaption"]');
  const svg = probe?.querySelector<Element>('[data-testid="morph-svg"]');
  if (bottom && first && line && svg) {
    const want = bottom.getBoundingClientRect().bottom - first.getBoundingClientRect().top + TABLE_GAP_PX;
    const room = svg.getBoundingClientRect().bottom - line.getBoundingClientRect().bottom - 4;
    dock = round(Math.min(Math.max(want, 0), Math.max(room, 0)));
  }
  return { words, dock };
}

const same = (a: Anchors, b: Anchors) => JSON.stringify(a) === JSON.stringify(b);

/* -------------------------------------------------------------------------- */
/*  The four header words, in flight                                           */
/* -------------------------------------------------------------------------- */

/**
 * A copy of the word lifts off its column (the header stays) in the mono
 * header style and lands in the bar label style. Both are drawn the whole way
 * and cross-fade. When the table is compact the header is a single letter:
 * that letter becomes the first letter of the full name, and the rest of the
 * name spells out as it travels. A soft halo keeps table text from showing
 * through while it passes over the rows.
 */
function TravelingWord({ word, p, dock }: { word: WordAnchor; p: number; dock: number }) {
  const e = easeInOut(p);
  const { from, to } = word;
  const fontPx = lerp(from.fontPx, to.fontPx, e);
  const swap = smooth(ramp(p, 0.15, 0.5));
  const letterToName = to.text !== from.text && to.text.toLowerCase().startsWith(from.text.toLowerCase());
  const restOpacity = letterToName ? smooth(ramp(p, 0.4, 0.9)) : swap;
  const split = letterToName ? from.text.length : 0;
  const halo = Math.round(100 * ramp(p, 0, 0.15) * (1 - ramp(p, 0.85, 1)));
  const glow = `color-mix(in srgb, var(--color-canvas) ${halo}%, transparent)`;
  const base: CSSProperties = {
    position: "absolute",
    left: 0,
    top: 0,
    transform: "translateY(-50%)",
    whiteSpace: "nowrap",
    lineHeight: 1,
    fontSize: fontPx,
    textShadow: `0 0 3px ${glow}, 0 0 3px ${glow}, 0 0 6px ${glow}, 0 0 6px ${glow}`,
  };
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        transform: `translate(${lerp(from.left, to.left, e)}px, ${lerp(from.cy, to.cy + dock, e)}px)`,
      }}
    >
      <span
        style={{
          ...base,
          fontFamily: from.family,
          fontWeight: from.weight,
          letterSpacing: `${from.spacingEm}em`,
          color: `color-mix(in srgb, ${from.color}, ${DONUT_INK} ${Math.round(e * 100)}%)`,
          opacity: 1 - swap,
        }}
      >
        {from.text}
      </span>
      <span style={{ ...base, fontFamily: FONT_STACK, fontWeight: 600, color: DONUT_INK }}>
        <span style={{ opacity: swap }}>{split ? to.text.slice(0, split) : to.text}</span>
        {split > 0 && <span style={{ opacity: restOpacity }}>{to.text.slice(split)}</span>}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  The bridge                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Autoplay after the stack table: "decisions and trade-offs in, four numbers
 * out", the table and the four priorities on one page. Every frame is a pure
 * function of `elapsedMs`; the only thing read from the page is layout (where
 * the real header words and bar labels are).
 *
 *   caption   the table holds under one question; the four headers get emphasis
 *   ghost     the table steps back, headers stay at full strength
 *   travel    copies of the header words move down into the bar label list
 *   grow      a bar grows beside each word, under the table
 *   together  both on screen
 *   settle    the table fades, the bars settle to where the morph starts
 *
 * A clock past the end holds the last frame, which is the morph's first frame.
 */
export function CompressBridge({ elapsedMs, profile }: { elapsedMs: number; profile: Profile }) {
  const t = Math.max(0, elapsedMs);
  const T = COMPRESS_TIMING;

  const emphasis = easeInOut(clamp01(t / T.emphasisMs));
  const ghost = easeInOut(ramp(t, GHOST_AT, GHOST_AT + T.ghostMs));
  const travel = ramp(t, TRAVEL_AT, GROW_AT);
  const growP = ramp(t, GROW_AT, GROW_AT + T.growMs);
  const settle = easeInOut(ramp(t, SETTLE_AT, END_AT));
  const barGrow = easeOut(growP);
  const numbers = smooth(ramp(growP, NUMBERS_AT, 1));
  const tilt = TILT_FROM_EQUAL ? 1 - easeInOut(growP) : 0;
  const barShare = TILT_FROM_EQUAL
    ? (Object.fromEntries(VALUE_ORDER.map((v) => [v, lerp(profile.priorities[v], EQUAL_SHARE, tilt)])) as Profile["priorities"])
    : undefined;

  const rootRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const anchorsRef = useRef<Anchors>(NO_ANCHORS);
  const [anchors, setAnchors] = useState<Anchors>(NO_ANCHORS);
  const [, setSize] = useState(0);

  // Layout is read after every commit and kept only when it changed, so it settles in a pass or two.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const next = measure(root, tableRef.current, probeRef.current, anchorsRef.current, emphasis >= 1);
    if (!same(anchorsRef.current, next)) {
      anchorsRef.current = next;
      setAnchors(next);
    }
  });
  // A resize, or a font arriving, changes where everything is, even when the clock has not moved.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const remeasure = () => flushSync(() => setSize((n) => n + 1));
    const observer = new ResizeObserver(remeasure);
    observer.observe(root);
    document.fonts.addEventListener("loadingdone", remeasure);
    return () => {
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", remeasure);
    };
  }, []);

  const words = VALUE_ORDER.map((v) => anchors.words[v]).filter((w): w is WordAnchor => w !== undefined);
  const flying = t >= TRAVEL_AT && t < GROW_AT && words.length === VALUE_ORDER.length;
  const handoff: TableHandoff = {
    emphasis,
    rest: (1 - ghost * (1 - GHOST_LEVEL)) * (1 - settle),
    chrome: 1 - ghost,
  };
  // The priorities wait under the table, then settle to the middle where the morph starts.
  const lift = anchors.dock * (1 - settle);

  return (
    <div ref={rootRef} className="relative h-full w-full">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0" style={{ transform: `translateY(${lift}px)` }}>
          <Morph
            profile={profile}
            elapsedMs={MORPH_HANDOFF_MS}
            barGrow={barGrow}
            names={t >= GROW_AT ? 1 : 0}
            numbers={numbers}
            barShare={barShare}
          />
        </div>
      </div>
      {/* The morph's first frame, unseen: its bar labels are where the header words land. */}
      <div ref={probeRef} data-probe aria-hidden className="pointer-events-none absolute inset-0" style={{ visibility: "hidden" }}>
        <Morph profile={profile} elapsedMs={MORPH_HANDOFF_MS} />
      </div>
      {t < END_AT && (
        <div ref={tableRef} className="absolute inset-0">
          <StackStage
            cases={stackCases}
            beats={stackBeats}
            elapsedMs={STACK_END}
            profileKey={profile.key}
            profileLabel={profile.displayName}
            caption={COMPRESS_CAPTION}
            handoff={handoff}
          />
        </div>
      )}
      {flying && (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-20">
          {words.map((w) => (
            <TravelingWord key={w.value} word={w} p={travel} dock={anchors.dock} />
          ))}
        </div>
      )}
    </div>
  );
}
