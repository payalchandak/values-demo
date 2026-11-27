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
      const piece: Piece = { text: text.slice(a, b), group: g, spanOffset: inside ? a - spanStart : null };
      if (inside) layout.inSpan.push(piece);
      else if (a >= spanEnd) layout.after.push(piece);
      else layout.before.push(piece);
    }
  }
  return layout;
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
}

/**
 * The model's response panel for the opening: full width of the case column,
 * with the round provider icon attached to the panel's top-left edge. Reveal
 * and highlight timing is the same as `ModelResponse` (same progress helper);
 * only the layout differs. Everything is in `em`, so it scales with the scene.
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
}: OpeningResponseProps) {
  const layout = useMemo(
    () => layoutResponse(text, recommendationSpan, wordsPerGroup),
    [text, recommendationSpan, wordsPerGroup],
  );
  const progress = getResponseProgress(elapsedMs, timing);

  const groupOpacity = (group: number): number => {
    const span = Math.max(0, timing.revealEndMs - timing.revealStartMs - timing.groupFadeMs);
    const start = timing.revealStartMs + (layout.groupCount > 1 ? (group / (layout.groupCount - 1)) * span : 0);
    return ramp(progress.elapsedMs, start, start + timing.groupFadeMs);
  };

  const plain = (piece: Piece, key: number) => (
    <span key={key} style={{ opacity: groupOpacity(piece.group) }}>
      {piece.text}
    </span>
  );

  const highlighted = (piece: Piece, key: number) => {
    const from = piece.spanOffset ?? 0;
    const fill = clamp01((progress.highlight * layout.spanLength - from) / piece.text.length);
    const style: CSSProperties = {
      opacity: groupOpacity(piece.group),
      backgroundImage: `linear-gradient(${HIGHLIGHT}, ${HIGHLIGHT})`,
      backgroundRepeat: "no-repeat",
      backgroundPosition: "0 90%",
      backgroundSize: `${fill * 100}% 85%`,
    };
    return (
      <span key={key} className="rounded-sm [box-decoration-break:clone]" style={style}>
        {piece.text}
      </span>
    );
  };

  return (
    <div className="relative w-full pt-[1.15em]" data-response-panel>
      {/* Icon straddles the panel's top-left edge. The outer box only positions; zoom lives inside. */}
      <span
        className="absolute left-[0.9em] top-[1.15em] z-10 inline-flex -translate-y-1/2"
        style={{ opacity: ramp(progress.elapsedMs, timing.revealStartMs, timing.revealStartMs + 300) }}
      >
        <span className="inline-flex" style={{ zoom: "var(--z)" }}>
          <ProviderIcon src={iconSrc} alt={iconLabel} size={36} />
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
        <p className="mt-[0.2em] leading-snug">
          {layout.before.map(plain)}
          <mark className="bg-transparent text-inherit">{layout.inSpan.map(highlighted)}</mark>
          {layout.after.map(plain)}
        </p>
      </div>
    </div>
  );
}
