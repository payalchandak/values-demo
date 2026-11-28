import { ALL_MODELS } from "../chapters/ending/profiles";
import type { Profile } from "../study/types";

export const gptProfile: Profile = (() => {
  const gpt = ALL_MODELS.find((p) => p.key === "gpt");
  if (!gpt) throw new Error('profiles.json has no model "gpt"');
  return gpt;
})();
