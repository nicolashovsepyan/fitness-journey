/* ============================================================
   QUICK TIMER — the standalone timer, no program needed.
   Pick a type, set the numbers, optionally pick the moves, go.

   It does not run anything itself. It writes an ordinary RunPlan and
   hands it to Work Mode, the same runner a program day uses, so every
   timer fix lands here too: the wall-clock schedule, resume after the
   phone locks, beeps over music, save on exit.

   Opened as index.html?quick. Its look lives in this file (injected
   once) so the timer does not depend on anybody else's stylesheet.
   ============================================================ */
import { storage } from '../core/storage.js';
import { fmt } from '../timer.js';
import { EXERCISES } from '../data/exercises.js';
import { DEMOS } from './demo.js';
import { activeUserId } from '../users.js';
import { applyWorkTheme } from './theme.js';

/* ?demo adds the Work Mode preview: a sample of every program format */
const showDemo = () => new URLSearchParams(location.search).has('demo');
const standalone = () => window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;

/* every type the setup screen offers, with its "how it works" */
const FORMATS = [
  { id: 'emom', name: 'EMOM', sub: 'A new round every minute', moves: true,
    how: ['Every minute on the minute.', 'When the minute starts, do your reps. Whatever is left of the minute is your rest. Then the next minute starts.',
      'With 2 or more moves, choose in Customize: take turns (minute 1 burpees, minute 2 squats) or all of them every minute.',
      'Example: 10 minutes, 10 burpees = 10 rounds, 1 every minute.'] },
  { id: 'amrap', name: 'AMRAP', sub: 'As many rounds as you can', moves: true,
    how: ['As many rounds as possible.', 'Set the time, then go through your moves again and again until the clock runs out. Tap + each time you finish a round.',
      'Example: 10 minutes of 5 pull-ups, 10 push-ups, 15 squats.'] },
  { id: 'fortime', name: 'For time', sub: 'Race the clock, tap when done', moves: true,
    how: ['Race the clock.', 'Do all the work as fast as you can, then tap Done. Your time is your score.',
      'Add a time cap and the clock stops you there if you are not finished.'] },
  { id: 'tabata', name: 'Tabata', sub: '20s all out, 10s rest, 8 rounds', moves: true,
    how: ['20 seconds all out, 10 seconds rest, 8 rounds. 4 minutes.', 'Change the numbers in Customize if you want a different mix.'] },
  { id: 'timer', name: 'Timer', sub: 'Work, rest and rounds, your way', moves: true,
    how: ['A plain timer.', 'Set how long to work. Add rest and more rounds to repeat it.',
      'Examples: a 2:00 plank (1 round, no rest). Or 5:00 work, 2:00 rest, 3 rounds.',
      'Customize adds sets, with a longer rest between them.'] },
  { id: 'stopwatch', name: 'Stopwatch', sub: 'Counts up, tap to pause', moves: false,
    how: ['Counts up from 0.', 'Tap the ring to pause. Tap Done to stop.'] },
  { id: 'pushup', name: 'Push-up test', sub: '1 push-up every 3 seconds, as long as you can', moves: false,
    how: ['The push-up beep test.', '1 push-up every 3 seconds: a low beep, 1.5 seconds down. A high beep, 1.5 seconds up. That is 20 a minute.',
      'Keep the beat as long as you can. The test is over when you can no longer stay in rhythm or your form breaks: tap Stop. Your score is the reps you did on the beat.',
      'Want it harder? 25 a minute is the NHL version.'] },
];
/* field: [label, unit, step, min, max]. Time fields are seconds, shown m:ss. */
const FIELDS = {
  every:    ['Every',             'time', 15, 15, 600],
  mins:     ['Minutes',           'min',   1,  1,  90],
  cap:      ['Minutes',           'min',   1,  1,  90],
  ftCap:    ['Time cap',          'min',   1,  0,  90],
  ftRounds: ['Rounds',            '',      1,  1,  20],
  work:     ['Work',              'time',  5,  5, 3600],
  rest:     ['Rest',              'time',  5,  0, 1800],
  rounds:   ['Rounds',            '',      1,  1,  60],
  sets:     ['Sets',              '',      1,  1,  10],
  setRest:  ['Rest between sets', 'time', 15,  0, 1800],
  pace:     ['Pace',              'a min', 1, 10,  40],
  ptCap:    ['Time cap',          'min',   1,  0,  10],
};
const isTime = k => FIELDS[k][1] === 'time';
/* the numbers on the main screen, and the ones under "Customize" */
const MAIN = {
  emom: ['mins'], amrap: ['cap'], fortime: ['ftRounds', 'ftCap'], tabata: ['rounds'],
  timer: ['work', 'rest', 'rounds'], stopwatch: [], pushup: ['pace'],
};
const MORE = {
  emom: ['every'], amrap: [], fortime: [], tabata: ['work', 'rest'],
  timer: ['sets', 'setRest'], stopwatch: [], pushup: ['ptCap'],
};
const DEFAULTS = {
  fmt: 'emom', every: 60, mins: 12, cap: 10, ftCap: 0, ftRounds: 1,
  work: 20, rest: 10, rounds: 8, sets: 1, setRest: 60,
  tWork: 120, tRest: 0, tRounds: 1, pace: 20, paceV: 2, ptCap: 0,
  emomStyle: 'turns', ready: 10, moves: [{ name: '', reps: '' }],
};
const TABATA = { work: 20, rest: 10, rounds: 8 };
const PREF = 'quickTimer';

