/* ============================================================
   MAKE EVERY LADDER CLIMB, NOT JUST DESCEND

   Run:  node tools/link-progressions.mjs [--write]

   `easier` and `harder` are meant to be the two directions of one
   relationship. In practice only one of them was ever filled in.
   Ninety-odd movements name what comes before them; almost none name
   what comes after. So the front lever chain reads all the way down to
   a band and stops dead going up, and the whole planche family — twelve
   movements, carefully ordered by difficulty — has not one `harder`
   link in it.

   That is not a cosmetic gap. The console offers the rungs either side
   of a movement when you swap it, and "show me the next step up" is the
   single most useful thing an intermediate person asks of a database.
   Half of that feature has been returning nothing.

   THE REPAIR IS THE INVERSE, AND ONLY THE INVERSE. If X says its easier
   is Y, then Y's harder is X. Nothing is invented: every link written
   here already exists in the file, pointing the other way.

   TWO THINGS IT WILL NOT DO.

   An existing `harder` is never overwritten. Somebody chose it, and a
   derived link is not evidence they were wrong.

   Where several movements claim the same one as their `easier` — five
   different planche steps all sit on top of the lean — the next rung is
   the one with the lowest `diff`, because that is what "next" means. The
   others are reported, not silently dropped: a fork in a ladder is a
   real thing and the database should say so out loud.
   ============================================================ */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const WRITE = process.argv.includes('--write');
const FILE = join(ROOT, 'js/data/exercises.js');
const { EXERCISES } = await import(pathToFileURL(FILE).href);

/* who claims each movement as their easier step */
const claims = {};
for (const [id, m] of Object.entries(EXERCISES)) {
  const e = m.easier;
  if (!e || !EXERCISES[e]) continue;
  (claims[e] ??= []).push(id);
}

const add = [], forks = [], kept = [];
for (const [target, wanters] of Object.entries(claims)) {
  if (EXERCISES[target].harder) {
    if (!wanters.includes(EXERCISES[target].harder)) kept.push([target, EXERCISES[target].harder, wanters]);
    continue;
  }
  const sorted = wanters.slice().sort((a, b) =>
    (EXERCISES[a].diff ?? 99) - (EXERCISES[b].diff ?? 99) || a.localeCompare(b));
  add.push([target, sorted[0]]);
  if (sorted.length > 1) forks.push([target, sorted]);
}

const nm = id => (EXERCISES[id] && EXERCISES[id].name) || id;
console.log(`\n${add.length} ladder(s) can now be climbed as well as descended\n`);
for (const [t, h] of add) console.log(`  ${nm(t).padEnd(30)} -> ${nm(h)}`);

if (forks.length) {
  console.log(`\nFORKS — more than one next step; the easiest was taken`);
  for (const [t, xs] of forks)
    console.log(`  ${nm(t).padEnd(30)} ${xs.map(x => `${nm(x)}(${EXERCISES[x].diff ?? '?'})`).join('  ')}`);
}
if (kept.length) {
  console.log(`\nLEFT ALONE — a harder link already chosen by hand`);
  for (const [t, h] of kept) console.log(`  ${nm(t).padEnd(30)} keeps ${nm(h)}`);
}

if (!WRITE) { console.log(`\n  dry run. Add --write to apply.\n`); process.exit(0); }

let src = readFileSync(FILE, 'utf8'), done = 0;
for (const [target, harder] of add) {
  /* insert `harder:` right after the id opens its object — the same
     shape every other field is written in, so the file stays readable */
  const re = new RegExp(`(\\n  ${target}: \\{ )`);
  if (!re.test(src)) { console.log(`  ! could not place ${target}`); continue; }
  src = src.replace(re, `$1harder: '${harder}', `);
  done++;
}
writeFileSync(FILE, src);
console.log(`\n  wrote ${done} link(s) into js/data/exercises.js\n`);
