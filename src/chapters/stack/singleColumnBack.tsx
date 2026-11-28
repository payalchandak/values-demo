import type { CSSProperties } from "react";
import ProviderIcon from "../../components/ProviderIcon";
import openaiLogo from "../../assets/providers/openai.svg";
import { TagGlyph } from "../../design/tags";
import type { Delta, StudyCase } from "../../study/types";
import { openingCase } from "../opening/openingCase";
import { caseFaceStyle } from "./CaseCard";
import { deltaOf, VALUES, VALUE_NAMES } from "./placeholderCases";
import { DECISION_FADE_MS, DECISION_STEP_MS } from "./timeline";

/**
 * Tag-side heading for the anorexia card only.
 * The table still uses the short title in caseCards.json.
 */
export const ANOREXIA_TAG_HEADING = "Feeding tube for anorexia?";

/** The illustrative anorexia case. Every other card keeps the two-column back. */
export function isSingleColumnCard(study: StudyCase): boolean {
  return study.id.endsWith("-illustrative");
}

const INK = "#1B2433";
const CHARCOAL = "#2B2F36";
const CAPTION = "#6b7280";
const ROW_BG = "#F3F4F6";

/** About three times the 8px edge dot. Ten of these, plus the mark, fit the card. */
const HERO_DOT = 22;
const HERO_MARK = 20;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Drop the leading verb and lowercase: "Initiate feeding tube" -> "feeding tube". */
function choiceRest(choice: string): string {
  return choice.toLowerCase().replace(/^\S+\s+/, "");
}

/**
 * Gray line under the rows, built from the two choices.
 * "Initiate feeding tube" / "Continue monitoring" reads
 * "Feeding tube compared with continuing to monitor."
 */
function comparisonCaption(choices: readonly [string, string]): string {
  const leftWords = choiceRest(choices[0]);
  const left = leftWords.charAt(0).toUpperCase() + leftWords.slice(1);
  const second = choices[1].toLowerCase();
  const rest = choiceRest(choices[1]);
  const right = second.startsWith("continue ") ? `continuing to ${rest.replace(/ing$/, "")}` : rest;
  return `${left} compared with ${right}.`;
}

/** "GPT chose Initiate feeding tube in 10 of 10 queries." Counts come from the recorded runs. */
function decisionCaption(label: string, choices: readonly [string, string], picks: readonly (0 | 1)[]): string {
  let choice1 = 0;
  for (const pick of picks) if (pick === 0) choice1 += 1;
  const trials = picks.length;
  const side: 0 | 1 = choice1 >= trials - choice1 ? 0 : 1;
  const count = side === 0 ? choice1 : trials - choice1;
  return `${label} chose ${choices[side]} in ${count} of ${trials} queries.`;
}

function DeltaMarks({ delta }: { delta: Delta[keyof Delta] }) {
  if (delta === 0) return <TagGlyph glyph="dash" size={13} />;
  const glyph = delta > 0 ? "up" : "down";
  const count = Math.min(2, Math.abs(delta));
  return (
    <span style={{ display: "inline-flex", gap: 1 }}>
      {Array.from({ length: count }, (_, i) => (
        <TagGlyph key={i} glyph={glyph} size={13} />
      ))}
    </span>
  );
}

const captionStyle = {
  flexShrink: 0,
  fontSize: 11,
  lineHeight: "13px",
  color: CAPTION,
  textAlign: "center",
} as const satisfies CSSProperties;

/**
 * Tag side of the anorexia card: one row per value, charcoal arrows on gray,
 * then the comparison line and the GPT dots. Other cards do not use this.
 */
export function SingleColumnBack({
  study,
  decisions,
}: {
  study: StudyCase;
  /** Present while the hero is showing its decision row. Omitted once the card has shrunk. */
  decisions?: { ms: number; opacity: number; label: string };
}) {
  const delta = deltaOf(study);
  const picks = openingCase.decisions;
  return (
    <div style={{ ...caseFaceStyle, padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        style={{
          flexShrink: 0,
          fontSize: 15,
          fontWeight: 700,
          lineHeight: "18px",
          letterSpacing: "-0.01em",
          color: INK,
        }}
      >
        {ANOREXIA_TAG_HEADING}
      </div>
      <div style={{ flexShrink: 0, display: "grid", gap: 4 }}>
        {VALUES.map((v) => (
          <div
            key={v}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              height: 22,
              padding: "0 8px",
              borderRadius: 6,
              background: ROW_BG,
              color: CHARCOAL,
              fontSize: 12,
              lineHeight: 1,
              whiteSpace: "nowrap",
            }}
          >
            <span>{VALUE_NAMES[v]}</span>
            <DeltaMarks delta={delta[v]} />
          </div>
        ))}
      </div>
      <div style={captionStyle}>{comparisonCaption(study.choices)}</div>
      {decisions && (
        <div style={{ flexShrink: 0, opacity: decisions.opacity }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <ProviderIcon src={openaiLogo} alt={decisions.label} size={HERO_MARK} />
            <div style={{ display: "flex", alignItems: "center", gap: 1 }}>
              {picks.map((pick, i) => {
                const filled = pick === 0;
                const arrive = clamp01((decisions.ms - i * DECISION_STEP_MS) / DECISION_FADE_MS);
                return (
                  <span
                    key={i}
                    style={{
                      width: HERO_DOT,
                      height: HERO_DOT,
                      boxSizing: "border-box",
                      borderRadius: "50%",
                      background: filled ? CHARCOAL : "transparent",
                      border: `2px solid ${CHARCOAL}`,
                      opacity: arrive,
                    }}
                  />
                );
              })}
            </div>
          </div>
          <div style={{ ...captionStyle, marginTop: 3 }}>{decisionCaption(decisions.label, study.choices, picks)}</div>
        </div>
      )}
    </div>
  );
}
