import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import ProviderIcon from "../../components/ProviderIcon";
import { getResponseProgress, type ModelResponseTiming } from "../../components/ModelResponse";
import { NEUTRAL } from "../../design";
import { CHARCOAL } from "./charcoal";
import { openingRows } from "./openingRows";
import { COLUMN_GAP, DOT_GAP, DOT_SIZE, EDGE_PAD, ICON_GAP } from "./rowMetrics";
import { FIRST_DOT_CHOICE, firstDotEnter, gptDecisionsEnter, markSpinDeg } from "./timeline";

const clamp01 = (n: number): number => Math.min(Math.max(n, 0), 1);
const ramp = (t: number, start: number, end: number): number =>
  end <= start ? (t >= end ? 1 : 0) : clamp01((t - start) / (end - start));

/** Neutral highlight color (deliberately not green / not a success state). */
const HIGHLIGHT = "rgba(27, 36, 51, 0.14)";

interface Piece {
  text: string;
  group: number;
  /** Offset within the recommendation span, or null outside it. */
  spanOffset: number | null;
  /** Index of this piece in the full response text. */
  start: number;
}

interface Layout {
  before: Piece[];
  inSpan: Piece[];
  after: Piece[];
  groupCount: number;
  spanLength: number;
}

/** Split the response into reveal groups, then cut each group at the span edges. */
function layoutResponse(text: string, span: string, wordsPerGroup: number): Layout {
  const words = [...text.matchAll(/\S+\s*/g)];
  const groupCount = Math.max(1, Math.ceil(words.length / Math.max(1, wordsPerGroup)));
  const spanStart = text.indexOf(span);
  if (spanStart === -1) throw new Error("OpeningResponse: recommendationSpan is not a substring of the text");
  const spanEnd = spanStart + span.length;

  const layout: Layout = { before: [], inSpan: [], after: [], groupCount, spanLength: span.length };
  for (let g = 0; g < groupCount; g++) {
    const first = words[g * wordsPerGroup];
    const last = words[Math.min((g + 1) * wordsPerGroup, words.length) - 1];
    if (!first || !last) continue;
    const gStart = first.index;
    const gEnd = last.index + last[0].length;
    const cuts = [gStart, gEnd];
    for (const c of [spanStart, spanEnd]) if (c > gStart && c < gEnd) cuts.push(c);
    cuts.sort((a, b) => a - b);
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i];
      const b = cuts[i + 1];
      const inside = a >= spanStart && b <= spanEnd;
      const piece: Piece = {
        text: text.slice(a, b),
        group: g,
        spanOffset: inside ? a - spanStart : null,
        start: a,
      };
      if (inside) layout.inSpan.push(piece);
      else if (a >= spanEnd) layout.after.push(piece);
      else layout.before.push(piece);
    }
  }
  const covered = layout.before.concat(layout.inSpan, layout.after).map((p) => p.text).join("");
  if (covered !== text) throw new Error("OpeningResponse: layout does not cover the response text");
  return layout;
}

/** One query. The later dots share one fade, with the other model rows. */
function QueryDot({ enter }: { enter: number }) {
  return (
    <span
      aria-hidden
      className="block shrink-0 rounded-full"
      style={{ width: DOT_SIZE, height: DOT_SIZE, backgroundColor: CHARCOAL, opacity: enter }}
    />
  );
}

/**
 * The excerpted query. It rises into its slot beside the mark, then the answer
 * shrinks away and leaves it there.
 */
function RisingDot({ enter }: { enter: number }) {
  const p = clamp01(enter);
  const settled = p >= 1;
  return (
    <span
      aria-hidden
      className="block shrink-0 rounded-full"
      style={{
        width: DOT_SIZE,
        height: DOT_SIZE,
        backgroundColor: CHARCOAL,
        opacity: settled ? 1 : p,
        transform: settled ? undefined : `translateY(${(1 - p) * 0.7}em) scale(${0.25 + 0.75 * p})`,
        transformOrigin: "center bottom",
      }}
    />
  );
}

function decisionDots(count: number, enter: number) {
  return Array.from({ length: count }, (_, i) => <QueryDot key={i} enter={enter} />);
}

