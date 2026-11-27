import type { Beat, Chapter } from "../../types";
import type { StudyCase } from "../../study/types";
import { stackBeats, resolveBeats } from "./beats";
import { placeholderCases } from "./placeholderCases";
import StackStage from "./StackStage";

export { stackBeats, STACK_BEAT_NAMES, type StackBeatName } from "./beats";
export { placeholderCases, makePlaceholderCases } from "./placeholderCases";

export interface StackChapterOptions {
  /** At least 3 cases; the first three become the foreground trio and table rows. */
  cases?: readonly StudyCase[];
  /** Override the timeline. Must contain every name in `STACK_BEAT_NAMES`, in order. */
  beats?: readonly Beat[];
}

/** The stack chapter: a pure function of the engine's chapter clock. */
export function createStackChapter({
  cases = placeholderCases,
  beats = stackBeats,
}: StackChapterOptions = {}): Chapter {
  resolveBeats(beats); // fail at construction, not mid-playback
  return {
    id: "stack",
    beats,
    render: ({ elapsedMs }) => <StackStage cases={cases} beats={beats} elapsedMs={elapsedMs} />,
  };
}
