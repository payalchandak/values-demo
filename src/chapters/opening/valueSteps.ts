import { VALUE_ORDER } from "../../design";
import type { Value } from "../../study/types";
import { at, ramp, UNDERLINE_STAGGER_MS, CAPTION_DELAY_MS, CHIP_DELAY_MS } from "./timeline";
import { TEXT_ORDER } from "./valueTriggers";

/**
 * What chapters 4 and 5 show about the values, as 0..1 weights that are a pure
 * function of the opening clock `t`.
 *
 *  - underline[v]  chapter 4: the trigger sentence is underlined (neutral);
 *                  stays on afterwards.
 *  - active[v]     chapter 5: this value is the one being introduced.
 *  - all           chapter 5 end state: all four highlights, nothing dimmed.
 *  - dim           how far the rest of the vignette has receded.
 *  - chip[v]       the value's tag chips on the two choices.
 *  - caption[v]    the value's one-line caption.
 */
export interface ValueSteps {
  underline: Record<Value, number>;
  active: Record<Value, number>;
  all: number;
  dim: number;
  chip: Record<Value, number>;
  caption: Record<Value, number>;
  /** Highlight strength per value: its own turn, or the all-together end state. */
  highlight: Record<Value, number>;
}

const FADE_MS = 300;

const record = (f: (v: Value) => number): Record<Value, number> => ({
  A: f("A"),
  B: f("B"),
  N: f("N"),
  J: f("J"),
});

export function valueSteps(t: number): ValueSteps {
  const underlineStart = at("tradeoff", "underline");
  const allStart = at("framework", "all");
  const nextStart = (v: Value): number => {
    const i = VALUE_ORDER.indexOf(v);
    return i === VALUE_ORDER.length - 1 ? allStart : at("framework", VALUE_ORDER[i + 1]);
  };

  const underline = record((v) => {
    const s = underlineStart + TEXT_ORDER.indexOf(v) * UNDERLINE_STAGGER_MS;
    return ramp(t, s, s + 400);
  });
  const active = record((v) => {
    const s = at("framework", v);
    const e = nextStart(v);
    return ramp(t, s, s + FADE_MS) * (1 - ramp(t, e - 250, e));
  });
  const all = ramp(t, allStart, allStart + FADE_MS * 2);
  const dim = ramp(t, at("framework", VALUE_ORDER[0]), at("framework", VALUE_ORDER[0]) + FADE_MS) * (1 - all);
  const chip = record((v) => ramp(t, at("framework", v) + CHIP_DELAY_MS, at("framework", v) + CHIP_DELAY_MS + 400));
  const caption = record((v) => {
    const s = at("framework", v) + CAPTION_DELAY_MS;
    const e = nextStart(v);
    return ramp(t, s, s + 350) * (1 - ramp(t, e - 250, e));
  });
  const highlight = record((v) => Math.max(active[v], all));
  return { underline, active, all, dim, chip, caption, highlight };
}

/** The value being introduced at `t` (the strongest active weight), if any. */
export function activeValue(t: number): Value | null {
  const s = valueSteps(t);
  const best = VALUE_ORDER.reduce((a, b) => (s.active[b] > s.active[a] ? b : a));
  return s.active[best] > 0 ? best : null;
}