/** How many characters are on screen. 0 before typing starts; the first character appears as typing begins. */
function typedCount(elapsed: number, start: number, end: number, length: number): number {
  if (length === 0 || elapsed < start) return 0;
  if (elapsed >= end) return length;
  return Math.min(length, Math.floor(((elapsed - start) / (end - start)) * length) + 1);
}

interface OpeningResponseProps {
  text: string;
  recommendationSpan: string;
  wordsPerGroup: number;
  identifyLabel: string;
  panelLabel: string;
  iconSrc: string;
  iconLabel: string;
  /** Chapter-local playback time in ms. */
  elapsedMs: number;
  timing: ModelResponseTiming;
  /** 0..1: the answer panel shrinking away, leaving the mark and its dots. */
  collapse: number;
  /** Leave a measured slot and let the stage draw the icon. */
  hideIcon?: boolean;
}

/** Height of the row that holds the mark and the dots. The panel's top edge runs through its middle. */
const ROW = "2.25em";
const HALF_ROW = "1.125em";

/**
 * The model's response for the opening, below the options. The round provider
 * icon sits on the panel's top-left edge and spins while the panel reads
 * "Thinking…"; then the answer types out and its recommendation is picked out.
 * The first decision dot rises beside the mark, and the panel then shrinks
 * away, leaving that dot. The rest arrive later, with the other model rows,
 * once the case has tucked. Highlight timing matches `ModelResponse`.
 * Everything is in `em`, so it scales with the scene.
 */
