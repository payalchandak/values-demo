import { FADE_MS, VALUE_ORDER } from "../../design";
import type { Value } from "../../study/types";
import { PILL_ENTER_MS, VALUE_ENTER_MS, at, highlightSweepMs, ramp } from "./timeline";

/**
 * What the framework chapter shows about the values, as 0..1 weights that are
 * a pure function of the opening clock `t`. Before that chapter every weight
 * is 0, so the vignette stays plain.
 *
 *  - name[v]       the value's full name and definition. One at a time.
 *  - nameShift[v]  vertical offset of that line, in em. Positive sits below
 *                  its rest position (arriving); negative sits above (leaving).
 *  - highlight[v]  its trigger sentence keeps a tint once the sweep starts.
 *  - active[v]     this sentence is the one being introduced now.
 *  - sweep[v]      how far the tint has traveled across that sentence, 0..1.
 *  - dim           how far the unmarked vignette has receded.
 *  - chip1[v]      linear 0..1 progress of the label under Choice 1.
 *  - chip2[v]      linear 0..1 progress of the label under Choice 2.
 *
 * A value's name ends where the next value begins (the last one, at the "all"
 * beat). Tints accumulate: a sentence keeps its highlight when the next sweep
 * starts, through the end of the chapter. The sweep runs for the sentence's
 * reading time and then holds at 1. The labels stay.
 */
export interface ValueSteps {
  name: Record<Value, number>;
  nameShift: Record<Value, number>;
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

  // The current line fades and lifts away, and the next line rises into the
  // space it left. The enter starts before the leave finishes, so the spot
  // never goes blank and the two lines barely share it.
  const easeOut = (x: number) => 1 - (1 - x) ** 3;
  const span = (start: number, from: number, to: number) =>
    easeOut(ramp(t, start + from, start + to));
  const nameEnter = record((v) => span(at("framework", v), VALUE_ENTER_MS * 0.28, VALUE_ENTER_MS));
  const nameLeave = record((v) => span(nextStart(v), 0, VALUE_ENTER_MS * 0.42));
  const name = record((v) => nameEnter[v] * (1 - nameLeave[v]));
  const nameShift = record((v) => (1 - nameEnter[v]) * 0.4 - nameLeave[v] * 0.28);
  // The tint stays. `active` is only the sentence being introduced, for the
  // focused layout's enlargement; it ends when the next value begins. That
  // handoff stays short so two sentences are never enlarged together.
  const highlight = record((v) => rampAt(`${v}Highlight`));
  const active = record((v) => highlight[v] * clear(v));
  const sweep = record((v) => {
    const start = at("framework", `${v}Highlight`);
    return ramp(t, start, start + highlightSweepMs(v));
  });
  const pillAt = (beat: string) => ramp(t, at("framework", beat), at("framework", beat) + PILL_ENTER_MS);
  const chip1 = record((v) => pillAt(`${v}Chip1`));
  const chip2 = record((v) => pillAt(`${v}Chip2`));
  const dim = Math.max(...VALUE_ORDER.map((v) => highlight[v]));
  return { name, nameShift, highlight, active, sweep, dim, chip1, chip2 };
}
