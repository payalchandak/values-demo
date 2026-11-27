import { useId } from "react";
import { NEUTRAL, VALUES, VALUE_ORDER, valueInk, valueTint } from "../design";
import type { Value } from "../study/types";

interface PrinciplistFrameworkProps {
  /**
   * Scene heading. Omit for the default; pass `null` when the parent already
   * shows a heading (the section is then labelled by the default text).
   */
  heading?: string | null;
  /** Optional one-sentence explanation shown under the heading. */
  description?: string;
  /**
   * Values to emphasize. The highlighted cards get a full-color border and a
   * tint, and the rest recede. Empty or omitted: all four read equally.
   */
  highlight?: Value[];
  className?: string;
}

const DEFAULT_HEADING = "Four principles of medical ethics";

/**
 * Static scene introducing the four principles of biomedical ethics as
 * equal-weight cards, always in A, B, N, J order:
 *
 * - Autonomy respects the patient's wishes.
 * - Beneficence acts in the patient's best interest.
 * - Nonmaleficence avoids foreseeable harm.
 * - Justice balances individual and public good fairly.
 *
 * Names, definitions, and colors come from `src/design`. Identity only (no
 * +1/-1 tags). No motion or timers: the parent owns scene timing.
 *
 * Sizing: everything is in `em`, so it scales with the font size of whatever
 * container it is placed in (16px by default). The column count follows the
 * container's width (one column when two cards of ~15em do not fit), not the
 * viewport.
 */
export default function PrinciplistFramework({
  heading = DEFAULT_HEADING,
  description,
  highlight,
  className = "",
}: PrinciplistFrameworkProps) {
  const headingId = useId();
  const active = highlight && highlight.length > 0 ? highlight : null;

  return (
    <section
      aria-labelledby={heading === null ? undefined : headingId}
      aria-label={heading === null ? DEFAULT_HEADING : undefined}
      style={{ color: NEUTRAL.ink }}
      className={className}
    >
      {heading !== null && (
        <h2
          id={headingId}
          className="text-balance font-semibold leading-tight tracking-tight"
          style={{ fontSize: "1.9em" }}
        >
          {heading}
        </h2>
      )}
      {description !== undefined && description !== "" && (
        <p
          className="max-w-[40em] text-pretty leading-relaxed"
          style={{ color: NEUTRAL.inkMuted, marginTop: "0.6em", fontSize: "1.05em" }}
        >
          {description}
        </p>
      )}

      <ul
        // Two columns whenever two cards fit side by side, otherwise one.
        style={{
          display: "grid",
          gap: "0.7em",
          marginTop: heading === null && !description ? 0 : "1.2em",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, max(15em, calc(50% - 0.35em))), 1fr))",
        }}
      >
        {VALUE_ORDER.map((id) => {
          const value = VALUES[id];
          const on = active?.includes(id) ?? false;
          return (
            <li
              key={id}
              // Same 1px border plus a 0.3em color rule on the left for all four.
              style={{
                borderTopColor: on ? value.color : NEUTRAL.line,
                borderRightColor: on ? value.color : NEUTRAL.line,
                borderBottomColor: on ? value.color : NEUTRAL.line,
                borderLeftColor: value.color,
                backgroundColor: on ? valueTint(id, 9) : NEUTRAL.surface,
                opacity: active && !on ? 0.55 : 1,
                transition: "opacity 200ms, background-color 200ms, border-color 200ms",
              }}
              className="flex items-start gap-[0.8em] rounded-[0.8em] border border-l-[0.3em] p-[0.9em]"
            >
              <span
                aria-hidden="true"
                style={{ backgroundColor: value.color }}
                className="flex size-[2em] shrink-0 items-center justify-center rounded-[0.5em] font-semibold text-white"
              >
                {value.letter}
              </span>
              <div className="min-w-0">
                <h3
                  className="font-semibold leading-snug tracking-tight"
                  style={{ color: valueInk(id), fontSize: "1.25em" }}
                >
                  {value.name}
                </h3>
                <p className="leading-snug" style={{ marginTop: "0.15em", color: NEUTRAL.ink }}>
                  {value.definition}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
