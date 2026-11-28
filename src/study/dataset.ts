import casesData from "./data/cases.json";
import profilesData from "./data/profiles.json";
import type { Profile, StudyCase, Tag } from "./types";

/**
 * The one place the real study JSON is typed. JSON imports widen literal types
 * (a `Tag` becomes `number`, a pair becomes an array), so each record is
 * validated and rebuilt as its contract type instead of cast. Malformed data
 * fails loudly here rather than rendering a wrong chart.
 */

type RawCase = (typeof casesData)[number];
type RawProfile = (typeof profilesData)[number];

function toTag(n: number, where: string): Tag {
  if (n === -1 || n === 0 || n === 1) return n;
  throw new Error(`${where}: tag ${n} is not -1, 0, or 1`);
}

function toStudyCase(raw: RawCase): StudyCase {
  const [choice1, choice2] = raw.choices;
  const [t1, t2] = raw.tags;
  if (choice1 === undefined || choice2 === undefined || t1 === undefined || t2 === undefined) {
    throw new Error(`case ${raw.id}: expected two choices and two tag sets`);
  }
  const tags = (t: typeof t1) => ({
    A: toTag(t.A, raw.id),
    B: toTag(t.B, raw.id),
    N: toTag(t.N, raw.id),
    J: toTag(t.J, raw.id),
  });
  return {
    id: raw.id,
    vignette: raw.vignette,
    choices: [choice1, choice2],
    tags: [tags(t1), tags(t2)],
    physicianVotesChoice1: raw.physicianVotesChoice1,
    modelChoice1Counts: raw.modelChoice1Counts,
  };
}

function toProfileKind(kind: string, key: string): Profile["kind"] {
  if (kind === "model" || kind === "physician" || kind === "pooled-physician") return kind;
  throw new Error(`profile ${key}: unknown kind "${kind}"`);
}

function toProfile(raw: RawProfile): Profile {
  return {
    key: raw.key,
    kind: toProfileKind(raw.kind, raw.key),
    displayName: raw.displayName,
    weights: raw.weights,
    priorities: raw.priorities,
  };
}

export const allCases: readonly StudyCase[] = casesData.map(toStudyCase);
export const allProfiles: readonly Profile[] = profilesData.map(toProfile);

export const DEFAULT_PROFILE_KEY = "gpt";

export function profileByKey(key: string): Profile {
  const profile = allProfiles.find((p) => p.key === key);
  if (!profile) throw new Error(`No profile with key "${key}"`);
  return profile;
}

/** "50 cases": the size of the full study, shown under the three example rows. */
export const TOTAL_CASES = allCases.length;
