/* ============================================================
   WORK MODE — the live workout player.
   Consumes a resolved RunPlan, plays each block by its format, and
   keeps a persistent session clock. All timing is read from
   runstate (timestamp-based) so it survives backgrounding/reload.
   Formats: straight · tempo · isometric · yates · skill · circuit
            · amrap · tabata · emom · rest_pause · benchmark/max_test
   ============================================================ */
import * as R from './runstate.js';
import { store } from '../store.js';
import { EXERCISES } from '../data/exercises.js';
import { alternatives } from '../core/resolve.js';
import { openLibraryPicker, pickerInitialFor } from '../screens/library.js';
import { say, beep, buzz, fmt, initAudio, keepAwake, releaseAwake, stopKeepAlive } from '../timer.js';

const UNIT = { reps: 'reps', hold: 'sec', cals: 'cals' };
const WUNIT = 'lb';                       // weight unit (Nicolas trains in pounds)
let S = null, host = null, cb = {}, ticker = null, onStepDone = null, curVal = 0, roundBuf = {};
let lastSec = null;                       // last whole-second of the active step (for once-per-second beeps)
let curStepKind = 'rest', saidHalf = false, halfStepKey = null;   // halfway-cue tracking
let countUpStart = null;                  // flexible rest before a reps set: count UP, no forced countdown
const numAt = id => { const e = document.getElementById(id); return e && e.value !== '' ? Number(e.value) : null; };
/* start a timed step, tagged 'work' or 'rest' (work efforts get a halfway cue) */
function beginStep(sec, kind = 'rest') { curStepKind = kind; saidHalf = false; halfStepKey = null; R.beginStep(S, sec); }

/* re-wake audio whenever the app returns to foreground — music/Bluetooth can suspend it */
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S && !S.done) initAudio(); });
  // tap the timer circle to pause/resume that countdown (not the session clock)
  document.addEventListener('click', e => {
    if (!S || S.done) return;
    if (e.target.closest('.timer-reset')) return;          // reset handled separately
    if (!e.target.closest('.timer-wrap')) return;
    if (S.stepDur == null || S.stepStartedAt == null) return;
    if (R.isStepPaused(S)) R.resumeStep(S); else { R.pauseStep(S); buzz(20); }
    reflectPause();
  });
  // restart the current countdown from full (if it started before you were ready)
  document.addEventListener('click', e => {
    if (!e.target.closest('.timer-reset')) return;
    e.stopPropagation();
    if (!S || S.stepDur == null) return;
    S.stepPausedAt = null; R.beginStep(S, S.stepDur); buzz(30); reflectPause();
  });
  // tap the demo button to watch the movement
  document.addEventListener('click', e => {
    const db = e.target.closest('.demo-btn[data-ex]'); if (!db) return;
    openDemo({ exId: db.dataset.ex, name: EXERCISES[db.dataset.ex]?.name || '' });
  });
  // tap the swap button to change the current exercise mid-workout (also saves it for next week)
  document.addEventListener('click', e => {
    if (!e.target.closest('.swap-btn[data-swapex]')) return;
    openWorkoutSwap();
  });
}
/* small "watch the move" button for the active exercise (real clip if wired, else "coming soon") */
function demoBtnHtml(item) {
  if (!item || !item.exId) return '';
  const has = !!(item.demoUrl || EXERCISES[item.exId]?.demoUrl);
  return `<button class="demo-btn ${has ? 'has' : ''}" data-ex="${item.exId}">▶ ${has ? 'watch the move' : 'demo'}</button>`;
}
/* swap the current exercise (button on the exercise screen) */
function swapBtnHtml(item) {
  if (!item || !item.exId) return '';
  return `<button class="swap-btn" data-swapex="${item.exId}">⇄ swap</button>`;
}
const curIdx = () => (block().format === 'circuit' ? S.ci : S.ii);
function openWorkoutSwap() {
  const b = block(); const item = b.items[curIdx()]; if (!item) return;
  const from = item.swappedFrom || item.exId;
  // full library picker — search, browse by section/track, difficulty, play, expand
  openLibraryPicker({ title: 'Swap · ' + item.name, initial: pickerInitialFor(from),
    onPick: id => swapCurrentExercise(id, from) });
}
function swapCurrentExercise(newId, from) {
  const b = block(); const i = curIdx(); const item = b.items[i]; if (!item || !EXERCISES[newId]) return;
  const m = EXERCISES[newId];
  Object.assign(item, { exId: newId, name: m.name, measure: m.measure, load: m.load, laterality: m.laterality, swappedFrom: newId === from ? null : from });
  const cap = S.captured[b.id]?.[i];
  if (cap) { cap.exId = newId; cap.name = m.name; cap.measure = m.measure; cap.unit = UNIT[m.measure]; cap.load = m.load; }
  try { if (S.plan.sessionId) store.setSwap(S.plan.sessionId, from, newId === from ? null : newId); } catch (e) {}
  R.save(S); buzz(30); say(m.name);
  renderActive();
}

/* ---------------- in-workout block editor ----------------
   One clean tap on the ⋯ in the header. Simple edits (reps/hold/sets/rounds/
   failure/drop/notes) apply LIVE and re-render. Structural edits (work-type,
   add/remove exercise) rebuild + restart the block cleanly. */
