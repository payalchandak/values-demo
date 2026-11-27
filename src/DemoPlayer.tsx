import { LayoutGroup } from "framer-motion";
import type { Chapter } from "./types";
import { useChapterClock } from "./useChapterClock";
import PausedBadge from "./components/PausedBadge";
import Hud from "./components/Hud";

/**
 * Generic, content-agnostic player. It only knows about `chapters`
 * ({ id, beats, render(ctx) }); swap `demoChapters.tsx` to change the content.
 */
interface DemoPlayerProps {
  chapters: readonly Chapter[];
}

export default function DemoPlayer({ chapters }: DemoPlayerProps) {
  const clock = useChapterClock(chapters);
  const chapter = chapters[clock.chapterIndex];

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-canvas">
      <PausedBadge visible={clock.isPaused && clock.pausedByViewer} />

      <main className="mx-auto h-full w-full max-w-5xl px-6 pb-24 pt-8 md:px-10">
        {/*
          One persistent stage: never keyed by chapter, so elements that share a
          layoutId (or the same component type) carry over and morph instead of
          remounting. Chapters just render different content into it.
        */}
        <LayoutGroup>
          <div className="h-full w-full">
            {chapter.render({
              elapsedMs: clock.elapsedMs,
              progress: clock.progress,
              isPaused: clock.isPaused,
              time: clock.time,
            })}
          </div>
        </LayoutGroup>
      </main>

      <Hud
        count={chapters.length}
        currentStep={clock.chapterIndex}
        progress={clock.progress}
        isPaused={clock.isPaused}
        onPrev={clock.prev}
        onNext={clock.next}
        onToggle={clock.togglePause}
        onRestart={clock.restart}
        onSeek={(i) => clock.seek(i)}
      />
    </div>
  );
}
