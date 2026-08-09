/* ============================================================
   BUILD BENCHMARKS — put the level thresholds into the survey.

   Run:  node tools/build-benchmarks.mjs ["<_system folder>"]

   Reads BENCHMARK_M.csv and BENCHMARK_F.csv — the files Nicolas
   maintains by hand — and writes the twenty-two deck movements into a
   <script id="benchmarks"> island in onboarding.html.

   This is the whole point of the slider: someone dragging it does not
   have to know whether forty push-ups is good. The slider tells them,
   using these numbers, as they pass each threshold.

   Re-run it after editing either CSV. The survey is self-contained —
   it cannot read a file at runtime — so the table has to be baked in.

   THREE KINDS OF MEASUREMENT, because one question does not fit:
     REPS    how many, in one honest set
     HOLD    how long, in seconds
     WEIGHT  how heavy, as a multiple of bodyweight (xBW)

   The weight rows are stored as multiples so they work for any body.
   The survey turns them into real kilos or pounds using the weight the
   person already gave in Chapter 1.
   ============================================================ */
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/* Find a folder by name, tolerating a leading/trailing space or different
   case. Both "EXERCISE LIBRARY" and "FOR NICOLAS" turned up one day renamed
   to " EXERCISE LIBRARY" and " FOR NICOLAS" — a space in front sorts them to
   the top of Finder, which is a perfectly reasonable thing to want and used
   to break every script here with ENOENT. */
function resolveDir(parent, wanted) {
  const want = wanted.trim().toLowerCase();
  const exact = join(parent, wanted);
  try { if (statSync(exact).isDirectory()) return exact; } catch {}
  for (const name of readdirSync(parent)) {
    if (name.trim().toLowerCase() !== want) continue;
    const full = join(parent, name);
    try { if (statSync(full).isDirectory()) return full; } catch {}
  }
  return exact;   // let the caller fail with a clear path
}
/* Lives in "FOR NICOLAS" — the one folder he owns and edits. */
const SYS = process.argv[2] || resolveDir(ROOT, 'FOR NICOLAS');
const PAGE = join(ROOT, 'onboarding.html');

/* deck id -> the Exercise column in the CSVs */
const MAP = {
  pushup:   'Push-Up',              bwsquat: 'Squat',
  lunge:    'Bulgarian Split Squat', jumpsquat: 'Jump Squat',
  slrdl:    'Single-Leg RDL',       pullup:  'Pull-Up',
  invrow:   'Australian Pull-Up',   pike:    'Pike Push-Up',
  mtnclimb: 'Mountain Climber',     wallsit: 'Wall Sit',
  plank:    'Plank',                hang:    'Dead Hang',
  squat:    'Back Squat',           dead:    'Deadlift',
  rdl:      'Romanian Deadlift',    bench:   'Bench Press',
  ohp:      'Overhead Press',       row:     'Bent-Over Row',
  thrust:   'Hip Thrust (Barbell)', carry:   'Farmer Carry',
  kbswing:  'Kettlebell Swing',     split:   'Bulgarian Split Squat (Loaded)',
};

/* Minimal CSV reader. These files are hand-edited, so a value may well
   arrive wrapped in quotes or padded with spaces. */
function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift().map(h => h.trim());
  return rows.filter(r => r.length > 1 && r.some(x => x.trim()))
             .map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}

function load(sex) {
  const named = { M: 'BENCHMARKS - Male.csv', F: 'BENCHMARKS - Female.csv' }[sex];
  const file = join(SYS, named);
  if (!existsSync(file)) { console.error(`Not found: ${file}`); process.exit(1); }
  const byName = new Map();
  for (const r of parseCSV(readFileSync(file, 'utf8'))) byName.set(r.Exercise, r);
  return byName;
}

const M = load('M'), F = load('F');
const out = {};
const missing = [];

for (const [deckId, name] of Object.entries(MAP)) {
  const m = M.get(name), f = F.get(name);
  if (!m || !f) { missing.push(`${deckId} -> "${name}"`); continue; }
  const nums = r => [r.Beg, r.Int, r.Adv, r.Elite].map(Number);
  if (nums(m).some(Number.isNaN) || nums(f).some(Number.isNaN)) {
    missing.push(`${deckId} -> "${name}" (non-numeric level)`); continue;
  }
  out[deckId] = {
    mech: m.Mech,                       // REPS | HOLD | WEIGHT
    unit: m.Unit,                       // reps | reps_per_side | secs | xBW | xBW_total
    m: nums(m),
    f: nums(f),
    std: m.MovementStandard || '',
  };
}

if (missing.length) {
  console.error('\nNo benchmark row for:');
  for (const x of missing) console.error(`  ${x}`);
  console.error('Add the exercise to both CSVs, or fix the name in MAP.\n');
}

let page = readFileSync(PAGE, 'utf8');
const island = `<script type="application/json" id="benchmarks">${JSON.stringify(out)}<\/script>`;
const re = /<script type="application\/json" id="benchmarks">[\s\S]*?<\/script>/;
if (re.test(page)) page = page.replace(re, island);
else {
  const anchor = /<script type="application\/json" id="deckart">[\s\S]*?<\/script>/;
  if (!anchor.test(page)) { console.error('Could not find the deckart island to anchor to.'); process.exit(1); }
  page = page.replace(anchor, m => `${island}\n${m}`);
}
writeFileSync(PAGE, page);

const byMech = {};
for (const v of Object.values(out)) byMech[v.mech] = (byMech[v.mech] || 0) + 1;
console.log(`${Object.keys(out).length} of ${Object.keys(MAP).length} deck movements have benchmarks`);
console.log(Object.entries(byMech).map(([k, n]) => `  ${k}: ${n}`).join('\n'));
console.log(`island is ${(JSON.stringify(out).length / 1024).toFixed(1)} KB`);
if (missing.length) process.exitCode = 1;
