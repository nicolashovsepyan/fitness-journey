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
import { VOICE_CUES } from '../data/voice-cues.js';

/* the call for round k of n (n unknown: Death By). A random one of the
   versions Nico has recorded, so it never sounds the same twice; else the
   nearest thing built only from what he has recorded ("Round 4. Halfway."),
   never half his voice and half the robot. */
const any = list => { const ok = list.filter(recorded); return ok.length ? ok[Math.floor(Math.random() * ok.length)] : null; };
/* in the current language (the English line is the key, js/i18n-fr.js has the French) */
const L = (en, vars) => t(en, vars);
/* the round calls, several of each so they never repeat in a row */
export const LAST = ['Last round. Make it count.', 'Last round. Empty the tank.', "Final round. Let's go.", 'Last round. Leave it all here.', 'Final round. Finish strong.'];
export const TWO = ['Round {n}. Last two. Push yourself.', 'Round {n}. Two to go. Stay with it.', 'Round {n}. Two left. Dig deep.'];
export const THREE = ['Round {n}. Three to go.', 'Round {n}. Three more. Keep it up.', 'Round {n}. Three left. Stay sharp.'];
export const HALF = ['Round {n}. Halfway there.', 'Round {n}. Halfway. Keep going.', 'Round {n}. Halfway home.'];
export function roundCall(k, n, word = 'Round') {
  const rung = word !== 'Round';
  const R = L(rung ? 'Rung {n}.' : 'Round {n}.', { n: k });
  if (n && n > 1 && k === n) return any(LAST.map(x => L(x))) || L('Last round.');
  if (n >= 6 && k === n - 1) return any(TWO.map(x => L(x, { n: k }))) || R;
  if (n >= 8 && k === n - 2) return any(THREE.map(x => L(x, { n: k }))) || R;
  if (n >= 4 && k === Math.floor(n / 2) + (n % 2)) return any(HALF.map(x => L(x, { n: k }))) || L('Round {n}. Halfway.', { n: k });
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
  go: ["Let's go.", "Let's work.", 'Here we go.', 'Go time.', "Let's get it.", 'Time to work.'],
  halfway: ['Halfway. Keep it up.', 'Halfway there. Stay strong.', "Halfway. You've got this.", 'Halfway. Stay on pace.',
    'Halfway done. Keep moving.', "Halfway. Don't slow down.", 'Halfway home. Stay with it.', 'Halfway. Breathe and keep going.'],
  minute: ['One minute to go.', 'Last minute. Dig in.', 'One minute left. Stay with it.', 'Sixty seconds. Everything you have.',
    'One minute. Finish what you started.', 'Last minute. Make it count.'],
  ten: ['Ten seconds. Finish strong.', 'Ten seconds. Everything you have.', 'Ten more seconds. Push.', "Ten seconds. Don't stop now.",
    'Ten seconds. Empty the tank.', 'Ten seconds. Strong finish.'],
  rest: ['Breathe. Shake it out.', 'Good work. Recover.', 'Nice. Get your breath back.', 'Rest. Slow your breathing.',
    'Shake out the arms.', 'Good. Breathe deep.', 'Rest up. The next one is coming.', 'Easy breathing. Stay loose.',
    'Nice work. Recover fast.', 'Walk it off. Slow breaths.'],
  round: ['Nice round.', 'Good. Keep that pace.', 'Strong. Keep moving.', "That's it. Keep going.", 'Good round.',
    'Clean reps. Keep it up.', 'Nice. Same again.', 'Love it. Keep going.', 'Solid. Stay smooth.', 'Strong round. Next one.'],
  push: ['Stay tight.', 'Breathe. Keep the pace.', 'Good pace. Hold it.', "Don't drop the pace.", 'Strong. Keep pushing.',
    "You're doing great.", 'Stay with it.', 'Smooth and steady.', 'Keep that rhythm.', 'Every rep counts.'],
  almost: ['Almost there.', 'Almost done. Finish it.', 'So close. Keep going.', 'Last push. Bring it home.'],
  done: ['Workout complete. Strong work.', "That's it. Great session.", 'Done. Proud of you.', 'Finished. That was solid.',
    'Great work today.', "That's how it's done.", 'Session done. Recover well.', 'You showed up. Great work.',
    'Done. Hard work pays off.', 'Finished. Be proud of that.', "That's a wrap. Great job.", 'Workout done. Hydrate and recover.'],
};

/* a recorded line for this moment, or nothing */
export function pick(moment) {
  const ok = (LINES[moment] || []).map(x => L(x)).filter(recorded);
  return ok.length ? ok[Math.floor(Math.random() * ok.length)] : null;
}
/* the cue for a move, if recorded */
/* (every move has one: the fundamentals above, the rest in data/voice-cues.js) */
export function cueFor(exId) { const en = exId && (CUES[exId] || VOICE_CUES[exId]); const c = en && L(en); return c && recorded(c) ? c : null; }
