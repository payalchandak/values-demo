import type { Value } from "../study/types";
import { VALUE_COLORS } from "./tokens";

/**
 * Canonical value order. Every chart axis, legend, and list uses this order;
 * nothing is ever sorted by data.
 */
export const VALUE_ORDER: readonly [Value, Value, Value, Value] = ["A", "B", "N", "J"];

export interface ValueMeta {
  /** One-letter code used in data and compact UI. */
  letter: Value;
  /** Full name of the principle. */
  name: string;
  /** Definition sentence shown in the framework scene. */
  definition: string;
  color: string;
}

export const VALUES: Readonly<Record<Value, ValueMeta>> = {
  A: {
    letter: "A",
    name: "Autonomy",
    definition: "Respect the patient\u2019s wishes.",
    color: VALUE_COLORS.A,
  },
  B: {
    letter: "B",
    name: "Beneficence",
    definition: "Act in the patient\u2019s best interest.",
    color: VALUE_COLORS.B,
  },
  N: {
    letter: "N",
    name: "Nonmaleficence",
    definition: "Avoid foreseeable harm.",
    color: VALUE_COLORS.N,
  },
  J: {
    letter: "J",
    name: "Justice",
    definition: "Balance individual and public good fairly.",
    color: VALUE_COLORS.J,
  },
};
