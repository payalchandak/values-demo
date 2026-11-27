import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { StudyCase, Tag, Value } from "../../study/types";
import type { Beat } from "../../types";
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
  COUNT_LABEL_Y,
  DOT_PITCH,
  ELLIPSIS_Y,
  FOREGROUND,
  HEADER_H,
  HEADER_Y,
  ROW_H,
  ROW_W,
  STACK_LABEL_Y,
  STAGE_H,
  STAGE_W,
  VOTES_TOTAL,
  type CardFrame,
} from "./timeline";

/** Choice 1 and choice 2 colors: used by edge markers, card backs and the frequency bar. */
const CHOICE_COLORS = ["#D1495B", "#475569"] as const;
const INK = "#1B2433";
const DOT = 5;

interface StackStageProps {
  cases: readonly StudyCase[];
  beats: readonly Beat[];
  /** Chapter-local clock in ms. The only thing that drives the animation. */
  elapsedMs: number;
}

/**
 * Renders the whole stack-to-table sequence as a pure function of `elapsedMs`.
 * The stage is a fixed logical box scaled to fit, so geometry never depends on
 * the viewport.
 */
export default function StackStage({ cases, beats, elapsedMs }: StackStageProps) {
  if (cases.length < 3) throw new Error("StackStage needs at least 3 cases");
  const times = useMemo(() => resolveBeats(beats), [beats]);
  const votes = useMemo(() => cases.map((c) => c.physicianVotesChoice1), [cases]);
  const deltas = useMemo(() => cases.slice(0, 3).map(deltaOf), [cases]);
  const frame = computeFrame(elapsedMs, times, votes);

  const hostRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 1, left: 0, top: 0 });
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const measure = () => {
      const { width, height } = host.getBoundingClientRect();
      const scale = Math.min(width / STAGE_W, height / STAGE_H);
      setFit({ scale, left: (width - STAGE_W * scale) / 2, top: (height - STAGE_H * scale) / 2 });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={hostRef} className="relative h-full w-full" data-testid="stack-host">
      <div
        data-testid="stack-stage"
        style={{
          position: "absolute",
          left: fit.left,
          top: fit.top,
          width: STAGE_W,
          height: STAGE_H,
          transform: `scale(${fit.scale})`,
          transformOrigin: "top left",
          color: INK,
        }}
      >
        <Centered y={STACK_LABEL_Y} opacity={frame.stackLabel}>
          <span className="text-lg font-semibold tracking-tight" style={{ color: `${INK}cc` }}>
            {cases.length} physician-reviewed dilemmas
          </span>
        </Centered>

        <div
          style={{
            position: "absolute",
            left: (STAGE_W - ROW_W) / 2,
            top: HEADER_Y,
            width: ROW_W,
            height: HEADER_H,
            opacity: frame.headerOpacity,
          }}
        >
          <TableHeader />
        </div>

        {frame.cards.map((card) =>
          card.opacity <= 0 ? null : (
            <StackCard key={cases[card.index].id} card={card} study={cases[card.index]} delta={deltas[card.index]} />
          ),
        )}

        <Centered y={ELLIPSIS_Y} opacity={frame.ellipsisOpacity}>
          <span className="text-3xl leading-none tracking-[0.3em]" style={{ color: `${INK}99` }}>
            ...
          </span>
        </Centered>
        <Centered y={COUNT_LABEL_Y} opacity={frame.countLabelOpacity}>
          <span className="text-lg font-semibold tracking-tight" style={{ color: `${INK}cc` }}>
            {cases.length} cases
          </span>
        </Centered>
      </div>
    </div>
  );
}

function Centered({ y, opacity, children }: { y: number; opacity: number; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        width: STAGE_W,
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
}: {
  card: CardFrame;
  study: StudyCase;
  delta: ReturnType<typeof deltaOf> | undefined;
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
              width: ROW_W,
              height: ROW_H,
              transform: "translate(-50%, -50%)",
              opacity: card.rowOpacity,
            }}
          >
            <RowContent study={study} delta={delta} freqFill={card.freqFill} />
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
 * A column of dots hugging a card edge, one dot per physician vote:
 * choice 1 dots first, then choice 2. Dots arrive top to bottom.
 */
function DotStrip({ side, frame }: { side: "left" | "right"; frame: CardFrame }) {
  const maxDots = Math.max(0, Math.floor((frame.h - 8) / DOT_PITCH));
  const shown = Math.min(frame.dots, maxDots);
  const first = Math.min(shown, frame.choice1Votes);
  const second = shown - first;
  const column = (count: number, offset: number, color: string) =>
    count > 0 && (
      <div
        style={{
          position: "absolute",
          left: 0,
          top: offset * DOT_PITCH,
          width: DOT,
          height: count * DOT_PITCH,
          backgroundImage: `radial-gradient(circle, ${color} ${DOT / 2 - 0.3}px, transparent ${DOT / 2}px)`,
          backgroundSize: `${DOT}px ${DOT_PITCH}px`,
          backgroundRepeat: "repeat-y",
        }}
      />
    );
  return (
    <div
      style={{
        position: "absolute",
        [side]: -(DOT + 4),
        top: 4,
        width: DOT,
        height: shown * DOT_PITCH,
        opacity: frame.markerOpacity,
      }}
    >
      {column(first, 0, CHOICE_COLORS[0])}
      {column(second, frame.choice1Votes, CHOICE_COLORS[1])}
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
        {study.id}
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
        {study.id} <span style={{ opacity: 0.6 }}>tags</span>
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

function TableHeader() {
  const label = {
    fontSize: 10,
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
        gridTemplateColumns: GRID,
        gridTemplateRows: "1fr 1fr",
        alignItems: "end",
        height: "100%",
        padding: "0 20px",
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
          margin: "0 10px",
        }}
      >
        {"\u0394"} tags, choice 1 minus choice 2
      </span>
      <span />
      <span style={{ ...label, textAlign: "left", fontSize: 10 }}>Case</span>
      {VALUES.map((v) => (
        <span key={v} style={label}>
          {VALUE_NAMES[v]}
        </span>
      ))}
      <span style={{ ...label, textAlign: "left", paddingLeft: 20 }}>Chose option 1</span>
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
}: {
  study: StudyCase;
  delta: ReturnType<typeof deltaOf>;
  freqFill: number;
}) {
  const frequency = study.physicianVotesChoice1 / VOTES_TOTAL;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: GRID,
        alignItems: "center",
        height: "100%",
        padding: "0 20px",
      }}
    >
      <span className="font-mono" style={{ fontSize: 14, fontWeight: 600 }}>
        {study.id}
      </span>
      {VALUES.map((v) => {
        const d = delta[v];
        return (
          <span key={v} style={{ display: "flex", justifyContent: "center" }}>
            <span
              className="font-mono"
              style={{
                minWidth: 44,
                textAlign: "center",
                padding: "4px 0",
                borderRadius: 8,
                fontSize: 14,
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
      <span style={{ display: "flex", alignItems: "center", gap: 12, paddingLeft: 20 }}>
        <span
          style={{
            position: "relative",
            flex: 1,
            height: 10,
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
        <span className="font-mono" style={{ width: 40, textAlign: "right", fontSize: 14, fontWeight: 600 }}>
          {Math.round(frequency * 100)}%
        </span>
      </span>
    </div>
  );
}
