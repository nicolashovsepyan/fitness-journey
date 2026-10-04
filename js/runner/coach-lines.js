/* ============================================================
   WHAT THE COACH SAYS — one place, for every timer.
   · roundCall: the call at the top of every round, the same rule in
     Tabata, EMOM, the Interval timer, Death By and the Ladder.
   · cues: one short coaching line per move, said the first time it comes up.
   · lines: motivation for the moments that matter.
   Cues and motivation are only said when Nico has RECORDED the line
   (voice.js `recorded`), so the phone's robot voice never reads a pep
   talk. The round calls always play: recorded as a sentence when he has
   recorded it, else joined from his pieces ("Round" + "6").
   ============================================================ */
import { recorded } from '../voice.js';
import { t } from '../i18n.js';

/* the call for round k of n (n unknown: Death By). A random one of the
   versions Nico has recorded, so it never sounds the same twice; else the
   nearest thing built only from what he has recorded ("Round 4. Halfway."),
   never half his voice and half the robot. */
const any = list => { const ok = list.filter(recorded); return ok.length ? ok[Math.floor(Math.random() * ok.length)] : null; };
/* in the current language (the English line is the key, js/i18n-fr.js has the French) */
const L = (en, vars) => t(en, vars);
export function roundCall(k, n, word = 'Round') {
  const rung = word !== 'Round';
  const R = L(rung ? 'Rung {n}.' : 'Round {n}.', { n: k });
  if (n && n > 1 && k === n) return any([L('Last round. Make it count.'), L('Last round. Empty the tank.'), L("Final round. Let's go.")]) || L('Last round.');
  if (n >= 6 && k === n - 1) return any([L('Round {n}. Last two. Push yourself.', { n: k }), L('Round {n}. Two to go. Stay with it.', { n: k })]) || R;
  if (n >= 8 && k === n - 2) return any([L('Round {n}. Three to go.', { n: k }), L('Round {n}. Three more. Keep it up.', { n: k })]) || R;
  if (n >= 4 && k === Math.floor(n / 2) + (n % 2)) return any([L('Round {n}. Halfway there.', { n: k }), L('Round {n}. Halfway. Keep going.', { n: k })]) || L('Round {n}. Halfway.', { n: k });
  return R;
}

/* one cue per fundamental move: short, said once, in the coach's words */
export const CUES = {
  pushup: 'Chest to the floor. Elbows in.',
  pullup: 'Full hang at the bottom. Chin over the bar.',
  bodyweight_squat: 'Sit back. Chest up. Drive through the heels.',
  burpee: 'Chest to the floor, then jump.',
  forearm_plank: 'Squeeze the glutes. Straight line.',
  dip: 'Shoulders down. Elbows back.',
  chin_up: 'Pull the elbows to your ribs.',
  mountain_climber: 'Hips low. Knees fast.',
  jump_squat: 'Land soft. Explode up.',
  glute_bridge: 'Squeeze at the top.',
  sit_up: 'Control it on the way down.',
  ring_row: 'Body straight. Chest to the rings.',
  hollow_hold: 'Lower back to the floor.',
  dead_hang: 'Relax the shoulders. Breathe.',
  wall_sit: 'Thighs flat. Breathe.',
  kb_swing: 'Snap the hips. Arms are ropes.',
  goblet_squat: 'Elbows inside the knees.',
  deadlift: 'Flat back. Push the floor away.',
  back_squat: 'Brace. Break at the hips.',
  bench_press: 'Shoulder blades back. Feet planted.',
  overhead_press: 'Squeeze the glutes. Press straight up.',
  bent_over_row: 'Flat back. Pull to the belly.',
  farmers_carry: 'Tall posture. Small steps.',
};

/* motivation, by moment: several each, one picked at random among the
   recorded ones (docs/VOICE-SCRIPT-2.md is the list to record) */
export const LINES = {
  halfway: ['Halfway. Keep it up.', 'Halfway there. Stay strong.', "Halfway. You've got this."],
  minute: ['One minute to go.', 'Last minute. Dig in.', 'One minute left. Stay with it.'],
  ten: ['Ten seconds. Finish strong.', 'Ten seconds. Everything you have.', 'Ten more seconds. Push.'],
  rest: ['Breathe. Shake it out.', 'Good work. Recover.', 'Nice. Get your breath back.', 'Rest. Slow your breathing.'],
  round: ['Nice round.', 'Good. Keep that pace.', 'Strong. Keep moving.', "That's it. Keep going."],
  done: ['Workout complete. Strong work.', "That's it. Great session.", 'Done. Proud of you.', 'Finished. That was solid.',
    'Great work today.', "That's how it's done.", 'Session done. Recover well.', 'You showed up. Great work.'],
};

/* a recorded line for this moment, or nothing */
export function pick(moment) {
  const ok = (LINES[moment] || []).map(x => L(x)).filter(recorded);
  return ok.length ? ok[Math.floor(Math.random() * ok.length)] : null;
}
/* the cue for a move, if recorded */
export function cueFor(exId) { const c = exId && CUES[exId] && L(CUES[exId]); return c && recorded(c) ? c : null; }
