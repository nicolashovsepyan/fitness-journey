/* ============================================================
   LAYER 1 — DATA (pure content, zero logic)
   v0.2: the composer builds time-boxed blocks by pulling from
   POOLS here. Every difference is a flag, not code.
   ============================================================ */

/* ---- Goal portfolio (weighted; you rank, engine balances) ---- */
export const GOALS = [
  { id: 'lower_size',   name: 'Lower-body size',           focus: 'high', intent: 'size'      },
  { id: 'strength',     name: 'Strength (upper + lower)',  focus: 'high', intent: 'strength'  },
  { id: 'endurance',    name: 'Rep-max endurance',         focus: 'med',  intent: 'endurance' },
  { id: 'conditioning', name: 'Zone-5 conditioning',       focus: 'low',  intent: 'endurance' },
  { id: 'skill',        name: 'Skills (HS / MU / lever)',  focus: 'med',  intent: 'skill'     },
  { id: 'mobility',     name: 'Mobility / into the stretch', focus: 'low', intent: 'mobility' },
];

/* ---- Exercise library ----
   measure: reps | hold | cals      load: bw | weighted | assisted
   laterality: bilateral | unilateral
   noPR: true  -> never counts as a PR (warm-up / mobility / joint-prep)
   repSec: seconds per rep for time estimation (default 3)            */
export const EXERCISES = {
  // --- push: working compounds ---
  dip:             { name: 'Dips',                 measure: 'reps', load: 'weighted', laterality: 'bilateral', pattern: 'push', repSec: 3 },
  pike_pushup:     { name: 'Pike Push-ups',        measure: 'reps', load: 'bw', laterality: 'bilateral', pattern: 'push', repSec: 3 },
  diamond_pushup:  { name: 'Diamond Push-ups',     measure: 'reps', load: 'bw', laterality: 'bilateral', pattern: 'push', repSec: 3 },
  decline_pushup:  { name: 'Decline Push-ups',     measure: 'reps', load: 'bw', laterality: 'bilateral', pattern: 'push', repSec: 3 },
  archer_pushup:   { name: 'Archer Push-ups',      measure: 'reps', load: 'bw', laterality: 'unilateral', pattern: 'push', repSec: 3 },
  pp_pushup:       { name: 'Pseudo-Planche Push-ups', measure: 'reps', load: 'bw', laterality: 'bilateral', pattern: 'push', repSec: 3 },
  // --- push: lighter / pump (primer & finisher) ---
  pushup:          { name: 'Push-ups',             measure: 'reps', load: 'bw', laterality: 'bilateral', pattern: 'push', repSec: 2 },
  wide_pushup:     { name: 'Wide Push-ups',        measure: 'reps', load: 'bw', laterality: 'bilateral', pattern: 'push', repSec: 2 },
  incline_pushup:  { name: 'Incline Push-ups',     measure: 'reps', load: 'bw', laterality: 'bilateral', pattern: 'push', repSec: 2 },
  shoulder_tap:    { name: 'Shoulder Taps',        measure: 'reps', load: 'bw', laterality: 'bilateral', pattern: 'push', repSec: 2 },
  // --- skill ---
  hs_hold:         { name: 'Handstand Hold',       measure: 'hold', load: 'bw', laterality: 'bilateral', pattern: 'skill' },
  // --- core (finisher TUT) ---
  hollow_hold:     { name: 'Hollow Hold',          measure: 'hold', load: 'bw', laterality: 'bilateral', pattern: 'core' },
  // --- warm-up / joint-prep (no PR) ---
  scap_pushup:     { name: 'Scapular Push-ups',    measure: 'reps', load: 'bw', laterality: 'bilateral', pattern: 'push', noPR: true, repSec: 2 },
  planche_lean:    { name: 'Pseudo-Planche Lean',  measure: 'hold', load: 'bw', laterality: 'bilateral', pattern: 'push', noPR: true },
  // --- mobility (no PR) ---
  chest_stretch:   { name: 'Doorway Chest Stretch', measure: 'hold', load: 'bw', laterality: 'bilateral', pattern: 'mobility', noPR: true },
  thoracic_open:   { name: 'Thoracic Opener',       measure: 'hold', load: 'bw', laterality: 'bilateral', pattern: 'mobility', noPR: true },
  shoulder_stretch:{ name: 'Overhead Shoulder Stretch', measure: 'hold', load: 'bw', laterality: 'bilateral', pattern: 'mobility', noPR: true },
};

/* ---- FUNDAMENTAL = pools the composer draws from per role ---- */
export const PUSH_DAY = {
  id: 'push_day',
  name: 'Push Day',
  pattern: 'push',
  pools: {
    primer:   ['pushup', 'wide_pushup', 'incline_pushup', 'shoulder_tap'],
    work:     ['dip', 'pike_pushup', 'diamond_pushup', 'decline_pushup', 'archer_pushup', 'pp_pushup'],
    finisher: ['pushup', 'dip', 'pike_pushup', 'hollow_hold'],
    mobility: ['chest_stretch', 'thoracic_open', 'shoulder_stretch'],
    skill:    ['hs_hold'],
  },
  // free-flow joint-prep movement cues (not tracked, just prompts)
  jointPrepCues: [
    'Wrist circles', 'Shoulder rolls', 'Arm swings', 'Cat–cow',
    'Scapular push-ups', 'T-spine rotations', 'Band pull-aparts', 'Neck rolls',
  ],
};
export const FUNDAMENTALS = [PUSH_DAY];

/* ---- Time budgets (minutes) per duration ----
   work = total − (jointPrep + primer + finisher + mobility), then
   split into 1–3 work blocks of 5–20 min each.
   These flags are the DEFAULTS; user can toggle on Build Day.       */
export const DURATIONS = [20, 30, 45, 60];
export const BUDGETS = {
  20: { jointPrep: 0, primer: 3, finisher: 3, mobility: 0 },
  30: { jointPrep: 0, primer: 5, finisher: 5, mobility: 0 },
  45: { jointPrep: 3, primer: 5, finisher: 5, mobility: 2 },
  60: { jointPrep: 3, primer: 5, finisher: 5, mobility: 5 },
};

/* ---- Goal-intent → prescription (set/rep/rest), Galpin-aligned ---- */
export const PRESCRIPTION = {
  strength:  { reps: 5,  rest: 150, sets: [3, 5] },
  size:      { reps: 10, rest: 75,  sets: [3, 4] },
  endurance: { reps: 20, rest: 40,  sets: [3, 4] },
  skill:     { reps: 5,  rest: 90,  sets: [3, 4] },
};

export const REP_SEC = 3;          // default seconds per rep for estimation
export const TRANSITION = 8;       // buffer between circuit exercises
export const ROUND_REST = 45;      // rest between circuit rounds (non-AMRAP)

export function ex(id) { return EXERCISES[id]; }
