import DemoPlayer from "../../DemoPlayer";
import { openingChapters } from "./index";
import OpeningScene from "./OpeningScene";

/**
 * Dev route #/dev/opening.
 *
 * - `/#/dev/opening` plays opening chapters 1 to 4 on their own.
 * - `/?t=12000#/dev/opening` freezes the scene at that opening time (ms), in
 *   the same frame the player uses. For visual review at any viewport size.
 */
export default function OpeningDev() {
  const t = new URLSearchParams(window.location.search).get("t");
  if (t === null || Number.isNaN(Number(t))) return <DemoPlayer chapters={openingChapters} />;
  return (
    <div className="h-screen w-screen overflow-hidden bg-canvas">
      <main className="mx-auto h-full w-full px-3 pb-24 pt-3 md:px-10 md:pt-16">
        <OpeningScene t={Number(t)} />
      </main>
    </div>
  );
}
