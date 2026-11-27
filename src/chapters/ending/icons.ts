import { siClaude, siDeepseek, siGooglegemini, siMistralai, siQwen } from "simple-icons";
import type { SimpleIcon } from "simple-icons";
import openaiLogo from "../../assets/providers/openai.svg";
import type { Profile } from "../../study/types";

/** The mark in brand color with a margin all round, for the round white badge. */
const markUri = ({ path, hex }: SimpleIcon): string =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 40 40"><path d="${path}" fill="#${hex}"/></svg>`,
  )}`;

const letterUri = (letter: string): string =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text x="50" y="50" text-anchor="middle" dominant-baseline="central" font-family="ui-sans-serif,system-ui,sans-serif" font-size="46" font-weight="600" fill="#6B7280">${letter}</text></svg>`,
  )}`;

/** Logo per model key. OpenAI is the repo asset; the rest come from simple-icons. */
const LOGOS: Readonly<Record<string, string>> = {
  gpt: openaiLogo,
  claude: markUri(siClaude),
  gemini: markUri(siGooglegemini),
  deepseek: markUri(siDeepseek),
  mistral: markUri(siMistralai),
  qwen: markUri(siQwen),
};

/** Models outside the autoplay set fall back to a lettered mark. */
export const modelLogo = (profile: Profile): { src: string; alt: string } => ({
  src: LOGOS[profile.key] ?? letterUri(profile.displayName.charAt(0)),
  alt: profile.displayName,
});
