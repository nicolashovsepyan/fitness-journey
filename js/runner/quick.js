/* ============================================================
   QUICK TIMER — the standalone timer, no program needed.
   Pick a format, set the numbers, optionally list the moves, go.

   It does not run anything itself. It writes an ordinary RunPlan and
   hands it to Work Mode, the same runner a program day uses, so every
   timer fix lands here too: the wall-clock schedule, resume after the
   phone locks, beeps over music, save on exit.

   Opened as index.html?quick. Its look lives in this file (injected
   once) so the timer does not depend on anybody else's stylesheet.
   ============================================================ */
import { storage } from '../core/storage.js';
import { fmt } from '../timer.js';
import { DEMOS } from './demo.js';
import { activeUserId } from '../users.js';

/* ?demo adds the Work Mode preview: a sample of every program format */
const showDemo = () => new URLSearchParams(location.search).has('demo');
const standalone = () => window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;

/* every format the setup screen offers, and the numbers each one asks for */
const FORMATS = [
  { id: 'emom',      name: 'EMOM',      sub: 'Every minute on the minute', moves: true },
  { id: 'amrap',     name: 'AMRAP',     sub: 'Most rounds in the time',    moves: true },
  { id: 'fortime',   name: 'For time',  sub: 'Race the clock, tap done',   moves: true },
  { id: 'tabata',    name: 'Tabata',    sub: '20 on, 10 off, 8 rounds',    moves: true },
  { id: 'intervals', name: 'Intervals', sub: 'Your own work and rest',     moves: true },
  { id: 'stopwatch', name: 'Stopwatch', sub: 'Count up, tap to pause',     moves: false },
  { id: 'countdown', name: 'Countdown', sub: 'One timer, one beep',        moves: false },
];
/* field: [label, unit, step, min, max] */
const FIELDS = {
  every:    ['Every',            'sec',    15, 15, 600],
  mins:     ['Total',            'min',     1,  1,  90],
  cap:      ['Time cap',         'min',     1,  1,  90],
  ftCap:    ['Time cap',         'min',     1,  0,  90],
  ftRounds: ['Rounds',           '',        1,  1,  20],
  work:     ['Work',             'sec',     5,  5, 600],
  rest:     ['Rest',             'sec',     5,  0, 600],
  rounds:   ['Rounds',           '',        1,  1,  60],
  sets:     ['Sets',             '',        1,  1,  10],
  setRest:  ['Rest between sets', 'sec',   15,  0, 600],
  cdMin:    ['Minutes',          'min',     1,  0, 180],
  cdSec:    ['Seconds',          'sec',     5,  0,  55],
};
const FIELDS_OF = {
  emom: ['every', 'mins'], amrap: ['cap'], fortime: ['ftCap', 'ftRounds'],
  tabata: ['work', 'rest', 'rounds'], intervals: ['work', 'rest', 'rounds', 'sets', 'setRest'],
  stopwatch: [], countdown: ['cdMin', 'cdSec'],
};
const DEFAULTS = {
  fmt: 'emom', every: 60, mins: 12, cap: 10, ftCap: 0, ftRounds: 1,
  work: 20, rest: 10, rounds: 8, sets: 1, setRest: 60, cdMin: 5, cdSec: 0,
  ready: 10, moves: [{ name: '', reps: '' }],
};
const TABATA = { work: 20, rest: 10, rounds: 8 };
const PREF = 'quickTimer';

let cfg = null, favs = [], host = null, onStart = null;

export async function renderQuick(el, opts = {}) {
  host = el; onStart = opts.onStart;
  injectStyle();
  /* The address itself names the person, so "Add to Home Screen" from here
     gives a timer icon that opens as THEM (an installed iPhone app cannot
     see Safari's storage). */
  try {
    const p = new URLSearchParams(location.search);
    if (!p.has('user') && activeUserId()) { p.set('user', activeUserId()); history.replaceState(null, '', `${location.pathname}?${p.toString().replace(/=(&|$)/g, '$1')}`); }
  } catch (e) {}
  let saved = null;
  try { saved = await storage().getDevicePref(PREF, null); } catch (e) {}
  cfg = { ...DEFAULTS, ...(saved?.last || {}) };
  if (!Array.isArray(cfg.moves) || !cfg.moves.length) cfg.moves = [{ name: '', reps: '' }];
  favs = Array.isArray(saved?.favs) ? saved.favs : [];
  draw();
}

function persist() {
  try { storage().setDevicePref(PREF, { last: cfg, favs }); } catch (e) {}
}

