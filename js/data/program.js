/* ============================================================
   DATA — PROGRAM (your week) + SESSION LIBRARY + PROFILE
   The PROGRAM references sessions by id. The LIBRARY is where new
   day-options get added per category (each grows to its target).
   ============================================================ */

/* Your current week — 5 days, periodized Foundation → Build → Peak */
export const PROGRAM = {
  id: 'main',
  name: 'Foundation Block',
  phases: ['Foundation', 'Build', 'Peak'],
  phaseWeeks: 4,                       // 4 weeks each → 12-week block
  defaultDuration: 30,
  week: [
    { day: 1, sessionId: 'quads_knees' },
    { day: 2, sessionId: 'push_handstand' },
    { day: 3, sessionId: 'hinge_posterior' },
    { day: 4, sessionId: 'pull_frontlever' },
    { day: 5, sessionId: 'full_body_engine' },
  ],
};

/* Library of day-options per category. `target` = how many options we want.
   We add new sessions here over time; the week can swap to any option. */
export const SESSION_LIBRARY = {
  quad:       { label: 'Quad days',          target: '2-3', options: ['quads_knees'] },
  hinge:      { label: 'Glute / Hamstring',  target: '2-3', options: ['hinge_posterior'] },
  push_skill: { label: 'Push + Skill',       target: '2-3', options: ['push_handstand'] },
  push:       { label: 'Push',               target: '2-3', options: [] },
  pull:       { label: 'Pull',               target: '2-3', options: ['pull_frontlever'] },
  push_pull:  { label: 'Push + Pull',        target: '2-3', options: [] },
  full_body:  { label: 'Full Body',          target: '3-4', options: ['full_body_engine'] },
};

/* ---- Rest fillers (non-competing supersets) ----
   A long-rest anchor block with `filler: true` gets a filler attached on the rest timer.
   The engine ROTATES the type per session (mobility → antagonist → core/skill → repeat),
   then picks a specific move — and NEVER one that shares the working block's pattern
   (so the primary muscle still fully rests). Antagonist = the opposite pattern's pool.   */
export const FILLERS = {
  mobility: ['cat_cow', 'thoracic_rotation', 'deep_squat_rock', 'leg_swings', 'hip_cars', 'wrist_prep'],
  push:     ['pushup', 'shoulder_tap'],                         // antagonist for PULL anchors
  pull:     ['banded_pullapart', 'scap_pullup', 'ring_row'],    // antagonist for PUSH anchors
  lower:    ['banded_sidewalk', 'single_leg_bridge', 'bird_dog'],// antagonist for UPPER anchors
  core:     ['hollow_hold', 'hollow_rocks', 'dragon_flag'],     // core/skill filler
};
/* opposite-pattern map for the antagonist pick */
export const ANTAGONIST = { push: 'pull', pull: 'push', upper: 'lower', lower: 'core', quad: 'core', hinge: 'core', glute: 'core' };

/* You — drives defaults, equipment filtering, units, constraints */
export const PROFILE = {
  units: 'lb',                         // kg ⇄ lb toggle, global
  equipment: ['bw', 'db', 'bb', 'rings', 'parallettes', 'band', 'vest', 'slantboard', 'rack', 'pullupbar', 'bench', 'sliders'],
  // no kettlebell — KB movements substitute to dumbbell
  constraints: { forearm: 'supinated_neutral' },
  goals: [
    { id: 'lower_size',   name: 'Lower-body size',           focus: 'high' },
    { id: 'strength',     name: 'Strength (upper + lower)',  focus: 'high' },
    { id: 'endurance',    name: 'Rep-max endurance',         focus: 'med'  },
    { id: 'conditioning', name: 'Zone-5 conditioning',       focus: 'med'  },
    { id: 'skill',        name: 'Skills (handstand / front lever)', focus: 'high' },
    { id: 'mobility',     name: 'Mobility / into the stretch', focus: 'low' },
  ],
};
