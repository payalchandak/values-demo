import type { StudyCase } from "../../study/types";
import { deltaOf } from "./placeholderCases";

const deltaKey = (c: StudyCase) => Object.values(deltaOf(c)).join(",");

/**
 * Chooses the two foreground cases that follow the opening case.
 *
 * The opening case is case 1. The two returned cases:
 *  - have a delta (tags[0] minus tags[1], per value) different from case 1's
 *    and from each other's;
 *  - have `profileKey` counts different from case 1's and from each other's;
 *  - include one at 3/10 or below if any candidate has one, otherwise the
 *    lowest count available.
 *
 * Deterministic: ties go to the case that comes first in `cases`. The result is
 * ordered by count, highest first, so the table reads top-down 10, mid, low.
 */
export function pickForegroundCases(
  cases: readonly StudyCase[],
  openingId: string,
  profileKey: string,
): [StudyCase, StudyCase] {
  const opening = cases.find((c) => c.id === openingId);
  if (!opening) throw new Error(`Opening case ${openingId} not found`);
  const count = (c: StudyCase) => {
    const k = c.modelChoice1Counts[profileKey];
    if (k === undefined) throw new Error(`${c.id} has no modelChoice1Counts["${profileKey}"]`);
    return k;
  };
  const openingCount = count(opening);
  const openingDelta = deltaKey(opening);

  const pool = cases.filter(
    (c) => c.id !== openingId && deltaKey(c) !== openingDelta && count(c) !== openingCount,
  );

  // Low case: lowest count among those at 3/10 or below, else the lowest available.
  // Sorting by count then file order makes both branches the same rule.
  const byCountThenOrder = [...pool].sort((a, b) => count(a) - count(b) || cases.indexOf(a) - cases.indexOf(b));
  const low = byCountThenOrder[0];
  if (!low) throw new Error("No case differs from the opening case in both delta and count");

  // Mid case: distinct delta and count from both, closest to an even split.
  const mid = pool
    .filter((c) => deltaKey(c) !== deltaKey(low) && count(c) !== count(low))
    .sort(
      (a, b) =>
        Math.abs(count(a) - 5) - Math.abs(count(b) - 5) || cases.indexOf(a) - cases.indexOf(b),
    )[0];
  if (!mid) throw new Error("No second foreground case with a distinct delta and count");

  return count(mid) >= count(low) ? [mid, low] : [low, mid];
}
