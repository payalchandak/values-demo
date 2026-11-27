import type { CSSProperties, ReactNode } from "react";
import { NEUTRAL } from "../../design";
import { CHARCOAL_TINT } from "./charcoal";
import { valueSteps, type ValueSteps } from "./valueSteps";
import { VIGNETTE_SEGMENTS, type VignetteSegment } from "./valueTriggers";

/** Strength of the fade when everything but the active sentence recedes (0 = none). */
const DIM_OF_REST = 0.72;
/** Focused layout: how much larger the active sentence is than a resting one. */
const FOCUS_GROW = 0.25;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * A trigger sentence stays in the flow at all times. On its value's turn the
 * rest of the vignette dims, and a charcoal tint travels across the sentence
 * word by word. The tint is never an underline, and it never covers the
 * sentence in one step.
 */
function TriggerText({
  text,
  presence,
  sweep,
  dim,
}: {
  text: string;
  presence: number;
  sweep: number;
  dim: number;
}) {
  const words = text.match(/\S+\s*/g) ?? [text];
  const n = words.length;
  const dimmed = 1 - DIM_OF_REST * dim;
  const tint = `color-mix(in srgb, ${CHARCOAL_TINT} ${presence * 100}%, transparent)`;
  return (
    <span
      style={{
        boxDecorationBreak: "clone",
        WebkitBoxDecorationBreak: "clone",
        borderRadius: "0.2em",
        padding: "0.05em 0.1em",
        margin: "0 -0.1em",
      }}
    >
      {words.map((word, i) => {
        const fill = clamp01(sweep * n - i);
        // Unreached words stay with the dimmed vignette. Each word brightens
        // as the tint arrives, so the sentence does not pop on all at once.
        const opacity = presence > 0 ? dimmed + (1 - dimmed) * fill : dimmed;
        const style: CSSProperties = {
          opacity,
          backgroundImage: `linear-gradient(${tint}, ${tint})`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "0 0",
          backgroundSize: `${fill * 100}% 100%`,
          boxDecorationBreak: "clone",
          WebkitBoxDecorationBreak: "clone",
        };
        return (
          <span key={i} style={style}>
            {word}
          </span>
        );
      })}
    </span>
  );
}

function Segment({ seg, s }: { seg: VignetteSegment; s: ValueSteps }) {
  if (seg.value === null) return <span style={{ opacity: 1 - DIM_OF_REST * s.dim }}>{seg.text}</span>;
  const v = seg.value;
  return <TriggerText text={seg.text} presence={s.highlight[v]} sweep={s.sweep[v]} dim={s.dim} />;
}

/**
 * The full case vignette, verbatim. It arrives plain with the framework
 * chapter, then one trigger sentence at a time takes a charcoal tint that
 * travels across the words (never an underline, never the whole sentence at
 * once) while the rest recedes, and returns to plain between values.
 *
 * `focused` is the narrow-screen layout: only the trigger sentences are shown
 * (the rest of the vignette collapses to an ellipsis), and the sentence being
 * highlighted is enlarged.
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
      {"... "}
    </span>
  );
  const parts: ReactNode[] = [];
  const lastTrigger = VIGNETTE_SEGMENTS.reduce((last, x, i) => (x.value ? i : last), -1);
  VIGNETTE_SEGMENTS.forEach((seg, i) => {
    if (seg.value === null) return;
    const v = seg.value;
    const h = s.highlight[v];
    const gapBefore = i > 0;
    const gapAfter = i === lastTrigger && i < VIGNETTE_SEGMENTS.length - 1;
    parts.push(
      <p
        key={v}
        data-vignette-text
        data-value={v}
        className="leading-[1.45]"
        style={{ fontSize: `${1 + FOCUS_GROW * h}em` }}
      >
        {gapBefore && mark}
        <TriggerText text={seg.text} presence={h} sweep={s.sweep[v]} dim={s.dim} />
        {gapAfter && (
          <span aria-hidden="true" style={{ color: NEUTRAL.inkFaint, opacity: 1 - DIM_OF_REST * s.dim }}>
            {" ..."}
          </span>
        )}
      </p>,
    );
  });
  return <div className="flex flex-col gap-[0.6em]">{parts}</div>;
}
