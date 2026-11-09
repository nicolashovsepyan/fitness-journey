/* ============================================================
   TEST YOURSELF: benchmarks you race your own best on.
   Each test runs on a timer that already exists (For time by bites, AMRAP,
   Ladder, Stopwatch for a hold, Death By, the push-up test). Its attempts
   live in the history under 'test|<id>'; the best one is your record and,
   where the run kept a timeline (reps over time, or lap times), it is the
   ghost you race live.
   metric: 'time' (lower is better, finished runs only), 'reps' (higher),
   'hold' (seconds, higher).
   m: moves as in quick-picks ([exId or name, reps] / Ladder and Death By
   [exId, start, step]).
   ============================================================ */
export const TESTS = [
  /* FOR TIME: a set amount, as fast as you can */
  { id: 'p100', fam: 'Push-ups', group: 'For time', lvl: 1, name: '100 Push-ups', sub: 'As fast as you can, any way you like', metric: 'time', fmt: 'fortime', cfg: { ftRounds: 1, ftCap: 0 }, m: [['pushup', 100]] },
  { id: 'p200', fam: 'Push-ups', group: 'For time', lvl: 2, name: '200 Push-ups', sub: 'As fast as you can, any way you like', metric: 'time', fmt: 'fortime', cfg: { ftRounds: 1, ftCap: 0 }, m: [['pushup', 200]] },
  { id: 'p300', fam: 'Push-ups', group: 'For time', lvl: 3, name: '300 Push-ups', sub: 'As fast as you can, any way you like', metric: 'time', fmt: 'fortime', cfg: { ftRounds: 1, ftCap: 0 }, m: [['pushup', 300]] },
  { id: 'sq100', fam: 'Squats', group: 'For time', lvl: 1, name: '100 Squats', sub: 'As fast as you can', metric: 'time', fmt: 'fortime', cfg: { ftRounds: 1, ftCap: 0 }, m: [['bodyweight_squat', 100]] },
  { id: 'sq200', fam: 'Squats', group: 'For time', lvl: 2, name: '200 Squats', sub: 'As fast as you can', metric: 'time', fmt: 'fortime', cfg: { ftRounds: 1, ftCap: 0 }, m: [['bodyweight_squat', 200]] },
  { id: 'sq300', fam: 'Squats', group: 'For time', lvl: 3, name: '300 Squats', sub: 'As fast as you can', metric: 'time', fmt: 'fortime', cfg: { ftRounds: 1, ftCap: 0 }, m: [['bodyweight_squat', 300]] },
  { id: 'js100', fam: 'Squats', group: 'For time', lvl: 2, name: '100 Jump Squats', sub: 'As fast as you can', metric: 'time', fmt: 'fortime', cfg: { ftRounds: 1, ftCap: 0 }, m: [['jump_squat', 100]] },
  { id: 'js200', fam: 'Squats', group: 'For time', lvl: 3, name: '200 Jump Squats', sub: 'As fast as you can', metric: 'time', fmt: 'fortime', cfg: { ftRounds: 1, ftCap: 0 }, m: [['jump_squat', 200]] },
  { id: 'js300', fam: 'Squats', group: 'For time', lvl: 3, name: '300 Jump Squats', sub: 'As fast as you can', metric: 'time', fmt: 'fortime', cfg: { ftRounds: 1, ftCap: 0 }, m: [['jump_squat', 300]] },
  { id: 'b100', fam: 'Burpees', group: 'For time', lvl: 2, name: '100 Burpees', sub: 'As fast as you can', metric: 'time', fmt: 'fortime', cfg: { ftRounds: 1, ftCap: 0 }, m: [['burpee', 100]] },
  { id: 'opm', fam: 'Classics', group: 'For time', lvl: 2, name: 'One Punch Man', sub: '100 push-ups, 100 sit-ups, 100 squats', metric: 'time', fmt: 'fortime', cfg: { ftRounds: 1, ftCap: 0 }, m: [['pushup', 100], ['sit_up', 100], ['bodyweight_squat', 100]] },
  { id: 'angie', fam: 'Classics', group: 'For time', lvl: 3, name: 'Angie', sub: '100 pull-ups, 100 push-ups, 100 sit-ups, 100 squats', metric: 'time', fmt: 'fortime', cfg: { ftRounds: 1, ftCap: 0 }, m: [['pullup', 100], ['pushup', 100], ['sit_up', 100], ['bodyweight_squat', 100]] },
  /* MORE FOR TIME (Nico, 8 Nov 2026: "100 Navy SEALs, 200 and 300 burpees, man makers… the fundamentals") */
  { id: 'b200', fam: 'Burpees', group: 'For time', lvl: 3, name: '200 Burpees', sub: 'As fast as you can', metric: 'time', fmt: 'fortime', cfg: { ftRounds: 1, ftCap: 0 }, m: [['burpee', 200]] },
  { id: 'b300', fam: 'Burpees', group: 'For time', lvl: 3, name: '300 Burpees', sub: 'As fast as you can', metric: 'time', fmt: 'fortime', cfg: { ftRounds: 1, ftCap: 0 }, m: [['burpee', 300]] },
  { id: 'seal100', fam: 'Burpees', group: 'For time', lvl: 3, name: '100 Navy SEAL Burpees', sub: 'Burpee, 3 push-ups, 3 knee tucks. As fast as you can', metric: 'time', fmt: 'fortime', cfg: { ftRounds: 1, ftCap: 0 }, m: [['navy_seal_burpee', 100]] },
  { id: 'seal50', fam: 'Burpees', group: 'For time', lvl: 2, name: '50 Navy SEAL Burpees', sub: 'As fast as you can', metric: 'time', fmt: 'fortime', cfg: { ftRounds: 1, ftCap: 0 }, m: [['navy_seal_burpee', 50]] },
  { id: 'bpu50', fam: 'Burpees', group: 'For time', lvl: 3, name: '50 Burpee Pull-ups', sub: 'As fast as you can', metric: 'time', fmt: 'fortime', cfg: { ftRounds: 1, ftCap: 0 }, m: [['burpee_pull_up', 50]] },
  { id: 'mm50', fam: 'Burpees', group: 'For time', lvl: 3, name: '50 Man-Makers', sub: 'Two dumbbells, as fast as you can', metric: 'time', fmt: 'fortime', cfg: { ftRounds: 1, ftCap: 0 }, m: [['man_maker', 50]] },
  { id: 'mm100', fam: 'Burpees', group: 'For time', lvl: 3, name: '100 Man-Makers', sub: 'Two dumbbells, as fast as you can', metric: 'time', fmt: 'fortime', cfg: { ftRounds: 1, ftCap: 0 }, m: [['man_maker', 100]] },
  { id: 'pu100', fam: 'Pull-ups and dips', group: 'For time', lvl: 3, name: '100 Pull-ups', sub: 'Any sets you like, as fast as you can', metric: 'time', fmt: 'fortime', cfg: { ftRounds: 1, ftCap: 0 }, m: [['pullup', 100]] },
  { id: 'dip100', fam: 'Pull-ups and dips', group: 'For time', lvl: 2, name: '100 Dips', sub: 'Any sets you like, as fast as you can', metric: 'time', fmt: 'fortime', cfg: { ftRounds: 1, ftCap: 0 }, m: [['dip', 100]] },
  { id: 'kbs100', fam: 'Classics', group: 'For time', lvl: 2, name: '100 Kettlebell Swings', sub: 'As fast as you can', metric: 'time', fmt: 'fortime', cfg: { ftRounds: 1, ftCap: 0 }, m: [['kb_swing', 100]] },
  { id: 'mxmu', fam: 'Pull-ups and dips', group: 'Max reps', lvl: 3, name: 'Max Muscle-ups', sub: 'One set, as many as you can', metric: 'reps', fmt: 'amrap', cfg: { cap: 5 }, m: [['muscle_up_bar', '']] },
  { id: 'mxttb', fam: 'Pull-ups and dips', group: 'Max reps', lvl: 2, name: 'Max Toes-to-Bar', sub: 'One set, as many as you can', metric: 'reps', fmt: 'amrap', cfg: { cap: 5 }, m: [['toes_to_bar', '']] },
  { id: 'mxhspu', fam: 'Push-ups', group: 'Max reps', lvl: 3, name: 'Max Handstand Push-ups', sub: 'One set, as many as you can', metric: 'reps', fmt: 'amrap', cfg: { cap: 5 }, m: [['handstand_push_up', '']] },
  { id: 'mxjs', fam: 'Squats', group: 'Max reps', lvl: 2, name: 'Max Jump Squats', sub: 'One set, no stopping', metric: 'reps', fmt: 'amrap', cfg: { cap: 5 }, m: [['jump_squat', '']] },
  { id: 'mxbur', fam: 'Burpees', group: 'Max reps', lvl: 2, name: 'Max Burpees', sub: 'One set, no stopping', metric: 'reps', fmt: 'amrap', cfg: { cap: 10 }, m: [['burpee', '']] },
  /* CALISTHENICS: Nico's level tests, sets with a rest, for time (the rest counts) */
  { id: 'caliI', fam: 'Calisthenics', group: 'Calisthenics', lvl: 2, name: 'Calisthenics Test: Intermediate', sub: '12 pull-ups, 20 dips, 40 push-ups. 2 sets, 2 min rest', metric: 'time', fmt: 'fortime', cfg: { ftRounds: 2, ftCap: 0, ftRest: 120 }, m: [['pullup', 12], ['dip', 20], ['pushup', 40]] },
  { id: 'caliE', fam: 'Calisthenics', group: 'Calisthenics', lvl: 3, name: 'Calisthenics Test: Expert', sub: '15 pull-ups, 20 dips, 40 push-ups. 3 sets, 2 min rest', metric: 'time', fmt: 'fortime', cfg: { ftRounds: 3, ftCap: 0, ftRest: 120 }, m: [['pullup', 15], ['dip', 20], ['pushup', 40]] },
  /* MAX REPS: the fundamentals, one set as many as you can (tap Done when you stop), and the classics */
  { id: 'mxpull', fam: 'Pull-ups and dips', group: 'Max reps', lvl: 2, name: 'Max Pull-ups', sub: 'One set, as many as you can', metric: 'reps', fmt: 'amrap', cfg: { cap: 5 }, m: [['pullup', '']] },
  { id: 'mxdip', fam: 'Pull-ups and dips', group: 'Max reps', lvl: 2, name: 'Max Dips', sub: 'One set, as many as you can', metric: 'reps', fmt: 'amrap', cfg: { cap: 5 }, m: [['dip', '']] },
  { id: 'mxpush', fam: 'Push-ups', group: 'Max reps', lvl: 1, name: 'Max Push-ups', sub: 'One set, as many as you can', metric: 'reps', fmt: 'amrap', cfg: { cap: 5 }, m: [['pushup', '']] },
  { id: 'mxpike', fam: 'Pull-ups and dips', group: 'Max reps', lvl: 2, name: 'Max Pike Push-ups', sub: 'One set, as many as you can', metric: 'reps', fmt: 'amrap', cfg: { cap: 5 }, m: [['pike_push_up', '']] },
  { id: 'mxrow', fam: 'Pull-ups and dips', group: 'Max reps', lvl: 1, name: 'Max Inverted Rows', sub: 'One set, as many as you can', metric: 'reps', fmt: 'amrap', cfg: { cap: 5 }, m: [['wide_inverted_row', '']] },
  { id: 'mxsq', fam: 'Squats', group: 'Max reps', lvl: 1, name: 'Max Squats', sub: 'One set, no stopping', metric: 'reps', fmt: 'amrap', cfg: { cap: 10 }, m: [['bodyweight_squat', '']] },
  { id: 'mxhlr', fam: 'Pull-ups and dips', group: 'Max reps', lvl: 2, name: 'Max Hanging Leg Raises', sub: 'One set, as many as you can', metric: 'reps', fmt: 'amrap', cfg: { cap: 5 }, m: [['hanging_leg_raise', '']] },
  { id: 'seal', fam: 'Push-ups', group: 'Max reps', lvl: 2, name: 'Navy SEAL Push-ups', sub: 'Max push-ups in 2 minutes', metric: 'reps', fmt: 'amrap', cfg: { cap: 2 }, m: [['pushup', '']] },
  { id: 'bur5', fam: 'Burpees', group: 'Max reps', lvl: 2, name: '5-Minute Burpees', sub: 'Max burpees in 5 minutes', metric: 'reps', fmt: 'amrap', cfg: { cap: 5 }, m: [['burpee', '']] },
  { id: 'cindy', fam: 'Classics', group: 'Max reps', lvl: 3, name: 'Cindy', sub: '20 min: 5 pull-ups, 10 push-ups, 15 squats. Max rounds', metric: 'reps', fmt: 'amrap', cfg: { cap: 20 }, m: [['pullup', 5], ['pushup', 10], ['bodyweight_squat', 15]] },
  { id: 'cadence', fam: 'Push-ups', group: 'Max reps', lvl: 1, name: 'Push-up Test', sub: '1 push-up every 3 seconds, as long as you can', metric: 'reps', fmt: 'pushup', cfg: { pace: 20, ptCap: 0 }, m: [] },
  { id: 'dbb', fam: 'Burpees', group: 'Max reps', lvl: 2, name: 'Death by Burpees', sub: '+1 burpee every minute until you can\'t', metric: 'reps', fmt: 'deathby', cfg: { dbEvery: 60, dbMax: 30 }, m: [['burpee', 1, 1]] },
  /* MAX HOLD: the static fundamentals */
  { id: 'hang', fam: 'Holds', group: 'Max hold', lvl: 1, name: 'Dead Hang', sub: 'Hang as long as you can. The longevity target is 2:00', metric: 'hold', fmt: 'stopwatch', cfg: {}, m: [] },
  { id: 'plank', fam: 'Holds', group: 'Max hold', lvl: 1, name: 'Plank', sub: 'Hold as long as you can, good form only', metric: 'hold', fmt: 'stopwatch', cfg: {}, m: [] },
  { id: 'wallsit', fam: 'Holds', group: 'Max hold', lvl: 1, name: 'Wall Sit', sub: 'Thighs flat, as long as you can', metric: 'hold', fmt: 'stopwatch', cfg: {}, m: [] },
  { id: 'hollow', fam: 'Holds', group: 'Max hold', lvl: 2, name: 'Hollow Hold', sub: 'Lower back down, as long as you can', metric: 'hold', fmt: 'stopwatch', cfg: {}, m: [] },
  { id: 'lsit', fam: 'Holds', group: 'Max hold', lvl: 3, name: 'L-Sit', sub: 'Legs straight and level, as long as you can', metric: 'hold', fmt: 'stopwatch', cfg: {}, m: [] },
  { id: 'sideplank', fam: 'Holds', group: 'Max hold', lvl: 1, name: 'Side Plank', sub: 'Each side; log your weaker one', metric: 'hold', fmt: 'stopwatch', cfg: {}, m: [] },
  { id: 'hstand', fam: 'Holds', group: 'Max hold', lvl: 3, name: 'Wall Handstand', sub: 'Chest to the wall, as long as you can', metric: 'hold', fmt: 'stopwatch', cfg: {}, m: [] },
  /* AEROBIC: anything with running */
  { id: 'mile', fam: 'Running', group: 'Aerobic', lvl: 1, name: '1 Mile Run', sub: 'As fast as you can. Tap Done at the line', metric: 'time', fmt: 'stopwatch', cfg: {}, m: [] },
  { id: 'murph', fam: 'Running', group: 'Aerobic', lvl: 3, name: 'Murph', sub: '1 mile, 100 pull-ups, 200 push-ups, 300 squats, 1 mile', metric: 'time', fmt: 'fortime', cfg: { ftRounds: 1, ftCap: 0 }, m: [['Run 1 mile', ''], ['pullup', 100], ['pushup', 200], ['bodyweight_squat', 300], ['Run 1 mile', '']] },
];
/* THE FAMILIES, in the order the list shows them (Nico, 8 Nov 2026: "group
   them: push-up test, then its variants; squat test, then its variants…
   less space, easier to find"). The first test of a family is its main one. */