const CIRCUITY = ['circuit', 'tabata', 'emom', 'amrap'];
function restartBlock() { S.captured[block().id] = null; enterBlock(S.bi, { skipReady: true }); }
function changeFormat(b, fmt) {
  b.format = fmt;
  const circuitLike = CIRCUITY.includes(fmt);
  if (fmt === 'tabata') { b.rounds = b.rounds || 8; b.work = b.work || 20; b.rest = b.rest ?? 10; }
  else if (fmt === 'emom') { b.rounds = b.rounds || 10; b.work = 60; b.rest = 0; }
  else if (fmt === 'amrap') { b.minutes = b.minutes || 5; }
  else if (fmt === 'circuit') { b.rounds = b.rounds || 3; }
  b.items.forEach(it => {
    if (!circuitLike && it.sets == null) it.sets = 3;
    if (fmt === 'yates') { it.toFailure = true; it.warmups = it.warmups || 2; }
  });
}
function openAddExercise() {
  const b = block(); const ref = b.items[curIdx()] || b.items[0];
  openLibraryPicker({ title: 'Add to ' + b.name, initial: pickerInitialFor(ref?.exId), onPick: id => {
    const m = EXERCISES[id]; if (!m) return;
    const it = { exId: id, name: m.name, measure: m.measure, load: m.load, laterality: m.laterality };
    if (m.measure === 'hold') it.hold = 30; else it.reps = ref?.reps ?? 10;
    if (!CIRCUITY.includes(b.format)) it.sets = ref?.sets ?? 3;
    b.items.push(it); restartBlock();
  } });
}
function openWorkoutEdit() {
  const b = block(); if (!b.items || !b.items.length) return;
  const i = curIdx(); const item = b.items[i] || b.items[0];
  const isHold = item.measure === 'hold';
  const targetVal = isHold ? (item.hold ?? 20) : (item.reps ?? item.target ?? 0);
  const circuitLike = CIRCUITY.includes(b.format);
  const countLabel = circuitLike ? 'Rounds' : 'Sets';
  const countVal = circuitLike ? (b.rounds ?? 8) : (item.sets ?? 1);
  const WT = [['straight', 'Straight'], ['tempo', 'Tempo'], ['yates', 'Yates / failure'], ['circuit', 'Circuit'], ['tabata', 'Tabata'], ['emom', 'EMOM'], ['amrap', 'AMRAP']];
  const ov = document.createElement('div'); ov.className = 'overlay';
  ov.innerHTML = `
    <div class="overlay-card scroll edit-card">
      <div class="eyebrow">Edit · ${b.role}</div>
      <h2 style="margin:6px 0 14px;">${b.name}</h2>
      <div class="ed-row"><span class="ed-l">Exercise</span>
        <div class="ed-c"><span class="ed-cur">${item.name || '—'}</span><button class="ed-mini" id="edSwap">⇄ swap</button></div></div>
      ${b.items.length > 1 ? `<div class="ed-row"><span class="ed-l">Move</span>
        <div class="ed-c"><button class="ed-mini" id="edUp" ${i <= 0 ? 'disabled' : ''}>↑ up</button><button class="ed-mini" id="edDown" ${i >= b.items.length - 1 ? 'disabled' : ''}>↓ down</button></div></div>` : ''}
      <div class="ed-row"><span class="ed-l">${isHold ? 'Hold · sec' : 'Target reps'}</span>
        <div class="ed-step"><button data-ed="tgt" data-d="-${isHold ? 5 : 1}">−</button><input id="edTgt" type="number" inputmode="numeric" value="${targetVal}"/><button data-ed="tgt" data-d="${isHold ? 5 : 1}">+</button></div></div>
      <div class="ed-row"><span class="ed-l">${countLabel}</span>
        <div class="ed-step"><button data-ed="cnt" data-d="-1">−</button><input id="edCnt" type="number" inputmode="numeric" value="${countVal}"/><button data-ed="cnt" data-d="1">+</button></div></div>
      <div class="ed-row"><span class="ed-l">To failure</span><button class="ed-toggle ${item.toFailure ? 'on' : ''}" id="edFail">${item.toFailure ? 'On' : 'Off'}</button></div>
      <div class="ed-row"><span class="ed-l">Drop set</span><button class="ed-toggle ${item.dropSet ? 'on' : ''}" id="edDrop">${item.dropSet ? 'On' : 'Off'}</button></div>
      <div class="ed-row col"><span class="ed-l">Notes</span><textarea id="edNote" rows="2" placeholder="Add a note…">${item.note || b.note || ''}</textarea></div>
      <div class="ed-row col"><span class="ed-l">Work type <span class="muted">— changing restarts the block</span></span>
        <select id="edFmt">${WT.map(([v, l]) => `<option value="${v}" ${v === b.format ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="ed-actions">
        ${b.items.length > 1 ? `<button class="btn ghost danger" id="edRemove">Remove ${item.name}</button>` : ''}
        <button class="btn ghost" id="edAdd">＋ Add exercise</button>
      </div>
      <button class="btn" id="edDone" style="margin-top:10px;">Done</button>
    </div>`;
  host.appendChild(ov);
  const close = () => ov.remove();
  ov.querySelectorAll('[data-ed]').forEach(btn => btn.addEventListener('click', () => {
    const inp = ov.querySelector(btn.dataset.ed === 'tgt' ? '#edTgt' : '#edCnt');
    inp.value = Math.max(0, (Number(inp.value) || 0) + Number(btn.dataset.d));
  }));
  const applySimple = () => {
    const tgt = Math.max(0, Number(ov.querySelector('#edTgt').value) || 0);
    const cnt = Math.max(1, Number(ov.querySelector('#edCnt').value) || 1);
    if (isHold) item.hold = tgt; else { item.reps = tgt; if (item.target != null) item.target = tgt; }
    if (circuitLike) b.rounds = cnt; else item.sets = cnt;
    const note = ov.querySelector('#edNote').value.trim(); item.note = note || undefined;
    R.save(S);
  };
  ov.querySelector('#edSwap').addEventListener('click', () => { close(); openWorkoutSwap(); });
  const move = dir => {
    const j = i + dir; if (j < 0 || j >= b.items.length) return;
    [b.items[i], b.items[j]] = [b.items[j], b.items[i]];   // swap positions
    close(); restartBlock();
  };
  ov.querySelector('#edUp')?.addEventListener('click', () => move(-1));
  ov.querySelector('#edDown')?.addEventListener('click', () => move(1));
  ov.querySelector('#edFail').addEventListener('click', e => { item.toFailure = !item.toFailure; e.target.classList.toggle('on', item.toFailure); e.target.textContent = item.toFailure ? 'On' : 'Off'; });
  ov.querySelector('#edDrop').addEventListener('click', e => { item.dropSet = !item.dropSet; e.target.classList.toggle('on', item.dropSet); e.target.textContent = item.dropSet ? 'On' : 'Off'; });
  ov.querySelector('#edAdd').addEventListener('click', () => { applySimple(); close(); openAddExercise(); });
  const rm = ov.querySelector('#edRemove');
  if (rm) rm.addEventListener('click', () => { b.items.splice(i, 1); close(); restartBlock(); });
  ov.querySelector('#edDone').addEventListener('click', () => {
    const newFmt = ov.querySelector('#edFmt').value;
    applySimple();
    if (newFmt !== b.format) { changeFormat(b, newFmt); close(); restartBlock(); return; }
    buzz(20); close(); renderActive();
  });
}

/* ---------------- lifecycle ---------------- */
export function startWorkout(plan, callbacks = {}) {
  S = R.start(plan); cb = callbacks; host = document.getElementById('app');
  initAudio(); keepAwake(); startTicker();
  enterBlock(0);
}
export function resumeWorkout(callbacks = {}) {
  S = R.load(); if (!S || S.done) return false;
  cb = callbacks; host = document.getElementById('app');
  initAudio(); keepAwake(); startTicker();
  enterBlock(S.bi, true);
  return true;
}
function quit() { stopTicker(); releaseAwake(); stopKeepAlive(); R.clear(); cb.onExit?.(); }

const block = () => S.plan.blocks[S.bi];
const isLastBlock = () => S.bi >= S.plan.blocks.length - 1;

/* ---------------- ticker (drives clocks + step completion) ---------------- */
function startTicker() { stopTicker(); ticker = setInterval(tick, 250); }
function stopTicker() { if (ticker) clearInterval(ticker); ticker = null; }
function tick() {
  const sc = document.getElementById('sessClock'); if (sc) sc.textContent = fmt(R.sessionElapsed(S));
  if (countUpStart != null) { const el = document.getElementById('countUp'); if (el) el.textContent = fmt(Math.floor((Date.now() - countUpStart) / 1000)); }
  const rem = R.stepRemaining(S);
  if (rem == null) { lastSec = null; return; }
  updateTimer(rem, S.stepDur);
  if (S.stepStartedAt !== halfStepKey) { halfStepKey = S.stepStartedAt; saidHalf = false; }
  if (rem !== lastSec) {                       // a whole second ticked over
    lastSec = rem;
    // halfway cue — only for a WORK effort of 1 minute or more
    if (!saidHalf && curStepKind === 'work' && S.stepDur >= 60 && rem <= Math.round(S.stepDur / 2) && rem > 0) {
      saidHalf = true; say('Halfway there.');
    }
    if (rem <= 3 && rem > 0) { beep('count'); buzz(20); }   // 3 · 2 · 1 audible countdown
  }
  if (rem <= 0 && onStepDone) {
    const f = onStepDone; onStepDone = null; lastSec = null;
    R.clearStep(S); beep('end'); buzz(60);     // distinct end beep + haptic
    f();
  }
}

/* ---------------- block routing ---------------- */
function enterBlock(i, opts = {}) {
  const resuming = opts === true || opts.resuming;          // back-compat with enterBlock(i, true)
  const skipReady = opts.skipReady;
  S.bi = i;
  if (!resuming) { S.ii = 0; S.si = 0; S.ci = 0; S.round = 1; S.sub = 'work'; S.amrapRounds = 0; S.iv = null; S.ivPhase = 'work'; S.blockStart = Date.now(); }
  R.clearStep(S); R.save(S);
  roundBuf = {}; onStepDone = null;
  const b = block();
  if (!S.captured[b.id]) buildEntries(b);
  // circuits get an 8s set-up before the FIRST exercise (every entry, incl. block transitions)
  if (!resuming && b.format === 'circuit') { S.sub = 'buffer'; R.save(S); beep('go'); say(b.name); return renderActive(); }
  if (resuming || skipReady) { beep('go'); say(b.name); return renderActive(); }
  renderGetReady();
}
/* 10-second "get set up" countdown before each block (skippable) */
function renderGetReady() {
  const b = block();
  beep('go'); say(`Get ready. ${b.name}.`);
  shell(`<div class="now-ex getready"><div class="label">Get ready</div><div class="name">${b.name}</div>
      <div class="side">${b.role}</div></div>
    <div class="timer-wrap">${timerSvg('buffer')}</div>
    <div class="actionbar"><button class="btn lg" id="go">I'm ready ▸</button></div>`, { edit: false });
  const begin = () => { R.clearStep(S); onStepDone = null; renderActive(); };
  beginStep(10, 'rest'); onStepDone = begin;
  document.getElementById('go').addEventListener('click', begin);
}
function buildEntries(b) {
  S.captured[b.id] = (b.items || []).map(it => ({
    exId: it.exId, name: it.name, measure: it.measure, unit: UNIT[it.measure], load: it.load, noPR: it.noPR,
    sets: [],
  }));
  R.save(S);
}
function renderActive() {
  countUpStart = null;
  const f = block().format;
  if (f === 'circuit') return renderCircuit();
  if (f === 'amrap') return renderAmrap();
  if (f === 'tabata' || f === 'emom') return renderInterval();
  if (f === 'skill') return renderSkill();
  if (f === 'benchmark' || f === 'max_test') return renderBenchmark();
  return renderSets();              // straight · tempo · isometric · yates · rest_pause
}
function completeBlock() {
  R.clearStep(S); onStepDone = null;
  const b = block();
  if (S.blockStart) { S.blockTimes[b.id] = Math.max(0, Math.round((Date.now() - S.blockStart) / 1000)); S.blockStart = null; R.save(S); }
  if (b.type === 'Mobility' || b.format === 'jointprep') return sectionNext();
  return renderLog();          // sets · circuit · amrap · tabata · emom → editable grouped log
}
/* short prescription line for the "up next" card (so you know time / sets before you start) */
function nextRx(b) {
  const it = b.items && b.items[0];
  if (b.format === 'amrap') return `AMRAP · ${b.minutes || 5} min${b.items && b.items.length === 1 ? ' · max reps' : ''}`;
  if (b.format === 'tabata') return `Tabata · ${b.rounds || 8} rounds · ${b.work || 20}s on / ${b.rest ?? 10}s off`;
  if (b.format === 'emom') return `EMOM · ${b.rounds || 10} min`;
  if (b.format === 'skill') return `Skill · ${b.items.length} drill${b.items.length > 1 ? 's' : ''}`;
  if (b.format === 'circuit') return `${b.rounds || 1} rounds · ${b.items.length} moves`;
  if (it) {
    if (it.toFailure || it.warmups) return `${it.warmups ? it.warmups + ' warm-up → ' : ''}all-out${it.reps ? ` (~${it.reps})` : ''}`;
    if (it.measure === 'hold') return `${it.sets || 1} × ${it.hold}s${it.rest ? ` · rest ${fmt(it.rest)}` : ''}`;
    return `${it.sets || 1} × ${it.reps ?? it.target ?? ''}${it.perSide ? '/side' : ''}${it.rest ? ` · rest ${fmt(it.rest)}` : ''}`;
  }
  return '';
}
function sectionNext() {
  R.clearStep(S); onStepDone = null;
  if (isLastBlock()) return finishSession();
  const done = block();
  const next = S.plan.blocks[S.bi + 1];
  const firstItem = (next.items && next.items[0]) || { name: next.name };
  const exList = (next.items && next.items.length ? next.items.map(it => it.name) : [next.name]).slice(0, 6);
  const remaining = S.plan.blocks.slice(S.bi + 1);
  const rest = 60;
  const pct = Math.round(((S.bi + 1) / S.plan.blocks.length) * 100);
  // "2 main blocks · 1 finisher to go"
  const work = remaining.filter(b => /work/i.test(b.role)).length;
  const fin = remaining.filter(b => /finish/i.test(b.role)).length;
  const other = remaining.length - work - fin;
  const sp = [];
  if (work) sp.push(`${work} main block${work > 1 ? 's' : ''}`);
  if (fin) sp.push(`${fin} finisher`);
  if (other) sp.push(`${other} more`);
  const summary = (sp.join(' · ') || `${remaining.length} block${remaining.length > 1 ? 's' : ''}`) + ' to go';
  const motiv = pct >= 80 ? 'Almost there — finish strong. 🔥' : pct >= 50 ? "Past halfway. Hold the pace." : pct >= 25 ? "Locked in. Keep stacking blocks." : "Settle in — you've got this.";
  host.innerHTML = `
    <div class="screen run fade-in transscreen">
      <div class="run-head">
        <button class="x back" id="backBtn">‹</button>
        <div class="blk">✓ ${done.name} — done</div>
        <div class="right"><span class="sessclock" id="sessClock">${fmt(R.sessionElapsed(S))}</span><button class="x" id="exitBtn">✕</button></div>
      </div>

      <div class="trans-rest">
        <div class="eyebrow">Rest</div>
        <div class="timer-wrap">${timerSvg('rest')}</div>
        <div class="btn-row tight"><button class="btn secondary" id="sub20">−20s</button><button class="btn secondary" id="add20">+20s</button></div>
      </div>

      <div class="hero-next" id="heroNext">
        <div class="hn-media"><div class="hn-play">▶</div><span class="hn-tag">${next.role} · up next</span></div>
        <div class="hn-body"><h2>${next.name}</h2><div class="hn-rx">${nextRx(next)}</div>${exList.length > 1 ? `<div class="hn-list">${exList.join(' · ')}</div>` : ''}</div>
      </div>

      <div class="left-card">
        <div class="lc-top"><span class="lc-summary">${summary}</span><span class="lc-pct">${pct}%</span></div>
        <div class="lc-bar"><div class="lc-fill" style="width:${pct}%"></div></div>
        <div class="lc-msg">${motiv}</div>
        <div class="lc-list">${remaining.map((bl, i) => `<div class="lc-row ${i === 0 ? 'up' : ''}"><span class="lc-bn">${bl.name}</span><span class="lc-role">${nextRx(bl)}</span></div>`).join('')}</div>
      </div>

      <div class="actionbar"><button class="btn lg" id="goNext">Start ${next.name} ▸</button></div>
    </div>`;
  document.getElementById('exitBtn').addEventListener('click', confirmExit);
  document.getElementById('backBtn').addEventListener('click', backBlock);
  const begin = () => { R.clearStep(S); onStepDone = null; enterBlock(S.bi + 1, { skipReady: true }); };
  beginStep(rest, 'rest'); say(`Rest. Next, ${next.name}.`); onStepDone = begin;
  document.getElementById('add20').addEventListener('click', () => { S.stepDur += 20; R.save(S); });
  document.getElementById('sub20').addEventListener('click', () => { if (R.stepRemaining(S) > 25) { S.stepDur -= 20; R.save(S); } });
  document.getElementById('goNext').addEventListener('click', begin);
  document.getElementById('heroNext').addEventListener('click', () => openDemo(firstItem));
}
/* exercise demo overlay — wires the ▶ play button now; real clips drop in via demoUrl later */
function openDemo(item) {
  const ex = EXERCISES[item.exId] || {};
  const url = item.demoUrl || ex.demoUrl;
  const ov = document.createElement('div'); ov.className = 'overlay';
  ov.innerHTML = `
    <div class="overlay-card">
      <div class="eyebrow">Demo</div>
      <h2 style="margin:6px 0 12px;">${item.name}</h2>
      ${url ? `<div class="video-wrap"><iframe src="${url}" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe></div>`
            : `<div class="video-stub"><div class="pl">▶</div><div>Demo video coming soon</div></div>`}
      <p class="muted" style="margin:12px 0 0;">${ex.cues || ''}</p>
      <button class="btn" id="demoClose" style="margin-top:14px;">Close</button>
    </div>`;
  host.appendChild(ov);
  ov.querySelector('#demoClose').addEventListener('click', () => ov.remove());
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
}

/* ---------------- shells ---------------- */
function shell(inner, { progress = true, edit = true } = {}) {
  const b = block();
  const pct = overallPct();
  const canEdit = edit && b && b.items && b.items.length && b.format !== 'jointprep';
  host.innerHTML = `
    <div class="screen run fade-in">
      <div class="run-head">
        <button class="x back" id="backBtn" ${S.bi <= 0 ? 'disabled' : ''}>‹</button>
        <div class="blk">${b.role} · ${b.name}</div>
        <div class="right">${canEdit ? '<button class="x edit" id="editBtn" title="Edit block">⋯</button>' : ''}<span class="sessclock" id="sessClock">${fmt(R.sessionElapsed(S))}</span><button class="x" id="exitBtn">✕</button></div>
      </div>
      <div class="wprog-row">
        <div class="wprog"><div class="wprog-fill" style="width:${pct}%"></div><span class="wprog-flag${pct >= 100 ? ' won' : ''}">🏁</span></div>
        <span class="wprog-pct">${pct}%</span>
      </div>
      <div class="blockstrip">${blockStrip()}</div>
      ${inner}
    </div>`;
  document.getElementById('exitBtn').addEventListener('click', confirmExit);
  document.getElementById('backBtn')?.addEventListener('click', backBlock);
  document.getElementById('editBtn')?.addEventListener('click', openWorkoutEdit);
  const now = host.querySelector('.bchip.now'); if (now) now.scrollIntoView({ inline: 'center', block: 'nearest' });
  reflectPause();
}
/* tap anywhere on the timer circle to pause/resume that countdown (session clock keeps running) */
function reflectPause() {
  const paused = S && R.isStepPaused(S);
  document.querySelector('.timer')?.classList.toggle('paused', !!paused);
  const cap = document.getElementById('timerCap');
  if (cap) cap.textContent = (S && S.stepDur != null) ? (paused ? '❚❚ paused — tap to resume' : 'tap to pause') : '';
}
/* overall workout completion (0–100), climbs with the clock */
function overallPct() {
  const n = S.plan.blocks.length || 1;
  return Math.min(100, Math.round(((S.bi + blockFrac()) / n) * 100));
}
function blockFrac() {
  const b = block(); if (!b) return 0;
  if (b.format === 'circuit') return Math.min(1, (S.round - 1) / (b.rounds || 1));
  if (['amrap', 'tabata', 'emom', 'skill', 'benchmark', 'max_test'].includes(b.format)) return 0.5;
  const items = b.items || []; const per = 1 / (items.length || 1);
  const item = items[S.ii] || {}; const total = b.format === 'yates' ? (item.warmups || 0) + 1 : (item.sets || 1);
  return Math.min(1, S.ii * per + (S.si / (total || 1)) * per);
}
/* done ✓ / now / next strip */
function blockStrip() {
  return S.plan.blocks.map((bl, i) => {
    const st = i < S.bi ? 'done' : i === S.bi ? 'now' : 'next';
    const nm = (bl.name || bl.role || '').replace(/—.*$/, '').trim();
    return `<div class="bchip ${st}">${st === 'done' ? '✓ ' : ''}${nm}</div>`;
  }).join('');
}
/* step back to the previous block (clears its log so it's re-done cleanly) */
/* Back = REVIEW the previous block's log (never wipe what was entered). */
function backBlock() {
  if (S.bi <= 0) return;
  R.clearStep(S); onStepDone = null; roundBuf = {};
  S.bi -= 1; R.save(S);
  const b = block();
  if (!S.captured[b.id]) buildEntries(b);
  if (!b.items || !b.items.length || b.format === 'jointprep') return enterBlock(S.bi);
  renderLog();          // editable log for the block you stepped back to; Confirm returns forward
}
function shellPlain(inner) {
  host.innerHTML = `<div class="screen fade-in center">
    <div class="run-head" style="justify-content:flex-end;"><span class="sessclock" id="sessClock">${fmt(R.sessionElapsed(S))}</span></div>
    ${inner}</div>`;
}
function confirmExit() { if (confirm('End this workout? Progress is saved as far as you got.')) quit(); }

/* ---------------- timer + input fragments ---------------- */
function timerSvg(cls) {
  const r = 110, c = 2 * Math.PI * r;
  return `<div class="timer ${cls}"><svg viewBox="0 0 240 240"><circle class="track" cx="120" cy="120" r="${r}"></circle>
    <circle class="fill" id="timerFill" cx="120" cy="120" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="0"></circle></svg>
    <div class="read"><div class="t" id="timerText">0:00</div><div class="cap" id="timerCap"></div>
      <button class="timer-reset" id="timerReset" title="Restart timer">↺ reset</button></div></div>`;
}
function updateTimer(rem, total) {
  const r = 110, c = 2 * Math.PI * r;
  const fillEl = document.getElementById('timerFill'), txt = document.getElementById('timerText');
  if (txt) txt.textContent = fmt(rem);
  if (fillEl) fillEl.style.strokeDashoffset = String(c * (1 - (total > 0 ? rem / total : 0)));
  const paused = R.isStepPaused(S);
  const cap = document.getElementById('timerCap'); if (cap) cap.textContent = paused ? '❚❚ paused — tap to resume' : 'tap to pause';
  document.querySelector('.timer')?.classList.toggle('paused', paused);
}
function bigEditable(val, unit) {
  return `<div class="big-edit"><button class="rnd" id="decBig">−</button>
    <div><input class="big-input" id="bigVal" type="number" inputmode="numeric" value="${val}" onfocus="this.select()"/><div class="unit">${unit}</div></div>
    <button class="rnd" id="incBig">+</button></div>`;
}
function wireBig() {
  const inp = document.getElementById('bigVal');
  const set = v => { curVal = Math.max(0, v); if (inp) inp.value = curVal; };
  document.getElementById('decBig')?.addEventListener('click', () => { set((Number(inp?.value) || 0) - 1); buzz(15); });
  document.getElementById('incBig')?.addEventListener('click', () => { set((Number(inp?.value) || 0) + 1); buzz(15); });
  inp?.addEventListener('input', () => { curVal = Math.max(0, Number(inp.value) || 0); });
  inp?.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); });
}

