/* ============================================================
   WORK MODE PREVIEW — one short sample per format a program can use.
   Opened from the Quick Timer as index.html?quick&demo.

   Every sample is a real RunPlan on real library movements (so the
   video, cue and swap buttons behave as they do on a program day),
   with the numbers cut down so each one can be walked in a minute or
   two. Marked `demo`: nothing here is saved to history or sets a PR.
   ============================================================ */
import { EXERCISES } from '../data/exercises.js';

/* a plan item from a library movement, plus the prescription */
const ex = (id, rx = {}) => {
  const m = EXERCISES[id] || {};
  return { exId: id, name: m.name || id, measure: m.measure || 'reps', load: m.load, laterality: m.laterality, cue: m.cues, ...rx };
};
const plan = (name, blocks) => ({
  name: `Preview · ${name}`, sessionId: 'demo', demo: true, duration: 5, getReady: 5,
  returnTo: 'index.html?quick&demo', finishLabel: 'Back to preview', blocks,
});
let n = 0;
const blk = (role, name, format, items, cfg = {}) => ({ id: `d${++n}`, role, name, format, items, ...cfg });

export const DEMOS = [
  { id: 'straight', name: 'Straight sets', sub: '3 × 5, reps and weight, rest between sets',
    plan: () => plan('Straight sets', [blk('Work', 'Back Squat', 'straight', [ex('back_squat', { sets: 3, reps: 5, rest: 20, weight: 135 })])]) },
  { id: 'yates', name: 'Yates · to failure', sub: '2 warm-up sets, then 1 all-out set',
    plan: () => plan('Yates', [blk('Work', 'Bench Press', 'yates', [ex('bench_press', { warmups: 2, reps: 8, rest: 20, toFailure: true })])]) },
  { id: 'tempo', name: 'Tempo', sub: 'Tempo shown under the name',
    plan: () => plan('Tempo', [blk('Work', 'Romanian Deadlift', 'tempo', [ex('romanian_deadlift', { sets: 2, reps: 8, tempo: '3-1-1', rest: 20 })])]) },
  { id: 'unilateral', name: 'Single leg / per side', sub: 'Left and right logged separately',
    plan: () => plan('Per side', [blk('Work', 'Bulgarian Split Squat', 'straight', [ex('bulgarian_split', { sets: 2, reps: 8, rest: 20 })])]) },
  { id: 'isometric', name: 'Isometric hold', sub: 'The hold runs itself, then rest',
    plan: () => plan('Isometric', [blk('Work', 'Horse Stance', 'isometric', [ex('horse_stance', { sets: 2, hold: 15, rest: 10 })])]) },
  { id: 'superset', name: 'Superset', sub: 'A1 into A2, no rest, then rest',
    plan: () => plan('Superset', [blk('Work', 'Push + Hinge', 'superset',
      [ex('ring_push_up', { reps: 10, pair: 'A1' }), ex('nordic_curl', { reps: 5, pair: 'A2' })], { rounds: 2, rest: 20 })]) },
  { id: 'circuit', name: 'Circuit', sub: 'Rounds through a list, log while resting',
    plan: () => plan('Circuit', [blk('Primer', 'Pump circuit', 'circuit',
      [ex('jump_squat', { reps: 10 }), ex('hindu_push_up', { reps: 8 }), ex('frog_stand', { hold: 10 })], { rounds: 2, roundRest: 15 })]) },
  { id: 'skill', name: 'Skill practice', sub: 'Drills in order: holds and reps',
    plan: () => plan('Skill', [blk('Work', 'Handstand', 'skill',
      [ex('chest_to_wall_handstand_hold', { sets: 2, hold: 15, rest: 10 }), ex('handstand_kick_ups', { sets: 2, reps: 5, rest: 10 })])]) },
  { id: 'emom', name: 'EMOM', sub: '3 min, moves take turns each minute',
    plan: () => plan('EMOM', [blk('Finisher', 'EMOM 3', 'emom',
      [ex('jump_squat', { reps: 10 }), ex('hindu_push_up', { reps: 8 })], { work: 60, rest: 0, intervals: 3 })]) },
  { id: 'amrap', name: 'AMRAP', sub: '2 min, tap + for each round',
    plan: () => plan('AMRAP', [blk('Finisher', 'AMRAP 2', 'amrap',
      [ex('man_maker', { reps: 5 }), ex('jump_squat', { reps: 10 })], { minutes: 2 })]) },
  { id: 'tabata', name: 'Tabata', sub: '4 rounds of 20 on, 10 off',
    plan: () => plan('Tabata', [blk('Finisher', 'Tabata', 'tabata', [ex('jump_squat')], { work: 20, rest: 10, intervals: 4 })]) },
  { id: 'max', name: 'Max test', sub: 'One all-out set, sets a benchmark',
    plan: () => plan('Max test', [blk('Benchmark', 'Push-up test', 'max_test', [ex('hindu_push_up')])]) },
  { id: 'day', name: 'A whole day, start to finish', sub: '4 blocks with the rest and "up next" between them',
    plan: () => plan('Full day', [
      blk('Primer', 'Warm-up circuit', 'circuit', [ex('jump_squat', { reps: 8 }), ex('hindu_push_up', { reps: 6 })], { rounds: 1, roundRest: 0 }),
      blk('Work', 'Back Squat', 'straight', [ex('back_squat', { sets: 2, reps: 5, rest: 15, weight: 135 })]),
      blk('Work', 'Push + Hinge', 'superset', [ex('ring_push_up', { reps: 10, pair: 'A1' }), ex('nordic_curl', { reps: 5, pair: 'A2' })], { rounds: 2, rest: 15 }),
      blk('Finisher', 'Tabata', 'tabata', [ex('jump_squat')], { work: 20, rest: 10, intervals: 2 }),
    ]) },
];
