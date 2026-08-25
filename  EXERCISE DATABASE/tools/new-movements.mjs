/* ============================================================
   NEW MOVEMENTS — kettlebell library + approved gym library

   Turns the researched kettlebell list and Nicolas's approved gym
   list into full movement records, on the same schema as the 307.

   Imported by derive.mjs. Nothing here writes files.
   ============================================================ */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = f => JSON.parse(readFileSync(join(HERE, f), 'utf8'));

const KB   = read('kettlebell-library.json');
const ADDS = read('fundamental-additions.json');
const GYM  = read('gym-library-seed.json');
let DEC = { gym: {}, kettlebell: {} };
try { DEC = read(join('..', 'workbook', '_decisions.json')); } catch { /* first run */ }

const split = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean);

/* ------------------------------------------------------------
   BRIDGES — the gym movement a person picked, and the fundamental
   we intend to bring them to. This is the field behind Nicolas's
   rule: honour the bench press in programme 1, introduce the
   push-up in programme 2 or 3. Never swap abruptly.
   ------------------------------------------------------------ */
const BRIDGE = {
  'Barbell Bench Press':'pushup', 'Incline Barbell Bench Press':'pushup',
  'Decline Barbell Bench Press':'pushup', 'Dumbbell Bench Press':'pushup',
  'Incline Dumbbell Press':'pushup', 'Dumbbell Floor Press':'pushup',
  'Chest Press Machine':'pushup', 'Incline Chest Press Machine':'pushup',
  'Smith Machine Bench Press':'pushup', 'Pec Deck':'pushup',
  'Close-Grip Bench Press':'diamond_push_up',

  'Lat Pulldown':'pullup', 'Wide-Grip Lat Pulldown':'pullup',
  'Close-Grip Lat Pulldown':'chin_up', 'Assisted Pull-Up Machine':'pullup',
  'Straight-Arm Pulldown':'front_lever_tuck',

  'Barbell Bent-Over Row':'wide_inverted_row', 'Pendlay Row':'wide_inverted_row',
  'T-Bar Row':'wide_inverted_row', 'Single-Arm Dumbbell Row':'wide_inverted_row',
  'Chest-Supported Dumbbell Row':'wide_inverted_row', 'Seated Cable Row':'wide_inverted_row',
  'Machine Row':'wide_inverted_row',

  'Back Squat':'bodyweight_squat', 'Front Squat':'bodyweight_squat',
  'Box Squat':'bodyweight_squat', 'Smith Machine Squat':'bodyweight_squat',
  'Hack Squat':'bodyweight_squat', 'Leg Press':'bodyweight_squat',
  'Belt Squat':'bodyweight_squat', 'Goblet Squat':'bodyweight_squat',
  'Leg Extension':'bodyweight_squat',

  'Lying Leg Curl':'nordic_curl', 'Seated Leg Curl':'nordic_curl',
  'Romanian Deadlift':'single_leg_rdl', 'Stiff-Leg Deadlift':'single_leg_rdl',
  'Dumbbell Romanian Deadlift':'single_leg_rdl', 'Good Morning':'single_leg_rdl',
  'Deadlift':'single_leg_rdl', 'Rack Pull':'single_leg_rdl',

  'Barbell Overhead Press':'pike_push_up', 'Seated Dumbbell Shoulder Press':'pike_push_up',
  'Arnold Press':'pike_push_up', 'Shoulder Press Machine':'pike_push_up',
  'Landmine Press':'pike_push_up',

  'Barbell Hip Thrust':'glute_bridge', 'Barbell Glute Bridge':'glute_bridge',
  'Cable Glute Kickback':'single_leg_bridge', '45-Degree Back Extension':'glute_bridge',
  'Reverse Hyperextension':'glute_bridge',

  'Barbell Bulgarian Split Squat':'bulgarian_split', 'Dumbbell Walking Lunge':'bulgarian_split',
  'Reverse Lunge':'bulgarian_split', 'Dumbbell Step-Up':'bulgarian_split',

  'Standing Calf Raise':'kot_calf', 'Seated Calf Raise':'kot_calf',

  'Cable Crunch':'forearm_plank', 'Machine Crunch':'forearm_plank',
  'Weighted Decline Sit-Up':'sit_up', 'Ab Wheel Rollout':'forearm_plank',
  'Pallof Press':'side_plank', 'Landmine Twist':'russian_twist',
  'Weighted Russian Twist':'russian_twist', 'Weighted Plank':'forearm_plank',

  "Farmer's Walk":'farmers_carry', 'Box Jump':'jump_squat',
  'Power Clean':'kb_swing', 'Hang Clean':'kb_swing', 'Barbell High Pull':'kb_high_pull',
  'Push Press':'pike_push_up', 'Push Jerk':'pike_push_up',
};

