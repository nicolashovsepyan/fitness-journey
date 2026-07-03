/* ============================================================
   SCREEN — PROGRAM (3rd pillar)
   Two sub-tabs:
     • Build   — 1-2-3 day creator, draws anchors from the REAL
                 curated library, outputs a runner-ready session.
     • Library — the in-app database browser (single source of truth
                 that Swap mirrors).
   The built day is injected into SESSIONS so it reuses the entire
   day-view + runner + swap stack unchanged.
   ============================================================ */
import { EXERCISES } from '../data/exercises.js';
import { SESSIONS } from '../data/sessions.js';
import { PROGRAM, PROFILE } from '../data/program.js';
import { alternatives } from '../core/resolve.js';
import { renderLibrary } from './library.js';

/* ---- what you can focus a day on (maps onto the real DB) ---- */
const FOCUS = [
  { key: 'push',       label: 'Push',         match: e => e.pattern === 'push' },
  { key: 'pull',       label: 'Pull',         match: e => e.pattern === 'pull' },
  { key: 'quads',      label: 'Quads',        match: e => fams(e).includes('quads') },
  { key: 'pistol',     label: 'Pistol',       match: e => fams(e).includes('pistol') },
  { key: 'hamstrings', label: 'Hamstrings',   match: e => fams(e).includes('hamstrings') },
  { key: 'glutes',     label: 'Glutes',       match: e => fams(e).includes('glutes') },
  { key: 'knee-ankle', label: 'Knee & Ankle', match: e => fams(e).includes('knee-ankle') },
  { key: 'core',       label: 'Core',         match: e => e.pattern === 'core' },
  { key: 'skill',      label: 'Skill',        match: e => e.pattern === 'skill' },
];
const fams = e => e.families || (e.family ? [e.family] : []);

/* ---- goal → prescription (Galpin-aligned) ---- */
const RX = {
  strength:  { format: 'tempo',    sets: 4, reps: 5,  rest: 150, hold: 20, tempo: '311', label: 'Strength'    },
  size:      { format: 'straight', sets: 4, reps: 10, rest: 75,  hold: 30, label: 'Hypertrophy' },
  endurance: { format: 'straight', sets: 3, reps: 20, rest: 40,  hold: 45, label: 'Endurance'   },
  skill:     { format: 'skill',    sets: 4, reps: 5,  rest: 90,  hold: 15, label: 'Skill'       },
};
const GOALS = [['size','Hypertrophy'],['strength','Strength'],['endurance','Endurance'],['skill','Skill']];
const DURATIONS = [20, 30, 45, 60];
const LEVEL_DIFF = { beg: 3, int: 6, adv: 8 };
const ANCHORS_FOR = { 20: 2, 30: 3, 45: 3, 60: 4 };

const canDoWith = e => (e.equipment || ['bw']).every(q => q === 'bw' || PROFILE.equipment.includes(q));
const userLevel = () => PROFILE.level || 'int';

/* pick the best anchor for a focus at the user's level */
function pickAnchor(focusKey, exclude = new Set()) {
  const f = FOCUS.find(x => x.key === focusKey); if (!f) return null;
  const target = LEVEL_DIFF[userLevel()];
  const cand = Object.entries(EXERCISES)
    .filter(([id, e]) => f.match(e) && canDoWith(e) && !exclude.has(id) && (e.diff || 5) <= target + 2)
    .map(([id, e]) => ({ id, e, d: Math.abs((e.diff || 5) - target) }))
    .sort((a, b) => (a.d - b.d) || ((b.e.main ? 1 : 0) - (a.e.main ? 1 : 0)));
  return cand[0] ? cand[0].id : null;
}
/* easy bodyweight prep moves related to the chosen focuses */
function primerPool(focusKeys) {
  const fs = FOCUS.filter(x => focusKeys.includes(x.key));
  const pool = Object.entries(EXERCISES)
    .filter(([id, e]) => fs.some(f => f.match(e)) && (e.diff || 5) <= 3 && (e.equipment || ['bw']).every(q => q === 'bw' || q === 'band'))
    .map(([id]) => id);
  return pool;
}
const nameOf = id => (EXERCISES[id] || {}).name || id;

