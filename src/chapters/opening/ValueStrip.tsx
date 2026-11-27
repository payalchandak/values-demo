import { NEUTRAL, VALUES, VALUE_ORDER, valueInk } from "../../design";
import type { Value } from "../../study/types";
import { ramp } from "./timeline";
import { valueSteps } from "./valueSteps";
import { TRIGGERS } from "./valueTriggers";

/** The value's name in its own color (solid chip, white text). */
export function NameChip({ v }: { v: Value }) {
  return (
    <span
      className="inline-flex items-center gap-[0.4em] rounded-full px-[0.75em] py-[0.15em] font-semibold text-white"
      style={{ backgroundColor: VALUES[v].color }}
    >
      <span aria-hidden="true" className="opacity-80">
        {v}
      </span>
      {VALUES[v].name}
    </span>
  );
}

/**
 * Chapter 5's caption area. One cell per state (A, B, N, J, then all four);
 * all cells share one grid area so the area is as tall as the tallest and
 * nothing below it moves while the states cross-fade.
 */
export default function ValueStrip({ t, introAt }: { t: number; introAt: number }) {
  const s = valueSteps(t);
  const cell = "col-start-1 row-start-1 flex flex-col items-center gap-[0.3em] text-center";
  return (
    <div className="grid w-full" style={{ opacity: ramp(t, introAt, introAt + 400) }}>
      {VALUE_ORDER.map((v) => (
        <div key={v} className={cell} style={{ opacity: s.active[v] }} aria-hidden={s.active[v] === 0}>
          <div className="flex flex-wrap items-center justify-center gap-x-[0.6em] gap-y-[0.2em]">
            <NameChip v={v} />
            <span style={{ color: NEUTRAL.inkMuted }}>{VALUES[v].definition}</span>
          </div>
          <p
            className="font-semibold"
            style={{ color: valueInk(v), opacity: s.caption[v], minHeight: "1.4em", textWrap: "balance" }}
          >
            {TRIGGERS[v].caption}
          </p>
        </div>
      ))}
      <div className={cell} style={{ opacity: s.all }} aria-hidden={s.all === 0}>
        <div className="flex flex-wrap items-center justify-center gap-[0.5em]">
          {VALUE_ORDER.map((v) => (
            <NameChip key={v} v={v} />
          ))}
        </div>
        <p style={{ minHeight: "1.4em" }} />
      </div>
    </div>
  );
}