/* ---------------- plan ---------------- */
const clamp = (v, k) => { const [, , , lo, hi] = FIELDS[k]; return Math.min(hi, Math.max(lo, Math.round(Number(v) || 0))); };
const namedMoves = () => (FORMATS.find(f => f.id === cfg.fmt)?.moves ? (cfg.moves || []) : [])
  .filter(m => String(m.name || '').trim())
  .map(m => ({ name: String(m.name).trim(), measure: 'reps', reps: Number(m.reps) > 0 ? Number(m.reps) : null, noPR: true }));

function emomCount() { return Math.max(1, Math.floor((cfg.mins * 60) / cfg.every)); }
function totalSec() {
  switch (cfg.fmt) {
    case 'emom': return emomCount() * cfg.every;
    case 'amrap': return cfg.cap * 60;
    case 'fortime': return cfg.ftCap * 60;
    case 'tabata': case 'intervals': {
      const one = cfg.rounds * cfg.work + (cfg.rounds - 1) * cfg.rest;
      const sets = cfg.fmt === 'intervals' ? cfg.sets : 1;
      return sets * one + (sets - 1) * (cfg.fmt === 'intervals' ? cfg.setRest : 0);
    }
    case 'countdown': return cfg.cdMin * 60 + cfg.cdSec;
    default: return 0;
  }
}
function summary() {
  const t = totalSec();
  switch (cfg.fmt) {
    case 'emom': return `${emomCount()} intervals · ${fmt(t)} total`;
    case 'amrap': return `${fmt(t)} to get as many rounds as you can`;
    case 'fortime': return cfg.ftCap ? `Stops at ${fmt(t)} if you're not done` : 'No cap. Tap done when you finish';
    case 'tabata': case 'intervals': return `${fmt(t)} total`;
    case 'stopwatch': return 'Tap the ring to pause. Tap done to stop';
    case 'countdown': return t ? `${fmt(t)}` : 'Set a time';
    default: return '';
  }
}
function planName() {
  const f = cfg.fmt;
  if (f === 'emom') return cfg.every === 60 ? `EMOM · ${cfg.mins} min` : `Every ${fmt(cfg.every)} · ${cfg.mins} min`;
  if (f === 'amrap') return `AMRAP · ${cfg.cap} min`;
  if (f === 'fortime') return `For time${cfg.ftCap ? ` · ${cfg.ftCap} min cap` : ''}`;
  if (f === 'tabata') return `Tabata · ${cfg.rounds} × ${cfg.work}/${cfg.rest}`;
  if (f === 'intervals') return `Intervals · ${cfg.sets > 1 ? cfg.sets + ' × ' : ''}${cfg.rounds} × ${cfg.work}/${cfg.rest}`;
  if (f === 'countdown') return `Countdown · ${fmt(totalSec())}`;
  return 'Stopwatch';
}

/* the RunPlan Work Mode will play */
export function buildPlan(c = cfg) {
  const prev = cfg; cfg = c;
  try {
    const moves = namedMoves();
    const id = n => `q${n}`;
    const base = { role: 'Work', items: moves };
    const name = planName();
    let blocks = [];
    switch (cfg.fmt) {
      case 'emom':
        blocks = [{ ...base, id: id(1), name, format: 'emom', label: cfg.every === 60 ? 'EMOM' : `Every ${fmt(cfg.every)}`,
          work: cfg.every, rest: 0, intervals: emomCount(),
          items: moves.length ? moves : [{ name: 'Work', measure: 'rounds' }] }];
        break;
      case 'amrap':
        blocks = [{ ...base, id: id(1), name, format: 'amrap', minutes: cfg.cap,
          ...(moves.length ? {} : { countRounds: true, hideList: true, items: [{ name: 'Rounds', measure: 'rounds' }] }) }];
        break;
      case 'fortime':
        blocks = [{ ...base, id: id(1), name, format: 'fortime', minutes: cfg.ftCap, rounds: cfg.ftRounds, label: 'For time',
          ...(moves.length ? {} : { hideList: true, items: [{ name: 'Time', measure: 'hold' }] }) }];
        break;
      case 'stopwatch':
        blocks = [{ ...base, id: id(1), name, format: 'fortime', minutes: 0, label: 'Stopwatch', hideList: true,
          items: [{ name: 'Time', measure: 'hold' }] }];
        break;
      case 'countdown':
        blocks = [{ ...base, id: id(1), name, format: 'tabata', label: 'Countdown', work: Math.max(5, totalSec()), rest: 0, intervals: 1,
          items: [{ name: 'Countdown', measure: 'rounds' }] }];
        break;
      case 'tabata':
      case 'intervals': {
        const sets = cfg.fmt === 'intervals' ? cfg.sets : 1;
        for (let i = 0; i < sets; i++) {
          blocks.push({ ...base, id: id(i + 1), format: 'tabata', label: cfg.fmt === 'tabata' ? 'Tabata' : 'Intervals',
            name: sets > 1 ? `Set ${i + 1} of ${sets}` : name,
            work: cfg.work, rest: cfg.rest, intervals: cfg.rounds,
            restAfter: cfg.setRest,
            items: moves.length ? moves : [{ name: 'Work', measure: 'rounds' }] });
        }
        break;
      }
    }
    return {
      name, sessionId: 'quick', quick: true, duration: Math.round(totalSec() / 60),
      getReady: cfg.ready, returnTo: 'index.html?quick', finishLabel: 'Done', blocks,
    };
  } finally { cfg = prev; }
}

