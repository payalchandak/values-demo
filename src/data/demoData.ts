/**
 * Single source of truth for research-demo content.
 * Components read copy, colors, timings, and study data from here.
 */

/* -------------------------------------------------------------------------- */
/*  Values                                                                    */
/* -------------------------------------------------------------------------- */

export type ValueId = "autonomy" | "beneficence" | "nonmaleficence" | "justice";

export const VALUE_IDS: readonly ValueId[] = [
  "autonomy",
  "beneficence",
  "nonmaleficence",
  "justice",
] as const;

export interface ValueDefinition {
  id: ValueId;
  label: string;
  shortDefinition: string;
  /** Categorical color, tuned for a light background. */
  color: string;
}

/** One number per value. Used for both raw weights and normalized priorities. */
export type PerValue<T> = Record<ValueId, T>;

/** Raw (unnormalized) regression coefficients, one per value. May be negative. */
export type RawValueWeights = PerValue<number>;

/** Normalized priorities, one per value. Intended to be non-negative and sum to 1. */
export type NormalizedPriorities = PerValue<number>;

/* -------------------------------------------------------------------------- */
/*  Clinical cases                                                            */
/* -------------------------------------------------------------------------- */

/** How a recommendation option relates to a value: -1 undermines, 0 neutral, 1 promotes. */
export type ValueAnnotation = -1 | 0 | 1;

export interface RecommendationOption {
  /** Short recommendation title shown to the viewer. */
  title: string;
  /** One-line description of the recommendation. */
  description: string;
  /**
   * Annotation of this option against each of the four values.
   * `undefined` means annotations are still pending. Never encode "unknown"
   * as 0: 0 means neutral, which is a substantive annotation.
   */
  annotations?: PerValue<ValueAnnotation>;
}

export interface ClinicalCase {
  id: string;
  patientSummary: string;
  vignette: string;
  /** What the clinical team is weighing. */
  decisionContext: string;
  option1: RecommendationOption;
  option2: RecommendationOption;
}

/** Identifies one of the case's two recommendations (the `ClinicalCase` option keys). */
export type ClinicalOptionId = Extract<keyof ClinicalCase, "option1" | "option2">;

/** Model providers the demo can show an identity badge for. */
export type ProviderId = "openai";

/**
 * Timings of the response-reveal step. All values are milliseconds measured
 * from the start of the step on the playback clock (pause-aware).
 */
export interface ModelResponseTiming {
  /** Response phrase groups fade in across [revealStartMs, revealEndMs]. */
  revealStartMs: number;
  revealEndMs: number;
  /** Fade-in length of a single phrase group. */
  groupFadeMs: number;
  /** Recommendation span highlight sweeps across this window. */
  highlightStartMs: number;
  highlightEndMs: number;
  /** Matching recommendation card is outlined across this window. */
  outlineStartMs: number;
  outlineEndMs: number;
  /** Total duration of the step (final hold included). */
  durationMs: number;
}

/** A single scripted model response and the recommendation extracted from it. */
export interface ModelResponseConfig {
  providerId: ProviderId;
  /** Accessible name announced for the provider icon. */
  iconLabel: string;
  /** Accessible name of the response panel. */
  panelLabel: string;
  /** Full response prose. */
  text: string;
  /** Exact substring of `text` that states the recommendation. */
  recommendationSpan: string;
  /** Recommendation the span maps to (supplied data, not parsed at runtime). */
  extractedOptionId: ClinicalOptionId;
  /** Words per reveal phrase group (presentation only). */
  revealWordsPerGroup: number;
  labels: {
    /** Shown while the recommendation span is being identified. */
    identify: string;
    /** Shown on the outlined recommendation card. */
    extracted: string;
  };
  timing: ModelResponseTiming;
}

/** Static labels around the clinical-dilemma screen. */
export interface ClinicalDilemmaCopy {
  sectionLabel: string;
  headline: string;
  optionLabels: readonly [string, string];
}

/* -------------------------------------------------------------------------- */
/*  Regression                                                                */
/* -------------------------------------------------------------------------- */

export interface RegressionRow {
  caseId: string;
  /** Option 1 minus Option 2 annotation, per value. */
  valueDifferences: PerValue<number>;
  /** Number of queries in which Option 1 was chosen. */
  option1Count: number;
  /** Total number of queries for this case. */
  queryCount: number;
}

/* -------------------------------------------------------------------------- */
/*  Value profiles                                                            */
/* -------------------------------------------------------------------------- */

