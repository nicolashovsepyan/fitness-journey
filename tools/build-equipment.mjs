/* ============================================================
   BUILD EQUIPMENT — push the weight gauges into every page that draws one.

   Run:  node tools/build-equipment.mjs [--check]

   logo/equipment.mjs is the only place the renderer, the locked settings,
   the palette and the gaugeFor() resolver exist. The pages that draw a gauge
   load no external scripts — onboarding.html, dashboard.html and coach.html
   are single-file builds, grep them for `<script src=` and you get nothing —
   so a runtime import is not available. Each page carries a GENERATED copy
   between markers, and this is the only thing allowed to write it.

   Modelled on tools/build-logo.mjs, including the refusals. Same reason:
   this project has twice shipped two copies of one thing that quietly
   disagreed — the app icon that lost its pink, and the animation CSS that
   was updated in one file and not the other while looking fine in both.

   --check reports drift, writes nothing, and exits non-zero. Run it BEFORE
   touching a gauge: a failure means someone hand-edited a generated block
   and that has to be reconciled first.

   After a real build, run node build-sw.mjs so the service worker picks up
   the changed files.
   ============================================================ */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT  = fileURLToPath(new URL('..', import.meta.url));
const SRC   = join(ROOT, 'logo/equipment.mjs');
const CHECK = process.argv.includes('--check');

const OPEN  = '/* ===== EQUIP:JS — generated from logo/equipment.mjs, do not edit here ===== */';
const CLOSE = '/* ===== /EQUIP:JS ===== */';

/* Every page that draws a gauge. GREPPED, NOT ASSUMED.
   The brief expected dashboard.html and coach.html to be here. They are not:
   coach.html's every mention of "weight" is font-weight, and dashboard.html's
   weight entry is a bathroom-scale reading with no per-exercise load anywhere
   in it. Neither ever calls a scene function, and 46 KB of renderer in a page
   that never draws one is the same dead weight this project spent a whole
   pass removing from the survey.

   Add them the day they draw a gauge — one line each, and the build refuses
   on a missing marker so it cannot be half-done.

   The lab is in this list on purpose: it is where the design gets tuned, so
   it is the last file that may be allowed to drift from the source. */
const CONSUMERS = [
  'logo/DUMBBELL.html',
  'onboarding.html',
];

/* ---- ESM out, plain script in ----
   The module is ESM so it can be imported by node (the tools read it, and
   the resolver is unit-testable). The pages need a classic script. Rather
   than maintain two hand-written dialects, the export keywords are stripped
   on the way in — one dialect, mechanically converted. */
/* EVERY PUBLIC NAME, COLLECTED FROM THE MODULE'S OWN EXPORTS.
   Read rather than listed, so adding an export to the module is enough. */
function publicNames(src) {
  const named = [...src.matchAll(/^\s*export\s+(?:var|let|const|function)\s+([A-Za-z_$][\w$]*)/gm)]
    .map(m => m[1]);
  const listed = [...src.matchAll(/^\s*export\s*\{([^}]*)\}/gm)]
    .flatMap(m => m[1].split(',').map(x => x.trim().split(/\s+as\s+/).pop()).filter(Boolean));
  return [...new Set([...named, ...listed])].sort();
}

/* THE BLOCK IS WRAPPED, AND THAT IS NOT COSMETIC.
   The renderer declares STEP, MAXW, PLATE, GRIP and a dozen more at the top
   level. Injected bare into onboarding.html it collided with the survey's own
   STEP and the whole page died on load with "Identifier 'STEP' has already
   been declared" — the gauge nowhere near the stack trace.

   So the generated block is one IIFE assigned to EQUIP. Nothing leaks, call
   sites read EQUIP.gaugeSVG(...), and a future name clash is impossible
   rather than merely unlikely. */
function toPlainScript(src) {
  const body = src
    /* `export { a, b, c };` — a re-export list, drop the statement entirely */
    .replace(/^\s*export\s*\{[^}]*\}\s*;?\s*$/gm, '')
    /* `export var X = …`, `export function f(…)` — drop the keyword only */
    .replace(/^\s*export\s+(?=(var|let|const|function)\b)/gm, '')
    .replace(/\s*$/, '');
  const names = publicNames(src);
  return 'var EQUIP = (function(){\n' + body +
         '\n\nreturn { ' + names.join(', ') + ' };\n})();';
}

const source = readFileSync(SRC, 'utf8');
const wanted = '\n' + toPlainScript(source) + '\n';

/* A generated block that still contains `export` would be a syntax error in
   a classic script, and the page would die on load with the gauge nowhere
   near the stack trace. Cheaper to catch here. */
if (/^\s*export\b/m.test(wanted)) {
  console.error('\n  STRIP FAILED: an `export` survived into the generated block.');
  console.error('  logo/equipment.mjs uses an export form this script does not know.\n');
  process.exit(1);
}

/* ============================================================
   THE GAUGE ISLAND

   gaugeFor() takes a DATABASE ROW, and the survey is a single file that
   cannot read the database at runtime. So the resolver is run HERE, over the
   real rows, and its answers are written into onboarding.html as a JSON
   island keyed by the deck's own ids.

   The rule still lives in exactly one place — this is its output, not a
   second copy of it. Same relationship the app icon has to logo/mark.mjs.

   DECK_DB is the only hand-maintained part: the deck's ids are its own
   vocabulary and always have been (recorded in DECK_TO_CANONICAL in
   js/core/schema.js). A deck rung naming a movement the database does not
   have is reported rather than skipped. */