/* ---------------- SETS (straight / tempo / isometric / yates / rest_pause) ---------------- */
/* last session's FULL sequence for this lift (warm-ups → work) so you can replicate + push */
function lastTimeLine(item) {
  if (!item || !item.exId) return '';
  const seq = store.getLastSets(item.exId);
  if (!seq || !seq.sets.length) return '';
  const uni = item.laterality === 'unilateral' || item.perSide;
  const parts = [];
  if (uni) {
    for (let i = 0; i < seq.sets.length; i += 2) {
      const a = seq.sets[i], b = seq.sets[i + 1];
      const w = a?.weight ?? b?.weight;
      parts.push(`${a ? `${a.side || 'L'}${a.value}` : ''}${b ? ` ${b.side || 'R'}${b.value}` : ''}${w ? ` @${w}` : ''}`.trim());
    }
  } else {
    for (const s of seq.sets) parts.push(`${s.value}${s.weight ? `@${s.weight}` : ''}`);
  }
  return `<div class="lasttime"><span class="lt-lbl">last time</span> ${parts.join(' · ')}</div>`;
}
/* "beat last time" target on a top set — big & glanceable (weight pops, plain wording) */
function failureTarget(item) {
  const pr = item.exId ? store.getPR(item.exId) : null;
  let beat = '';
  if (pr) {
    if (pr.weight != null) {
      beat = (pr.l != null || pr.r != null)
        ? `<span class="w">${pr.weight}</span> lb · L${pr.l ?? '–'} R${pr.r ?? '–'}`
        : `<span class="w">${pr.weight}</span> lb · ${pr.value} reps`;
    } else {
      beat = `<span class="w">${pr.value}</span> ${pr.unit === 'sec' ? 'sec hold' : pr.unit}`;
    }
  }
  // warm-ups done this session → a small ramp line
  const sets = (S.captured[block().id]?.[S.ii]?.sets || []).filter(s => s.value != null);
  const weights = [...new Set(sets.map(s => Number(s.weight)).filter(w => w > 0))];
  const warm = weights.length ? `${weights.join(' → ')} lb` : (sets.length ? [...new Set(sets.map(s => s.value))].join(' · ') : '');
  if (!beat && !warm) return '';
  return `<div class="failure-target">
    ${beat ? `<div class="ft-beat"><span class="ft-lbl">🏆 best set — beat it</span><span class="ft-val">${beat}</span></div>` : `<div class="ft-beat first"><span class="ft-lbl">first time — set the bar 💪</span></div>`}
    ${warm ? `<div class="ft-warm">warm-ups today · ${warm}</div>` : ''}
  </div>`;
}
function renderSets() {
  countUpStart = null;
  const b = block();
  const item = b.items[S.ii];
  if (!item) return completeBlock();
  const unit = UNIT[item.measure];
  const isYates = b.format === 'yates';
  const warmups = isYates ? (item.warmups || 0) : 0;
  const totalSets = isYates ? warmups + 1 : (item.sets || 1);
  const setNo = S.si + 1;
  const failureSet = isYates && S.si === totalSets - 1;
  const label = isYates ? (failureSet ? 'ALL-OUT SET — to failure' : `Warm-up ${setNo}/${warmups}`) : `Set ${setNo} / ${totalSets}`;

  if (S.sub === 'rest') return renderRest(item);

  if (item.measure === 'hold') {                       // isometric / hold set → auto countdown
    const target = item.hold || 30;
    shell(`<div class="now-ex"><div class="label">${label}</div><div class="name">${item.name}</div>${demoBtnHtml(item)}${swapBtnHtml(item)}</div>
      ${lastTimeLine(item)}
      <div class="timer-wrap">${timerSvg('buffer')}</div>
      <div class="actionbar"><button class="btn ghost" id="skip">Skip ▸</button></div>`);
    document.getElementById('skip').addEventListener('click', () => { R.clearStep(S); onStepDone = null; capture(target); afterSet(); });
    beginStep(target, 'work'); say(`${item.name}. Hold it.`); onStepDone = () => { capture(target); afterSet(); };
  } else {                                              // reps set → tap-to-type, weight + R/L
    const weighted = item.load === 'weighted';
    const uni = item.laterality === 'unilateral' || item.perSide;
    const base = failureSet ? (item.reps || 0) : (item.reps || item.target || 0);
    curVal = base;
    const lastW = item.exId ? (store.getLast(item.exId)?.weight ?? '') : '';
    const wField = weighted
      ? `<div class="wfield"><input id="wMain" type="number" inputmode="decimal" placeholder="weight" value="${lastW}" onfocus="this.select()"/><span class="u">${WUNIT}</span></div>` : '';
    const inputArea = uni
      ? `<div class="sides">
           <div class="side-col"><div class="lbl">Left</div><input class="big-input" id="valL" type="number" inputmode="numeric" value="${base}" onfocus="this.select()"/></div>
           <div class="side-col"><div class="lbl">Right</div><input class="big-input" id="valR" type="number" inputmode="numeric" value="${base}" onfocus="this.select()"/></div>
         </div><div class="center unit">${unit} · per side</div>`
      : `<div class="target">${bigEditable(base, `${unit} · tap to type`)}</div>`;
    const showTarget = failureSet || (!isYates && weighted && setNo === 1);   // top set → show what to beat
    shell(`<div class="now-ex"><div class="label">${label}</div><div class="name">${item.name}</div>${item.tempo ? `<div class="side">tempo ${item.tempo}</div>` : ''}${demoBtnHtml(item)}${swapBtnHtml(item)}</div>
      ${lastTimeLine(item)}
      ${showTarget ? failureTarget(item) : ''}
      ${inputArea}${wField}
      <div class="actionbar"><button class="btn lg" id="done">${failureSet ? 'Failure set done ✓' : 'Set done ✓'}</button></div>`);
    if (!uni) wireBig();
    document.querySelectorAll('.big-input, #wMain').forEach(el => el.addEventListener('keydown', e => { if (e.key === 'Enter') el.blur(); }));
    document.getElementById('done').addEventListener('click', () => {
      buzz(40);
      const w = weighted ? numAt('wMain') : null;
      if (uni) { capture(numAt('valL') ?? base, w, 'L'); capture(numAt('valR') ?? base, w, 'R'); }
      else capture(curVal, w);
      afterSet();
    });
  }
}
/* AMRAP: log a single rounds-completed count (the AMRAP score) */
function captureRounds(n) {
  const arr = S.captured[block().id] || [];
  arr.forEach(e => { e.sets = [{ value: Number(n) || 0 }]; e.rounds = true; });
  R.save(S);
}
/* Tabata / EMOM: one entry PER ROUND per exercise, pre-filled with the target
   reps/hold so the athlete confirms or tweaks the real numbers actually done.
   roundsDone = rounds fully or partially completed (honours an early finish). */
