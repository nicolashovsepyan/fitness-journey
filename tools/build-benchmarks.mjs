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
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, nicolas, must } from './paths.mjs';

/* Lives in "FOR NICOLAS" — the one folder he owns and edits. Where that is
   is decided in ONE file, tools/paths.mjs. */
const SYS = process.argv[2] || must(nicolas(), 'FOR NICOLAS');
const PAGE = join(ROOT, 'onboarding.html');

/* deck id -> the Exercise column in the CSVs.
   These are the ladder's ids, so the list changed when the ladder replaced
   the two fixed decks: mountain climber, wall sit, hip thrust and the
   Romanian deadlift are no longer asked about, and ten rungs arrived that
   have no row yet. A missing row is not fatal — the card still has its own
   bands — it just means the slider cannot tell the person where they sit
   against a standard, which is the whole point of the slider. */
const MAP = {
  /* bodyweight rungs */
  pushup:   'Push-Up',              bwsquat:  'Squat',
  lunge:    'Bulgarian Split Squat',jumpsquat:'Jump Squat',
  slrdl:    'Single-Leg RDL',       pullup:   'Pull-Up',
  invrow:   'Australian Pull-Up',   pike:     'Pike Push-Up',
  plank:    'Plank',                hang:     'Dead Hang',
  /* loaded rungs */
  squat:    'Back Squat',           dead:     'Deadlift',
  bench:    'Bench Press',          ohp:      'Overhead Press',
  row:      'Bent-Over Row',        carry:    'Farmer Carry',
  kbswing:  'Kettlebell Swing',     splitld:  'Bulgarian Split Squat (Loaded)',
  /* new rungs — rows still to be drafted with Nicolas */
  goblet:   'Goblet Squat',         dbrdl:    'Dumbbell RDL',
  dbpress:  'Dumbbell Press',       dbohp:    'Dumbbell Overhead Press',
  dbrow:    'Single-Arm Row',       dips:     'Dip',
  tablerow: 'Table Row',            towelrow: 'Towel Door Row',
  burpee:   'Navy Seal Burpee',     hkr:      'Hanging Knee Raise',
  legraise: 'Lying Leg Raise',      bagcarry: 'Loaded Backpack Carry',
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
