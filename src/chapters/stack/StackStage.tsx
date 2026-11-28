import { memo, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { StudyCase, Tag, Value } from "../../study/types";
import type { Beat } from "../../types";
import CaseCardFace, { CaseCardMini, caseCardFor, caseFaceStyle } from "./CaseCard";
import { resolveBeats } from "./beats";
import {
  deltaOf,
  VALUES,
  VALUE_COLORS,
  VALUE_NAMES,
} from "./placeholderCases";
import {
  CARD_H,
  CARD_W,
  computeFrame,
  easeInOut,
  DOT_PITCH,
  DOT_SIZE,
  FOREGROUND,
  layoutFor,
  ROW_GRID,
  rowTargets,
  TRIALS,
  WIDE,
  type CardFrame,
  type Layout,
} from "./timeline";

/** UUID ids are shown as their first 8 hex chars; other ids are shown whole. */
const displayId = (id: string) => (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id) ? id.slice(0, 8) : id);

/** Choice 1 and choice 2 colors: used by edge markers, card backs and the frequency bar. */
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const CHOICE_COLORS = ["#D1495B", "#475569"] as const;
/** A card at or below this face scale shows only its title; it blends to the full card over MINI_FADE above it. */
const MINI_BELOW = 0.4;
const MINI_FADE = 0.12;
/** Option text stays in one ink. Red would read as a judgment on one choice. */
const OPTION_INK = "#475569";
const INK = "#1B2433";

interface StackStageProps {
  cases: readonly StudyCase[];
  beats: readonly Beat[];
  /** Chapter-local clock in ms. The only thing that drives the animation. */
  elapsedMs: number;
  /** Which model's `modelChoice1Counts` entry drives markers and the frequency bar. */
  profileKey: string;
  /** Name shown in the table header; defaults to `profileKey`. */
  profileLabel?: string;
  /** Note under the case count. Used when the table is held after the stack. */
  caption?: ReactNode;
  /** Table-to-profile hand-off, all 0..1. Omit for the plain table. */
  handoff?: TableHandoff;
}

/**
 * The four value headers carry `data-anchor="hdr-<value>"` and each row
 * `data-anchor="row-<index>"`, so whatever builds on the table measures them.
 * `rest` is the opacity of the rows, their decision bars, the ellipsis and the
 * header cells that are not values; `chrome` that of the case count and the caption.
 */
export interface TableHandoff {
  emphasis: number;
  rest: number;
  chrome: number;
}

/**
 * Renders the whole stack-to-table sequence as a pure function of `elapsedMs`.
 * The stage is a fixed logical box scaled to fit, so geometry never depends on
 * the viewport.
 */
