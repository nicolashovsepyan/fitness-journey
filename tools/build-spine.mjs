/* ============================================================
   BUILD THE SPINE

   Run:  node tools/build-spine.mjs

   Produces spine/*.json — the one shared, read-only description of
   every movement, its artwork, and its benchmark. Every surface reads
   these; no surface keeps its own copy. This is the fix for the break
   where a push-up existed in four places under four names.

   Sources, in order of authority:
     1. js/data/exercises.js (+ -gym)  the movement database, 288 entries
     2. dashboard.html `EX`            hand-written coaching copy
     3. images/exercises/*.png         artwork that is finished
     4. the artwork folder /*.png    artwork drawn but not yet cropped in
     5. " FOR NICOLAS"/BENCHMARKS-*.csv the rank thresholds

   THE ALIAS TABLES BELOW ARE BY HAND, ON PURPOSE — the same reasoning
   as build-exercise-images.mjs. Matching by name paired "banded wall
   sit" with Sit-Up once already. With 288 movements a near-miss puts
   the wrong cue on the wrong exercise, which is worse than a gap.
   ============================================================ */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, artwork, nicolas, workbook } from './paths.mjs';

const p = (...x) => join(ROOT, ...x);

/* The two folders outside the repo's own structure. Where they are is
   decided in ONE file, tools/paths.mjs, because both have moved. Null when
   missing, and every read below already guards for that: this script must
   still run for somebody who has the code and not the artwork. */
const ART = artwork();
const NICO = nicolas();

/* ------------------------------------------------------------
   1 · ALIASES — every id any surface has ever used for a movement,
   resolved to the one canonical id in the database.
   ------------------------------------------------------------ */

/* onboarding.html GYM_DECK / BODY_DECK ids → canonical */
const DECK_ALIAS = {
  /* body deck */
  pushup:'pushup', bwsquat:'bodyweight_squat', lunge:'bulgarian_split',
  jumpsquat:'jump_squat', slrdl:'single_leg_rdl', pullup:'pullup',
  invrow:'wide_inverted_row', pike:'pike_push_up', mtnclimb:'mountain_climber',
  wallsit:'wall_sit', plank:'forearm_plank', hang:'dead_hang',
  /* gym deck */
  squat:'back_squat', dead:'deadlift', rdl:'romanian_deadlift',
  bench:'bench_press', ohp:'overhead_press', row:'bent_over_row',
  split:'bulgarian_split', thrust:'hip_thrust', carry:'farmers_carry',
  kbswing:'kb_swing'
};

/* dashboard.html EX ids → canonical. Several of these turned out to be
   re-inventions of movements the database already had; that is exactly
   what this table exists to surface. NEW: means a genuine gap. */
const DASH_ALIAS = {
  cat_cow:'cat_cow', hip_90_90:'hip_90_90', deep_squat_rock:'deep_squat_rock',
  glute_bridge:'glute_bridge', dead_bug:'dead_bug', kb_halo:'kb_halo', prying_goblet:'prying_goblet',
  kb_deadlift:'kb_deadlift', kb_rdl:'kb_rdl', single_leg_rdl:'single_leg_rdl', kb_swing:'kb_swing',
  box_squat:'box_squat', goblet_squat:'goblet_squat', bulgarian_split:'bulgarian_split',
  wall_sit:'wall_sit', pushup:'pushup', kb_floor_press:'kb_floor_press', kb_press:'kb_press',
  kb_row:'single_arm_row', kb_high_pull:'kb_high_pull',
  suitcase_carry:'suitcase_carry', goblet_march:'goblet_march', farmer_carry:'farmers_carry',
  forearm_plank:'forearm_plank', side_plank:'side_plank', hollow_hold:'hollow_hold',
  turkish_getup:'turkish_getup', mountain_climber:'mountain_climber', march_in_place:'march_in_place',
  dead_hang:'dead_hang', scap_pullup:'scap_pullup', wide_inverted_row:'wide_inverted_row',
  hanging_knee_raise:'hanging_knee_raise', pullup:'pullup',
  banded_pullapart:'banded_pullapart', banded_glute_bridge:'banded_glute_bridge',
  band_assisted_pullup:'band_assisted_pullup', bent_over_row:'bent_over_row'
};

