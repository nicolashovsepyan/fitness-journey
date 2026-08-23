/* ============================================================
   BUILD THE APP'S MOVEMENT DATA

   Run:  node tools/build-app-data.mjs     (after build-spine.mjs)

   Rewrites the `const EX = {…}` block inside dashboard.html from
   spine/catalog.json.

   WHY GENERATE RATHER THAN FETCH
   The rule is "no surface keeps its own copy of a movement". A copy
   that a build step regenerates from the spine does not break that
   rule — a hand-edited one does. Generating also keeps the app a
   single static file that works offline, opened from disk, or
   published standalone, none of which a runtime fetch survives.

   So: edit the movement in js/data/exercises.js, edit the coaching
   copy in spine/coaching.json, run the two build steps. Never edit
   the block in dashboard.html — it is overwritten.
   ============================================================ */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const p = (...x) => join(ROOT, ...x);

const BEGIN = '/* >>> GENERATED MOVEMENTS — do not edit by hand.';
const END   = '/* <<< END GENERATED MOVEMENTS */';

const spine = JSON.parse(readFileSync(p('spine/catalog.json'), 'utf8')).movements;
let html = readFileSync(p('dashboard.html'), 'utf8');

/* ---- ids the app actually uses, canonical ---------------------------- */
/* The built-in kettlebell draft plus the locked pool behind kit he does not
   own. Ordered so the Learn tab reads sensibly rather than alphabetically.
   This is the FLOOR, not the whole list: every movement used by a program
   in spine/programs/ is added below, because a person whose program names a
   movement the app never shipped gets a blank row. */
const DRAFT = [
  /* prime */
  'cat_cow', 'hip_90_90', 'deep_squat_rock', 'glute_bridge', 'dead_bug',
  'kb_halo', 'prying_goblet',
  /* hinge */
  'kb_deadlift', 'kb_rdl', 'single_leg_rdl', 'kb_swing',
  /* squat */
  'box_squat', 'goblet_squat', 'bulgarian_split', 'wall_sit',
  /* push */
  'pushup', 'kb_floor_press', 'kb_press',
  /* pull */
  'single_arm_row', 'kb_high_pull',
  /* carry + core */
  'suitcase_carry', 'goblet_march', 'farmers_carry',
  'forearm_plank', 'side_plank', 'hollow_hold', 'turkish_getup',
  /* conditioning */
  'mountain_climber', 'march_in_place',
  /* locked — needs kit he does not own */
  'dead_hang', 'scap_pullup', 'wide_inverted_row', 'hanging_knee_raise', 'pullup',
  'banded_pullapart', 'banded_glute_bridge', 'band_assisted_pullup', 'bent_over_row'
];

/* Which kit each one needs, in the app's own vocabulary. The database
   equipment tags are close but not identical (it says 'db' where the app
   needs to say 'dumbbells you do not own'), so this stays explicit. */
/* Every movement any real program uses. Ported programs come from the older
   app, where the coaching was written; without this the dashboard can render
   Ozzy's draft and nothing else. */
const PROGRAM_IDS = [];
const progDir = p('spine/programs');
if (existsSync(progDir)) {
  for (const f of readdirSync(progDir)) {
    if (!f.endsWith('.json') || f === 'index.json') continue;
    const prog = JSON.parse(readFileSync(join(progDir, f), 'utf8'));
    for (const day of Object.values(prog.days || {}))
      for (const b of day.blocks || [])
        for (const it of b.items || [])
          if (!PROGRAM_IDS.includes(it.ex)) PROGRAM_IDS.push(it.ex);
  }
}
const USED = [...DRAFT, ...PROGRAM_IDS.filter(id => !DRAFT.includes(id))];

const KIT = {
  cat_cow:['mat'], hip_90_90:['mat'], deep_squat_rock:[], glute_bridge:['mat'],
  dead_bug:['mat'], kb_halo:['kb'], prying_goblet:['kb'],
  kb_deadlift:['kb'], kb_rdl:['kb'], single_leg_rdl:[], kb_swing:['kb'],
  box_squat:['bench'], goblet_squat:['kb'], bulgarian_split:['bench'], wall_sit:[],
  pushup:['bench'], kb_floor_press:['kb','mat'], kb_press:['kb'],
  single_arm_row:['kb','bench'], kb_high_pull:['kb'],
  suitcase_carry:['kb'], goblet_march:['kb'], farmers_carry:['kb'],
  forearm_plank:['mat'], side_plank:['mat'], hollow_hold:['mat'], turkish_getup:['kb','mat'],
  mountain_climber:['mat'], march_in_place:[],
  dead_hang:['bar'], scap_pullup:['bar'], wide_inverted_row:['bar'],
  hanging_knee_raise:['bar'], pullup:['bar'],
  banded_pullapart:['band'], banded_glute_bridge:['band'],
  band_assisted_pullup:['bar','band'], bent_over_row:['db']
};

/* Phase gating: 1 = available now, 2 = week five, 3 = week nine. */
const PHASE = { kb_swing:2, farmers_carry:2, kb_press:3, kb_high_pull:3,
                turkish_getup:3, bulgarian_split:3 };

/* Display pattern — the database's `pattern` is programming vocabulary
   ("quad", "hinge"); this is what a beginner reads on a card. */
