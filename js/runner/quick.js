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
import { applyWorkTheme } from './theme.js';

/* ?demo adds the Work Mode preview: a sample of every program format */
const showDemo = () => new URLSearchParams(location.search).has('demo');
const standalone = () => window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;

/* every format the setup screen offers */
const FORMATS = [
  { id: 'emom',      name: 'EMOM',      sub: 'A new round every minute',        moves: true },
  { id: 'amrap',     name: 'AMRAP',     sub: 'As many rounds as you can',       moves: true },
  { id: 'fortime',   name: 'For time',  sub: 'Race the clock, tap when done',   moves: true },
  { id: 'tabata',    name: 'Tabata',    sub: '20s on, 10s off',                 moves: true },
  { id: 'intervals', name: 'Intervals', sub: 'Your own work and rest',          moves: true },
  { id: 'stopwatch', name: 'Stopwatch', sub: 'Counts up, tap to pause',         moves: false },
  { id: 'countdown', name: 'Countdown', sub: 'One timer, one beep',             moves: false },
];
/* field: [label, unit, step, min, max] */
const FIELDS = {
  every:    ['Every',             'sec', 15, 15, 600],
  mins:     ['Minutes',           'min',  1,  1,  90],
  cap:      ['Minutes',           'min',  1,  1,  90],
  ftCap:    ['Time cap',          'min',  1,  0,  90],
  ftRounds: ['Rounds',            '',     1,  1,  20],
  work:     ['Work',              'sec',  5,  5, 600],
  rest:     ['Rest',              'sec',  5,  0, 600],
  rounds:   ['Rounds',            '',     1,  1,  60],
  sets:     ['Sets',              '',     1,  1,  10],
  setRest:  ['Rest between sets', 'sec', 15,  0, 600],
  cdMin:    ['Minutes',           'min',  1,  0, 180],
  cdSec:    ['Seconds',           'sec',  5,  0,  55],
};
/* the numbers on the main screen, and the ones under "More options" */
const MAIN = {
  emom: ['mins'], amrap: ['cap'], fortime: ['ftRounds', 'ftCap'], tabata: ['rounds'],
  intervals: ['rounds', 'work', 'rest'], stopwatch: [], countdown: ['cdMin', 'cdSec'],
};
const MORE = {
  emom: ['every'], amrap: [], fortime: [], tabata: ['work', 'rest'],
  intervals: ['sets', 'setRest'], stopwatch: [], countdown: [],
};
const DEFAULTS = {
  fmt: 'emom', every: 60, mins: 12, cap: 10, ftCap: 0, ftRounds: 1,
  work: 20, rest: 10, rounds: 8, sets: 1, setRest: 60, cdMin: 5, cdSec: 0,
  ready: 10, moves: [{ name: '', reps: '' }],
};
const TABATA = { work: 20, rest: 10, rounds: 8 };
const PREF = 'quickTimer';

let cfg = null, favs = [], host = null, onStart = null, moreOpen = false;