/* benchmark CSV "Exercise" column → canonical id. Only the ones the app
   actually tests; the CSV carries many more for later. */
const BENCH_ALIAS = {
  'Push-Up':'pushup', 'Dip':'dip', 'Pull-Up':'pullup', 'Chin-up':'chin_up',
  'Pike Push-Up':'pike_push_up', 'Inverted Row':'wide_inverted_row',
  'Bodyweight Squat':'bodyweight_squat', 'Bulgarian Split Squat':'bulgarian_split',
  'Jump Squat':'jump_squat', 'Single-Leg RDL':'single_leg_rdl',
  'Wall Sit':'wall_sit', 'Plank':'forearm_plank', 'Dead Hang':'dead_hang',
  'Mountain Climber':'mountain_climber', 'Hollow Hold':'hollow_hold',
  'L-Sit':'l_sit', 'Muscle-Up':'muscle_up_bar', 'Nordic Curl':'nordic_curl'
};

/* artwork in the folder named by tools/paths.mjs, drawn but not yet cropped into
   images/exercises. Hand-mapped for the same reason as everything else. */
const SOURCE_ART = {
  wall_sit:'wall-sit-anime.png',
  farmers_carry:'farmers-carry-anime-transparent.png',
  kb_swing:'kettlebell-swing-anime.png',
  turkish_getup:'turkish-get-up-right-hand-position-4-reference-match-transparent.png',
  hanging_knee_raise:'hanging-knee-raises-transparent-v3.png',
  bodyweight_squat:'bodyweight-squat-anime.png',
  back_squat:'back-squat-135lb-anime-transparent.png',
  bench_press:'flat-barbell-bench-press-185lb-anime-transparent.png',
  overhead_press:'standing-barbell-overhead-press-90lb-anime-transparent.png',
  burpee:'burpee-five-stage-transparent.png',
  hip_extension_45:'45-degree-hip-extension-anime-male.png',
  power_clean:'barbell-power-clean-three-phase-anime-transparent.png'
};

/* ------------------------------------------------------------
   2 · READ THE SOURCES
   ------------------------------------------------------------ */
const { EXERCISES } = await import('../js/data/exercises.js');

/* the coaching copy written into dashboard.html: why it matters, the
   cues, the mistake everyone makes. Too good to leave stranded in one
   page — it belongs to the movement, not to a screen. */
function readDashboardCopy() {
  const src = readFileSync(p('dashboard.html'), 'utf8');
  const a = src.indexOf('const EX = {');
  if (a < 0) return {};
  const b = src.indexOf('\n};', a);
  const body = src.slice(a + 'const EX = '.length, b + 2);
  try {
    // our own file, built locally, never user input
    return new Function('return ' + body)();
  } catch (e) {
    console.warn('  ! could not parse dashboard EX:', e.message);
    return {};
  }
}