const PAT = {
  mobility:'Mobility', glute:'Glutes', core:'Core', hinge:'Hinge', quad:'Legs',
  push:'Push', press:'Press', pull:'Pull', carry:'Carry', skill:'Skill',
  conditioning:'Conditioning', grip:'Grip'
};

/* A movement ported from a program has no hand-written KIT entry. Fall back
   to the catalogue's own equipment tags, translated into the app's shorter
   vocabulary, so the "needs" line and the locking still work. */
const TAG_TO_KIT = { pullupbar:'bar', band:'band', db:'db', rings:'rings', kb:'kb',
                     bench:'bench', mat:'mat', bb:'bb', machine:'machine', cable:'cable',
                     slantboard:'slantboard', parallettes:'parallettes', sliders:'sliders',
                     rack:'rack', vest:'vest', box:'bench' };
const kitFromSpine = m => [...new Set((m.equipment || [])
  .filter(e => e !== 'bw').map(e => TAG_TO_KIT[e] || e))];

const q = s => "'" + String(s ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, ' ') + "'";
const arr = a => '[' + (a || []).map(q).join(',') + ']';

const missing = [];
const lines = [];
for (const id of USED) {
  const m = spine[id];
  if (!m) { missing.push(id); continue; }
  const c = m.coaching || {};
  const pat = PAT[m.pattern] || (m.pattern ? m.pattern[0].toUpperCase() + m.pattern.slice(1) : 'Movement');
  const why = c.why || m.cue || '';
  const cues = (c.cues && c.cues.length) ? c.cues : (m.cue ? [m.cue] : []);
  const bad = c.mistakes || [];
  const bits = [
    `n:${q(m.name)}`,
    `pat:${q(pat)}`,
    `img:${m.art.status === 'drawn' ? q(m.art.file) : 'null'}`,
    `kit:${arr(KIT[id] || kitFromSpine(m))}`,
    PHASE[id] ? `phase:${PHASE[id]}` : null,
    `why:${q(why)}`,
    `cues:${arr(cues)}`,
    `bad:${arr(bad)}`
  ].filter(Boolean);
  lines.push(`  ${id}:{${bits.join(',')}}`);
}

if (missing.length) {
  console.error('\n  BUILD FAILED — the app uses movements the spine does not have:');
  console.error('    ' + missing.join(', '));
  console.error('    Add them to js/data/exercises.js, then re-run build-spine.mjs.\n');
  process.exit(1);
}

/* ------------------------------------------------------------
   WHAT EACH BIT OF KIT ACTUALLY UNLOCKS

   Counted across the whole 305-movement catalog by matching the
   equipment tags on every movement — not by counting the handful the
   app happens to display. The first numbers we showed (a pull-up bar
   "unlocks 5") were the app talking about itself; the real answer is 44.

   A movement counts as unlocked by X when X is in its equipment list
   and everything else it needs is already owned.
   ------------------------------------------------------------ */
const OWNED_TAGS = ['bw', 'kb', 'bench', 'mat'];
const GEAR_TAGS = { bar: 'pullupbar', band: 'band', db: 'db', rings: 'rings' };

const kitIndex = {};
for (const [gearId, tag] of Object.entries(GEAR_TAGS)) {
  const own = new Set([...OWNED_TAGS, tag]);
  const hits = Object.values(spine).filter(m => {
    const eq = m.equipment || [];
    return eq.includes(tag) && eq.every(e => own.has(e));
  });
  /* show the ones a beginner would recognise first */
  const named = hits
    .sort((a, b) => (a.diff ?? 5) - (b.diff ?? 5))
    .map(m => m.name);
  kitIndex[gearId] = { count: hits.length, sample: named.slice(0, 3) };
}
const kitBlock = `const KIT_UNLOCKS = ${JSON.stringify(kitIndex)};`;

const block = `${BEGIN}
   Regenerate with:  node tools/build-spine.mjs && node tools/build-app-data.mjs
   Source of truth:  js/data/exercises.js -> spine/catalog.json
   ${lines.length} movements, built ${new Date().toISOString().slice(0, 10)}. */
const EX = {
${lines.join(',\n')}
};
${kitBlock}
${END}`;

const a = html.indexOf(BEGIN);
const b = html.indexOf(END);
if (a >= 0 && b > a) {
  html = html.slice(0, a) + block + html.slice(b + END.length);
} else {
  /* first run — swap out the hand-written block */
  const s = html.indexOf('const EX = {');
  if (s < 0) { console.error('  ! could not find `const EX = {` in dashboard.html'); process.exit(1); }
  const e = html.indexOf('\n};', s);
  if (e < 0) { console.error('  ! could not find the end of the EX block'); process.exit(1); }
  html = html.slice(0, s) + block + html.slice(e + 3);
}
writeFileSync(p('dashboard.html'), html);

const drawn = USED.filter(id => spine[id]?.art.status === 'drawn').length;
console.log(`\nAPP DATA BUILT`);
console.log(`  movements written  ${lines.length}`);
console.log(`  with artwork       ${drawn}`);
console.log(`  with coaching copy ${USED.filter(id => spine[id]?.coaching).length}`);
console.log(`  kit unlocks        ${Object.entries(kitIndex).map(([k, v]) => k + ':' + v.count).join('  ')}`);
console.log(`  dashboard.html EX block is now generated — do not hand-edit it.\n`);
