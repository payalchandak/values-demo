import { chapterDuration, beatStart } from "../../types";
import type { Profile } from "../../study/types";
import { stackCases } from "../../stage/data";
import Morph from "../../stage/Morph";
import { MORPH_HANDOFF_MS } from "../../stage/morphBeats";
import StackStage from "../stack/StackStage";
import { stackBeats } from "../stack/beats";
import { COMPRESS_CAPTION, compressBeats, easeOut } from "./beats";

const STACK_END = chapterDuration({ beats: stackBeats });
const COMPRESS_END = chapterDuration({ beats: compressBeats });
const PROFILE_AT = beatStart(compressBeats, "profile");

/**
 * Autoplay after the stack table. The table holds with one caption, then the
 * rows fade while the profile bars grow. A clock past this bridge (the stage
 * hand-off still seeks the long detail chapter's last frame) holds the bars.
 */
export function CompressBridge({ elapsedMs, profile }: { elapsedMs: number; profile: Profile }) {
  const t = Math.max(0, elapsedMs);
  const span = COMPRESS_END - PROFILE_AT;
  const grow = t >= COMPRESS_END || span <= 0 ? 1 : easeOut(Math.min(1, Math.max(0, (t - PROFILE_AT) / span)));
  // Rows leave before the bar labels are readable, so the two texts do not sit on each other.
  const table = grow >= 1 ? 0 : Math.max(0, 1 - grow / 0.5);
  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-0">
        <Morph profile={profile} elapsedMs={MORPH_HANDOFF_MS} barGrow={grow} />
      </div>
      <div className="absolute inset-0" style={{ opacity: table, visibility: table <= 0 ? "hidden" : "visible" }}>
        <StackStage
          cases={stackCases}
          beats={stackBeats}
          elapsedMs={STACK_END}
          profileKey={profile.key}
          profileLabel={profile.displayName}
          caption={COMPRESS_CAPTION}
        />
      </div>
    </div>
  );
}
