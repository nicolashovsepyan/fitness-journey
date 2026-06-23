/* ============================================================
   DATA — SESSION LIBRARY
   Nicolas's 5 vetted days, encoded with an explicit FORMAT on every
   block. The Day view scales these to 20/30/45/60 (add/remove blocks);
   Work Mode runs each block via its format's renderer.

   block: { role: Primer|Work|Finisher, format: <formatId>, name, note,
            items: [{ ex: <exerciseId>, ...prescription }] }
   prescription fields are format-dependent (sets/reps/rest/tempo/hold/
   perSide/toFailure/minutes/rounds…). Base values = 30-min Foundation;
   progression scales them later.
   ============================================================ */

export const SESSIONS = {

  /* ---- Day 1 · Quads & Knees (Lower A — hypertrophy + knees) ---- */
  quads_knees: {
    id: 'quads_knees', name: 'Quads & Knees', category: 'quad', pattern: 'lower',
    coreDominant: false, tags: ['hypertrophy', 'knee-armor'], locked: true,
    blocks: [
      { role: 'Primer', format: 'circuit', name: 'Knee Armor Circuit', note: '2 rounds, controlled', rounds: 2,
        items: [
          { ex: 'touchdown_squat', reps: 25, perSide: true },
          { ex: 'tibialis_raise', reps: 25 },
          { ex: 'kot_calf', reps: 50 },
          { ex: 'slant_pulse', reps: 20 },
        ] },
      { role: 'Work', format: 'yates', name: 'Bulgarian Split Squat', note: 'To failure, per side · 3 sets base (up to 4 on strong days)', anchor: true, filler: true,
        items: [{ ex: 'bulgarian_split', reps: 10, perSide: true, toFailure: true, warmups: 2 }] },
      { role: 'Work', format: 'tempo', name: 'Slant-Board Squat', note: 'Strength, tempo 3-1-1', anchor: true, filler: true,
        items: [{ ex: 'slant_board_squat', sets: 3, reps: 6, rest: 90, tempo: '311' }] },
      { role: 'Work', format: 'straight', name: 'Assisted Reverse Nordic Curl', note: 'Quad eccentric · limited rest · 3rd anchor', anchor: true,
        items: [{ ex: 'reverse_nordic', sets: 3, reps: 8, rest: 45 }] },
      { role: 'Finisher', format: 'circuit', name: 'Iso Burner — Horse Stance + Side Plank', note: '3 rounds, continuous (no rest)', rounds: 3, transition: 0, roundRest: 0,
        items: [
          { ex: 'horse_stance', hold: 40 },
          { ex: 'side_plank', hold: 30, side: 'R' },
          { ex: 'side_plank', hold: 30, side: 'L' },
        ] },
    ],
    scaling: {
      20: 'Anchors kept (~2 sets each); primer → 1 round; finisher → 2 rounds',
      30: 'As written (base)',
      45: 'Add a 2nd quad accessory + mobility finish',
      60: 'Add 2 quad accessories + hip-flexor work + mobility (TBD)',
    },
  },

  /* ---- Day 2 · Push & Handstand (Upper A) ---- */
  push_handstand: {
    id: 'push_handstand', name: 'Push & Handstand', category: 'push_skill', pattern: 'upper',
    coreDominant: true, tags: ['push', 'skill'], locked: true,
    blocks: [
      { role: 'Primer', format: 'circuit', name: 'Core + Compression Prep', note: '2 rounds · handstand-ready', rounds: 2,
        items: [
          { ex: 'long_lever_plank', hold: 30 },
          { ex: 'walk_up_plank', reps: 8 },
          { ex: 'side_plank', hold: 30, perSide: true },
          { ex: 'shoulder_tap', reps: 20 },
          { ex: 'pike_compression', reps: 10 },
        ] },
      { role: 'Work', format: 'skill', name: 'Handstand Practice', note: 'Fresh — quality over fatigue', anchor: true,
        items: [
          { ex: 'kick_up_practice', minutes: 2 },
          { ex: 'wall_handstand_hold', sets: 3, hold: 30, rest: 45 },
          { ex: 'handstand', minutes: 2 },
        ] },
      { role: 'Work', format: 'yates', name: 'Deep Parallette Pike Push-Up', note: 'To failure', anchor: true, filler: true,
        items: [{ ex: 'deep_pike_pushup', reps: 8, toFailure: true, warmups: 2 }] },
      { role: 'Work', format: 'straight', name: 'Weighted Dip', note: 'Strength · 1 warm-up (8-10) → 3 × 5', anchor: true, filler: true,
        items: [{ ex: 'weighted_dip', sets: 3, reps: 5, rest: 150, warmups: 1, warmupReps: 10 }] },
      { role: 'Finisher', format: 'amrap', name: 'Push-Up AMRAP', note: 'Volume', minutes: 3,
        items: [{ ex: 'pushup', target: 'MAX' }] },
    ],
    scaling: {
      20: 'Anchors only (Handstand + Pike + Dip); primer → 1 round; short AMRAP',
      30: 'As written (base)',
      45: 'Add a push accessory (rotating) + wrist/shoulder mobility',
      60: 'Add push accessory + extra handstand/press skill + wrist/shoulder mobility',
    },
    queued: ['ring_pushup'],   // Phase-2 anchor: swaps in for pike
  },

  /* ---- Day 3 · Hinge & Posterior (Lower B — strength) ---- */
  hinge_posterior: {
    id: 'hinge_posterior', name: 'Hinge & Posterior', category: 'hinge', pattern: 'lower',
    coreDominant: false, tags: ['strength', 'posterior', 'size'], locked: true,
    blocks: [
      { role: 'Primer', format: 'straight', name: 'Glute Activation', note: 'Sidewalks (continuous) + bird dogs',
        items: [
          { ex: 'banded_sidewalk', sets: 1, hold: 120, rest: 15 },
          { ex: 'bird_dog_crunch', sets: 2, reps: 8, perSide: true, rest: 20 },
        ] },
      { role: 'Work', format: 'straight', name: 'Hip Thrust', note: 'Strength loader — add load weekly', anchor: true, filler: true,
        items: [{ ex: 'hip_thrust', sets: 4, reps: 5, rest: 150 }] },
      { role: 'Work', format: 'straight', name: 'Single-Leg RDL', note: 'Size — per side, progress load/reps · alternating sides = built-in rest', anchor: true,
        items: [{ ex: 'single_leg_rdl', sets: 3, reps: 8, rest: 90, perSide: true }] },
      { role: 'Work', format: 'straight', name: 'Nordic Curl', note: 'Hamstring eccentric — progress ROM → load · 3rd anchor', anchor: true, filler: true,
        items: [{ ex: 'nordic_curl', sets: 3, reps: 6, rest: 90 }] },
      { role: 'Finisher', format: 'tabata', name: 'Tabata — Swing + Jump Squat', note: '20/10, 5 cycles (~5 min)', rounds: 5, work: 20, rest: 10,
        items: [
          { ex: 'db_swing' },
          { ex: 'jump_squat' },
        ] },
    ],
    scaling: {
      20: 'Anchors only (Hip Thrust + Single-Leg RDL + Nordic); primer → sidewalks only',
      30: 'As written (base)',
      45: 'Add a posterior accessory (good-morning / back-ext) + hip mobility',
      60: 'Add accessory + core + hip mobility',
    },
  },

  /* ---- Day 4 · Pull & Front Lever (Upper B — forearm-smart) ---- */
  pull_frontlever: {
    id: 'pull_frontlever', name: 'Pull & Front Lever', category: 'pull', pattern: 'upper',
    coreDominant: false, tags: ['pull', 'skill'], constraint: 'forearm: supinated/neutral only', locked: true,
    blocks: [
      { role: 'Primer', format: 'straight', name: 'Pulling Prep', note: 'Forearm-light',
        items: [
          { ex: 'banded_pullapart', sets: 1, reps: 20, rest: 10 },
          { ex: 'scap_pullup', sets: 1, reps: 15, rest: 0 },
          { ex: 'active_hang', sets: 1, hold: 30, rest: 20, note: 'unbroken, straight after scap pulls' },
          { ex: 'dragon_flag', sets: 1, hold: 30, rest: 15 },
        ] },
      { role: 'Work', format: 'skill', name: 'Front Lever', note: 'TUT holds · advanced-tuck or banded straddle (set Week 1)', anchor: true,
        items: [{ ex: 'front_lever_tuck', sets: 5, hold: 10, rest: 60 }] },
      { role: 'Work', format: 'straight', name: 'Weighted Chin-Up', note: 'Strength · supinated · 1 warm-up (8-10) → 3 × 5', anchor: true, filler: true,
        items: [{ ex: 'weighted_chinup', sets: 3, reps: 5, rest: 150, warmups: 1, warmupReps: 10 }] },
      { role: 'Work', format: 'straight', name: 'Single-Arm Row', note: 'Horizontal · unilateral · per side · alternating sides = built-in rest', anchor: true,
        items: [{ ex: 'single_arm_row', sets: 3, reps: 8, rest: 90, perSide: true }] },
      { role: 'Finisher', format: 'amrap', name: 'L-Sit Pull-ups + Skin the Cat', note: '5 min, minimal rest',
        items: [
          { ex: 'l_sit_pullup', reps: 5 },
          { ex: 'skin_the_cat', reps: 5 },
        ], minutes: 5 },
    ],
    scaling: {
      20: 'Anchors only (Front Lever + Chin-Up + Single-Arm Row); primer → pull-aparts + 1 hang',
      30: 'As written (base)',
      45: 'Add a pulling accessory + thoracic/shoulder mobility',
      60: 'Add accessory + extra front-lever skill work + mobility',
    },
  },

  /* ---- Day 5 · Full Body Engine (conditioning + volume, leg-biased) ---- */
  full_body_engine: {
    id: 'full_body_engine', name: 'Full Body Engine', category: 'full_body', pattern: 'full',
    coreDominant: true, tags: ['conditioning', 'volume', 'tension'], locked: true,
    variant: 'Tension + Explosive',   // Day-5 Option #1 of a rotating menu
    blocks: [
      { role: 'Work', format: 'amrap', name: 'Block 1 · Tempo AMRAP', note: '15 min, target ~4 rounds — all 5 patterns', minutes: 15,
        items: [
          { ex: 'chin_up',            reps: 5,  tempo: '5s hold / 5s down / 5s dead-hang' },
          { ex: 'dip',                reps: 5,  note: '0:20 bottom hold, then 5 slow' },
          { ex: 'goblet_squat',       reps: 8,  tempo: 'slow + pause' },
          { ex: 'banded_glute_bridge', hold: 30 },
          { ex: 'l_sit',              hold: 20 },
        ] },
      { role: 'Work', format: 'tabata', name: 'Block 2 · Explosive Intervals', note: '40s on / 20s off · ~3 rounds · all 5 patterns', work: 40, rest: 20, rounds: 3,
        items: [
          { ex: 'explosive_chinup' },
          { ex: 'deadstop_pushup' },
          { ex: 'jump_squat' },
          { ex: 'db_swing' },
          { ex: 'mountain_climber' },
        ] },
    ],
    scaling: {
      20: 'Block 1 only (~12 min) + 5-min explosive',
      30: 'As written (2 × 15)',
      45: 'Add a 3rd round / longer blocks',
      60: 'Add a strength-skill block up front',
    },
  },
};

export const session = (id) => SESSIONS[id];
