import { FADE_MS, VALUE_ORDER } from "../../design";
import type { Value } from "../../study/types";
import { at, ramp } from "./timeline";

/**
 * What the framework chapter shows about the values, as 0..1 weights that are
 * a pure function of the opening clock `t`. Before that chapter every weight
 * is 0, so the vignette stays plain.
 *
 *  - name[v]       the value's full name and definition (vignette still plain).
 *  - highlight[v]  its trigger sentence is highlighted; the rest dims.
 *  - dim           how far the rest of the vignette has receded.
 *  - chip1[v]      the value's label on Choice 1.
 *  - chip2[v]      the value's label on Choice 2.
 *
 * A value's name and highlight end where the next value begins (the last one,
 * at the "all" beat). The labels stay.
 */
export interface ValueSteps {
  name: Record<Value, number>;
  highlight: Record<Value, number>;
  dim: number;
  chip1: Record<Value, number>;
  chip2: Record<Value, number>;
}

const record = (f: (v: Value) => number): Record<Value, number> => ({
  A: f("A"),
  B: f("B"),
  N: f("N"),
  J: f("J"),
});

export function valueSteps(t: number): ValueSteps {
  const allStart = at("framework", "all");
  const nextStart = (v: Value): number => {
    const i = VALUE_ORDER.indexOf(v);
    return i === VALUE_ORDER.length - 1 ? allStart : at("framework", VALUE_ORDER[i + 1]);
  };
  const clear = (v: Value): number => 1 - ramp(t, nextStart(v), nextStart(v) + FADE_MS);
  const rampAt = (beat: string): number => ramp(t, at("framework", beat), at("framework", beat) + FADE_MS);

  const name = record((v) => rampAt(v) * clear(v));
  const highlight = record((v) => rampAt(`${v}Highlight`) * clear(v));
  const chip1 = record((v) => rampAt(`${v}Chip1`));
  const chip2 = record((v) => rampAt(`${v}Chip2`));
  const dim = Math.max(...VALUE_ORDER.map((v) => highlight[v]));
  return { name, highlight, dim, chip1, chip2 };
}
