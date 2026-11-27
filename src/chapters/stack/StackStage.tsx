import { memo, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MOVE_MS } from "../../design/motion";
import type { StudyCase, Tag, Value } from "../../study/types";
import type { Beat } from "../../types";
import { PatientCard } from "../opening/OpeningScene";
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
  TRIALS,
  WIDE,
  type CardFrame,
  type Layout,
} from "./timeline";

/** UUID ids are shown as their first 8 hex chars; other ids are shown whole. */
const displayId = (id: string) => (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id) ? id.slice(0, 8) : id);

/** Choice 1 and choice 2 colors: used by edge markers, card backs and the frequency bar. */
/** Where the opening's patient card sits on screen (viewport px) when the stack takes over from it. */
export interface PatientBridge {
  left: number;
  top: number;
  width: number;
  height: number;
  /** Computed font size of the card, so its em-based text renders identically. */
  fontPx: number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const CHOICE_COLORS = ["#D1495B", "#475569"] as const;
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
  /**
   * The opening's patient card. While the chapter clock is before the `shrink`
   * beat, the first card starts as that card (same place, same size) and
   * turns into the stack's first card.
   */
  bridge?: PatientBridge | null;
  /** Note under the case count. Used when the table is held after the stack. */
  caption?: ReactNode;
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
  bridge,
  caption,
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
    hostLeft: number;
    hostTop: number;
    layout: Layout;
  }>({
    scale: 1,
    left: 0,
    top: 0,
    hostLeft: 0,
    hostTop: 0,
    layout: WIDE,
  });
  const L = fit.layout;
  const frame = computeFrame(elapsedMs, times, counts, L);
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const measure = () => {
      const { width, height, left: hostLeft, top: hostTop } = host.getBoundingClientRect();
      const layout = layoutFor(width, height);
      const scale = Math.min(width / layout.stageW, height / layout.stageH);
      setFit({
        scale,
        left: (width - layout.stageW * scale) / 2,
        top: (height - layout.stageH * scale) / 2,
        hostLeft,
        hostTop,
        layout,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  // Bridge: card 0 starts as the opening's patient card and settles into the stack card.
  const bridgeMs = Math.min(times.shrink, MOVE_MS);
  const bridgeP = bridge && bridgeMs > 0 ? 1 - easeInOut(clamp01(elapsedMs / bridgeMs)) : 0;
  const patient =
    bridge && bridgeP > 0
      ? {
          cx: (bridge.left + bridge.width / 2 - fit.hostLeft - fit.left) / fit.scale,
          cy: (bridge.top + bridge.height / 2 - fit.hostTop - fit.top) / fit.scale,
          w: bridge.width / fit.scale,
          h: bridge.height / fit.scale,
          fontPx: bridge.fontPx / fit.scale,
        }
      : null;

  // Cards stay centered. As they become rows, the stage rises so the table
  // header sits just under the headline instead of in the middle of the scene.
  const shiftSpan = times.highlight - times.morph;
  const shiftP =
    shiftSpan <= 0 ? (elapsedMs >= times.morph ? 1 : 0) : easeInOut(clamp01((elapsedMs - times.morph) / shiftSpan));
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
          <TableHeader profileLabel={profileLabel ?? profileKey} compact={L.compactRows} />
        </div>

        {frame.cards.map((frameCard) => {
          const card =
            frameCard.index === 0 && patient
              ? {
                  ...frameCard,
                  cx: lerp(frameCard.cx, patient.cx, bridgeP),
                  cy: lerp(frameCard.cy, patient.cy, bridgeP),
                  w: lerp(frameCard.w, patient.w, bridgeP),
                  h: lerp(frameCard.h, patient.h, bridgeP),
                  shellOpacity: Math.max(frameCard.shellOpacity, 1),
                  faceOpacity: frameCard.faceOpacity * clamp01((0.6 - bridgeP) / 0.3),
                }
              : frameCard;
          return card.opacity <= 0 ? null : (
            <StackCard
              key={cases[card.index].id}
              card={card}
              study={cases[card.index]}
              delta={deltas[card.index]}
              layout={L}
              patient={card.index === 0 && patient ? { ...patient, opacity: clamp01((bridgeP - 0.4) / 0.3) } : null}
            />
          );
        })}

        <Centered layout={L} y={L.ellipsisY} opacity={frame.ellipsisOpacity}>
          <span className="text-3xl leading-none tracking-[0.3em]" style={{ color: `${INK}99` }}>
            ...
          </span>
        </Centered>
        <Centered layout={L} y={L.countLabelY} opacity={frame.countLabelOpacity}>
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
              opacity: frame.countLabelOpacity,
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
  patient,
}: {
  card: CardFrame;
  study: StudyCase;
  delta: ReturnType<typeof deltaOf> | undefined;
  layout: Layout;
  patient: { w: number; h: number; fontPx: number; opacity: number } | null;
}) {
  const showBack = card.flipDeg > 90;
  return (
    <div
      aria-hidden={card.index >= FOREGROUND ? true : undefined}
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
          borderRadius: 12,
          background: "#fff",
          border: "1px solid #e5e7eb",
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

      {patient && patient.opacity > 0 && (
        // The opening's patient card, uniformly scaled to the card's current box.
        <div style={{ position: "absolute", inset: 0, borderRadius: 12, overflow: "hidden", opacity: patient.opacity }}>
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: patient.w,
              fontSize: patient.fontPx,
              transform: `translate(-50%, -50%) scale(${Math.min(card.w / patient.w, card.h / patient.h)})`,
            }}
          >
            <PatientCard />
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
              <CardFront study={study} />
            )}
          </div>
        </div>
      )}

      {card.markerOpacity > 0 && card.dots > 0 && (
        <>
          <DotStrip side="left" frame={card} />
          <DotStrip side="right" frame={card} />
        </>
      )}
    </div>
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