export const FAMILIES = ['Push-ups', 'Squats', 'Pull-ups and dips', 'Calisthenics', 'Burpees', 'Holds', 'Classics', 'Running'];
export const MAIN_TEST = { 'Push-ups': 'cadence' };
/* THE OTHER WAY TO BROWSE: by the kind of test */
export const TYPES = ['For time', 'Max reps', 'Max hold', 'Sets'];
export const typeOf = x => x.cfg?.ftRest ? 'Sets' : x.metric === 'hold' ? 'Max hold' : x.metric === 'reps' ? 'Max reps' : 'For time';
export const testSig = id => 'test|' + id;
/* the number an attempt scored */
export function scoreOf(rec, def) {
  if (!rec) return null;
  if (def.metric === 'reps') return Number(rec.total) || 0;
  if (def.metric === 'time' && rec.partial) return null;   // an unfinished race has no time
  return Number(rec.score ?? rec.seconds) || null;
}
const better = (def, a, b) => b == null || (a != null && (def.metric === 'time' ? a < b : a > b));
export function attempts(hist, def) { return hist.filter(r => r.sig === testSig(def.id)); }
export function bestOf(hist, def) {
  let best = null;
  for (const r of attempts(hist, def)) { const s = scoreOf(r, def); if (s != null && better(def, s, best && scoreOf(best, def))) best = r; }
  return best;
}
export const isBetter = (def, a, b) => better(def, a, b);