let cfg = null, favs = [], host = null, onStart = null, moreOpen = false;

/* Tabata and Timer both have work / rest / rounds, with very different
   numbers (20s vs 5 min). Timer keeps its own copy so switching between
   them never turns a 5-minute round into 20 seconds. */
const TIMER_KEYS = { work: 'tWork', rest: 'tRest', rounds: 'tRounds' };
const key = k => (cfg.fmt === 'timer' && TIMER_KEYS[k]) || k;
const val = k => cfg[key(k)];
const setVal = (k, v) => { cfg[key(k)] = v; };

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
  cfg = migrate({ ...DEFAULTS, ...(saved?.last || {}) });
  /* the push-up test first shipped at 25 a minute; the standard is 20 */
  if (saved?.last && saved.last.paceV !== 2) { cfg.pace = 20; cfg.paceV = 2; }
  favs = Array.isArray(saved?.favs) ? saved.favs : [];
  draw();
}
/* setups saved before Intervals and Countdown became Timer */
function migrate(c) {
  if (c.fmt === 'intervals') Object.assign(c, { fmt: 'timer', tWork: c.work, tRest: c.rest, tRounds: c.rounds });
  if (c.fmt === 'countdown') Object.assign(c, { fmt: 'timer', tWork: Math.max(5, (c.cdMin || 0) * 60 + (c.cdSec || 0)), tRest: 0, tRounds: 1, sets: 1 });
  if (!FORMATS.some(f => f.id === c.fmt)) c.fmt = 'emom';
  if (!Array.isArray(c.moves) || !c.moves.length) c.moves = [{ name: '', reps: '' }];
  return c;
}

function persist() {
  try { storage().setDevicePref(PREF, { last: cfg, favs }); } catch (e) {}
}

/* ---------------- plan ---------------- */
const clamp = (v, k) => { const [, , , lo, hi] = FIELDS[k]; return Math.min(hi, Math.max(lo, Math.round(Number(v) || 0))); };
/* a time field steps by what makes sense at its size: 5s under a minute,
   15s under 5 minutes, 30s above */
function stepTime(v, dir) {
  const probe = dir > 0 ? v : v - 1;
  const st = probe < 60 ? 5 : probe < 300 ? 15 : 30;
  return dir > 0 ? Math.floor(v / st) * st + st : Math.ceil(v / st) * st - st;
}
const bump = (k, dir) => { setVal(k, clamp(isTime(k) ? stepTime(val(k), dir) : val(k) + dir * FIELDS[k][2], k)); };

/* the moves, as plan items. A move picked from the library carries its id,
   so the demo video, the cue and the swap all work on it. */
