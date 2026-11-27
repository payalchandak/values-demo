import { beatStart, type Beat, type Chapter } from "../../types";
import IndividualModels, { individualModelsEndMs, modelStartMs } from "./IndividualModels";
import ModelsAndPhysicians, { type PhysiciansTiming } from "./ModelsAndPhysicians";
import { AUTOPLAY_MODELS, INDIVIDUAL_MODELS, SPREAD_PHYSICIANS } from "./profiles";

export { ALL_MODELS, ALL_PHYSICIANS, AUTOPLAY_MODELS, INDIVIDUAL_MODELS, SPREAD_PHYSICIANS } from "./profiles";
export { selectSpreadPhysicians } from "./profiles";

/** What the ending shows: chapter 1 models, chapter 2 model row, chapter 2 physician row. */
export const endingSelection = {
  individualModelKeys: INDIVIDUAL_MODELS.map((m) => m.key),
  autoplayModelKeys: AUTOPLAY_MODELS.map((m) => m.key),
  /** Selection order: seed (farthest from the pooled profile) first. */
  physicianKeys: SPREAD_PHYSICIANS.map((p) => p.key),
} as const;

if (import.meta.env.DEV) {
  console.log("[ending] models (ch1):", endingSelection.individualModelKeys.join(", "));
  console.log("[ending] models (ch2):", endingSelection.autoplayModelKeys.join(", "));
  console.log("[ending] physicians:", endingSelection.physicianKeys.join(", "));
}

const models = INDIVIDUAL_MODELS;

/* Chapter 1: one beat per model (start of its hold), then the end marker. */
// TODO: tune after visual review
export const individualBeats: readonly Beat[] = [
  ...models.map((m, i) => ({ name: m.key, startMs: modelStartMs(i) })),
  { name: "end", startMs: individualModelsEndMs(models.length) },
];

/* Chapter 2 */
// TODO: tune after visual review
export const closingBeats = [
  { name: "models", startMs: 0 }, // radars shrink into the labeled model row
  { name: "physicians", startMs: 1400 }, // physician radars appear one by one
  { name: "hold", startMs: 3600 }, // everything on screen, held
  { name: "question", startMs: 7600 }, // rows dim, closing question + buttons
  { name: "end", startMs: 12000 }, // final hold
] as const;

export const closingTiming: PhysiciansTiming = {
  shrinkMs: 1200,
  physiciansStartMs: beatStart(closingBeats, "physicians"),
  physicianStaggerMs: 220,
  physicianFadeMs: 450,
  questionStartMs: beatStart(closingBeats, "question"),
  questionFadeMs: 700,
};

export const endingChapters: Chapter[] = [
  {
    id: "individual-models",
    beats: individualBeats,
    render: (ctx) => <IndividualModels models={models} elapsedMs={ctx.elapsedMs} />,
  },
  {
    id: "models-and-physicians",
    beats: closingBeats,
    render: (ctx) => (
      <ModelsAndPhysicians
        models={AUTOPLAY_MODELS}
        anchorKey={INDIVIDUAL_MODELS[INDIVIDUAL_MODELS.length - 1].key}
        physicians={SPREAD_PHYSICIANS}
        elapsedMs={ctx.elapsedMs}
        timing={closingTiming}
        onReplay={ctx.restart}
      />
    ),
  },
];
