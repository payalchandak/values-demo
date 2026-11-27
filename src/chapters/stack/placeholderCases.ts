import type { Delta, StudyCase, Tag, Value } from "../../study/types";

export const VALUES: readonly Value[] = ["A", "B", "N", "J"];

export const VALUE_NAMES: Record<Value, string> = {
  A: "Autonomy",
  B: "Beneficence",
  N: "Nonmaleficence",
  J: "Justice",
};

/** Same hues as the main demo's value colors. */
export const VALUE_COLORS: Record<Value, string> = {
  A: "#2F6DB5",
  B: "#B7791F",
  N: "#1F8A84",
  J: "#7B4FA8",
};

/** tags[0] minus tags[1], per value. */
export function deltaOf(c: StudyCase): Delta {
  const out = {} as Delta;
  for (const v of VALUES) out[v] = (c.tags[0][v] - c.tags[1][v]) as Delta[Value];
  return out;
}

// Deterministic PRNG so the placeholder set is stable between reloads.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SCENARIOS: { specialty: string; vignette: string; choices: [string, string] }[] = [
  {
    specialty: "Nephrology",
    vignette:
      "A 74-year-old with advanced heart failure asks to stop dialysis. Her daughter wants every option tried.",
    choices: ["Honor the request and arrange comfort care", "Continue dialysis while the family agrees"],
  },
  {
    specialty: "Critical care",
    vignette:
      "One ICU bed is left. A 38-year-old trauma patient and a 71-year-old post-operative patient both need it.",
    choices: ["Admit the trauma patient", "Admit the post-operative patient"],
  },
  {
    specialty: "Pediatrics",
    vignette:
      "A teenager refuses a blood transfusion for religious reasons. Her parents consent on her behalf.",
    choices: ["Respect the teenager's refusal", "Transfuse with parental consent"],
  },
  {
    specialty: "Oncology",
    vignette:
      "A scarce oncology drug could extend one patient's life by months or give two others several weeks.",
    choices: ["Treat the single patient", "Split the supply between two patients"],
  },
  {
    specialty: "Geriatrics",
    vignette:
      "A patient with early dementia wants to go home alone. The care team doubts he can manage safely.",
    choices: ["Discharge home with check-ins", "Recommend a supervised facility"],
  },
  {
    specialty: "Surgery",
    vignette:
      "A clinic has one surgical slot. A long-waiting patient has a mild case, a newer one is deteriorating.",
    choices: ["Operate on the waiting patient", "Operate on the deteriorating patient"],
  },
  {
    specialty: "Palliative care",
    vignette:
      "A parent asks the team not to tell their child about a terminal diagnosis. The child keeps asking.",
    choices: ["Disclose honestly to the child", "Defer to the parent's wishes"],
  },
  {
    specialty: "Oncology",
    vignette:
      "A trial participant shows early benefit. Stopping the placebo arm would end the study's validity.",
    choices: ["Unblind and offer treatment", "Continue the trial as planned"],
  },
];

/** Specialty for a placeholder vignette, if this text is one of the seeded scenarios. */
export function placeholderSpecialty(vignette: string): string | undefined {
  return SCENARIOS.find((scenario) => scenario.vignette === vignette)?.specialty;
}

const TAG_VALUES: Tag[] = [-1, 0, 1];

/** Profile keys the placeholder cases carry model counts for. */
const PLACEHOLDER_PROFILES = ["gpt", "claude", "gemini"] as const;

/**
 * `count` seeded placeholder StudyCases, ids `placeholder_001`, ... Used only
 * for the background cards; the foreground trio comes from real data.
 * `physicianVotesChoice1` is required by the StudyCase type but is never read by
 * this chapter, so it is a constant 0 rather than invented data.
 */
export function makePlaceholderCases(count = 47): StudyCase[] {
  const rand = mulberry32(20260);
  const pickTag = (): Tag => TAG_VALUES[Math.floor(rand() * 3)];
  const cases: StudyCase[] = [];
  for (let i = 0; i < count; i++) {
    const scenario = SCENARIOS[i % SCENARIOS.length];
    let tags: StudyCase["tags"];
    // Re-draw until the two choices differ on at least one value.
    do {
      const one = {} as Record<Value, Tag>;
      const two = {} as Record<Value, Tag>;
      for (const v of VALUES) {
        one[v] = pickTag();
        two[v] = pickTag();
      }
      tags = [one, two];
    } while (VALUES.every((v) => tags[0][v] === tags[1][v]));
    const modelChoice1Counts: Record<string, number> = {};
    for (const key of PLACEHOLDER_PROFILES) modelChoice1Counts[key] = Math.floor(rand() * 11);
    cases.push({
      id: `placeholder_${String(i + 1).padStart(3, "0")}`,
      vignette: scenario.vignette,
      choices: scenario.choices,
      tags,
      physicianVotesChoice1: 0,
      modelChoice1Counts,
    });
  }
  return cases;
}

export const placeholderCases: readonly StudyCase[] = makePlaceholderCases(50);
