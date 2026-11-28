/**
 * The data behind the opening's model rows: one dot row per model and one
 * square row for the physicians, all on the opening case.
 *
 * Everything is read from src/study/data (decisions.json, opening.json,
 * profiles.json) and validated on import. Bad data throws here instead of
 * drawing a wrong picture. Nothing about a model or a count is typed in.
 *
 * Refusal-affected models: glm, llama and kimi are on REFUSAL_AFFECTED_MODEL_KEYS,
 * a guard for the ending gallery that stays as it is. This opening uses its own
 * list (OPENING_ROW_MODEL_KEYS). They appear here because on this case they have
 * full trials, which the check below enforces.
 */
import decisionsJson from "../../study/data/decisions.json";
import openingJson from "../../study/data/opening.json";
import type { Profile } from "../../study/types";
import { ALL_MODELS } from "../ending/profiles";
import { modelLogo } from "../ending/icons";
import { openingCase } from "./openingCase";

/** What decisions.json holds per profile and case. */
interface DecisionCell {
  choice1: number;
  trials: number;
}
type DecisionsJson = Record<string, Record<string, DecisionCell>>;

/** The part of opening.json this module reads besides the case itself. */
interface OpeningFile {
  physicianSplit: { choice1: number; choice2: number; total: number };
  models: { gpt: { decisions: readonly number[] } };
}

const decisions = decisionsJson as unknown as DecisionsJson;
const opening = openingJson as unknown as OpeningFile;

/** Every model has this many queries on the opening case. Verified at load. */
const EXPECTED_TRIALS = 10;
/** The opening shows every model. */
const EXPECTED_MODELS = 12;
/** Each physician votes once. */
const EXPECTED_VOTES = 1;

/** The models drawn as rows, in profile order. Separate from the gallery's refusal guard. */
export const OPENING_ROW_MODEL_KEYS: readonly string[] = ALL_MODELS.map((m) => m.key);

export interface ModelRow {
  key: string;
  /** Display name only, never a version string. */
  name: string;
  logo: { src: string; alt: string };
  /** Queries that picked choice 1 (dots on the left). */
  choice1: number;
  /** Queries that picked choice 2 (dots on the right). */
  choice2: number;
  trials: number;
}

export interface PhysicianSquares {
  /** Physician keys that chose choice 1, in P order. */
  left: readonly string[];
  /** Physician keys that chose choice 2, in P order. */
  right: readonly string[];
  total: number;
}

export interface OpeningRows {
  /** Sorted by choice-1 count, largest first. Ties keep profile order. */
  models: readonly ModelRow[];
  physicians: PhysicianSquares;
  /** Most dots any model row puts on one side. Sets the shared dot pitch. */
  maxDotsPerSide: number;
  /** The vignette's first sentence, verbatim. The tucked case header. */
  caseHeader: string;
}

const fail = (msg: string): never => {
  throw new Error(`openingRows: ${msg}`);
};

function cellFor(key: string, caseId: string): DecisionCell {
  const cell = decisions[key]?.[caseId];
  if (!cell) return fail(`decisions.json has no entry for "${key}" on case ${caseId}`);
  if (!Number.isInteger(cell.choice1) || !Number.isInteger(cell.trials) || cell.trials < 1) {
    return fail(`"${key}" has bad counts ${JSON.stringify(cell)}`);
  }
  if (cell.choice1 < 0 || cell.choice1 > cell.trials) {
    return fail(`"${key}" has choice1 ${cell.choice1} outside 0..${cell.trials}`);
  }
  return cell;
}

function buildModels(caseId: string): ModelRow[] {
  const rows = ALL_MODELS.map((p: Profile): ModelRow => {
    const { choice1, trials } = cellFor(p.key, caseId);
    if (trials !== EXPECTED_TRIALS) fail(`"${p.key}" has ${trials} trials on this case, expected ${EXPECTED_TRIALS}`);
    return {
      key: p.key,
      name: p.displayName,
      logo: modelLogo(p),
      choice1,
      choice2: trials - choice1,
      trials,
    };
  });
  if (rows.length !== EXPECTED_MODELS) fail(`expected ${EXPECTED_MODELS} models, found ${rows.length}`);
  // Array.prototype.sort is stable, so ties stay in profiles.json order.
  rows.sort((a, b) => b.choice1 - a.choice1);

  const gpt = rows[0];
  if (gpt.key !== "gpt") fail(`GPT must be the first row, found "${gpt.key}"`);
  const recorded = opening.models.gpt.decisions;
  const recordedChoice1 = recorded.filter((d) => d === 1).length;
  if (recorded.length !== gpt.trials || recordedChoice1 !== gpt.choice1) {
    fail("opening.json models.gpt.decisions disagrees with decisions.json for GPT");
  }
  return rows;
}

function buildPhysicians(caseId: string): PhysicianSquares {
  const keys = Object.keys(decisions)
    .filter((k) => /^P\d+$/.test(k))
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  const split = opening.physicianSplit;
  if (keys.length !== split.total) fail(`found ${keys.length} physicians, opening.json says ${split.total}`);
  const left: string[] = [];
  const right: string[] = [];
  for (const key of keys) {
    const { choice1, trials } = cellFor(key, caseId);
    if (trials !== EXPECTED_VOTES || (choice1 !== 0 && choice1 !== 1)) {
      fail(`physician "${key}" must have exactly one vote of 0 or 1, found ${JSON.stringify({ choice1, trials })}`);
    }
    (choice1 === 1 ? left : right).push(key);
  }
  if (left.length !== split.choice1 || right.length !== split.choice2) {
    fail(`physician totals ${left.length}/${right.length} do not match opening.json ${split.choice1}/${split.choice2}`);
  }
  const pooled = cellFor("physicians", caseId);
  if (pooled.choice1 !== left.length || pooled.trials !== keys.length) {
    fail("the pooled physicians entry disagrees with the individual votes");
  }
  return { left, right, total: keys.length };
}

/** First sentence of the vignette, as written. Ends at the first period that is followed by a space. */
function firstSentence(vignette: string): string {
  const match = vignette.match(/^.+?\.(?=\s)/);
  if (!match || !vignette.startsWith(match[0])) return fail("could not find the vignette's first sentence");
  return match[0];
}

function build(): OpeningRows {
  const models = buildModels(openingCase.caseId);
  return {
    models,
    physicians: buildPhysicians(openingCase.caseId),
    maxDotsPerSide: Math.max(...models.map((m) => Math.max(m.choice1, m.choice2))),
    caseHeader: firstSentence(openingCase.vignette),
  };
}

export const openingRows: OpeningRows = build();
