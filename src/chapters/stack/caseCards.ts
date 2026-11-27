import cards from "../../study/data/caseCards.json";

/** Specialty and one summary sentence for a case. Choices stay on the study case. */
export interface CaseCardCopy {
  id: string;
  specialty: string;
  /** Two or three short words, shown very large on the small grid cards. */
  title: string;
  /** One sentence, written to fit the card. */
  summary: string;
}

/**
 * How many saved cards the stack piles up.
 * The sentences are in src/study/data/caseCards.json.
 * 3 keeps the foreground trio. 50 shows every saved card.
 */
export const STACK_CARDS_SHOWN = 50;

export const CASE_CARDS: readonly CaseCardCopy[] = cards;

const BY_ID = new Map(CASE_CARDS.map((card) => [card.id, card]));

export function caseCardCopy(id: string): CaseCardCopy | undefined {
  return BY_ID.get(id);
}
