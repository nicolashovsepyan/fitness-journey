/* ============================================================
   DATA — GYM / MACHINE EXERCISES (added for the second user)
   Same schema as exercises.js. These are merged into EXERCISES
   by exercises.js, so swap/add/alternatives pick them up for free.

   SEPARATION: exercises.js tags every entry here `gymOnly: true` at
   merge time, and resolve.js hides gymOnly movements from any profile
   without `gymLibrary: true`. Equipment tags alone weren't enough —
   several of these are plain dumbbell/barbell/bodyweight moves that
   Nicolas's profile technically "has", so they'd have leaked into his
   swap lists. Flip `gymLibrary: true` on his PROFILE if he ever wants
   them offered.

   Cues are deliberately plain-language, 1–2 lines, no jargon.
   demoUrl: null → flagged in VIDEO-TODO.md for Nicolas to supply.
   ============================================================ */

export const GYM_EXERCISES = {

  /* ---------- WARM-UP / MOBILITY ---------- */
  arm_circles: {
    name: 'Arm Circles', pattern: 'mobility', equipment: ['bw'], measure: 'reps', workType: 'reps',
    load: 'bw', laterality: 'bilateral', level: 'beg', diff: 1, noPR: true, demoUrl: null,
    cues: 'One arm at a time. Ten big slow circles forward, ten backward. Wakes the shoulder up before you load it.',
  },
  down_dog_up_dog: {
    name: 'Down Dog to Up Dog', pattern: 'mobility', family: 'flow', equipment: ['bw'], measure: 'reps', workType: 'reps',
    load: 'bw', laterality: 'bilateral', level: 'beg', diff: 1, noPR: true, harder: 'down_dog_up_dog_bar', demoUrl: null,
    cues: 'Hips high in an upside-down V, then sweep the chest through and forward until the arms are straight. Hold five seconds at each end.',
  },
  down_dog_up_dog_bar: {
    name: 'Down Dog to Up Dog (hands on bar)', pattern: 'mobility', family: 'flow', equipment: ['rack'], measure: 'reps', workType: 'reps',
    load: 'bw', laterality: 'bilateral', level: 'beg', diff: 1, noPR: true, easier: 'down_dog_up_dog', demoUrl: null,
    cues: 'Same movement with your hands on a hip-height bar instead of the floor. Much easier on the wrists and shoulders.',
  },
  deep_squat_thoracic: {
    name: 'Deep Squat Hold + Chest Opening', pattern: 'mobility', equipment: ['rack'], measure: 'hold', workType: 'hold',
    load: 'bw', laterality: 'bilateral', level: 'beg', diff: 1, noPR: true, demoUrl: null,
    cues: 'Hold a rack upright or straps and sink into a squat as deep as feels fine — never into pain. Reach the free arm up and behind you and let your chest turn to follow your hand. Swap arms.',
  },
  high_knee_march: {
    name: 'Standing High-Knee March', pattern: 'conditioning', equipment: ['bw'], measure: 'reps', workType: 'reps',
    load: 'bw', laterality: 'bilateral', level: 'beg', diff: 1, noPR: true, demoUrl: null,
    cues: 'March on the spot, driving each knee up to hip height. Stay tall. No jumping, no impact — knee-friendly swap for mountain climbers.',
  },
  hip_90_90: {
    name: '90/90 Hip Switches', pattern: 'mobility', family: 'hip', equipment: ['bw'], measure: 'reps', workType: 'reps',
    load: 'bw', laterality: 'bilateral', level: 'beg', diff: 1, noPR: true, demoUrl: null,
    cues: 'Sit on the floor, both knees bent to about 90° — one shin in front of you, the other out to the side. Keep tall and rotate your hips to swap both legs to the other side. Slow and controlled. Opens the hips with zero stress on the knee.',
  },
  worlds_greatest_stretch: {
    name: "World's Greatest Stretch", pattern: 'mobility', family: 'hip', equipment: ['bw'], measure: 'reps', workType: 'reps',
    load: 'bw', laterality: 'unilateral', level: 'beg', diff: 1, noPR: true, demoUrl: null,
    cues: 'Step one foot forward into a gentle lunge, both hands on the floor inside the front foot. Reach the inside arm up to the ceiling and turn your chest to follow it. Bring it back down, step back, switch sides. Opens hips, chest and back in one move.',
  },

  /* ---------- PULL — machines & cables ---------- */
  lat_pulldown: {
    name: 'Lat Pulldown', pattern: 'pull', families: ['vertical-pull'], equipment: ['machine'], measure: 'reps', workType: 'reps',
    load: 'weighted', laterality: 'bilateral', level: 'beg', diff: 2, main: true, grip: 'pronated',
    methods: ['reps', 'weighted', 'tempo'], harder: 'band_assisted_pullup', demoUrl: null,
    cues: 'Sit tall, pull the bar to your upper chest and lead with your elbows, not your hands. Let it back up slowly.',
  },
  seated_cable_row: {
    name: 'Seated Cable Row', pattern: 'pull', families: ['horizontal-pull'], equipment: ['cable'], measure: 'reps', workType: 'reps',
    load: 'weighted', laterality: 'bilateral', level: 'beg', diff: 2, main: true, grip: 'neutral',
    methods: ['reps', 'weighted', 'tempo'], demoUrl: null,
    cues: 'Chest up, pull the handle to your belly and squeeze your shoulder blades together. Do not lean back to move the weight.',
  },
  chest_supported_row: {
    name: 'Chest-Supported Row', pattern: 'pull', families: ['horizontal-pull'], equipment: ['machine'], measure: 'reps', workType: 'reps',
    load: 'weighted', laterality: 'bilateral', level: 'beg', diff: 2, main: true, grip: 'neutral',
    methods: ['reps', 'weighted', 'tempo'], demoUrl: null,
    cues: 'Chest stays flat on the pad the whole set. Row to your ribs, pause a beat, lower slowly. The pad does the cheating for you.',
  },
  face_pull: {
    name: 'Face Pull', pattern: 'pull', families: ['scap'], equipment: ['cable'], measure: 'reps', workType: 'reps',
    load: 'weighted', laterality: 'bilateral', level: 'beg', diff: 2, noPR: true, grip: 'neutral',
    methods: ['reps', 'weighted'], demoUrl: null,
    cues: 'Rope at head height. Pull it toward your forehead and let your hands split apart at the end. Light weight, slow, feel it between the shoulder blades.',
  },
  barbell_curl: {
    name: 'Barbell Curl', pattern: 'pull', family: 'arm', equipment: ['bb'], measure: 'reps', workType: 'reps',
    load: 'weighted', laterality: 'bilateral', level: 'beg', diff: 2, grip: 'supinated',
    methods: ['reps', 'weighted', 'tempo'], demoUrl: null,
    cues: 'Elbows pinned to your sides. Curl up, lower all the way down under control. If your back is swinging, the bar is too heavy.',
  },
  assisted_chinup_top_hold: {
    name: 'Chin-Up Top Hold (assisted machine)', pattern: 'pull', families: ['vertical-pull'], equipment: ['machine'], measure: 'hold', workType: 'hold',
    load: 'weighted', noPR: true, laterality: 'bilateral', level: 'beg', diff: 3, grip: 'supinated',
    methods: ['hold'], harder: 'negative_pullup', demoUrl: null,
    cues: 'Palms facing you. Use the assist machine to get your chin above the bar, then just hold there. Chest up, shoulders down. Log the ASSIST weight: lower is stronger.',
  },

  /* ---------- PUSH — machines & cables ---------- */
  chest_press_machine: {
    name: 'Chest Press Machine', pattern: 'push', families: ['horizontal-push'], equipment: ['machine'], measure: 'reps', workType: 'reps',
    load: 'weighted', laterality: 'bilateral', level: 'beg', diff: 2, main: true,
    methods: ['reps', 'weighted', 'tempo'], demoUrl: null,
    cues: 'Set the seat so the handles sit level with the middle of your chest. Press out, control the way back. Do not lock out hard.',
  },
  shoulder_press_machine: {
    name: 'Shoulder Press Machine', pattern: 'push', families: ['vertical-push'], equipment: ['machine'], measure: 'reps', workType: 'reps',
    load: 'weighted', laterality: 'bilateral', level: 'beg', diff: 2, main: true,
    methods: ['reps', 'weighted', 'tempo'], demoUrl: null,
    cues: 'Press straight overhead, ribs down so you do not arch your back. Lower until your hands are about ear height.',
  },
  assisted_dip: {
    name: 'Assisted Dip (machine)', pattern: 'push', family: 'dip', equipment: ['machine'], measure: 'reps', workType: 'reps',
    load: 'weighted', noPR: true, laterality: 'bilateral', level: 'beg', diff: 3, easier: 'bench_dip', harder: 'dip',
    methods: ['reps', 'tempo'], demoUrl: null,
    cues: 'Kneel or stand on the pad — the machine takes weight off you. Lean forward a little, lower until your upper arms are level with the floor, press back up. Log the ASSIST weight: lower is stronger.',
  },
  lateral_raise: {
    name: 'Lateral Raise', pattern: 'push', family: 'shoulder', equipment: ['db'], measure: 'reps', workType: 'reps',
    load: 'weighted', laterality: 'bilateral', level: 'beg', diff: 2,
    methods: ['reps', 'weighted', 'tempo'], demoUrl: null,
    cues: 'Light dumbbells. Raise them out to the sides up to shoulder height, elbows soft. Lower slowly. This one is never heavy.',
  },
  triceps_pushdown: {
    name: 'Triceps Pushdown', pattern: 'push', family: 'arm', equipment: ['cable'], measure: 'reps', workType: 'reps',
    load: 'weighted', laterality: 'bilateral', level: 'beg', diff: 2,
    methods: ['reps', 'weighted', 'tempo'], demoUrl: null,
    cues: 'Elbows glued to your sides. Push the bar or rope down until your arms are straight, then let it come back up slowly.',
  },
  pushup_on_dumbbells: {
    name: 'Push-Ups on Dumbbells', pattern: 'push', family: 'push-up', equipment: ['db'], measure: 'reps', workType: 'reps',
    load: 'bw', laterality: 'bilateral', level: 'beg', diff: 3, easier: 'incline_push_up', harder: 'pushup', demoUrl: null,
    cues: 'Hands gripping two dumbbells set on the floor so your wrists stay straight. Body in one line, chest down between them, press back up.',
  },

  /* ---------- HINGE / POSTERIOR ---------- */
  db_rdl: {
    name: 'Dumbbell Romanian Deadlift', pattern: 'hinge', equipment: ['db'], measure: 'reps', workType: 'reps',
    load: 'weighted', laterality: 'bilateral', level: 'beg', diff: 3, main: true,
    methods: ['reps', 'weighted', 'tempo'], demoUrl: null,
    cues: 'Push your hips back and slide the dumbbells down the front of your legs. Knees stay almost straight. Stop when you feel the stretch behind your thighs, then stand tall.',
  },
  back_extension_45: {
    name: '45-Degree Back Extension', pattern: 'hinge', equipment: ['machine'], measure: 'reps', workType: 'reps',
    load: 'bw', laterality: 'bilateral', level: 'beg', diff: 2,
    methods: ['reps', 'weighted', 'tempo'], demoUrl: null,
    cues: 'Pad just below your hip bones. Bend at the hips and come back up until your body is one straight line — do not arch past that.',
  },
  kb_swing: {
    name: 'Kettlebell Swing', pattern: 'hinge', equipment: ['kb'], measure: 'reps', workType: 'reps',
    load: 'weighted', laterality: 'bilateral', level: 'beg', diff: 4, main: true,
    methods: ['reps', 'weighted'], demoUrl: null,
    cues: 'Snap the hips — the arms are just rope. The bell floats up to chest height from your hips driving forward, not from lifting with your shoulders. Start at 12–16 kg.',
  },

  /* ---------- LOWER — knee-safe ---------- */
  wall_sit: {
    name: 'Wall Sit', pattern: 'quad', equipment: ['bw'], measure: 'hold', workType: 'hold',
    load: 'bw', laterality: 'bilateral', level: 'beg', diff: 2, harder: 'spanish_squat', demoUrl: null,
    cues: 'Back flat on the wall, slide down until your thighs are somewhere comfortable — the higher you stay, the easier on the knee. Hold still and breathe.',
  },
  spanish_squat: {
    name: 'Spanish Squat', pattern: 'quad', equipment: ['band', 'rack'], measure: 'hold', workType: 'hold',
    load: 'bw', laterality: 'bilateral', level: 'beg', diff: 3, easier: 'wall_sit', demoUrl: null,
    cues: 'Thick band looped behind your knees and anchored in front of you. Sit back against the band and hold. Great for calming a cranky knee down.',
  },
  banded_tke: {
    name: 'Banded Terminal Knee Extension', pattern: 'quad', equipment: ['band', 'rack'], measure: 'reps', workType: 'reps',
    load: 'bw', laterality: 'bilateral', level: 'beg', diff: 1, noPR: true, demoUrl: null,
    cues: 'Band around the back of your knee, anchored in front. Straighten the knee against the band and squeeze the thigh. Tiny range, big effect — knee-friendly.',
  },
  hip_abduction_machine: {
    name: 'Hip Abduction Machine', pattern: 'glute', equipment: ['machine'], measure: 'reps', workType: 'reps',
    load: 'weighted', laterality: 'bilateral', level: 'beg', diff: 1,
    methods: ['reps', 'weighted'], demoUrl: null,
    cues: 'Pads on the outside of your knees. Push your knees apart, pause, come back slowly. Sit up tall.',
  },
  hip_adduction_machine: {
    name: 'Hip Adduction Machine', pattern: 'glute', equipment: ['machine'], measure: 'reps', workType: 'reps',
    load: 'weighted', laterality: 'bilateral', level: 'beg', diff: 1,
    methods: ['reps', 'weighted'], demoUrl: null,
    cues: 'Flip the pads to the inside of your knees. Squeeze your knees together, pause, let them open back out slowly.',
  },

  /* ---------- CORE — easier variations for the swaps ---------- */
  hollow_heels_down: {
    name: 'Hollow Hold (heels down)', pattern: 'core', family: 'hollow', region: 'inner', equipment: ['bw'], measure: 'hold', workType: 'hold',
    load: 'bw', laterality: 'bilateral', level: 'beg', diff: 1, harder: 'bent_knee_hollow_hold', demoUrl: null,
    cues: 'Lie on your back with your heels resting on the floor. Lift only your shoulders off the ground and press your low back flat. Easiest version — nothing should pull on your back.',
  },
  incline_side_plank: {
    name: 'Side Plank (hand on bar)', pattern: 'core', family: 'plank', region: 'side', equipment: ['rack'], measure: 'hold', workType: 'hold',
    load: 'bw', laterality: 'unilateral', level: 'beg', diff: 1, harder: 'side_plank', demoUrl: null,
    cues: 'One hand on a hip-height bar, feet on the floor, body in a straight line. The higher the bar, the easier it is.',
  },
};
