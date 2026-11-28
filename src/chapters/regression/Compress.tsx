import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { flushSync } from "react-dom";
import { DONUT_INK, DONUT_MUTED, FONT_STACK, clamp01 } from "../../components/Donut";
import { VALUE_ORDER } from "../../design";
import { stackCases } from "../../stage/data";
import Morph from "../../stage/Morph";
import { MORPH_HANDOFF_MS } from "../../stage/morphBeats";
import type { Profile, StudyCase, Value } from "../../study/types";
import { beatStart, chapterDuration } from "../../types";
import { easeInOut } from "../ending/shared";
import StackStage, { type TableHandoff } from "../stack/StackStage";
import { stackBeats } from "../stack/beats";
import {
  COMPRESS_CAPTION,
  COMPRESS_TIMING,
  GHOST_LEVEL,
  NUMBERS_AT,
  PRIORITIES_CAPTION,
  TALLY_CAPTION,
  TALLY_TIMING,
  compressBeats,
} from "./beats";

const STACK_END = chapterDuration({ beats: stackBeats });
const GHOST_AT = beatStart(compressBeats, "ghost");
const TALLY_AT = beatStart(compressBeats, "tally");
const GROW_AT = beatStart(compressBeats, "grow");
const TRAVEL_AT = beatStart(compressBeats, "travel");
const END_AT = chapterDuration({ beats: compressBeats });

/** Table rows that vote one at a time; the rest stream in from the ellipsis. */
const SHOWN_ROWS = 3;
/** A vote in flight, in table units. */
const VOTE_PX = 9;
/**
 * Summary row geometry, in the table's own units (multiplied by the measured
 * stage scale), measured from the row where the table keeps its case count.
 * The bars stand on a baseline, tallest first: a bar chart under the columns.
 */
const BAR_MAX = 60;
const BASELINE = 54;
const NUMBER_DROP = 66;
const LABEL_DROP = 30;
const CAPTION_DROP = 86;
/** A column's bar is this wide, as a share of the distance between neighbouring columns. */
const BAR_OF_PITCH = 0.42;
const LABEL_INK = "#1B2433cc";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ramp = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));
const smooth = (x: number) => x * x * (3 - 2 * x);

/* -------------------------------------------------------------------------- */
/*  Measured layout: the table's columns, the summary row, and where the bars  */
/*  and bar labels of the morph's first frame are                              */
/* -------------------------------------------------------------------------- */

/** Everything is in px, relative to the bridge's own box. `cy` is the vertical centre. */
interface WordAnchor {
  value: Value;
  from: { text: string; left: number; width: number; cy: number; fontPx: number; family: string; weight: string; spacingEm: number; color: string };
  to: { text: string; left: number; cy: number; fontPx: number };
}

interface Bar {
  left: number;
  top: number;
  w: number;
  h: number;
}

interface BarTarget extends Bar {
  opacity: number;
  radius: number;
}

interface SummaryRow {
  /** Screen px per table unit (the table is scaled to fit). */
  scale: number;
  /** Vertical centre of the summary row: where the table keeps its case count. */
  cy: number;
  pitch: number;
  label: { left: number; width: number };
  rowLeft: number;
  rowRight: number;
  /** Vertical centres of the rows that vote one at a time. */
  rowCy: number[];
}

interface Anchors {
  words: Partial<Record<Value, WordAnchor>>;
  bars: Partial<Record<Value, BarTarget>>;
  summary: SummaryRow | null;
}

const NO_ANCHORS: Anchors = { words: {}, bars: {}, summary: null };
const round = (x: number) => Math.round(x * 10) / 10;

/**
 * Reads the real table (value headers "hdr-<value>", the Case header, rows,
 * the case count) and a hidden copy of the morph's first frame (bar labels
 * "bar-name-<value>", bars "bar-<value>"). Nothing is hard-coded, so it holds
 * at any viewport and in either table layout.
 */