function captureIntervals() {
  const b = block();
  const roundsDone = Math.max(1, Math.ceil(S.iv / Math.max(1, b.items.length)));
  const rounds = Math.min(b.rounds || 8, roundsDone);
  (S.captured[b.id] || []).forEach((e, i) => {
    const it = b.items[i] || {};
    const target = it.measure === 'hold' ? (it.hold ?? 20) : (it.reps ?? it.target ?? 0);
    e.sets = Array.from({ length: rounds }, () => ({ value: target }));
    e.rounds = true;
  });
  R.save(S);
}
function capture(val, weight, side) {
  const rec = { value: val };
  if (weight != null && !Number.isNaN(weight)) rec.weight = weight;
  if (side) rec.side = side;
  S.captured[block().id][S.ii].sets.push(rec); R.save(S);
}
function afterSet() {
  const b = block(); const item = b.items[S.ii];
  const total = b.format === 'yates' ? (item.warmups || 0) + 1 : (item.sets || 1);
  if (S.si < total - 1) { S.si += 1; S.sub = 'rest'; R.save(S); return renderRest(item); }
  if (S.ii < b.items.length - 1) { S.ii += 1; S.si = 0; S.sub = 'rest'; R.save(S); return renderRest(item); }
  completeBlock();
}
/* the whole current block as a checklist — done ✓ / now / left, with set dots */
function blockProgress() {
  const b = block();
  const rows = b.items.map((it, ii) => {
    const total = b.format === 'yates' ? (it.warmups || 0) + 1 : (it.sets || 1);
    const perSet = (it.laterality === 'unilateral' || it.perSide) ? 2 : 1;
    const logged = (S.captured[b.id]?.[ii]?.sets || []).filter(s => s.value != null).length;
    const done = Math.floor(logged / perSet);
    const cur = ii === S.ii;
    const dots = Array.from({ length: total }, (_, si) => {
      const cls = si < done ? 'done' : (cur && si === S.si ? 'now' : 'todo');
      const yatesFail = b.format === 'yates' && si === total - 1;
      return `<span class="setdot ${cls}">${si < done ? '✓' : (yatesFail ? '★' : si + 1)}</span>`;
    }).join('');
    const allDone = done >= total;
    return `<div class="bp-row ${cur ? 'cur' : ''} ${allDone ? 'fin' : ''}"><span class="bp-name">${it.name}</span><span class="bp-dots">${dots}</span></div>`;
  }).join('');
  return `<div class="bp-head">This block — ✓ done · ● now · left</div><div class="blockprog">${rows}</div>`;
}
function renderRest(prevItem) {
  const b = block();
  const isYates = b.format === 'yates';
  const suggested = Number(prevItem.rest) || (isYates ? 120 : 60);
  const resume = () => block().format === 'skill' ? renderSkill() : renderSets();
  if (suggested <= 0) { S.sub = 'work'; R.save(S); return resume(); }
  shell(`<div class="now-ex"><div class="label">Rest</div><div class="name">Recover</div></div>
    <div class="timer-wrap">${timerSvg('rest')}</div>
    ${blockProgress()}
    <div class="actionbar"><div class="btn-row">
      <button class="btn secondary" id="sub20">−20s</button><button class="btn secondary" id="add20">+20s</button>
      <button class="btn" id="skip">Skip ▸</button></div></div>`);
  beginStep(suggested, 'rest'); say(`Rest. ${suggested} seconds.`);
  onStepDone = () => { S.sub = 'work'; R.save(S); resume(); };
  document.getElementById('add20').addEventListener('click', () => { S.stepDur += 20; R.save(S); });
  document.getElementById('sub20').addEventListener('click', () => { if (R.stepRemaining(S) > 25) { S.stepDur -= 20; R.save(S); } });
  document.getElementById('skip').addEventListener('click', () => { R.clearStep(S); onStepDone = null; S.sub = 'work'; R.save(S); resume(); });
}

