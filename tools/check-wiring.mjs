/* ============================================================
   FIELDS THAT GO NOWHERE.

   Run:  node tools/check-wiring.mjs

   Every bug worth the name in this project has had the same shape. Not a
   crash — a FIELD THAT STOPS BEING READ:

     the porter copied movements and not `format`, `rounds`, `rest`, `pair`
     the survey dropped `tracker` and four screens went on printing it
     the console wrote `cfg.off` and the runner looked for `b.rest`
     rest was written into a note, where nothing reads notes
     the picker was wired to a handler that wanted `data-f`

   None of them threw. Every one of them produced a plausible number,
   because the layer downstream had a default for exactly the thing it was
   no longer being told. A missing field and a field that happens to equal
   the default are indistinguishable from the outside — which is why these
   survive for weeks and why they need a tool rather than an eye.

   THE CHECK. A program travels through four surfaces:

     coach.html          writes it
     js/core/current.js  translates it into the app's shape
     js/core/resolve.js  hands one day to the runner
     js/runner/*.js      runs it

   For each field, this asks the only question that matters: is there a
   surface that WRITES it and no surface that READS it, or one that reads
   it and none that writes it? The first is a control that does nothing.
   The second is a display that is always empty.

   IT REPORTS, IT DOES NOT FAIL. A field can be written today for a reader
   arriving next week, and a check that blocks that is a check people
   switch off. It prints a list; the list is meant to be read.
   ============================================================ */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './paths.mjs';

const read = f => readFileSync(join(ROOT, f), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')        /* prose is not a read */
  .replace(/^[ \t]*\/\/.*$/gm, ' ');

/* The vocabulary. Only fields that actually appear on a block or an item
   in a real program file — otherwise every local variable in four large
   files becomes a finding. */
const VOCAB = { block: new Set(), item: new Set() };
for (const f of ['fundamentals', 'levers_and_lifts', 'main', 'beginner_return',
                 'back_to_basics_1', 'back_to_basics_2', 'back_to_basics_3']) {
  let prog;
  try { prog = JSON.parse(readFileSync(join(ROOT, 'spine/programs', f + '.json'), 'utf8')); }
  catch { continue; }
  for (const day of Object.values(prog.days || {}))
    for (const b of day.blocks || []) {
      Object.keys(b).forEach(k => VOCAB.block.add(k));
      Object.keys(b.cfg || {}).forEach(k => VOCAB.block.add(k));
      for (const it of b.items || []) Object.keys(it).forEach(k => VOCAB.item.add(k));
    }
}
/* the console can write these even where no committed program has one yet */
['weight', 'tempo', 'plan', 'sg', 'rest'].forEach(k => VOCAB.item.add(k));
/* AND FIELDS THE RUNNER READS THAT MAY HAVE VANISHED FROM THE DATA
   ENTIRELY. The vocabulary above comes from committed programs, so a
   field that stopped being written everywhere is invisible to it — which
   is the exact failure this tool exists to catch, one level up. These are
   named by hand from what the runner asks for. */
['pair', 'subs', 'cue', 'zone', 'toFailure', 'warmups'].forEach(k => VOCAB.item.add(k));
['roundRest', 'minutes', 'work', 'transition'].forEach(k => VOCAB.block.add(k));

/* DELIBERATE TRANSLATIONS. js/core/current.js renames some of the
   console's words on the way through, because the two sides genuinely
   call the same idea different things. Those are not orphans and saying
   so keeps this list worth reading — but they are declared HERE, by hand,
   so that deleting the translation makes them orphans again rather than
   quietly staying invisible. */
const TRANSLATED = {
  cap:      'minutes  (AMRAP)',
  interval: 'work     (EMOM)',
  mins:     'rounds   (EMOM)',
  off:      'rest     (Tabata)',
  sg:       'pair     (A1, A2, B1 …)',
};
const TRANSLATED_TO = new Set(['minutes', 'roundRest', 'work', 'rest', 'rounds', 'pair']);

const SURFACES = [
  ['coach.html',            'coach.html'],
  ['js/core/current.js',    'current'],
  ['js/core/resolve.js',    'resolve'],
  ['js/program-adapter.js', 'adapter'],
  ['js/runner/workmode.js', 'runner'],
  ['js/screens/day.js',     'day screen'],
  ['js/screens/b-day.js',   'beginner day'],
];

/* `x.field` on any of the usual carriers, and `field:` in an object it
   builds. Deliberately loose on the carrier name — the four files call
   the same object `b`, `nb`, `block`, `it`, `item`, `o` and `r`. */
const CARRY = '(?:b|nb|block|it|item|o|r|st|si)';
function readsOf(src) {
  const got = new Set();
  for (const m of src.matchAll(new RegExp(`\\b${CARRY}\\.([a-zA-Z_][a-zA-Z0-9_]*)`, 'g'))) got.add(m[1]);
  for (const m of src.matchAll(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g)) got.add(m[1]);
  return got;
}

const seen = {};
for (const [file, label] of SURFACES) {
  let src; try { src = read(file); } catch { continue; }
  seen[label] = readsOf(src);
}

function report(kind, vocab) {
  const rows = [];
  for (const field of [...vocab].sort()) {
    const where = Object.entries(seen).filter(([, s]) => s.has(field)).map(([l]) => l);
    rows.push([field, where]);
  }
  console.log(`\n${kind.toUpperCase()} FIELDS — where each one is known\n`);
  const orphans = [];
  for (const [field, where] of rows) {
    const console_ = where.includes('coach.html');
    const app = where.some(w => w !== 'coach.html');
    const flag = TRANSLATED[field] ? `  -> travels as ${TRANSLATED[field]}`
               : console_ && !app ? '  <- the console writes it and nothing downstream reads it'
               : !console_ && app && !TRANSLATED_TO.has(field)
                 ? '  <- read downstream, never written by the console'
               : !console_ && app ? '  <- arrives by translation'
               : '';
    if (flag.includes('<-') && !flag.includes('translation')) orphans.push([field, flag.trim()]);
    console.log(`  ${field.padEnd(14)} ${where.join(', ').padEnd(52)}${flag}`);
  }
  return orphans;
}

const o1 = report('block', VOCAB.block);
const o2 = report('item', VOCAB.item);

console.log('\n' + '-'.repeat(74));
const all = [...o1, ...o2];
if (!all.length) {
  console.log('\nEvery field is written somewhere and read somewhere.\n');
} else {
  console.log(`\n${all.length} field(s) worth a look:\n`);
  for (const [f, why] of all) console.log(`  ${f.padEnd(14)} ${why}`);
  console.log('\nNot every one is a bug — a field can be written for a reader that');
  console.log('does not exist yet. But every one of them is a question.\n');
}