const namedMoves = () => (FORMATS.find(f => f.id === cfg.fmt)?.moves ? (cfg.moves || []) : [])
  .filter(m => String(m.name || '').trim())
  .map(m => {
    const ex = m.exId && EXERCISES[m.exId];
    const n = Number(m.reps) > 0 ? Number(m.reps) : null;
    return ex
      ? { exId: m.exId, name: ex.name, measure: ex.measure || 'reps', load: ex.load, laterality: ex.laterality, cue: ex.cues, reps: n, ...(ex.measure === 'hold' && n ? { hold: n } : {}), noPR: true }
      : { name: String(m.name).trim(), measure: 'reps', reps: n, noPR: true };
  });

function emomCount() { return Math.max(1, Math.floor((cfg.mins * 60) / cfg.every)); }
function intervalSec(work, rest, rounds, sets = 1, setRest = 0) {
  const one = rounds * work + (rounds - 1) * rest;
  return sets * one + (sets - 1) * setRest;
}
/* total time, or null when there is no fixed end */
function totalSec() {
  switch (cfg.fmt) {
    case 'emom': return emomCount() * cfg.every;
    case 'amrap': return cfg.cap * 60;
    case 'fortime': return cfg.ftCap ? cfg.ftCap * 60 : null;
    case 'tabata': return intervalSec(cfg.work, cfg.rest, cfg.rounds);
    case 'timer': return intervalSec(cfg.tWork, cfg.tRest, cfg.tRounds, cfg.sets, cfg.setRest);
    case 'pushup': return cfg.ptCap ? cfg.ptCap * 60 : null;
    default: return null;
  }
}
/* the big "how long" above Start */
function totalText() {
  const t = totalSec();
  if (t) return (cfg.fmt === 'fortime' || cfg.fmt === 'pushup') ? `up to ${fmt(t)}` : fmt(t);
  return cfg.fmt === 'pushup' ? 'until you miss' : 'open';
}
const secs = v => v >= 60 ? fmt(v) : `${v}s`;
/* one line under it: what you're about to do, in plain words */
function summary() {
  const moves = namedMoves();
  switch (cfg.fmt) {
    case 'emom': {
      const style = moves.length > 1 ? (cfg.emomStyle === 'all' ? ` · all ${moves.length} moves each round` : ` · ${moves.length} moves take turns`) : '';
      return `${emomCount()} rounds, a new one every ${secs(cfg.every)}${style}`;
    }
    case 'amrap': return moves.length ? `${moves.length} move${moves.length > 1 ? 's' : ''} per round` : 'Tap + for every round you finish';
    case 'fortime': return `${cfg.ftRounds} round${cfg.ftRounds > 1 ? 's' : ''}, ${cfg.ftCap ? `${cfg.ftCap} min cap` : 'no cap'}`;
    case 'tabata': return `${cfg.rounds} rounds of ${secs(cfg.work)} on, ${secs(cfg.rest)} off`;
    case 'timer': {
      const r = cfg.tRounds;
      const core = `${r > 1 ? `${r} rounds of ` : ''}${secs(cfg.tWork)} work${cfg.tRest && r > 1 ? `, ${secs(cfg.tRest)} rest` : ''}`;
      return cfg.sets > 1 ? `${cfg.sets} sets of ${core}, ${secs(cfg.setRest)} between sets` : core;
    }
    case 'stopwatch': return 'Tap the ring to pause';
    case 'pushup': { const h = Math.round(3000 * 20 / cfg.pace / 2) / 1000; return `${cfg.pace} a minute: ${h}s down, ${h}s up${cfg.pace === 25 ? ' (NHL)' : ''}`; }
    default: return '';
  }
}
function planName() {
  const f = cfg.fmt;
  if (f === 'emom') return cfg.every === 60 ? `EMOM · ${cfg.mins} min` : `Every ${fmt(cfg.every)} · ${cfg.mins} min`;
  if (f === 'amrap') return `AMRAP · ${cfg.cap} min`;
  if (f === 'fortime') return `For time${cfg.ftCap ? ` · ${cfg.ftCap} min cap` : ''}`;
  if (f === 'tabata') return `Tabata · ${cfg.rounds} × ${cfg.work}/${cfg.rest}`;
  if (f === 'timer') return `Timer · ${cfg.tRounds > 1 ? `${cfg.tRounds} × ` : ''}${fmt(cfg.tWork)}${cfg.tRest && cfg.tRounds > 1 ? ` / ${fmt(cfg.tRest)}` : ''}${cfg.sets > 1 ? ` · ${cfg.sets} sets` : ''}`;
  if (f === 'pushup') return `Push-up test · ${cfg.pace} a min`;
  return 'Stopwatch';
}