/* ---------------- SKILL — a sequence of drills (practice-timer or sets×hold/reps) ---------------- */
function renderSkill() {
  const b = block(); const item = b.items[S.ii];
  if (!item) return completeBlock();
  if (S.sub === 'rest') return renderRest(item);
  const n = b.items.length;
  const drillList = b.items.map((it, i) => `<div class="ci ${i === S.ii ? 'active' : ''}"><span class="nm">${it.name}</span><span class="tg">${it.minutes ? it.minutes + ' min' : (it.sets || 1) + '×' + (it.measure === 'hold' ? (it.hold || 20) + 's' : (it.reps || 5))}</span></div>`).join('');
  const head = `<div class="now-ex"><div class="label">Skill ${S.ii + 1}/${n}${item.minutes ? ' · practice' : ` · set ${S.si + 1}/${item.sets || 3}`}</div><div class="name">${item.name}</div>${demoBtnHtml(item)}${swapBtnHtml(item)}</div>`;

  if (item.minutes) {                         // freeform practice block for this drill
    shell(`${head}<div class="timer-wrap">${timerSvg('buffer')}</div><div class="circuit-list">${drillList}</div>
      <div class="actionbar"><button class="btn" id="doneSkill">Done ▸</button></div>`);
    beginStep(item.minutes * 60, 'work'); say(`${item.name}.`);
    const adv = () => { R.clearStep(S); onStepDone = null; afterSkillItem(); };
    onStepDone = adv;
    document.getElementById('doneSkill').addEventListener('click', adv);
  } else if (item.measure === 'hold') {        // timed-hold drill (e.g. wall handstand / front lever tuck)
    shell(`${head}<div class="timer-wrap">${timerSvg('buffer')}</div><div class="circuit-list">${drillList}</div>
      <div class="actionbar"><button class="btn ghost" id="skip">Skip ▸</button></div>`);
    beginStep(item.hold || 20, 'work'); say(`${item.name}. Hold.`);
    const adv = () => { capture(item.hold || 20); afterSkillSet(item); };
    onStepDone = adv;
    document.getElementById('skip').addEventListener('click', () => { R.clearStep(S); onStepDone = null; adv(); });
  } else {                                      // reps drill (e.g. negatives)
    curVal = item.reps || 0;
    shell(`${head}<div class="target">${bigEditable(curVal, UNIT[item.measure])}</div><div class="circuit-list">${drillList}</div>
      <div class="actionbar"><button class="btn lg" id="done">Set done ✓</button></div>`);
    wireBig();
    document.getElementById('done').addEventListener('click', () => { buzz(40); capture(curVal); afterSkillSet(item); });
  }
}
function afterSkillSet(item) {
  const total = item.sets || 3;
  if (S.si < total - 1) { S.si += 1; S.sub = 'rest'; R.save(S); return renderRest(item); }
  afterSkillItem();
}
function afterSkillItem() {
  S.si = 0; S.sub = 'work';
  if (S.ii < block().items.length - 1) { S.ii += 1; R.save(S); renderSkill(); }
  else completeBlock();
}