/* ------------------------------------------------------------
   shared derivations
   ------------------------------------------------------------ */
const UNILATERAL = /single-arm|single-leg|one-arm|concentration|bulgarian|step-up|suitcase|pistol|shrimp|windmill|bent press/i;
const ALTERNATING = /walking lunge|alternating|cossack|see-saw|gorilla|renegade|figure-8|around-the-body|tactical/i;

function lateralityOf(name, given) {
  if (given) return given;
  if (ALTERNATING.test(name)) return 'alternating';
  if (UNILATERAL.test(name))  return 'unilateral';
  return 'bilateral';
}

function demandsOf(pats, name) {
  const n = name.toLowerCase(), d = new Set();
  if (pats.includes('v-push') || /overhead|press|snatch|jerk|halo/.test(n)) d.add('overhead-rom');
  if (pats.some(p => ['squat','lunge'].includes(p)) || /squat|lunge|step-up/.test(n)) d.add('deep-knee-flexion');
  if (pats.includes('hinge') || /deadlift|rdl|swing|clean|good morning|hinge|extension/.test(n)) d.add('hip-hinge');
  if (/push-up|plank|renegade|rollout|handles/.test(n)) d.add('wrist-extension');
  if (pats.includes('carry') || /carry|walk|swing|row|pulldown|curl|grip|hold/.test(n)) d.add('grip');
  if (/pull-up|pulldown|chin/.test(n)) d.add('hang');
  if (/jump|box|sprint|plyo/.test(n)) d.add('impact');
  if (/burpee|devil|man maker|get-up|turkish/.test(n)) d.add('floor-to-stand');
  return [...d];
}

function contraOf(dem, pats, name, given) {
  if (given && given.length) return given;
  const n = name.toLowerCase(), c = new Set();
  if (dem.includes('overhead-rom') || dem.includes('hang')) c.add('shoulder');
  if (dem.includes('wrist-extension')) c.add('wrist');
  if (dem.includes('deep-knee-flexion')) c.add('knee');
  if (dem.includes('impact')) { c.add('knee'); c.add('ankle'); }
  if (dem.includes('hip-hinge')) c.add('lower-back');
  if (/curl|extension|pushdown|skull|preacher/.test(n)) c.add('elbow');
  if (/crunch|sit-up|rollout|twist|hyperextension/.test(n)) c.add('lower-back');
  return [...c];
}

const MODALITY_BY_KIT = [
  ['machine', 'machine'], ['cable', 'cable'], ['bb', 'barbell'], ['kb', 'kettlebell'],
  ['db', 'dumbbell'], ['band', 'band'], ['sled', 'other'], ['ropes', 'other'], ['box', 'other'],
];
function modalityOf(equip) {
  for (const [k, m] of MODALITY_BY_KIT) if (equip.includes(k)) return m;
  return 'bodyweight';
}

/* functional = a real-world, multi-joint, transferable pattern.
   Machines and single-joint isolation are not; free-weight compounds are. */
const ISOLATION = /curl|extension|pushdown|raise|fly|crossover|pec deck|shrug|kickback|pullover|wrist|skull|crunch|abduction|adduction|calf raise|leg curl|leg extension/i;
function functionalOf(name, modality, pats) {
  const n = name.toLowerCase();
  if (modality === 'machine' || modality === 'cable') return 'FALSE';
  if (ISOLATION.test(n)) return 'FALSE';
  if (/smith/.test(n)) return 'FALSE';
  return 'TRUE';
}

