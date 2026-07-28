/* ============================================================
   DATA — BEGINNER SESSION LIBRARY (second user)
   Same block/format schema as sessions.js, so the existing
   resolver + work-mode player run these with no special casing.

   Session flags used here:
     fixed: true        never rescale by duration — same workout every week
     coachMode: true    turn on notes / knee flag / end-of-session feedback
     intro: true        this session takes part in the week 1–2 ramp-in

   Item extras used here:
     repsText  display string for a rep range ('10-15') — the numeric
               `reps` stays as the pre-filled default in the logger
     pair      'A1' | 'A2' … superset pairing label
     zone      grouping + equipment name for the Day 3 circuit
     subs      explicit swap options offered before the generic library
     name      overrides the library name for this session only
     measure   overrides the library measure (e.g. a rep move held for time)
     fromWeek  block only appears from that week onward (ramp-in)
   ============================================================ */

/* ---- Warm-up A (Days 1 and 2) ---- */
const WARMUP_A = [
  {
    role: 'Primer', format: 'circuit', name: 'Warm-up A · Loosen up', note: 'Never rushed, but no stopping — flow straight through. This is the part that protects the joints.',
    rounds: 1, transition: 8, roundRest: 0,
    items: [
      { ex: 'arm_circles', reps: 20, noPR: true, note: '10 forward, 10 back — one arm at a time' },
      { ex: 'down_dog_up_dog', reps: 5, noPR: true, note: '5 sec hold at each end', subs: ['down_dog_up_dog_bar'] },
      { ex: 'hip_90_90', reps: 8, noPR: true, note: 'Knee-friendly hip opener', subs: ['worlds_greatest_stretch', 'cat_cow'] },
    ],
  },
  {
    role: 'Primer', format: 'circuit', name: 'Warm-up A · Circuit', note: '3 rounds, continuous — no rest inside a round',
    rounds: 3, transition: 8, roundRest: 0,
    items: [
      { ex: 'pushup', reps: 4, repsText: '3-5', noPR: true,
        cue: 'Hands under your shoulders, body in one straight line. Chest to the floor, press back up. Do them on a bar or bench if the floor is too hard right now.', subs: ['incline_push_up', 'pushup_on_dumbbells', 'straight_bar_push_up'] },
      { ex: 'dead_hang', hold: 20, noPR: true, cue: 'Just hang from the bar with straight arms and let your shoulders stretch out. Feet can touch the floor if you need them to.' },
      { ex: 'banded_pullapart', reps: 12, repsText: '10-15', noPR: true, cue: 'Band in both hands, arms straight out in front. Pull it apart until your arms are wide, squeezing your shoulder blades together. Slow back. No band? Swap to the Superman.', subs: ['superman'] },
      { ex: 'mountain_climber', reps: 10, noPR: true, cue: 'Push-up position. Bring one knee toward your chest, then swap. Keep your hips low. Swap it for the standing march if this bothers the knee.', subs: ['high_knee_march'] },
    ],
  },
];

/* ---- Warm-up B (Day 3) ---- */
const WARMUP_B = [
  {
    role: 'Primer', format: 'circuit', name: 'Warm-up B · Sequence 1', note: 'Flow straight through, no stopping.',
    rounds: 1, transition: 8, roundRest: 0,
    items: [
      { ex: 'arm_circles', reps: 20, noPR: true, note: '10 forward, 10 back — one arm at a time' },
      { ex: 'down_dog_up_dog', reps: 5, noPR: true, note: '5 sec hold at each end', subs: ['down_dog_up_dog_bar'] },
      { ex: 'hip_90_90', reps: 8, noPR: true, note: 'Knee-friendly hip opener', subs: ['worlds_greatest_stretch', 'cat_cow'] },
    ],
  },
  {
    role: 'Primer', format: 'circuit', name: 'Warm-up B · Sequence 2', note: '2 rounds, continuous — no rest inside a round',
    rounds: 2, transition: 8, roundRest: 0,
    items: [
      { ex: 'banded_sidewalk', name: 'Banded Side-Step March', hold: 60, noPR: true,
        cue: 'Band around your legs, stay low in a quarter-squat, step sideways without letting your feet click together. 60 seconds, back and forth.' },
      { ex: 'pushup', reps: 4, repsText: '3-5', noPR: true,
        cue: 'Hands under your shoulders, body in one straight line. Chest to the floor, press back up. Do them on a bar or bench if the floor is too hard right now.', subs: ['incline_push_up', 'pushup_on_dumbbells', 'straight_bar_push_up'] },
      { ex: 'dead_hang', hold: 20, noPR: true, cue: 'Just hang from the bar with straight arms and let your shoulders stretch out. Feet can touch the floor if you need them to.' },
      { ex: 'superman', reps: 12, repsText: '10-15', noPR: true, name: 'Superman',
        cue: 'Lie face down, arms stretched out in front, thumbs pointing up. Lift your arms, chest, and legs off the floor together, hold a second, lower with control. Hits the glutes, back and shoulders. Have a band? Swap to pull-aparts.', subs: ['banded_pullapart'] },
      { ex: 'mountain_climber', reps: 10, noPR: true, cue: 'Push-up position. Bring one knee toward your chest, then swap. Keep your hips low. Swap it for the standing march if this bothers the knee.', subs: ['high_knee_march'] },
    ],
  },
];

