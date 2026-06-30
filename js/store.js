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
  added: {},          // { sessionId: { blockName: [ {ex, ...prescription} ] } } — added exercises
  fillerSwaps: {},    // { sessionId: { blockName: newExId } } — swap the rest-superset filler
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

  exportJSON() { return JSON.stringify(read(), null, 2); },
  reset() { localStorage.removeItem(KEY); },
};
