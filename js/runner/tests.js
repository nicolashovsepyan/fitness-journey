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
  { id: 'p100', group: 'For time', lvl: 1, name: '100 Push-ups', sub: 'As fast as you can, any way you like', metric: 'time', fmt: 'fortime', cfg: { ftRounds: 1, ftCap: 0 }, m: [['pushup', 100]] },
  { id: 'b100', group: 'For time', lvl: 2, name: '100 Burpees', sub: 'As fast as you can', metric: 'time', fmt: 'fortime', cfg: { ftRounds: 1, ftCap: 0 }, m: [['burpee', 100]] },
  { id: 'opm', group: 'For time', lvl: 2, name: 'One Punch Man', sub: '100 push-ups, 100 sit-ups, 100 squats', metric: 'time', fmt: 'fortime', cfg: { ftRounds: 1, ftCap: 0 }, m: [['pushup', 100], ['sit_up', 100], ['bodyweight_squat', 100]] },
  { id: 'angie', group: 'For time', lvl: 3, name: 'Angie', sub: '100 pull-ups, 100 push-ups, 100 sit-ups, 100 squats', metric: 'time', fmt: 'fortime', cfg: { ftRounds: 1, ftCap: 0 }, m: [['pullup', 100], ['pushup', 100], ['sit_up', 100], ['bodyweight_squat', 100]] },
  { id: 'murph', group: 'For time', lvl: 3, name: 'Murph', sub: '1 mile, 100 pull-ups, 200 push-ups, 300 squats, 1 mile', metric: 'time', fmt: 'fortime', cfg: { ftRounds: 1, ftCap: 0 }, m: [['Run 1 mile', ''], ['pullup', 100], ['pushup', 200], ['bodyweight_squat', 300], ['Run 1 mile', '']] },
  { id: 'pp5', group: 'Ladder', lvl: 2, name: 'Pull-up Pyramid', sub: '1 → 5 → 1 pull-ups, for time', metric: 'time', fmt: 'ladder', cfg: { ldRungs: 5, ldShape: 'mirror', ldCap: 0 }, m: [['pullup', 1, 1]] },
  { id: 'b21', group: 'Ladder', lvl: 2, name: '21-15-9 Burpees', sub: '45 burpees, for time', metric: 'time', fmt: 'ladder', cfg: { ldRungs: 3, ldShape: 'one', ldCap: 0 }, m: [['burpee', 21, -6]] },
  { id: 'seal', group: 'Max reps', lvl: 2, name: 'Navy SEAL Push-ups', sub: 'Max push-ups in 2 minutes', metric: 'reps', fmt: 'amrap', cfg: { cap: 2 }, m: [['pushup', '']] },
  { id: 'bur5', group: 'Max reps', lvl: 2, name: '5-Minute Burpees', sub: 'Max burpees in 5 minutes', metric: 'reps', fmt: 'amrap', cfg: { cap: 5 }, m: [['burpee', '']] },
  { id: 'cindy', group: 'Max reps', lvl: 3, name: 'Cindy', sub: '20 min: 5 pull-ups, 10 push-ups, 15 squats. Max rounds', metric: 'reps', fmt: 'amrap', cfg: { cap: 20 }, m: [['pullup', 5], ['pushup', 10], ['bodyweight_squat', 15]] },
  { id: 'cadence', group: 'Max reps', lvl: 1, name: 'Push-up Test', sub: '1 push-up every 3 seconds, as long as you can', metric: 'reps', fmt: 'pushup', cfg: { pace: 20, ptCap: 0 }, m: [] },
  { id: 'dbb', group: 'Max reps', lvl: 2, name: 'Death by Burpees', sub: '+1 burpee every minute until you can\'t', metric: 'reps', fmt: 'deathby', cfg: { dbEvery: 60, dbMax: 30 }, m: [['burpee', 1, 1]] },
  { id: 'hang', group: 'Max hold', lvl: 1, name: 'Dead Hang', sub: 'Hang as long as you can. The longevity target is 2:00', metric: 'hold', fmt: 'stopwatch', cfg: {}, m: [] },
  { id: 'plank', group: 'Max hold', lvl: 1, name: 'Plank', sub: 'Hold as long as you can, good form only', metric: 'hold', fmt: 'stopwatch', cfg: {}, m: [] },
  { id: 'wallsit', group: 'Max hold', lvl: 1, name: 'Wall Sit', sub: 'Thighs flat, as long as you can', metric: 'hold', fmt: 'stopwatch', cfg: {}, m: [] },
];
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
