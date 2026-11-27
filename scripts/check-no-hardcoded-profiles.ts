// Fails if a profile-like four-number tuple appears outside src/study/data.
// Profile numbers (priorities, raw weights) must be imported from the data
// folder, never retyped. Run from the repo root:
//   node scripts/check-no-hardcoded-profiles.ts
// (Node >= 22.18 strips TypeScript types natively.)
//
// A "profile-like tuple" is any of:
//   1. keyed:   an object with all four value keys (A,B,N,J or
//               autonomy/beneficence/nonmaleficence/justice) each bound to a
//               numeric literal, in any order;
//   2. list:    four numeric literals in a [...] or (...) list that look like
//               priorities or weights: at least three have 3+ decimals, or all
//               four are in [0, 1] with a sum within 0.02 of 1 and at least two
//               with 2+ decimals. (Short easing curves like [0.4, 0, 0.2, 1]
//               are not flagged.)

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIRS = ['src', 'scripts'];
const ALLOWED_DIR = join(root, 'src', 'study', 'data');
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json', '.css', '.html', '.py']);
const SELF = fileURLToPath(import.meta.url);

const NUM = String.raw`-?(?:\d+\.\d+|\.\d+|\d+)(?:[eE][-+]?\d+)?`;

const KEY_SETS: string[][] = [
  ['A', 'B', 'N', 'J'],
  ['autonomy', 'beneficence', 'nonmaleficence', 'justice'],
];

const LIST_RE = new RegExp(String.raw`[\[(]\s*(${NUM})\s*,\s*(${NUM})\s*,\s*(${NUM})\s*,\s*(${NUM})\s*,?\s*[\])]`, 'g');
const KEYED_RE = new RegExp(String.raw`["']?([A-Za-z_]+)["']?\s*[:=]\s*(${NUM})(?![\w.])`, 'g');
// One braces-delimited object with no nesting, e.g. { A: 0.1, B: 0.2, N: 0.3, J: 0.4 }.
const OBJECT_RE = /\{[^{}]*\}/g;

const decimals = (literal: string): number => literal.split('.')[1]?.replace(/[eE].*$/, '').length ?? 0;

function isProfileLikeList(literals: string[]): boolean {
  const nums = literals.map(Number);
  if (literals.filter((l) => decimals(l) >= 3).length >= 3) return true;
  const unit = nums.every((n) => n >= 0 && n <= 1);
  const sum = nums.reduce((a, b) => a + b, 0);
  return unit && Math.abs(sum - 1) <= 0.02 && literals.filter((l) => decimals(l) >= 2).length >= 2;
}

function lineOf(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

interface Hit {
  file: string;
  line: number;
  kind: 'keyed' | 'list';
  snippet: string;
}

function scan(file: string, text: string): Hit[] {
  const hits: Hit[] = [];
  const rel = relative(root, file).split(sep).join('/');

  for (const m of text.matchAll(LIST_RE)) {
    const literals = [m[1], m[2], m[3], m[4]];
    if (isProfileLikeList(literals)) {
      hits.push({ file: rel, line: lineOf(text, m.index), kind: 'list', snippet: m[0].replace(/\s+/g, ' ') });
    }
  }

  for (const o of text.matchAll(OBJECT_RE)) {
    const bound = new Set<string>();
    for (const kv of o[0].matchAll(KEYED_RE)) bound.add(kv[1]);
    if (KEY_SETS.some((keys) => keys.every((k) => bound.has(k)))) {
      hits.push({ file: rel, line: lineOf(text, o.index), kind: 'keyed', snippet: o[0].replace(/\s+/g, ' ').slice(0, 100) });
    }
  }
  return hits;
}

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (full === ALLOWED_DIR) continue;
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (EXTENSIONS.has(full.slice(full.lastIndexOf('.'))) && full !== SELF) yield full;
  }
}

const hits: Hit[] = [];
let scanned = 0;
for (const dir of SCAN_DIRS) {
  for (const file of walk(join(root, dir))) {
    scanned++;
    hits.push(...scan(file, readFileSync(file, 'utf8')));
  }
}

if (hits.length === 0) {
  console.log(`check-no-hardcoded-profiles: ok (${scanned} files scanned, src/study/data excluded)`);
} else {
  console.error(`check-no-hardcoded-profiles: ${hits.length} profile-like tuple(s) outside src/study/data:`);
  for (const h of hits) console.error(`  ${h.file}:${h.line} [${h.kind}] ${h.snippet}`);
  console.error('Import these from src/study/data instead of retyping them.');
  process.exitCode = 1;
}
