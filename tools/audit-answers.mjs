#!/usr/bin/env node
/* ANSWER AUDIT — does every question earn its place?
   A survey question that nothing downstream reads is a question that wastes
   somebody's time. A field the dashboard reads but the survey never writes
   is a silent default nobody chose. Both are bugs; only one of them ever
   shows up on screen.

   Walks: onboarding writes A.x -> profile -> dashboard reads A.x -> coach. */
import { readFileSync } from 'node:fs';

const onb  = readFileSync('onboarding.html', 'utf8');
const dash = readFileSync('dashboard.html', 'utf8');
const coach= readFileSync('coach.html', 'utf8');

const WRITE = /A\.([a-zA-Z_][\w]*)\s*=(?!=)/g;      /* A.x = …  */
const READ  = /A\.([a-zA-Z_][\w]*)/g;               /* any A.x   */

const set = (src, re) => {
  const out = new Set(); let m;
  while ((m = re.exec(src))) out.add(m[1]);
  return out;
};

/* Most answers are stored generically as A[s.key] = value from the step
   definition, so a regex looking only for `A.x =` reports half the survey
   as missing. The step keys count as writes. */
const stepKeys = set(onb, /key:\s*'([a-zA-Z_][\w]*)'/g);
const written = new Set([...set(onb, new RegExp(WRITE)), ...stepKeys]);
const readOnb = set(onb, new RegExp(READ));
const readDash= set(dash, new RegExp(READ));
const readCo  = set(coach, new RegExp(READ));

/* the demo profile in the dashboard declares the shape it expects */
const demoBlock = dash.slice(dash.indexOf('const DEMO = {'), dash.indexOf('const LOADED'));
const demoKeys = set(demoBlock, /([a-zA-Z_][\w]*)\s*:/g);

const pad = s => s.padEnd(16);
const line = (a,b) => console.log(`    ${pad(a)} ${b}`);

console.log('\n  COLLECTED BY THE SURVEY, NEVER READ BY THE APP');
console.log('  (each of these is a question somebody answered for nothing)\n');
const orphans = [...written].filter(k => !readDash.has(k) && !readCo.has(k)).sort();
orphans.forEach(k => line('A.' + k, ''));
if (!orphans.length) console.log('    none');

console.log('\n  READ BY THE APP, NEVER WRITTEN BY THE SURVEY');
console.log('  (each of these is a silent default nobody chose)\n');
const ghosts = [...readDash].filter(k => !written.has(k)).sort();
ghosts.forEach(k => line('A.' + k, demoKeys.has(k) ? '— has a demo fallback' : '— NO fallback'));
if (!ghosts.length) console.log('    none');

console.log('\n  USED BY THE COACH CONSOLE\n');
console.log('    ' + [...readCo].sort().map(k => 'A.' + k).join(', '));

console.log(`\n  survey writes ${written.size} · dashboard reads ${readDash.size}` +
            ` · orphaned ${orphans.length} · unbacked ${ghosts.length}\n`);
