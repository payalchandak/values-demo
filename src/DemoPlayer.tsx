import { memo } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import type { DemoStep } from "./types";
import { usePlayback } from "./usePlayback";
import PausedBadge from "./components/PausedBadge";
import Hud from "./components/Hud";

/**
 * Generic, content-agnostic player. It only knows about `steps`
 * ({ id, durationMs, render }) — swap `demoSteps.tsx` to change the content.
 */
interface DemoPlayerProps {
  steps: DemoStep[];
}

const Stage = memo(function Stage({ step }: { step: DemoStep }) {
  return (
    // No opacity/transform on the keyed wrapper: elements inside the slide
    // decide their own exit animation, so shared `layoutId` elements can
    // persist and morph into the next slide's layout.
    <motion.div key={step.id} className="h-full w-full">
      {step.render()}
    </motion.div>
  );
});

export default function DemoPlayer({ steps }: DemoPlayerProps) {
  const { currentStep, isPaused, progress, seek, next, prev, restart, togglePause } =
    usePlayback(steps.map((s) => s.durationMs));

  const step = steps[currentStep];

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-canvas">
      <PausedBadge visible={isPaused} />

      <main className="mx-auto h-full w-full max-w-5xl px-6 pb-24 pt-8 md:px-10">
        <LayoutGroup>
          <AnimatePresence mode="wait">
            <Stage key={step.id} step={step} />
          </AnimatePresence>
        </LayoutGroup>
      </main>

      <Hud
        count={steps.length}
        currentStep={currentStep}
        progress={progress}
        isPaused={isPaused}
        onPrev={prev}
        onNext={next}
        onToggle={togglePause}
        onRestart={restart}
        onSeek={seek}
      />
    </div>
  );
}
