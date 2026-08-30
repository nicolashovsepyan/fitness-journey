/* ============================================================
   WHAT THE SURVEY ASKS, AND WHAT EVERY SCREEN THINKS IT ASKED.

   Run:  node tools/check-surveys.mjs

   A question is removed in one file and read in four others, and
   nothing complains. The console goes on printing a row for it
   forever, filled in with the word it uses for "no answer" — so the
   coach reads "Wearable: None" and believes a man answered it.

   That is what happened. The wearable question was cut; a.tracker is
   still read in coach.html and profile.html, and onboarding.html
   still carries the screen that asked it, unreachable. Nobody was
   lying. Everybody was reading a field that stopped existing.

   THE CHECK.

     ASKED    every key the survey actually writes into an answer
     READ     every one of those keys a surface reads back out
     DEAD     read somewhere, asked nowhere        <- the bug
     UNREAD   asked, and nothing looks at it       <- a wasted screen

   Only keys in the survey's own vocabulary are counted, so an
   ordinary `m.name` in three thousand lines of console is not
   mistaken for a survey answer. DEAD fails the run; UNREAD reports
   and does not, because a question may legitimately be asked ahead
   of the screen that will use it.

   A HANDFUL OF KEYS CANNOT BE SPOKEN FOR. `name`, `days`, `length`
   and `style` are survey answers AND ordinary JavaScript property
   names, so "somebody reads it" is always true of them and says
   nothing. They are listed apart rather than silently counted.
   ============================================================ */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './paths.mjs';

const read = f => readFileSync(join(ROOT, f), 'utf8');

/* Prose is not a read. These files explain themselves at length, and a
   comment that says "this used to try A.checkin" would otherwise be
   reported as the very thing it is describing the removal of. Block
   comments go; so do whole-line // comments, which is all of them here —
   a mid-line // is left alone because it is usually https://. */
const code = f => read(f)
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^[ \t]*\/\/.*$/gm, ' ');
const uniq = xs => [...new Set(xs)].sort();
const rx = (s, re) => [...s.matchAll(re)].map(m => m[1]);

/* ---------- ASKED ---------- */
const ON = code('onboarding.html');
/* Three ways a question lands in the answers: a FLOW step naming a key,
   a renderer assigning A.x, and goalone, which picks its key from
   `which` — written out because a regex over `far ? 'horizon' : 'focus'`
   would be a regex over prose. */
const ASKED = uniq([
  ...rx(ON, /\bkey:\s*'([a-zA-Z0-9_]+)'/g),
  ...rx(ON, /\bA\.([a-zA-Z0-9_]+)\s*=[^=]/g),
  ...rx(ON, /\bA\[['"]([a-zA-Z0-9_]+)['"]\]\s*=[^=]/g),
  'horizon', 'focus',
]);

/* ---------- THE FIXTURE ---------- */
/* Top level only. `shape:{now:3}` is one answer, not two, and counting
   the inner key would report `now` as a question nobody asks. */
const body = (code('coach.html').match(/const OZZY_A = \{([\s\S]*?)\n\};/) || [, ''])[1];
const FIXTURE = [];
{
  let depth = 0;
  for (const line of body.split('\n')) {
    for (const m of line.matchAll(/([a-zA-Z0-9_]+)\s*:/g)) {
      if (depth === 0 && line.slice(0, m.index).split('').filter(c => c === '{' || c === '[').length
          === line.slice(0, m.index).split('').filter(c => c === '}' || c === ']').length) FIXTURE.push(m[1]);
    }
    depth += (line.match(/[{[]/g) || []).length - (line.match(/[}\]]/g) || []).length;
  }
}
const FIX = uniq(FIXTURE);

/* ---------- READ ---------- */
const VOCAB = new Set([...ASKED, ...FIX]);
const SURFACES = ['coach.html', 'profile.html', 'dashboard.html'];
const reads = {};
for (const f of SURFACES) {
  const s = code(f);
  reads[f] = uniq([...rx(s, /\b[aA]\.([a-zA-Z0-9_]+)/g),
                   ...rx(s, /\b[aA]\[['"]([a-zA-Z0-9_]+)['"]\]/g)].filter(k => VOCAB.has(k)));
}
const allRead = uniq(SURFACES.flatMap(f => reads[f]));

/* survey answers whose names are also ordinary property names */
const AMBIGUOUS = new Set(['name', 'days', 'length', 'style', 'note', 'levels', 'age', 'sex']);

const DEAD   = allRead.filter(k => !ASKED.includes(k));
const UNREAD = ASKED.filter(k => !allRead.includes(k) && !AMBIGUOUS.has(k));

/* ---------- report ---------- */
const pad = (s, n) => String(s).padEnd(n);
console.log(`\nTHE SURVEY (v6) ASKS ${ASKED.length} THINGS\n`);
console.log('  ' + ASKED.join(' '));

console.log(`\nTHE WORKED EXAMPLE — Ozzy, the client every console starts with`);
const miss = ASKED.filter(k => !FIX.includes(k));
const xtra = FIX.filter(k => !ASKED.includes(k));
console.log(`  answers ${FIX.length} of ${ASKED.length}`);
if (miss.length) console.log(`  never answered ................ ${miss.join(' ')}`);
if (xtra.length) console.log(`  answers questions nobody asks .. ${xtra.join(' ')}`);

console.log(`\nDEAD READS — a screen reads it, the survey never asks it`);
if (!DEAD.length) console.log('  none.');
for (const k of DEAD) console.log(`  ${pad(k, 12)} read by ${SURFACES.filter(f => reads[f].includes(k)).join(', ')}`);

console.log(`\nASKED AND NEVER READ — a screen filled in for nothing`);
console.log(UNREAD.length ? '  ' + UNREAD.join(' ') : '  none.');

console.log(DEAD.length
  ? `\n${DEAD.length} dead read(s). A coach is being shown an answer nobody gave.\n`
  : '\nEvery answer read is an answer asked.\n');
process.exit(DEAD.length ? 1 : 0);
