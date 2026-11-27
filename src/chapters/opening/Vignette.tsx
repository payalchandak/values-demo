import type { CSSProperties, ReactNode } from "react";
import { NEUTRAL, VALUES, valueTint } from "../../design";
import type { Value } from "../../study/types";
import { valueSteps, type ValueSteps } from "./valueSteps";
import { VIGNETTE_SEGMENTS, type VignetteSegment } from "./valueTriggers";

/** Strength of the fade when the rest of the vignette recedes (0 = none). */
const DIM_OF_REST = 0.72;
const DIM_OF_OTHER_TRIGGERS = 0.6;
/** Focused layout: how much larger the active sentence is than a resting one. */
const FOCUS_GROW = 0.25;
const FOCUS_SHRINK = 0;

/** Underline color: neutral when drawn in chapter 4, the value's color while highlighted. */
function underlineColor(v: Value, s: ValueSteps): string {
  const h = s.highlight[v];
  const base = h > 0 ? `color-mix(in srgb, ${VALUES[v].color} ${h * 100}%, ${NEUTRAL.inkMuted})` : NEUTRAL.inkMuted;
  const drawn = Math.max(s.underline[v], h);
  return `color-mix(in srgb, ${base} ${drawn * 100}%, transparent)`;
}

function triggerStyle(v: Value, s: ValueSteps): CSSProperties {
  const h = s.highlight[v];
  return {
    opacity: 1 - DIM_OF_OTHER_TRIGGERS * s.dim * (1 - h),
    backgroundColor: valueTint(v, 17 * h),
    textDecorationLine: "underline",
    textDecorationColor: underlineColor(v, s),
    textDecorationThickness: "0.13em",
    textUnderlineOffset: "0.2em",
    textDecorationSkipInk: "none",
    boxDecorationBreak: "clone",
    WebkitBoxDecorationBreak: "clone",
    borderRadius: "0.2em",
    padding: "0.05em 0.1em",
    margin: "0 -0.1em",
  };
}

function Segment({ seg, s }: { seg: VignetteSegment; s: ValueSteps }) {
  if (seg.value === null) return <span style={{ opacity: 1 - DIM_OF_REST * s.dim }}>{seg.text}</span>;
  return <span style={triggerStyle(seg.value, s)}>{seg.text}</span>;
}

/**
 * The full case vignette, verbatim. Chapter 4 underlines the four trigger
 * sentences in a neutral tone; chapter 5 highlights them in their value
 * colors one at a time while the rest recedes.
 *
 * `focused` is the narrow-screen layout: only the trigger sentences are shown
 * (the rest of the vignette collapses to an ellipsis), and the sentence being
 * introduced is enlarged while the others shrink back.
 */
export default function Vignette({ t, focused }: { t: number; focused: boolean }) {
  const s = valueSteps(t);

  return (
    <div
      role="group"
      aria-label="Case vignette"
      className="w-full rounded-[0.9em] border bg-white p-[0.9em] shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_28px_-14px_rgba(16,24,40,0.12)]"
      style={{ borderColor: NEUTRAL.line, color: NEUTRAL.ink }}
    >
      {focused ? <FocusedText s={s} /> : <FullText s={s} />}
    </div>
  );
}

function FullText({ s }: { s: ValueSteps }) {
  return (
    <p data-vignette-text className="leading-[1.5]" style={{ textWrap: "pretty" }}>
      {VIGNETTE_SEGMENTS.map((seg, i) => (
        <Segment key={i} seg={seg} s={s} />
      ))}
    </p>
  );
}

function FocusedText({ s }: { s: ValueSteps }) {
  // Collapsed runs of the vignette are marked with an inline ellipsis, so they cost no extra lines.
  const mark = (
    <span aria-hidden="true" style={{ color: NEUTRAL.inkFaint, opacity: 1 - DIM_OF_REST * s.dim }}>
      {"\u2026 "}
    </span>
  );
  const parts: ReactNode[] = [];
  const lastTrigger = VIGNETTE_SEGMENTS.reduce((last, x, i) => (x.value ? i : last), -1);
  VIGNETTE_SEGMENTS.forEach((seg, i) => {
    if (seg.value === null) return;
    const v = seg.value;
    const size = 1 + FOCUS_GROW * s.active[v] - FOCUS_SHRINK * s.dim * (1 - s.highlight[v]);
    const gapBefore = i > 0;
    const gapAfter = i === lastTrigger && i < VIGNETTE_SEGMENTS.length - 1;
    parts.push(
      <p key={v} data-vignette-text data-value={v} className="leading-[1.45]" style={{ fontSize: `${size}em` }}>
        {gapBefore && mark}
        <span style={triggerStyle(v, s)}>{seg.text}</span>
        {gapAfter && <span aria-hidden="true" style={{ color: NEUTRAL.inkFaint, opacity: 1 - DIM_OF_REST * s.dim }}>{" \u2026"}</span>}
      </p>,
    );
  });
  return <div className="flex flex-col gap-[0.6em]">{parts}</div>;
}
