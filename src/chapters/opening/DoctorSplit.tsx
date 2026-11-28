import PhysicianIcon from "./PhysicianIcon";

/**
 * ILLUSTRATIVE ONLY. These counts are made up to show that physicians disagree.
 * They are not read from study data and must not be treated as results.
 */
export const ILLUSTRATIVE_PHYSICIAN_VOTES = { choice1: 12, choice2: 13 } as const;

export const PHYSICIAN_VOTE_COUNT = ILLUSTRATIVE_PHYSICIAN_VOTES.choice1 + ILLUSTRATIVE_PHYSICIAN_VOTES.choice2;

/**
 * Fixed vote order: the two sides alternate so both grow together, and the
 * side with the extra icon gets the last one. Entry i is the side of vote i.
 */
const VOTE_ORDER: readonly (0 | 1)[] = (() => {
  const left: number[] = [ILLUSTRATIVE_PHYSICIAN_VOTES.choice1, ILLUSTRATIVE_PHYSICIAN_VOTES.choice2];
  const out: (0 | 1)[] = [];
  let side: 0 | 1 = 0;
  while (left[0] + left[1] > 0) {
    if (left[side] === 0) side = side === 0 ? 1 : 0;
    left[side] -= 1;
    out.push(side);
    side = side === 0 ? 1 : 0;
  }
  return out;
})();

/** Global vote numbers that land under each option, in order. */
const VOTES_BY_SIDE: readonly (readonly number[])[] = [0, 1].map((s) =>
  VOTE_ORDER.flatMap((side, i) => (side === s ? [i] : [])),
);

/**
 * Physician icons under one option. Every icon is laid out from the start, so
 * nothing moves as they arrive; each fades in at the 0..1 `enterOf(vote)` gives it.
 */
export function PhysicianVotes({ index, enterOf }: { index: 0 | 1; enterOf: (vote: number) => number }) {
  const count = ILLUSTRATIVE_PHYSICIAN_VOTES[index === 0 ? "choice1" : "choice2"];
  return (
    <div
      role="img"
      aria-label={`${count} physicians`}
      className="mx-auto flex w-full flex-wrap justify-center gap-x-[0.3em] gap-y-[0.3em]"
      style={{ fontSize: "1.6em", maxWidth: "9.1em" }}
    >
      {VOTES_BY_SIDE[index].map((vote) => {
        const p = enterOf(vote);
        return (
          <span
            key={vote}
            style={{ opacity: p, transform: p >= 1 ? undefined : `scale(${0.8 + 0.2 * p})` }}
          >
            <PhysicianIcon />
          </span>
        );
      })}
    </div>
  );
}