const blankRow = () => ({
  id: '', name: '', modality: '', functional: '', is_skill: 'FALSE',
  patterns: '', muscles_primary: '', muscles_secondary: '', laterality: '',
  measure: 'reps', dual: 'FALSE', loading: 'external-load', loadable: 'TRUE',
  sec_per_rep: 3, plyo: 'FALSE', role: 'working-set', level: '', diff: '',
  cns: 'moderate', ess: 'FALSE', track: '', rank: '', families: '', subs: '',
  bridges_to: '', equipment: '', space: 'floor', demands: '', contra: '',
  fundamental: '', fund_no: '', fund_family: '', card: '', art: 'missing',
  calib_beg: '', calib_int: '', calib_adv: '', calib_unit: 'reps',
  no_pr: 'FALSE', cue: '', standard: '', review: '', status: 'AUTO',
});

/* ------------------------------------------------------------
   KETTLEBELL
   ------------------------------------------------------------ */
export function kettlebellRows() {
  const F = ['id','name','patterns','muscles_primary','muscles_secondary','laterality','measure',
             'level','diff','bells','sec_per_rep','contra','cue','standard'];
  const fund = new Set(KB.kb_fundamental);
  const trackOf = {};
  for (const [t, members] of Object.entries(KB.tracks))
    members.forEach((id, i) => { trackOf[id] = [t, i + 1]; });

  const out = [];
  for (const arr of KB.movements) {
    const r = Object.fromEntries(F.map((k, i) => [k, arr[i]]));
    if ((DEC.kettlebell[r.id] || 'yes') === 'no') continue;      // silence = keep
    const pats = split(r.patterns);
    const dem  = demandsOf(pats, r.name);
    const [t, rank] = trackOf[r.id] || ['', ''];
    const row = blankRow();
    Object.assign(row, {
      id: r.id, name: r.name,
      modality: 'kettlebell', functional: 'TRUE',
      patterns: r.patterns,
      muscles_primary: r.muscles_primary, muscles_secondary: r.muscles_secondary,
      laterality: r.laterality, measure: r.measure,
      loading: 'external-load', loadable: 'TRUE',
      sec_per_rep: r.sec_per_rep ?? '',
      plyo: /jump|jerk|push press/.test(r.name.toLowerCase()) ? 'TRUE' : 'FALSE',
      role: 'working-set',
      level: r.level, diff: r.diff,
      cns: r.diff >= 8 ? 'high' : r.diff >= 5 ? 'moderate' : 'low',
      ess: fund.has(r.id) ? 'TRUE' : 'FALSE',
      track: t, rank,
      families: fund.has(r.id) ? 'kettlebell-fundamental' : '',
      equipment: 'kb',
      space: 'floor',
      demands: dem.join(', '),
      contra: r.contra,
      calib_unit: r.measure === 'hold' ? 'secs'
                : r.laterality === 'unilateral' ? 'reps_per_side' : 'reps',
      cue: r.cue, standard: r.standard,
      status: 'NEW',
    });
    row.bells = r.bells;
    out.push(row);
  }
  return out;
}

/* ------------------------------------------------------------
   GYM — only the ones Nicolas said yes to
   ------------------------------------------------------------ */
const OLYMPIC = /clean|snatch|jerk|push press/i;
const BIG_COMPOUND = /back squat|front squat|deadlift|bench press|overhead press|bent-over row|pendlay|rack pull|good morning|hip thrust/i;

