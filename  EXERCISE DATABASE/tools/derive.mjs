/* ============================================================
   DERIVE — js/data/exercises.js  →  workbook rows (JSON)

   Best-effort migration of the 307 existing entries onto the new
   schema. Nothing here is a guess dressed up as a fact: every field
   this script infers is stamped in `review` so the workbook can show
   what a human still has to look at.

   Run:  node "EXERCISE DATABASE/tools/derive.mjs"
   Out:  EXERCISE DATABASE/workbook/_derived.json
   ============================================================ */
import { writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const { EXERCISES } = await import(join(ROOT, 'js/data/exercises.js'));

/* ------------------------------------------------------------
   THE FUNDAMENTALS — the 15/30/50 a person should master, and the
   movements the exercise cards attach to. Cumulative: advanced = all
   50 including the 15. Source: FOR NICOLAS/FUNDAMENTALS.md.

   Cards and artwork are not side projects — they are fields on the
   movement, so they cannot drift the way four alias tables did.
   ------------------------------------------------------------ */
const LAD  = JSON.parse(readFileSync(join(HERE, 'fundamental-ladders.json'), 'utf8'));
const GYM_LANES = JSON.parse(readFileSync(join(HERE, 'gym-lanes.json'), 'utf8'));
/* A fundamental is now a LADDER: one anchor (the destination), regressions
   below it so anyone can enter, progressions above so nobody runs out.
   Nicolas, 19 Aug: "Main exercise and regression / progression on level of
   user." The anchors ARE the fundamentals list. */
const FUND = LAD.ladders.map(([lid, name, family, tier, anchor]) =>
  [lid, name, family, tier, anchor]);
const { kettlebellRows, gymRows, additionRows, bridgeMap: BRIDGES, kbMergeInto: KB_MERGE } =
  await import('./new-movements.mjs');
const fundById = {};
for (const [no, fname, family, tier, id] of FUND) {
  if (id) (fundById[id] ??= []).push({ no, tier, family, fname });
}
/* a movement can serve two rungs (Nordic curl is #18 and #33) — keep the
   lowest tier, that is when the card first has to exist */
for (const id of Object.keys(fundById)) fundById[id].sort((a, b) => a.no - b.no);

/* artwork — the same three states build-spine already reports */
const DRAWN = existsSync(join(ROOT, 'images/exercises'))
  ? new Set(readdirSync(join(ROOT, 'images/exercises')).filter(f => f.endsWith('.png')).map(f => f.replace('.png', '')))
  : new Set();

const has = (m, ...k) => (m.equipment || []).some(e => k.includes(e));
const fam = m => new Set([...(m.families || []), ...(m.family ? [m.family] : [])]);
const nm = m => m.name.toLowerCase();

/* ------------------------------------------------------------
   patterns[] — mechanics only, ordered, primary first
   ------------------------------------------------------------ */
function patterns(id, m) {
  const f = fam(m), n = nm(m), out = [];
  const add = p => { if (p && !out.includes(p)) out.push(p); };

  switch (m.pattern) {
    case 'push':
      if (f.has('planche') || /planche|straight-arm/.test(n)) add('straight-arm-push');
      else if (f.has('handstand') || f.has('pike') || f.has('vertical-push') || /hspu|handstand|pike/.test(n)) add('v-push');
      else if (/leg (raise|lift)|knee tuck|compression|straddle leg/.test(n)) add('compression');
      else add('h-push');
      break;
    case 'press': add('v-push'); break;
    case 'pull':
      if (f.has('front-lever') || f.has('front-lever-raise') || f.has('skin-cat') || /lever|skin the cat/.test(n)) add('straight-arm-pull');
      else if (f.has('horizontal-pull') || f.has('rear-delt') || /row|pull-apart|pullapart|face pull|fly/.test(n)) add('h-pull');
      else if (/high pull|upright/.test(n)) { add('hinge'); add('h-pull'); }
      else add('v-pull');
      break;
    case 'quad':  add(m.laterality === 'unilateral' || /split|lunge|step|touchdown/.test(n) ? 'lunge' : 'squat'); break;
    case 'hinge': add('hinge'); break;
    case 'glute': add('hinge'); break;
    case 'hamstring': add('hinge'); break;
    case 'calf':  add('calf'); break;
    case 'shin':  add('shin'); break;
    case 'carry': add('carry'); break;
    case 'core':
      if (f.has('side-plank') || m.region === 'side' || /side plank|oblique|copenhagen|windshield/.test(n)) add('anti-lateral-flexion');
      else if (f.has('l-sit') || f.has('lsit') || f.has('v-sit') || f.has('vsit') || /l-sit|v-sit|compression|straddle/.test(n)) add('compression');
      else if (f.has('hanging') || /hanging|toes to bar/.test(n)) add('flexion');
      else if (f.has('vup') || /crunch|sit-up|v-up|tuck-up|knee tuck|leg raise/.test(n)) add('flexion');
      else if (/superman|back extension|bridge|reverse plank/.test(n)) add('extension');
      else if (/windmill|bent press|figure-8|around the body|russian twist|wood ?chop|landmine twist/.test(n)) add('rotation');
      else if (f.has('bear') || /bird dog|anti-rotation|pallof|opposite arm/.test(n)) add('anti-rotation');
      else add('anti-extension');
      break;
    case 'conditioning': add('locomotion'); break;
    case 'skill':
      /* the name alone is not enough — "Kick-Up Practice" and "Freestanding
         Attempts" are handstand work and were landing in the pull bucket */
      if (f.has('handstand') || f.has('planche') || /handstand|planche|kick-up|kick up|freestanding|hspu|press to/.test(n)) add('v-push');
      else if (f.has('front-lever') || f.has('muscle-up') || /lever|muscle-up/.test(n)) add('straight-arm-pull');
      else if (f.has('l-sit') || f.has('lsit') || /l-sit|v-sit/.test(n)) add('compression');
      else add('v-pull');
      break;
    case 'mobility': break;                      // role handles these
    case 'full': add('squat'); break;
  }

  /* complexes genuinely hit several patterns — the engine's subset
     filter needs all of them, not just the headline one */
  if (/burpee/.test(n))      { add('squat'); add('h-push'); add('jump'); }
  if (/man-maker/.test(n))   { add('h-push'); add('h-pull'); add('squat'); add('v-push'); }
  if (/devil|thruster/.test(n)) { add('squat'); add('v-push'); }
  /* a get-up is a loaded overhead carry through a lunge — never a pull */
  if (/get-up|getup/.test(n)) { out.length = 0; add('v-push'); add('lunge'); add('anti-lateral-flexion'); }
  if (/burpee pull/.test(n)) { out.unshift('v-pull'); }
  if (/jump|plyo|clap|hop/.test(n)) add('jump');
  if (/swing|high pull|clean|snatch/.test(n)) add('hinge');
  if (/hang|hold/.test(n) && m.pattern === 'pull' && !out.length) add('v-pull');

  return out;
}

/* ------------------------------------------------------------
   muscles — primary / secondary
   ------------------------------------------------------------ */
const MUSCLE_BY_PATTERN = {
  'h-push':  [['chest', 'triceps'], ['front-delt', 'serratus', 'abs']],
  'v-push':  [['front-delt', 'triceps'], ['chest', 'traps', 'abs']],
  'straight-arm-push': [['front-delt', 'serratus'], ['chest', 'biceps', 'abs']],
  'h-pull':  [['mid-back', 'lat'], ['biceps', 'rear-delt', 'grip']],
  'v-pull':  [['lat', 'biceps'], ['mid-back', 'grip', 'abs']],
  'straight-arm-pull': [['lat', 'abs'], ['mid-back', 'biceps', 'grip']],
  'squat':   [['quad', 'glute'], ['abs', 'lower-back', 'calf']],
  'lunge':   [['quad', 'glute'], ['hamstring', 'adductor', 'abs']],
  'hinge':   [['hamstring', 'glute'], ['lower-back', 'grip']],
  'calf':    [['calf'], []],
  'shin':    [['tibialis'], []],
  'carry':   [['grip', 'abs'], ['traps', 'glute']],
  'anti-extension':      [['abs'], ['obliques', 'front-delt']],
  'anti-rotation':       [['obliques', 'abs'], ['glute']],
  'anti-lateral-flexion':[['obliques'], ['abs', 'glute']],
  'flexion':    [['abs'], ['hip-flexor', 'obliques']],
  'extension':  [['lower-back', 'glute'], ['hamstring']],
  'compression':[['abs', 'hip-flexor'], ['quad', 'triceps']],
  'jump':       [['quad', 'glute'], ['calf', 'hamstring']],
  'locomotion': [['abs', 'quad'], ['front-delt', 'calf']],
};

function muscles(id, m, pats) {
  const n = nm(m);
  if (/glute bridge|hip thrust|donkey|banded sidewalk|lateral walk/.test(n)) return [['glute'], ['hamstring', 'abs']];
  if (/nordic|ham(string)? curl|sliding/.test(n))                            return [['hamstring'], ['glute', 'calf']];
  if (/rdl|romanian|good morning/.test(n))                                   return [['hamstring', 'glute'], ['lower-back', 'grip']];
  if (/diamond|triceps|pushdown|dip/.test(n))                                return [['triceps', 'chest'], ['front-delt']];
  if (/curl|preacher/.test(n) && !/nordic|ham/.test(n))                      return [['biceps'], ['forearm', 'grip']];
  if (/lateral raise|side raise/.test(n))                                    return [['side-delt'], ['traps']];
  if (/rear delt|face pull|pull-apart|pullapart|reverse fly|ytw/.test(n))    return [['rear-delt'], ['mid-back', 'traps']];
  if (/hang|grip|towel/.test(n) && /hang/.test(n))                           return [['grip', 'lat'], ['forearm', 'mid-back']];
  if (/wall sit|horse stance|sissy|slant|touchdown|kot|tibialis/.test(n) && /wall sit|horse|sissy|slant|touchdown/.test(n)) return [['quad'], ['glute']];
  const p = pats[0];
  return MUSCLE_BY_PATTERN[p] || [[], []];
}

/* ------------------------------------------------------------
   role[] — where in a session it is allowed to land
   ------------------------------------------------------------ */
function role(id, m) {
  const f = fam(m), n = nm(m);
  if (m.pattern === 'mobility') return /cars|circles|swings|cat-cow|cat cow|wrist|ankle|90\/90|thoracic/.test(n) ? ['joint-prep'] : ['joint-prep', 'activation'];
  if (/stretch/.test(n)) return ['joint-prep'];
  if (/band(ed)? (pull-apart|pullapart)|face pull|wall slide|scap|ytw|arm circle/.test(n)) return ['joint-prep', 'activation'];
  /* skill PRACTICE = the skill itself. skill STRENGTH = loaded prep, and per
     Rule 32 it is welcome inside hypertrophy and conditioning blocks. */
  const skillFam = f.has('planche') || f.has('handstand') || f.has('front-lever') || f.has('muscle-up') || f.has('l-sit') || f.has('lsit');
  if (skillFam || m.pattern === 'skill') {
    const isPractice = /^(full|freestanding|straddle|adv\.|press to)/.test(n) || /muscle-up$|front lever$|planche$|handstand$/.test(n);
    return isPractice ? ['skill-practice'] : ['working-set', 'skill-strength'];
  }
  if (/burpee|mountain climber|march|high knee/.test(n)) return ['working-set', 'conditioning'];
  return ['working-set'];
}

/* ------------------------------------------------------------
   MODALITY + FUNCTIONAL — two axes, not one.

   The old single `discipline` field was wrong: a push-up is bodyweight
   AND functional, a kettlebell swing is functional but not calisthenics,
   a pec deck is neither. One field cannot hold two independent facts.

   "Calisthenics" is therefore not a field at all — it is
   modality:bodyweight, mostly functional:true, with the skill subset
   on top. Which is exactly how Nicolas described it.
   ------------------------------------------------------------ */
function modality(id, m) {
  const e = m.equipment || [];
  if (e.includes('machine') || e.includes('cable')) return 'machine';
  if (e.includes('bb') || e.includes('rack')) return 'barbell';
  if (e.includes('kb')) return 'kettlebell';
  if (e.includes('db')) return 'dumbbell';
  if (e.includes('band')) return 'band';
  return 'bodyweight';
}

/* functional = a real-world, multi-joint, transferable pattern.
   Machines and single-joint isolation are not. Everything else is —
   which is why most of the bodyweight library comes out functional. */
const ISOLATION = /curl|extension|pushdown|lateral raise|front raise|fly|crossover|pec deck|shrug|kickback|pullover|wrist|skull|abduction|adduction|calf raise|leg curl|leg extension|pulse|stretch/i;
function functional(id, m) {
  const n = nm(m), mod = modality(id, m);
  if (mod === 'machine') return 'FALSE';
  if (ISOLATION.test(n)) return 'FALSE';
  if (m.pattern === 'mobility') return 'FALSE';
  return 'TRUE';
}

const isSkill = (id, m) => {
  const f = fam(m);
  return f.has('planche') || f.has('handstand') || f.has('front-lever') || f.has('front-lever-raise')
      || f.has('muscle-up') || f.has('l-sit') || f.has('lsit') || f.has('v-sit') || f.has('vsit')
      || f.has('skin-cat') || f.has('dragonflag') || m.pattern === 'skill';
};

/* ------------------------------------------------------------
   constraints — the injury routing that does not exist today
   ------------------------------------------------------------ */
function demands(id, m, pats) {
  const n = nm(m), d = new Set();
  if (pats.some(p => p === 'v-push') || /overhead|handstand|hspu|press|halo/.test(n)) d.add('overhead-rom');
  if (/push-up|plank|planche|handstand|bear|pike|dip|burpee|crawl/.test(n) || pats.includes('straight-arm-push')) d.add('wrist-extension');
  if (pats.some(p => ['squat', 'lunge'].includes(p)) || /squat|lunge|sit|pistol/.test(n)) d.add('deep-knee-flexion');
  if (pats.includes('hinge') || /deadlift|rdl|hinge|swing|good morning/.test(n)) d.add('hip-hinge');
  if (/hang|pull-up|pullup|chin|lever|muscle-up|toes to bar|bar/.test(n) || pats.includes('v-pull')) d.add('grip');
  if (/hang|pull-up|pullup|chin|lever|muscle-up|toes to bar|skin the cat/.test(n)) d.add('hang');
  if (/handstand|hspu|inverted|skin the cat|candle/.test(n)) d.add('inversion');
  if (/jump|plyo|clap|burpee|hop|box/.test(n)) d.add('impact');
  if (/burpee|get-up|getup|man-maker|devil|crawl|turkish/.test(n)) d.add('floor-to-stand');
  return [...d];
}

function contra(id, m, pats, dem) {
  const n = nm(m), c = new Set();
  if (dem.includes('overhead-rom') || dem.includes('hang') || dem.includes('inversion')) c.add('shoulder');
  if (pats.includes('straight-arm-push') || pats.includes('straight-arm-pull')) { c.add('shoulder'); c.add('elbow'); }
  if (dem.includes('wrist-extension')) c.add('wrist');
  if (dem.includes('grip') && /lever|muscle-up|weighted|towel/.test(n)) c.add('elbow');
  if (dem.includes('deep-knee-flexion')) c.add('knee');
  if (dem.includes('impact')) { c.add('knee'); c.add('ankle'); }
  if (dem.includes('hip-hinge') || /deadlift|good morning|dragon flag|superman|back extension/.test(n)) c.add('lower-back');
  if (/sit-up|crunch|v-up|toes to bar|windshield|dragon flag/.test(n)) c.add('lower-back');
  if (/pistol|shrimp|sissy|slant|touchdown|kot|knees-over/.test(n)) c.add('knee');
  if (/neck|headstand/.test(n)) c.add('neck');
  return [...c];
}

/* ------------------------------------------------------------
   prescription helpers
   ------------------------------------------------------------ */
function secPerRep(id, m, pats) {
  if (m.measure === 'hold') return '';
  const n = nm(m);
  if (/burpee pull|man-maker|get-up|getup|devil/.test(n)) return 8;
  if (/burpee/.test(n)) return /navy|full/.test(n) ? 7 : 5;
  if (/muscle-up|planche|lever|hspu|handstand/.test(n)) return 6;
  if (/deadlift|squat$|back squat|thruster|clean/.test(n)) return 4;
  if (pats[0] === 'v-pull' || /pull-up|pullup|chin/.test(n)) return 4;
  if (pats[0] === 'squat' || pats[0] === 'lunge') return 2;
  if (pats[0] === 'h-push') return 3;
  return 3;
}

const loading = (id, m) => {
  const n = nm(m);
  if (/assisted|band-assisted/.test(n)) return 'assisted';
  if (has(m, 'band') && /band/.test(n)) return 'banded';
  if (has(m, 'vest') || /weighted/.test(n)) return 'added-load';
  if (m.load === 'weighted') return 'external-load';
  if (/planche|lever|lean|tuck|straddle|one-arm|archer|pistol/.test(n)) return 'leverage';
  return 'bodyweight';
};

const loadable = (id, m) => m.load === 'weighted' || has(m, 'vest', 'db', 'kb', 'bb') ? 'TRUE' : 'FALSE';
const plyo = (id, m) => /jump|plyo|clap|explosive|hop|box|bound|burpee/.test(nm(m)) ? 'TRUE' : 'FALSE';
const cns = (id, m) => { const d = m.diff ?? 0; return d >= 8 ? 'high' : d >= 5 ? 'moderate' : 'low'; };
const space = (id, m) => {
  if (has(m, 'pullupbar', 'rings', 'dipbars', 'rack', 'parallettes')) return 'bar';
  if (has(m, 'bench')) return 'bench';
  if (/wall/.test(nm(m))) return 'wall';
  if (has(m, 'machine', 'cable')) return 'machine';
  return 'floor';
};

/* ------------------------------------------------------------
   tracks — walk the existing easier/harder links into chains,
   then order each chain by diff. Where the links never existed
   (the whole lower body) the track column comes out blank, which
   is exactly the list of work to do.
   ------------------------------------------------------------ */
function buildTracks() {
  const parent = {};
  const find = a => parent[a] === a ? a : (parent[a] = find(parent[a]));
  const union = (a, b) => { parent[find(a)] = find(b); };
  for (const id of Object.keys(EXERCISES)) parent[id] = id;
  for (const [id, m] of Object.entries(EXERCISES)) {
    if (m.easier && EXERCISES[m.easier]) union(id, m.easier);
    if (m.harder && EXERCISES[m.harder]) union(id, m.harder);
  }
  const groups = {};
  for (const id of Object.keys(EXERCISES)) (groups[find(id)] ??= []).push(id);

  const out = {};
  for (const members of Object.values(groups)) {
    if (members.length < 2) continue;                       // not a chain
    members.sort((a, b) => (EXERCISES[a].diff ?? 5) - (EXERCISES[b].diff ?? 5)
                        || a.localeCompare(b));
    /* name the track after the family the members share, else the base move */
    const counts = {};
    for (const id of members) for (const f of fam(EXERCISES[id])) counts[f] = (counts[f] || 0) + 1;
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const name = (top && top[1] >= members.length / 2) ? top[0] : members[0].replace(/_/g, '-');
    members.forEach((id, i) => { out[id] = { track: name, rank: i + 1 }; });
  }
  return out;
}
const TRACKS = buildTracks();

/* ------------------------------------------------------------
   BUILD THE ROWS
   ------------------------------------------------------------ */
const rows = [];
for (const [id, m] of Object.entries(EXERCISES)) {
  const pats = patterns(id, m);
  const [pri, sec] = muscles(id, m, pats);
  const dem = demands(id, m, pats);
  const con = contra(id, m, pats, dem);
  const t = TRACKS[id] || {};

  /* what a human still has to look at */
  const review = [];
  if (!pats.length)                    review.push('patterns');
  if (!pri.length)                     review.push('muscles');
  if (!m.level)                        review.push('level');
  if (m.diff == null)                  review.push('diff');
  if (!t.track)                        review.push('track');
  const oneSided = /one[- ]arm|one[- ]leg|single[- ]arm|single[- ]leg|archer|pistol|suitcase|shrimp|cossack|split squat|bulgarian|side plank|copenhagen|windshield|turkish|half one/i;
  if (oneSided.test(m.name) && m.laterality !== 'unilateral') review.push('laterality');

  rows.push({
    id,
    name: m.name,
    modality: modality(id, m),
    functional: functional(id, m),
    is_skill: isSkill(id, m) ? 'TRUE' : 'FALSE',
    patterns: pats.join(', '),
    muscles_primary: pri.join(', '),
    muscles_secondary: sec.join(', '),
    laterality: oneSided.test(m.name) ? 'unilateral' : (m.laterality || ''),
    measure: m.measure || '',
    dual: m.dual ? 'TRUE' : 'FALSE',
    loading: loading(id, m),
    loadable: loadable(id, m),
    sec_per_rep: secPerRep(id, m, pats),
    plyo: plyo(id, m),
    role: role(id, m).join(', '),
    level: m.level || '',
    diff: m.diff ?? '',
    cns: cns(id, m),
    ess: m.ess ? 'TRUE' : 'FALSE',
    track: t.track || '',
    rank: t.rank || '',
    families: [...fam(m)].join(', '),
    subs: '',
    bridges_to: '',
    equipment: (m.equipment || []).join(', '),
    space: space(id, m),
    demands: dem.join(', '),
    contra: con.join(', '),
    /* a fundamental is a movement we promise to teach and track to mastery.
       Every one of these needs a card and a picture; nothing else does yet. */
    ladder: '', ladder_role: '', ladder_pos: '',
    gym_lane: '', gym_role: '', gym_pos: '',
    fundamental: fundById[id] ? String(fundById[id][0].tier) : '',
    fund_no: fundById[id] ? fundById[id].map(f => f.no).join(', ') : '',
    fund_family: fundById[id] ? fundById[id][0].family : '',
    card: '',                                    // authored later, per fundamental
    art: DRAWN.has(id) ? 'drawn' : 'missing',
    calib_beg: '', calib_int: '', calib_adv: '',
    calib_unit: m.measure === 'hold' ? 'secs' : (m.laterality === 'unilateral' ? 'reps_per_side' : 'reps'),
    no_pr: m.noPR ? 'TRUE' : 'FALSE',
    cue: typeof m.cues === 'string' ? m.cues : '',
    standard: '',
    review: review.join(', '),
    status: review.length ? 'REVIEW' : 'AUTO',
  });
}

/* ------------------------------------------------------------
   FOLD IN THE NEW LIBRARIES
   Kettlebell first (it merges into existing ids where the database
   already had the movement under another name), then the gym list
   Nicolas approved.
   ------------------------------------------------------------ */
/* the kettlebell merge left four movements in the database twice under
   different ids. One movement, one row — merge the equipment and drop the
   copy, keeping the id everything else already points at. */
const DEDUPE = {
  kb_goblet_squat:        'goblet_squat',
  kb_prying_goblet_squat: 'prying_goblet',
  kb_suitcase_carry:      'suitcase_carry',
  kb_turkish_get_up:      'turkish_get_up',
  turkish_getup:          'turkish_get_up',
};

/* a handful of long-standing entries never got a level, and they sit at the
   BOTTOM of a ladder — which is exactly where a just-starting person enters.
   No level there means the engine cannot offer them the ladder at all. */
const LEVEL_FIX = {
  single_leg_bridge: 'beg', sliding_ham_curl: 'beg', deep_squat_rock: 'start',
  banded_sidewalk: 'start', cat_cow: 'start', hip_90_90: 'start',
  worlds_greatest_stretch: 'start', hip_thrust: 'beg', horse_stance: 'beg',
  jump_squat: 'beg', sissy_squat: 'adv', slant_board_squat: 'int',
  romanian_deadlift: 'int', deadlift: 'int', nordic_curl: 'adv',
  ankle_mobility: 'start', hip_cars: 'start', wrist_prep: 'start',
  thoracic_rotation: 'start', thoracic_open: 'start', leg_swings: 'start',
  chest_stretch: 'start', shoulder_stretch: 'start', hip_flexor_stretch: 'start',
};
let levelled = 0;
for (const [id, lv] of Object.entries(LEVEL_FIX)) {
  const r = rows.find(x => x.id === id);
  if (r && !r.level) { r.level = lv; levelled++; }
}

const existing = new Set(rows.map(r => r.id));
let added = 0, merged = 0;

for (const [libId, dbId] of Object.entries(KB_MERGE)) {
  const target = rows.find(r => r.id === dbId);
  if (target) { target.families = [target.families, 'kettlebell-fundamental'].filter(Boolean).join(', '); merged++; }
}
for (const r of kettlebellRows()) {
  if (existing.has(r.id)) { merged++; continue; }
  if (Object.values(KB_MERGE).includes(r.id)) { merged++; continue; }
  rows.push(r); existing.add(r.id); added++;
}
for (const r of additionRows()) {
  if (existing.has(r.id)) { merged++; continue; }
  rows.push(r); existing.add(r.id); added++;
}
for (const r of gymRows()) {
  if (existing.has(r.id)) { merged++; continue; }
  const clash = rows.find(x => x.name.toLowerCase() === r.name.toLowerCase());
  if (clash) { merged++; continue; }
  rows.push(r); existing.add(r.id); added++;
}

/* apply the dedupe: fold equipment up into the survivor, then drop the copy */
let deduped = 0;
for (const [dropId, keepId] of Object.entries(DEDUPE)) {
  const drop = rows.find(r => r.id === dropId);
  const keep = rows.find(r => r.id === keepId);
  if (!drop || !keep) continue;
  const kit = new Set([...keep.equipment.split(',').map(x => x.trim()).filter(Boolean),
                       ...drop.equipment.split(',').map(x => x.trim()).filter(Boolean)]);
  keep.equipment = [...kit].join(', ');
  rows.splice(rows.indexOf(drop), 1);
  existing.delete(dropId);
  deduped++;
}

/* stamp every movement with the ladder it belongs to and where on it.
   ladder_pos: negative = regression, 0 = the anchor, positive = progression. */
let onLadder = 0;
for (const [lid, lname, family, tier, anchor, regs, progs] of LAD.ladders) {
  const put = (id, role, pos) => {
    const r = rows.find(x => x.id === id);
    if (!r) return;
    r.ladder = lid; r.ladder_role = role; r.ladder_pos = pos; onLadder++;
    if (role === 'anchor') { r.fundamental = String(tier); r.fund_family = family; r.ess = 'TRUE'; }
  };
  regs.forEach((id, i) => put(id, 'regression', i - regs.length));
  put(anchor, 'anchor', 0);
  progs.forEach((id, i) => put(id, 'progression', i + 1));
}

/* the GYM LANE — the loaded version of each fundamental. Shorter than the
   bodyweight ladder on purpose: load is the progression, so it needs two or
   three rungs where leverage needs six. Only where the gym movement trains
   the same joint action; five ladders honestly have no equivalent. */
let laned = 0;
for (const [lid, lane] of Object.entries(GYM_LANES.lanes)) {
  const put = (id, role, pos) => {
    const r = rows.find(x => x.id === id);
    if (!r) return;
    r.gym_lane = lid; r.gym_role = role; r.gym_pos = pos; laned++;
  };
  lane.easier.forEach((id, i) => put(id, 'easier', i - lane.easier.length));
  put(lane.anchor, 'gym-anchor', 0);
  lane.harder.forEach((id, i) => put(id, 'harder', i + 1));
}

/* bridges — a gym movement points at the fundamental we mean to reach.
   Also applied to anything already in the database that has a pairing. */
let bridged = 0;
for (const r of rows) {
  if (r.bridges_to) { bridged++; continue; }
  const b = BRIDGES[r.name];
  if (b && existing.has(b)) { r.bridges_to = b; bridged++; }
}

rows.sort((a, b) =>
  a.modality.localeCompare(b.modality) ||
  (a.patterns.split(',')[0] || '').localeCompare(b.patterns.split(',')[0] || '') ||
  (a.diff || 99) - (b.diff || 99) ||
  a.name.localeCompare(b.name));

writeFileSync(join(HERE, '..', 'workbook', '_derived.json'), JSON.stringify(rows, null, 1));

const by = (f) => rows.reduce((a, r) => (a[r[f]] = (a[r[f]] || 0) + 1, a), {});
console.log(`derived ${rows.length} rows  (+${added} new, ${merged} merged into existing)`);
console.log('  modality     ', by('modality'));
console.log('  functional   ', by('functional'));
console.log('  bridges set  ', bridged);
console.log('  needs review ', rows.filter(r => r.status === 'REVIEW').length);
console.log('  with a track ', rows.filter(r => r.track).length);
console.log('  primary pattern', Object.entries(rows.reduce((a, r) => {
  const p = r.patterns.split(',')[0].trim() || '(none)'; a[p] = (a[p] || 0) + 1; return a;
}, {})).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join('  '));

/* THE SECOND INVARIANT, one level up from onboarding: if we promise to teach a
   movement to mastery, the database has to hold it. */
/* check against the FINAL row set, not the original source module — a movement
   added by the kettlebell, gym or fundamentals libraries is just as real. */
const finalIds = new Set(rows.map(r => r.id));
const missingFund = FUND.filter(([, , , , id]) => !id || !finalIds.has(id));
console.log(`\n  duplicates merged       ${deduped}`);
console.log(`  levels filled in        ${levelled}`);
console.log(`  gym lanes               ${Object.keys(GYM_LANES.lanes).length} of ${LAD.ladders.length}   (${laned} movements, ${Object.keys(GYM_LANES.no_lane).length} ladders have none)`);
console.log(`  ladders                 ${LAD.ladders.length}   (${onLadder} movements sit on one)`);
console.log(`  fundamentals in the DB  ${FUND.length - missingFund.length} / ${FUND.length}`);
if (missingFund.length) {
  console.log(`  MISSING (${missingFund.length}) — promised on the fundamentals list, absent from the database:`);
  for (const [no, fname, family, tier] of missingFund)
    console.log(`    #${String(no).padStart(2)} [${tier}] ${fname.padEnd(34)} ${family}`);
}
console.log(`\n  artwork drawn           ${rows.filter(r => r.art === 'drawn').length} / ${rows.length}`);
console.log(`  fundamentals with art   ${rows.filter(r => r.fundamental && r.art === 'drawn').length} / ${rows.filter(r => r.fundamental).length}`);
