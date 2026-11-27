/**
 * Design tokens shared by every visual primitive.
 *
 * The four value colors are a fixed categorical assignment:
 *   A blue, B amber, N teal, J purple.
 * They identify a VALUE and nothing else. They must never be used for the two
 * recommendations (see `RECOMMENDATION_COLORS`), for good/bad, or for status.
 *
 * Amber and teal are slightly deeper than a "default" amber or teal so that
 * white text on a solid chip reaches WCAG AA (4.5:1). Contrast against #fff:
 * A 5.28, B 4.68, N 5.02, J 5.96.
 */

import type { Value } from "../study/types";

export const VALUE_COLORS: Readonly<Record<Value, string>> = {
  A: "#2F6DB5", // blue
  B: "#A26710", // amber
  N: "#187C76", // teal
  J: "#7B4FA8", // purple
};

/**
 * Colors for the two recommendations being compared. Deliberately outside the
 * blue / amber / teal / purple families so a recommendation can never be read
 * as a value.
 */
export const RECOMMENDATION_COLORS = {
  option1: "#C2415D", // rose
  option2: "#3F4756", // graphite
} as const;

export type RecommendationId = keyof typeof RECOMMENDATION_COLORS;

/** Neutral (slate) palette for structure: rings, axes, polygon fill, text. */
export const NEUTRAL = {
  /** Primary text. */
  ink: "#1B2433",
  /** Secondary text. */
  inkMuted: "#4B5563",
  /** Faint scale text. */
  inkFaint: "#64748B",
  /** Chart outer ring and axes. */
  axis: "#CBD5E1",
  /** Chart inner rings. */
  ring: "#E2E8F0",
  /** Neutral data-polygon fill (semi-transparent so rings show through). */
  polygonFill: "rgba(71, 85, 105, 0.16)",
  /** Neutral data-polygon outline. */
  polygonStroke: "#475569",
  /** Card / chip surface. */
  surface: "#FFFFFF",
  /** Hairline borders. */
  line: "#E5E7EB",
} as const;

/** Darkened value color for text on a light surface. */
export const valueInk = (value: Value): string =>
  `color-mix(in srgb, ${VALUE_COLORS[value]} 72%, #000)`;

/** Value color at `percent` opacity, for tints and faint borders. */
export const valueTint = (value: Value, percent: number): string =>
  `color-mix(in srgb, ${VALUE_COLORS[value]} ${percent}%, transparent)`;

/* Guard: a recommendation color must never collide with a value color. */
{
  const valueHexes = new Set(Object.values(VALUE_COLORS).map((c) => c.toLowerCase()));
  for (const [id, color] of Object.entries(RECOMMENDATION_COLORS)) {
    if (valueHexes.has(color.toLowerCase())) {
      throw new Error(`Recommendation color "${id}" reuses a value color (${color}).`);
    }
  }
}