export default function OpeningResponse({
  text,
  recommendationSpan,
  wordsPerGroup,
  identifyLabel,
  panelLabel,
  iconSrc,
  iconLabel,
  elapsedMs,
  timing,
  collapse,
  hideIcon = false,
}: OpeningResponseProps) {
  const layout = useMemo(
    () => layoutResponse(text, recommendationSpan, wordsPerGroup),
    [text, recommendationSpan, wordsPerGroup],
  );
  const progress = getResponseProgress(elapsedMs, timing);
  const typed = typedCount(progress.elapsedMs, timing.revealStartMs, timing.revealEndMs, text.length);
  const thinking = typed === 0;
  const dots = ".".repeat((Math.floor(Math.max(0, progress.elapsedMs - timing.thinkStartMs) / 400) % 3) + 1);
  // Two full turns while thinking, then one more turn for each repeated query.
  const spin = markSpinDeg(progress.elapsedMs);

  // The panel's own height, so it can shrink on the clock instead of jumping.
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelH, setPanelH] = useState(0);
  useLayoutEffect(() => {
    const node = panelRef.current;
    if (!node) return;
    const measure = () => setPanelH(node.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);
  const gpt = openingRows.models[0];
  const decisions = gptDecisionsEnter(progress.elapsedMs);
  const firstDot = firstDotEnter(progress.elapsedMs);
  const sideDots = (side: 0 | 1, count: number) => {
    const lead = side === FIRST_DOT_CHOICE && count > 0;
    return (
      <>
        {lead && <RisingDot enter={firstDot} />}
        {decisionDots(count - (lead ? 1 : 0), decisions)}
      </>
    );
  };
  const c = clamp01(collapse);
  const settled = c <= 0 || panelH === 0;
  const panelFade = 1 - ramp(c, 0, 0.6);

  const renderPiece = (piece: Piece, key: number, highlight: boolean) => {
    const shownN = Math.max(0, Math.min(piece.text.length, typed - piece.start));
    const shown = piece.text.slice(0, shownN);
    const hidden = piece.text.slice(shownN);
    // `display: contents` keeps the untyped tail in the same line boxes as the typed text,
    // so a cursor in the middle of a word cannot push the rest onto the next line.
    const body = (
      <>
        {shown}
        {hidden ? (
          <span aria-hidden style={{ display: "contents", color: "transparent" }}>
            {hidden}
          </span>
        ) : null}
      </>
    );
    if (!highlight) return <span key={key}>{body}</span>;
    const from = piece.spanOffset ?? 0;
    const fill = clamp01((progress.highlight * layout.spanLength - from) / piece.text.length);
    const style: CSSProperties = {
      backgroundImage: `linear-gradient(${HIGHLIGHT}, ${HIGHLIGHT})`,
      backgroundRepeat: "no-repeat",
      backgroundPosition: "0 90%",
      backgroundSize: `${fill * 100}% 85%`,
    };
    return (
      <span key={key} className="rounded-sm [box-decoration-break:clone]" style={style}>
        {body}
      </span>
    );
  };

  return (
    <div className="relative w-full" data-response-panel>
      {/* Mark and dots. The panel's top edge runs through the middle of this row.
          The two columns match the option cards: choice 1 with the mark, choice 2 on the other side. */}
      <div
        role="img"
        aria-label={`${gpt.name} chose Choice 1 in ${gpt.choice1} of ${gpt.trials} queries`}
        className="relative z-10 grid w-full grid-cols-2 items-center"
        style={{ height: ROW, gap: COLUMN_GAP }}
      >
        <div className="flex min-w-0 items-center" style={{ paddingLeft: EDGE_PAD, gap: ICON_GAP }}>
          {/* Sized with calc, not `zoom`: the stage measures this box to place its own copy of the icon. */}
          <span
            data-anchor={hideIcon ? "icon-response" : undefined}
            className="inline-flex shrink-0 items-center justify-center"
            style={{
              width: "calc(36px * var(--z))",
              height: "calc(36px * var(--z))",
              visibility: hideIcon ? "hidden" : undefined,
            }}
          >
            <span className="inline-flex" style={{ zoom: "var(--z)", transform: `rotate(${spin}deg)` }}>
              <ProviderIcon src={iconSrc} alt={iconLabel} size={36} />
            </span>
          </span>
          <span className="flex items-center" style={{ gap: DOT_GAP }}>
            {sideDots(0, gpt.choice1)}
          </span>
        </div>
        <div className="flex min-w-0 items-center justify-end" style={{ paddingRight: EDGE_PAD, gap: DOT_GAP }}>
          <span className="flex items-center" style={{ gap: DOT_GAP }}>
            {sideDots(1, gpt.choice2)}
          </span>
        </div>
      </div>

      <div
        style={{
          marginTop: `calc(${HALF_ROW} * -1)`,
          height: settled ? "auto" : panelH * (1 - c),
          pointerEvents: "none",
        }}
      >
        <div
          ref={panelRef}
          role="group"
          aria-label={panelLabel}
          aria-hidden={panelFade === 0}
          className="w-full rounded-[0.9em] border bg-white px-[1em] pb-[0.9em] pt-[1.4em]"
          style={{
            borderColor: NEUTRAL.line,
            color: NEUTRAL.ink,
            opacity: panelFade,
            transform: c > 0 ? `scale(${1 - 0.4 * c})` : undefined,
            transformOrigin: "2em 0",
            visibility: panelFade === 0 ? "hidden" : undefined,
          }}
        >
          {/* Fixed-height label row: the label fades in place, never shifting text. */}
          <p
            aria-hidden={progress.identifyOpacity === 0}
            className="font-mono uppercase tracking-widest"
            style={{
              fontSize: "0.7em",
              height: "1.4em",
              lineHeight: "1.4em",
              color: NEUTRAL.inkMuted,
              opacity: progress.identifyOpacity,
            }}
          >
            {identifyLabel}
          </p>
          <p className="relative mt-[0.2em] leading-snug">
            {thinking && (
              <span className="absolute left-0 top-0" style={{ color: NEUTRAL.inkMuted }}>
                Thinking{dots}
              </span>
            )}
            <span aria-hidden={thinking} style={{ opacity: thinking ? 0 : 1 }}>
              {layout.before.map((piece, i) => renderPiece(piece, i, false))}
              <mark className="bg-transparent text-inherit">
                {layout.inSpan.map((piece, i) => renderPiece(piece, i, true))}
              </mark>
              {layout.after.map((piece, i) => renderPiece(piece, i, false))}
            </span>
          </p>
        </div>
      </div>
      {/* Keeps the row's full height once the panel is gone. */}
      <div aria-hidden style={{ height: `calc(${HALF_ROW} * ${c})` }} />
    </div>
  );
}