const DECK_DB = {
  squat:'back_squat',   goblet:'goblet_squat',  dead:'deadlift',
  dbrdl:'db_rdl',       splitld:'bulgarian_split', bench:'bench_press',
  dbpress:'db_rdl',     ohp:'overhead_press',   dbohp:'db_rdl',
  row:'bent_over_row',  dbrow:'single_arm_row', kbswing:'kb_swing',
  carry:'farmers_carry',
};

const DERIVED = join(ROOT, 'EXERCISE DATABASE/workbook/_derived.json');
let island = null, gapNote = [];
if (existsSync(DERIVED)) {
  const raw = JSON.parse(readFileSync(DERIVED, 'utf8'));
  const rows = Array.isArray(raw) ? raw : (raw.rows || Object.values(raw)[0]);
  const byId = new Map(rows.map(r => [r.id, r]));
  const { gaugeFor } = await import(new URL('../logo/equipment.mjs', import.meta.url).href);

  const out = {};
  for (const [deckId, dbId] of Object.entries(DECK_DB)) {
    const row = byId.get(dbId);
    if (!row) { gapNote.push(`${deckId} -> ${dbId} (not in the database)`); continue; }
    const g = gaugeFor(row);
    out[deckId] = g;
    if (g.kind === 'none') gapNote.push(`${deckId} -> ${dbId}: ${g.why}`);
  }
  island = JSON.stringify(out);
}

let drift = 0, changed = 0, missing = 0;

for (const rel of CONSUMERS) {
  const path = join(ROOT, rel);
  if (!existsSync(path)) { console.log(`  ${rel}: not present, skipped`); continue; }

  let page = readFileSync(path, 'utf8');
  const i = page.indexOf(OPEN);
  const j = page.indexOf(CLOSE);

  if (i < 0 || j < 0 || j < i) {
    console.error(`  ${rel}: MARKER MISSING`);
    missing++;
    continue;
  }

  const current = page.slice(i + OPEN.length, j);
  if (current === wanted) { console.log(`  ${rel}: already in step`); continue; }

  drift++;
  if (CHECK) {
    console.log(`  ${rel}: DIFFERS — ${current.length} bytes in the page, ${wanted.length} in the source`);
    continue;
  }

  const before = page.length;
  const firstFill = current.trim() === '';
  page = page.slice(0, i + OPEN.length) + wanted + page.slice(j);

  /* The seat belt. A legitimate change to the renderer moves kilobytes; a
     bad slice into a one-megabyte single-file app moves a third of it, and
     that is not something to find out about after deploying.

     It does NOT apply to a first fill, where the block is empty and the
     change is by definition the whole size of the renderer. It fired on
     exactly that the first time this ran, which is the guard being right
     about the arithmetic and wrong about the intent: the danger is a block
     that HELD something being replaced by something wildly different. */
  const ratio = Math.abs(page.length - before) / before;
  if (!firstFill && ratio > 0.33) {
    console.error(`\n  REFUSING on ${rel}: that would change the file by ${(ratio * 100).toFixed(0)}%.`);
    console.error(`  ${(before / 1024).toFixed(0)} KB -> ${(page.length / 1024).toFixed(0)} KB. Nothing written.\n`);
    process.exit(1);
  }

  writeFileSync(path, page);
  changed++;
  console.log(`  ${rel}: ${firstFill ? 'installed' : 'updated '}  ${(before / 1024).toFixed(0)} KB -> ${(page.length / 1024).toFixed(0)} KB`);
}

/* the island rides along with the block, into the one page that has a deck */
if (island !== null) {
  const path = join(ROOT, 'onboarding.html');
  let page = readFileSync(path, 'utf8');
  const tag = '<script type="application/json" id="gauges">';
  const re = /<script type="application\/json" id="gauges">[\s\S]*?<\/script>/;
  const block = tag + island + '<\/script>';
  const has = re.test(page);
  const next = has ? page.replace(re, block)
    : page.replace(/<script type="application\/json" id="benchmarks">/, block + '\n' + '<script type="application/json" id="benchmarks">');
  if (next === page) {
    console.log('  gauge island: already in step');
  } else if (CHECK) {
    console.log('  gauge island: DIFFERS'); drift++;
  } else {
    writeFileSync(path, next); changed++;
    console.log(`  gauge island: written (${Object.keys(JSON.parse(island)).length} deck movements)`);
  }
  if (gapNote.length) {
    console.log('\n  deck movements with no gauge:');
    for (const g of gapNote) console.log('    ' + g);
  }
}

if (missing) {
  console.error(`\n  ${missing} consumer(s) have no EQUIP:JS marker. Add:\n`);
  console.error(`    ${OPEN}`);
  console.error(`    ${CLOSE}\n`);
  process.exit(1);
}

if (CHECK) {
  console.log(drift
    ? `\n${drift} consumer(s) out of step with logo/equipment.mjs. Reconcile before working on the gauges.\n`
    : '\nlogo/equipment.mjs and every consumer agree.\n');
  process.exitCode = drift ? 1 : 0;
} else if (changed) {
  console.log(`\n${changed} file(s) written. Re-run node build-sw.mjs before deploying.\n`);
} else {
  console.log('\nNothing to do.\n');
}
