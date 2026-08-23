/* ============================================================
   BUILD THE CONSOLE'S PROGRAM LIBRARY

   Run:  node tools/build-coach-library.mjs   (after port-programs.mjs)

   Writes `const LIBRARY = {…}` into coach.html from spine/programs/.

   WHY BUILT IN RATHER THAN FETCHED
   Same reason as the movement data: the console has to work opened from
   disk and offline, and a program the coach cannot reach is a program
   nobody is on. The spine files stay the source of truth; this copies
   them in at build time and is overwritten every run.
   ============================================================ */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const p = (...x) => join(ROOT, ...x);

const BEGIN = '/* >>> GENERATED PROGRAM LIBRARY — do not edit by hand.';
const END   = '/* <<< END GENERATED PROGRAM LIBRARY */';

const dir = p('spine/programs');
if (!existsSync(dir)) { console.error('  ! no spine/programs — run port-programs.mjs first'); process.exit(1); }

const lib = {};
for (const f of readdirSync(dir).sort()) {
  if (!f.endsWith('.json') || f === 'index.json') continue;
  const prog = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  lib[prog.id] = prog;
}
if (!Object.keys(lib).length) { console.error('  ! spine/programs is empty'); process.exit(1); }

const block = `${BEGIN}
   Regenerate with:  node tools/port-programs.mjs && node tools/build-coach-library.mjs
   Source of truth:  spine/programs/*.json
   ${Object.keys(lib).length} programs, built ${new Date().toISOString().slice(0, 10)}. */
const LIBRARY = ${JSON.stringify(lib)};
${END}`;

let html = readFileSync(p('coach.html'), 'utf8');
const a = html.indexOf(BEGIN), b = html.indexOf(END);
if (a >= 0 && b > a) {
  html = html.slice(0, a) + block + html.slice(b + END.length);
} else {
  /* first run — sit it just above the program editor's state */
  const anchor = 'let CAT = {};';
  const i = html.indexOf(anchor);
  if (i < 0) { console.error('  ! could not find the program editor in coach.html'); process.exit(1); }
  html = html.slice(0, i) + block + '\n\n' + html.slice(i);
}
writeFileSync(p('coach.html'), html);

console.log('\nCOACH LIBRARY BUILT');
for (const [id, prog] of Object.entries(lib))
  console.log(`  ${id.padEnd(16)} ${Object.keys(prog.days).length} days  ${prog.name} — ${prog.who}`);
console.log('');
