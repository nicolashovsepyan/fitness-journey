/* ============================================================
   WORK MODE — run state (persisted + timestamp-based)
   The keystone for continuity: timing is computed from wall-clock
   timestamps, and the whole run is persisted on every change. So the
   workout SURVIVES backgrounding, switching music, locking the screen,
   even a full reload — it resumes exactly where it was. (This is the
   v1 "logged me out mid-workout" fix.)

   PHASE 2: this file no longer touches localStorage. It holds the run
   in memory and persists it through the storage adapter, the same
   shape as the store — load once at boot, mutate synchronously, write
   through a serialised queue.

   The cache is not an optimisation here, it is the requirement. The
   runner calls load() inside render paths and timer ticks, dozens of
   times a second; those cannot await. And two saves racing during a
   set is exactly how a rep goes missing.

   DEVICE-LOCAL, NEVER SYNCED. A workout in progress belongs to the
   phone in your hand. If two devices could resume the same session,
   whichever finished last would overwrite the other.

   Pure logic, no DOM — unit-testable.
   ============================================================ */
import { storage } from '../core/storage.js';
import { createWriter } from '../core/persist.js';

let uid = null;
let st = null;          // the live run, or null
let writer = null;
let ready = false;

/* Boot step, awaited by app.js before it asks whether a run is active.
   Getting this wrong means the app decides "no workout in progress" for
   someone who is mid-set — the exact failure this file exists to
   prevent, so it fails loudly instead. */
export async function loadRunState(userId) {
  uid = userId;
  st = await storage().getRunState(userId);
  writer = createWriter(v => v === null
    ? storage().clearRunState(uid)
    : storage().saveRunState(uid, v));
  ready = true;
  return st;
}
export function runStateLoaded() { return ready; }
export async function flushRunState() { if (writer) await writer.flush(); }

function persist() { if (writer) writer.put(st); }

/* begin a new run from a resolved RunPlan */
export function start(plan) {
  st = {
    plan, startedAt: Date.now(),
    bi: 0, ii: 0, si: 0, ci: 0, round: 1, sub: 'work',   // block / item / set / circuit / round / phase cursor
    amrapRounds: 0, iv: null, ivPhase: 'work',
    stepStartedAt: null, stepDur: null, stepPausedAt: null,   // active timed step (countdown), tap-circle pause
    pausedAccum: 0,                              // total paused ms (excluded from clocks)
    pausedAt: null,
    blockStart: null, blockTimes: {},            // per-block wall-clock seconds (for history)
    captured: {}, done: false,
  };
  persist();
  return st;
}

export function load() {
  if (!ready) {
    throw new Error('runstate read before loadRunState() — the app must await it at boot');
  }
  return st;
}
export function save(next) { st = next; persist(); return st; }
export function clear() { st = null; persist(); }
export function isActive() { return !!(st && !st.done); }

/* ---- timestamp-based clocks (correct even after the tab was frozen) ---- */

/* total session time in seconds, minus paused time */
export function sessionElapsed(s) {
  const paused = s.pausedAccum + (s.pausedAt ? Date.now() - s.pausedAt : 0);
  return Math.max(0, Math.floor((Date.now() - s.startedAt - paused) / 1000));
}

/* remaining seconds on the active timed step (rest/hold/interval), or null.
   Freezes while step-paused (tap-the-circle), without touching the session clock. */
export function stepRemaining(s) {
  if (s.stepDur == null || s.stepStartedAt == null) return null;
  const now = s.stepPausedAt || Date.now();
  const elapsed = Math.floor((now - s.stepStartedAt) / 1000);
  return Math.max(0, s.stepDur - elapsed);
}

/* start a timed step of `durSec` (rest, hold, buffer, interval) */
export function beginStep(s, durSec) {
  s.stepStartedAt = Date.now(); s.stepDur = durSec; s.stepPausedAt = null; save(s); return s;
}
export function clearStep(s) { s.stepStartedAt = null; s.stepDur = null; s.stepPausedAt = null; save(s); return s; }

/* tap-the-circle pause — holds the active countdown only (session clock keeps running) */
export function isStepPaused(s) { return !!s.stepPausedAt; }
export function pauseStep(s) { if (s.stepStartedAt != null && !s.stepPausedAt) { s.stepPausedAt = Date.now(); save(s); } return s; }
export function resumeStep(s) { if (s.stepPausedAt) { s.stepStartedAt += Date.now() - s.stepPausedAt; s.stepPausedAt = null; save(s); } return s; }

export function pause(s) { if (!s.pausedAt) { s.pausedAt = Date.now(); save(s); } return s; }
export function resume(s) { if (s.pausedAt) { s.pausedAccum += Date.now() - s.pausedAt; s.pausedAt = null; save(s); } return s; }
export function finish(s) { s.done = true; save(s); return s; }