export const BEGINNER_SESSIONS = {

  /* ================= DAY 1 · UPPER ================= */
  b_upper_1: {
    id: 'b_upper_1', name: 'Day 1 · Upper', category: 'upper', pattern: 'upper',
    fixed: true, coachMode: true, locked: true, tags: ['upper', 'supersets'],
    blocks: [
      ...WARMUP_A,
      {
        role: 'Work', format: 'superset', name: 'A · Push-Ups + Lat Pulldown',
        note: 'A1 straight into A2 with no rest, then rest 75 sec, then go again.',
        rounds: 3, rest: 75, anchor: true, optional: true,
        items: [
          { ex: 'straight_bar_push_up', pair: 'A1', reps: 12, repsText: '10-15', name: 'Straight Bar Push-Up', load: 'bw',
            note: 'Bar in the squat rack. Lower the bar one notch when 15 gets easy.',
            cue: 'Set a bar in the rack about waist height. Hands on the bar, body straight, walk your feet back. Chest to the bar, press away. The lower the bar, the harder it gets.',
            subs: ['pushup_on_dumbbells', 'incline_push_up', 'knee_push_up'] },
          { ex: 'lat_pulldown', pair: 'A2', reps: 10 },
        ],
      },
      {
        role: 'Work', format: 'superset', name: 'B · Assisted Dip + Cable Row',
        note: 'B1 straight into B2 with no rest, then rest 75 sec.',
        rounds: 3, rest: 75, anchor: true, optional: true,
        items: [
          { ex: 'assisted_dip', pair: 'B1', reps: 8, note: 'Take one plate off the assist when 8 feels easy.' },
          { ex: 'seated_cable_row', pair: 'B2', reps: 10 },
        ],
      },
      {
        role: 'Work', format: 'superset', name: 'C · Lateral Raise + Pushdown',
        note: 'C1 into C2, no rest, then 75 sec.', optional: true, extra: true,
        rounds: 3, rest: 75,
        items: [
          { ex: 'lateral_raise', pair: 'C1', reps: 12 },
          { ex: 'triceps_pushdown', pair: 'C2', reps: 12 },
        ],
      },
      {
        role: 'Work', format: 'superset', name: 'D · Inverted Row + Curl',
        note: 'D1 into D2, no rest, then 75 sec.', optional: true, extra: true,
        rounds: 2, rest: 75,
        items: [
          { ex: 'australian_pullup', pair: 'D1', name: 'Inverted Row', reps: 10, repsText: '8-10',
            cue: 'Set a bar in the rack at about hip height. Lie under it, grab it, body straight with heels on the floor. Pull your chest up to the bar, lower slowly. Walk your feet forward to make it harder.' },
          { ex: 'barbell_curl', pair: 'D2', reps: 12 },
        ],
      },
      {
        role: 'Finisher', format: 'circuit', name: 'Finisher · Kettlebell Swings',
        note: '3 rounds of 12, rest 20 sec between rounds.', optional: true,
        rounds: 3, transition: 0, roundRest: 20,
        items: [{ ex: 'kb_swing', reps: 12, note: 'Snap the hips — the arms are just rope. Start 12-16 kg.' }],
      },
    ],
  },

  /* ================= DAY 2 · UPPER ================= */
  b_upper_2: {
    id: 'b_upper_2', name: 'Day 2 · Upper', category: 'upper', pattern: 'upper',
    fixed: true, coachMode: true, locked: true, tags: ['upper', 'supersets'],
    blocks: [
      ...WARMUP_A,
      {
        role: 'Work', format: 'superset', name: 'A · Chest Press + Row',
        note: 'A1 into A2, no rest, then rest 75 sec.',
        rounds: 3, rest: 75, anchor: true, optional: true,
        items: [
          { ex: 'chest_press_machine', pair: 'A1', reps: 10 },
          { ex: 'chest_supported_row', pair: 'A2', reps: 12 },
        ],
      },
      {
        role: 'Work', format: 'superset', name: 'B · Shoulder Press + Pullover',
        note: 'B1 into B2, no rest, then rest 75 sec.',
        rounds: 3, rest: 75, anchor: true, optional: true,
        items: [
          { ex: 'shoulder_press_machine', pair: 'B1', reps: 10 },
          { ex: 'db_pullover', pair: 'B2', reps: 12,
            cue: 'Lie on the bench, elbows slightly bent and fixed. Lower the dumbbell to about head level only — feel the stretch in the lats and ribs, not deep in the shoulder. Start light, 20-25 lb.' },
        ],
      },
      {
        role: 'Work', format: 'superset', name: 'C · Back Extension + Dip Hold',
        note: 'C1 into C2, no rest, then rest 75 sec.', optional: true, extra: true,
        rounds: 3, rest: 75,
        items: [
          { ex: 'back_extension_45', pair: 'C1', reps: 12 },
          { ex: 'dip_support_hold', pair: 'C2', hold: 20, cue: 'Hold yourself up on the dip bars with your arms locked straight. Shoulders pushed down, chest tall. Just hold — no bending.' },
        ],
      },
      {
        role: 'Finisher', format: 'circuit', name: "Finisher · Farmer's Carry",
        note: '4 rounds · walk 30-40 m · rest 45-60 sec between rounds. No straps — grip is the point. Start 40-50 lb per hand.', optional: true,
        rounds: 4, transition: 0, roundRest: 60,
        items: [
          { ex: 'farmers_carry', hold: 40, name: "Farmer's Carry", noPR: true,
            cue: 'A dumbbell in each hand, no straps. Walk tall, shoulders back, 30-40 m. Set them down when the round is done, not when your grip fails. Slipping early means go lighter.' },
        ],
      },
    ],
  },

  /* ================= DAY 3 · FULL BODY CIRCUIT ================= */
  b_full_3: {
    id: 'b_full_3', name: 'Day 3 · Full Body', category: 'full_body', pattern: 'full',
    fixed: true, coachMode: true, locked: true, tags: ['full body', 'circuit'],
    blocks: [
      ...WARMUP_B,
      {
        role: 'Work', format: 'circuit', name: 'Full Body Circuit',
        note: 'Straight through, 3-5 rounds. Rest 90 sec between rounds ONLY — no rest between exercises. One pair of dumbbells: start 25-30 lb per hand (the shoulder press is the limiter). The RDL and row will feel light on purpose for now — that is fine for the first month.',
        rounds: 4, transition: 0, roundRest: 90, anchor: true, optional: true,
        items: [
          { ex: 'db_rdl', reps: 8, name: 'DB Romanian Deadlift',
            cue: 'Push your hips back, slide the dumbbells down the front of your legs, knees almost straight. Feel the stretch behind your thighs, then stand tall.' },
          { ex: 'db_shoulder_press', reps: 6,
            cue: 'Sit or stand tall, dumbbells at shoulder height. Press straight overhead, ribs down. Lower to ear height under control. This is the one that sets your weight.' },
          { ex: 'bent_over_row', reps: 6, name: 'DB Bent-Over Row',
            cue: 'Hinge at the hips, flat back, dumbbells hanging. Row them to your ribs, squeeze the shoulder blades, lower slowly. No jerking.' },
          { ex: 'pushup_on_dumbbells', reps: 6, name: 'DB Push-Ups',
            cue: 'Hands gripping the two dumbbells on the floor so your wrists stay straight. Body in one line, chest down between them, press back up.',
            subs: ['incline_push_up', 'straight_bar_push_up'] },
          { ex: 'forearm_plank', hold: 30, name: 'Plank Hold',
            cue: 'Elbows under your shoulders, body in one straight line. Squeeze your glutes so your hips do not sag. Breathe.', subs: ['incline_plank'] },
          { ex: 'wall_sit', hold: 30, name: 'Wall Sit',
            cue: 'Back flat on the wall, slide down until your thighs are somewhere comfortable — the higher you stay, the easier on the knee. Hold still.',
            subs: ['spanish_squat', 'banded_tke'] },
        ],
      },
      {
        role: 'Finisher', format: 'circuit', name: 'Finisher · Core Circuit',
        note: '30 sec each, no rest between exercises. 2-3 rounds, 45 sec between rounds.', optional: true,
        rounds: 3, transition: 0, roundRest: 45,
        items: [
          { ex: 'dead_bug', measure: 'hold', hold: 30, cue: 'On your back, arms up, knees over hips. Lower one arm and the opposite leg slowly, then swap. Keep your low back pressed into the floor.' },
          { ex: 'side_plank', measure: 'hold', hold: 30, side: 'L', cue: 'On your side, elbow under your shoulder, knees bent at 90°. Lift your hip so your body is one line. Do not let it sag.', subs: ['incline_side_plank'] },
          { ex: 'side_plank', measure: 'hold', hold: 30, side: 'R', cue: 'On your side, elbow under your shoulder, knees bent at 90°. Lift your hip so your body is one line. Do not let it sag.', subs: ['incline_side_plank'] },
          { ex: 'bird_dog', measure: 'hold', hold: 30, cue: 'On hands and knees. Reach one arm forward and the opposite leg back, hold a beat, swap. Do not let your hips tip.' },
          { ex: 'lying_leg_raise', measure: 'hold', hold: 30, name: 'Leg Raises', cue: 'On your back, hands under your hips. Lift both legs up, lower them slowly. Stop before your low back lifts off the floor.' },
        ],
      },
    ],
  },
};

/* Progression rules — shown on every beginner workout screen. */
export const BEGINNER_RULES = [
  'Stop every set with 2–3 reps left in the tank. Never train to failure.',
  'Hit the top rep number on all sets? Add the smallest weight increment next session.',
  'Nothing should hurt the knee. If a movement pinches, skip it and flag it.',
];
export const BEGINNER_RULES_FINE = [
  'Push-ups progress by lowering the bar one notch — not by adding reps.',
  'Dips progress by taking one plate off the assistance.',
  'Holds progress by making the movement harder — never by holding longer.',
];
