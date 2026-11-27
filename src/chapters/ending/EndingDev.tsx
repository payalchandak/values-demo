import DemoPlayer from "../../DemoPlayer";
import { endingChapters, endingSelection } from "./index";

/** `#/dev/ending`: the two ending chapters on their own, with the normal player and HUD. */
export default function EndingDev() {
  return (
    <>
      <div
        data-testid="ending-selection"
        className="pointer-events-none fixed inset-x-0 top-0 z-40 bg-white/70 px-3 py-0.5 font-mono text-[9px] leading-[13px] text-gray-500"
      >
        <div>physicians (seed first): {endingSelection.physicianKeys.join(" ")}</div>
        <div>
          models (ch1 = first 3): {endingSelection.autoplayModelKeys.join(" ")}
        </div>
      </div>
      <DemoPlayer chapters={endingChapters} />
    </>
  );
}
