import { beatStart, type Beat, type Chapter } from "../../types";
import IndividualModels, { individualModelsEndMs, modelStartMs } from "./IndividualModels";
import ModelsAndPhysicians, { type PhysiciansTiming } from "./ModelsAndPhysicians";
import { PLACEHOLDER_PROFILES, selectModels, selectPhysicians } from "./profiles";

// Swap `PLACEHOLDER_PROFILES` for the real profiles when wiring up.
const models = selectModels(PLACEHOLDER_PROFILES);
// Individual physicians only; the pooled profile is filtered out.
const physicians = selectPhysicians(PLACEHOLDER_PROFILES);

/* Chapter 1: one beat per model (start of its hold), then the end marker. */
// TODO: tune after visual review
const individualBeats: readonly Beat[] = [
  ...models.map((m, i) => ({ name: m.key, startMs: modelStartMs(i) })),
  { name: "end", startMs: individualModelsEndMs(models.length) },
];

/* Chapter 2 */
// TODO: tune after visual review
const closingBeats = [
  { name: "models", startMs: 0 }, // radars shrink into the labeled model row
  { name: "physicians", startMs: 1400 }, // physician radars appear one by one
  { name: "hold", startMs: 3600 }, // everything on screen, held
  { name: "question", startMs: 7600 }, // rows dim, closing question + buttons
  { name: "end", startMs: 12000 }, // final hold
] as const;

const closingTiming: PhysiciansTiming = {
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
        models={models}
        physicians={physicians}
        elapsedMs={ctx.elapsedMs}
        timing={closingTiming}
      />
    ),
  },
];
