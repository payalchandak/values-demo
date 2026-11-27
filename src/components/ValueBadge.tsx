import type { CSSProperties } from "react";
import type { ValueAnnotation, ValueDefinition } from "../data/demoData";

interface ValueBadgeProps {
  /** Value identity: label and color come from here (see `valueDefinitions`). */
  value: ValueDefinition;
  /**
   * How the thing being annotated relates to this value.
   * Omitted means "no annotation shown" (identity only). It is NOT treated as
   * neutral; pass `0` explicitly for a neutral annotation.
   */
  annotation?: ValueAnnotation;
  /** Smaller badge that hides the numeric code but keeps name + direction symbol. */
  compact?: boolean;
}

interface AnnotationPresentation {
  symbol: string;
  code: string;
  description: string;
}

const PRESENTATION: Record<ValueAnnotation, AnnotationPresentation> = {
  1: { symbol: "↑", code: "+1", description: "promotes (+1)" },
  [-1]: { symbol: "↓", code: "\u22121", description: "undermines (\u22121)" },
  0: { symbol: "\u2013", code: "0", description: "neutral (0)" },
};

/** Darkened variant of the value color so text stays readable on light tints. */
const textColor = (color: string): string =>
  `color-mix(in srgb, ${color} 72%, #000)`;

const tint = (color: string, percent: number): string =>
  `color-mix(in srgb, ${color} ${percent}%, transparent)`;

/**
 * Every state uses the same 1.5px border and fixed height, so switching
 * annotation never changes the badge's height or shifts layout vertically.
 * - identity only: white fill, light value-colored border
 * - +1: tinted fill, solid value-colored border
 * - -1: white fill, solid value-colored (outlined) border
 * - 0:  no fill, faint border, gray text
 */
function toneStyle(color: string, annotation: ValueAnnotation | undefined): CSSProperties {
  switch (annotation) {
    case 1:
      return {
        backgroundColor: tint(color, 16),
        borderColor: color,
        color: textColor(color),
      };
    case -1:
      return {
        backgroundColor: "#ffffff",
        borderColor: color,
        color: textColor(color),
      };
    case 0:
      return {
        backgroundColor: "transparent",
        borderColor: tint(color, 30),
        color: "#4b5563", // gray-600
      };
    case undefined:
      return {
        backgroundColor: "#ffffff",
        borderColor: tint(color, 45),
        color: textColor(color),
      };
  }
}

/**
 * Noninteractive label for a clinical value, optionally with its annotation.
 *
 * Example renderings: `Autonomy`, `Autonomy ↑ +1`, `Autonomy ↓ −1`, `Autonomy – 0`.
 */
export default function ValueBadge({ value, annotation, compact = false }: ValueBadgeProps) {
  const presentation = annotation === undefined ? undefined : PRESENTATION[annotation];

  const ariaLabel =
    presentation === undefined
      ? value.label
      : `${value.label}: ${presentation.description}`;

  const size = compact ? "h-6 gap-1 px-2 text-[11px]" : "h-7 gap-1.5 px-2.5 text-xs";

  return (
    <span
      role="img"
      aria-label={ariaLabel}
      style={toneStyle(value.color, annotation)}
      className={`inline-flex w-fit shrink-0 select-none items-center whitespace-nowrap rounded-full border-[1.5px] align-middle font-medium leading-none ${size}`}
    >
      <span
        aria-hidden="true"
        className="inline-block size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: value.color }}
      />
      <span aria-hidden="true">{value.label}</span>
      {presentation !== undefined && (
        <>
          <span aria-hidden="true" className="min-w-[0.75em] shrink-0 text-center font-semibold">
            {presentation.symbol}
          </span>
          {!compact && (
            <span aria-hidden="true" className="shrink-0 font-mono font-semibold tabular-nums">
              {presentation.code}
            </span>
          )}
        </>
      )}
    </span>
  );
}
