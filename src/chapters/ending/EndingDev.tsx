import DemoPlayer from "../../DemoPlayer";
import { endingChapters } from "./index";

/** `#/dev/ending`: the two ending chapters on their own, with the normal player and HUD. */
export default function EndingDev() {
  return <DemoPlayer chapters={endingChapters} />;
}
