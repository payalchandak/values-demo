import { CHARCOAL } from "./charcoal";

/**
 * ILLUSTRATIVE ONLY. These percentages are made up to show that physicians
 * disagree. They are not read from study data and must not be treated as results.
 */
export const ILLUSTRATIVE_PHYSICIAN_SPLIT = { choice1: 47, choice2: 53 } as const;

const TRACK = "rgba(43, 47, 54, 0.12)";
const MUTED = "rgba(43, 47, 54, 0.62)";

/** The percent and its thin bar, filled to that percent of the column. `enter` is 0..1. */
export function SplitStat({ index, enter }: { index: 0 | 1; enter: number }) {
  const pct = index === 0 ? ILLUSTRATIVE_PHYSICIAN_SPLIT.choice1 : ILLUSTRATIVE_PHYSICIAN_SPLIT.choice2;
  return (
    <div
      className="flex w-full flex-col items-center gap-[0.35em]"
      style={{ opacity: enter }}
      aria-hidden={enter === 0}
    >
      <span className="font-semibold tabular-nums leading-none" style={{ fontSize: "1.5em", color: CHARCOAL }}>
        {pct}%
      </span>
      <div className="h-[0.28em] w-full overflow-hidden rounded-full" style={{ backgroundColor: TRACK }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: CHARCOAL }} />
      </div>
    </div>
  );
}

/** One line, centered below both choices. */
export function SplitCaption({ enter }: { enter: number }) {
  return (
    <p className="text-center" style={{ opacity: enter, fontSize: "0.95em", color: MUTED }} aria-hidden={enter === 0}>
      Physicians split.
    </p>
  );
}