export function gymRows() {
  const out = [];
  for (const [cat, name, equip, pattern, muscles] of GYM.movements) {
    const ans = DEC.gym[name];
    if (ans === 'no') continue;
    if (ans !== 'yes' && ans !== 'later' && ans !== undefined) continue;
    if (ans === 'later') continue;
    if (ans === undefined && name !== 'Deadlift') continue;   // unanswered = not in

    const n = name.toLowerCase();
    const equipment = split(equip);
    const modality  = modalityOf(equipment);
    const pats      = split(pattern);
    const dem       = demandsOf(pats, name);

    const level = OLYMPIC.test(n) ? 'adv'
                : BIG_COMPOUND.test(n) ? 'int'
                : ISOLATION.test(n) || modality === 'machine' ? 'beg' : 'int';
    const diff  = OLYMPIC.test(n) ? 8
                : BIG_COMPOUND.test(n) ? 6
                : ISOLATION.test(n) ? 2
                : modality === 'machine' ? 3 : 5;
    const isCardio = cat === 'CONDITIONING' && modality === 'machine';

    const row = blankRow();
    Object.assign(row, {
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
      name,
      modality,
      functional: functionalOf(name, modality, pats),
      patterns: pattern,
      muscles_primary: muscles,
      laterality: lateralityOf(name),
      measure: isCardio || /walk|carry/.test(n) ? 'hold' : 'reps',
      loading: /assisted/.test(n) ? 'assisted' : 'external-load',
      loadable: isCardio ? 'FALSE' : 'TRUE',
      sec_per_rep: isCardio ? '' : OLYMPIC.test(n) ? 4 : BIG_COMPOUND.test(n) ? 4 : ISOLATION.test(n) ? 2 : 3,
      plyo: /jump/.test(n) ? 'TRUE' : 'FALSE',
      role: isCardio ? 'working-set, conditioning' : 'working-set',
      level, diff,
      cns: OLYMPIC.test(n) || BIG_COMPOUND.test(n) ? 'high' : ISOLATION.test(n) ? 'low' : 'moderate',
      ess: BIG_COMPOUND.test(n) ? 'TRUE' : 'FALSE',
      families: cat.toLowerCase(),
      bridges_to: BRIDGE[name] || '',
      equipment: equip,
      space: modality === 'machine' || modality === 'cable' ? 'machine'
           : equipment.includes('bench') ? 'bench'
           : equipment.includes('rack') ? 'bar' : 'floor',
      demands: dem.join(', '),
      contra: contraOf(dem, pats, name).join(', '),
      calib_unit: isCardio ? 'metres' : lateralityOf(name) === 'unilateral' ? 'reps_per_side' : 'reps',
      status: 'NEW',
      review: 'level, diff, cue',                 // gym entries still need a human pass
    });
    out.push(row);
  }
  return out;
}

/* ------------------------------------------------------------
   FUNDAMENTAL ADDITIONS — movements the 15/30/50 list promised
   and the database did not hold.
   ------------------------------------------------------------ */
export function additionRows() {
  const F = ['id','name','modality','patterns','muscles_primary','muscles_secondary',
             'laterality','measure','level','diff','sec_per_rep','contra','cue','standard'];
  return ADDS.movements.map(arr => {
    const r = Object.fromEntries(F.map((k, i) => [k, arr[i]]));
    const pats = split(r.patterns);
    const dem  = demandsOf(pats, r.name);
    const row  = blankRow();
    const kit  = r.modality === 'bodyweight' ? 'bw'
               : r.modality === 'band' ? 'band'
               : r.modality === 'dumbbell' ? 'db' : 'bw';
    Object.assign(row, {
      id: r.id, name: r.name,
      modality: r.modality,
      functional: 'TRUE',
      patterns: r.patterns,
      muscles_primary: r.muscles_primary, muscles_secondary: r.muscles_secondary,
      laterality: r.laterality, measure: r.measure,
      loading: r.modality === 'bodyweight' ? 'bodyweight' : 'external-load',
      loadable: r.modality === 'bodyweight' ? 'FALSE' : 'TRUE',
      sec_per_rep: r.sec_per_rep,
      plyo: 'FALSE',
      role: 'working-set',
      level: r.level, diff: r.diff,
      cns: r.diff >= 8 ? 'high' : r.diff >= 5 ? 'moderate' : 'low',
      ess: 'TRUE',
      equipment: kit,
      space: 'floor',
      demands: dem.join(', '),
      contra: r.contra,
      calib_unit: r.measure === 'hold' ? 'secs'
                : r.laterality === 'unilateral' ? 'reps_per_side' : 'reps',
      cue: r.cue, standard: r.standard,
      status: 'NEW',
    });
    return row;
  });
}

export const bridgeMap = BRIDGE;
export const kbMergeInto = KB.merge_into_existing;