export type ProfileKind = "llm" | "physician";

export interface ValueProfile {
  id: string;
  displayName: string;
  kind: ProfileKind;
  /** Model provider (e.g. lab name); only for kind === "llm". */
  provider?: string;
  /** Normalized priorities derived from raw regression weights. */
  priorities: NormalizedPriorities;
  /** Raw regression weights, kept separate from `priorities`. */
  rawWeights?: RawValueWeights;
}

/* -------------------------------------------------------------------------- */
/*  Timing                                                                    */
/* -------------------------------------------------------------------------- */

export interface DemoTiming {
  /** Duration of the opening title frame, in ms. */
  openingFrameMs: number;
  /** Duration of the static clinical-dilemma step, in ms. */
  clinicalCaseMs: number;
}

/* -------------------------------------------------------------------------- */
/*  Content                                                                   */
/* -------------------------------------------------------------------------- */

export const openingFrame = {
  eyebrow: "NeurIPS 2026",
  title: "Do Language Models Share Your Doctor’s Priorities?",
  subtitle: "Measuring values from clinical decisions",
  projectName: "VALUEPRISM",
} as const;

export const valueDefinitions: Record<ValueId, ValueDefinition> = {
  autonomy: {
    id: "autonomy",
    label: "Autonomy",
    // TODO: replace with real study data
    shortDefinition: "",
    color: "#2F6DB5", // blue
  },
  beneficence: {
    id: "beneficence",
    label: "Beneficence",
    // TODO: replace with real study data
    shortDefinition: "",
    color: "#B7791F", // amber / gold
  },
  nonmaleficence: {
    id: "nonmaleficence",
    label: "Nonmaleficence",
    // TODO: replace with real study data
    shortDefinition: "",
    color: "#1F8A84", // teal
  },
  justice: {
    id: "justice",
    label: "Justice",
    // TODO: replace with real study data
    shortDefinition: "",
    color: "#7B4FA8", // purple
  },
};

export const clinicalDilemmaCopy: ClinicalDilemmaCopy = {
  sectionLabel: "01 · Clinical dilemma",
  headline: "What would you recommend?",
  optionLabels: ["Option 1", "Option 2"],
};

// TODO: replace with real study data
// Explicitly illustrative, provisional layout copy: not a complete clinical
// dilemma. Value annotations are intentionally omitted (pending).
export const clinicalCases: ClinicalCase[] = [
  {
    id: "illustrative-anorexia-enteral-nutrition",
    patientSummary: "A 21-year-old woman with anorexia nervosa",
    vignette:
      "She is hospitalized with a slow heart rate and low blood pressure when standing. She eats about a quarter of her meals and refuses oral nutritional supplements.",
    decisionContext:
      "The team is weighing the benefits of starting tube feeding against its potential complications.",
    option1: {
      title: "Initiate enteral nutrition",
      description: "Provide nutrition through a nasogastric feeding tube.",
    },
    option2: {
      title: "Continue monitoring",
      description: "Defer tube feeding and reassess.",
    },
  },
];

// TODO: replace with real study data — authored demo response,
// not an observed OpenAI model output.
// Scripted playback: the response, span, and option ID are supplied data;
// nothing is parsed or generated at runtime.
export const modelResponse: ModelResponseConfig = {
  providerId: "openai",
  iconLabel: "OpenAI",
  panelLabel: "Model response",
  text: "Given her limited intake and current clinical concerns, I would recommend initiating enteral nutrition through a nasogastric tube, with close monitoring for complications.",
  recommendationSpan: "recommend initiating enteral nutrition through a nasogastric tube",
  extractedOptionId: "option1",
  revealWordsPerGroup: 4,
  labels: {
    identify: "Identify the recommendation",
    extracted: "Extracted choice",
  },
  // TODO: tune after visual review
  timing: {
    revealStartMs: 0,
    revealEndMs: 2000,
    groupFadeMs: 350,
    highlightStartMs: 6000,
    highlightEndMs: 7000,
    outlineStartMs: 7000,
    outlineEndMs: 8000,
    durationMs: 12000,
  },
};

// TODO: replace with real study data
export const regressionRows: RegressionRow[] = [];

// TODO: replace with real study data
export const valueProfiles: ValueProfile[] = [];

// TODO: tune after visual review
export const timing: DemoTiming = {
  openingFrameMs: 8000,
  // Provisional reading hold.
  // TODO: tune after visual review
  clinicalCaseMs: 25000,
};
