import type { Chapter } from "../../types";
import { closingBeats, individualBeats } from "./beats";
import IndividualModels from "./IndividualModels";
import ModelsAndPhysicians from "./ModelsAndPhysicians";
import { AUTOPLAY_MODELS, GALLERY_PHYSICIANS, INDIVIDUAL_MODELS } from "./profiles";

export { ALL_MODELS, ALL_PHYSICIANS, AUTOPLAY_MODELS, GALLERY_PHYSICIANS, INDIVIDUAL_MODELS, SPREAD_PHYSICIANS } from "./profiles";
export { selectSpreadPhysicians } from "./profiles";
export { closingBeats, individualBeats, individualLabelWeight } from "./beats";

/** What the ending shows: the three held models, then row 1 (models) and row 2 (physicians). */
export const endingSelection = {
  individualModelKeys: INDIVIDUAL_MODELS.map((m) => m.key),
  galleryModelKeys: AUTOPLAY_MODELS.map((m) => m.key),
  /** Row 2 in display order: dominant value, then its share, descending. */
  physicianKeys: GALLERY_PHYSICIANS.map((p) => p.key),
} as const;

export const endingChapters: Chapter[] = [
  {
    id: "individual-models",
    beats: individualBeats,
    render: (ctx) => <IndividualModels models={INDIVIDUAL_MODELS} elapsedMs={ctx.elapsedMs} />,
  },
  {
    id: "models-and-physicians",
    beats: closingBeats,
    render: (ctx) => (
      <ModelsAndPhysicians
        models={AUTOPLAY_MODELS}
        anchorKey={INDIVIDUAL_MODELS[INDIVIDUAL_MODELS.length - 1].key}
        physicians={GALLERY_PHYSICIANS}
        elapsedMs={ctx.elapsedMs}
        onReplay={ctx.restart}
      />
    ),
  },
];
