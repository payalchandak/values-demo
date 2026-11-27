import { NEUTRAL, VALUES, VALUE_ORDER, valueInk, valueTint } from "../../design";
import type { Value } from "../../study/types";

interface PrinciplistFrameworkProps {
  /** Values to emphasize. Empty or omitted: all four are shown equally. */
  highlight?: Value[];
}

/**
 * LOCAL STUB of the shared PrinciplistFramework (see `framework.ts`).
 * Same content as the primitive (names, definitions, colors from src/design),
 * sized in em so the scene's fluid font size scales it, plus `highlight`.
 * Emphasis never relies on color alone: the highlighted card gets a full
 * border and a tint, the others recede.
 */
export default function PrinciplistFramework({ highlight }: PrinciplistFrameworkProps) {
  const active = highlight && highlight.length > 0 ? highlight : null;
  return (
    <ul className="grid grid-cols-1 gap-[0.7em] @md:grid-cols-2" style={{ color: NEUTRAL.ink }}>
      {VALUE_ORDER.map((id) => {
        const value = VALUES[id];
        const on = active?.includes(id) ?? false;
        return (
          <li
            key={id}
            style={{
              borderTopColor: on ? value.color : NEUTRAL.line,
              borderRightColor: on ? value.color : NEUTRAL.line,
              borderBottomColor: on ? value.color : NEUTRAL.line,
              borderLeftColor: value.color,
              backgroundColor: on ? valueTint(id, 9) : NEUTRAL.surface,
              opacity: active && !on ? 0.5 : 1,
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
              <h3 className="font-semibold leading-snug tracking-tight" style={{ color: valueInk(id), fontSize: "1.2em" }}>
                {value.name}
              </h3>
              <p className="mt-[0.15em] leading-snug">{value.definition}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
