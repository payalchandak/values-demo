import { FADE_MS, NEUTRAL, VALUES, VALUE_ORDER } from "../../design";
import type { Value } from "../../study/types";
import { CHARCOAL } from "./charcoal";
import { ramp } from "./timeline";
import { valueSteps } from "./valueSteps";

/** The value's full name, in a charcoal chip. Never a letter. */
export function NameChip({ v }: { v: Value }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-[0.75em] py-[0.15em] font-semibold text-white"
      style={{ backgroundColor: CHARCOAL }}
    >
      {VALUES[v].name}
    </span>
  );
}

/**
 * The framework chapter's value area. One cell per value; all cells share one grid area
 * so the area is as tall as the tallest and nothing below it moves while the
 * cells trade places. Each cell is the name chip and its definition.
 */
export default function ValueStrip({ t, introAt }: { t: number; introAt: number }) {
  const s = valueSteps(t);
  return (
    <div className="grid w-full" style={{ opacity: ramp(t, introAt, introAt + FADE_MS) }}>
      {VALUE_ORDER.map((v) => (
        <div
          key={v}
          className="col-start-1 row-start-1 flex flex-wrap items-center justify-center gap-x-[0.6em] gap-y-[0.2em] text-center"
          style={{
            opacity: s.name[v],
            transform: s.nameShift[v] === 0 ? undefined : `translateY(${s.nameShift[v]}em)`,
          }}
          aria-hidden={s.name[v] === 0}
        >
          <NameChip v={v} />
          <span style={{ color: NEUTRAL.inkMuted }}>{VALUES[v].definition}</span>
        </div>
      ))}
    </div>
  );
}
