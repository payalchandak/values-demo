import { FADE_MS, NEUTRAL, VALUES, VALUE_ORDER } from "../../design";
import type { Value } from "../../study/types";
import { CHARCOAL } from "./charcoal";
import { ramp } from "./timeline";
import { valueSteps } from "./valueSteps";
import { TRIGGERS } from "./valueTriggers";

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
 * Chapter 5's caption area. One cell per value; all cells share one grid area
 * so the area is as tall as the tallest and nothing below it moves while the
 * cells cross-fade. Each cell: name chip and definition, then (after the
 * labels land on the choices) the value's one-line caption.
 */
export default function ValueStrip({ t, introAt }: { t: number; introAt: number }) {
  const s = valueSteps(t);
  return (
    <div className="grid w-full" style={{ opacity: ramp(t, introAt, introAt + FADE_MS) }}>
      {VALUE_ORDER.map((v) => (
        <div
          key={v}
          className="col-start-1 row-start-1 flex flex-col items-center gap-[0.3em] text-center"
          style={{ opacity: s.name[v] }}
          aria-hidden={s.name[v] === 0}
        >
          <div className="flex flex-wrap items-center justify-center gap-x-[0.6em] gap-y-[0.2em]">
            <NameChip v={v} />
            <span style={{ color: NEUTRAL.inkMuted }}>{VALUES[v].definition}</span>
          </div>
          <p
            className="font-semibold"
            style={{ color: NEUTRAL.ink, opacity: s.caption[v], minHeight: "1.4em", textWrap: "balance" }}
          >
            {TRIGGERS[v].caption}
          </p>
        </div>
      ))}
    </div>
  );
}