/* the RunPlan Work Mode will play */
export function buildPlan(c = cfg) {
  const prev = cfg; cfg = migrate({ ...DEFAULTS, ...c });
  try {
    const moves = namedMoves();
    const id = n => `q${n}`;
    const base = { role: 'Work', items: moves };
    const name = planName();
    const work = [{ name: 'Work', measure: 'rounds' }];
    let blocks = [];
    switch (cfg.fmt) {
      case 'emom':
        blocks = [{ ...base, id: id(1), name, format: 'emom', label: cfg.every === 60 ? 'EMOM' : `Every ${fmt(cfg.every)}`,
          work: cfg.every, rest: 0, intervals: emomCount(), allEach: cfg.emomStyle === 'all',
          items: moves.length ? moves : work }];
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
      case 'pushup': {
        const pu = EXERCISES.pushup;
        blocks = [{ ...base, id: id(1), name, format: 'cadence', rpm: cfg.pace, minutes: cfg.ptCap,
          items: [{ exId: 'pushup', name: pu?.name || 'Push-ups', measure: 'reps', load: 'bw', cue: pu?.cues, noPR: true }] }];
        break;
      }
      case 'tabata':
        blocks = [{ ...base, id: id(1), name, format: 'tabata', label: 'Tabata',
          work: cfg.work, rest: cfg.rest, intervals: cfg.rounds, items: moves.length ? moves : work }];
        break;
      case 'timer':
        for (let i = 0; i < cfg.sets; i++) {
          blocks.push({ ...base, id: id(i + 1), format: 'tabata', label: 'Timer',
            name: cfg.sets > 1 ? `Set ${i + 1} of ${cfg.sets}` : name,
            work: cfg.tWork, rest: cfg.tRest, intervals: cfg.tRounds, restAfter: cfg.setRest,
            items: moves.length ? moves : work });
        }
        break;
    }
    return {
      name, sessionId: 'quick', quick: true, duration: Math.round((totalSec() || 0) / 60),
      getReady: cfg.ready, returnTo: 'index.html?quick', finishLabel: 'Done', blocks,
    };
  } finally { cfg = prev; }
}

/* ---------------- screen ----------------
   One decision per row, top to bottom: what type, the main numbers, how
   long it will take, Start. Everything else waits under "Customize". */
const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const fmtDef = () => FORMATS.find(f => f.id === cfg.fmt) || FORMATS[0];

/* a big number with − and +: the main settings. A time shows as m:ss and
   opens a minutes / seconds picker when tapped. */
