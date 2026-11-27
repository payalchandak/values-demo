// Independent check of the extracted data: refit the binomial logit (no
// intercept) in TypeScript, apply softmax(w / T), and compare to targets.
//
// Pure functions only (no Node imports) so this file is safe under the app's
// tsconfig. `scripts/verify.ts` loads the JSON and calls `verify`.
//
//   logit p_i = w_A d_iA + w_B d_iB + w_N d_iN + w_J d_iJ
//   d_i = tag(choice 1) - tag(choice 2); p_i = choice-1 share of the n_i
//   non-missing runs on case i. Fit by IRLS on the binomial likelihood.

import type { Profile, StudyCase, Value } from './types';

export const VALUE_ORDER: readonly Value[] = ['A', 'B', 'N', 'J'];
export const TEMPERATURE = 0.262;

/** Raw counts for one decision maker on one case. `trials` excludes refusals. */
export interface CaseCount {
  choice1: number;
  trials: number;
}
/** profile key -> case id -> counts. This is src/study/data/decisions.json. */
export type DecisionCounts = Record<string, Record<string, CaseCount>>;

/** Paper Table 8 targets, in A,B,N,J order. */
export const TABLE_8_TARGETS: Record<string, Record<Value, number>> = {
  gpt: { A: 0.061, B: 0.676, N: 0.121, J: 0.142 },
  claude: { A: 0.205, B: 0.218, N: 0.526, J: 0.051 },
  gemini: { A: 0.312, B: 0.355, N: 0.222, J: 0.111 },
  physicians: { A: 0.437, B: 0.286, N: 0.148, J: 0.129 },
};

export function deltaRow(c: StudyCase): number[] {
  return VALUE_ORDER.map((v) => c.tags[0][v] - c.tags[1][v]);
}

/** Solve A x = b (A is k x k, SPD in practice) by Gaussian elimination. */
function solve(A: number[][], b: number[]): number[] {
  const k = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < k; col++) {
    let piv = col;
    for (let r = col + 1; r < k; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-12) throw new Error('singular information matrix');
    [M[col], M[piv]] = [M[piv], M[col]];
    for (let r = col + 1; r < k; r++) {
      const f = M[r][col] / M[col][col];
      for (let c = col; c <= k; c++) M[r][c] -= f * M[col][c];
    }
  }
  const x = new Array<number>(k).fill(0);
  for (let r = k - 1; r >= 0; r--) {
    let s = M[r][k];
    for (let c = r + 1; c < k; c++) s -= M[r][c] * x[c];
    x[r] = s / M[r][r];
  }
  return x;
}

export interface Fit {
  weights: Record<Value, number>;
  iterations: number;
  converged: boolean;
}

/**
 * Binomial logit, no intercept, by Newton/IRLS. Cases with zero trials are
 * skipped. Starts from w = 0 and stops when the step is below 1e-12.
 */
export function fitBinomialLogit(cases: readonly StudyCase[], counts: Record<string, CaseCount>): Fit {
  const rows: { x: number[]; y: number; n: number }[] = [];
  for (const c of cases) {
    const k = counts[c.id];
    if (!k) throw new Error(`no counts for case ${c.id}`);
    if (k.trials > 0) rows.push({ x: deltaRow(c), y: k.choice1, n: k.trials });
  }
  const dim = VALUE_ORDER.length;
  let w = new Array<number>(dim).fill(0);
  let converged = false;
  let it = 0;
  for (; it < 100; it++) {
    const H = Array.from({ length: dim }, () => new Array<number>(dim).fill(0));
    const g = new Array<number>(dim).fill(0);
    for (const { x, y, n } of rows) {
      const eta = x.reduce((s, xi, i) => s + xi * w[i], 0);
      const p = 1 / (1 + Math.exp(-eta));
      const v = n * p * (1 - p);
      for (let i = 0; i < dim; i++) {
        g[i] += x[i] * (y - n * p);
        for (let j = 0; j < dim; j++) H[i][j] += v * x[i] * x[j];
      }
    }
    const step = solve(H, g);
    w = w.map((wi, i) => wi + step[i]);
    if (Math.max(...step.map(Math.abs)) < 1e-12) {
      converged = true;
      break;
    }
  }
  const weights = {} as Record<Value, number>;
  VALUE_ORDER.forEach((v, i) => (weights[v] = w[i]));
  return { weights, iterations: it + 1, converged };
}

export function softmaxPriorities(w: Record<Value, number>, T: number = TEMPERATURE): Record<Value, number> {
  const scaled = VALUE_ORDER.map((v) => w[v] / T);
  const m = Math.max(...scaled);
  const e = scaled.map((s) => Math.exp(s - m));
  const z = e.reduce((a, b) => a + b, 0);
  const out = {} as Record<Value, number>;
  VALUE_ORDER.forEach((v, i) => (out[v] = e[i] / z));
  return out;
}

export function maxAbsError(a: Record<Value, number>, b: Record<Value, number>): number {
  return Math.max(...VALUE_ORDER.map((v) => Math.abs(a[v] - b[v])));
}

export interface ProfileCheck {
  key: string;
  displayName: string;
  fitConverged: boolean;
  /** Max |w_ts - w_json| over A,B,N,J: the TS refit vs the stored weights. */
  weightDiff: number;
  /** Max |softmax_ts - priorities_json|. */
  priorityDiff: number;
  refit: Record<Value, number>;
  target?: Record<Value, number>;
  /** Max |refit - target|, only for decision makers with a Table 8 target. */
  targetMaxAbsError?: number;
}

export interface VerifyResult {
  checks: ProfileCheck[];
  /** Problems with the data itself (counts out of range, mismatched votes, ...). */
  integrity: string[];
}

export function verify(cases: readonly StudyCase[], decisions: DecisionCounts, profiles: readonly Profile[]): VerifyResult {
  const integrity: string[] = [];

  // StudyCase fields must agree with the raw counts they were derived from.
  for (const c of cases) {
    if (c.physicianVotesChoice1 !== decisions.physicians[c.id].choice1) {
      integrity.push(`${c.id}: physicianVotesChoice1 != pooled choice1`);
    }
    for (const [key, n] of Object.entries(c.modelChoice1Counts)) {
      if (decisions[key]?.[c.id]?.choice1 !== n) integrity.push(`${c.id}: modelChoice1Counts[${key}] mismatch`);
    }
  }
  for (const [key, perCase] of Object.entries(decisions)) {
    for (const [id, k] of Object.entries(perCase)) {
      if (k.choice1 < 0 || k.choice1 > k.trials) integrity.push(`${key}/${id}: choice1 ${k.choice1} outside 0..${k.trials}`);
    }
  }

  const checks: ProfileCheck[] = profiles.map((p) => {
    const counts = decisions[p.key];
    if (!counts) throw new Error(`no decisions for profile ${p.key}`);
    const fit = fitBinomialLogit(cases, counts);
    const pri = softmaxPriorities(fit.weights);
    const target = TABLE_8_TARGETS[p.key];
    return {
      key: p.key,
      displayName: p.displayName,
      fitConverged: fit.converged,
      weightDiff: maxAbsError(fit.weights, p.weights),
      priorityDiff: maxAbsError(pri, p.priorities),
      refit: pri,
      target,
      targetMaxAbsError: target ? maxAbsError(pri, target) : undefined,
    };
  });
  return { checks, integrity };
}
