import { VALUE_ORDER } from "../../design";
import type { Tag, Value } from "../../study/types";
import { GPT_TRIALS, type DilemmaCard } from "./data";

/**
 * How much this case adds to each value: the gap between the two choices' tags,
 * signed by how far GPT leaned toward choice 1. A tie leans nowhere, so it
 * casts nothing.
 */
export function votesOf(card: DilemmaCard): Record<Value, number> {
  const lean = card.gptChoice1 / GPT_TRIALS - 0.5;
  const gap = (v: Value) => (card.tags[0][v] - card.tags[1][v]) * lean;
  return { A: gap("A"), B: gap("B"), N: gap("N"), J: gap("J") };
}

/** The choice GPT landed on, or null when the ten queries split evenly. */
export function winnerSide(card: DilemmaCard): 0 | 1 | null {
  if (card.gptChoice1 * 2 > GPT_TRIALS) return 0;
  if (card.gptChoice1 * 2 < GPT_TRIALS) return 1;
  return null;
}

/** Values whose judgment actually moves the tally. */
export function votingValues(card: DilemmaCard): Value[] {
  const votes = votesOf(card);
  return VALUE_ORDER.filter((v) => Math.abs(votes[v]) > 1e-6);
}

/**
 * Share of the bar track that one watched case adds when its promote or its
 * violate lands. The signed vote alone is a few pixels against fifty cases,
 * and a violate is negative, so on an empty bar it shows as nothing.
 */
export const SHOWN_BAR = 0.1;

/** True when this value's promote or violate is one of the votes the case casts. */
export function castsVote(card: DilemmaCard, value: Value): boolean {
  return Math.abs(votesOf(card)[value]) > 1e-6;
}

/** The winning choice's own tag for a value: the judgment that flies to the bar. */
export function winnerTag(card: DilemmaCard, value: Value): Tag | null {
  const side = winnerSide(card);
  if (side === null) return null;
  return card.tags[side][value];
}