/* ---------------- screen ---------------- */
const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const fmtDef = () => FORMATS.find(f => f.id === cfg.fmt) || FORMATS[0];

function fieldRow(k) {
  const [label, unit] = FIELDS[k];
  let hint = '';
  if (k === 'ftCap' && !cfg.ftCap) hint = 'no cap';
  if ((k === 'every' || k === 'work' || k === 'rest' || k === 'setRest') && cfg[k] >= 60) hint = fmt(cfg[k]);
  return `<div class="qt-field">
    <span class="qt-flbl">${label}${hint ? `<small>${hint}</small>` : ''}</span>
    <div class="qt-step">
      <button data-q="${k}" data-d="-1" aria-label="Less">−</button>
      <input data-qf="${k}" type="number" inputmode="numeric" value="${cfg[k]}" onfocus="this.select()"/>
      <button data-q="${k}" data-d="1" aria-label="More">+</button>
      <span class="qt-u">${unit}</span>
    </div></div>`;
}

function draw() {
  const def = fmtDef();
  const fields = FIELDS_OF[cfg.fmt];
  const movesHint = cfg.fmt === 'emom' || cfg.fmt === 'tabata' || cfg.fmt === 'intervals'
    ? 'Optional. With more than 1, they take turns each interval.'
    : cfg.fmt === 'amrap' ? 'Optional. Leave empty to just count rounds.'
    : 'Optional. Shown on screen while the clock runs.';
  host.innerHTML = `
  <div class="screen qt fade-in">
    <div class="qt-top">
      <button class="qt-back" id="qtBack" aria-label="Back">‹</button>
      <div><div class="eyebrow">Train now</div><h1>Quick timer</h1></div>
    </div>

    ${favs.length ? `<div class="qt-sec">Saved</div>
    <div class="qt-favs">${favs.map((f, i) => `<span class="qt-fav"><button data-fav="${i}">${esc(f.label)}</button><button class="qt-favx" data-favx="${i}" aria-label="Remove">✕</button></span>`).join('')}</div>` : ''}

    <div class="qt-sec">Type</div>
    <div class="qt-fmts">${FORMATS.map(f => `<button class="qt-fmt ${f.id === cfg.fmt ? 'on' : ''}" data-fmt="${f.id}">
      <b>${f.name}</b><small>${f.sub}</small></button>`).join('')}</div>

    ${fields.length ? `<div class="qt-sec">Settings</div><div class="qt-card">${fields.map(fieldRow).join('')}
      ${cfg.fmt === 'tabata' && (cfg.work !== TABATA.work || cfg.rest !== TABATA.rest || cfg.rounds !== TABATA.rounds) ? '<button class="qt-link" id="qtClassic">Back to classic 20/10 × 8</button>' : ''}
    </div>` : ''}

    ${def.moves ? `<div class="qt-sec">Moves</div><div class="qt-card">
      <p class="qt-hint">${movesHint}</p>
      ${cfg.moves.map((m, i) => `<div class="qt-move">
        <input class="qt-mname" data-mv="${i}" data-k="name" placeholder="Move ${i + 1}" value="${esc(m.name)}" autocomplete="off"/>
        <input class="qt-mreps" data-mv="${i}" data-k="reps" type="number" inputmode="numeric" placeholder="reps" value="${esc(m.reps)}"/>
        <button class="qt-mx" data-mvx="${i}" aria-label="Remove">✕</button></div>`).join('')}
      <button class="qt-link" id="qtAdd">+ Add a move</button>
    </div>` : ''}

    <div class="qt-sec">Countdown before start</div>
    <div class="qt-seg">${[0, 3, 5, 10].map(s => `<button class="${cfg.ready === s ? 'on' : ''}" data-ready="${s}">${s ? s + 's' : 'None'}</button>`).join('')}</div>

    <div class="qt-sum" id="qtSum">${summary()}</div>
    <button class="qt-link center" id="qtFav">☆ Save this timer</button>

    ${showDemo() ? `<div class="qt-sec">Work Mode preview</div>
    <p class="qt-hint">How a program day runs, 1 format at a time. Short numbers, nothing saved.</p>
    <div class="qt-demos">${DEMOS.map(d => `<button class="qt-demo" data-demo="${d.id}"><b>${d.name}</b><small>${d.sub}</small><span>▸</span></button>`).join('')}</div>` : ''}

    ${standalone() ? '' : `<p class="qt-hint qt-own">Want the timer as its own app? In Safari tap Share, then Add to Home Screen, while this page is open.</p>`}
    <div style="height:110px"></div>
    <div class="actionbar"><button class="btn lg" id="qtGo" ${cfg.fmt === 'countdown' && totalSec() < 5 ? 'disabled' : ''}>Start ${esc(def.name)} ▸</button></div>
  </div>`;
  wire();
}

