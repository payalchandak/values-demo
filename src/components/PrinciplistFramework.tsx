import { useId } from "react";
import { NEUTRAL, VALUES, VALUE_ORDER, valueInk } from "../design";

interface PrinciplistFrameworkProps {
  /** Scene heading. */
  heading?: string;
  /** Optional one-sentence explanation shown under the heading. */
  description?: string;
  className?: string;
}

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
 */
export default function PrinciplistFramework({
  heading = "Four principles of medical ethics",
  description,
  className = "",
}: PrinciplistFrameworkProps) {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      style={{ color: NEUTRAL.ink }}
      className={className}
    >
      <h2
        id={headingId}
        className="text-balance text-2xl font-semibold leading-tight tracking-tight sm:text-3xl md:text-4xl"
      >
        {heading}
      </h2>
      {description !== undefined && description !== "" && (
        <p
          className="mt-3 max-w-2xl text-pretty text-base leading-relaxed md:text-lg"
          style={{ color: NEUTRAL.inkMuted }}
        >
          {description}
        </p>
      )}

      <ul className="mt-6 grid grid-cols-1 gap-3 md:mt-8 md:grid-cols-2 md:gap-4">
        {VALUE_ORDER.map((id) => {
          const value = VALUES[id];
          return (
            <li
              key={id}
              // Same 1px border plus a 4px color rule on the left for all four.
              style={{ borderLeftColor: value.color }}
              className="flex items-start gap-4 rounded-xl border border-l-4 border-line bg-white p-4 md:p-6"
            >
              <span
                aria-hidden="true"
                style={{ backgroundColor: value.color }}
                className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg text-base font-semibold text-white"
              >
                {value.letter}
              </span>
              <div>
                <h3
                  className="text-xl font-semibold leading-snug tracking-tight md:text-2xl"
                  style={{ color: valueInk(id) }}
                >
                  {value.name}
                </h3>
                <p
                  className="mt-1.5 text-base leading-relaxed md:text-lg"
                  style={{ color: NEUTRAL.ink }}
                >
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