/* ---------------- CIRCUIT (rounds; hold items auto-TUT; log during inter-round rest) ---------------- */
function renderCircuit() {
  const b = block(); const item = b.items[S.ci || (S.ci = 0)];
  if (S.sub === 'roundrest') return renderRoundRest();
  if (S.sub === 'buffer') return renderBuffer();
  const unit = UNIT[item.measure];
  const dots = Array.from({ length: b.rounds || 1 }, (_, i) => `<div class="r ${i + 1 < S.round ? 'done' : i + 1 === S.round ? 'now' : ''}">${i + 1}</div>`).join('');
  const ps = it => (it.laterality === 'unilateral' || it.perSide) && !it.side ? ' /side' : '';
  const list = b.items.map((it, i) => `<div class="ci ${i === S.ci ? 'active' : ''}"><span class="nm">${it.name}${it.side ? ' ' + it.side : ''}</span><span class="tg">${it.measure === 'hold' ? it.hold + 's' : (it.reps ?? it.target) + ' ' + UNIT[it.measure] + ps(it)}</span></div>`).join('');
  const uniNote = (item.laterality === 'unilateral' || item.perSide) && !item.side ? ' · per side' : '';

  if (item.measure === 'hold') {
    shell(`<div class="rounds">${dots}</div><div class="now-ex"><div class="label">Round ${S.round} / ${b.rounds}</div><div class="name">${item.name}${item.side ? ' ' + item.side : ''}</div>${demoBtnHtml(item)}${swapBtnHtml(item)}</div>
      <div class="timer-wrap">${timerSvg('buffer')}</div><div class="circuit-list">${list}</div>
      <div class="actionbar"><button class="btn ghost" id="skip">Skip ▸</button></div>`);
    beginStep(item.hold || 30, 'work'); say(`${item.name}. Go.`);
    const adv = () => { roundBuf[S.ci] = item.hold; afterCircuitItem(); };
    onStepDone = adv;
    document.getElementById('skip').addEventListener('click', () => { R.clearStep(S); onStepDone = null; adv(); });
  } else {
    curVal = Number(roundBuf[S.ci] ?? item.reps ?? item.target) || 0;
    shell(`<div class="rounds">${dots}</div><div class="now-ex"><div class="label">Round ${S.round} / ${b.rounds}</div><div class="name">${item.name}</div>${demoBtnHtml(item)}${swapBtnHtml(item)}</div>
      <div class="target">${bigEditable(curVal, unit + uniNote)}</div><div class="circuit-list">${list}</div>
      <div class="actionbar"><div class="btn-row">
        <button class="btn ghost" id="skipEx">Skip</button>
        <button class="btn lg" id="next">${S.ci >= b.items.length - 1 ? 'Round done ✓' : 'Next ▸'}</button></div></div>`);
    wireBig();
    document.getElementById('next').addEventListener('click', () => { buzz(40); roundBuf[S.ci] = curVal; afterCircuitItem(); });
    document.getElementById('skipEx').addEventListener('click', () => { roundBuf[S.ci] = 0; afterCircuitItem(); });
  }
}
function renderBuffer() {
  const b = block(); const next = b.items[S.ci];
  shell(`<div class="now-ex"><div class="label">Get ready</div><div class="name">${next.name}</div></div>
    <div class="timer-wrap">${timerSvg('buffer')}</div>
    <div class="actionbar"><button class="btn" id="go">Go now ▸</button></div>`);
  const t = Number(b.transition) > 0 ? Number(b.transition) : 8;   // 8s default set-up before a hold
  beginStep(t, 'rest'); say(`Next. ${next.name}.`);
  onStepDone = () => { S.sub = 'work'; R.save(S); renderCircuit(); };
  document.getElementById('go').addEventListener('click', () => { R.clearStep(S); onStepDone = null; S.sub = 'work'; R.save(S); renderCircuit(); });
}
function afterCircuitItem() {
  const b = block();
  if (S.ci < b.items.length - 1) {
    S.ci += 1;
    S.sub = 'buffer'; R.save(S);          // 8s set-up before EVERY next exercise (time to get into position)
    return renderBuffer();
  }
  endRound();
}
function endRound() {
  const b = block();
  b.items.forEach((it, i) => S.captured[b.id][i].sets.push({ value: roundBuf[i] ?? (it.hold ?? it.reps ?? it.target) }));
  R.save(S); buzz(60); say(`Round ${S.round} done.`);
  if (S.round < (b.rounds || 1)) {
    if ((b.roundRest ?? 30) > 0) { S.sub = 'roundrest'; R.save(S); renderRoundRest(); }
    else { S.round += 1; S.ci = 0; roundBuf = {}; S.sub = 'buffer'; R.save(S); renderCircuit(); }   // 8s set-up into the next round
  } else completeBlock();          // last round → editable log (every round adjustable)
}
function renderRoundRest() {
  const b = block(); const rest = Number(b.roundRest) || 30;
  const rows = b.items.map((it, i) => logRow(it, `rr_${i}`, S.captured[b.id][i].sets.at(-1)?.value)).join('');
  const roundDots = Array.from({ length: b.rounds || 1 }, (_, i) => `<div class="r ${i + 1 <= S.round ? 'done' : i + 1 === S.round + 1 ? 'now' : ''}">${i + 1 <= S.round ? '✓' : i + 1}</div>`).join('');
  shell(`<div class="center"><div class="eyebrow">Round ${S.round} of ${b.rounds} done · rest</div></div>
    <div class="rounds">${roundDots}</div>
    <div class="timer-wrap" style="margin:6px 0;">${timerSvg('rest')}</div>
    <div class="card logcard">${rows}</div>
    <div class="actionbar"><button class="btn lg" id="nextRound">Start round ${S.round + 1} ▸</button></div>`, { progress: false, edit: false });
  const proceed = () => {
    b.items.forEach((it, i) => { const v = readInput(`rr_${i}`); if (v != null) S.captured[b.id][i].sets[S.captured[b.id][i].sets.length - 1].value = v; });
    R.clearStep(S); onStepDone = null; S.round += 1; S.ci = 0; roundBuf = {}; S.sub = 'buffer'; R.save(S); renderCircuit();
  };
  beginStep(rest, 'rest'); onStepDone = proceed;
  document.getElementById('nextRound').addEventListener('click', proceed);
}