function wire() {
  const $ = s => host.querySelector(s);
  $('#qtBack').addEventListener('click', () => { location.href = 'dashboard.html'; });
  host.querySelectorAll('[data-fmt]').forEach(b => b.addEventListener('click', () => {
    cfg.fmt = b.dataset.fmt;
    if (cfg.fmt === 'tabata') Object.assign(cfg, TABATA);
    persist(); draw();
  }));
  host.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.q; cfg[k] = clamp(cfg[k] + Number(b.dataset.d) * FIELDS[k][2], k);
    persist(); draw();
  }));
  host.querySelectorAll('[data-qf]').forEach(inp => {
    inp.addEventListener('change', () => { cfg[inp.dataset.qf] = clamp(inp.value, inp.dataset.qf); persist(); draw(); });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); });
  });
  /* typing a move name must not redraw (the keyboard would drop) */
  host.querySelectorAll('[data-mv]').forEach(inp => {
    inp.addEventListener('input', () => { cfg.moves[+inp.dataset.mv][inp.dataset.k] = inp.value; persist(); });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); });
  });
  host.querySelectorAll('[data-mvx]').forEach(b => b.addEventListener('click', () => {
    cfg.moves.splice(+b.dataset.mvx, 1);
    if (!cfg.moves.length) cfg.moves.push({ name: '', reps: '' });
    persist(); draw();
  }));
  $('#qtAdd')?.addEventListener('click', () => {
    cfg.moves.push({ name: '', reps: '' }); persist(); draw();
    const all = host.querySelectorAll('.qt-mname'); all[all.length - 1]?.focus();
  });
  $('#qtClassic')?.addEventListener('click', () => { Object.assign(cfg, TABATA); persist(); draw(); });
  host.querySelectorAll('[data-ready]').forEach(b => b.addEventListener('click', () => { cfg.ready = +b.dataset.ready; persist(); draw(); }));
  host.querySelectorAll('[data-fav]').forEach(b => b.addEventListener('click', () => {
    const f = favs[+b.dataset.fav]; if (!f) return;
    cfg = { ...DEFAULTS, ...JSON.parse(JSON.stringify(f.cfg)) }; persist(); draw();
  }));
  host.querySelectorAll('[data-favx]').forEach(b => b.addEventListener('click', () => {
    favs.splice(+b.dataset.favx, 1); persist(); draw();
  }));
  $('#qtFav').addEventListener('click', () => {
    const moves = namedMoves().map(m => m.name);
    const label = planName() + (moves.length ? ` · ${moves.slice(0, 2).join(', ')}${moves.length > 2 ? '…' : ''}` : '');
    if (!favs.some(f => f.label === label)) favs.unshift({ label, cfg: JSON.parse(JSON.stringify(cfg)) });
    favs = favs.slice(0, 12);
    persist(); draw();
  });
  $('#qtGo').addEventListener('click', () => { persist(); onStart?.(buildPlan()); });
  host.querySelectorAll('[data-demo]').forEach(b => b.addEventListener('click', () => {
    const d = DEMOS.find(x => x.id === b.dataset.demo); if (d) onStart?.(d.plan());
  }));
}

