import type { Profile, Value } from "../../study/types";
import { VALUE_ORDER } from "../../design";
import profilesData from "../../study/data/profiles.json";

/*
 * All numbers come from `src/study/data/profiles.json`. Nothing is retyped
 * here (see `npm run check:profiles`).
 */
export const ALL_PROFILES: readonly Profile[] = profilesData as Profile[];

const VALUE_KEYS: readonly Value[] = ["A", "B", "N", "J"];

const byKey = (profiles: readonly Profile[], key: string): Profile => {
  const found = profiles.find((p) => p.key === key);
  if (!found) throw new Error(`Missing profile "${key}"`);
  return found;
};

/* -------------------------------------------------------------------------- */
/*  Models                                                                    */
/* -------------------------------------------------------------------------- */

/** Chapter 1: exactly these, in this order. */
export const INDIVIDUAL_MODEL_KEYS = ["gpt", "claude", "gemini"] as const;

/** Gallery row 1, in this order: the three above plus three more for a readable six. */
export const AUTOPLAY_MODEL_KEYS = ["gpt", "claude", "gemini", "deepseek", "qwen", "mistral"] as const;

/** Models whose responses were heavily affected by refusals. Never in autoplay. */
export const REFUSAL_AFFECTED_MODEL_KEYS = ["glm", "llama", "kimi"] as const;

export function selectModels(profiles: readonly Profile[]): Profile[] {
  return profiles.filter((p) => p.kind === "model");
}

/** All 12 models, in data order. For the integration pass to offer after autoplay. */
export const ALL_MODELS: readonly Profile[] = selectModels(ALL_PROFILES);

export const INDIVIDUAL_MODELS: readonly Profile[] = INDIVIDUAL_MODEL_KEYS.map((k) => byKey(ALL_MODELS, k));

export const AUTOPLAY_MODELS: readonly Profile[] = AUTOPLAY_MODEL_KEYS.map((k) => byKey(ALL_MODELS, k));

{
  const refused = AUTOPLAY_MODELS.find((m) =>
    (REFUSAL_AFFECTED_MODEL_KEYS as readonly string[]).includes(m.key),
  );
  if (refused) throw new Error(`Refusal-affected model "${refused.key}" is in the autoplay set.`);
}

/* -------------------------------------------------------------------------- */
/*  Physicians                                                                */
/* -------------------------------------------------------------------------- */

export function selectPhysicians(profiles: readonly Profile[]): Profile[] {
  return profiles.filter((p) => p.kind === "physician");
}

/** The physician row must hold individual physicians only, never the pooled profile. */
export function assertIndividualPhysicians(profiles: readonly Profile[]): void {
  const bad = profiles.find((p) => p.kind !== "physician");
  if (bad) {
    throw new Error(
      `Physician row received "${bad.key}" (kind "${bad.kind}"); it must use individual physicians only.`,
    );
  }
}

/** Jensen-Shannon divergence (natural log) between two priority vectors. */
export function jensenShannon(p: Record<Value, number>, q: Record<Value, number>): number {
  let sum = 0;
  for (const v of VALUE_KEYS) {
    const m = (p[v] + q[v]) / 2;
    if (p[v] > 0) sum += 0.5 * p[v] * Math.log(p[v] / m);
    if (q[v] > 0) sum += 0.5 * q[v] * Math.log(q[v] / m);
  }
  return sum;
}

/**
 * Deterministic farthest-point selection of `n` individual physicians.
 *
 * Seed: the physician farthest (Jensen-Shannon) from the pooled profile. Then
 * repeatedly add the physician whose nearest already-chosen physician is
 * farthest away. Ties go to the lowest key. The pooled profile is used only
 * to pick the seed and is never returned. Result is in selection order.
 */
export function selectSpreadPhysicians(profiles: readonly Profile[], n = 8): Profile[] {
  const pool = selectPhysicians(profiles).sort((a, b) => a.key.localeCompare(b.key));
  const pooled = profiles.find((p) => p.kind === "pooled-physician");
  if (!pooled) throw new Error("selectSpreadPhysicians needs the pooled-physician profile to seed the selection.");
  if (!Number.isInteger(n) || n < 1 || n > pool.length) {
    throw new RangeError(`n must be an integer from 1 to ${pool.length}; got ${n}.`);
  }

  // `>` keeps the first (lowest-key) candidate on ties because `pool` is key-sorted.
  const farthest = (score: (p: Profile) => number, candidates: readonly Profile[]): Profile => {
    let best = candidates[0];
    let bestScore = score(best);
    for (const c of candidates.slice(1)) {
      const s = score(c);
      if (s > bestScore) {
        best = c;
        bestScore = s;
      }
    }
    return best;
  };

  const chosen = [farthest((p) => jensenShannon(p.priorities, pooled.priorities), pool)];
  while (chosen.length < n) {
    const rest = pool.filter((p) => !chosen.includes(p));
    chosen.push(
      farthest((p) => Math.min(...chosen.map((c) => jensenShannon(p.priorities, c.priorities))), rest),
    );
  }
  assertIndividualPhysicians(chosen);
  return chosen;
}

/** All 25 individual physicians, for later. */
export const ALL_PHYSICIANS: readonly Profile[] = selectPhysicians(ALL_PROFILES);

/** The eight shown in the autoplay row. */
export const SPREAD_PHYSICIANS: readonly Profile[] = selectSpreadPhysicians(ALL_PROFILES, 8);

/* -------------------------------------------------------------------------- */
/*  Gallery order                                                             */
/* -------------------------------------------------------------------------- */

/** The value a profile weights most; the first in the fixed order wins a tie. */
export function dominantOf(p: Profile): Value {
  let best = VALUE_ORDER[0];
  for (const v of VALUE_ORDER) if (p.priorities[v] > p.priorities[best]) best = v;
  return best;
}

/**
 * Physician row order: by dominant value (Autonomy, Beneficence, Nonmaleficence,
 * Justice), then by that value's share, largest first. Individual physicians only.
 */
export function sortPhysiciansByDominance(profiles: readonly Profile[]): Profile[] {
  assertIndividualPhysicians(profiles);
  const rank = (p: Profile) => VALUE_ORDER.indexOf(dominantOf(p));
  return [...profiles].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      b.priorities[dominantOf(b)] - a.priorities[dominantOf(a)] ||
      a.key.localeCompare(b.key),
  );
}

/** The eight physicians of the gallery's second row, in display order. */
export const GALLERY_PHYSICIANS: readonly Profile[] = sortPhysiciansByDominance(SPREAD_PHYSICIANS);
