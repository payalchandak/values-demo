// Node runner for src/study/verify.ts. Run from the repo root:
//   node scripts/verify.ts
// (Node >= 22.18 strips TypeScript types natively.)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { verify } from '../src/study/verify.ts';
import type { DecisionCounts, Table8Targets } from '../src/study/verify.ts';
import type { Profile, StudyCase } from '../src/study/types.ts';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'study', 'data');
const load = <T>(name: string): T => JSON.parse(readFileSync(join(dataDir, name), 'utf8')) as T;

const cases = load<StudyCase[]>('cases.json');
const profiles = load<Profile[]>('profiles.json');
const decisions = load<DecisionCounts>('decisions.json');
const table8 = load<Table8Targets>('table8.json');

const { checks, integrity } = verify(cases, decisions, profiles, table8);
const f = (x: number) => x.toFixed(3);

console.log(`cases=${cases.length} profiles=${profiles.length} (models=${profiles.filter((p) => p.kind === 'model').length}, physicians=${profiles.filter((p) => p.kind === 'physician').length}, pooled=${profiles.filter((p) => p.kind === 'pooled-physician').length})`);
console.log(`integrity problems: ${integrity.length}`);
integrity.forEach((m) => console.log('  ' + m));

console.log('\nTable 8 targets (A,B,N,J): refit via softmax(w/0.262)');
for (const c of checks.filter((c) => c.target)) {
  const t = c.target!;
  console.log(
    `${c.displayName.padEnd(18)} refit ${f(c.refit.A)} ${f(c.refit.B)} ${f(c.refit.N)} ${f(c.refit.J)} | target ${f(t.A)} ${f(t.B)} ${f(t.N)} ${f(t.J)} | max|err| ${c.targetMaxAbsError!.toFixed(5)}`,
  );
}

console.log('\nAll decision makers: TS refit vs stored profile');
let worstW = 0;
let worstP = 0;
for (const c of checks) {
  worstW = Math.max(worstW, c.weightDiff);
  worstP = Math.max(worstP, c.priorityDiff);
  console.log(`${c.key.padEnd(10)} converged=${c.fitConverged} max|dw|=${c.weightDiff.toExponential(2)} max|dpriority|=${c.priorityDiff.toExponential(2)}`);
}
console.log(`\nworst |dw|=${worstW.toExponential(2)} worst |dpriority|=${worstP.toExponential(2)}`);
if (integrity.length || checks.some((c) => !c.fitConverged) || worstW > 1e-6) process.exitCode = 1;
