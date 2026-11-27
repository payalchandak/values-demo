import { useEffect, useState } from "react";
import DemoPlayer from "./DemoPlayer";
import { chapters } from "./demoChapters";
import { DevRoute, isDevRoute } from "./dev/registry";

export default function App() {
  const [dev, setDev] = useState(isDevRoute);
  useEffect(() => {
    const onChange = () => setDev(isDevRoute());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  if (dev) return <DevRoute />;
  return <DemoPlayer chapters={chapters} />;
}