const faceBase = {
  width: "100%",
  height: "100%",
  boxSizing: "border-box",
  padding: 14,
  borderRadius: 12,
  background: "#fff",
  border: "1px solid #e5e7eb",
  boxShadow: "0 2px 6px rgba(17,24,39,0.10)",
  overflow: "hidden",
} as const;

const clamp = (lines: number) =>
  ({
    display: "-webkit-box",
    WebkitLineClamp: lines,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  }) as const;

const CardFront = memo(function CardFront({ study }: { study: StudyCase }) {
  return (
    <div style={{ ...faceBase, display: "flex", flexDirection: "column" }}>
      <div className="font-mono" style={{ fontSize: 11, letterSpacing: "0.08em", color: "#6b7280" }}>
        {displayId(study.id)}
      </div>
      <p style={{ ...clamp(3), margin: "6px 0 0", fontSize: 12, lineHeight: 1.4 }}>{study.vignette}</p>
      <div style={{ marginTop: "auto", display: "grid", gap: 4 }}>
        {study.choices.map((choice, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              padding: "4px 7px",
              borderRadius: 6,
              background: "#FAFAFA",
              borderLeft: `3px solid ${CHOICE_COLORS[i]}`,
              fontSize: 10.5,
              lineHeight: 1.25,
            }}
          >
            <span className="font-mono" style={{ color: CHOICE_COLORS[i], fontWeight: 600 }}>
              {i + 1}
            </span>
            <span style={{ ...clamp(1), minWidth: 0 }}>{choice}</span>
          </div>
        ))}
      </div>
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
  return (
    <div style={{ ...faceBase, display: "flex", flexDirection: "column" }}>
      <div className="font-mono" style={{ fontSize: 11, letterSpacing: "0.08em", color: "#6b7280" }}>
        {displayId(study.id)} <span style={{ opacity: 0.6 }}>tags</span>
      </div>
      <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {study.tags.map((tags, i) => (
          <div key={i}>
            <div
              className="font-mono"
              style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: CHOICE_COLORS[i], fontWeight: 600 }}
            >
              Choice {i + 1}
            </div>
            <div style={{ marginTop: 5, display: "grid", gap: 4 }}>
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
        height: 22,
        padding: "0 6px",
        borderRadius: 999,
        background: s.bg,
        fontSize: 10,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 3, background: VALUE_COLORS[value], flex: "none" }} />
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

function TableHeader({ profileLabel, compact }: { profileLabel: string; compact: boolean }) {
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
        }}
      >
        {compact ? "\u0394 tags" : "\u0394 tags, choice 1 minus choice 2"}
      </span>
      <span />
      <span style={{ ...label, textAlign: "left" }}>Case</span>
      {VALUES.map((v) => (
        <span key={v} style={compact ? { ...label, color: VALUE_COLORS[v], fontWeight: 700, fontSize: 12 } : label}>
          {compact ? v : VALUE_NAMES[v]}
        </span>
      ))}
      <span style={{ ...label, textAlign: "left", paddingLeft: compact ? 10 : 20 }}>
        {compact ? `${profileLabel} chose 1` : `${profileLabel} chose option 1`}
      </span>
    </div>
  );
}

const DELTA_TINT: Record<number, string> = {
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
  const text = compact ? 12 : 14;
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
                minWidth: compact ? 28 : 44,
                textAlign: "center",
                padding: compact ? "3px 0" : "4px 0",
                borderRadius: compact ? 6 : 8,
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
