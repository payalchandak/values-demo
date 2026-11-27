import { useId } from "react";
import type { ValueDefinition } from "../data/demoData";

/** Exactly four principles, in display order (reading order of the 2×2 grid). */
export type PrincipleQuad = readonly [
  ValueDefinition,
  ValueDefinition,
  ValueDefinition,
  ValueDefinition,
];

interface PrinciplistFrameworkProps {
  /** Scene heading. */
  heading: string;
  /** Optional one-sentence explanation shown under the heading. */
  description?: string;
  /** The four principles: name, definition, and categorical color all come from here. */
  values: PrincipleQuad;
  className?: string;
}

/** Darkened variant of the value color so text stays readable on a light card. */
const nameColor = (color: string): string => `color-mix(in srgb, ${color} 72%, #000)`;

/**
 * Static scene that introduces the four principles as equal-weight cards.
 * Pure content: no motion, timers, or interaction. The parent owns scene timing
 * and entrance. Identity only, so no +1/−1 annotations appear here.
 */
export default function PrinciplistFramework({
  heading,
  description,
  values,
  className = "",
}: PrinciplistFrameworkProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className={`text-[#1B2433] ${className}`}>
      <h2
        id={headingId}
        className="text-balance text-2xl font-semibold leading-tight tracking-tight sm:text-3xl md:text-4xl"
      >
        {heading}
      </h2>
      {description !== undefined && description !== "" && (
        <p className="mt-3 max-w-2xl text-pretty text-base leading-relaxed text-[#1B2433]/70 md:text-lg md:leading-relaxed">
          {description}
        </p>
      )}

      <ul className="mt-6 grid grid-cols-1 gap-3 md:mt-8 md:grid-cols-2 md:gap-4">
        {values.map((value) => (
          <li
            key={value.id}
            // Every card uses the same 1px border plus a 4px color rule on the
            // left, so the four cards are identical in weight and structure.
            style={{ borderLeftColor: value.color }}
            className="rounded-xl border border-l-4 border-line bg-white p-4 md:p-6"
          >
            <h3
              className="text-xl font-semibold leading-snug tracking-tight md:text-2xl"
              style={{ color: nameColor(value.color) }}
            >
              {value.label}
            </h3>
            <p className="mt-2 text-base leading-relaxed text-[#1B2433]/80 md:text-lg md:leading-relaxed">
              {value.shortDefinition}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
