import type { Profile } from "../../study/types";
import openaiLogo from "../../assets/providers/openai.svg";

/*
 * PLACEHOLDER profiles for the ending chapters. These are invented numbers
 * (each sums to 1) chosen only to give distinct shapes; swap in the real
 * profiles from `src/study/data/profiles.json` when wiring up.
 */

const profile = (
  key: string,
  kind: Profile["kind"],
  displayName: string,
  family: Profile["family"],
  priorities: Profile["priorities"],
): Profile => ({
  key,
  kind,
  family,
  displayName,
  // Placeholder only: the real raw coefficients arrive with the real data.
  weights: { A: 0, B: 0, N: 0, J: 0 },
  priorities,
});

export const PLACEHOLDER_PROFILES: readonly Profile[] = [
  // Models. Display names carry no version numbers.
  profile("gpt", "model", "GPT", "openai", { A: 0.08, B: 0.62, N: 0.18, J: 0.12 }),
  profile("claude", "model", "Claude", "anthropic", { A: 0.2, B: 0.22, N: 0.52, J: 0.06 }),
  profile("gemini", "model", "Gemini", "google", { A: 0.31, B: 0.35, N: 0.22, J: 0.12 }),
  profile("qwen", "model", "Qwen", "other", { A: 0.15, B: 0.3, N: 0.2, J: 0.35 }),

  // Individual physicians.
  profile("physician-1", "physician", "Physician 1", undefined, { A: 0.3, B: 0.3, N: 0.25, J: 0.15 }),
  profile("physician-2", "physician", "Physician 2", undefined, { A: 0.22, B: 0.38, N: 0.28, J: 0.12 }),
  profile("physician-3", "physician", "Physician 3", undefined, { A: 0.36, B: 0.24, N: 0.22, J: 0.18 }),
  profile("physician-4", "physician", "Physician 4", undefined, { A: 0.18, B: 0.3, N: 0.38, J: 0.14 }),
  profile("physician-5", "physician", "Physician 5", undefined, { A: 0.28, B: 0.26, N: 0.2, J: 0.26 }),
  profile("physician-6", "physician", "Physician 6", undefined, { A: 0.25, B: 0.35, N: 0.25, J: 0.15 }),

  // The pooled physician profile exists in the data but must never be drawn
  // in the ending: the physician row is individuals only.
  profile("physicians-pooled", "pooled-physician", "All physicians", undefined, {
    A: 0.27,
    B: 0.31,
    N: 0.26,
    J: 0.16,
  }),
];

export function selectModels(profiles: readonly Profile[]): Profile[] {
  return profiles.filter((p) => p.kind === "model");
}

/**
 * Individual physicians only. The pooled profile is dropped here, and
 * `assertIndividualPhysicians` guards the render path as a second line of
 * defense, so a pooled profile can never reach the physician row.
 */
export function selectPhysicians(profiles: readonly Profile[]): Profile[] {
  return profiles.filter((p) => p.kind === "physician");
}

export function assertIndividualPhysicians(profiles: readonly Profile[]): void {
  const bad = profiles.find((p) => p.kind !== "physician");
  if (bad) {
    throw new Error(
      `Physician row received "${bad.key}" (kind "${bad.kind}"); it must use individual physicians only.`,
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  Provider icons                                                            */
/* -------------------------------------------------------------------------- */

const monogram = (letter: string, bg: string): string =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${bg}"/><text x="50" y="50" text-anchor="middle" dominant-baseline="central" font-family="ui-sans-serif,system-ui,sans-serif" font-size="46" font-weight="600" fill="#fff">${letter}</text></svg>`,
  )}`;

/**
 * Only OpenAI has a real asset in the repo. The rest are neutral monogram
 * PLACEHOLDERS: swap in the official marks from `src/assets/providers/`.
 */
export const PROVIDER_LOGOS: Record<NonNullable<Profile["family"]>, { src: string; alt: string }> = {
  openai: { src: openaiLogo, alt: "OpenAI" },
  anthropic: { src: monogram("A", "#8C6A55"), alt: "Anthropic" },
  google: { src: monogram("G", "#5B7BC0"), alt: "Google" },
  other: { src: monogram("Q", "#6B7280"), alt: "Qwen" },
};
