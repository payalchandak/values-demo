import { useMemo, type CSSProperties } from "react";
import type { ModelResponseConfig } from "../data/demoData";
import { FADE_MS } from "../design/motion";
import ProviderIcon from "./ProviderIcon";

/** Clamp to 0..1. */
const clamp01 = (n: number): number => Math.min(Math.max(n, 0), 1);

/** 0 before `start`, 1 after `end`, linear in between. Pure: no timers. */
const ramp = (t: number, start: number, end: number): number =>
  end <= start ? (t >= end ? 1 : 0) : clamp01((t - start) / (end - start));

/** Short fade used for the small labels, in ms. */
const LABEL_FADE_MS = FADE_MS;

/**
 * Window boundaries of the response chapter, in ms from the chapter's start.
 * Built from the chapter's beats (see `demoChapters.tsx`), not stored in data.
 */
export interface ModelResponseTiming {
  /** Response phrase groups fade in across [revealStartMs, revealEndMs]. */
  revealStartMs: number;
  revealEndMs: number;
  /** Fade-in length of a single phrase group. */
  groupFadeMs: number;
  /** Recommendation span highlight sweeps across this window. */
  highlightStartMs: number;
  highlightEndMs: number;
  /** Matching recommendation card is outlined across this window. */
  outlineStartMs: number;
  outlineEndMs: number;
}

export interface ResponseProgress {
  /** Elapsed time used. */
  elapsedMs: number;
  /** 0..1 sweep of the recommendation-span highlight. */
  highlight: number;
  /** 0..1 progress of the matching card's outline. */
  outline: number;
  /** True once the matching card should read as selected. */
  extracted: boolean;
  /** Opacity of the "Identify the recommendation" label (only while extracting). */
  identifyOpacity: number;
  /** Opacity of the "Extracted choice" label. */
  extractedOpacity: number;
}

/**
 * Everything the response chapter shows is a pure function of the chapter's elapsed
 * time. No timers live here, so whatever supplies `elapsedMs` (the playback
 * clock) fully controls pausing, scrubbing, and replay.
 */
export function getResponseProgress(
  e: number,
  timing: ModelResponseTiming,
): ResponseProgress {
  const outline = ramp(e, timing.outlineStartMs, timing.outlineEndMs);
  return {
    elapsedMs: e,
    highlight: ramp(e, timing.highlightStartMs, timing.highlightEndMs),
    outline,
    extracted: e >= timing.outlineStartMs,
    identifyOpacity:
      ramp(e, timing.highlightStartMs, timing.highlightStartMs + LABEL_FADE_MS) *
      (1 - ramp(e, timing.outlineStartMs, timing.outlineStartMs + LABEL_FADE_MS)),
    extractedOpacity: ramp(e, timing.outlineStartMs, timing.outlineStartMs + LABEL_FADE_MS),
  };
}

/** A contiguous run of response text belonging to one reveal group. */
interface Piece {
  text: string;
  group: number;
  /** Offset of this piece within the recommendation span, or null if outside it. */
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
  if (spanStart === -1) {
    console.error("ModelResponse: recommendationSpan is not a substring of the response text.");
  }
  const spanEnd = spanStart === -1 ? -1 : spanStart + span.length;

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
      const inside = spanStart !== -1 && a >= spanStart && b <= spanEnd;
      const piece: Piece = {
        text: text.slice(a, b),
        group: g,
        spanOffset: inside ? a - spanStart : null,
      };
      if (inside) layout.inSpan.push(piece);
      else if (spanStart !== -1 && a >= spanEnd) layout.after.push(piece);
      else layout.before.push(piece);
    }
  }
  return layout;
}

/** Neutral highlight color (deliberately not green / not a success state). */
const HIGHLIGHT = "rgba(27, 36, 51, 0.14)";

interface ModelResponseProps {
  config: ModelResponseConfig;
  /** URL of the provider logo. */
  iconSrc: string;
  /** Chapter-local playback time in ms. */
  elapsedMs: number;
  timing: ModelResponseTiming;
  /** The caller draws the icon itself (e.g. a persistent stage icon); leave only its slot. */
  hideIcon?: boolean;
}

/**
 * Provider icon beside a compact response panel. The response fades in by
 * phrase group, then the recommendation span is highlighted. Purely
 * presentational: all motion is derived from `elapsedMs`.
 */
export default function ModelResponse({ config, iconSrc, elapsedMs, timing, hideIcon = false }: ModelResponseProps) {
  const layout = useMemo(
    () => layoutResponse(config.text, config.recommendationSpan, config.revealWordsPerGroup),
    [config.text, config.recommendationSpan, config.revealWordsPerGroup],
  );
  const progress = getResponseProgress(elapsedMs, timing);

  // Groups are spread so the last one finishes fading exactly at `revealEndMs`.
  const groupOpacity = (group: number): number => {
    const span = Math.max(0, timing.revealEndMs - timing.revealStartMs - timing.groupFadeMs);
    const start =
      timing.revealStartMs + (layout.groupCount > 1 ? (group / (layout.groupCount - 1)) * span : 0);
    return ramp(progress.elapsedMs, start, start + timing.groupFadeMs);
  };

  const plain = (piece: Piece, key: number) => (
    <span key={key} style={{ opacity: groupOpacity(piece.group) }}>
      {piece.text}
    </span>
  );

  // Highlight sweeps left to right across the whole span, even across line wraps.
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
    <div className="flex items-start gap-3 md:gap-4">
      <span
        data-anchor={hideIcon ? "icon-response" : undefined}
        className="mt-1 inline-flex shrink-0"
        style={{
          opacity: ramp(progress.elapsedMs, timing.revealStartMs, timing.revealStartMs + FADE_MS),
          visibility: hideIcon ? "hidden" : undefined,
        }}
      >
        <ProviderIcon src={iconSrc} alt={config.iconLabel} size={40} />
      </span>

      <div
        role="group"
        aria-label={config.panelLabel}
        className="min-w-0 flex-1 rounded-xl border border-line bg-white px-4 pb-4 pt-3 md:px-5"
      >
        {/* Fixed-height label row: the label fades in place, never shifting text. */}
        <p
          aria-hidden={progress.identifyOpacity === 0}
          className="h-4 font-mono text-[11px] uppercase leading-4 tracking-widest text-gray-500"
          style={{ opacity: progress.identifyOpacity }}
        >
          {config.labels.identify}
        </p>
        <p className="mt-1.5 text-base leading-relaxed text-[#1B2433]">
          {layout.before.map(plain)}
          <mark className="bg-transparent text-inherit">{layout.inSpan.map(highlighted)}</mark>
          {layout.after.map(plain)}
        </p>
      </div>
    </div>
  );
}
