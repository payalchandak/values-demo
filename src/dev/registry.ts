import { createElement, lazy, Suspense, useEffect, useState } from "react";
import type { ComponentType, LazyExoticComponent } from "react";

export interface DevEntry {
  name: string;
  component: LazyExoticComponent<ComponentType<any>>;
}

// Register dev-only components here, e.g.
// { name: "foo", component: lazy(() => import("./Foo")) }
export const registry: DevEntry[] = [
  { name: "ending", component: lazy(() => import("../chapters/ending/EndingDev")) },
  { name: "radar", component: lazy(() => import("../chapters/ending/RadarDev")) },
  { name: "primitives", component: lazy(() => import("./PrimitivesPage")) },
  { name: "stack", component: lazy(() => import("../chapters/stack/StackDev")) },
  { name: "regression", component: lazy(() => import("../chapters/regression/Dev")) },
  { name: "opening", component: lazy(() => import("../chapters/opening/OpeningDev")) },
  { name: "stage", component: lazy(() => import("../stage/StageDev")) },
];

const PREFIX = "#/dev/";

export const isDevRoute = () => window.location.hash.startsWith(PREFIX);

export function DevRoute() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  const name = decodeURIComponent(hash.slice(PREFIX.length));
  const entry = registry.find((e) => e.name === name);
  if (!entry) return createElement("div", null, `No dev component "${name}"`);
  return createElement(
    Suspense,
    { fallback: null },
    createElement(entry.component),
  );
}
