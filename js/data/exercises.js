/* ============================================================
   DATA — EXERCISE LIBRARY (pure content)
   Schema per exercise:
     name        display name
     pattern     quad | hinge | glute | hamstring | calf | shin |
                 push | pull | core | skill | conditioning | full
     equipment   array: bw db bb rings parallettes band vest slantboard
                 rack pullupbar bench sliders
     measure     reps | hold | cals
     load        bw | weighted
     laterality  bilateral | unilateral
     grip        (pull only) supinated | neutral | pronated   [forearm-smart]
     noPR        true -> never a PR (warm-up / activation / mobility)
     demoUrl     null for now (exercise demo videos come later)
     cues        short coaching note
   Adding an exercise = adding a row here. Nothing else changes.
   ============================================================ */

export const EXERCISES = {
  /* ---------- LOWER: quad / knee ---------- */
  touchdown_squat:   { name: 'Touchdown Squat',     pattern: 'quad',      equipment: ['bw'],                  measure: 'reps', load: 'bw',       laterality: 'unilateral', noPR: true, demoUrl: null, cues: 'Knees-over-toes, controlled reach.' },
  tibialis_raise:    { name: 'Tibialis Raise',      pattern: 'shin',      equipment: ['bw'],                  measure: 'reps', load: 'bw',       laterality: 'bilateral',  noPR: true, demoUrl: null, cues: 'Toes up against wall, full ROM.' },
  kot_calf:          { name: 'KOT Calf Raise',      pattern: 'calf',      equipment: ['bw'],                  measure: 'reps', load: 'bw',       laterality: 'bilateral',  noPR: true, demoUrl: null, cues: 'Knees-over-toes calf, deep stretch.' },
  slant_pulse:       { name: 'Slant Squat Pulses',  pattern: 'quad',      equipment: ['slantboard'],          measure: 'reps', load: 'bw',       laterality: 'bilateral',  noPR: true, demoUrl: null, cues: 'Heels elevated, small quad pulses.' },
  bulgarian_split:   { name: 'Bulgarian Split Squat', pattern: 'quad',    equipment: ['db', 'vest', 'bench'], measure: 'reps', load: 'weighted', laterality: 'unilateral', demoUrl: null, cues: 'Front-foot loaded, knee tracks toes.' },
  slant_board_squat: { name: 'Slant-Board Squat',   pattern: 'quad',      equipment: ['slantboard', 'vest'],  measure: 'reps', load: 'weighted', laterality: 'bilateral',  demoUrl: null, cues: 'Tempo 311, full depth, heels raised.' },
  horse_stance:      { name: 'Horse Stance',        pattern: 'quad',      equipment: ['bw'],                  measure: 'hold', load: 'bw',       laterality: 'bilateral',  demoUrl: null, cues: 'Thighs parallel, isometric hold.' },
  reverse_nordic:    { name: 'Assisted Reverse Nordic Curl', pattern: 'quad', equipment: ['bw', 'band'],     measure: 'reps', load: 'bw',       laterality: 'bilateral',  demoUrl: null, cues: 'Knees-over-toes eccentric; assist with band or hands.' },
  sissy_squat:       { name: 'Sissy Squat',         pattern: 'quad',      equipment: ['bw'],                  measure: 'reps', load: 'bw',       laterality: 'bilateral',  demoUrl: null, cues: 'Knees forward, lean back — quad-focused. (future anchor)' },

  /* ---------- LOWER: hinge / glute / hamstring ---------- */
  banded_glute_bridge:{ name: 'Banded Glute Bridge', pattern: 'glute',    equipment: ['band'],                measure: 'reps', load: 'bw',       laterality: 'bilateral',  noPR: true, demoUrl: null, cues: 'Drive knees out, squeeze top.' },
  banded_sidewalk:   { name: 'Banded Lateral Walks', pattern: 'glute',    equipment: ['band'],                measure: 'hold', load: 'bw',       laterality: 'bilateral',  noPR: true, demoUrl: null, cues: 'Band at knees, stay low, continuous side-steps.' },
  single_leg_rdl:    { name: 'Single-Leg RDL',      pattern: 'hinge',     equipment: ['db'],                  measure: 'reps', load: 'weighted', laterality: 'unilateral', demoUrl: null, cues: 'Hinge on one leg, square hips, hamstring stretch.' },
  jump_squat:        { name: 'Jump Squats',         pattern: 'quad',      equipment: ['bw'],                  measure: 'reps', load: 'bw',       laterality: 'bilateral',  demoUrl: null, cues: 'Explode up, soft landing, reset.' },
  single_leg_bridge: { name: 'Single-Leg Bridge',   pattern: 'glute',     equipment: ['bw'],                  measure: 'reps', load: 'bw',       laterality: 'unilateral', noPR: true, demoUrl: null, cues: 'Hips level, full extension.' },
  bird_dog:          { name: 'Bird Dog',            pattern: 'core',      equipment: ['bw'],                  measure: 'reps', load: 'bw',       laterality: 'unilateral', noPR: true, demoUrl: null, cues: 'Opposite arm/leg, no rotation.' },
  bird_dog_crunch:   { name: 'Bird Dog Crunch',     pattern: 'core',      equipment: ['bw'],                  measure: 'reps', load: 'bw',       laterality: 'unilateral', noPR: true, demoUrl: null, cues: 'Extend, then draw elbow-to-knee under body.' },
  romanian_deadlift: { name: 'Romanian Deadlift',   pattern: 'hinge',     equipment: ['bb', 'rack'],          measure: 'reps', load: 'weighted', laterality: 'bilateral',  demoUrl: null, cues: 'Hinge, soft knees, hamstring stretch.' },
  deadlift:          { name: 'Deadlift',            pattern: 'hinge',     equipment: ['bb'],                  measure: 'reps', load: 'weighted', laterality: 'bilateral',  demoUrl: null, cues: 'Brace, push floor away, neutral spine.' },
  hip_thrust:        { name: 'Hip Thrust',          pattern: 'glute',     equipment: ['bb', 'bench'],         measure: 'reps', load: 'weighted', laterality: 'bilateral',  demoUrl: null, cues: 'Chin tucked, full lockout, glute squeeze.' },
  sliding_ham_curl:  { name: 'Sliding Hamstring Curl', pattern: 'hamstring', equipment: ['sliders'],          measure: 'reps', load: 'bw',       laterality: 'bilateral',  demoUrl: null, cues: 'Hips up, slow eccentric.' },
  nordic_curl:       { name: 'Nordic Curl',         pattern: 'hamstring', equipment: ['bw', 'band'],          measure: 'reps', load: 'bw',       laterality: 'bilateral',  demoUrl: null, cues: 'Control the eccentric; progress ROM → load.' },
  db_swing:          { name: 'Dumbbell Swing',      pattern: 'hinge',     equipment: ['db'],                  measure: 'reps', load: 'weighted', laterality: 'bilateral',  demoUrl: null, cues: 'Hip snap, not a squat. (KB→DB)' },
  goblet_squat:      { name: 'Goblet Squat',        pattern: 'quad',      equipment: ['db'],                  measure: 'reps', load: 'weighted', laterality: 'bilateral',  demoUrl: null, cues: 'Elbows inside knees, upright torso.' },

  /* ---------- PUSH ---------- */
  handstand:         { name: 'Freestanding Attempts', pattern: 'skill',   equipment: ['bw'],                  measure: 'hold', load: 'bw',       laterality: 'bilateral',  noPR: true, demoUrl: null, cues: 'Kick to balance, ride it as long as you can, bail safely.' },
  wall_handstand_hold:{ name: 'Wall Handstand Hold', pattern: 'skill',    equipment: ['bw'],                  measure: 'hold', load: 'bw',       laterality: 'bilateral',  demoUrl: null, cues: 'Chest-to-wall, stack shoulders over wrists, hollow body, point toes.' },
  kick_up_practice:  { name: 'Kick-Up Practice',     pattern: 'skill',    equipment: ['bw'],                  measure: 'reps', load: 'bw',       laterality: 'bilateral',  noPR: true, demoUrl: null, cues: 'Freestanding entries — find the balance point, bail to a cartwheel.' },
  deep_pike_pushup:  { name: 'Deep Parallette Pike Push-Up', pattern: 'push', equipment: ['parallettes', 'vest'], measure: 'reps', load: 'bw',   laterality: 'bilateral',  demoUrl: 'https://www.youtube.com/embed/5rncnlcq8Bc', cues: 'Hips stacked, deep ROM off parallettes.' },
  weighted_dip:      { name: 'Weighted Dip',        pattern: 'push',      equipment: ['parallettes', 'vest'], measure: 'reps', load: 'weighted', laterality: 'bilateral',  demoUrl: null, cues: 'Full depth, controlled, lean forward.' },
  ring_pushup:       { name: 'Weighted Deep Ring Push-Up', pattern: 'push', equipment: ['rings', 'vest'], measure: 'reps', load: 'weighted', laterality: 'bilateral', demoUrl: null, cues: 'Deep ROM, turn rings out at top. (Phase-2 push anchor)' },
  pushup:            { name: 'Push-ups',            pattern: 'push',      equipment: ['bw'],                  measure: 'reps', load: 'bw',       laterality: 'bilateral',  demoUrl: null, cues: 'Tight body, full lockout.' },
  dip:               { name: 'Dip',                 pattern: 'push',      equipment: ['parallettes'],         measure: 'reps', load: 'bw',       laterality: 'bilateral',  demoUrl: null, cues: 'Full depth, controlled.' },
  deadstop_pushup:   { name: 'Dead-Stop Push-up',   pattern: 'push',      equipment: ['bw'],                  measure: 'reps', load: 'bw',       laterality: 'bilateral',  demoUrl: null, cues: 'Reset on floor each rep, explode up.' },
  long_lever_plank:  { name: 'Long-Lever Plank',    pattern: 'core',      equipment: ['bw'],                  measure: 'hold', load: 'bw',       laterality: 'bilateral',  noPR: true, demoUrl: null, cues: 'Elbows forward of shoulders, ribs down.' },
  plank_updown:      { name: 'Plank Up-Downs',      pattern: 'core',      equipment: ['bw'],                  measure: 'reps', load: 'bw',       laterality: 'bilateral',  noPR: true, demoUrl: null, cues: 'Minimal hip sway.' },
  walk_up_plank:     { name: 'Walk-Up Planks',      pattern: 'core',      equipment: ['bw'],                  measure: 'reps', load: 'bw',       laterality: 'bilateral',  noPR: true, demoUrl: null, cues: 'Walk hands out to plank and back; long body.' },
  pike_compression:  { name: 'Pike Compression Lifts', pattern: 'core',   equipment: ['bw'],                  measure: 'reps', load: 'bw',       laterality: 'bilateral',  noPR: true, demoUrl: null, cues: 'Seated pike, actively lift/compress legs — handstand prep.' },
  shoulder_tap:      { name: 'Plank Shoulder Taps', pattern: 'core',      equipment: ['bw'],                  measure: 'reps', load: 'bw',       laterality: 'bilateral',  noPR: true, demoUrl: null, cues: 'Hips still, tap opposite shoulder.' },

  /* ---------- PULL (grip flagged for forearm-smart) ---------- */
  scap_pullup:       { name: 'Scapular Pull-ups',   pattern: 'pull',      equipment: ['pullupbar'],           measure: 'reps', load: 'bw',       laterality: 'bilateral',  grip: 'pronated', noPR: true, demoUrl: null, cues: 'Depress/retract scaps, arms straight.' },
  active_hang:       { name: 'Active Hang',         pattern: 'pull',      equipment: ['pullupbar'],           measure: 'hold', load: 'bw',       laterality: 'bilateral',  grip: 'pronated', noPR: true, demoUrl: null, cues: 'Shoulders packed, ribs down.' },
  front_lever_tuck:  { name: 'Front Lever Tuck',    pattern: 'skill',     equipment: ['pullupbar', 'rings'],  measure: 'hold', load: 'bw',       laterality: 'bilateral',  grip: 'pronated', demoUrl: null, cues: 'Gentle while forearm heals. Posterior tilt.' },
  weighted_chinup:   { name: 'Weighted Chin-Up',    pattern: 'pull',      equipment: ['pullupbar', 'vest'],   measure: 'reps', load: 'weighted', laterality: 'bilateral',  grip: 'supinated', demoUrl: null, cues: 'Supinated (forearm-smart). Full ROM.' },
  chin_up:           { name: 'Chin-up',             pattern: 'pull',      equipment: ['pullupbar'],           measure: 'reps', load: 'bw',       laterality: 'bilateral',  grip: 'supinated', demoUrl: null, cues: 'Supinated, full ROM.' },
  explosive_chinup:  { name: 'Explosive Chin-up',   pattern: 'pull',      equipment: ['pullupbar'],           measure: 'reps', load: 'bw',       laterality: 'bilateral',  grip: 'supinated', demoUrl: null, cues: 'Pull fast — chest toward bar.' },
  ring_row:          { name: 'Ring Row',            pattern: 'pull',      equipment: ['rings', 'vest'],       measure: 'reps', load: 'bw',       laterality: 'bilateral',  grip: 'neutral', demoUrl: null, cues: 'Neutral grip, squeeze blades.' },
  banded_pullapart:  { name: 'Banded Pull-Aparts',  pattern: 'pull',      equipment: ['band'],                measure: 'reps', load: 'bw',       laterality: 'bilateral',  grip: 'neutral', noPR: true, demoUrl: null, cues: 'Straight arms, squeeze blades.' },
  single_arm_row:    { name: 'Single-Arm Row',      pattern: 'pull',      equipment: ['db', 'rings'],         measure: 'reps', load: 'weighted', laterality: 'unilateral', grip: 'neutral', demoUrl: null, cues: 'Square hips, drive elbow back, full stretch.' },
  l_sit_pullup:      { name: 'L-Sit Pull-up',       pattern: 'pull',      equipment: ['pullupbar'],           measure: 'reps', load: 'bw',       laterality: 'bilateral',  grip: 'pronated', demoUrl: null, cues: 'Hold the L, full pull — back + core.' },
  skin_the_cat:      { name: 'Skin the Cat',        pattern: 'pull',      equipment: ['rings'],               measure: 'reps', load: 'bw',       laterality: 'bilateral',  grip: 'neutral', noPR: true, demoUrl: null, cues: 'Controlled German-hang rotation; decompress.' },

  /* ---------- CORE ---------- */
  side_plank:        { name: 'Side Plank',          pattern: 'core',      equipment: ['bw'],                  measure: 'hold', load: 'bw',       laterality: 'unilateral', demoUrl: null, cues: 'Stack hips, straight line.' },
  hollow_hold:       { name: 'Hollow Hold',         pattern: 'core',      equipment: ['bw'],                  measure: 'hold', load: 'bw',       laterality: 'bilateral',  demoUrl: null, cues: 'Lumbar pinned, ribs down.' },
  l_sit:             { name: 'L-Sit Hold',          pattern: 'core',      equipment: ['parallettes'],         measure: 'hold', load: 'bw',       laterality: 'bilateral',  demoUrl: null, cues: 'Legs straight, actively compress.' },
  hollow_rocks:      { name: 'Hollow Rocks',        pattern: 'core',      equipment: ['bw'],                  measure: 'reps', load: 'bw',       laterality: 'bilateral',  noPR: true, demoUrl: null, cues: 'Rock from a tight hollow.' },
  dragon_flag:       { name: 'Dragon Flag (Tuck)',  pattern: 'core',      equipment: ['bench'],               measure: 'hold', load: 'bw',       laterality: 'bilateral',  demoUrl: null, cues: 'Hips off, straight line, lower slow.' },
  toes_to_bar:       { name: 'Toes-to-Bar',         pattern: 'core',      equipment: ['pullupbar'],           measure: 'reps', load: 'bw',       laterality: 'bilateral',  grip: 'pronated', demoUrl: null, cues: 'Grip-intensive — mind the forearm.' },

  /* ---------- CONDITIONING / FULL ---------- */
  burpee:            { name: 'Burpee',              pattern: 'full',      equipment: ['bw'],                  measure: 'reps', load: 'bw',       laterality: 'bilateral',  demoUrl: null, cues: 'Chest to floor, full stand.' },
  mountain_climber:  { name: 'Mountain Climbers',   pattern: 'conditioning', equipment: ['bw'],               measure: 'reps', load: 'bw',       laterality: 'bilateral',  demoUrl: null, cues: 'Fast knees, flat back.' },

  /* ---------- MOBILITY (no PR — also used as rest fillers) ---------- */
  thoracic_open:     { name: 'Thoracic Opener',     pattern: 'mobility',  equipment: ['bw'],                  measure: 'hold', load: 'bw',       laterality: 'bilateral',  noPR: true, demoUrl: null, cues: 'Open-book / quadruped reach-through.' },
  chest_stretch:     { name: 'Doorway Chest Stretch', pattern: 'mobility', equipment: ['bw'],                 measure: 'hold', load: 'bw',       laterality: 'bilateral',  noPR: true, demoUrl: null, cues: 'Forearm on frame, rotate away.' },
  shoulder_stretch:  { name: 'Overhead Shoulder Stretch', pattern: 'mobility', equipment: ['bw'],             measure: 'hold', load: 'bw',       laterality: 'bilateral',  noPR: true, demoUrl: null, cues: 'Lat/shoulder stretch, ribs down.' },
  hip_flexor_stretch:{ name: 'Hip-Flexor Stretch',  pattern: 'mobility',  equipment: ['bw'],                  measure: 'hold', load: 'bw',       laterality: 'unilateral', noPR: true, demoUrl: null, cues: 'Tall hips, posterior tilt, per side.' },
  ankle_mobility:    { name: 'Ankle Mobility',      pattern: 'mobility',  equipment: ['bw'],                  measure: 'reps', load: 'bw',       laterality: 'unilateral', noPR: true, demoUrl: null, cues: 'Knee over toe, heel down.' },
  /* movement-based mobility (do reps, not static holds) — used as rest fillers + mobility blocks */
  cat_cow:           { name: 'Cat–Cow',            pattern: 'mobility',  equipment: ['bw'],                  measure: 'reps', load: 'bw',       laterality: 'bilateral',  noPR: true, demoUrl: null, cues: 'Flow spine flexion ↔ extension.' },
  thoracic_rotation: { name: 'Thoracic Rotations',  pattern: 'mobility',  equipment: ['bw'],                  measure: 'reps', load: 'bw',       laterality: 'unilateral', noPR: true, demoUrl: null, cues: 'Quadruped, reach hand to ceiling.' },
  leg_swings:        { name: 'Leg Swings',         pattern: 'mobility',  equipment: ['bw'],                  measure: 'reps', load: 'bw',       laterality: 'unilateral', noPR: true, demoUrl: null, cues: 'Front-back then lateral, controlled.' },
  hip_cars:          { name: 'Hip CARs',           pattern: 'mobility',  equipment: ['bw'],                  measure: 'reps', load: 'bw',       laterality: 'unilateral', noPR: true, demoUrl: null, cues: 'Slow, controlled full hip circles.' },
  deep_squat_rock:   { name: 'Deep Squat Rocks',    pattern: 'mobility',  equipment: ['bw'],                  measure: 'reps', load: 'bw',       laterality: 'bilateral',  noPR: true, demoUrl: null, cues: 'Sit deep, rock side to side.' },
  wrist_prep:        { name: 'Wrist Prep Rocks',    pattern: 'mobility',  equipment: ['bw'],                  measure: 'reps', load: 'bw',       laterality: 'bilateral',  noPR: true, demoUrl: null, cues: 'Rock over wrists, all directions.' },
};

export const ex = (id) => EXERCISES[id];
