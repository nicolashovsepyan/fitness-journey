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

/* ---- SECOND USER · beginner program ----
   Three fixed gym days on non-consecutive days, plus one sport session
   and daily walks tracked as habits (not as sessions). Deliberately the
   SAME three workouts every week — nothing to memorise, nothing to choose. */
export const BEGINNER_PROGRAM = {
  id: 'beginner_return',
  name: 'Come Back Strong',
  phases: ['Show up'],
  phaseWeeks: 52,
  defaultDuration: 45,
  fixed: true,                         // never rescaled by a duration picker
  introWeeks: 2,                       // weeks 1-2: the extra pairs default to "skip" (still visible)
  week: [
    { day: 1, sessionId: 'b_upper_1' },
    { day: 2, sessionId: 'b_upper_2' },
    { day: 3, sessionId: 'b_full_3' },
  ],
  /* which weekdays the three sessions land on (0 = Sunday). He picks one. */
  schedules: {
    mwf: { label: 'Mon · Wed · Fri', days: [1, 3, 5] },
    tts: { label: 'Tue · Thu · Sat', days: [2, 4, 6] },
  },
  defaultSchedule: 'mwf',
  habits: [
    { id: 'walk',    label: '20 min walk after a meal',    daily: true },
    { id: 'no8pm',   label: 'No eating after 8pm',         daily: true },
    { id: 'protein', label: 'First meal was high protein', daily: true },
    { id: 'sport',   label: 'Sport session',               daily: false, note: 'weekly — tick it on the day you do it' },
  ],
  longWalk: 'One 1-hour walk on Saturday or Sunday',
};

/* All programs, by id. A user record points at one of these. */
export const PROGRAMS = {
  main: PROGRAM,
  beginner_return: BEGINNER_PROGRAM,
};

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

/* Second user — full commercial gym, knee under rehab.
   `gymLibrary: true` is what unlocks the machine/cable movements in
   exercises-gym.js; without it they stay hidden, which is what keeps
   the two libraries from bleeding into each other. */
export const BEGINNER_PROFILE = {
  units: 'lb',
  gymLibrary: true,                    // unlocks the machine/cable movements
  equipment: ['bw', 'db', 'bb', 'band', 'bench', 'rack', 'pullupbar', 'machine', 'cable', 'kb', 'mat'],
  constraints: { knee: 'no running, no jumping, no deep knee flexion under load' },
  goals: [
    { id: 'habit',    name: 'Show up three times a week',   focus: 'high' },
    { id: 'muscle',   name: 'Build muscle, armour the joints', focus: 'high' },
    { id: 'fat_loss', name: 'Lose weight over time',        focus: 'med' },
  ],
};
