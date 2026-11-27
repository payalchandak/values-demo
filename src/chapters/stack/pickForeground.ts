import type { StudyCase } from "../../study/types";
import { deltaOf } from "./placeholderCases";
import { fitOf, MAX_FIT_GAP, type ProfileFit } from "./predict";

const deltaKey = (c: StudyCase) => Object.values(deltaOf(c)).join(",");

/**
 * Chooses the two foreground cases that follow the opening case.
 *
 * The opening case is case 1 and is never filtered. The two returned cases:
 *  - have a delta (tags[0] minus tags[1], per value) different from case 1's
 *    and from each other's;
 *  - have `profile.key` counts different from case 1's and from each other's;
 *  - are predicted well by the profile: |sigma(w . delta) - count/10| <= MAX_FIT_GAP;
 *  - are the lowest-count case (at 3/10 or below if any candidate has one,
 *    which the lowest count satisfies) and the mid-count case closest to 5/10.
 *
 * If no pair satisfies the fit rule, falls back to the smallest gaps among
 * cases that satisfy the other rules, and warns in dev.
 *
 * Deterministic: ties on count go to the smallest |predicted - observed|, then to
 * the case that comes first in `cases`. The result is
 * ordered by count, highest first, so the table reads top-down 10, mid, low.
 */
export function pickForegroundCases(
  cases: readonly StudyCase[],
  openingId: string,
  profile: ProfileFit,
): [StudyCase, StudyCase] {
  const opening = cases.find((c) => c.id === openingId);
  if (!opening) throw new Error(`Opening case ${openingId} not found`);

  const order = new Map(cases.map((c, i) => [c, i] as const));
  const fits = new Map(cases.map((c) => [c, fitOf(profile, c)] as const));
  const count = (c: StudyCase) => fits.get(c)!.count;
  const gap = (c: StudyCase) => fits.get(c)!.gap;
  const byOrder = (a: StudyCase, b: StudyCase) => order.get(a)! - order.get(b)!;

  const openingCount = count(opening);
  const openingDelta = deltaKey(opening);
  const distinct = cases.filter(
    (c) => c !== opening && deltaKey(c) !== openingDelta && count(c) !== openingCount,
  );

  /** Lowest-count case, then the distinct mid case nearest an even split. */
  const choose = (pool: StudyCase[]): [StudyCase, StudyCase] | undefined => {
    const low = [...pool].sort((a, b) => count(a) - count(b) || gap(a) - gap(b) || byOrder(a, b))[0];
    if (!low) return undefined;
    const mid = pool
      .filter((c) => deltaKey(c) !== deltaKey(low) && count(c) !== count(low))
      .sort(
        (a, b) =>
          Math.abs(count(a) - 5) - Math.abs(count(b) - 5) || gap(a) - gap(b) || byOrder(a, b),
      )[0];
    if (!mid) return undefined;
    return count(mid) >= count(low) ? [mid, low] : [low, mid];
  };

  const fitted = choose(distinct.filter((c) => gap(c) <= MAX_FIT_GAP));
  if (fitted) return fitted;

  // Fallback: the two best-fitting cases that satisfy the other rules.
  const byGap = [...distinct].sort((a, b) => gap(a) - gap(b) || byOrder(a, b));
  const first = byGap[0];
  const second = first && byGap.find((c) => deltaKey(c) !== deltaKey(first) && count(c) !== count(first));
  if (!first || !second) throw new Error("No case differs from the opening case in both delta and count");
  if (import.meta.env?.DEV) {
    console.warn(
      `pickForegroundCases: no pair within ${MAX_FIT_GAP} of the "${profile.key}" prediction; ` +
        `using smallest gaps (${first.id.slice(0, 8)}: ${gap(first).toFixed(3)}, ` +
        `${second.id.slice(0, 8)}: ${gap(second).toFixed(3)})`,
    );
  }
  return count(first) >= count(second) ? [first, second] : [second, first];
}
