import type { ReactNode } from "react";

export interface DemoStep {
  id: string;
  durationMs: number;
  render: () => ReactNode;
}
