/* ============================================================
   STORE — the single source of truth for what you actually did.
   Local-first: lives on your device. One read/write API so no
   screen ever touches storage directly (prevents save bugs).

   MULTI-USER: the storage key is now resolved per active user
   (fj.v1.<uid>) via users.js, so two people never share state.
   ============================================================ */
import { storeKey } from './users.js';

const KEY = () => storeKey();

const DEFAULT = {
  goals: null,        // overrides data.js GOALS focus when set
  sessions: [],       // completed session logs
  prs: {},            // { exerciseId: { value, unit, date } }
  lastValues: {},     // { exerciseId: { reps, weight, hold } } for pre-fill
  swaps: {},          // { sessionId: { originalExId: newExId } } — exercise swaps
  removed: {},        // { sessionId: [originalExId] } — removed exercises
  order: {},          // { sessionId: { blocks:[blockName], items:{blockName:[exId]} } } — reorder
  added: {},          // { sessionId: { blockName: [ {ex, ...prescription} ] } } — added exercises
  fillerSwaps: {},    // { sessionId: { blockName: newExId } } — swap the rest-superset filler

  /* ---- beginner / coaching layer ---- */
  startDate: null,    // ISO date of the first app open — drives "which week am I in"
  settings: {},       // { schedule:'mwf'|'tts', lastCoachSend:ISO }
  habits: {},         // { 'YYYY-MM-DD': { walk:bool, no8pm:bool, protein:bool, sport:bool } }
  checks: {},         // { 'YYYY-MM-DD|sessionId|exId': [bool,…] } — per-set checkboxes
  notes: [],          // [{ date, sessionId, exId, name, text }]
  flags: [],          // [{ date, sessionId, exId, name, text }] — KNEE flags
  blockSkips: {},     // { sessionId: { blockName: true|false } } — Do-it/Skip per block (overrides the default)
  feedback: [],       // [{ date, sessionId, name, rating:'easy'|'right'|'hard', text }]
};

function read() {
  try {
    const raw = localStorage.getItem(KEY());
    if (!raw) return structuredClone(DEFAULT);
    return { ...structuredClone(DEFAULT), ...JSON.parse(raw) };
  } catch (e) {
    console.warn('store read failed, using default', e);
    return structuredClone(DEFAULT);
  }
}

function write(state) {
  try {
    localStorage.setItem(KEY(), JSON.stringify(state));
    return true;
  } catch (e) {
    console.error('store write failed', e);
    return false;
  }
}

/* local YYYY-MM-DD (never UTC — a 9pm workout must not land on tomorrow) */
export function dayKey(d = new Date()) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

