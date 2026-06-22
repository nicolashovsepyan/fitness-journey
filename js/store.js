/* ============================================================
   STORE — the single source of truth for what you actually did.
   Local-first: lives on your device. One read/write API so no
   screen ever touches storage directly (prevents save bugs).
   ============================================================ */

const KEY = 'fj.v1';

const DEFAULT = {
  goals: null,        // overrides data.js GOALS focus when set
  sessions: [],       // completed session logs
  prs: {},            // { exerciseId: { value, unit, date } }
  lastValues: {},     // { exerciseId: { reps, weight, hold } } for pre-fill
  swaps: {},          // { sessionId: { originalExId: newExId } } — exercise swaps
  removed: {},        // { sessionId: [originalExId] } — removed exercises
  order: {},          // { sessionId: { blocks:[blockName], items:{blockName:[exId]} } } — reorder
};

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT);
    return { ...structuredClone(DEFAULT), ...JSON.parse(raw) };
  } catch (e) {
    console.warn('store read failed, using default', e);
    return structuredClone(DEFAULT);
  }
}

function write(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.error('store write failed', e);
    return false;
  }
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
    const s = read(); delete s.swaps[sessionId]; delete s.removed[sessionId]; delete s.order[sessionId]; write(s);
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
  getPR(exId) { return read().prs[exId] || null; },
  prCount() { return Object.keys(read().prs).length; },
  sessionCount() { return read().sessions.length; },

  /* Save a finished session. Returns { prs:[...] } that were beaten. */
  saveSession(session) {
    const s = read();
    const newPRs = [];

    for (const block of session.blocks) {
      for (const entry of block.entries) {
        // entry: { exId, name, measure, unit, sets:[{value, side, weight}] }
        const last = s.lastValues[entry.exId] || {};
        for (const set of entry.sets) {
          if (set.value != null && set.value !== '') {
            last[entry.measure] = set.value;
            if (set.weight != null && set.weight !== '') last.weight = set.weight;
          }
        }
        s.lastValues[entry.exId] = last;

        // PR check — best numeric value for reps/hold.
        // Skip warm-up / mobility / joint-prep moves (entry.noPR).
        if (!entry.noPR && (entry.measure === 'reps' || entry.measure === 'hold')) {
          const best = Math.max(...entry.sets.map(x => Number(x.value) || 0), 0);
          const prev = s.prs[entry.exId]?.value || 0;
          if (best > prev) {
            s.prs[entry.exId] = { value: best, unit: entry.unit, date: session.date };
            newPRs.push({ exId: entry.exId, name: entry.name, value: best, unit: entry.unit });
          }
        }
      }
    }

    s.sessions.push(session);
    write(s);
    return { prs: newPRs };
  },

  exportJSON() { return JSON.stringify(read(), null, 2); },
  reset() { localStorage.removeItem(KEY); },
};