function measure(root: HTMLElement, table: HTMLElement | null, probe: HTMLElement | null, prev: Anchors, settled: boolean): Anchors {
  const box = root.getBoundingClientRect();
  const rel = (r: DOMRect) => ({ left: round(r.left - box.left), cy: round(r.top + r.height / 2 - box.top), w: round(r.width), h: round(r.height) });
  const words: Anchors["words"] = { ...prev.words };
  const bars: Anchors["bars"] = { ...prev.bars };
  let scale = prev.summary?.scale ?? 1;
  const centers: number[] = [];
  for (const v of VALUE_ORDER) {
    const head = table?.querySelector<HTMLElement>(`[data-anchor="hdr-${v}"]`);
    const label = probe?.querySelector<Element>(`[data-anchor="bar-name-${v}"]`);
    const bar = probe?.querySelector<Element>(`[data-anchor="bar-${v}"]`);
    const old = prev.words[v];
    let from = old?.from;
    let to = old?.to;
    if (head) {
      const r = head.getBoundingClientRect();
      const cs = getComputedStyle(head);
      const unscaled = parseFloat(cs.fontSize);
      // The stage is scaled to fit; offsetWidth is the layout width before that scale.
      scale = head.offsetWidth > 0 ? r.width / head.offsetWidth : 1;
      const spacing = parseFloat(cs.letterSpacing);
      const m = rel(r);
      const measured = {
        text: head.textContent ?? "",
        left: m.left,
        width: m.w,
        cy: m.cy,
        fontPx: round(unscaled * scale),
        family: cs.fontFamily,
        weight: cs.fontWeight,
        spacingEm: Number.isFinite(spacing) ? round(spacing / unscaled) : 0,
        color: cs.color,
      };
      // Ink eases in with the emphasis; take it once it has settled.
      from = settled || !old ? measured : { ...measured, family: old.from.family, weight: old.from.weight, color: old.from.color };
    }
    if (label) {
      const m = rel(label.getBoundingClientRect());
      to = { text: label.textContent ?? "", left: m.left, cy: m.cy, fontPx: round(parseFloat(getComputedStyle(label).fontSize)) };
    }
    if (from && to) words[v] = { value: v, from, to };
    if (bar) {
      const b = rel(bar.getBoundingClientRect());
      bars[v] = {
        left: b.left,
        top: round(b.cy - b.h / 2),
        w: b.w,
        h: b.h,
        opacity: Number(bar.getAttribute("fill-opacity") ?? 1),
        radius: Number(bar.getAttribute("rx") ?? 0),
      };
    }
    if (from) centers.push(from.left + from.width / 2);
  }

  let summary = prev.summary;
  const count = table?.querySelector<HTMLElement>("[data-stack-footer]");
  const caseHead = table?.querySelector<HTMLElement>('[data-anchor="hdr-case"]');
  const firstRow = table?.querySelector<HTMLElement>('[data-anchor="row-0"]');
  const rowCy: number[] = [];
  for (let i = 0; i < SHOWN_ROWS; i++) {
    const r = table?.querySelector<HTMLElement>(`[data-anchor="row-${i}"]`);
    if (r) rowCy.push(rel(r.getBoundingClientRect()).cy);
  }
  if (count && caseHead && firstRow && centers.length === VALUE_ORDER.length && rowCy.length === SHOWN_ROWS) {
    const c = rel(count.getBoundingClientRect());
    const h = rel(caseHead.getBoundingClientRect());
    const row = firstRow.getBoundingClientRect();
    summary = {
      scale: round(scale),
      cy: c.cy,
      pitch: round((centers[centers.length - 1] - centers[0]) / (centers.length - 1)),
      label: { left: h.left, width: h.w },
      rowLeft: round(row.left - box.left),
      rowRight: round(row.right - box.left),
      rowCy,
    };
  }
  return { words, bars, summary };
}

const same = (a: Anchors, b: Anchors) => JSON.stringify(a) === JSON.stringify(b);

/* -------------------------------------------------------------------------- */
/*  The tally: each case's vote                                                */
/* -------------------------------------------------------------------------- */

/**
 * One case's vote for each value: how much more Choice 1 favors the value than
 * Choice 2 (tags run -1..1), times how far the model leaned to Choice 1 (k of 10,
 * centred). Summed over cases, it ranks the values much as the regression does.
 */
function votesOf(cases: readonly StudyCase[], key: string): Record<Value, number>[] {
  return cases.map((c) => {
    const lean = (c.modelChoice1Counts[key] ?? 5) / 10 - 0.5;
    const out = {} as Record<Value, number>;
    for (const v of VALUE_ORDER) out[v] = (c.tags[0][v] - c.tags[1][v]) * lean;
    return out;
  });
}

/** When case `i`'s vote lands in the bars. */
function landAt(i: number, n: number): number {
  const T = TALLY_TIMING;
  if (i < SHOWN_ROWS) return TALLY_AT + i * T.rowMs + T.flyMs;
  const rest = Math.max(1, n - SHOWN_ROWS);
  return TALLY_AT + SHOWN_ROWS * T.rowMs + ((i - SHOWN_ROWS + 1) / rest) * T.restMs;
}

/* -------------------------------------------------------------------------- */
/*  The four header words, in flight                                           */
/* -------------------------------------------------------------------------- */

/**
 * A copy of the word lifts off its column in the mono header style and lands
 * in the bar label style. Both are drawn the whole way and cross-fade. When
 * the table is compact the header is a single letter: that letter becomes the
 * first letter of the full name, and the rest of the name spells out as it
 * travels. A soft halo keeps table text from showing through on the way.
 */