export async function renderQuick(el, opts = {}) {
  host = el; onStart = opts.onStart;
  injectStyle(); applyWorkTheme();
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
/* one line under the numbers: what you're about to do, in plain words */
function summary() {
  const t = totalSec();
  const secs = v => v >= 60 ? fmt(v) : `${v}s`;
  switch (cfg.fmt) {
    case 'emom': return `${emomCount()} rounds · a new one every ${secs(cfg.every)} · ${fmt(t)}`;
    case 'amrap': return `${fmt(t)} on the clock`;
    case 'fortime': return `${cfg.ftRounds} round${cfg.ftRounds > 1 ? 's' : ''} · ${cfg.ftCap ? `${cfg.ftCap} min cap` : 'no cap'}`;
    case 'tabata': case 'intervals': {
      const sets = cfg.fmt === 'intervals' && cfg.sets > 1 ? `${cfg.sets} sets of ` : '';
      return `${sets}${cfg.rounds} × ${secs(cfg.work)} on, ${secs(cfg.rest)} off · ${fmt(t)}`;
    }
    case 'stopwatch': return 'Counts up. Tap the ring to pause';
    case 'countdown': return t ? fmt(t) : 'Set a time';
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

/* ---------------- screen ----------------
   One decision per row, top to bottom: what type, how long / how many,
   start. Everything else (interval length, sets, moves, the countdown
   before start) waits under "More options". */
const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const fmtDef = () => FORMATS.find(f => f.id === cfg.fmt) || FORMATS[0];

/* a big number with − and +: the main settings */
function bigTile(k) {
  const [label, unit] = FIELDS[k];
  const none = k === 'ftCap' && !cfg.ftCap;
  return `<div class="qt-tile">
    <div class="qt-tl">${label}</div>
    <input class="qt-tv ${none ? 'none' : ''}" data-qf="${k}" type="number" inputmode="numeric" value="${none ? '' : cfg[k]}" placeholder="${none ? 'none' : ''}" onfocus="this.select()"/>
    <div class="qt-tu">${none ? '&nbsp;' : unit || '&nbsp;'}</div>
    <div class="qt-tb"><button data-q="${k}" data-d="-1" aria-label="Less">−</button><button data-q="${k}" data-d="1" aria-label="More">+</button></div>
  </div>`;
}
/* a compact row: the details */
function smallRow(k) {
  const [label, unit] = FIELDS[k];
  return `<div class="qt-row"><span>${label}</span>
    <div class="qt-step"><button data-q="${k}" data-d="-1" aria-label="Less">−</button>
      <input data-qf="${k}" type="number" inputmode="numeric" value="${cfg[k]}" onfocus="this.select()"/>
      <button data-q="${k}" data-d="1" aria-label="More">+</button><span class="qt-u">${unit}</span></div></div>`;
}

function draw() {
  const def = fmtDef();
  const main = MAIN[cfg.fmt], more = MORE[cfg.fmt];
  const named = namedMoves().length;
  host.innerHTML = `
  <div class="screen qt fade-in">
    <div class="qt-top">
      <button class="qt-back" id="qtBack" aria-label="Back">‹</button>
      <h1>Timer</h1>
      <button class="qt-star" id="qtFav" aria-label="Save this timer" title="Save this timer">☆</button>
    </div>

    ${favs.length ? `<div class="qt-favs">${favs.map((f, i) => `<span class="qt-fav"><button data-fav="${i}">${esc(f.label)}</button><button class="qt-favx" data-favx="${i}" aria-label="Remove">✕</button></span>`).join('')}</div>` : ''}

    <button class="qt-type" id="qtType">
      <span class="qt-type-t"><small>Type</small><b>${def.name}</b><em>${def.sub}</em></span>
      <span class="qt-chev">▾</span>
    </button>

    ${main.length ? `<div class="qt-tiles n${main.length}">${main.map(bigTile).join('')}</div>`
      : `<div class="qt-empty">Nothing to set. Hit start.</div>`}

    <button class="qt-more" id="qtMore">${moreOpen ? 'Fewer options ▴' : `More options ▾`}${!moreOpen && named ? ` <span>${named} move${named > 1 ? 's' : ''}</span>` : ''}</button>
    ${moreOpen ? `<div class="qt-details">
      ${more.length ? `<div class="qt-card">${more.map(smallRow).join('')}</div>` : ''}
      ${def.moves ? `<div class="qt-sec">Moves <small>optional</small></div><div class="qt-card">
        ${cfg.moves.map((m, i) => `<div class="qt-move">
          <input class="qt-mname" data-mv="${i}" data-k="name" placeholder="Move ${i + 1}" value="${esc(m.name)}" autocomplete="off"/>
          <input class="qt-mreps" data-mv="${i}" data-k="reps" type="number" inputmode="numeric" placeholder="reps" value="${esc(m.reps)}"/>
          <button class="qt-mx" data-mvx="${i}" aria-label="Remove">✕</button></div>`).join('')}
        <button class="qt-link" id="qtAdd">+ Add a move</button>
      </div>` : ''}
      <div class="qt-sec">Countdown before start</div>
      <div class="qt-seg">${[0, 3, 5, 10].map(s => `<button class="${cfg.ready === s ? 'on' : ''}" data-ready="${s}">${s ? s + 's' : 'None'}</button>`).join('')}</div>
      ${cfg.fmt === 'tabata' && (cfg.work !== TABATA.work || cfg.rest !== TABATA.rest) ? '<button class="qt-link" id="qtClassic">Back to classic 20s / 10s</button>' : ''}
      ${standalone() ? '' : `<p class="qt-hint">Want the timer as its own app? In Safari tap Share, then Add to Home Screen, while this page is open.</p>`}
    </div>` : ''}

    ${showDemo() ? `<div class="qt-sec">Work Mode preview</div>
    <p class="qt-hint">How a program day runs, 1 format at a time. Short numbers, nothing saved.</p>
    <div class="qt-demos">${DEMOS.map(d => `<button class="qt-demo" data-demo="${d.id}"><b>${d.name}</b><small>${d.sub}</small><span>▸</span></button>`).join('')}</div>` : ''}

    <div style="height:150px"></div>
    <div class="actionbar qt-bar">
      <div class="qt-sum" id="qtSum">${summary()}</div>
      <button class="btn lg" id="qtGo" ${cfg.fmt === 'countdown' && totalSec() < 5 ? 'disabled' : ''}>Start</button>
    </div>
  </div>`;
  wire();
}

/* the type list, as a sheet from the bottom */
function openTypes() {
  const ov = document.createElement('div'); ov.className = 'qt-sheet';
  ov.innerHTML = `<div class="qt-sheet-card">
    <div class="qt-sheet-h">Type of timer</div>
    ${FORMATS.map(f => `<button class="qt-opt ${f.id === cfg.fmt ? 'on' : ''}" data-pick="${f.id}"><b>${f.name}</b><small>${f.sub}</small>${f.id === cfg.fmt ? '<i>✓</i>' : ''}</button>`).join('')}
  </div>`;
  host.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('open'));
  const close = () => { ov.classList.remove('open'); setTimeout(() => ov.remove(), 180); };
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  ov.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => {
    if (cfg.fmt !== b.dataset.pick) {
      cfg.fmt = b.dataset.pick;
      if (cfg.fmt === 'tabata') Object.assign(cfg, TABATA);
      persist(); draw();
    }
    close();
  }));
}