/* build a runner-ready session from the Build choices */
function buildSession(state) {
  const rx = RX[state.goal] || RX.size;
  const used = new Set();
  const blocks = [];

  // Primer
  const pp = primerPool(state.focus).filter(id => !used.has(id)).slice(0, 3);
  if (pp.length >= 2) {
    pp.forEach(id => used.add(id));
    blocks.push({ role: 'Primer', format: 'circuit', name: 'Primer', note: '2 rounds, controlled', rounds: 2,
      items: pp.map(id => EXERCISES[id].measure === 'hold' ? { ex: id, hold: 30 } : { ex: id, reps: 12 }) });
  }

  // Work anchors — round-robin the chosen focuses up to the duration budget
  const nAnchors = Math.max(state.focus.length, ANCHORS_FOR[state.duration] || 3);
  let i = 0;
  while (blocks.filter(b => b.role === 'Work').length < nAnchors) {
    const fk = state.focus[i % state.focus.length];
    const id = pickAnchor(fk, used);
    i++;
    if (!id) { if (i > state.focus.length * 3) break; continue; }
    used.add(id);
    const e = EXERCISES[id];
    const isHold = e.measure === 'hold';
    const item = isHold
      ? { ex: id, sets: rx.sets, hold: rx.hold, rest: rx.rest }
      : { ex: id, sets: rx.sets, reps: rx.reps, rest: rx.rest };
    if (rx.tempo && !isHold) item.tempo = rx.tempo;
    blocks.push({ role: 'Work', format: rx.format, name: e.name,
      note: `${rx.label} · ${FOCUS.find(f => f.key === fk).label}`, anchor: true, filler: true, focusKey: fk,
      items: [item] });
  }

  // Finisher
  if (state.finisher) {
    const coreId = Object.keys(EXERCISES).find(id => EXERCISES[id].pattern === 'core' && (EXERCISES[id].diff || 5) <= 5 && !used.has(id));
    const moveId = pickAnchor(state.focus[0], used) ||
      Object.keys(EXERCISES).find(id => FOCUS.find(f => f.key === state.focus[0]).match(EXERCISES[id]) && !used.has(id));
    const items = [];
    if (moveId) items.push(EXERCISES[moveId].measure === 'hold' ? { ex: moveId, hold: 30 } : { ex: moveId, reps: 15 });
    if (coreId) items.push({ ex: coreId, hold: 40 });
    if (items.length) blocks.push({ role: 'Finisher', format: 'circuit', name: 'Finisher Burner',
      note: '3 rounds, continuous', rounds: 3, transition: 8, roundRest: 20, items });
  }

  const label = state.focus.map(k => FOCUS.find(f => f.key === k).label).join(' · ');
  return {
    id: 'built_' + Date.now(),
    name: label + ' — Custom',
    category: 'custom', pattern: 'custom', tags: ['built'], built: true,
    goal: state.goal, duration: state.duration,
    blocks,
  };
}

/* ---- module-level build state (survives sub-tab toggles) ---- */
let state = { focus: [], goal: 'size', duration: 30, finisher: true, step: 1, session: null };

export function renderProgram(host, { sub = 'build', onOpenDay, setSub } = {}) {
  host.innerHTML = `
    <div class="screen fade-in">
      <div class="topbar" style="margin-bottom:14px;">
        <div><h1>Program</h1><div class="sub">Build a day · browse the library</div></div>
      </div>
      <div class="subtabs">
        <button class="subtab ${sub === 'build' ? 'on' : ''}" data-sub="build">Build</button>
        <button class="subtab ${sub === 'library' ? 'on' : ''}" data-sub="library">Library</button>
      </div>
      <div id="progBody"></div>
    </div>`;

  host.querySelectorAll('.subtab').forEach(b =>
    b.addEventListener('click', () => setSub?.(b.dataset.sub)));

  const body = host.querySelector('#progBody');
  if (sub === 'library') renderLibrary(body);
  else renderBuild(body, { onOpenDay });
}

