#!/usr/bin/env node
/* ============================================================
   ONE COMMAND. Run:  node tools/check-all.mjs

   Every test and every check in the repository, in one place, with a
   single line at the end that is either green or not.

   WHY THIS EXISTS. There were eleven of these and no list of them.
   A check nobody can remember to run is a check that does not run,
   and a suite that has to be recited from memory grows holes exactly
   where the memory does — which is at the newest file, which is the
   one most likely to be wrong.

   Anything added to test/ ending .test.mjs is picked up on its own.
   The tools are named because they are not all checks; the ones that
   BUILD something do not belong in a run that must not change a file.
   ============================================================ */
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/* Checks, not builds. A build writes files; running one here would
   mean this command could not be trusted on a dirty tree. */
const CHECKS = [
  ['tools/check-wiring.mjs', 'fields written by one layer and read by none'],
  ['tools/check-sql.mjs', 'the SQL editor can actually swallow these files'],
  ['tools/check-surveys.mjs', 'the survey asks what the console reads'],
  ['tools/check-demands.mjs', 'no movement is missing an injury tag its family carries'],
  ['tools/check-lab.mjs', 'the lab is the current dashboard, not last week'],
];

const tests = readdirSync(join(root, 'test'))
  .filter(f => f.endsWith('.test.mjs')).sort()
  .map(f => [`test/${f}`, null]);

let bad = 0, skipped = 0;
for (const [file, why] of [...tests, ...CHECKS]) {
  const r = spawnSync(process.execPath, [file], { cwd: root, encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  const skip = /^\s*SKIPPED/m.test(out);
  const ok = r.status === 0 && !/\bFAIL\b/.test(out);
  if (skip) skipped++;
  if (!ok) bad++;
  console.log(`${ok ? (skip ? 'skip' : ' ok ') : 'FAIL'}  ${file}${why ? `  — ${why}` : ''}`);
  if (!ok) console.log(out.split('\n').filter(l => /FAIL|Error/.test(l)).slice(0, 8)
    .map(l => '        ' + l.trim()).join('\n'));
}

console.log(bad
  ? `\n${bad} FAILING. Nothing ships on this.`
  : `\nAll green${skipped ? ` (${skipped} skipped for want of a live project)` : ''}.`);
process.exit(bad ? 1 : 0);