/* ---------------- AMRAP (count-up window; tap rounds) ---------------- */
function renderAmrap() {
  const b = block(); const mins = b.minutes || 5;
  const single = b.items.length === 1;          // single-exercise max-out → log reps, not rounds
  if (S.stepDur == null) { beginStep(mins * 60, 'work'); say(single ? `Max reps. ${mins} minutes. Go.` : `As many rounds as possible. ${mins} minutes. Go.`); }
  const finish = () => {
    R.clearStep(S); onStepDone = null;
    if (single) { S.captured[b.id][0].sets = [{ value: curVal, reps: curVal }]; R.save(S); }
    // multi: each round's actual reps were logged live via "Log round"
    completeBlock();
  };
  onStepDone = finish;

  if (single) {
    const it = b.items[0];
    if (S.amrapReps == null) S.amrapReps = 0;
    curVal = S.amrapReps;
    shell(`<div class="now-ex"><div class="label">Max reps — ${mins} min</div><div class="name">${it.name}</div></div>
      <div class="timer-wrap">${timerSvg('buffer')}</div>
      <div class="target">${bigEditable(curVal, `${UNIT[it.measure] || 'reps'} · tap to log your total`)}</div>
      <div class="actionbar"><button class="btn lg" id="endAmrap">Done ▸</button></div>`);
    wireBig();
    document.getElementById('bigVal')?.addEventListener('input', () => { S.amrapReps = curVal; R.save(S); });
    document.getElementById('endAmrap').addEventListener('click', () => { S.amrapReps = curVal; finish(); });
    return;
  }

  // MULTI-exercise AMRAP — log the ACTUAL reps/hold you did EACH round (they vary), not just a counter.
  const stepOf = it => it.measure === 'hold' ? 5 : 1;
  if (!roundBuf || !Object.keys(roundBuf).length) {
    roundBuf = {}; b.items.forEach((it, i) => { roundBuf[i] = it.measure === 'hold' ? (it.hold ?? 20) : (it.reps ?? it.target ?? 0); });
  }
  const roundsDone = (S.captured[b.id][0]?.sets || []).length;
  const list = b.items.map((it, i) => `<div class="ci amrap-row">
      <span class="nm">${it.name}</span>
      <div class="amrap-step"><button data-amrap="-1" data-i="${i}">−</button><span class="av" id="av_${i}">${roundBuf[i]}</span><button data-amrap="1" data-i="${i}">+</button><span class="u">${it.measure === 'hold' ? 's' : 'reps'}</span></div>
    </div>`).join('');
  shell(`<div class="now-ex"><div class="label">AMRAP — ${mins} min</div><div class="name">As many rounds as possible</div></div>
    <div class="timer-wrap">${timerSvg('buffer')}</div>
    <div class="center" style="margin:2px 0 8px;"><span class="eyebrow">Rounds logged</span> <span class="big" style="font-size:38px;" id="amrapN">${roundsDone}</span></div>
    <p class="muted" style="text-align:center;margin:0 0 10px;font-size:12px;">Set your reps for the round, then tap Log round.</p>
    <div class="circuit-list">${list}</div>
    <div class="actionbar"><div class="btn-row"><button class="btn secondary" id="undoRound">↺ undo</button><button class="btn" id="logRound">Log round ✓</button><button class="btn ghost" id="endAmrap">End ▸</button></div></div>`);
  host.querySelectorAll('[data-amrap]').forEach(btn => btn.addEventListener('click', () => {
    const i = +btn.dataset.i;
    roundBuf[i] = Math.max(0, (Number(roundBuf[i]) || 0) + Number(btn.dataset.amrap) * stepOf(b.items[i]));
    document.getElementById('av_' + i).textContent = roundBuf[i];
  }));
  document.getElementById('logRound').addEventListener('click', () => {
    b.items.forEach((it, i) => {
      const v = Number(roundBuf[i]) || 0;
      S.captured[b.id][i].sets.push(it.measure === 'hold' ? { value: v, sec: v } : { value: v, reps: v });
      S.captured[b.id][i].rounds = true;
    });
    S.amrapRounds = (S.amrapRounds || 0) + 1; buzz(45); say(`Round ${S.amrapRounds}.`); R.save(S); renderAmrap();
  });
  document.getElementById('undoRound').addEventListener('click', () => {
    b.items.forEach((it, i) => (S.captured[b.id][i].sets || []).pop());
    S.amrapRounds = Math.max(0, (S.amrapRounds || 0) - 1); R.save(S); renderAmrap();
  });
  document.getElementById('endAmrap').addEventListener('click', finish);
}

/* ---------------- INTERVAL (tabata / emom): work/rest cycling items ---------------- */
function renderInterval() {
  const b = block();
  const work = b.work || (b.format === 'emom' ? 60 : 20);
  const rest = b.rest ?? (b.format === 'emom' ? 0 : 10);
  const rounds = b.rounds || 8;
  if (S.iv == null) { S.iv = 0; S.ivPhase = 'work'; R.save(S); }   // iv = interval index across rounds×items
  const totalIv = rounds * b.items.length;
  if (S.iv >= totalIv) { captureIntervals(); return completeBlock(); }
  const idxInRound = S.iv % b.items.length;
  const item = b.items[idxInRound];
  const roundN = Math.floor(S.iv / b.items.length) + 1;
  const phaseWork = S.ivPhase === 'work';
  const nextItem = b.items[(idxInRound + 1) % b.items.length];
  // the full sequence so you always see what's coming — current one highlighted
  const seq = b.items.map((it, i) => `<div class="ci ${i === idxInRound ? 'active' : (i < idxInRound ? 'done' : '')}"><span class="nm">${it.name}</span><span class="tg">${it.measure === 'hold' ? (it.hold || work) + 's' : (it.reps ?? it.target ?? '') + (it.reps ? ' reps' : '')}</span></div>`).join('');
  shell(`<div class="now-ex"><div class="label">${b.format === 'emom' ? 'EMOM' : 'Tabata'} · round ${roundN}/${rounds} · ${idxInRound + 1}/${b.items.length}</div>
      <div class="name">${phaseWork ? item.name : 'Rest'}</div>${phaseWork ? '' : `<div class="side">next · ${nextItem.name}</div>`}</div>
    <div class="timer-wrap">${timerSvg(phaseWork ? 'buffer' : 'rest')}</div>
    <div class="circuit-list">${seq}</div>
    <div class="actionbar"><button class="btn ghost" id="skip">Skip ▸</button></div>`);
  const dur = phaseWork ? work : rest;
  if (dur <= 0) return nextInterval();
  beginStep(dur, phaseWork ? 'work' : 'rest'); if (phaseWork) say(item.name);
  onStepDone = nextInterval;
  document.getElementById('skip').addEventListener('click', () => { R.clearStep(S); onStepDone = null; nextInterval(); });
}
function nextInterval() {
  const b = block();
  if (S.ivPhase === 'work' && (b.rest ?? (b.format === 'emom' ? 0 : 10)) > 0) { S.ivPhase = 'rest'; R.save(S); return renderInterval(); }
  S.ivPhase = 'work'; S.iv += 1; R.save(S);
  renderInterval();
}

/* ---------------- BENCHMARK / MAX TEST ---------------- */
function renderBenchmark() {
  const b = block(); const item = b.items[0]; const unit = UNIT[item.measure];
  shell(`<div class="center"><div class="eyebrow">Benchmark</div><div class="now-ex"><div class="name">${item.name}</div></div>
    <p class="muted" style="margin:0 0 16px;">One all-out set — sets your benchmark.</p></div>
    <div class="card logcard">${logRow(item, 'bench', '')}</div>
    <div class="actionbar"><button class="btn lg" id="saveBench">Log my max ✓</button></div>`, { progress: false, edit: false });
  document.getElementById('saveBench').addEventListener('click', () => {
    S.captured[b.id][0].sets = [{ value: readInput('bench') }]; R.save(S); completeBlock();
  });
}

/* ---------------- log card + summary ---------------- */
/* effort grade (RPE) chips — one tap, feeds next-week progression */
const RPE = [['soft', 'Soft'], ['right', 'Right'], ['hard', 'Hard']];
function rpeChips(cur, key) {
  return `<div class="rpe" data-rpekey="${key}">${RPE.map(([v, l]) =>
    `<button class="rpe-chip ${v} ${cur === v ? 'on' : ''}" data-rpe="${v}">${l}</button>`).join('')}</div>`;
}
function renderLog() {
  const b = block(); const entries = S.captured[b.id];
  // grouped: exercise name once, its sets underneath (no repeated names)
  const word = (b.format === 'circuit' || entries.some(e => e.rounds)) ? 'Round' : 'Set';
  const groups = entries.map((e, ei) => {
    const sets = e.sets.length ? e.sets : [{ value: null }];
    const rows = sets.map((st, si) => {
      const lbl = st.side ? st.side : (sets.length > 1 ? `${word} ${si + 1}` : word);
      return `<div class="logset"><span class="sn">${lbl}</span>${logCell(e, `b${ei}_${si}`, st)}</div>`;
    }).join('');
    return `<div class="loggroup"><div class="gname">${e.name}</div>${rows}
      <div class="rpe-line"><span class="rpe-l">Effort</span>${rpeChips(e.rpe, 'e' + ei)}</div></div>`;
  }).join('');
  shell(`<div class="center"><div class="eyebrow">${b.role}</div><h2 style="font-size:22px;margin:8px 0 4px;">Log — ${b.name}</h2>
      <p class="muted" style="margin:0 0 14px;">Tweak, grade the effort, confirm.</p></div>
    <div class="card logcard">${groups}</div>
    <div class="rpe-block"><span class="rpe-bl">How hard was this block?</span>${rpeChips((S.blockRpe || {})[b.id], 'blk')}</div>
    <div class="actionbar"><button class="btn lg" id="confirm">${isLastBlock() ? 'Finish workout ✓' : 'Confirm ▸'}</button></div>`, { progress: false, edit: false });
  host.querySelectorAll('.rpe').forEach(g => g.addEventListener('click', ev => {
    const chip = ev.target.closest('.rpe-chip'); if (!chip) return;
    g.querySelectorAll('.rpe-chip').forEach(c => c.classList.toggle('on', c === chip));
    const key = g.dataset.rpekey, val = chip.dataset.rpe;
    if (key === 'blk') { S.blockRpe = S.blockRpe || {}; S.blockRpe[b.id] = val; }
    else { entries[+key.slice(1)].rpe = val; }
    buzz(15); R.save(S);
  }));
  document.getElementById('confirm').addEventListener('click', () => {
    entries.forEach((e, ei) => {
      const sets = e.sets.length ? e.sets : [{}];
      sets.forEach((st, si) => readLogCell(e, `b${ei}_${si}`, st));
      e.sets = sets;
    });
    R.save(S); sectionNext();
  });
}
/* unified log cell — reps + hold(sec) + weight, all optional, on EVERY exercise.
   st.value stays as the primary measure (reps→reps, hold→sec) for PRs/history. */