function renderBuild(body, { onOpenDay }) {
  const seg = (opts, cur, attr) => opts.map(o => {
    const [v, l] = Array.isArray(o) ? o : [o, o];
    return `<button class="seg ${String(cur) === String(v) ? 'on' : ''}" data-${attr}="${v}">${l}</button>`;
  }).join('');

  body.innerHTML = `
    <!-- STEP 1 -->
    <div class="bstep">
      <div class="bnum">1</div><div class="btitle">What's the focus?</div>
    </div>
    <div class="chipwrap" id="focusWrap">
      ${FOCUS.map(f => `<button class="bchip ${state.focus.includes(f.key) ? 'on' : ''}" data-focus="${f.key}">${f.label}</button>`).join('')}
    </div>
    <div class="bhint" id="focusHint">Pick 1–3 areas to train.</div>

    <!-- STEP 2 -->
    <div class="bstep"><div class="bnum">2</div><div class="btitle">Duration & goal</div></div>
    <div class="brow"><span class="blabel">Time</span><div class="segrow" id="durRow">${seg(DURATIONS.map(d => [d, d + 'm']), state.duration, 'dur')}</div></div>
    <div class="brow"><span class="blabel">Goal</span><div class="segrow" id="goalRow">${seg(GOALS, state.goal, 'goal')}</div></div>
    <div class="brow"><span class="blabel">Finisher</span><div class="segrow" id="finRow">${seg([['1','On'],['0','Off']], state.finisher ? '1' : '0', 'fin')}</div></div>

    <!-- STEP 3 -->
    <div class="bstep"><div class="bnum">3</div><div class="btitle">Your day</div></div>
    <div id="previewWrap"></div>
    <div class="btn-row" style="margin-top:14px;">
      <button class="btn secondary" id="regenBtn">↻ Regenerate</button>
      <button class="btn" id="startBtn">Start workout</button>
    </div>
    <button class="btn ghost" id="saveBtn" style="margin-top:10px;">＋ Add to this week</button>
  `;

  const $ = s => body.querySelector(s);

  body.querySelectorAll('[data-focus]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.focus;
    if (state.focus.includes(k)) state.focus = state.focus.filter(x => x !== k);
    else if (state.focus.length < 3) state.focus.push(k);
    state.session = null; renderBuild(body, { onOpenDay });
  }));
  body.querySelectorAll('[data-dur]').forEach(b => b.addEventListener('click', () => { state.duration = +b.dataset.dur; state.session = null; renderBuild(body, { onOpenDay }); }));
  body.querySelectorAll('[data-goal]').forEach(b => b.addEventListener('click', () => { state.goal = b.dataset.goal; state.session = null; renderBuild(body, { onOpenDay }); }));
  body.querySelectorAll('[data-fin]').forEach(b => b.addEventListener('click', () => { state.finisher = b.dataset.fin === '1'; state.session = null; renderBuild(body, { onOpenDay }); }));

  $('#regenBtn').addEventListener('click', () => { state.session = null; renderPreview(); });
  $('#startBtn').addEventListener('click', () => {
    const s = ensureSession(); if (!s) return;
    SESSIONS[s.id] = s;
    onOpenDay?.(s.id);
  });
  $('#saveBtn').addEventListener('click', () => {
    const s = ensureSession(); if (!s) return;
    SESSIONS[s.id] = s;
    PROGRAM.week.push({ day: PROGRAM.week.length + 1, sessionId: s.id });
    toast(body, 'Added to this week');
  });

  function ensureSession() {
    if (!state.focus.length) { toast(body, 'Pick a focus first'); return null; }
    if (!state.session) state.session = buildSession(state);
    return state.session;
  }

  function renderPreview() {
    const wrap = $('#previewWrap');
    if (!state.focus.length) { wrap.innerHTML = `<div class="bempty">Pick a focus above to see your day.</div>`; return; }
    const s = ensureSession();
    wrap.innerHTML = s.blocks.map((b, bi) => `
      <div class="pblock">
        <div class="pbhead"><span class="pbrole">${b.role}</span><span class="pbname">${b.name}</span></div>
        ${b.items.map((it, ii) => {
          const e = EXERCISES[it.ex] || {};
          const dose = it.sets ? `${it.sets} × ${it.reps ? it.reps : (it.hold + 's')}` : (it.reps ? it.reps + ' reps' : (it.hold ? it.hold + 's' : ''));
          const swap = b.role === 'Work' ? `<button class="pswap" data-b="${bi}" data-i="${ii}">swap</button>` : '';
          return `<div class="pitem"><span class="pex">${e.name || it.ex}</span><span class="pdose">${dose}${b.rounds ? ' · ' + b.rounds + ' rd' : ''}</span>${swap}</div>`;
        }).join('')}
      </div>`).join('');

    wrap.querySelectorAll('.pswap').forEach(el => el.addEventListener('click', () => openSwap(+el.dataset.b, +el.dataset.i)));
  }

  function openSwap(bi, ii) {
    const s = state.session; const it = s.blocks[bi].items[ii];
    const alts = alternatives(it.ex, { constraint: PROFILE.constraints?.forearm, equipment: PROFILE.equipment }, []);
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="overlay-card">
      <div class="eyebrow">Swap · mirrors library</div>
      <h2 style="margin:6px 0 12px;">${nameOf(it.ex)}</h2>
      <div class="swaplist">${alts.slice(0, 14).map(a =>
        `<button class="swaprow" data-id="${a.id}"><span class="sd" style="background:${({beg:'#63b34d',int:'#ffb84d',adv:'#ff6b6b'})[a.level]||'#888'}">${a.diff || '?'}</span><span class="sn">${a.name}</span><span class="sf">${(a.families||[]).slice(0,1).join('')}</span></button>`
      ).join('') || '<div class="bempty">No alternatives.</div>'}</div>
      <button class="btn ghost" id="swapCancel" style="margin-top:12px;">Cancel</button>
    </div>`;
    body.appendChild(ov);
    ov.querySelector('#swapCancel').addEventListener('click', () => ov.remove());
    ov.querySelectorAll('.swaprow').forEach(r => r.addEventListener('click', () => {
      it.ex = r.dataset.id;
      s.blocks[bi].name = EXERCISES[r.dataset.id].name;
      ov.remove(); renderPreview();
    }));
  }

  // focus hint
  $('#focusHint').textContent = state.focus.length
    ? state.focus.map(k => FOCUS.find(f => f.key === k).label).join(' · ')
    : 'Pick 1–3 areas to train.';

  renderPreview();
}

function toast(host, msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  host.appendChild(t); setTimeout(() => t.remove(), 1800);
}
