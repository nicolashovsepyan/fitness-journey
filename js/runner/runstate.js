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
let held = false;       // a stale run found at boot: kept, but not resumed until asked

/* NOT FOREVER. A run left unfinished came back a day and a half later
   with the clock at 2161 minutes. A reload mid-workout (the sound
   watchdog reloads the page, js/timer.js reloadForSound) is seconds old
   and still resumes on its own; a run quiet for longer than this waits
   on the home screen for Resume or Discard instead. */
export const STALE_MS = 3 * 60 * 60 * 1000;
/* the last moment the run was alive: every save stamps it, and the
   runner stamps it once a minute while it is on screen (touch). Read
   from that stamp only: a running step's end says nothing, a count-up
   carries a 99 minute cap as its "end". */
export function lastActiveAt(s) { return s ? (s.at || s.startedAt || 0) : 0; }
export function isStale(s, now = Date.now()) { return !!(s && !s.done && now - lastActiveAt(s) > STALE_MS); }

/* Boot step, awaited by app.js before it asks whether a run is active.
   Getting this wrong means the app decides "no workout in progress" for
   someone who is mid-set — the exact failure this file exists to
   prevent, so it fails loudly instead. */
export async function loadRunState(userId) {
  uid = userId;
  st = await storage().getRunState(userId);
  held = isStale(st);
  writer = createWriter(v => v === null
    ? storage().clearRunState(uid)
    : storage().saveRunState(uid, v));
  ready = true;
  return st;
}
export function runStateLoaded() { return ready; }
export async function flushRunState() { if (writer) await writer.flush(); }

function persist() { if (st) st.at = Date.now(); if (writer) writer.put(st); }

/* begin a new run from a resolved RunPlan */
export function start(plan) {
  held = false;
  st = {
    plan, startedAt: Date.now(),
    bi: 0, ii: 0, si: 0, ci: 0, round: 1, sub: 'work',   // block / item / set / circuit / round / phase cursor
    amrapRounds: 0, iv: null, ivPhase: 'work',
    stepStartedAt: null, stepDur: null, stepPausedAt: null, stepKey: null,   // active timed step (countdown), tap-circle pause
    screen: null, roundBuf: {},                  // which screen is up + reps typed mid-round, so a reopen lands on both
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
/* the heartbeat: the runner calls this every tick, it writes once a
   minute; and right away (now) when the page goes to the background */
export function touch(now = false) { if (st && !st.done && !held && (now || Date.now() - (st.at || 0) >= 60000)) persist(); }
export function clear() { held = false; st = null; persist(); }
/* a held run is not active: nothing jumps back into it on its own */
export function isActive() { return !held && !!(st && !st.done); }
export function heldRun() { return held && st && !st.done ? st : null; }
/* Resume on a held run: the hours away count as paused, so the clock
   picks up where it stopped instead of at 2161 minutes */
export function unhold() {
  if (!held) return st;
  held = false;
  if (st && !st.pausedAt) {
    const gap = Math.max(0, Date.now() - lastActiveAt(st));
    st.pausedAccum = (st.pausedAccum || 0) + gap;
    /* every wall-clock anchor a screen counts from moves with it */
    if (st.stepStartedAt != null && !st.stepPausedAt) st.stepStartedAt += gap;
    if (st.blockStart) st.blockStart += gap;
    if (st.btStart) st.btStart += gap;
  }
  persist();
  return st;
}

/* ---- timestamp-based clocks (correct even after the tab was frozen) ---- */

/* total session time in seconds, minus paused time */
export function sessionElapsed(s) {
  const paused = s.pausedAccum + (s.pausedAt ? Date.now() - s.pausedAt : 0);
  return Math.max(0, Math.floor((Date.now() - s.startedAt - paused) / 1000));
}

/* remaining seconds on the active timed step (rest/hold/interval), or null.
   Freezes while step-paused (tap-the-circle), without touching the session clock. */
/* the same, to the millisecond (in seconds): a segmented ring drops one
   segment at a time, however short the step */
export function stepRemainingExact(s) {
  if (s.stepDur == null || s.stepStartedAt == null) return null;
  const now = s.stepPausedAt || Date.now();
  return Math.max(0, s.stepDur - (now - s.stepStartedAt) / 1000);
}
export function stepRemaining(s) {
  if (s.stepDur == null || s.stepStartedAt == null) return null;
  const now = s.stepPausedAt || Date.now();
  const elapsed = Math.floor((now - s.stepStartedAt) / 1000);
  return Math.max(0, s.stepDur - elapsed);
}

/* start a timed step of `durSec` (rest, hold, buffer, interval).

   `key` names WHICH step this is (screen + cursor). Asking again for the
   step that is already running keeps its clock instead of restarting it -
   that is what makes a reopened app land mid-countdown rather than back at
   full. Returns true only when a new step actually started.

   `startAt` lets a step begin where the previous one ENDED rather than
   now, so back-to-back intervals keep a fixed wall-clock schedule and a
   locked phone catches up instead of drifting. */
export function beginStep(s, durSec, key = null, startAt = null) {
  if (key != null && s.stepKey === key && s.stepStartedAt != null) return false;
  s.stepStartedAt = startAt != null ? startAt : Date.now();
  s.stepDur = durSec; s.stepPausedAt = null; s.stepKey = key; save(s); return true;
}
/* the wall-clock moment the active step runs out (pause already folded in) */
export function stepEndsAt(s) {
  if (s.stepDur == null || s.stepStartedAt == null) return null;
  return s.stepStartedAt + s.stepDur * 1000;
}
export function clearStep(s) { s.stepStartedAt = null; s.stepDur = null; s.stepPausedAt = null; s.stepKey = null; save(s); return s; }

/* tap-the-circle pause — holds the active countdown only (session clock keeps running) */
export function isStepPaused(s) { return !!s.stepPausedAt; }
export function pauseStep(s) { if (s.stepStartedAt != null && !s.stepPausedAt) { s.stepPausedAt = Date.now(); save(s); } return s; }
export function resumeStep(s) { if (s.stepPausedAt) { s.stepStartedAt += Date.now() - s.stepPausedAt; s.stepPausedAt = null; save(s); } return s; }

export function pause(s) { if (!s.pausedAt) { s.pausedAt = Date.now(); save(s); } return s; }
export function resume(s) { if (s.pausedAt) { s.pausedAccum += Date.now() - s.pausedAt; s.pausedAt = null; save(s); } return s; }
export function finish(s) { s.done = true; save(s); return s; }