function bigTile(k) {
  const [label, unit] = FIELDS[k];
  const v = val(k);
  const none = (k === 'ftCap' || k === 'ptCap') && !v;
  const noRest = k === 'rest' && !v;
  const face = isTime(k)
    ? `<button class="qt-tv time" data-qt="${k}">${noRest ? 'none' : fmt(v)}</button>`
    : `<input class="qt-tv ${none ? 'none' : ''}" data-qf="${k}" type="number" inputmode="numeric" value="${none ? '' : v}" placeholder="${none ? 'none' : ''}" onfocus="this.select()"/>`;
  return `<div class="qt-tile">
    <div class="qt-tl">${label}</div>
    ${face}
    <div class="qt-tu">${isTime(k) ? (noRest ? '&nbsp;' : 'min:sec') : (none ? '&nbsp;' : unit || '&nbsp;')}</div>
    <div class="qt-tb"><button data-q="${k}" data-d="-1" aria-label="Less">−</button><button data-q="${k}" data-d="1" aria-label="More">+</button></div>
    ${k === 'pace' ? `<div class="qt-presets"><button class="${v === 20 ? 'on' : ''}" data-pace="20">20 standard</button><button class="${v === 25 ? 'on' : ''}" data-pace="25">25 NHL</button></div>` : ''}
  </div>`;
}
/* a compact row: the details */
function smallRow(k) {
  const [label, unit] = FIELDS[k];
  const v = val(k);
  const face = isTime(k)
    ? `<button class="qt-sv" data-qt="${k}">${k.includes('est') && !v ? 'none' : fmt(v)}</button>`
    : `<input data-qf="${k}" type="number" inputmode="numeric" value="${v}" onfocus="this.select()"/>`;
  return `<div class="qt-row"><span>${label}</span>
    <div class="qt-step"><button data-q="${k}" data-d="-1" aria-label="Less">−</button>${face}
      <button data-q="${k}" data-d="1" aria-label="More">+</button>${isTime(k) ? '' : `<span class="qt-u">${unit}</span>`}</div></div>`;
}
function moveRow(m, i) {
  const ex = m.exId && EXERCISES[m.exId];
  const hold = ex && ex.measure === 'hold';
  return `<div class="qt-move">
    <button class="qt-mpick ${m.name ? '' : 'empty'}" data-pick-move="${i}">${m.name ? esc(m.name) : `Move ${i + 1}`}<span>⌕</span></button>
    <input class="qt-mreps" data-mv="${i}" data-k="reps" type="number" inputmode="numeric" placeholder="${hold ? 'sec' : 'reps'}" value="${esc(m.reps)}"/>
    <button class="qt-mx" data-mvx="${i}" aria-label="Remove">✕</button></div>`;
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

    <div class="qt-typerow">
      <button class="qt-type" id="qtType">
        <span class="qt-type-t"><small>Type</small><b>${def.name}</b><em>${def.sub}</em></span>
        <span class="qt-chev">▾</span>
      </button>
      <button class="qt-how" id="qtHow" aria-label="How ${def.name} works">?</button>
    </div>

    ${main.length ? `<div class="qt-tiles n${main.length}">${main.map(bigTile).join('')}</div>`
      : `<div class="qt-empty">Nothing to set. Hit start.</div>`}

    <button class="qt-more" id="qtMore">${moreOpen ? 'Close ▴' : 'Customize ▾'}${!moreOpen && named ? ` <span>${named} move${named > 1 ? 's' : ''}</span>` : ''}</button>
    ${moreOpen ? `<div class="qt-details">
      ${more.length ? `<div class="qt-card">${more.map(smallRow).join('')}</div>` : ''}
      ${def.moves ? `<div class="qt-sec">Moves <small>optional · search the library or type your own</small></div><div class="qt-card">
        ${cfg.moves.map(moveRow).join('')}
        <button class="qt-link" id="qtAdd">+ Add a move</button>
      </div>` : ''}
      ${cfg.fmt === 'emom' && named > 1 ? `<div class="qt-sec">How the moves run</div>
      <div class="qt-choice">
        <button class="${cfg.emomStyle !== 'all' ? 'on' : ''}" data-style="turns"><b>Take turns</b><small>1 move each minute: minute 1 is move 1, minute 2 is move 2</small></button>
        <button class="${cfg.emomStyle === 'all' ? 'on' : ''}" data-style="all"><b>All every minute</b><small>Do all ${named} moves inside each minute</small></button>
      </div>` : ''}
      <div class="qt-sec">Get-ready countdown</div>
      <p class="qt-note">Seconds to get into position before the clock starts.</p>
      <div class="qt-seg">${[0, 3, 5, 10].map(s => `<button class="${cfg.ready === s ? 'on' : ''}" data-ready="${s}">${s ? s + 's' : 'None'}</button>`).join('')}</div>
      ${cfg.fmt === 'tabata' && (cfg.work !== TABATA.work || cfg.rest !== TABATA.rest) ? '<button class="qt-link" id="qtClassic">Back to classic 20s / 10s</button>' : ''}
      ${standalone() ? '' : `<p class="qt-hint">Want the timer as its own app? In Safari tap Share, then Add to Home Screen, while this page is open.</p>`}
    </div>` : ''}

    ${showDemo() ? `<div class="qt-sec">Work Mode preview</div>
    <p class="qt-hint">How a program day runs, 1 format at a time. Short numbers, nothing saved.</p>
    <div class="qt-demos">${DEMOS.map(d => `<button class="qt-demo" data-demo="${d.id}"><b>${d.name}</b><small>${d.sub}</small><span>▸</span></button>`).join('')}</div>` : ''}

    <div style="height:190px"></div>
    <div class="actionbar qt-bar">
      <div class="qt-total"><small>Total</small><b>${totalText()}</b></div>
      <div class="qt-sum">${summary()}</div>
      <button class="btn lg" id="qtGo">Start</button>
    </div>
  </div>`;
  wire();
}

/* ---------------- sheets ---------------- */
function sheet(inner, cls = '') {
  const ov = document.createElement('div'); ov.className = 'qt-sheet';
  ov.innerHTML = `<div class="qt-sheet-card ${cls}">${inner}</div>`;
  host.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('open'));
  const close = () => { ov.classList.remove('open'); setTimeout(() => ov.remove(), 180); };
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  return { ov, close };
}
/* the type list */
function openTypes() {
  const { ov, close } = sheet(`<div class="qt-sheet-h">Type of timer</div>
    ${FORMATS.map(f => `<button class="qt-opt ${f.id === cfg.fmt ? 'on' : ''}" data-pick="${f.id}"><b>${f.name}</b><small>${f.sub}</small>${f.id === cfg.fmt ? '<i>✓</i>' : ''}</button>`).join('')}`);
  ov.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => {
    if (cfg.fmt !== b.dataset.pick) {
      cfg.fmt = b.dataset.pick;
      if (cfg.fmt === 'tabata') Object.assign(cfg, TABATA);
      persist(); draw();
    }
    close();
  }));
}
/* how the chosen type works */
function openHow() {
  const def = fmtDef();
  const { ov, close } = sheet(`<div class="qt-sheet-h">How ${def.name} works</div>
    <div class="qt-howbody"><p class="lead">${def.how[0]}</p>${def.how.slice(1).map(p => `<p>${p}</p>`).join('')}</div>
    <button class="btn" id="qtHowOk">Got it</button>`);
  ov.querySelector('#qtHowOk').addEventListener('click', close);
}
/* minutes and seconds, for any time field */
function openTime(k) {
  let v = val(k);
  const [label, , , lo, hi] = FIELDS[k];
  const { ov, close } = sheet(`<div class="qt-sheet-h">${label}</div>
    <div class="qt-tp">
      <div><button data-tp="m" data-d="1">+</button><b id="tpM"></b><small>min</small><button data-tp="m" data-d="-1">−</button></div>
      <span class="qt-tpc">:</span>
      <div><button data-tp="s" data-d="5">+</button><b id="tpS"></b><small>sec</small><button data-tp="s" data-d="-5">−</button></div>
    </div>
    <button class="btn" id="tpOk">Done</button>`);
  const show = () => { ov.querySelector('#tpM').textContent = Math.floor(v / 60); ov.querySelector('#tpS').textContent = String(v % 60).padStart(2, '0'); };
  ov.querySelectorAll('[data-tp]').forEach(b => b.addEventListener('click', () => {
    const d = Number(b.dataset.d);
    if (b.dataset.tp === 'm') v += d * 60;
    else { const s = (v % 60 + d + 60) % 60; v = Math.floor(v / 60) * 60 + s; }
    v = Math.min(hi, Math.max(lo, v)); show();
  }));
  ov.querySelector('#tpOk').addEventListener('click', () => { setVal(k, v); persist(); close(); draw(); });
  show();
}
/* search the exercise library, or keep what was typed */
const LIB = () => Object.entries(EXERCISES).map(([id, e]) => ({ id, name: e.name, gym: !!e.gymOnly, pattern: e.pattern || '' }))
  .filter(e => e.name).sort((a, b) => a.name.localeCompare(b.name));
const norm = s => String(s || '').toLowerCase().replace(/[-_]/g, ' ');
function openMovePicker(i) {
  const lib = LIB();
  const { ov, close } = sheet(`<div class="qt-sheet-h">Pick a move</div>
    <input class="qt-search" id="mvQ" placeholder="Search ${lib.length} moves, or type your own" autocomplete="off" value="${esc(cfg.moves[i]?.name || '')}"/>
    <div class="qt-results" id="mvR"></div>`, 'tall');
  const q = ov.querySelector('#mvQ'), out = ov.querySelector('#mvR');
  const pick = m => { cfg.moves[i] = { ...cfg.moves[i], ...m }; persist(); close(); draw(); };
  const list = () => {
    const t = norm(q.value.trim());
    let hits = t ? lib.filter(e => norm(e.name).includes(t) || norm(e.id).includes(t)) : lib;
    if (t) hits.sort((a, b) => (norm(b.name).startsWith(t) - norm(a.name).startsWith(t)) || a.name.localeCompare(b.name));
    hits = hits.slice(0, 60);
    const exact = t && lib.some(e => norm(e.name) === t);
    out.innerHTML = (t && !exact ? `<button class="qt-res own" data-own="1"><b>Use "${esc(q.value.trim())}"</b><small>your own move, not from the library</small></button>` : '')
      + hits.map(e => `<button class="qt-res" data-ex="${e.id}"><b>${esc(e.name)}</b><small>${esc(e.pattern)}${e.gym ? ' · gym' : ''}</small></button>`).join('')
      + (!hits.length && !t ? '' : '');
    out.querySelectorAll('[data-ex]').forEach(b => b.addEventListener('click', () => pick({ exId: b.dataset.ex, name: EXERCISES[b.dataset.ex].name })));
    out.querySelector('[data-own]')?.addEventListener('click', () => pick({ exId: null, name: q.value.trim() }));
  };
  q.addEventListener('input', list);
  q.addEventListener('keydown', e => { if (e.key === 'Enter') { const first = out.querySelector('.qt-res'); first?.click(); } });
  list();
  setTimeout(() => { q.focus(); q.select(); }, 60);
}

function wire() {
  const $ = s => host.querySelector(s);
  $('#qtBack').addEventListener('click', () => { location.href = 'dashboard.html'; });
  $('#qtType').addEventListener('click', openTypes);
  $('#qtHow').addEventListener('click', openHow);
  $('#qtMore').addEventListener('click', () => { moreOpen = !moreOpen; draw(); });
  host.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => { bump(b.dataset.q, Number(b.dataset.d)); persist(); draw(); }));
  host.querySelectorAll('[data-qt]').forEach(b => b.addEventListener('click', () => openTime(b.dataset.qt)));
  host.querySelectorAll('[data-qf]').forEach(inp => {
    inp.addEventListener('change', () => { setVal(inp.dataset.qf, clamp(inp.value, inp.dataset.qf)); persist(); draw(); });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); });
  });
  host.querySelectorAll('[data-pace]').forEach(b => b.addEventListener('click', () => { cfg.pace = +b.dataset.pace; persist(); draw(); }));
  host.querySelectorAll('[data-style]').forEach(b => b.addEventListener('click', () => { cfg.emomStyle = b.dataset.style; persist(); draw(); }));
  host.querySelectorAll('[data-pick-move]').forEach(b => b.addEventListener('click', () => openMovePicker(+b.dataset.pickMove)));
  /* typing reps must not redraw (the keyboard would drop); the total line
     does not depend on reps, so nothing on screen goes stale */
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
    openMovePicker(cfg.moves.length - 1);
  });
  $('#qtClassic')?.addEventListener('click', () => { Object.assign(cfg, TABATA); persist(); draw(); });
  host.querySelectorAll('[data-ready]').forEach(b => b.addEventListener('click', () => { cfg.ready = +b.dataset.ready; persist(); draw(); }));
  host.querySelectorAll('[data-fav]').forEach(b => b.addEventListener('click', () => {
    const f = favs[+b.dataset.fav]; if (!f) return;
    cfg = migrate({ ...DEFAULTS, ...JSON.parse(JSON.stringify(f.cfg)) }); persist(); draw();
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

  .qt-typerow { display:flex; gap: 8px; align-items: stretch; }
  .qt-typerow .qt-type { flex: 1; }
  .qt-how { flex: none; width: 52px; border-radius: 18px; background: var(--box); border: 1px solid var(--line); color: var(--wm-neon);
    font-size: 22px; font-weight: 700; cursor:pointer; }
  button.qt-tv { cursor:pointer; line-height: 1.15; }
  .qt-presets { display:flex; gap: 6px; margin-top: 8px; }
  .qt-presets button { flex:1; background: var(--bg); border: 1px solid var(--line); border-radius: 10px; color: var(--muted); padding: 8px 0; font-size: 13px; font-weight: 600; cursor:pointer; }
  .qt-presets button.on { color: var(--wm-accent); border-color: var(--wm-accent); }
  .qt-sv { min-width: 64px; background:none; border:none; color: var(--text); font-size: 17px; font-weight: 700; font-family: var(--tnum); cursor:pointer; }
  .qt-mpick { flex: 1 1 auto; min-width: 0; display:flex; align-items:center; justify-content:space-between; gap: 8px; text-align:left;
    background: var(--bg); border: 1px solid var(--line); border-radius: 10px; color: var(--text); font-size: 16px; padding: 10px; cursor:pointer;
    white-space:nowrap; overflow:hidden; text-overflow: ellipsis; }
  .qt-mpick.empty { color: var(--faint); }
  .qt-mpick span { color: var(--wm-accent); flex: none; }
  .qt-choice { display:flex; flex-direction:column; gap: 8px; }
  .qt-choice button { text-align:left; background: var(--box); border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px; color: var(--text); cursor:pointer; }
  .qt-choice b { display:block; font-size: 16px; } .qt-choice small { display:block; color: var(--muted); font-size: 13px; margin-top: 2px; }
  .qt-choice button.on { border-color: var(--wm-accent); background: var(--wm-accent-soft); } .qt-choice button.on b { color: var(--wm-accent); }
  .qt-note { color: var(--muted); font-size: 13px; margin: -2px 2px 8px; }
  .qt-total { display:flex; align-items: baseline; justify-content: center; gap: 10px; margin-bottom: 2px; }
  .qt-total small { color: var(--muted); font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
  .qt-total b { font-family: var(--tnum); font-size: 30px; letter-spacing: -0.03em; color: var(--text); }
  .qt-howbody { padding: 0 6px 6px; }
  .qt-howbody p { color: var(--muted); font-size: 15px; line-height: 1.45; margin: 0 0 10px; }
  .qt-howbody p.lead { color: var(--text); font-size: 18px; font-weight: 700; }
  .qt-sheet-card .btn { margin-top: 8px; }
  .qt-tp { display:flex; align-items:center; justify-content:center; gap: 14px; padding: 6px 0 12px; }
  .qt-tp > div { display:flex; flex-direction:column; align-items:center; }
  .qt-tp b { font-family: var(--tnum); font-size: 60px; line-height: 1.1; letter-spacing: -0.04em; min-width: 90px; text-align:center; }
  .qt-tp small { color: var(--muted); font-size: 12px; margin-bottom: 6px; }
  .qt-tp button { width: 76px; height: 44px; border-radius: 12px; border: 1px solid var(--line); background: var(--box-2); color: var(--text); font-size: 24px; cursor:pointer; }
  .qt-tpc { font-family: var(--tnum); font-size: 48px; color: var(--muted); }
  .qt-sheet-card.tall { height: 82vh; display:flex; flex-direction:column; }
  .qt-search { width:100%; background: var(--bg); border: 1px solid var(--wm-neon-line); border-radius: 12px; color: var(--text); font-size: 17px; padding: 13px 14px; }
  .qt-search:focus { outline: none; border-color: var(--wm-accent); }
  .qt-results { flex: 1; overflow-y: auto; margin-top: 8px; -webkit-overflow-scrolling: touch; }
  .qt-res { width:100%; display:flex; flex-direction:column; text-align:left; background:none; border:none; border-bottom: 1px solid var(--line); color: var(--text); padding: 12px 4px; cursor:pointer; }
  .qt-res b { font-size: 16px; font-weight: 600; } .qt-res small { color: var(--muted); font-size: 12.5px; margin-top: 2px; }
  .qt-res.own b { color: var(--wm-accent); }
  .qt-sum { text-align:center; color: var(--muted); font-size: 14px; margin: 0 0 10px; line-height: 1.35; }

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