/* ---------------- look ---------------- */
function injectStyle() {
  if (document.getElementById('qt-style')) return;
  const st = document.createElement('style'); st.id = 'qt-style';
  st.textContent = `
  .qt { padding-bottom: 24px; }
  .qt-top { display:flex; align-items:center; gap:10px; margin: 6px 0 14px; }
  .qt-top h1 { margin: 2px 0 0; font-size: 28px; letter-spacing: -0.02em; }
  .qt-back { background:none; border:none; color: var(--muted); font-size: 30px; line-height:1; padding: 4px 10px 4px 0; cursor:pointer; }
  .qt-sec { color: var(--muted); font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin: 20px 2px 8px; }
  .qt-fmts { display:grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .qt-fmt { text-align:left; background: var(--box-2, #16161c); border: 1px solid var(--line); border-radius: 14px; padding: 12px; color: var(--text, #fff); cursor:pointer; }
  .qt-fmt b { display:block; font-size: 16px; }
  .qt-fmt small { display:block; color: var(--muted); font-size: 12px; margin-top: 3px; line-height: 1.3; }
  .qt-fmt.on { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
  .qt-fmt.on b { color: var(--accent); }
  .qt-card { background: var(--box-2, #16161c); border: 1px solid var(--line); border-radius: 14px; padding: 6px 12px; }
  .qt-field { display:flex; align-items:center; justify-content:space-between; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--line); }
  .qt-field:last-of-type { border-bottom: none; }
  .qt-flbl { font-size: 15px; font-weight: 600; }
  .qt-flbl small { display:block; color: var(--muted); font-weight: 500; font-size: 12px; }
  .qt-step { display:flex; align-items:center; background: var(--bg); border: 1px solid var(--line); border-radius: 10px; overflow:hidden; }
  .qt-step button { background:none; border:none; color: var(--text, #fff); font-size: 22px; width: 44px; height: 44px; cursor:pointer; touch-action: manipulation; }
  .qt-step button:active { background: var(--line); }
  .qt-step input { width: 52px; text-align:center; background:none; border:none; color: var(--text, #fff); font-size: 19px; font-weight: 700; font-family: var(--tnum, inherit); -moz-appearance: textfield; }
  .qt-step input::-webkit-outer-spin-button, .qt-step input::-webkit-inner-spin-button { -webkit-appearance: none; }
  .qt-u { color: var(--muted); font-size: 12px; padding-right: 10px; min-width: 34px; }
  .qt-hint { color: var(--muted); font-size: 13px; margin: 8px 0 6px; }
  .qt-move { display:flex; gap: 6px; margin: 6px 0; }
  .qt-move input { background: var(--bg); border: 1px solid var(--line); border-radius: 10px; color: var(--text, #fff); font-size: 16px; padding: 10px; min-width: 0; }
  .qt-mname { flex: 1 1 auto; }
  .qt-mreps { flex: 0 0 72px; text-align:center; }
  .qt-mx { background:none; border:none; color: var(--muted); font-size: 16px; width: 34px; cursor:pointer; }
  .qt-link { background:none; border:none; color: var(--accent); font-size: 14px; font-weight: 600; padding: 10px 0; cursor:pointer; }
  .qt-link.center { display:block; margin: 4px auto 0; }
  .qt-seg { display:flex; gap: 6px; }
  .qt-seg button { flex:1; background: var(--box-2, #16161c); border: 1px solid var(--line); border-radius: 10px; color: var(--text, #fff); padding: 11px 0; font-size: 15px; font-weight: 600; cursor:pointer; }
  .qt-seg button.on { border-color: var(--accent); color: var(--accent); }
  .qt-favs { display:flex; flex-wrap:wrap; gap: 6px; }
  .qt-fav { display:inline-flex; align-items:center; background: var(--box-2, #16161c); border: 1px solid var(--line); border-radius: 999px; }
  .qt-fav button { background:none; border:none; color: var(--text, #fff); font-size: 13.5px; padding: 8px 4px 8px 12px; cursor:pointer; }
  .qt-fav .qt-favx { color: var(--muted); padding: 8px 10px 8px 6px; font-size: 12px; }
  .qt-demos { display:flex; flex-direction:column; gap: 6px; }
  .qt-demo { display:grid; grid-template-columns: 1fr auto; text-align:left; background: var(--box-2, #16161c); border: 1px solid var(--line); border-radius: 12px; padding: 11px 12px; color: var(--text, #fff); cursor:pointer; }
  .qt-demo b { font-size: 15px; } .qt-demo small { grid-column: 1; color: var(--muted); font-size: 12.5px; margin-top: 2px; }
  .qt-demo span { grid-column: 2; grid-row: 1 / span 2; align-self:center; color: var(--muted); font-size: 18px; }
  .qt-own { text-align:center; margin-top: 18px; }
  .qt-sum { text-align:center; color: var(--muted); font-size: 15px; margin: 22px 0 0; }
  `;
  document.head.appendChild(st);
}