function TravelingWord({ word, p }: { word: WordAnchor; p: number }) {
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
        transform: `translate(${lerp(from.left, to.left, e)}px, ${lerp(from.cy, to.cy, e)}px)`,
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
 * out". The four numbers are one more row of the table: a bar under each value
 * column, so position alone says which column made which bar. Every frame is a
 * pure function of `elapsedMs`; the only thing read from the page is layout.
 *
 *   caption   the table holds under one question; the four headers get emphasis
 *   ghost     the table steps back, headers stay at full strength
 *   grow      a bar grows under each value column
 *   together  the table and its four priorities, on one page
 *   travel    the table fades; the bars and the header words flow into the bar list
 *
 * A clock past the end holds the last frame, which is the morph's first frame.
 */
export function CompressBridge({ elapsedMs, profile }: { elapsedMs: number; profile: Profile }) {
  const t = Math.max(0, elapsedMs);
  const T = COMPRESS_TIMING;
  const cases = stackCases.length;

  const emphasis = easeInOut(clamp01(t / T.emphasisMs));
  const ghost = easeInOut(ramp(t, GHOST_AT, GHOST_AT + T.ghostMs));
  const growP = ramp(t, GROW_AT, GROW_AT + T.growMs);
  const travel = ramp(t, TRAVEL_AT, END_AT);
  const clear = easeInOut(ramp(travel, 0, 0.55));
  const settle = easeInOut(growP);
  const numbersIn = smooth(ramp(growP, NUMBERS_AT, 1));
  const footNumbers = numbersIn * (1 - smooth(ramp(travel, 0, 0.3)));
  const landed = t >= END_AT;

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

  const handoff: TableHandoff = {
    emphasis,
    rest: 1 - ghost * (1 - GHOST_LEVEL),
    chrome: 1 - ghost,
  };

  const { summary } = anchors;
  const words = VALUE_ORDER.map((v) => anchors.words[v]).filter((w): w is WordAnchor => w !== undefined);
  const ready = summary !== null && words.length === VALUE_ORDER.length && VALUE_ORDER.every((v) => anchors.bars[v]);
  const p = profile.priorities;
  const biggest = Math.max(...VALUE_ORDER.map((v) => p[v]));

  // The running tally, and the tally once every case is in.
  const votes = votesOf(stackCases, profile.key);
  const arrived = votes.map((_, i) => smooth(ramp(t, landAt(i, cases) - TALLY_TIMING.landMs, landAt(i, cases))));
  const running = {} as Record<Value, number>;
  const total = {} as Record<Value, number>;
  for (const v of VALUE_ORDER) {
    running[v] = votes.reduce((sum, c, i) => sum + c[v] * arrived[i], 0);
    total[v] = votes.reduce((sum, c) => sum + c[v], 0);
  }
  const tallyMax = Math.max(1e-6, ...VALUE_ORDER.map((v) => Math.abs(total[v])));
  const counted = arrived.filter((x) => x >= 0.5).length;
  const tallyShow = smooth(ramp(t, TALLY_AT, TALLY_AT + 400)) * (1 - smooth(ramp(growP, 0, 0.4)));

  // The summary row: a label, a bar under each value column, its number, and one plain line.
  let summaryRow = null;
  if (ready && !landed && t >= GHOST_AT) {
    const S = summary.scale;
    const e = easeInOut(travel);
    const barW = summary.pitch * BAR_OF_PITCH;
    const baseline = summary.cy + BASELINE * S;
    const first = anchors.words[VALUE_ORDER[0]]!.from;
    const last = anchors.words[VALUE_ORDER[VALUE_ORDER.length - 1]]!.from;
    const labelPx = Math.min(14 * S, summary.label.width / 5.2);
    const numPx = Math.min(11 * S, summary.pitch / 3.4);
    summaryRow = (
      <>
        <div
          style={{
            position: "absolute",
            left: summary.label.left,
            top: summary.cy + LABEL_DROP * S,
            transform: "translateY(-50%)",
            whiteSpace: "nowrap",
            lineHeight: 1,
            fontSize: labelPx,
            fontWeight: 600,
            color: LABEL_INK,
            opacity: ghost * (1 - clear),
          }}
        >
          {cases} cases
        </div>
        <div
          style={{
            position: "absolute",
            left: first.left + first.width / 2 - summary.pitch / 2,
            width: last.left + last.width / 2 - (first.left + first.width / 2) + summary.pitch,
            top: baseline,
            height: 1,
            background: "#d1d5db",
            opacity: ghost * (1 - clear),
          }}
        />
        {words.map((w) => {
          const target = anchors.bars[w.value]!;
          const centre = w.from.left + w.from.width / 2;
          // Signed height: the tally can take a value below the line. It settles into the priority.
          const tallyH = (running[w.value] / tallyMax) * BAR_MAX * S;
          const signed = lerp(tallyH, (p[w.value] / biggest) * BAR_MAX * S, settle);
          const h = Math.abs(signed);
          const below = signed < 0;
          const from: Bar = { left: centre - barW / 2, top: below ? baseline : baseline - h, w: barW, h };
          const bar = {
            left: lerp(from.left, target.left, e),
            top: lerp(from.top, target.top, e),
            w: lerp(from.w, target.w, e),
            h: lerp(from.h, target.h, e),
          };
          return (
            <div key={w.value}>
              {bar.h > 0 && (
                <div
                  style={{
                    position: "absolute",
                    left: bar.left,
                    top: bar.top,
                    width: bar.w,
                    height: bar.h,
                    borderRadius: Math.min(target.radius, bar.w / 2, bar.h / 2),
                    background: below ? DONUT_MUTED : DONUT_INK,
                    opacity: below ? 0.45 : target.opacity,
                  }}
                />
              )}
              <div
                style={{
                  position: "absolute",
                  left: centre,
                  top: summary.cy + NUMBER_DROP * S,
                  transform: "translate(-50%, -50%)",
                  whiteSpace: "nowrap",
                  lineHeight: 1,
                  fontSize: numPx,
                  color: DONUT_MUTED,
                  opacity: footNumbers,
                }}
              >
                {Math.round(p[w.value] * 100)}%
              </div>
            </div>
          );
        })}
        {votes.slice(0, SHOWN_ROWS).flatMap((c, i) => {
          const leave = TALLY_AT + i * TALLY_TIMING.rowMs;
          const fly = ramp(t, leave, leave + TALLY_TIMING.flyMs);
          if (fly <= 0 || fly >= 1) return [];
          return words.flatMap((w) => {
            const vote = c[w.value];
            if (Math.abs(vote) < 1e-6) return [];
            const e2 = easeInOut(fly);
            const x = w.from.left + w.from.width / 2;
            const y = lerp(summary.rowCy[i], baseline, e2);
            const size = VOTE_PX * S;
            const fade = smooth(ramp(fly, 0, 0.15)) * (1 - smooth(ramp(fly, 0.8, 1)));
            return [
              <div
                key={`${i}-${w.value}`}
                style={{
                  position: "absolute",
                  left: x - size / 2,
                  top: y - size / 2,
                  width: size,
                  height: size,
                  borderRadius: size,
                  boxSizing: "border-box",
                  background: vote > 0 ? DONUT_INK : "#fff",
                  border: `${Math.max(1, 1.5 * S)}px solid ${DONUT_INK}`,
                  opacity: fade,
                }}
              />,
            ];
          });
        })}
        <div
          style={{
            position: "absolute",
            left: summary.rowLeft,
            width: summary.rowRight - summary.rowLeft,
            top: summary.cy + (CAPTION_DROP + 12) * S,
            boxSizing: "border-box",
            padding: `0 ${16 * S}px`,
            textAlign: "center",
            color: "#4b5563",
            fontSize: 16 * S,
            lineHeight: 1.35,
            opacity: tallyShow * (1 - clear),
          }}
        >
          {TALLY_CAPTION(counted, cases)}
        </div>
        <div
          style={{
            position: "absolute",
            left: summary.rowLeft,
            width: summary.rowRight - summary.rowLeft,
            top: summary.cy + CAPTION_DROP * S,
            boxSizing: "border-box",
            padding: `0 ${16 * S}px`,
            textAlign: "center",
            color: "#4b5563",
            fontSize: 16 * S,
            lineHeight: 1.35,
            opacity: smooth(ramp(growP, 0.5, 1)) * (1 - clear),
          }}
        >
          {PRIORITIES_CAPTION(cases)}
        </div>
      </>
    );
  }

  return (
    <div ref={rootRef} className="relative h-full w-full">
      <div className="absolute inset-0">
        <Morph
          profile={profile}
          elapsedMs={MORPH_HANDOFF_MS}
          names={landed ? 1 : 0}
          bars={landed ? 1 : 0}
          numbers={landed ? 1 : smooth(ramp(travel, 0.8, 1))}
        />
      </div>
      {/* The morph's first frame, unseen: its bars and bar labels are where everything lands. */}
      <div ref={probeRef} data-probe aria-hidden className="pointer-events-none absolute inset-0" style={{ visibility: "hidden" }}>
        <Morph profile={profile} elapsedMs={MORPH_HANDOFF_MS} />
      </div>
      {!landed && (
        <div ref={tableRef} className="absolute inset-0" style={{ opacity: 1 - clear }}>
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
      <div aria-hidden className="pointer-events-none absolute inset-0 z-20">
        {summaryRow}
        {ready && t >= TRAVEL_AT && !landed && words.map((w) => <TravelingWord key={w.value} word={w} p={travel} />)}
      </div>
    </div>
  );
}
