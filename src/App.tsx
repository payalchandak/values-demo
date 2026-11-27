import DemoPlayer from "./DemoPlayer";
import { chapters } from "./demoChapters";
import { DevRoute, isDevRoute } from "./dev/registry";

export default function App() {
  if (isDevRoute()) return <DevRoute />;
  return <DemoPlayer chapters={chapters} />;
}
