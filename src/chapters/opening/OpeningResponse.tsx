import { useMemo, type CSSProperties } from "react";
import ProviderIcon from "../../components/ProviderIcon";
import { getResponseProgress, type ModelResponseTiming } from "../../components/ModelResponse";
import { NEUTRAL } from "../../design";

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
  /** Leave a measured slot and let the stage draw the icon. */
  hideIcon?: boolean;
}

/**
 * The model's response panel for the opening: full width of the case column,
 * with the round provider icon attached to the panel's top-left edge. The icon
 * spins while the panel reads "thinking…", then the answer types out. Highlight
 * timing matches `ModelResponse`. Everything is in `em`, so it scales with the scene.
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
  // Two full turns, then the mark is back where it started as the answer types.
  const spin = ramp(progress.elapsedMs, timing.thinkStartMs, timing.revealStartMs) * 720;

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
    <div className="relative w-full pt-[1.15em]" data-response-panel>
      {/* Icon straddles the panel's top-left edge. The outer box only positions; zoom lives inside. */}
      <span className="absolute left-[0.9em] top-[1.15em] z-10 inline-flex -translate-y-1/2">
        <span
          data-anchor={hideIcon ? "icon-response" : undefined}
          className="inline-flex"
          style={{ zoom: "var(--z)", visibility: hideIcon ? "hidden" : undefined }}
        >
          <span className="inline-flex" style={{ transform: `rotate(${spin}deg)` }}>
            <ProviderIcon src={iconSrc} alt={iconLabel} size={36} />
          </span>
        </span>
      </span>

      <div
        role="group"
        aria-label={panelLabel}
        className="w-full rounded-[0.9em] border bg-white px-[1em] pb-[0.9em] pt-[1.4em]"
        style={{ borderColor: NEUTRAL.line, color: NEUTRAL.ink }}
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
              thinking{dots}
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
  );
}