function logCell(e, key, st) {
  const reps = st.reps ?? (e.measure !== 'hold' ? st.value : null);
  const sec  = st.sec  ?? (e.measure === 'hold' ? st.value : null);
  const wt   = st.weight ?? (e.exId ? (store.getLast(e.exId)?.weight ?? null) : null);
  const fld = (id, v, u, mode) => `<div class="lf"><input id="${id}_${key}" type="number" inputmode="${mode}" value="${v ?? ''}" placeholder="–" onfocus="this.select()"><span class="u">${u}</span></div>`;
  return `<div class="logcell">${fld('r', reps, 'reps', 'numeric')}${fld('s', sec, 'sec', 'numeric')}${fld('w', wt, WUNIT, 'decimal')}</div>`;
}
function readLogCell(e, key, st) {
  const num = id => { const el = document.getElementById(`${id}_${key}`); return el && el.value !== '' ? Number(el.value) : null; };
  const reps = num('r'), sec = num('s'), wt = num('w');
  st.reps = reps; st.sec = sec; if (wt != null) st.weight = wt;
  st.value = e.measure === 'hold' ? (sec ?? reps) : (reps ?? sec);   // primary for PR/history
}
function renderSummary() {
  const b = block();
  const rows = S.captured[b.id].map(e => `<div class="row"><span class="nm">${e.name}</span><span class="tg">${e.sets.map(s => s.value ?? '–').join(' · ')} ${e.unit}</span></div>`).join('');
  shell(`<div class="center"><div class="eyebrow">${b.role}</div><h2 style="font-size:22px;margin:8px 0 4px;">${b.name} — done</h2></div>
    <div class="card logcard">${rows || '<div class="muted">Logged.</div>'}</div>
    <div class="actionbar"><button class="btn lg" id="confirm">${isLastBlock() ? 'Finish workout ✓' : 'Confirm ▸'}</button></div>`, { progress: false, edit: false });
  document.getElementById('confirm').addEventListener('click', sectionNext);
}

function cellInputs(meta, key, value, weight, exId) {
  const unit = UNIT[meta.measure]; const step = meta.measure === 'hold' ? 5 : 1;
  const wField = meta.load === 'weighted'
    ? `<div class="weight-field ${weight == null ? 'empty' : ''}"><input id="w_${key}" type="number" inputmode="decimal" placeholder="–" onfocus="this.select()" value="${weight ?? (exId ? (store.getLast(exId)?.weight ?? '') : '')}"/><span class="u">${WUNIT}</span></div>` : '';
  const val = value == null || value === 'MAX' ? '' : value;
  return `${wField}<div class="stepper"><button data-step="-${step}" data-k="${key}">−</button>
      <input id="i_${key}" type="number" inputmode="numeric" value="${val}" placeholder="${value === 'MAX' ? 'max' : '0'}" onfocus="this.select()"/>
      <button data-step="${step}" data-k="${key}">+</button><span class="u">${unit}</span></div>`;
}
function logRow(meta, key, value, exId, weight) {
  return `<div class="row"><span class="nm">${meta.name}</span>${cellInputs(meta, key, value, weight, exId)}</div>`;
}
function readInput(key) { const el = document.getElementById(`i_${key}`); if (!el || el.value === '') return null; return Number(el.value); }
document.addEventListener('click', e => {
  const btn = e.target.closest('.stepper button[data-step]'); if (!btn) return;
  const input = document.getElementById(`i_${btn.dataset.k}`); if (!input) return;
  input.value = Math.max(0, (Number(input.value) || 0) + Number(btn.dataset.step));
});

/* ---------------- finish ---------------- */
/* meaningful, motivating pace bits — this session vs your history of the same workout */
function efficiencyCallouts(session) {
  let all = []; try { all = store.all.sessions; } catch (e) {}
  const prev = all.slice(0, -1).filter(s => s.name === session.name && s.seconds);   // prior runs of THIS workout
  const clean = n => (n || '').replace(/[—·].*$/, '').trim();
  const out = [];
  if (!prev.length) {
    if (session.seconds > 0) out.push({ icon: '📌', text: `Baseline set — ${fmt(session.seconds)} for ${session.name}. Beat it next time.` });
    return out;
  }
  const bestPrev = Math.min(...prev.map(s => s.seconds));
  if (session.seconds > 0 && session.seconds <= bestPrev) {
    out.push({ icon: '🏆', text: `Most efficient ${session.name} yet — ${fmt(session.seconds)} (was ${fmt(bestPrev)}). Tight work.` });
  }
  // biggest single-block speed-up vs its own best
  let bestImp = null;
  (session.blocks || []).forEach(b => {
    if (!b.seconds) return;
    const pts = prev.flatMap(s => (s.blocks || []).filter(x => x.name === b.name && x.seconds).map(x => x.seconds));
    if (!pts.length) return;
    const bp = Math.min(...pts);
    if (b.seconds < bp && (!bestImp || bp - b.seconds > bestImp.imp)) bestImp = { name: clean(b.name), t: b.seconds, imp: bp - b.seconds };
  });
  if (bestImp) out.push({ icon: '⚡', text: `Fastest ${bestImp.name} block yet — ${fmt(bestImp.t)}.` });
  if (!out.length && session.seconds > 0) out.push({ icon: '⏱', text: `${fmt(session.seconds)} today · best is ${fmt(bestPrev)}. Chase it next time.` });
  return out.slice(0, 2);
}
function finishSession() {
  stopTicker(); releaseAwake(); stopKeepAlive();
  const elapsed = R.sessionElapsed(S);
  const session = {
    date: new Date().toISOString(), name: S.plan.name, duration: S.plan.duration, seconds: elapsed,
    blocks: S.plan.blocks.map(b => ({ id: b.id, type: b.role, name: b.name, format: b.format, seconds: S.blockTimes[b.id] || 0, rpe: (S.blockRpe || {})[b.id] || null, entries: S.captured[b.id] || [] })),
  };
  const { prs } = store.saveSession(session);
  const effs = efficiencyCallouts(session);
  R.clear();
  const prText = p => p.weight != null
    ? ((p.l != null || p.r != null) ? `${p.weight}lb · L${p.l ?? '–'} · R${p.r ?? '–'}` : `${p.weight}lb × ${p.value}`)
    : `${p.value} ${p.unit}`;
  if (prs.length) say(`New record. ${prText(prs[0])}.`);
  else if (effs[0]?.icon === '🏆') say('Most efficient session yet. Great work.');
  else say('Workout complete. Strong work.');
  const prHtml = prs.length ? `<div class="card"><div class="eyebrow">New PRs</div>${prs.map(p => `<div class="row" style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--line);"><span>${p.name}</span><span class="pr-flash">${prText(p)}</span></div>`).join('')}</div>` : '';
  const effHtml = effs.length ? `<div class="card"><div class="eyebrow">Pace</div>${effs.map(e => `<div class="eff-row"><span class="eff-ico">${e.icon}</span><span>${e.text}</span></div>`).join('')}</div>` : '';
  host.innerHTML = `<div class="screen fade-in center">
    <div class="big-emoji">${prs.length ? '🏆' : '✅'}</div>
    <h1 style="font-size:28px;">${prs.length ? 'New records!' : 'Done.'}</h1>
    <p class="muted">${S.plan.name} · ${fmt(elapsed)} · ${S.plan.duration} min plan</p>
    <div style="height:16px;"></div>${prHtml}${effHtml}
    <div class="actionbar"><button class="btn lg" id="home">Back to week</button></div></div>`;
  document.getElementById('home').addEventListener('click', () => cb.onFinish?.());
}
