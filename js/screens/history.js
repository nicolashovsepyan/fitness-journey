/* ============================================================
   SCREEN — PROGRESS (History + Records).
   The IMPROVE pillar: your full archive. Every finished session is
   here, and every exercise's best — so each week you can beat last
   week's reps / weight / hold. Read-only view over the store.
   ============================================================ */
import { store } from '../store.js';
import { EXERCISES } from '../data/exercises.js';

const fmtDur = s => { const m = Math.floor((s || 0) / 60), ss = Math.floor((s || 0) % 60); return `${m}:${String(ss).padStart(2, '0')}`; };
const fmtDate = iso => { try { return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); } catch (e) { return ''; } };
const exName = id => EXERCISES[id]?.name || id;

/* turn a set list into "L 12 @25lb · R 11 @25lb" */
function setStr(sets) {
  const parts = (sets || []).filter(s => s.value != null && s.value !== '').map(s => {
    let t = String(s.value);
    if (s.side) t = `${s.side} ${t}`;
    if (s.weight != null && s.weight !== '') t += ` @${s.weight}lb`;
    return t;
  });
  return parts.length ? parts.join(' · ') : '–';
}

export function renderHistory(host, { onBack }) {
  let tab = 'sessions';
  const open = new Set();

  function draw() {
    const all = store.all;
    const sessions = [...all.sessions].reverse();
    host.innerHTML = `
      <div class="screen fade-in">
        <div class="topbar" style="margin-bottom:6px;">
          <button class="histbtn" id="hBack">‹ Back</button>
          <h1 style="margin:0;font-size:22px;">Progress</h1>
          <span style="width:54px;"></span>
        </div>
        <div class="hist-tabs">
          <button class="${tab === 'sessions' ? 'on' : ''}" id="tabS">History</button>
          <button class="${tab === 'records' ? 'on' : ''}" id="tabR">Records</button>
        </div>
        ${tab === 'sessions' ? sessionsHtml(sessions) : recordsHtml(all.prs, all.sessions)}
      </div>`;

    host.querySelector('#hBack').addEventListener('click', onBack);
    host.querySelector('#tabS').addEventListener('click', () => { tab = 'sessions'; draw(); });
    host.querySelector('#tabR').addEventListener('click', () => { tab = 'records'; draw(); });
    host.querySelectorAll('[data-key]').forEach(el => el.addEventListener('click', () => {
      const k = el.dataset.key; open.has(k) ? open.delete(k) : open.add(k); draw();
    }));
  }

  function sessionsHtml(sessions) {
    if (!sessions.length) return `<div class="hist-empty">No workouts logged yet.<br>Finish a session and it lands here.</div>`;
    return sessions.map((s, i) => {
      const exCount = (s.blocks || []).reduce((n, b) => n + (b.entries || []).filter(e => (e.sets || []).some(x => x.value != null)).length, 0);
      const isOpen = open.has('s' + i);
      const body = isOpen ? `<div class="hist-body">${(s.blocks || []).map(b => {
        const ents = (b.entries || []).filter(e => (e.sets || []).some(x => x.value != null));
        if (!ents.length) return '';
        return `<div class="hist-ex"><div class="blkname">${b.name || b.type || ''}</div></div>` +
          ents.map(e => `<div class="hist-ex"><div class="en">${e.name}</div><div class="es">${setStr(e.sets)}</div></div>`).join('');
      }).join('')}</div>` : '';
      return `<div class="hist-card"><div class="htop" data-key="s${i}">
          <div><div class="hname">${s.name}</div><div class="hmeta">${exCount} exercises · ${fmtDur(s.seconds)} · ${s.duration || ''} min plan</div></div>
          <div class="hdate">${fmtDate(s.date)}</div></div>${body}</div>`;
    }).join('');
  }

  function recordsHtml(prs, sessions) {
    const ids = Object.keys(prs || {});
    if (!ids.length) return `<div class="hist-empty">No records yet.<br>Your bests show up here as you train.</div>`;
    ids.sort((a, b) => new Date(prs[b].date) - new Date(prs[a].date));
    return ids.map(id => {
      const p = prs[id];
      const isOpen = open.has('p' + id);
      const body = isOpen ? `<div class="hist-body">${exHistory(id, sessions)}</div>` : '';
      return `<div class="hist-card"><div class="htop" data-key="p${id}">
          <div><div class="pn">${exName(id)}</div><div class="pd">best · ${fmtDate(p.date)}</div></div>
          <div class="pv">${p.value} ${p.unit}</div></div>${body}</div>`;
    }).join('');
  }

  /* this exercise across every session — recent first, to see the trend */
  function exHistory(id, sessions) {
    const rows = [];
    (sessions || []).forEach(s => (s.blocks || []).forEach(b => (b.entries || []).forEach(e => {
      if (e.exId !== id) return;
      const best = Math.max(...(e.sets || []).map(x => Number(x.value) || 0), 0);
      const w = (e.sets || []).map(x => x.weight).find(x => x != null);
      if (best > 0) rows.push({ date: s.date, best, w, unit: e.unit });
    })));
    rows.sort((a, b) => new Date(b.date) - new Date(a.date));
    if (!rows.length) return '<div class="es">No history yet.</div>';
    return rows.slice(0, 10).map(r =>
      `<div class="pr-row"><span class="pd">${fmtDate(r.date)}</span><span class="pv" style="font-size:14px;">${r.best}${r.w ? ` @${r.w}lb` : ''} ${r.unit}</span></div>`).join('');
  }

  draw();
}
