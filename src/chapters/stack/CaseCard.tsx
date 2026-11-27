import type { CSSProperties } from "react";
import type { StudyCase } from "../../study/types";
import { caseCardCopy } from "./caseCards";
import { placeholderSpecialty } from "./placeholderCases";

/** One case, as the stack card shows it. The same shape for every case. */
export interface CaseCardItem {
  specialty: string;
  /** Two or three words, for the small card. */
  title: string;
  /** One complete sentence. */
  summary: string;
  choices: readonly [string, string];
}

const INK = "#1B2433";
const OPTION_INK = "#475569";

/** Shell shared with the tag side of the card, so a flip does not change the box. */
export const caseFaceStyle = {
  width: "100%",
  height: "100%",
  boxSizing: "border-box",
  padding: 14,
  borderRadius: 12,
  background: "#fff",
  border: "1px solid #e5e7eb",
  boxShadow: "0 2px 6px rgba(17,24,39,0.10)",
  overflow: "hidden",
} as const satisfies CSSProperties;

const firstSentence = (vignette: string): string =>
  vignette.match(/^[^.!?]+[.!?]/)?.[0] ?? vignette;

/** Placeholder cases have no written title: use the specialty, or the first three words. */
const fallbackTitle = (specialty: string, summary: string): string =>
  specialty !== "" ? specialty : summary.split(/\s+/).slice(0, 3).join(" ");

/**
 * The card for a study case. Saved cards come from study/data/caseCards.json.
 * Placeholder cards use their scenario specialty and their one-sentence vignette.
 */
export function caseCardFor(study: StudyCase): CaseCardItem {
  const authored = caseCardCopy(study.id);
  if (authored) {
    return { specialty: authored.specialty, title: authored.title, summary: authored.summary, choices: study.choices };
  }
  const specialty = placeholderSpecialty(study.vignette);
  if (specialty) {
    return { specialty, title: fallbackTitle(specialty, study.vignette), summary: study.vignette, choices: study.choices };
  }
  const summary = firstSentence(study.vignette);
  return { specialty: "", title: fallbackTitle("", summary), summary, choices: study.choices };
}

/**
 * The small-card face: just the title, very large, so it still reads when the
 * card is one of fifty. Same box as the full face, so a flip does not change it.
 */
export function CaseCardMini({ item }: { item: CaseCardItem }) {
  return (
    <div
      data-case-card-mini
      style={{ ...caseFaceStyle, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}
    >
      <span
        style={{
          fontSize: 40,
          fontWeight: 700,
          lineHeight: 1.1,
          letterSpacing: "-0.01em",
          color: INK,
          textWrap: "balance",
        }}
      >
        {item.title}
      </span>
    </div>
  );
}

/**
 * Specialty, one summary sentence, and the two choices with no numbers.
 * Natural size is the stack card; the stage scales the box.
 */
export default function CaseCardFace({ item }: { item: CaseCardItem }) {
  return (
    <div data-case-card style={{ ...caseFaceStyle, display: "flex", flexDirection: "column" }}>
      {item.specialty !== "" && (
        <div
          className="font-mono"
          style={{
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#6b7280",
          }}
        >
          {item.specialty}
        </div>
      )}
      <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.35, color: INK }}>{item.summary}</p>
      <div style={{ marginTop: "auto", display: "grid", gap: 4, paddingTop: 8 }}>
        {item.choices.map((choice) => (
          <div
            key={choice}
            style={{
              padding: "5px 8px",
              borderRadius: 6,
              background: "#FAFAFA",
              borderLeft: `3px solid ${OPTION_INK}`,
              fontSize: 11,
              lineHeight: 1.3,
            }}
          >
            {choice}
          </div>
        ))}
      </div>
    </div>
  );
}