export const store = {
  get all() { return read(); },

  getGoals() { return read().goals; },
  setGoals(goals) { const s = read(); s.goals = goals; write(s); },

  getRemoved(sessionId) { return read().removed[sessionId] || []; },
  setRemoved(sessionId, exId, on) {
    const s = read(); const list = new Set(s.removed[sessionId] || []);
    if (on) list.add(exId); else list.delete(exId);
    s.removed[sessionId] = [...list]; write(s);
  },
  resetDay(sessionId) {
    const s = read();
    delete s.swaps[sessionId]; delete s.removed[sessionId]; delete s.order[sessionId]; delete s.added[sessionId];
    if (s.fillerSwaps) delete s.fillerSwaps[sessionId];
    write(s);
  },

  getFillerSwaps(sessionId) { return read().fillerSwaps?.[sessionId] || {}; },
  setFillerSwap(sessionId, blockName, toEx) {
    const s = read(); s.fillerSwaps = s.fillerSwaps || {}; s.fillerSwaps[sessionId] = s.fillerSwaps[sessionId] || {};
    if (toEx) s.fillerSwaps[sessionId][blockName] = toEx; else delete s.fillerSwaps[sessionId][blockName];
    write(s);
  },

  getAdded(sessionId) { return read().added[sessionId] || {}; },
  addItem(sessionId, blockName, item) {
    const s = read(); s.added[sessionId] = s.added[sessionId] || {};
    s.added[sessionId][blockName] = s.added[sessionId][blockName] || [];
    s.added[sessionId][blockName].push(item); write(s);
  },
  removeAdded(sessionId, blockName, ex) {
    const s = read(); const list = s.added[sessionId]?.[blockName]; if (!list) return;
    s.added[sessionId][blockName] = list.filter(i => i.ex !== ex); write(s);
  },

  getOrder(sessionId) { return read().order[sessionId] || {}; },
  setBlockOrder(sessionId, names) {
    const s = read(); s.order[sessionId] = s.order[sessionId] || {}; s.order[sessionId].blocks = names; write(s);
  },
  setItemOrder(sessionId, blockName, exIds) {
    const s = read(); s.order[sessionId] = s.order[sessionId] || {};
    s.order[sessionId].items = s.order[sessionId].items || {};
    s.order[sessionId].items[blockName] = exIds; write(s);
  },

  getSwaps(sessionId) { return read().swaps[sessionId] || {}; },
  setSwap(sessionId, fromEx, toEx) {
    const s = read(); s.swaps[sessionId] = s.swaps[sessionId] || {};
    if (toEx) s.swaps[sessionId][fromEx] = toEx; else delete s.swaps[sessionId][fromEx];
    write(s);
  },

  getLast(exId) { return read().lastValues[exId] || null; },

  /* the full set sequence (warm-ups → work) from the most recent prior session with this exercise */
  getLastSets(exId) {
    const sessions = read().sessions;
    for (let i = sessions.length - 1; i >= 0; i--) {
      for (const b of (sessions[i].blocks || [])) {
        for (const e of (b.entries || [])) {
          if (e.exId === exId) {
            const sets = (e.sets || []).filter(s => s.value != null && s.value !== '');
            if (sets.length) return { date: sessions[i].date, sets };
          }
        }
      }
    }
    return null;
  },
  getPR(exId) { return read().prs[exId] || null; },
  setPR(exId, rec) { const s = read(); if (rec) s.prs[exId] = rec; else delete s.prs[exId]; write(s); },
  clearPR(exId) { const s = read(); delete s.prs[exId]; write(s); },
  prCount() { return Object.keys(read().prs).length; },
  sessionCount() { return read().sessions.length; },

  /* Save a finished session. Returns { prs:[...] } that were beaten. */
  saveSession(session) {
    const s = read();
    const newPRs = [];

    for (const block of session.blocks) {
      for (const entry of block.entries) {
        // rounds-based logs (circuit-AMRAP / intervals) aren't a per-exercise best — keep in history, skip PRs.
        // A single-exercise max-out (e.g. Push-Up AMRAP) logs reps and CAN set a PR.
        if (entry.rounds) continue;
        // entry: { exId, name, measure, unit, load, sets:[{value, side, weight}] }
        const sets = (entry.sets || []).filter(x => x.value != null && x.value !== '');
        const last = s.lastValues[entry.exId] || {};
        for (const set of sets) {
          last[entry.measure] = set.value;
          if (set.weight != null && set.weight !== '') last.weight = set.weight;
        }
        if (sets.length) s.lastValues[entry.exId] = last;

        // PR check. Skip warm-up / mobility (entry.noPR) and non-numeric measures.
        if (entry.noPR || !sets.length) continue;
        if (entry.measure !== 'reps' && entry.measure !== 'hold') continue;

        const weighted = entry.load === 'weighted' || sets.some(x => x.weight != null && x.weight !== '');
        const prev = s.prs[entry.exId];
        let rec = null, beaten = false;

        if (weighted) {
          // record = heaviest working set (the failure set, not warm-ups), reps at that load, per side
          const wsets = sets.filter(x => x.weight != null && x.weight !== '');
          if (wsets.length) {
            const maxW = Math.max(...wsets.map(x => Number(x.weight) || 0));
            const atW = wsets.filter(x => Number(x.weight) === maxW);
            const reps = Math.max(...atW.map(x => Number(x.value) || 0));
            const l = Math.max(0, ...atW.filter(x => x.side === 'L').map(x => Number(x.value) || 0)) || null;
            const r = Math.max(0, ...atW.filter(x => x.side === 'R').map(x => Number(x.value) || 0)) || null;
            beaten = !prev || !prev.weight || maxW > prev.weight || (maxW === prev.weight && reps > (prev.value || 0));
            rec = { weight: maxW, value: reps, l, r, unit: entry.unit, date: session.date };
          }
        } else {
          const best = Math.max(0, ...sets.map(x => Number(x.value) || 0));
          beaten = best > (prev?.value || 0);
          rec = { value: best, unit: entry.unit, date: session.date };
        }

        if (rec && beaten) {
          s.prs[entry.exId] = rec;
          newPRs.push({ exId: entry.exId, name: entry.name, ...rec });
        }
      }
    }

    s.sessions.push(session);
    write(s);
    return { prs: newPRs };
  },

  /* ==========================================================
     BEGINNER / COACHING LAYER
     Habits, per-set checkboxes, exercise notes, knee flags and
     end-of-session feedback. All plain data — the weekly summary
     and the "send to coach" report are built from these.
     ========================================================== */

  /* first-open date, so we can say which week of the program he's in */
  startDate() {
    const s = read();
    if (s.startDate) return s.startDate;
    s.startDate = dayKey(); write(s);
    return s.startDate;
  },
  /* 1-based program week */
  programWeek() {
    const start = new Date(this.startDate() + 'T00:00:00');
    const days = Math.floor((Date.now() - start.getTime()) / 86400000);
    return Math.max(1, Math.floor(days / 7) + 1);
  },

  getSetting(k, fallback = null) { const v = read().settings?.[k]; return v === undefined ? fallback : v; },
  setSetting(k, v) { const s = read(); s.settings = s.settings || {}; s.settings[k] = v; write(s); },

  /* ---- daily habit checkboxes ---- */
  getHabits(date = dayKey()) { return read().habits[date] || {}; },
  toggleHabit(habitId, date = dayKey()) {
    const s = read();
    s.habits[date] = s.habits[date] || {};
    s.habits[date][habitId] = !s.habits[date][habitId];
    write(s);
    return s.habits[date][habitId];
  },
  habitsBetween(startMs, endMs) {
    const h = read().habits, out = {};
    for (const [d, v] of Object.entries(h)) {
      const t = new Date(d + 'T00:00:00').getTime();
      if (t >= startMs && t < endMs) out[d] = v;
    }
    return out;
  },

  /* ---- per-set checkboxes on the day screen ---- */
  getChecks(sessionId, exId, date = dayKey()) { return read().checks[`${date}|${sessionId}|${exId}`] || []; },
  toggleCheck(sessionId, exId, setIndex, date = dayKey()) {
    const s = read(); const k = `${date}|${sessionId}|${exId}`;
    const arr = s.checks[k] || [];
    arr[setIndex] = !arr[setIndex];
    s.checks[k] = arr; write(s);
    return arr;
  },
  clearChecks(sessionId, date = dayKey()) {
    const s = read();
    Object.keys(s.checks).forEach(k => { if (k.startsWith(`${date}|${sessionId}|`)) delete s.checks[k]; });
    write(s);
  },

  /* ---- exercise notes ---- */
  getNote(sessionId, exId, date = dayKey()) {
    return read().notes.find(n => n.date === date && n.sessionId === sessionId && n.exId === exId)?.text || '';
  },
  setNote(sessionId, exId, name, text, date = dayKey()) {
    const s = read();
    const i = s.notes.findIndex(n => n.date === date && n.sessionId === sessionId && n.exId === exId);
    if (!text || !text.trim()) { if (i >= 0) s.notes.splice(i, 1); }
    else if (i >= 0) s.notes[i].text = text.trim();
    else s.notes.push({ date, sessionId, exId, name, text: text.trim() });
    write(s);
  },
  notesSince(ms) { return read().notes.filter(n => new Date(n.date + 'T00:00:00').getTime() >= ms); },

  /* ---- knee flags ---- */
  isFlagged(sessionId, exId, date = dayKey()) {
    return read().flags.some(f => f.date === date && f.sessionId === sessionId && f.exId === exId);
  },
  toggleFlag(sessionId, exId, name, text = '', date = dayKey()) {
    const s = read();
    const i = s.flags.findIndex(f => f.date === date && f.sessionId === sessionId && f.exId === exId);
    if (i >= 0) { s.flags.splice(i, 1); write(s); return false; }
    s.flags.push({ date, sessionId, exId, name, text }); write(s); return true;
  },
  flagsSince(ms) { return read().flags.filter(f => new Date(f.date + 'T00:00:00').getTime() >= ms); },
  /* every exercise ever flagged, most-flagged first — the standing watch list */
  flagTally() {
    const t = {};
    read().flags.forEach(f => { t[f.exId] = t[f.exId] || { exId: f.exId, name: f.name, count: 0, last: f.date };
      t[f.exId].count++; if (f.date > t[f.exId].last) t[f.exId].last = f.date; });
    return Object.values(t).sort((a, b) => b.count - a.count);
  },

  /* ---- Do-it / Skip per block (beginner) ----
     Returns the user's explicit choice for a block, or undefined if they
     haven't touched it (so the program's default applies). */
  getBlockSkip(sessionId, blockName) {
    const v = read().blockSkips?.[sessionId]?.[blockName];
    return v === undefined ? undefined : !!v;
  },
  setBlockSkip(sessionId, blockName, skip) {
    const s = read();
    s.blockSkips = s.blockSkips || {};
    s.blockSkips[sessionId] = s.blockSkips[sessionId] || {};
    s.blockSkips[sessionId][blockName] = !!skip;
    write(s);
  },

  /* ---- end-of-session feedback ---- */
  addFeedback(rec) { const s = read(); s.feedback.push({ date: dayKey(), ...rec }); write(s); },
  feedbackSince(ms) { return read().feedback.filter(f => new Date(f.date + 'T00:00:00').getTime() >= ms); },

  sessionsSince(ms) {
    return read().sessions.filter(s => new Date(s.date).getTime() >= ms);
  },

  exportJSON() { return JSON.stringify(read(), null, 2); },
  reset() { localStorage.removeItem(KEY()); },
};