export default function StackStage({
  cases,
  beats,
  elapsedMs,
  profileKey,
  profileLabel,
  caption,
  handoff,
}: StackStageProps) {
  if (cases.length < 3) throw new Error("StackStage needs at least 3 cases");
  const times = useMemo(() => resolveBeats(beats), [beats]);
  const counts = useMemo(
    () =>
      cases.map((c) => {
        const k = c.modelChoice1Counts[profileKey];
        if (k === undefined) throw new Error(`${c.id} has no modelChoice1Counts["${profileKey}"]`);
        return k;
      }),
    [cases, profileKey],
  );
  const deltas = useMemo(() => cases.slice(0, 3).map(deltaOf), [cases]);

  const hostRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{
    scale: number;
    left: number;
    top: number;
    layout: Layout;
  }>({
    scale: 1,
    left: 0,
    top: 0,
    layout: WIDE,
  });
  const L = fit.layout;
  const frame = computeFrame(elapsedMs, times, counts, L);
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const measure = () => {
      const { width, height } = host.getBoundingClientRect();
      const layout = layoutFor(width, height);
      const scale = Math.min(width / layout.stageW, height / layout.stageH);
      setFit({
        scale,
        left: (width - layout.stageW * scale) / 2,
        top: (height - layout.stageH * scale) / 2,
        layout,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  // Cards stay centered. As they become rows, the stage rises so the table
  // header sits just under the headline instead of in the middle of the scene.
  const shiftSpan = (times.morph - times.gather) * 0.14;
  const shiftP =
    shiftSpan <= 0 ? (elapsedMs >= times.gather ? 1 : 0) : easeInOut(clamp01((elapsedMs - times.gather) / shiftSpan));
  const stageTop = lerp(fit.top, 8 - L.headerY * fit.scale, shiftP);

  return (
    <div ref={hostRef} className="relative h-full w-full" data-testid="stack-host">
      <div
        data-testid="stack-stage"
        style={{
          position: "absolute",
          left: fit.left,
          top: stageTop,
          width: L.stageW,
          height: L.stageH,
          transform: `scale(${fit.scale})`,
          transformOrigin: "top left",
          color: INK,
        }}
      >
        <Centered layout={L} y={L.stackLabelY} opacity={frame.stackLabel}>
          <span className="text-lg font-semibold tracking-tight" style={{ color: `${INK}cc` }}>
            {cases.length} physician-reviewed dilemmas
          </span>
        </Centered>

        <div
          style={{
            position: "absolute",
            left: (L.stageW - L.rowW) / 2,
            top: L.headerY,
            width: L.rowW,
            height: L.headerH,
            opacity: frame.headerOpacity,
          }}
        >
          <TableHeader profileLabel={profileLabel ?? profileKey} compact={L.compactRows} handoff={handoff} />
        </div>

        <div style={{ opacity: handoff?.rest ?? 1 }}>
        {frame.cards.map((card) =>
          card.opacity <= 0 ? null : (
            <StackCard
              key={cases[card.index].id}
              card={card}
              study={cases[card.index]}
              delta={deltas[card.index]}
              layout={L}
            />
          ),
        )}
        </div>

        {/* The contents of every card, in flight to their columns. The first three cards' contents
            ride above the rows; the rest pass behind them on their way to the ellipsis. */}
        {[false, true].map((kept) => (
          <div
            key={String(kept)}
            style={{ position: "absolute", inset: 0, zIndex: kept ? 2000 : 600, pointerEvents: "none", opacity: handoff?.rest ?? 1 }}
          >
            {frame.cards.map((card) =>
              !card.flying || card.fly >= 1 || card.index < FOREGROUND !== kept ? null : (
                <FlightParts
                  key={cases[card.index].id}
                  card={card}
                  study={cases[card.index]}
                  delta={deltas[card.index]}
                  layout={L}
                />
              ),
            )}
          </div>
        ))}

        <Centered layout={L} y={L.ellipsisY} opacity={frame.ellipsisOpacity * (handoff?.rest ?? 1)}>
          <span className="text-3xl leading-none tracking-[0.3em]" style={{ color: `${INK}99` }}>
            ...
          </span>
        </Centered>
        <Centered layout={L} y={L.countLabelY} opacity={frame.countLabelOpacity * (handoff?.chrome ?? 1)}>
          <span data-stack-footer className="text-lg font-semibold tracking-tight" style={{ color: `${INK}cc` }}>
            {cases.length} cases
          </span>
        </Centered>
        {caption && (
          <div
            style={{
              position: "absolute",
              left: (L.stageW - L.rowW) / 2,
              top: L.countLabelY + 22,
              width: L.rowW,
              boxSizing: "border-box",
              padding: "0 16px",
              textAlign: "center",
              opacity: frame.countLabelOpacity * (handoff?.chrome ?? 1),
              pointerEvents: "none",
              color: "#4b5563",
              fontSize: 16,
              lineHeight: 1.35,
            }}
          >
            {caption}
          </div>
        )}
      </div>
    </div>
  );
}

function Centered({
  layout,
  y,
  opacity,
  children,
}: {
  layout: Layout;
  y: number;
  opacity: number;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        width: layout.stageW,
        top: y,
        transform: "translateY(-50%)",
        textAlign: "center",
        opacity,
        pointerEvents: "none",
      }}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  One card: faces, row shell, row content, edge markers                     */
/* -------------------------------------------------------------------------- */

function StackCard({
  card,
  study,
  delta,
  layout,
}: {
  card: CardFrame;
  study: StudyCase;
  delta: ReturnType<typeof deltaOf> | undefined;
  layout: Layout;
}) {
  const showBack = card.flipDeg > 90;
  return (
    <div
      aria-hidden={card.index >= FOREGROUND ? true : undefined}
      data-anchor={`row-${card.index}`}
      style={{
        position: "absolute",
        left: card.cx - card.w / 2,
        top: card.cy - card.h / 2,
        width: card.w,
        height: card.h,
        transform: `rotate(${card.rot}deg)`,
        zIndex: card.zIndex,
        opacity: card.opacity,
        pointerEvents: "none",
      }}
    >
      {/* Table row chrome: takes over from the faces early in the morph. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          boxSizing: "border-box",
          borderRadius: card.shellRadius,
          background: "#fff",
          border: `${card.shellBorder}px solid #e5e7eb`,
          boxShadow: "0 1px 2px rgba(17,24,39,0.06)",
          opacity: card.shellOpacity,
        }}
      />
      {card.highlight > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 12,
            background: "#F1F1F2",
            border: "1px solid #3B4350",
            boxShadow: "0 0 0 1px #3B4350",
            opacity: card.highlight,
          }}
        />
      )}

      {delta && (
        // Clipped to the shell, so the row's content is revealed as the card widens.
        <div style={{ position: "absolute", inset: 0, borderRadius: 12, overflow: "hidden" }}>
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: layout.rowW,
              height: layout.rowH,
              transform: "translate(-50%, -50%)",
              opacity: card.rowOpacity,
            }}
          >
            <RowContent
              study={study}
              delta={delta}
              freqFill={card.freqFill}
              count={card.choice1Count}
              compact={layout.compactRows}
            />
          </div>
        </div>
      )}

      {card.faceOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: CARD_W,
            height: CARD_H,
            transform: `translate(-50%, -50%) scale(${card.faceScale})`,
            opacity: card.faceOpacity,
          }}
        >
          <div style={{ width: "100%", height: "100%", transform: `perspective(900px) rotateY(${card.flipDeg}deg)` }}>
            {showBack ? (
              <div style={{ width: "100%", height: "100%", transform: "rotateY(180deg)" }}>
                <CardBack study={study} />
              </div>
            ) : (
              <CardFront study={study} mini={clamp01((MINI_BELOW + MINI_FADE - card.faceScale) / MINI_FADE)} />
            )}
          </div>
        </div>
      )}

      {card.markerOpacity > 0 && card.dots > 0 && (
        <DotStrip side="left" frame={card} />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Contents in flight: title, tags and decisions travel to their columns     */
/* -------------------------------------------------------------------------- */

/**
 * Geometry of the tag side of a card at its natural size (CARD_W x CARD_H), so
 * the parts that leave it can start exactly where the faces drew them. The
 * card's content box begins 15px in: 14px of padding and a 1px border.
 */
const BACK = {
  pad: 15,
  innerW: CARD_W - 30,
  titleSize: 18,
  titleH: 20,
  titleGap: 8,
  colGap: 10,
  labelH: 12,
  labelGap: 5,
  chipH: 22,
  chipGap: 4,
} as const;
const BACK_COL_W = (BACK.innerW - BACK.colGap) / 2;
const BACK_LABEL_TOP = BACK.pad + BACK.titleH + BACK.titleGap;
const BACK_CHIPS_TOP = BACK_LABEL_TOP + BACK.labelH + BACK.labelGap;

const ramp = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));
const colLeft = (choice: number) => BACK.pad + choice * (BACK_COL_W + BACK.colGap);

interface Rect {
  left: number;
  top: number;
  w: number;
  h: number;
}
const lerpRect = (a: Rect, b: Rect, t: number): Rect => ({
  left: lerp(a.left, b.left, t),
  top: lerp(a.top, b.top, t),
  w: lerp(a.w, b.w, t),
  h: lerp(a.h, b.h, t),
});
const rectStyle = (r: Rect) => ({ position: "absolute", left: r.left, top: r.top, width: r.w, height: r.h }) as const;

/**
 * One card's contents, each item travelling from where it sat on the card to
 * where it belongs in the table: the title to the Case column, the two tags of
 * each value to that value's column (where they merge into one trade-off chip),
 * and the ten decision dots to the decision bar. The first three cards land in
 * their rows; every other card's items run into the ellipsis row and fade out.
 * `card.fly` is this card's linear 0..1 progress. A row's items go one after
 * another (title, then each value's tags, then the ten dots, then the count);
 * the other cards move all their items together.
 */
function FlightParts({
  card,
  study,
  delta,
  layout,
}: {
  card: CardFrame;
  study: StudyCase;
  delta: ReturnType<typeof deltaOf> | undefined;
  layout: Layout;
}) {
  const lin = card.fly;
  const g = layout.gridScale;
  const kept = card.index < FOREGROUND && delta !== undefined;
  /** Eased progress of one item. Row items run on their own slice of the card's time. */
  const stage = (from: number, to: number) => easeInOut(kept ? ramp(lin, from, to) : lin);
  const q = easeInOut(lin);
  const to = rowTargets(layout, kept ? layout.rowTops[card.index] + layout.rowH / 2 : layout.ellipsisY);
  // The card's top-left in the grid: where every item starts.
  const boxLeft = card.slotX - (CARD_W * g) / 2;
  const boxTop = card.slotY - (CARD_H * g) / 2;
  // Items that do not land in a row dissolve as they arrive at the ellipsis.
  const dissolve = kept ? 1 : 1 - ramp(q, 0.4, 0.85);
  const titleQ = stage(0, 0.35);
  if (dissolve <= 0) return null;

  const item = caseCardFor(study);
  const count = card.choice1Count;

  // Title, then the id it becomes in the Case column.
  const titleSize = lerp(BACK.titleSize * g, to.text, titleQ);
  const titleBox = {
    position: "absolute",
    left: lerp(boxLeft + BACK.pad * g, to.caseX, titleQ),
    top: lerp(boxTop + (BACK.pad + BACK.titleH / 2) * g, to.cy, titleQ),
    maxWidth: lerp(BACK.innerW * g, to.caseW - 8, titleQ),
    transform: "translateY(-50%)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    lineHeight: 1,
    fontSize: titleSize,
    color: INK,
  } as const;
  const idIn = kept ? ramp(titleQ, 0.5, 0.85) : 0;

  // "CHOICE 1" / "CHOICE 2" stay behind, fading as their tags leave.
  const labelOpacity = 1 - ramp(lin, 0, 0.12);

  // Tags: one chip per value per choice, merging into the trade-off chip.
  const chips = [];
  for (const [vi, v] of VALUES.entries()) {
    // One value at a time: its two tags travel, merge, and the next value goes.
    const cq = stage(0.12 + 0.1 * vi, 0.47 + 0.1 * vi);
    const chipsOut = kept ? 1 - ramp(cq, 0.55, 0.85) : 1;
    const chipText = lerp(10 * g, 11, cq);
    const target: Rect = { left: to.chipX[vi] - to.chipW / 2, top: to.cy - to.chipH / 2, w: to.chipW, h: to.chipH };
    for (const choice of [0, 1] as const) {
      const tag = study.tags[choice][v];
      const from: Rect = {
        left: boxLeft + colLeft(choice) * g,
        top: boxTop + (BACK_CHIPS_TOP + vi * (BACK.chipH + BACK.chipGap)) * g,
        w: BACK_COL_W * g,
        h: BACK.chipH * g,
      };
      const style = TAG_STYLE[tag];
      chips.push(
        <div
          key={`${v}-${choice}`}
          style={{
            ...rectStyle(lerpRect(from, target, cq)),
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            gap: lerp(5 * g, 2, cq),
            padding: `0 ${lerp(6 * g, 3, cq)}px`,
            borderRadius: 999,
            background: style.bg,
            fontSize: chipText,
            lineHeight: 1,
            whiteSpace: "nowrap",
            opacity: chipsOut * dissolve,
          }}
        >
          <span style={{ flex: 1, overflow: "hidden", opacity: 1 - ramp(cq, 0, 0.3) }}>{VALUE_NAMES[v]}</span>
          <span className="font-mono" style={{ color: style.fg, fontWeight: 700 }}>
            {SIGN[tag]}
          </span>
        </div>,
      );
    }
    if (kept) {
      const d = delta[v];
      const meanFrom: Rect = {
        left: boxLeft + (colLeft(0) + colLeft(1)) * 0.5 * g,
        top: boxTop + (BACK_CHIPS_TOP + vi * (BACK.chipH + BACK.chipGap)) * g,
        w: BACK_COL_W * g,
        h: BACK.chipH * g,
      };
      const r = lerpRect(meanFrom, target, cq);
      chips.push(
        <div
          key={`${v}-delta`}
          className="font-mono"
          style={{
            ...rectStyle(r),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: lerp(r.h / 2, to.chipRadius, cq),
            background: DELTA_TINT[d],
            color: d === 0 ? "#6b7280" : d > 0 ? "#1D7A4D" : "#B42318",
            fontSize: lerp(10 * g, to.text, cq),
            fontWeight: 600,
            lineHeight: 1,
            opacity: ramp(cq, 0.55, 0.85),
          }}
        >
          {d > 0 ? `+${d}` : d < 0 ? `\u2212${-d}` : "0"}
        </div>,
      );
    }
  }

  // Decisions: ten dots, one per query, become the ten slots of the frequency bar.
  const k = Math.min(1, g);
  const dot = DOT_SIZE * k;
  const pitch = DOT_PITCH * k;
  const shown = Math.min(TRIALS, Math.max(0, Math.floor((CARD_H * g - 8) / pitch)));
  const dotsTop = boxTop + Math.max(4, (CARD_H * g - TRIALS * pitch) / 2);
  const slotW = to.barW / TRIALS;
  const endRadius = Math.min(5, to.barH / 2);
  const decisions = [];
  for (let j = 0; j < shown; j++) {
    // One dot at a time, top to bottom, each dropping into its slot of the bar.
    const dq = stage(0.45 + 0.035 * j, 0.65 + 0.035 * j);
    const settle = ramp(dq, 0.4, 1);
    const from: Rect = { left: boxLeft - (dot + 4), top: dotsTop + j * pitch + (pitch - dot) / 2, w: dot, h: dot };
    const slot: Rect = { left: to.barX + j * slotW, top: to.cy - to.barH / 2, w: slotW + 0.5, h: to.barH };
    const corner = (end: boolean) => lerp(dot / 2, end ? endRadius : 0, settle);
    const left = corner(j === 0);
    const right = corner(j === TRIALS - 1);
    decisions.push(
      <div
        key={j}
        style={{
          ...rectStyle(lerpRect(from, slot, dq)),
          borderRadius: `${left}px ${right}px ${right}px ${left}px`,
          background: j < count ? CHOICE_COLORS[0] : CHOICE_COLORS[1],
          opacity: dissolve,
        }}
      />,
    );
  }

  return (
    <>
      {[0, 1].map((choice) => (
        <div
          key={choice}
          className="font-mono"
          style={{
            position: "absolute",
            left: boxLeft + colLeft(choice) * g,
            top: boxTop + (BACK_LABEL_TOP + BACK.labelH / 2) * g,
            transform: "translateY(-50%)",
            whiteSpace: "nowrap",
            fontSize: 10 * g,
            lineHeight: 1,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            fontWeight: 600,
            color: OPTION_INK,
            opacity: labelOpacity,
          }}
        >
          Choice {choice + 1}
        </div>
      ))}
      {chips}
      {decisions}
      <div style={{ ...titleBox, fontWeight: 700, letterSpacing: "-0.01em", opacity: (1 - idIn) * dissolve }}>{item.title}</div>
      {kept && (
        <div className="font-mono" style={{ ...titleBox, fontWeight: 600, letterSpacing: 0, opacity: idIn }}>
          {displayId(study.id)}
        </div>
      )}
      {kept && (
        <div
          className="font-mono"
          style={{
            position: "absolute",
            left: to.countRight - to.countW,
            width: to.countW,
            top: to.cy,
            transform: "translateY(-50%)",
            textAlign: "right",
            fontSize: to.text,
            fontWeight: 600,
            lineHeight: 1,
            color: INK,
            opacity: ramp(lin, 0.85, 0.97),
          }}
        >
          {count}/{TRIALS}
        </div>
      )}
    </>
  );
}

/**
 * A column of dots hugging a card edge, one dot per model query: choice 1 dots
 * first, then choice 2. The column keeps its full height; dots arrive top to bottom.
 */
function DotStrip({ side, frame }: { side: "left" | "right"; frame: CardFrame }) {
  // Dots shrink with small cards so a column never outgrows its card.
  const k = Math.min(1, frame.faceScale);
  const dot = DOT_SIZE * k;
  const pitch = DOT_PITCH * k;
  const maxDots = Math.max(0, Math.floor((frame.h - 8) / pitch));
  const shown = Math.min(frame.dots, maxDots);
  const first = Math.min(shown, frame.choice1Count);
  const second = shown - first;
  const column = (count: number, offset: number, color: string) =>
    count > 0 && (
      <div
        style={{
          position: "absolute",
          left: 0,
          top: offset * pitch,
          width: dot,
          height: count * pitch,
          backgroundImage: `radial-gradient(circle, ${color} ${dot / 2 - 0.4}px, transparent ${dot / 2}px)`,
          backgroundSize: `${dot}px ${pitch}px`,
          backgroundRepeat: "repeat-y",
        }}
      />
    );
  return (
    <div
      style={{
        position: "absolute",
        [side]: -(dot + 4),
        top: Math.max(4, (frame.h - TRIALS * pitch) / 2),
        width: dot,
        height: shown * pitch,
        opacity: frame.markerOpacity,
      }}
    >
      {column(first, 0, CHOICE_COLORS[0])}
      {column(second, frame.choice1Count, CHOICE_COLORS[1])}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Faces (natural size CARD_W x CARD_H; the wrapper scales them)             */
/* -------------------------------------------------------------------------- */

/**
 * The decision side. Small cards show just the big title; larger ones show the
 * full card. `mini` (0..1) cross-fades between them as a card changes size.
 */
const CardFront = memo(function CardFront({ study, mini }: { study: StudyCase; mini: number }) {
  const item = caseCardFor(study);
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {mini < 1 && (
        <div style={{ position: "absolute", inset: 0, opacity: 1 - mini }}>
          <CaseCardFace item={item} />
        </div>
      )}
      {mini > 0 && (
        <div style={{ position: "absolute", inset: 0, opacity: mini }}>
          <CaseCardMini item={item} />
        </div>
      )}
    </div>
  );
});

const SIGN: Record<Tag, string> = { [-1]: "\u2212", 0: "0", 1: "+" };
const TAG_STYLE: Record<Tag, { bg: string; fg: string }> = {
  [-1]: { bg: "#FDECEA", fg: "#B42318" },
  0: { bg: "#F3F4F6", fg: "#6b7280" },
  1: { bg: "#E6F4EC", fg: "#1D7A4D" },
};

const CardBack = memo(function CardBack({ study }: { study: StudyCase }) {
  const card = caseCardFor(study);
  return (
    <div style={{ ...caseFaceStyle, display: "flex", flexDirection: "column" }}>
      <div
        style={{
          fontSize: BACK.titleSize,
          fontWeight: 700,
          lineHeight: `${BACK.titleH}px`,
          letterSpacing: "-0.01em",
          color: INK,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {card.title}
      </div>
      <div style={{ marginTop: BACK.titleGap, display: "grid", gridTemplateColumns: "1fr 1fr", gap: BACK.colGap }}>
        {study.tags.map((tags, i) => (
          <div key={i}>
            <div
              className="font-mono"
              style={{
                fontSize: 10,
                lineHeight: `${BACK.labelH}px`,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: OPTION_INK,
                fontWeight: 600,
              }}
            >
              Choice {i + 1}
            </div>
            <div style={{ marginTop: BACK.labelGap, display: "grid", gap: BACK.chipGap }}>
              {VALUES.map((v) => (
                <Chip key={v} value={v} tag={tags[v]} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

function Chip({ value, tag }: { value: Value; tag: Tag }) {
  const s = TAG_STYLE[tag];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        height: BACK.chipH,
        padding: "0 6px",
        borderRadius: 999,
        background: s.bg,
        fontSize: 10,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{VALUE_NAMES[value]}</span>
      <span className="font-mono" style={{ color: s.fg, fontWeight: 700 }}>
        {SIGN[tag]}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Table row                                                                 */
/* -------------------------------------------------------------------------- */

const GRID = "140px repeat(4, 96px) 1fr";
const GRID_COMPACT = "62px repeat(4, 34px) 1fr";

function TableHeader({
  profileLabel,
  compact,
  handoff,
}: {
  profileLabel: string;
  compact: boolean;
  handoff?: TableHandoff;
}) {
  const rest = handoff ? { opacity: handoff.rest } : undefined;
  const label = {
    fontSize: compact ? 10 : 10,
    letterSpacing: "0.04em",
    color: "#6b7280",
    textAlign: "center",
    whiteSpace: "nowrap",
  } as const;
  return (
    <div
      className="font-mono"
      style={{
        display: "grid",
        gridTemplateColumns: compact ? GRID_COMPACT : GRID,
        gridTemplateRows: "1fr 1fr",
        alignItems: "end",
        height: "100%",
        padding: compact ? "0 12px" : "0 20px",
      }}
    >
      <span />
      <span
        style={{
          ...label,
          gridColumn: "2 / 6",
          alignSelf: "center",
          borderBottom: "1px solid #d1d5db",
          paddingBottom: 3,
          margin: compact ? "0 4px" : "0 10px",
          ...rest,
        }}
      >
        {compact ? "\u0394 tags" : "\u0394 tags, choice 1 minus choice 2"}
      </span>
      <span />
      <span data-anchor="hdr-case" style={{ ...label, textAlign: "left", ...rest }}>
        Case
      </span>
      {VALUES.map((v) => {
        const e = handoff?.emphasis ?? 0;
        return (
          <span key={v} style={compact ? { ...label, color: VALUE_COLORS[v], fontWeight: 700, fontSize: 12 } : label}>
            <span
              data-anchor={`hdr-${v}`}
              style={{
                borderRadius: 4,
                ...(e > 0
                  ? {
                      color: `color-mix(in srgb, ${INK} ${e * 100}%, ${compact ? VALUE_COLORS[v] : "#6b7280"})`,
                      background: `rgba(27,36,51,${0.07 * e})`,
                      boxShadow: `0 0 0 3px rgba(27,36,51,${0.07 * e})`,
                    }
                  : null),
              }}
            >
              {compact ? v : VALUE_NAMES[v]}
            </span>
          </span>
        );
      })}
      <span style={{ ...label, textAlign: "left", paddingLeft: compact ? 10 : 20, ...rest }}>
        {compact ? `${profileLabel} chose 1` : `${profileLabel} chose option 1`}
      </span>
    </div>
  );
}

export const DELTA_TINT: Record<number, string> = {
  [-2]: "rgba(180,35,24,0.26)",
  [-1]: "rgba(180,35,24,0.12)",
  0: "rgba(107,114,128,0.10)",
  1: "rgba(29,122,77,0.14)",
  2: "rgba(29,122,77,0.28)",
};

function RowContent({
  study,
  delta,
  freqFill,
  count,
  compact,
}: {
  study: StudyCase;
  delta: ReturnType<typeof deltaOf>;
  freqFill: number;
  /** Queries (out of TRIALS) where the model chose choice 1. */
  count: number;
  compact: boolean;
}) {
  const frequency = count / TRIALS;
  const grid = compact ? ROW_GRID.compact : ROW_GRID.wide;
  const text = grid.text;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: compact ? GRID_COMPACT : GRID,
        alignItems: "center",
        height: "100%",
        padding: compact ? "0 12px" : "0 20px",
      }}
    >
      <span className="font-mono" style={{ fontSize: text, fontWeight: 600 }}>
        {displayId(study.id)}
      </span>
      {VALUES.map((v) => {
        const d = delta[v];
        return (
          <span key={v} style={{ display: "flex", justifyContent: "center" }}>
            <span
              className="font-mono"
              style={{
                boxSizing: "border-box",
                width: grid.chipW,
                height: grid.chipH,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1,
                borderRadius: grid.chipRadius,
                fontSize: text,
                fontWeight: 600,
                background: DELTA_TINT[d],
                color: d === 0 ? "#6b7280" : d > 0 ? "#1D7A4D" : "#B42318",
              }}
            >
              {d > 0 ? `+${d}` : d < 0 ? `\u2212${-d}` : "0"}
            </span>
          </span>
        );
      })}
      <span style={{ display: "flex", alignItems: "center", gap: compact ? 8 : 12, paddingLeft: compact ? 10 : 20 }}>
        <span
          style={{
            position: "relative",
            flex: 1,
            height: compact ? 8 : 10,
            borderRadius: 5,
            background: CHOICE_COLORS[1],
            overflow: "hidden",
          }}
        >
          <span
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${frequency * freqFill * 100}%`,
              background: CHOICE_COLORS[0],
            }}
          />
        </span>
        <span
          className="font-mono"
          style={{ width: compact ? 36 : 48, textAlign: "right", fontSize: text, fontWeight: 600 }}
        >
          {count}/{TRIALS}
        </span>
      </span>
    </div>
  );
}
