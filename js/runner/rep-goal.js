/* ============================================================
   REP GOAL: totals in, a workout out. "200 push-ups, 75 pull-ups, 500
   mountain climbers, 300 squats" becomes an EMOM, a Ladder, sets (You go,
   I go) or a For time, sized from how long each rep takes, so a minute
   or a rung is always doable. Plus the Burpee Club builder: a push-up
   total made of burpees with 1 to 10 push-ups each.
   Moves: [{ exId, name, reps (the total), pumps? }].
   ============================================================ */
import { EXERCISES } from '../data/exercises.js';

/* about how long one rep takes, in seconds (a hold: 1 per second) */
export function secPerRep(m) {
  const id = `${m.exId || ''} ${String(m.name || '').toLowerCase()}`;
  if (m.exId && EXERCISES[m.exId]?.measure === 'hold') return 1;
  if (/burpee/.test(id)) return 3.5 + 1.2 * (Number(m.pumps) || 0);
  if (/mountain|climber|jack|rope|skip|high.?knee|butt.?kick/.test(id)) return 0.6;
  if (/muscle|toes|t2b|rope.?climb/.test(id)) return 3.5;
  if (/pull|chin|row/.test(id)) return 3;
  if (/dip|push|press/.test(id)) return 2;
  if (/swing|snatch|clean|thruster/.test(id)) return 2;
  if (/squat|lunge|step|jump|box/.test(id)) return 2;
  if (/sit|crunch|v.?up|knee.?raise|leg.?raise/.test(id)) return 2;
  return 2.5;
}
const goalMoves = moves => moves.filter(m => String(m.name || '').trim() && Number(m.reps) > 0);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* EMOM: all moves every minute, about 40 s of work in each */
function emom(ms) {
  const work = ms.reduce((a, m) => a + m.reps * secPerRep(m), 0);
  const base = clamp(Math.ceil(work / 40), 5, 60);
  /* of the minute counts that keep a minute under ~48 s, the one whose
     rounded-up reps land closest to the goals */
  let best = null;
  for (let mins = base; mins <= Math.min(60, base + 15); mins++) {
    const per = ms.map(m => Math.ceil(m.reps / mins));
    const minute = per.reduce((a, r, i) => a + r * secPerRep(ms[i]), 0);
    const over = per.reduce((a, r, i) => a + (r * mins - ms[i].reps) / ms[i].reps, 0);
    if (minute <= 48 && (!best || over < best.over - 1e-9)) best = { mins, per, over };
  }
  if (!best) { const mins = 60; best = { mins, per: ms.map(m => Math.ceil(m.reps / mins)) }; }
  const { mins, per } = best;
  return { cfg: { fmt: 'emom', mins, every: 60, emomStyle: 'all' },
    moves: ms.map((m, i) => ({ ...m, reps: per[i] })),
    totals: per.map(r => r * mins), rows: mins };
}
/* LADDER, climbing: each move's total spread over the rungs in proportion
   1 : 2 : 3 …, rounded so it adds up exactly; as many rungs as keep the
   top rung near 2 minutes of work. Explicit reps per rung (`list`). */
function ladder(ms) {
  const work = ms.reduce((a, m) => a + m.reps * secPerRep(m), 0);
  const n = clamp(Math.ceil(2 * work / 150) - 1, 3, 30);
  const tri = n * (n + 1) / 2;
  /* 1 rep of each move on every rung (when the total allows), the rest climbing */
  const share = ms.map(m => { const base = m.reps >= n ? 1 : 0, extra = m.reps - base * n; let prev = 0;
    return Array.from({ length: n }, (_, k) => { const c = Math.round(extra * (k + 1) * (k + 2) / 2 / tri); const r = c - prev; prev = c; return base + r; }); });
  const list = Array.from({ length: n }, (_, k) => ms.map((_, i) => share[i][k]));
  return { cfg: { fmt: 'ladder', ldRungs: n, ldShape: 'one', ldCap: 0 }, list,
    moves: ms.map(m => ({ ...m, reps: '' })), totals: ms.map(m => m.reps), rows: n };
}
/* SETS, You go, I go: each total cut into sets of about 40 s, the moves
   taking turns */
function sets(ms) {
  const left = ms.map(m => m.reps), size = ms.map(m => clamp(Math.round(40 / secPerRep(m)), 1, m.reps));
  const out = [];
  while (left.some(x => x > 0)) ms.forEach((m, i) => { if (left[i] > 0) { const r = Math.min(size[i], left[i]); out.push({ ...m, reps: r }); left[i] -= r; } });
  return { cfg: { fmt: 'igyg', igRest: 'same' }, moves: out, totals: ms.map(m => m.reps), rows: out.length };
}
function fortime(ms) {
  return { cfg: { fmt: 'fortime', ftRounds: 1, ftCap: 0 }, moves: ms, totals: ms.map(m => m.reps), rows: 1 };
}
export const GOAL_AS = { emom, ladder, igyg: sets, fortime };
export function buildFromGoal(moves, as = 'emom') {
  const ms = goalMoves(moves).map(m => ({ ...m, reps: Number(m.reps) }));
  if (!ms.length) return null;
  return { ...(GOAL_AS[as] || emom)(ms), goal: ms };
}

/* BURPEE CLUB: a push-up total out of burpees with 1, 2, 3 … 10 push-ups
   each (the "pumps"), about 100 push-ups a set, up the pumps then back down
   until the total is met; the last set is trimmed to land on it exactly */
export function burpeeClub(total = 1000) {
  const up = [1, 2, 3, 4, 5, 6, 8, 10], seq = [...up, ...up.slice(0, -1).reverse()];
  const out = []; let got = 0, k = 0;
  while (got < total) {
    const p = seq[k % seq.length]; k++;
    const left = total - got;
    let reps = Math.min(50, Math.round(100 / p), Math.floor(left / p));
    if (reps < 1) { out.push({ exId: 'burpee', name: EXERCISES.burpee?.name || 'Burpee', reps: left, pumps: 1 }); break; }   // the rest, 1 push-up each
    out.push({ exId: 'burpee', name: EXERCISES.burpee?.name || 'Burpee', reps, pumps: p });
    got += reps * p;
  }
  return out;
}