function readBenchmarks() {
  const out = {};
  for (const sex of ['Male', 'Female']) {
    const f = NICO && join(NICO, `BENCHMARKS - ${sex}.csv`);
    if (!f) { console.warn('  ! no FOR NICOLAS folder - benchmarks skipped'); return out; }
    if (!existsSync(f)) { console.warn('  ! missing', f); continue; }
    const [head, ...rows] = readFileSync(f, 'utf8').trim().split('\n');
    const cols = head.split(',');
    for (const line of rows) {
      // split on commas outside quotes
      const cells = line.match(/("[^"]*"|[^,]*)/g).filter((_, i) => i % 2 === 0);
      const r = Object.fromEntries(cols.map((c, i) => [c, (cells[i] || '').replace(/^"|"$/g, '')]));
      const id = BENCH_ALIAS[r.Exercise];
      if (!id) continue;
      out[id] ??= { mech: r.Mech, unit: r.Unit, standard: r.MovementStandard, ranks: {} };
      out[id].ranks[sex === 'Male' ? 'm' : 'f'] =
        [r.Beg, r.Int, r.Adv, r.Elite].map(Number).filter(n => !Number.isNaN(n));
    }
  }
  return out;
}

/* THE WORKBOOK KNOWS THINGS THE APP'S LIST DOES NOT.

   Movements live in two places in this project and both are real:
   js/data/exercises.js is what the APP ships and runs on, and the
   workbook in EXERCISE DATABASE is the AUTHORING surface - 465 rows
   with a richer pattern taxonomy, and the `fundamental` flag that
   marks the 28 movements every program is supposed to cover.

   They join on id, and cleanly: 306 of the app's 307 are in the
   workbook. So rather than merge two lists - which is a real decision
   about which one wins, and not one to make quietly - the spine now
   CARRIES the workbook's knowledge onto the app's list. The app keeps
   its own movements; it just knows which of them are fundamentals and
   what patterns they really train.

   Missing workbook, or a movement not in it, costs nothing: the fields
   come out null and every reader already handles that. */
function readWorkbook() {
  const f = workbook('_derived.json');
  if (!f || !existsSync(f)) {
    console.warn('  ! no workbook found - fundamentals and rich patterns will be null');
    return {};
  }
  try {
    const raw = JSON.parse(readFileSync(f, 'utf8'));
    const rows = Array.isArray(raw) ? raw : (raw.rows || Object.values(raw)[0] || []);
    const by = {};
    for (const r of rows) if (r && r.id) by[r.id] = r;
    return by;
  } catch (e) {
    console.warn('  ! workbook unreadable, carrying on without it:', e.message);
    return {};
  }
}
const WB = readWorkbook();
const VIDEOS = (() => {
  const f = p('spine/videos.json');
  try { return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {}; }
  catch (e) { console.warn('  ! spine/videos.json unreadable:', e.message); return {}; }
})();
const listOf = (r, k) => Array.isArray(r[k]) ? r[k]
  : String(r[k] || '').split(/[,;|]/).map(x => x.trim()).filter(Boolean);
const patternsOf = r => listOf(r, 'patterns');

const DASH = readDashboardCopy();
const BENCH = readBenchmarks();
const DRAWN = existsSync(p('images/exercises'))
  ? new Set(readdirSync(p('images/exercises')).filter(f => f.endsWith('.png')).map(f => f.replace('.png', '')))
  : new Set();
const LIBRARY = ART && existsSync(ART)
  ? new Set(readdirSync(ART).filter(f => f.endsWith('.png')))
  : new Set();

/* ------------------------------------------------------------
   3 · BUILD THE CATALOG
   ------------------------------------------------------------ */
const deckByCanonical = {};
for (const [deckId, canon] of Object.entries(DECK_ALIAS)) (deckByCanonical[canon] ??= []).push(deckId);

const catalog = {};
const report = { newInDashboard: [], reinvented: [], noArt: [], sourceArt: [], noBenchmark: 0 };

for (const [id, m] of Object.entries(EXERCISES)) {
  const dashId = Object.keys(DASH_ALIAS).find(k => DASH_ALIAS[k] === id);
  const dash = dashId ? DASH[dashId] : null;
  if (dash && dashId !== id) report.reinvented.push(`${dashId} -> ${id}`);

  let art = null;
  if (DRAWN.has(id)) art = { file: `images/exercises/${id}.png`, status: 'drawn' };
  else if (SOURCE_ART[id] && LIBRARY.has(SOURCE_ART[id])) {
    art = { file: null, status: 'source', source: SOURCE_ART[id] };
    report.sourceArt.push(id);
  } else { art = { file: null, status: 'missing' }; report.noArt.push(id); }

  catalog[id] = {
    id,
    name: m.name,
    pattern: m.pattern ?? null,
    family: m.family ?? null,
    equipment: m.equipment ?? [],
    measure: m.measure ?? null,
    load: m.load ?? null,
    laterality: m.laterality ?? null,
    level: m.level ?? null,
    diff: m.diff ?? null,
    easier: m.easier ?? null,
    harder: m.harder ?? null,
    noPR: !!m.noPR,
    gymOnly: !!m.gymOnly,
    /* one short cue line from the database, plus the long-form coaching
       copy where a human has written it */
    cue: typeof m.cues === 'string' ? m.cues : null,
    coaching: dash ? { why: dash.why, cues: dash.cues ?? [], mistakes: dash.bad ?? [], kit: dash.kit ?? [] } : null,
    /* From the workbook, joined by id. `pattern` above is the app's own
       single word; `patterns` is what the movement actually trains, which
       is often more than one thing - a burpee is squat, push AND jump. */
    fundamental: !!(WB[id] && WB[id].fundamental),
    fundFamily: (WB[id] && WB[id].fund_family) || null,
    patterns: WB[id] ? patternsOf(WB[id]) : [],
    /* WHAT A SEARCH ACTUALLY NEEDS TO MATCH ON. "leg explosive" is two
       words about two different columns, and neither of them is the
       movement's name. Carried so one search box can answer it.

       `demands` earns its place twice over: it is also the honest way to
       check a constraint. "No jumping" is impact; "no deep loaded knee
       flexion" is deep-knee-flexion. A rule written against these is a
       rule about the movement, not about how its name happens to read. */
    muscles: WB[id] ? listOf(WB[id], 'muscles_primary') : [],
    musclesAlso: WB[id] ? listOf(WB[id], 'muscles_secondary') : [],
    modality: (WB[id] && WB[id].modality) || null,
    role: (WB[id] && WB[id].role) || null,
    demands: WB[id] ? listOf(WB[id], 'demands') : [],
    /* HOW LONG ONE REP TAKES. The console used to ask a coach to type how
       many minutes a block would run, which meant the number stopped being
       true the moment a set was added. With this the time can be derived
       from what is actually prescribed. A back squat rep is 4 seconds, a
       push-up 3; where the workbook does not say, the reader falls back. */
    secPerRep: (WB[id] && WB[id].sec_per_rep != null && WB[id].sec_per_rep !== '')
      ? Number(WB[id].sec_per_rep) : null,
    art,
    /* Demo videos come from spine/videos.json, filled in through
       " FOR NICOLAS/VIDEOS TO LINK.md" and read by tools/link-videos.mjs.
       The movement's own demoUrl still wins where one was set in code. */
    video: m.demoUrl ?? VIDEOS[id] ?? null,
    benchmark: BENCH[id] ?? null,
    aliases: {
      deck: deckByCanonical[id] ?? [],
      dashboard: dashId && dashId !== id ? dashId : null
    }
  };
  if (!BENCH[id]) report.noBenchmark++;
}

/* movements the dashboard needed that the database does not have.
   These are real gaps, not mistakes — they are mostly kettlebell. */
for (const [dashId, canon] of Object.entries(DASH_ALIAS)) {
  if (canon !== 'NEW') continue;
  const d = DASH[dashId];
  if (!d) continue;
  report.newInDashboard.push(dashId);
  catalog[dashId] = {
    id: dashId, name: d.n, pattern: (d.pat || '').toLowerCase() || null,
    family: null, equipment: d.kit ?? [], measure: null, load: null, laterality: null,
    level: 'beg', diff: null, easier: null, harder: null, noPR: false, gymOnly: false,
    cue: null,
    coaching: { why: d.why, cues: d.cues ?? [], mistakes: d.bad ?? [], kit: d.kit ?? [] },
    art: DRAWN.has(dashId)
      ? { file: `images/exercises/${dashId}.png`, status: 'drawn' }
      : { file: null, status: 'missing' },
    video: null,
    benchmark: BENCH[dashId] ?? null,
    aliases: { deck: deckByCanonical[dashId] ?? [], dashboard: dashId },
    origin: 'authored-in-dashboard'
  };
}

/* THE INVARIANT
   If onboarding asks a person about a movement, the database holds it.
   No exceptions, and it is not a judgement call — a question we ask and
   cannot then name is exactly what put stick figures in front of a real
   client. So this fails the build rather than printing a warning nobody
   reads. Same for anything a program prescribes. */
const dangling = [...new Set(Object.values(DECK_ALIAS))].filter(c => !catalog[c]);
const prescribed = [...new Set(Object.values(DASH_ALIAS))].filter(c => c !== 'NEW' && !catalog[c]);

/* ------------------------------------------------------------
   4 · WRITE
   ------------------------------------------------------------ */
mkdirSync(p('spine'), { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);

const artManifest = Object.fromEntries(
  Object.values(catalog).map(m => [m.id, { name: m.name, ...m.art }])
);

writeFileSync(p('spine/catalog.json'),
  JSON.stringify({ version: 1, built: stamp, count: Object.keys(catalog).length, movements: catalog }, null, 1));
writeFileSync(p('spine/art.manifest.json'),
  JSON.stringify({ version: 1, built: stamp, art: artManifest }, null, 1));
writeFileSync(p('spine/benchmarks.json'),
  JSON.stringify({ version: 1, built: stamp, benchmarks: BENCH }, null, 1));

/* an id resolver every surface can use to translate its own historical ids */
const resolver = {};
for (const m of Object.values(catalog)) {
  resolver[m.id] = m.id;
  for (const d of m.aliases.deck) resolver[`deck:${d}`] = m.id;
  if (m.aliases.dashboard) resolver[`dash:${m.aliases.dashboard}`] = m.id;
}
writeFileSync(p('spine/aliases.json'),
  JSON.stringify({ version: 1, built: stamp, resolve: resolver }, null, 1));

/* ------------------------------------------------------------
   5 · REPORT — nothing goes quietly missing in either direction
   ------------------------------------------------------------ */
const n = Object.keys(catalog).length;
console.log(`\nSPINE BUILT  ${stamp}`);
console.log(`  movements          ${n}`);
console.log(`  artwork drawn      ${Object.values(catalog).filter(m => m.art.status === 'drawn').length}`);
console.log(`  artwork in source  ${report.sourceArt.length}   (drawn, needs cropping in)`);
console.log(`  artwork missing    ${report.noArt.length}`);
console.log(`  with a benchmark   ${Object.values(catalog).filter(m => m.benchmark).length}`);
console.log(`  with coaching copy ${Object.values(catalog).filter(m => m.coaching).length}`);

if (report.reinvented.length) {
  console.log(`\n  DUPLICATE IDS RESOLVED (${report.reinvented.length}) — the dashboard had its own name for these:`);
  report.reinvented.forEach(x => console.log('    ' + x));
}
if (report.newInDashboard.length) {
  console.log(`\n  GENUINELY NEW (${report.newInDashboard.length}) — needed by a program, absent from the database:`);
  console.log('    ' + report.newInDashboard.join(', '));
}
if (dangling.length || prescribed.length) {
  console.error('\n  BUILD FAILED — the invariant is broken.');
  if (dangling.length)
    console.error(`    onboarding asks about ${dangling.length} movement(s) the database does not have:\n      ${dangling.join(', ')}`);
  if (prescribed.length)
    console.error(`    a program prescribes ${prescribed.length} movement(s) the database does not have:\n      ${prescribed.join(', ')}`);
  console.error('    Add them to js/data/exercises.js. Do not remove the question.\n');
  process.exit(1);
}
console.log('\n  INVARIANT OK — every movement any surface asks about exists in the database.');
if (report.sourceArt.length) {
  console.log(`\n  FREE ARTWORK (${report.sourceArt.length}) — already drawn, just needs cropping into images/exercises:`);
  console.log('    ' + report.sourceArt.join(', '));
}
console.log('');
