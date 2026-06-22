/* ============================================================
   WORK MODE — run state (persisted + timestamp-based)
   The keystone for continuity: timing is computed from wall-clock
   timestamps, and the whole run is persisted to localStorage on
   every change. So the workout SURVIVES backgrounding, switching
   music, locking the screen, even a full reload — it resumes exactly
   where it was. (This is the v1 "logged me out mid-workout" fix.)

   Pure logic, no DOM — unit-testable.
   ============================================================ */
const KEY = 'fj.run';

/* begin a new run from a resolved RunPlan */
export function start(plan) {
  const st = {
    plan, startedAt: Date.now(),
    bi: 0, ii: 0, si: 0, ci: 0, round: 1, sub: 'work',   // block / item / set / circuit / round / phase cursor
    amrapRounds: 0, iv: null, ivPhase: 'work',
    stepStartedAt: null, stepDur: null,          // active timed step (countdown)
    pausedAccum: 0,                              // total paused ms (excluded from clocks)
    pausedAt: null,
    captured: {}, done: false,
  };
  save(st);
  return st;
}

export function load() {
  try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null; } catch (e) { return null; }
}
export function save(st) { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }
export function clear() { try { localStorage.removeItem(KEY); } catch (e) {} }
export function isActive() { const s = load(); return !!(s && !s.done); }

/* ---- timestamp-based clocks (correct even after the tab was frozen) ---- */
function nowMs(st) { return Date.now() - (st.pausedAt ? Date.now() - st.pausedAt : 0); }

/* total session time in seconds, minus paused time */
export function sessionElapsed(st) {
  const paused = st.pausedAccum + (st.pausedAt ? Date.now() - st.pausedAt : 0);
  return Math.max(0, Math.floor((Date.now() - st.startedAt - paused) / 1000));
}

/* remaining seconds on the active timed step (rest/hold/interval), or null */
export function stepRemaining(st) {
  if (st.stepDur == null || st.stepStartedAt == null) return null;
  const paused = st.pausedAt ? Date.now() - st.pausedAt : 0;
  const elapsed = Math.floor((Date.now() - st.stepStartedAt - paused) / 1000);
  return Math.max(0, st.stepDur - elapsed);
}

/* start a timed step of `durSec` (rest, hold, buffer, interval) */
export function beginStep(st, durSec) {
  st.stepStartedAt = Date.now(); st.stepDur = durSec; save(st); return st;
}
export function clearStep(st) { st.stepStartedAt = null; st.stepDur = null; save(st); return st; }

export function pause(st) { if (!st.pausedAt) { st.pausedAt = Date.now(); save(st); } return st; }
export function resume(st) { if (st.pausedAt) { st.pausedAccum += Date.now() - st.pausedAt; st.pausedAt = null; save(st); } return st; }
export function finish(st) { st.done = true; save(st); return st; }
