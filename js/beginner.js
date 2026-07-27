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

/* ---- the day's plan ----------------------------------------
   Every block is SHOWN — nothing is hidden. Each one carries a `skipped`
   flag so the day screen can offer a Do-it / Skip toggle. The default:
     · the warm-up and the two main pairs are always on
     · the "extra" pairs (C, D) default to skipped in the intro weeks, then
       default on — but the user's explicit choice always wins
     · finishers default on
   The Day-3 circuit still runs a lighter 2 rounds during the intro weeks. */
export function beginnerPlan(sessionId, { week = store.programWeek() } = {}) {
  const plan = resolveSession(sessionId, {
    duration: PROGRAM.defaultDuration,
    swaps: store.getSwaps(sessionId),
    removed: store.getRemoved(sessionId),
  });
  const intro = week <= PROGRAM.introWeeks;
  plan.week = week;
  plan.intro = intro;

  plan.blocks = plan.blocks.map(b => {
    const nb = (intro && b.format === 'circuit' && b.role === 'Work' && b.rounds > 2)
      ? { ...b, rounds: 2, introTrimmed: true }
      : { ...b };
    const isWarmup = b.role === 'Primer';
    const defaultSkip = b.extra && intro;                 // extras rest until you're ready
    const choice = store.getBlockSkip(sessionId, b.name); // explicit Do-it/Skip, if set
    nb.skippable = !isWarmup && (!!b.optional || !!b.extra);
    nb.skipped = nb.skippable ? (choice === undefined ? defaultSkip : choice) : false;
    return nb;
  });
  plan.activeBlocks = plan.blocks.filter(b => !b.skipped);
  return plan;
}

/* the plan the RUNNER should play — skipped blocks removed */
export function beginnerRunPlan(sessionId, opts) {
  const plan = beginnerPlan(sessionId, opts);
  return { ...plan, blocks: plan.blocks.filter(b => !b.skipped) };
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

/* Nicolas's own moody hero images, mapped to the three days so the beginner
   app looks like his original, not a spreadsheet. */
export const DAY_IMG = {
  b_upper_1: 'images/day-hyp.png',       // muscular torso — upper
  b_upper_2: 'images/day-strength.png',  // belt + plates — upper/strength
  b_full_3:  'images/day-cond.png',      // conditioning — full body
};
/* per-block hero: reuse the day image, plus a couple of accents for finishers */
export function blockImg(sessionId, block) {
  if (/finish/i.test(block.role)) return 'images/day-cond.png';
  return DAY_IMG[sessionId] || 'images/day-hyp.png';
}
