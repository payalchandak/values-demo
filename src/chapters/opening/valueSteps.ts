import { FADE_MS, VALUE_ORDER } from "../../design";
import type { Value } from "../../study/types";
import { at, highlightSweepMs, ramp } from "./timeline";

/**
 * What the framework chapter shows about the values, as 0..1 weights that are
 * a pure function of the opening clock `t`. Before that chapter every weight
 * is 0, so the vignette stays plain.
 *
 *  - name[v]       the value's full name and definition. One at a time.
 *  - highlight[v]  its trigger sentence keeps a tint once the sweep starts.
 *  - active[v]     this sentence is the one being introduced now.
 *  - sweep[v]      how far the tint has traveled across that sentence, 0..1.
 *  - dim           how far the unmarked vignette has receded.
 *  - chip1[v]      the value's label under Choice 1.
 *  - chip2[v]      the value's label under Choice 2.
 *
 * A value's name ends where the next value begins (the last one, at the "all"
 * beat). Tints accumulate: a sentence keeps its highlight when the next sweep
 * starts, through the end of the chapter. The sweep runs for the sentence's
 * reading time and then holds at 1. The labels stay.
 */
export interface ValueSteps {
  name: Record<Value, number>;
  highlight: Record<Value, number>;
  active: Record<Value, number>;
  sweep: Record<Value, number>;
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
  // The tint stays. `active` is only the sentence being introduced, for the
  // focused layout's enlargement; it ends when the next value begins.
  const highlight = record((v) => rampAt(`${v}Highlight`));
  const active = record((v) => highlight[v] * clear(v));
  const sweep = record((v) => {
    const start = at("framework", `${v}Highlight`);
    return ramp(t, start, start + highlightSweepMs(v));
  });
  const chip1 = record((v) => rampAt(`${v}Chip1`));
  const chip2 = record((v) => rampAt(`${v}Chip2`));
  const dim = Math.max(...VALUE_ORDER.map((v) => highlight[v]));
  return { name, highlight, active, sweep, dim, chip1, chip2 };
}
