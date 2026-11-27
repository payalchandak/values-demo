import Donut from "../../components/Donut";
import type { Profile } from "../../study/types";
import { individualLabelWeight, individualState } from "./beats";
import { EndingHeader, ModelLabel } from "./shared";

/** Height of the icon-and-name block under the donut. The morph into this chapter lays out identically. */
export const HERO_CHROME = 76;
export const HERO_ICON = 36;

/**
 * One persistent hero donut at a fixed center. It holds a model, then its arcs
 * sweep to the next model's values while the icon and name cross-fade beneath.
 * The chart stays put: only its arcs, labels and numbers change.
 */
export default function IndividualModels({
  models,
  elapsedMs,
  showHeader = true,
  sharedIconFor,
}: {
  models: readonly Profile[];
  elapsedMs: number;
  /** False when the stage supplies the headline. */
  showHeader?: boolean;
  /** Key of the model whose icon the stage draws (leaves a slot instead). */
  sharedIconFor?: string;
}) {
  const state = individualState(elapsedMs);
  const from = models[state.from];
  const to = models[state.to];

  return (
    <div className="flex h-full w-full flex-col">
      {showHeader && <EndingHeader label="Individual models" />}

      <div className="relative min-h-0 flex-1">
        <Donut from={from.priorities} to={to.priorities} t={state.t} mode="hero" />
      </div>

      <div className="grid shrink-0 place-items-center" style={{ height: HERO_CHROME }}>
        {models.map((model) => (
          <div key={model.key} className="col-start-1 row-start-1" style={{ opacity: individualLabelWeight(elapsedMs, model.key) }}>
            <ModelLabel profile={model} iconSize={HERO_ICON} large stacked iconSlot={model.key === sharedIconFor} />
          </div>
        ))}
      </div>
    </div>
  );
}
