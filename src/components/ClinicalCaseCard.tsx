import type { ReactNode } from "react";
import type { ClinicalCase, ClinicalDilemmaCopy, ClinicalOptionId } from "../data/demoData";

export type { ClinicalOptionId };

/**
 * Height reserved for the badge slot in every option's label row, in px.
 * Always reserved (even when empty) so a badge arriving never resizes a card.
 */
export const OPTION_BADGE_SLOT_PX = 40;

interface ClinicalCaseCardProps {
  copy: ClinicalDilemmaCopy;
  clinicalCase: ClinicalCase;
  /**
   * Recommendation to mark as selected. When omitted, both options keep the
   * neutral patient-dilemma appearance. Controlled by the parent.
   */
  selectedOptionId?: ClinicalOptionId;
  /**
   * Optional badge rendered at the end of the selected recommendation's label
   * row (e.g. a provider icon). Ignored when nothing is selected. The card
   * does not know what the badge represents. Should be at most
   * `OPTION_BADGE_SLOT_PX` tall.
   */
  selectedOptionBadge?: ReactNode;
  /**
   * Optional content rendered between the patient description and the
   * recommendation cards (e.g. a model response). Keeps the reading order
   * patient -> response -> recommendations at every width.
   */
  responseSlot?: ReactNode;
}

/**
 * Static presentation of a clinical dilemma. Pure content: no motion and no
 * interaction. Options are neutral, equal-weight cards (not buttons).
 */
export default function ClinicalCaseCard({
  copy,
  clinicalCase,
  selectedOptionId,
  selectedOptionBadge,
  responseSlot,
}: ClinicalCaseCardProps) {
  const options = [
    { id: "option1", option: clinicalCase.option1 },
    { id: "option2", option: clinicalCase.option2 },
  ] as const satisfies readonly { id: ClinicalOptionId; option: unknown }[];

  return (
    <div className="text-[#1B2433]">
      <h2 className="text-balance text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
        {copy.headline}
      </h2>

      {/*
        Patient text and the optional response share a row on md+ (patient on
        the left, response on the right); on narrow screens they stack in the
        order patient -> response -> recommendation cards.
      */}
      <div className="mt-6 md:grid md:grid-cols-2 md:items-start md:gap-x-8">
        <div
          className={`space-y-3 text-base leading-relaxed md:text-lg md:leading-relaxed ${
            responseSlot ? "" : "md:col-span-2"
          }`}
        >
          <p className="font-semibold">{clinicalCase.patientSummary}</p>
          <p className="text-[#1B2433]/80">{clinicalCase.vignette}</p>
          <p className="text-[#1B2433]/80">{clinicalCase.decisionContext}</p>
        </div>
        {responseSlot && <div className="mt-6 md:mt-1">{responseSlot}</div>}
      </div>

      <ul className="mt-7 grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        {options.map(({ id, option }, i) => (
          <li
            key={option.title}
            // Selection only recolors the border and background and adds a 1px
            // ring (box-shadow, outside the layout box), so layout never shifts.
            aria-current={id === selectedOptionId ? "true" : undefined}
            className={`rounded-xl border p-4 transition-colors duration-75 ease-out md:p-5 ${
              id === selectedOptionId
                ? "border-[#3B4350] bg-[#F1F1F2] ring-1 ring-[#3B4350]"
                : "border-line bg-[#FAFAFA]"
            }`}
          >
            <div
              className="flex items-center justify-between gap-3"
              style={{ minHeight: OPTION_BADGE_SLOT_PX }}
            >
              <p className="font-mono text-xs uppercase tracking-widest text-gray-500">
                {copy.optionLabels[i]}
              </p>
              {id === selectedOptionId && selectedOptionBadge}
            </div>
            <p className="mt-1 text-lg font-semibold leading-snug">{option.title}</p>
            <p className="mt-1 text-base leading-relaxed text-[#1B2433]/70">
              {option.description}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
