/* ============================================================
   BEGINNER — shared logic for the second user's UI.
   Pure functions over the store + the resolved plan. No DOM.

   The two ideas that live here:
     1. RAMP-IN. Weeks 1 and 2 are warm-up + the A and B pairs only.
        Coming back three times matters more than finishing everything.
     2. STREAKS. Habits and workouts, Monday-anchored, so "this week"
        means the same thing everywhere in the app.
   ============================================================ */
import { resolveSession } from './core/resolve.js';
import { store, dayKey } from './store.js';
import { BEGINNER_PROGRAM } from './data/program.js';
import { BEGINNER_SESSIONS } from './data/sessions-beginner.js';

export const PROGRAM = BEGINNER_PROGRAM;
export const HABITS = BEGINNER_PROGRAM.habits;

/* ---- Monday-anchored weeks (same convention as the pro week screen) ---- */
export function weekStartMs(offsetWeeks = 0) {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7;              // 0 = Monday
  d.setDate(d.getDate() - dow - offsetWeeks * 7);
  return d.getTime();
}
export function weekDates(offsetWeeks = 0) {
  const start = weekStartMs(offsetWeeks);
  return Array.from({ length: 7 }, (_, i) => dayKey(new Date(start + i * 86400000)));
}

/* ---- ramp-in ------------------------------------------------
   Returns the plan he should actually see today: blocks scheduled
   for a later week are dropped, and the Day 3 circuit runs 2 rounds
   instead of 4 while he is still finding his feet.               */
export function beginnerPlan(sessionId, { week = store.programWeek() } = {}) {
  const plan = resolveSession(sessionId, {
    duration: PROGRAM.defaultDuration,
    swaps: store.getSwaps(sessionId),
    removed: store.getRemoved(sessionId),
  });
  const intro = week <= PROGRAM.introWeeks;
  plan.week = week;
  plan.intro = intro;
  plan.hiddenBlocks = plan.blocks.filter(b => (b.fromWeek || 1) > week).map(b => b.name);
  plan.blocks = plan.blocks
    .filter(b => (b.fromWeek || 1) <= week)
    .map(b => (intro && b.format === 'circuit' && b.role === 'Work' && b.rounds > 2)
      ? { ...b, rounds: 2, introTrimmed: true }
      : b);
  return plan;
}

/* ---- workouts ---------------------------------------------- */
export function sessionsInWeek(offsetWeeks = 0) {
  const start = weekStartMs(offsetWeeks), end = start + 7 * 86400000;
  return store.all.sessions.filter(s => {
    const t = new Date(s.date).getTime();
    return t >= start && t < end && BEGINNER_SESSIONS[s.sessionId || ''] !== undefined;
  });
}
/* fall back to name matching for sessions logged before sessionId was saved */
export function didSessionThisWeek(sessionId, offsetWeeks = 0) {
  const start = weekStartMs(offsetWeeks), end = start + 7 * 86400000;
  const name = BEGINNER_SESSIONS[sessionId]?.name;
  return store.all.sessions.some(s => {
    const t = new Date(s.date).getTime();
    return t >= start && t < end && (s.sessionId === sessionId || s.name === name);
  });
}
export function workoutsDone(offsetWeeks = 0) {
  return PROGRAM.week.filter(d => didSessionThisWeek(d.sessionId, offsetWeeks)).length;
}

/* ---- habits ------------------------------------------------ */
export function habitCount(offsetWeeks = 0) {
  const dates = weekDates(offsetWeeks);
  let daily = 0, dailyPossible = 0, sport = false;
  const today = dayKey();
  dates.forEach(d => {
    const h = store.getHabits(d);
    if (h.sport) sport = true;
    if (d > today) return;                       // don't count days that haven't happened
    HABITS.filter(x => x.daily).forEach(x => { dailyPossible++; if (h[x.id]) daily++; });
  });
  return { daily, dailyPossible, sport, pct: dailyPossible ? Math.round((daily / dailyPossible) * 100) : 0 };
}

/* A week "counts" when he trained all three days. That is the promise
   he made himself, so that — not the habits — is what the streak tracks. */
export function weekCounts(offsetWeeks) { return workoutsDone(offsetWeeks) >= PROGRAM.week.length; }
export function weekStreak() {
  // the current week only extends a streak once it's complete; either way we
  // then count backwards from last week, so a mid-week check-in never reads 0
  let n = weekCounts(0) ? 1 : 0;
  for (let i = 1; i < 104; i++) { if (weekCounts(i)) n++; else break; }
  return n;
}

/* ---- schedule ---------------------------------------------- */
export function scheduleId() { return store.getSetting('schedule', PROGRAM.defaultSchedule); }
export function scheduleDays() { return PROGRAM.schedules[scheduleId()].days; }
/* which program day (1-3) belongs to a given weekday, or null for a rest day */
export function programDayFor(date = new Date()) {
  const i = scheduleDays().indexOf(date.getDay());
  return i < 0 ? null : PROGRAM.week[i];
}
export function todaysSession() { return programDayFor(new Date()); }
/* the next training day, for the "up next" nudge on a rest day */
export function nextTrainingDay() {
  for (let i = 1; i <= 7; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    const pd = programDayFor(d);
    if (pd) return { ...pd, date: d, inDays: i };
  }
  return null;
}

export const DAY_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