function wire() {
  const $ = s => host.querySelector(s);
  $('#qtBack').addEventListener('click', () => { location.href = 'dashboard.html'; });
  $('#qtType').addEventListener('click', openTypes);
  $('#qtMore').addEventListener('click', () => { moreOpen = !moreOpen; draw(); });
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

/* ---------------- look ----------------
   The dashboard's ground and colours (theme.js sets --wm-accent and
   --wm-neon from the user's own choice). Neon is edges and glow only;
   the accent is what you tap. */
function injectStyle() {
  if (document.getElementById('qt-style')) return;
  const st = document.createElement('style'); st.id = 'qt-style';
  st.textContent = `
  .qt { padding-bottom: 24px; }
  .qt-top { display:flex; align-items:center; gap: 6px; margin: 4px 0 16px; }
  .qt-top h1 { flex:1; margin: 0; font-size: 30px; letter-spacing: -0.03em; }
  .qt-top h1:after { content:""; display:block; width: 34px; height: 3px; border-radius: 3px; margin-top: 6px;
    background: var(--wm-neon); box-shadow: var(--wm-glow-neon); }
  .qt-back, .qt-star { background:none; border:none; color: var(--muted); font-size: 28px; line-height:1; padding: 6px 8px; cursor:pointer; }
  .qt-back { padding-left: 0; }
  .qt-star { font-size: 24px; }

  .qt-favs { display:flex; gap: 6px; overflow-x:auto; margin: 0 -2px 14px; padding: 2px; scrollbar-width: none; }
  .qt-favs::-webkit-scrollbar { display:none; }
  .qt-fav { flex: none; display:inline-flex; align-items:center; background: var(--box); border: 1px solid var(--line); border-radius: 999px; }
  .qt-fav button { background:none; border:none; color: var(--text); font-size: 13.5px; padding: 8px 4px 8px 13px; cursor:pointer; white-space:nowrap; }
  .qt-fav .qt-favx { color: var(--faint); padding: 8px 11px 8px 6px; font-size: 11px; }

  .qt-type { width:100%; display:flex; align-items:center; gap: 12px; text-align:left; cursor:pointer;
    background: var(--box); border: 1px solid var(--wm-neon-line); border-radius: 18px; padding: 16px 18px; color: var(--text);
    box-shadow: 0 0 0 1px rgba(0,0,0,.2), var(--wm-glow-neon); }
  .qt-type-t { flex:1; display:flex; flex-direction:column; }
  .qt-type small { color: var(--muted); font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
  .qt-type b { font-size: 26px; letter-spacing: -0.02em; margin: 2px 0 1px; }
  .qt-type em { font-style: normal; color: var(--muted); font-size: 14px; }
  .qt-chev { color: var(--wm-neon); font-size: 18px; }

  .qt-tiles { display:grid; gap: 10px; margin-top: 12px; grid-template-columns: 1fr 1fr; }
  .qt-tiles.n1 { grid-template-columns: 1fr; }
  .qt-tiles.n3 { grid-template-columns: 1fr 1fr 1fr; }
  .qt-tile { background: var(--box); border: 1px solid var(--line); border-radius: 18px; padding: 14px 10px 10px; text-align:center; }
  .qt-tl { color: var(--muted); font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
  .qt-tv { width:100%; background:none; border:none; text-align:center; color: var(--text); font-family: var(--tnum);
    font-size: 54px; font-weight: 700; letter-spacing: -0.04em; padding: 2px 0 0; -moz-appearance: textfield; }
  .qt-tiles.n3 .qt-tv { font-size: 38px; }
  .qt-tiles.n1 .qt-tv { font-size: 72px; }
  .qt-tv.none::placeholder { color: var(--faint); font-size: .55em; }
  .qt-tv::-webkit-outer-spin-button, .qt-tv::-webkit-inner-spin-button { -webkit-appearance:none; }
  .qt-tu { color: var(--muted); font-size: 12px; margin-top: -2px; }
  .qt-tb { display:flex; gap: 8px; margin-top: 10px; }
  .qt-tb button { flex:1; height: 46px; border-radius: 12px; border: 1px solid var(--line); background: var(--box-2); color: var(--text);
    font-size: 24px; cursor:pointer; touch-action: manipulation; }
  .qt-tb button:active { border-color: var(--wm-accent); color: var(--wm-accent); }
  .qt-empty { margin-top: 12px; text-align:center; color: var(--muted); padding: 26px 0; border: 1px dashed var(--line); border-radius: 18px; }

  .qt-more { display:block; margin: 14px auto 0; background:none; border:none; color: var(--muted); font-size: 14px; font-weight: 600; padding: 10px 14px; cursor:pointer; }
  .qt-more span { color: var(--wm-accent); font-weight: 600; margin-left: 4px; }
  .qt-details { animation: qtIn .18s ease-out; }
  @keyframes qtIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
  .qt-sec { color: var(--muted); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .12em; margin: 18px 2px 8px; }
  .qt-sec small { text-transform:none; letter-spacing:0; font-weight: 500; color: var(--faint); margin-left: 4px; }
  .qt-card { background: var(--box); border: 1px solid var(--line); border-radius: 16px; padding: 4px 12px; }
  .qt-row { display:flex; align-items:center; justify-content:space-between; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--line); font-size: 15px; font-weight: 600; }
  .qt-row:last-child { border-bottom: none; }
  .qt-step { display:flex; align-items:center; background: var(--bg); border: 1px solid var(--line); border-radius: 10px; overflow:hidden; }
  .qt-step button { background:none; border:none; color: var(--text); font-size: 20px; width: 40px; height: 40px; cursor:pointer; touch-action: manipulation; }
  .qt-step input { width: 48px; text-align:center; background:none; border:none; color: var(--text); font-size: 17px; font-weight: 700; font-family: var(--tnum); -moz-appearance: textfield; }
  .qt-step input::-webkit-outer-spin-button, .qt-step input::-webkit-inner-spin-button { -webkit-appearance:none; }
  .qt-u { color: var(--muted); font-size: 12px; padding-right: 10px; min-width: 34px; }
  .qt-move { display:flex; gap: 6px; margin: 8px 0; }
  .qt-move input { background: var(--bg); border: 1px solid var(--line); border-radius: 10px; color: var(--text); font-size: 16px; padding: 10px; min-width: 0; }
  .qt-move input:focus { outline: none; border-color: var(--wm-accent); }
  .qt-mname { flex: 1 1 auto; } .qt-mreps { flex: 0 0 70px; text-align:center; }
  .qt-mx { background:none; border:none; color: var(--faint); font-size: 14px; width: 30px; cursor:pointer; }
  .qt-link { background:none; border:none; color: var(--wm-accent); font-size: 14px; font-weight: 600; padding: 8px 0 10px; cursor:pointer; }
  .qt-seg { display:flex; gap: 6px; }
  .qt-seg button { flex:1; background: var(--box); border: 1px solid var(--line); border-radius: 12px; color: var(--text); padding: 12px 0; font-size: 15px; font-weight: 600; cursor:pointer; }
  .qt-seg button.on { border-color: var(--wm-accent); color: var(--wm-accent); background: var(--wm-accent-soft); }
  .qt-hint { color: var(--muted); font-size: 13px; margin: 14px 2px 6px; line-height: 1.4; }

  .qt-demos { display:flex; flex-direction:column; gap: 6px; }
  .qt-demo { display:grid; grid-template-columns: 1fr auto; text-align:left; background: var(--box); border: 1px solid var(--line); border-radius: 12px; padding: 11px 12px; color: var(--text); cursor:pointer; }
  .qt-demo b { font-size: 15px; } .qt-demo small { grid-column: 1; color: var(--muted); font-size: 12.5px; margin-top: 2px; }
  .qt-demo span { grid-column: 2; grid-row: 1 / span 2; align-self:center; color: var(--muted); font-size: 18px; }

  .qt-bar { background: linear-gradient(180deg, transparent, var(--bg) 28%); padding-top: 26px; }
  .qt-sum { text-align:center; color: var(--muted); font-size: 14px; margin: 0 0 10px; font-family: var(--tnum); letter-spacing: -0.01em; }

  .qt-sheet { position: fixed; inset: 0; z-index: 60; background: rgba(8,10,12,0); display:flex; align-items:flex-end; transition: background .18s; }
  .qt-sheet.open { background: rgba(8,10,12,.62); }
  .qt-sheet-card { width:100%; max-width: 560px; margin: 0 auto; background: var(--bg-2); border-top: 1px solid var(--wm-neon-line);
    border-radius: 22px 22px 0 0; padding: 10px 14px calc(18px + env(safe-area-inset-bottom)); box-shadow: var(--wm-glow-neon);
    transform: translateY(100%); transition: transform .2s cubic-bezier(.22,1,.36,1); }
  .qt-sheet.open .qt-sheet-card { transform: none; }
  .qt-sheet-h { text-align:center; color: var(--muted); font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; padding: 8px 0 10px; }
  .qt-opt { position:relative; width:100%; display:flex; flex-direction:column; text-align:left; background:none; border:none; border-top: 1px solid var(--line);
    color: var(--text); padding: 13px 34px 13px 6px; cursor:pointer; }
  .qt-opt b { font-size: 18px; } .qt-opt small { color: var(--muted); font-size: 13px; margin-top: 2px; }
  .qt-opt.on b { color: var(--wm-accent); }
  .qt-opt i { position:absolute; right: 8px; top: 50%; transform: translateY(-50%); color: var(--wm-accent); font-style: normal; font-size: 18px; }
  `;
  document.head.appendChild(st);
}
