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

/* a PR record → readable best. Weighted lifts show load (per side); bodyweight shows reps/hold. */
function fmtPR(p) {
  if (p.weight != null) {
    if (p.l != null || p.r != null) return `${p.weight}lb · L${p.l ?? '–'} · R${p.r ?? '–'}`;
    return `${p.weight}lb × ${p.value}`;
  }
  return `${p.value} ${p.unit}`;
}

const unitFor = m => m === 'hold' ? 'sec' : m === 'cals' ? 'cals' : 'reps';

/* turn a set list into "L 12 @25lb · R 11 @25lb  reps" (unit appended so it's never ambiguous) */
function setStr(sets, measure) {
  const parts = (sets || []).filter(s => s.value != null && s.value !== '').map(s => {
    let t = String(s.value);
    if (s.side) t = `${s.side} ${t}`;
    if (s.weight != null && s.weight !== '') t += ` @${s.weight}lb`;
    return t;
  });
  return parts.length ? `${parts.join(' · ')} <span class="u">${unitFor(measure)}</span>` : '–';
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
      const planSec = (s.duration || 0) * 60;
      const delta = planSec ? s.seconds - planSec : 0;
      const deltaBadge = planSec
        ? `<span class="tdelta ${Math.abs(delta) <= 60 ? 'on' : delta > 0 ? 'over' : 'under'}">${Math.abs(delta) <= 60 ? 'on plan' : `${delta > 0 ? '+' : '−'}${fmtDur(Math.abs(delta))} ${delta > 0 ? 'over' : 'under'}`}</span>` : '';
      const isOpen = open.has('s' + i);
      const body = isOpen ? `<div class="hist-body">${(s.blocks || []).map(b => {
        const ents = (b.entries || []).filter(e => (e.sets || []).some(x => x.value != null));
        if (!ents.length) return '';
        const bt = b.seconds ? `<span class="blktime">${fmtDur(b.seconds)}</span>` : '';
        return `<div class="blkhead"><span class="bh-role">${b.type || ''}</span><span class="bh-name">${b.name || ''}</span>${bt}</div>` +
          ents.map(e => `<div class="hist-ex"><div class="en">${e.name}</div><div class="es">${setStr(e.sets, e.measure)}</div></div>`).join('');
      }).join('')}</div>` : '';
      return `<div class="hist-card"><div class="htop" data-key="s${i}">
          <div><div class="hname">${s.name}</div><div class="hmeta">${exCount} exercises · ⏱ ${fmtDur(s.seconds)} · ${s.duration || ''} min plan ${deltaBadge}</div></div>
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
          <div class="pv">${fmtPR(p)}</div></div>${body}</div>`;
    }).join('');
  }

  /* this exercise across every session — recent first, to see the trend */
  function exHistory(id, sessions) {
    const rows = [];
    (sessions || []).forEach(s => (s.blocks || []).forEach(b => (b.entries || []).forEach(e => {
      if (e.exId !== id) return;
      const sets = (e.sets || []).filter(x => x.value != null && x.value !== '');
      if (!sets.length) return;
      const weighted = sets.some(x => x.weight != null && x.weight !== '');
      if (weighted) {
        const maxW = Math.max(...sets.filter(x => x.weight != null).map(x => Number(x.weight) || 0));
        const atW = sets.filter(x => Number(x.weight) === maxW);
        const reps = Math.max(...atW.map(x => Number(x.value) || 0));
        rows.push({ date: s.date, txt: `${maxW}lb × ${reps}` });
      } else {
        rows.push({ date: s.date, txt: `${Math.max(...sets.map(x => Number(x.value) || 0))} ${e.unit}` });
      }
    })));
    rows.sort((a, b) => new Date(b.date) - new Date(a.date));
    if (!rows.length) return '<div class="es">No history yet.</div>';
    return rows.slice(0, 10).map(r =>
      `<div class="pr-row"><span class="pd">${fmtDate(r.date)}</span><span class="pv" style="font-size:14px;">${r.txt}</span></div>`).join('');
  }

  draw();
}
