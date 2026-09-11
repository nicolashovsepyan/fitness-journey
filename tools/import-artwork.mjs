/* ============================================================
   BRING A BATCH OF ILLUSTRATIONS IN

   Run:  node tools/import-artwork.mjs [--write] [zip name]

   Nicolas drops an approved export into the photo library as a zip and
   the pictures have to end up at images/exercises/<movement id>.png,
   because that is the one place build-spine.mjs looks to decide a
   movement has artwork.

   TWO THINGS STAND BETWEEN THE ZIP AND THAT FOLDER.

   THE NAMES ARE NOT IDS. They are human, ordered, and sometimes carry
   the number from a working list: "09_067_diamond_push_up_kettlebell".
   The leading indexes are stripped and what is left is matched against
   the database by id and then by name. Anything still unmatched is
   REPORTED AND SKIPPED, never guessed — a picture filed under the wrong
   movement is worse than no picture, because nothing downstream will
   ever question it.

   THEY ARE THE WRONG SIZE. The batch runs 1254 to 1692 pixels and up to
   1.6 MB each; everything already in images/exercises is 460px and 15 to
   40 KB. Copying them in would put fifteen megabytes into a repository
   that is served to phones, to be drawn at 86 pixels. They are resized
   on the way in.

   ONE THING THIS DOES NOT DO. sips resizes but cannot quantise, so the
   imported PNGs land as 8-bit RGBA at roughly 110 KB while the older
   illustrations are 8-bit palette at 20 to 40 KB. Three times the bytes
   for the same picture. It is not worth a dependency for a file the app
   draws one at a time, but if the set is ever tidied, `pngquant 256` over
   images/exercises is the whole job.

   Nothing is written without --write.
   ============================================================ */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { ROOT, artwork } from './paths.mjs';

const WRITE = process.argv.includes('--write');
const argZip = process.argv.slice(2).find(a => !a.startsWith('--'));
const OUT = join(ROOT, 'images/exercises');
const EDGE = 460;                       /* what every existing illustration is */

/* Names the stripper cannot reach on its own. Each is a judgement about
   which movement a picture shows, so each is written down rather than
   inferred at run time. */
const ALIAS = {
  l_sit_hold:                   'l_sit',
  push_up_on_rings:             'ring_push_up',
  band_assisted_pull_up:        'band_assisted_pullup',
  high_pull_up:                 'high_pullup',
  hollow_hold_heels_down:       'hollow_heels_down',
  diamond_push_up_kettlebell:   'diamond_push_up_on_kettlebell',
  band_assisted_front_lever:    'band_front_lever',
};

const cat = JSON.parse(readFileSync(join(ROOT, 'spine/catalog.json'), 'utf8')).movements;
const byNorm = {};
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
for (const [id, m] of Object.entries(cat)) { byNorm[norm(id)] = id; byNorm[norm(m.name)] = id; }

const lib = artwork();
const zips = readdirSync(lib).filter(f => f.toLowerCase().endsWith('.zip'));
const zipName = argZip || zips.sort((a, b) =>
  statSync(join(lib, b)).mtimeMs - statSync(join(lib, a)).mtimeMs)[0];
if (!zipName) { console.error('\n  no zip in ' + lib + '\n'); process.exit(1); }
const zipPath = join(lib, zipName);
console.log(`\n${zipName}`);

/* unzip to a scratch dir rather than reading the archive in JS — the
   pictures have to hit disk anyway for sips to resize them */
const work = join(tmpdir(), 'fj-art-' + Date.now());
mkdirSync(work, { recursive: true });
execFileSync('unzip', ['-qq', '-o', zipPath, '-d', work]);

const files = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) { if (f !== '__MACOSX') walk(p); }
    else if (/\.png$/i.test(f) && !f.startsWith('.')) files.push(p);
  }
})(work);

const matched = [], unmatched = [];
for (const f of files.sort()) {
  const base = f.split('/').pop().replace(/\.png$/i, '');
  /* strip any number of leading "NN_" groups: 09_067_diamond… */
  const stem = base.replace(/^(\d+[_-])+/, '');
  const id = ALIAS[stem] || byNorm[norm(stem)];
  (id ? matched : unmatched).push({ f, base, stem, id });
}

const px = f => { const d = readFileSync(f); return [d.readUInt32BE(16), d.readUInt32BE(20)]; };
let wrote = 0, bytesIn = 0, bytesOut = 0;
for (const m of matched) {
  const [w, h] = px(m.f);
  const dest = join(OUT, m.id + '.png');
  const had = existsSync(dest);
  bytesIn += statSync(m.f).size;
  if (WRITE) {
    execFileSync('sips', ['--resampleHeightWidthMax', String(EDGE), m.f, '--out', dest], { stdio: 'ignore' });
    bytesOut += statSync(dest).size;
    wrote++;
  }
  console.log(`  ${m.id.padEnd(30)} ${String(w + 'x' + h).padEnd(11)} ${had ? 'replaces existing' : 'new'}`);
}

if (unmatched.length) {
  console.log(`\n  ${unmatched.length} NOT MATCHED TO A MOVEMENT — skipped, not guessed:`);
  for (const u of unmatched) console.log(`    ${u.base}   (looked for "${u.stem}")`);
  console.log('    Add an entry to ALIAS in this file, or the movement to js/data/exercises.js.');
}

console.log(`\n  ${matched.length} matched, ${unmatched.length} skipped`);
if (WRITE) {
  console.log(`  ${wrote} written at ${EDGE}px — ${(bytesIn / 1048576).toFixed(1)} MB in, ${(bytesOut / 1024).toFixed(0)} KB out`);
  console.log('  run build-spine.mjs next so the catalog knows about them.\n');
} else {
  console.log('  dry run. Add --write to import.\n');
}
