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
import { applyWorkTheme, clearWorkTheme } from './theme.js';
import { say, beep, buzz, fmt, initAudio, stopAudio, keepAwake, releaseAwake, setMuted } from '../timer.js';

const UNIT = { reps: 'reps', hold: 'sec', cals: 'cals', rounds: 'rounds' };
const WUNIT = 'lb';                       // weight unit (Nicolas trains in pounds)
let S = null, host = null, cb = {}, ticker = null, onStepDone = null, curVal = 0, roundBuf = {};
let lastSec = null;                       // last whole-second of the active step (for once-per-second beeps)
let curStepKind = 'rest', saidHalf = false, halfStepKey = null;   // halfway-cue tracking
let countUpStart = null;                  // flexible rest before a reps set: count UP, no forced countdown
const numAt = id => { const e = document.getElementById(id); return e && e.value !== '' ? Number(e.value) : null; };
/* When the step that just ran out ENDED. The next step that starts on its own
   starts there, not "now", so intervals keep a fixed schedule. Only set while
   an ended step's callback runs; a tap always starts from now. */
let chainAt = null;
/* a For Time / stopwatch step shows time GONE, not time left */
let countUpDisplay = false;
/* start a timed step, tagged 'work' or 'rest' (work efforts get a halfway cue).
   `tag` names the screen; with the cursor it makes the step's identity, so a
   re-render of the SAME step (a reopened app) keeps its clock. Returns true
   when the step is new, which is when its voice line should play. */
function beginStep(sec, kind = 'rest', tag = 'step') {
  curStepKind = kind;
  countUpDisplay = tag === 'fortime';
  const key = `${tag}|${S.bi}|${S.ii}|${S.si}|${S.ci}|${S.round}|${S.iv}|${S.ivPhase}|${S.sub}`;
  const fresh = R.beginStep(S, sec, key, chainAt);
  chainAt = null;
  return fresh;
}
/* which screen is up, persisted so a reopen lands back on it */
function onScreen(name) { if (S.screen !== name) { S.screen = name; R.save(S); } }

/* re-wake audio whenever the app returns to foreground — music/Bluetooth can suspend it */
if (typeof document !== 'undefined') {
  /* and the screen lock: the browser drops a wake lock whenever the page is
     hidden, so without asking again the screen dims during every rest after
     the first trip to the music app */
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S && !S.done) { initAudio(); keepAwake(); if (ticker) tick(); } });
  /* And the first touch anywhere, whatever it lands on. "I'm ready" is the
     expected first tap but it is not the only way into a session - a resumed
     workout goes straight to the active screen and never shows that button.
     Once, then it removes itself. */
  /* touchend as well: iOS only lets audio start inside certain gestures,
     and pointerdown has not reliably been one of them */
  const unlockOnce = () => { initAudio(); ['pointerdown', 'touchend'].forEach(t => document.removeEventListener(t, unlockOnce)); };
  ['pointerdown', 'touchend'].forEach(t => document.addEventListener(t, unlockOnce));
  // tap the timer circle to pause/resume that countdown (not the session clock)
  document.addEventListener('click', e => {
    if (!S || S.done) return;
    if (!e.target.closest('.timer-wrap')) return;
    if (S.stepDur == null || S.stepStartedAt == null) return;
    if (R.isStepPaused(S)) R.resumeStep(S); else { R.pauseStep(S); buzz(20); }
    reflectPause();
  });
  // tap the demo button to watch the movement
  document.addEventListener('click', e => {
    const db = e.target.closest('.demo-btn[data-ex]'); if (!db) return;
    openDemo({ exId: db.dataset.ex, name: db.dataset.exname || EXERCISES[db.dataset.ex]?.name || '', cue: db.dataset.cue });
  });
  // tap the swap button to change the current exercise mid-workout (also saves it for next week)
  document.addEventListener('click', e => {
    if (!e.target.closest('.swap-btn[data-swapex]')) return;
    openWorkoutSwap();
  });
  // note — "what did that feel like, what couldn't I find in the gym"
  document.addEventListener('click', e => {
    const nb = e.target.closest('.note-btn[data-noteex]'); if (!nb || !S) return;
    openNote(nb.dataset.noteex, nb.dataset.name);
  });
  // KNEE FLAG — one tap marks that this movement bothered the knee
  document.addEventListener('click', e => {
    const kb = e.target.closest('.knee-btn[data-kneeex]'); if (!kb || !S) return;
    const on = store.toggleFlag(S.plan.sessionId, kb.dataset.kneeex, kb.dataset.name);
    kb.classList.toggle('on', on);
    kb.textContent = on ? '🦵 knee flagged' : '🦵 knee';
    buzz(on ? 60 : 20);
    if (on) say('Flagged. Skip it if it hurts.');
  });
}

/* free-text note against one exercise, kept per day so the coach report
   can show what he felt on which session */
function openNote(exId, name) {
  const sid = S.plan.sessionId;
  const cur = store.getNote(sid, exId);
  const ov = document.createElement('div'); ov.className = 'overlay';
  ov.innerHTML = `
    <div class="overlay-card">
      <div class="eyebrow">Note</div>
      <h2 style="margin:6px 0 4px;">${name || EXERCISES[exId]?.name || ''}</h2>
      <p class="muted" style="margin:0 0 12px;">How did it feel? Too easy, too hard, couldn't find it in the gym?</p>
      <textarea id="noteTxt" class="note-input" rows="4" placeholder="Type anything…">${cur.replace(/</g, '&lt;')}</textarea>
      <button class="btn" id="noteSave" style="margin-top:12px;">Save note</button>
      <button class="btn ghost" id="noteCancel" style="margin-top:8px;">Cancel</button>
    </div>`;
  host.appendChild(ov);
  const ta = ov.querySelector('#noteTxt'); ta.focus();
  ov.querySelector('#noteSave').addEventListener('click', () => {
    store.setNote(sid, exId, name, ta.value);
    ov.remove(); buzz(30);
    const btn = document.querySelector(`.note-btn[data-noteex="${exId}"]`);
    if (btn) { const has = !!ta.value.trim(); btn.classList.toggle('has', has); btn.textContent = has ? '📝 note saved' : '📝 note'; }
  });
  ov.querySelector('#noteCancel').addEventListener('click', () => ov.remove());
}
/* small "watch the move" button for the active exercise (real clip if wired, else "coming soon") */
function demoBtnHtml(item) {
  if (!item || !item.exId) return '';
  const has = !!(item.demoUrl || EXERCISES[item.exId]?.demoUrl);
  const attr = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return `<button class="demo-btn ${has ? 'has' : ''}" data-ex="${item.exId}" data-exname="${attr(item.name)}" data-cue="${attr(item.cue || EXERCISES[item.exId]?.cues)}">▶ ${has ? 'watch the move' : 'demo'}</button>`;
}
/* swap the current exercise (button on the exercise screen) */
function swapBtnHtml(item) {
  if (!item || !item.exId) return '';
  return `<button class="swap-btn" data-swapex="${item.exId}">⇄ swap</button>`;
}
/* the plain-language cue, ALWAYS on screen next to the video button —
   never buried in the demo overlay (coaching requirement). */
function cueLine(item) {
  if (!item || !item.exId) return '';
  const cue = item.cue || EXERCISES[item.exId]?.cues || '';
  const extra = item.note ? `<div class="run-note">${item.note}</div>` : '';
  if (!cue && !extra) return '';
  return `${cue ? `<div class="run-cue">${cue}</div>` : ''}${extra}`;
}
/* notes + knee flag — only for a coachMode plan (the beginner program) */
function coachBtnsHtml(item) {
  if (!item || !item.exId || !S?.plan?.coachMode) return '';
  const sid = S.plan.sessionId;
  const hasNote = !!store.getNote(sid, item.exId);
  const flagged = store.isFlagged(sid, item.exId);
  const nm = String(item.name || '').replace(/"/g, '&quot;');
  return `<button class="note-btn ${hasNote ? 'has' : ''}" data-noteex="${item.exId}" data-name="${nm}">📝 ${hasNote ? 'note saved' : 'note'}</button>
    <button class="knee-btn ${flagged ? 'on' : ''}" data-kneeex="${item.exId}" data-name="${nm}">🦵 ${flagged ? 'knee flagged' : 'knee'}</button>`;
}
/* one action row under every exercise name, on every screen.
   Video is MANDATORY here — it renders for warm-ups, holds and
   finishers too, never only for the "real" lifts. */
function exActions(item) {
  return `<div class="ex-actions">${demoBtnHtml(item)}${swapBtnHtml(item)}${coachBtnsHtml(item)}</div>${cueLine(item)}`;
}
/* a compact ▶ for a row inside a multi-exercise LIST (circuit / skill / amrap /
   the superset pair). Routes through the same demo handler as the big button,
   so you can tap ANY move in the list mid-workout to see what it is — not only
   the one that happens to be active. */
function rowVid(it) {
  if (!it || !it.exId) return '';
  const a = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const has = !!(it.demoUrl || EXERCISES[it.exId]?.demoUrl);
  return `<button class="ci-vid demo-btn ${has ? 'has' : ''}" data-ex="${it.exId}" data-exname="${a(it.name)}" data-cue="${a(it.cue || EXERCISES[it.exId]?.cues)}" title="Watch it">▶</button>`;
}

/* which exercise is on screen right now, whatever the format */
function curIdx() {
  const b = block(); if (!b) return 0;
  if (b.format === 'circuit' || b.format === 'superset') return S.ci || 0;
  if (b.format === 'tabata' || b.format === 'emom') return (S.iv || 0) % (b.items.length || 1);
  if (b.format === 'amrap') return 0;
  return S.ii || 0;
}
function openWorkoutSwap() {
  const b = block(); const item = b.items[curIdx()]; if (!item) return;
  const from = item.swappedFrom || item.exId;
  const used = b.items.map(i => i.exId).filter(x => x !== item.exId);
  /* the program's OWN prescribed substitutions come first — these are the
     swaps that were designed in, not generic library neighbours */
  const subs = (item.subs || []).filter(id => EXERCISES[id] && id !== item.exId);
  const subRows = subs.length
    ? `<div class="swap-divider first">Swap it for</div>` + subs.map(id =>
        `<div class="swap-opt sub" data-id="${id}"><span>${EXERCISES[id].name}</span><span class="muted">recommended</span></div>`).join('')
    : '';
  const alts = alternatives(from, { constraint: S.plan.constraint }, used.concat(subs));
  let dividerInserted = false;
  const rows = alts.map(a => {
    let pre = '';
    if (!a.recommended && !dividerInserted) { dividerInserted = true; pre = '<div class="swap-divider">More from your library</div>'; }
    return pre + `<div class="swap-opt ${a.id === item.exId ? 'cur' : ''}" data-id="${a.id}"><span>${a.name}</span><span class="muted">${a.id === item.exId ? 'current' : `${a.pattern}${a.diff ? ` · d${a.diff}` : ''}`}</span></div>`;
  }).join('');
  const ov = document.createElement('div'); ov.className = 'overlay';
  ov.innerHTML = `
    <div class="overlay-card scroll">
      <div class="eyebrow">Swap exercise · saved for next week too</div>
      <h2 style="margin:6px 0 12px;">${item.name}</h2>
      ${subRows}
      ${alts.length ? rows : (subs.length ? '' : '<div class="muted" style="padding:8px 0;">No alternatives.</div>')}
      ${item.exId !== from ? `<div class="swap-opt revert" data-id="__revert"><span>↩ Back to ${EXERCISES[from]?.name || from}</span></div>` : ''}
      <button class="btn ghost" id="wswapCancel" style="margin-top:12px;">Cancel</button>
    </div>`;
  host.appendChild(ov);
  ov.querySelector('#wswapCancel').addEventListener('click', () => ov.remove());
  ov.querySelectorAll('.swap-opt[data-id]').forEach(el => el.addEventListener('click', () => {
    swapCurrentExercise(el.dataset.id === '__revert' ? from : el.dataset.id, from);
    ov.remove();
  }));
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

/* ---------------- lifecycle ---------------- */
export function startWorkout(plan, callbacks = {}) {
  S = R.start(plan); cb = callbacks; host = document.getElementById('app');
  applyWorkTheme(); initAudio(); keepAwake(); startTicker();
  enterBlock(0);
}
export function resumeWorkout(callbacks = {}) {
  S = R.load(); if (!S || S.done) return false;
  cb = callbacks; host = document.getElementById('app');
  applyWorkTheme(); initAudio(); keepAwake(); startTicker();
  enterBlock(S.bi, true);
  return true;
}
function quit() { stopTicker(); releaseAwake(); stopAudio(); R.clear(); clearWorkTheme(); cb.onExit?.(); }

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
  if (rem <= 0 && onStepDone) return runOut();
  updateTimer(rem, S.stepDur);
  /* a step seen for the first time; if it is already past halfway (a reopen),
     that cue has been and gone */
  if (S.stepStartedAt !== halfStepKey) { halfStepKey = S.stepStartedAt; saidHalf = rem <= Math.round(S.stepDur / 2); }
  if (rem !== lastSec) {                       // a whole second ticked over
    lastSec = rem;
    // halfway cue — only for a WORK effort of 1 minute or more
    if (!saidHalf && curStepKind === 'work' && S.stepDur >= 60 && rem <= Math.round(S.stepDur / 2) && rem > 0) {
      saidHalf = true; say('Halfway there.');
    }
    if (rem <= 3 && rem > 0) { beep('count'); buzz(20); }   // 3 · 2 · 1 audible countdown
  }
}
/* THE ACTIVE STEP RAN OUT. Usually a moment ago, and it gets its end beep.
   But a locked phone stops this ticker, so on the way back it can be minutes
   late with several steps' worth of workout gone by: 6 Tabata intervals, a
   hold and the rest after it. Each ended step hands its END time to the next
   (chainAt), and this keeps advancing, silently, until it reaches the step
   that is running right now. One beep then says "you are here". */
function runOut() {
  const late = Date.now() - (R.stepEndsAt(S) ?? Date.now()) > 2000;
  if (late) setMuted(true); else { beep('end'); buzz(60); }
  let guard = 0;
  try {
    do {
      const f = onStepDone; onStepDone = null; lastSec = null;
      chainAt = R.isStepPaused(S) ? null : R.stepEndsAt(S);
      R.clearStep(S);
      f();
      chainAt = null;
    } while (++guard < 2000 && onStepDone && R.stepRemaining(S) === 0);
  } finally {
    chainAt = null;
    if (late) { setMuted(false); beep('end'); buzz(60); }
  }
}

/* ---------------- block routing ---------------- */
function enterBlock(i, opts = {}) {
  const resuming = opts === true || opts.resuming;          // back-compat with enterBlock(i, true)
  const skipReady = opts.skipReady;
  S.bi = i;
  /* A reopen keeps the running step (its clock is the point) and the reps
     already typed this round. Only a fresh block wipes them. */
  if (!resuming) {
    S.ii = 0; S.si = 0; S.ci = 0; S.round = 1; S.sub = 'work'; S.amrapRounds = 0; S.amrapReps = null;
    S.iv = null; S.ivPhase = 'work'; S.blockStart = Date.now(); S.roundBuf = {};
    R.clearStep(S);
  }
  roundBuf = S.roundBuf || (S.roundBuf = {});
  onStepDone = null; R.save(S);
  const b = block();
  if (!S.captured[b.id]) buildEntries(b);
  if (resuming) return resumeScreen();
  if (skipReady) { beep('go'); say(b.name); return renderActive(); }
  renderGetReady();
}
/* back onto whichever screen was up when the app went away */
function resumeScreen() {
  if (S.screen === 'ready') return renderGetReady();
  if (S.screen === 'log') return renderLog();
  if (S.screen === 'summary') return renderSummary();
  if (S.screen === 'trans') return sectionNext();
  if (S.screen === 'feedback') return renderFeedback(finishSession);
  return renderActive();
}
/* "get set up" countdown before each block (skippable). 10 seconds unless
   the plan says otherwise; 0 skips it. */
const readySec = () => (S.plan.getReady != null ? Number(S.plan.getReady) : 10);
function renderGetReady() {
  const b = block();
  if (readySec() <= 0) { beep('go'); return renderActive(); }
  onScreen('ready');
  shell(`<div class="now-ex getready"><div class="label">Get ready</div><div class="name">${b.name}</div>
      <div class="side">${b.role}</div></div>
    <div class="timer-wrap">${timerSvg('ready')}</div>
    <div class="actionbar"><button class="btn lg" id="go">I'm ready ▸</button></div>`);
  const begin = () => { R.clearStep(S); onStepDone = null; renderActive(); };
  if (beginStep(readySec(), 'rest', 'ready')) { beep('go'); say(`Get ready. ${b.name}.`); }
  onStepDone = begin;
  document.getElementById('go').addEventListener('click', () => {
    /* THE FIRST TAP IS THE ONLY MOMENT AUDIO CAN BE UNLOCKED.
       A session used to begin because somebody pressed something inside the
       app, so the AudioContext was already unlocked by that press. It now
       begins on PAGE LOAD - the dashboard hands over as index.html?run=<day>
       and boot() starts the workout - and a page load is not a user gesture.
       Every browser refuses to start audio or speech without one, so the
       context was created suspended and stayed there: no beeps, no voice,
       for the whole session, silently.
       This is that gesture. */
    initAudio();
    begin();
  });
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
  onScreen('active');
  const f = block().format;
  if (f === 'superset') return renderSuperset();
  if (f === 'circuit') return renderCircuit();
  if (f === 'amrap') return renderAmrap();
  if (f === 'tabata' || f === 'emom') return renderInterval();
  if (f === 'fortime') return renderForTime();
  if (f === 'skill') return renderSkill();
  if (f === 'benchmark' || f === 'max_test') return renderBenchmark();
  return renderSets();              // straight · tempo · isometric · yates · rest_pause
}
function completeBlock() {
  R.clearStep(S); onStepDone = null;
  const b = block();
  if (S.blockStart) { S.blockTimes[b.id] = Math.max(0, Math.round((Date.now() - S.blockStart) / 1000)); S.blockStart = null; R.save(S); }
  if (b.type === 'Mobility' || b.format === 'jointprep') return sectionNext();
  /* a Quick Timer flows straight on: no confirm screen between sets of
     intervals, and the finish screen already shows the result */
  if (S.plan.quick && ['tabata', 'emom', 'fortime'].includes(b.format)) return sectionNext();
  if (['tabata', 'emom', 'fortime'].includes(b.format)) return renderSummary();
  return renderLog();          // amrap + sets + circuit → fully editable grouped log
}
/* short prescription line for the "up next" card (so you know time / sets before you start) */
function nextRx(b) {
  const it = b.items && b.items[0];
  if (b.format === 'amrap') return `AMRAP · ${b.minutes || 5} min${b.items && b.items.length === 1 ? ' · max reps' : ''}`;
  if (b.format === 'tabata') return `Tabata · ${b.rounds || 8} rounds · ${b.work || 20}s on / ${b.rest ?? 10}s off`;
  if (b.label && b.intervals) return `${b.label} · ${b.intervals} × ${b.work}s${b.rest ? ` / ${b.rest}s` : ''}`;
  if (b.format === 'emom') return `EMOM · ${b.rounds || 10} min`;
  if (b.format === 'fortime') return b.minutes ? `For time · ${b.minutes} min cap` : 'For time';
  if (b.format === 'superset') return `Superset · ${b.rounds || 3} rounds · rest ${b.rest ?? 75}s`;
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
  onStepDone = null;          // no clearStep: a reopen lands here mid-rest and keeps it
  if (isLastBlock()) return finishSession();
  onScreen('trans');
  const done = block();
  const next = S.plan.blocks[S.bi + 1];
  const firstItem = (next.items && next.items[0]) || { name: next.name };
  const exList = (next.items && next.items.length ? next.items.map(it => it.name) : [next.name]).slice(0, 6);
  const remaining = S.plan.blocks.slice(S.bi + 1);
  /* a block can say how long the break after it is (the Quick Timer's rest
     between sets); 0 goes straight on */
  const rest = done.restAfter ?? 60;
  if (rest <= 0) { enterBlock(S.bi + 1, { skipReady: true }); return; }
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
  const motiv = pct >= 80 ? 'Almost there. Finish strong. 🔥' : pct >= 50 ? "Past halfway. Hold the pace." : pct >= 25 ? "Locked in. Keep stacking blocks." : "Settle in. You've got this.";
  host.innerHTML = `
    <div class="screen run fade-in transscreen ${S.plan.coachMode ? 'bgn' : ''}">
      <div class="run-head">
        <button class="x back" id="backBtn">‹</button>
        <div class="blk">✓ ${done.name} done</div>
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
  if (beginStep(rest, 'rest', 'trans')) say(`Rest. Next, ${next.name}.`); onStepDone = begin;
  document.getElementById('add20').addEventListener('click', () => { S.stepDur += 20; R.save(S); });
  document.getElementById('sub20').addEventListener('click', () => { if (R.stepRemaining(S) > 25) { S.stepDur -= 20; R.save(S); } });
  document.getElementById('goNext').addEventListener('click', begin);
  document.getElementById('heroNext').addEventListener('click', () => openDemo(firstItem));
}
/* exercise demo overlay — wires the ▶ play button now; real clips drop in via demoUrl later */
function openDemo(item) {
  const ex = EXERCISES[item.exId] || {};
  const url = item.demoUrl || ex.demoUrl;
  const cue = item.cue || ex.cues || '';
  const q = encodeURIComponent(`${item.name || ex.name} form tutorial`);
  const ov = document.createElement('div'); ov.className = 'overlay';
  ov.innerHTML = `
    <div class="overlay-card">
      <div class="eyebrow">Demo</div>
      <h2 style="margin:6px 0 12px;">${item.name}</h2>
      ${url ? `<div class="video-wrap"><iframe src="${url}" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe></div>`
            : `<div class="video-stub"><div class="pl">▶</div><div>Video coming soon</div>
                 <a class="ytlink" href="https://www.youtube.com/results?search_query=${q}" target="_blank" rel="noopener">Search YouTube meanwhile</a></div>`}
      <p class="cue-big">${cue}</p>
      <button class="btn" id="demoClose" style="margin-top:14px;">Close</button>
    </div>`;
  host.appendChild(ov);
  ov.querySelector('#demoClose').addEventListener('click', () => ov.remove());
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
}

/* ---------------- shells ---------------- */
function shell(inner, { progress = true } = {}) {
  const b = block();
  const pct = overallPct();
  host.innerHTML = `
    <div class="screen run fade-in ${S.plan.coachMode ? 'bgn' : ''}">
      <div class="run-head">
        <button class="x back" id="backBtn" ${S.bi <= 0 ? 'disabled' : ''}>‹</button>
        <div class="blk">${b.role} · ${b.name}</div>
        <div class="right"><span class="sessclock" id="sessClock">${fmt(R.sessionElapsed(S))}</span><button class="x" id="exitBtn">✕</button></div>
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
  const now = host.querySelector('.bchip.now'); if (now) now.scrollIntoView({ inline: 'center', block: 'nearest' });
  reflectPause();
}
/* tap anywhere on the timer circle to pause/resume that countdown (session clock keeps running) */
function reflectPause() {
  const paused = S && R.isStepPaused(S);
  document.querySelector('.timer')?.classList.toggle('paused', !!paused);
  const cap = document.getElementById('timerCap');
  if (cap) cap.textContent = (S && S.stepDur != null) ? (paused ? '❚❚ paused, tap to resume' : 'tap to pause') : '';
}
/* overall workout completion (0–100), climbs with the clock */
function overallPct() {
  const n = S.plan.blocks.length || 1;
  return Math.min(100, Math.round(((S.bi + blockFrac()) / n) * 100));
}
function blockFrac() {
  const b = block(); if (!b) return 0;
  if (b.format === 'circuit' || b.format === 'superset') return Math.min(1, (S.round - 1) / (b.rounds || 1));
  if (['amrap', 'tabata', 'emom', 'skill', 'benchmark', 'max_test', 'fortime'].includes(b.format)) return 0.5;
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
function backBlock() {
  if (S.bi <= 0) return;
  const prev = S.plan.blocks[S.bi - 1];
  (S.captured[prev.id] || []).forEach(e => e.sets = []);
  R.clearStep(S); onStepDone = null; roundBuf = S.roundBuf = {};
  enterBlock(S.bi - 1);
}
function shellPlain(inner) {
  host.innerHTML = `<div class="screen fade-in center">
    <div class="run-head" style="justify-content:flex-end;"><span class="sessclock" id="sessClock">${fmt(R.sessionElapsed(S))}</span></div>
    ${inner}</div>`;
}
/* Ending early used to throw the workout away while telling you it was
   saved. Now it is your call: keep what you did (it goes to history, PRs
   count), bin it, or change your mind. */
function confirmExit() {
  const logged = loggedSetCount();
  const ov = document.createElement('div'); ov.className = 'overlay';
  ov.innerHTML = `
    <div class="overlay-card">
      <div class="eyebrow">End workout</div>
      <h2 style="margin:6px 0 4px;">Stop here?</h2>
      <p class="muted" style="margin:0 0 14px;">${logged
        ? `You've logged ${logged} set${logged > 1 ? 's' : ''} so far.`
        : 'Nothing logged yet.'}</p>
      ${logged ? '<button class="btn" id="exSave">Save what I did</button>' : ''}
      <button class="btn ${logged ? 'ghost' : ''}" id="exDiscard" style="margin-top:8px;">${logged ? 'Discard it' : 'End workout'}</button>
      <button class="btn ghost" id="exKeep" style="margin-top:8px;">Keep going</button>
    </div>`;
  host.appendChild(ov);
  ov.querySelector('#exSave')?.addEventListener('click', () => { ov.remove(); finishSession({ partial: true }); });
  ov.querySelector('#exDiscard').addEventListener('click', () => { ov.remove(); quit(); });
  ov.querySelector('#exKeep').addEventListener('click', () => ov.remove());
}
function loggedSetCount() {
  return Object.values(S.captured || {}).flat()
    .reduce((n, e) => n + (e.sets || []).filter(s => s.value != null && s.value !== '').length, 0);
}

/* ---------------- timer + input fragments ---------------- */
function timerSvg(cls) {
  const r = 110, c = 2 * Math.PI * r;
  return `<div class="timer ${cls}"><svg viewBox="0 0 240 240"><circle class="track" cx="120" cy="120" r="${r}"></circle>
    <circle class="fill" id="timerFill" cx="120" cy="120" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="0"></circle></svg>
    <div class="read"><div class="t" id="timerText">0:00</div><div class="cap" id="timerCap"></div></div></div>`;
}
function updateTimer(rem, total) {
  const r = 110, c = 2 * Math.PI * r;
  const fillEl = document.getElementById('timerFill'), txt = document.getElementById('timerText');
  let shown = rem, frac = total > 0 ? rem / total : 0;
  if (countUpDisplay) {
    shown = total - rem;
    /* no cap: the ring sweeps once a minute, like a second hand */
    frac = total >= NO_CAP ? (shown % 60) / 60 : shown / total;
  }
  if (txt) txt.textContent = fmt(shown);
  if (fillEl) fillEl.style.strokeDashoffset = String(c * (1 - frac));
  const paused = R.isStepPaused(S);
  const cap = document.getElementById('timerCap'); if (cap) cap.textContent = paused ? '❚❚ paused, tap to resume' : 'tap to pause';
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
    ${beat ? `<div class="ft-beat"><span class="ft-lbl">🏆 best set, beat it</span><span class="ft-val">${beat}</span></div>` : `<div class="ft-beat first"><span class="ft-lbl">first time — set the bar 💪</span></div>`}
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
  const label = isYates ? (failureSet ? 'ALL-OUT SET, to failure' : `Warm-up ${setNo}/${warmups}`) : `Set ${setNo} / ${totalSets}`;

  if (S.sub === 'rest') return renderRest(item);

  if (item.measure === 'hold') {                       // isometric / hold set → auto countdown
    const target = item.hold || 30;
    shell(`<div class="now-ex"><div class="label">${label}</div><div class="name">${item.name}</div></div>${exActions(item)}
      ${lastTimeLine(item)}
      <div class="timer-wrap">${timerSvg('buffer')}</div>
      <div class="actionbar"><button class="btn ghost" id="skip">Skip ▸</button></div>`);
    document.getElementById('skip').addEventListener('click', () => { R.clearStep(S); onStepDone = null; capture(target); afterSet(); });
    if (beginStep(target, 'work', 'hold')) say(`${item.name}. Hold it.`); onStepDone = () => { capture(target); afterSet(); };
  } else {                                              // reps set → tap-to-type, weight + R/L
    const weighted = item.load === 'weighted';
    const uni = item.laterality === 'unilateral' || item.perSide;
    /* THE SET YOU ARE ON, WHEN THE COACH WROTE THEM SEPARATELY. Without
       a plan every set shows the same target, which is right for
       "3 x 10" and wrong for a top set with back-offs — the shape most
       real strength work has. */
    const step = Array.isArray(item.plan) ? item.plan[S.si] : null;
    const base = failureSet ? (item.reps || 0)
               : (step && step.reps != null ? step.reps : (item.reps || item.target || 0));
    curVal = base;
    /* WHAT YOU DID LAST TIME, OR WHAT THE COACH SAID TO START AT.

       This only ever offered the last logged weight, which is exactly
       right for a movement with a history and blank for one without — so
       the first session on anything new opened an empty box and the
       coach's intended load lived nowhere. A prescribed weight fills it
       when there is no history; history still wins once there is one,
       because by then the person's own numbers are the better answer. */
    /* a weight written for THIS set outranks both the log and the
       movement-wide starting weight, because it is the most specific
       thing anybody said */
    const lastW = (step && step.weight != null) ? step.weight
                : (item.exId ? (store.getLast(item.exId)?.weight ?? '') : '') || (item.weight ?? '');
    const wField = weighted
      ? `<div class="wfield"><input id="wMain" type="number" inputmode="decimal" placeholder="weight" value="${lastW}" onfocus="this.select()"/><span class="u">${WUNIT}</span></div>` : '';
    const inputArea = uni
      ? `<div class="sides">
           <div class="side-col"><div class="lbl">Left</div><input class="big-input" id="valL" type="number" inputmode="numeric" value="${base}" onfocus="this.select()"/></div>
           <div class="side-col"><div class="lbl">Right</div><input class="big-input" id="valR" type="number" inputmode="numeric" value="${base}" onfocus="this.select()"/></div>
         </div><div class="center unit">${unit} · per side</div>`
      : `<div class="target">${bigEditable(base, `${unit} · tap to type`)}</div>`;
    const showTarget = failureSet || (!isYates && weighted && setNo === 1);   // top set → show what to beat
    shell(`<div class="now-ex"><div class="label">${label}</div><div class="name">${item.name}</div>${item.tempo ? `<div class="side">tempo ${item.tempo}</div>` : ''}</div>${exActions(item)}
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
/* AMRAP / interval blocks log a rounds-completed count so they appear in history */
function captureRounds(n) {
  const arr = S.captured[block().id] || [];
  arr.forEach(e => { e.sets = [{ value: Number(n) || 0 }]; e.rounds = true; e.unit = 'rounds'; });
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
  return `<div class="bp-head">This block: ✓ done · ● now · left</div><div class="blockprog">${rows}</div>`;
}
function renderRest(prevItem) {
  const b = block();
  const isYates = b.format === 'yates';
  // rest:0 means NO rest (continuous) — only fall back to a default when rest is unset.
  // `Number(0) || 60` would wrongly become 60, so test for null explicitly.
  const suggested = prevItem.rest != null ? Number(prevItem.rest) : (isYates ? 120 : 60);
  const resume = () => block().format === 'skill' ? renderSkill() : renderSets();
  if (suggested <= 0) { S.sub = 'work'; R.save(S); return resume(); }
  shell(`<div class="now-ex"><div class="label">Rest</div><div class="name">Recover</div></div>
    <div class="timer-wrap">${timerSvg('rest')}</div>
    ${blockProgress()}
    <div class="actionbar"><div class="btn-row">
      <button class="btn secondary" id="sub20">−20s</button><button class="btn secondary" id="add20">+20s</button>
      <button class="btn" id="skip">Skip ▸</button></div></div>`);
  if (beginStep(suggested, 'rest', 'rest')) say(`Rest. ${suggested} seconds.`);
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
  const drillList = b.items.map((it, i) => `<div class="ci ${i === S.ii ? 'active' : ''}">${rowVid(it)}<span class="nm">${it.name}</span><span class="tg">${it.minutes ? it.minutes + ' min' : (it.sets || 1) + '×' + (it.measure === 'hold' ? (it.hold || 20) + 's' : (it.reps || 5))}</span></div>`).join('');
  const head = `<div class="now-ex"><div class="label">Skill ${S.ii + 1}/${n}${item.minutes ? ' · practice' : ` · set ${S.si + 1}/${item.sets || 3}`}</div><div class="name">${item.name}</div></div>${exActions(item)}`;

  if (item.minutes) {                         // freeform practice block for this drill
    shell(`${head}<div class="timer-wrap">${timerSvg('buffer')}</div><div class="circuit-list">${drillList}</div>
      <div class="actionbar"><button class="btn" id="doneSkill">Done ▸</button></div>`);
    if (beginStep(item.minutes * 60, 'work', 'skillmin')) say(`${item.name}.`);
    const adv = () => { R.clearStep(S); onStepDone = null; afterSkillItem(); };
    onStepDone = adv;
    document.getElementById('doneSkill').addEventListener('click', adv);
  } else if (item.measure === 'hold') {        // timed-hold drill (e.g. wall handstand / front lever tuck)
    shell(`${head}<div class="timer-wrap">${timerSvg('buffer')}</div><div class="circuit-list">${drillList}</div>
      <div class="actionbar"><button class="btn ghost" id="skip">Skip ▸</button></div>`);
    if (beginStep(item.hold || 20, 'work', 'skillhold')) say(`${item.name}. Hold.`);
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

/* ---------------- SUPERSET (A1 → A2 with no rest, then one rest, repeat) ----------------
   Modelled on the circuit runner but it logs WEIGHT per round, because on
   machines the load is the whole progression story. Reuses S.ci (which move
   in the pair) and S.round (which time through). */
function supersetRounds(b) { return b.rounds || 3; }
function pairStrip(b) {
  return `<div class="pairstrip">${b.items.map((it, i) => {
    const tgt = it.measure === 'hold' ? `${it.hold}s` : `${it.repsText || it.reps} ${UNIT[it.measure]}`;
    return `<div class="pi ${i === S.ci ? 'active' : ''} ${i < S.ci ? 'done' : ''}">
      <span class="pl">${it.pair || String.fromCharCode(65 + i)}</span>
      <span class="nm">${it.name}</span><span class="tg">${tgt}</span>${rowVid(it)}</div>`;
  }).join('')}</div>`;
}
function renderSuperset() {
  const b = block();
  if (S.ci == null) S.ci = 0;
  const item = b.items[S.ci];
  if (!item) return completeBlock();
  if (S.sub === 'rest') return renderSupersetRest();

  const rounds = supersetRounds(b);
  const dots = Array.from({ length: rounds }, (_, i) =>
    `<div class="r ${i + 1 < S.round ? 'done' : i + 1 === S.round ? 'now' : ''}">${i + 1}</div>`).join('');
  const label = `${item.pair || ''} · round ${S.round} / ${rounds}`;
  const noRestHint = S.ci < b.items.length - 1
    ? `<div class="ss-hint">No rest. Go straight into ${b.items[S.ci + 1].name}</div>`
    : `<div class="ss-hint">Then rest ${b.rest ?? 75} sec</div>`;

  if (item.measure === 'hold') {                       // e.g. chin-up top hold, dip support hold
    const target = item.hold || 20;
    shell(`<div class="rounds">${dots}</div>
      <div class="now-ex"><div class="label">${label}</div><div class="name">${item.name}</div></div>${exActions(item)}
      ${lastTimeLine(item)}
      <div class="timer-wrap">${timerSvg('buffer')}</div>
      ${pairStrip(b)}${noRestHint}<div class="spacer" style="height:86px;"></div>
      <div class="actionbar"><button class="btn ghost" id="skip">Skip ▸</button></div>`);
    const adv = () => { roundBuf[S.ci] = { value: target }; afterSupersetItem(); };
    if (beginStep(target, 'work', 'sshold')) say(`${item.name}. Hold.`);
    onStepDone = adv;
    document.getElementById('skip').addEventListener('click', () => { R.clearStep(S); onStepDone = null; adv(); });
    return;
  }

  const weighted = item.load === 'weighted';
  const base = Number(item.reps) || 0;
  curVal = base;
  /* same rule as the straight-set path: history first, the coach's
     starting weight when there is none */
  const lastW = (item.exId ? (store.getLast(item.exId)?.weight ?? '') : '') || (item.weight ?? '');
  const wField = weighted
    ? `<div class="wfield"><input id="wMain" type="number" inputmode="decimal" placeholder="weight" value="${lastW}" onfocus="this.select()"/><span class="u">${WUNIT}</span></div>` : '';
  const unitLbl = `${UNIT[item.measure]}${item.repsText ? ` · aim ${item.repsText}` : ''}`;
  shell(`<div class="rounds">${dots}</div>
    <div class="now-ex"><div class="label">${label}</div><div class="name">${item.name}</div></div>${exActions(item)}
    ${lastTimeLine(item)}
    <div class="target">${bigEditable(base, unitLbl)}</div>${wField}
    ${pairStrip(b)}${noRestHint}<div class="spacer" style="height:86px;"></div>
    <div class="actionbar"><button class="btn lg" id="done">${S.ci >= b.items.length - 1 ? 'Round done ✓' : 'Next ▸'}</button></div>`);
  wireBig();
  document.querySelectorAll('.big-input, #wMain').forEach(el => el.addEventListener('keydown', e => { if (e.key === 'Enter') el.blur(); }));
  document.getElementById('done').addEventListener('click', () => {
    buzz(40);
    roundBuf[S.ci] = { value: curVal, weight: weighted ? numAt('wMain') : null };
    afterSupersetItem();
  });
}
function afterSupersetItem() {
  const b = block();
  if (S.ci < b.items.length - 1) { S.ci += 1; S.sub = 'work'; R.save(S); return renderSuperset(); }
  endSupersetRound();
}
function endSupersetRound() {
  const b = block();
  b.items.forEach((it, i) => {
    const r = roundBuf[i] || { value: it.hold ?? it.reps ?? 0 };
    const rec = { value: r.value };
    if (r.weight != null && !Number.isNaN(r.weight)) rec.weight = r.weight;
    S.captured[b.id][i].sets.push(rec);
  });
  R.save(S); buzz(60); say(`Round ${S.round} done.`);
  if (S.round < supersetRounds(b)) { S.sub = 'rest'; R.save(S); return renderSupersetRest(); }
  completeBlock();
}
function renderSupersetRest() {
  const b = block(); const rest = b.rest ?? 75;
  const rounds = supersetRounds(b);
  const dots = Array.from({ length: rounds }, (_, i) =>
    `<div class="r ${i + 1 <= S.round ? 'done' : i + 1 === S.round + 1 ? 'now' : ''}">${i + 1 <= S.round ? '✓' : i + 1}</div>`).join('');
  const justDid = b.items.map((it, i) => {
    const last = S.captured[b.id][i].sets.at(-1);
    const v = it.measure === 'hold' ? `${last?.value ?? '–'}s` : `${last?.value ?? '–'} reps`;
    return `<div class="ci"><span class="nm">${it.pair ? it.pair + ' · ' : ''}${it.name}</span><span class="tg">${v}${last?.weight != null ? ` @ ${last.weight} ${WUNIT}` : ''}</span></div>`;
  }).join('');
  shell(`<div class="center"><div class="eyebrow">Round ${S.round} of ${rounds} done · rest</div></div>
    <div class="rounds">${dots}</div>
    <div class="timer-wrap" style="margin:6px 0;">${timerSvg('rest')}</div>
    <div class="circuit-list">${justDid}</div>
    <div class="rir-note">Leave 2–3 reps in the tank. Never to failure.</div>
    <div class="actionbar"><div class="btn-row">
      <button class="btn secondary" id="sub20">−20s</button><button class="btn secondary" id="add20">+20s</button>
      <button class="btn" id="nextRound">Round ${S.round + 1} ▸</button></div></div>`);
  const proceed = () => {
    R.clearStep(S); onStepDone = null;
    S.round += 1; S.ci = 0; roundBuf = S.roundBuf = {}; S.sub = 'work'; R.save(S);
    renderSuperset();
  };
  if (beginStep(rest, 'rest', 'ssrest')) say(`Rest. ${rest} seconds.`);
  onStepDone = proceed;
  document.getElementById('add20').addEventListener('click', () => { S.stepDur += 20; R.save(S); });
  document.getElementById('sub20').addEventListener('click', () => { if (R.stepRemaining(S) > 25) { S.stepDur -= 20; R.save(S); } });
  document.getElementById('nextRound').addEventListener('click', proceed);
}

/* ---------------- CIRCUIT (rounds; hold items auto-TUT; log during inter-round rest) ---------------- */
function renderCircuit() {
  const b = block(); const item = b.items[S.ci || (S.ci = 0)];
  if (S.sub === 'roundrest') return renderRoundRest();
  if (S.sub === 'buffer') return renderBuffer();
  const unit = UNIT[item.measure];
  const dots = Array.from({ length: b.rounds || 1 }, (_, i) => `<div class="r ${i + 1 < S.round ? 'done' : i + 1 === S.round ? 'now' : ''}">${i + 1}</div>`).join('');
  const ps = it => (it.laterality === 'unilateral' || it.perSide) && !it.side ? ' /side' : '';
  const list = b.items.map((it, i) => `<div class="ci ${i === S.ci ? 'active' : ''}">${rowVid(it)}<span class="nm">${it.name}${it.side ? ' ' + it.side : ''}</span><span class="tg">${it.measure === 'hold' ? it.hold + 's' : (it.reps ?? it.target) + ' ' + UNIT[it.measure] + ps(it)}</span></div>`).join('');
  const uniNote = (item.laterality === 'unilateral' || item.perSide) && !item.side ? ' · per side' : '';

  if (item.measure === 'hold') {
    shell(`<div class="rounds">${dots}</div><div class="now-ex"><div class="label">Round ${S.round} / ${b.rounds}</div><div class="name">${item.name}${item.side ? ' ' + item.side : ''}</div></div>${exActions(item)}
      <div class="timer-wrap">${timerSvg('buffer')}</div><div class="circuit-list">${list}</div>
      <div class="actionbar"><button class="btn ghost" id="skip">Skip ▸</button></div>`);
    if (beginStep(item.hold || 30, 'work', 'chold')) say(`${item.name}. Go.`);
    const adv = () => { roundBuf[S.ci] = item.hold; afterCircuitItem(); };
    onStepDone = adv;
    document.getElementById('skip').addEventListener('click', () => { R.clearStep(S); onStepDone = null; adv(); });
  } else {
    curVal = Number(roundBuf[S.ci] ?? item.reps ?? item.target) || 0;
    shell(`<div class="rounds">${dots}</div><div class="now-ex"><div class="label">Round ${S.round} / ${b.rounds}</div><div class="name">${item.name}</div></div>${exActions(item)}
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
  if (beginStep(t, 'rest', 'buffer')) say(`Next. ${next.name}.`);
  onStepDone = () => { S.sub = 'work'; R.save(S); renderCircuit(); };
  document.getElementById('go').addEventListener('click', () => { R.clearStep(S); onStepDone = null; S.sub = 'work'; R.save(S); renderCircuit(); });
}
function afterCircuitItem() {
  const b = block();
  if (S.ci < b.items.length - 1) {
    S.ci += 1;
    const nextItem = b.items[S.ci];
    // Set-up buffer (never a rest). A block with transition>0 (the warm-up) gets
    // the buffer before EVERY exercise so it flows continuously with just a short
    // "get into position" countdown. Otherwise it appears only before a hold.
    const useBuffer = Number(b.transition) > 0 || !!(nextItem && nextItem.measure === 'hold');
    S.sub = useBuffer ? 'buffer' : 'work'; R.save(S);
    return useBuffer ? renderBuffer() : renderCircuit();
  }
  endRound();
}
function endRound() {
  const b = block();
  b.items.forEach((it, i) => S.captured[b.id][i].sets.push({ value: roundBuf[i] ?? (it.hold ?? it.reps ?? it.target) }));
  R.save(S); buzz(60); say(`Round ${S.round} done.`);
  if (S.round < (b.rounds || 1)) {
    if ((b.roundRest ?? 30) > 0) { S.sub = 'roundrest'; R.save(S); renderRoundRest(); }
    else { S.round += 1; S.ci = 0; roundBuf = S.roundBuf = {}; S.sub = 'work'; R.save(S); renderCircuit(); }
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
    <div class="actionbar"><button class="btn lg" id="nextRound">Start round ${S.round + 1} ▸</button></div>`, { progress: false });
  const proceed = () => {
    b.items.forEach((it, i) => { const v = readInput(`rr_${i}`); if (v != null) S.captured[b.id][i].sets[S.captured[b.id][i].sets.length - 1].value = v; });
    R.clearStep(S); onStepDone = null; S.round += 1; S.ci = 0; roundBuf = S.roundBuf = {}; S.sub = 'work'; R.save(S); renderCircuit();
  };
  beginStep(rest, 'rest', 'roundrest'); onStepDone = proceed;
  document.getElementById('nextRound').addEventListener('click', proceed);
}

/* ---------------- AMRAP (count-up window; tap rounds) ---------------- */
function renderAmrap() {
  const b = block(); const mins = b.minutes || 5;
  const single = b.items.length === 1 && !b.countRounds;   // single-exercise max-out → log reps, not rounds
  if (beginStep(mins * 60, 'work', 'amrap')) { say(single ? `Max reps. ${mins} minutes. Go.` : `As many rounds as possible. ${mins} minutes. Go.`); }
  const finish = () => {
    R.clearStep(S); onStepDone = null;
    if (single) { S.captured[b.id][0].sets = [{ value: curVal }]; R.save(S); }
    else captureRounds(S.amrapRounds);
    completeBlock();
  };
  onStepDone = finish;

  if (single) {
    const it = b.items[0];
    if (S.amrapReps == null) S.amrapReps = 0;
    curVal = S.amrapReps;
    shell(`<div class="now-ex"><div class="label">Max reps · ${mins} min</div><div class="name">${it.name}</div></div>${exActions(it)}
      <div class="timer-wrap">${timerSvg('buffer')}</div>
      <div class="target">${bigEditable(curVal, `${UNIT[it.measure] || 'reps'} · tap to log your total`)}</div>
      <div class="actionbar"><button class="btn lg" id="endAmrap">Done ▸</button></div>`);
    wireBig();
    document.getElementById('bigVal')?.addEventListener('input', () => { S.amrapReps = curVal; R.save(S); });
    document.getElementById('endAmrap').addEventListener('click', () => { S.amrapReps = curVal; finish(); });
    return;
  }

  if (!S.amrapRounds) S.amrapRounds = 0;
  const list = b.items.map(it => `<div class="ci">${rowVid(it)}<span class="nm">${it.name}</span><span class="tg">${it.measure === 'hold' ? it.hold + 's' : (it.reps ?? it.target ?? 'max') + (it.reps ? ' reps' : '')}</span></div>`).join('');
  shell(`<div class="now-ex"><div class="label">AMRAP · ${mins} min</div><div class="name">As many rounds as possible</div></div>${exActions(b.items[0])}
    <div class="timer-wrap">${timerSvg('buffer')}</div>
    <div class="center" style="margin:4px 0 12px;"><span class="eyebrow">Rounds</span> <span class="big" style="font-size:40px;" id="amrapN">${S.amrapRounds}</span></div>
    ${b.hideList ? '' : `<div class="circuit-list">${list}</div>`}
    <div class="actionbar"><div class="btn-row"><button class="btn secondary" id="rdMinus">−</button><button class="btn" id="rdPlus">+ Round</button><button class="btn ghost" id="endAmrap">End ▸</button></div></div>`);
  document.getElementById('rdPlus').addEventListener('click', () => { S.amrapRounds++; R.save(S); document.getElementById('amrapN').textContent = S.amrapRounds; buzz(30); });
  document.getElementById('rdMinus').addEventListener('click', () => { S.amrapRounds = Math.max(0, S.amrapRounds - 1); R.save(S); document.getElementById('amrapN').textContent = S.amrapRounds; });
  document.getElementById('endAmrap').addEventListener('click', finish);
}

/* ---------------- INTERVAL (tabata / emom): work/rest cycling items ---------------- */
/* `b.intervals`, when set, is the exact number of intervals (the Quick Timer
   writes "12 minutes of EMOM" this way, whatever the number of moves).
   Without it, a program block runs `rounds` passes through its moves. */
function intervalTotal(b) { return b.intervals || (b.rounds || 8) * (b.items.length || 1); }
function renderInterval() {
  const b = block();
  const work = b.work || (b.format === 'emom' ? 60 : 20);
  const rest = b.rest ?? (b.format === 'emom' ? 0 : 10);
  const rounds = b.rounds || 8;
  const per = b.items.length || 1;
  if (S.iv == null) { S.iv = 0; S.ivPhase = 'work'; R.save(S); }   // iv = interval index across rounds×items
  const totalIv = intervalTotal(b);
  if (S.iv >= totalIv) { captureRounds(b.intervals || rounds); return completeBlock(); }
  const item = b.items[S.iv % per];
  const roundN = Math.floor(S.iv / per) + 1;
  const phaseWork = S.ivPhase === 'work';
  const kind = b.label || (b.format === 'emom' ? 'EMOM' : 'Tabata');
  const counter = b.intervals ? (totalIv > 1 ? ` · ${S.iv + 1}/${totalIv}` : '') : ` · round ${roundN}/${rounds}`;
  /* what the minute asks for, and what comes after it: an EMOM you can't
     read the reps off is only a clock */
  const target = phaseWork && item.reps ? `<div class="side">${item.reps} ${UNIT[item.measure] || 'reps'}</div>` : '';
  const nextItem = S.iv + 1 < totalIv ? b.items[(S.iv + 1) % per] : null;
  const upNext = per > 1 && nextItem ? `<div class="ss-hint">Next: ${nextItem.name}${nextItem.reps ? ` · ${nextItem.reps}` : ''}</div>` : '';
  shell(`<div class="now-ex"><div class="label">${kind}${counter}</div>
      <div class="name">${phaseWork ? item.name : 'Rest'}</div>${target}</div>
    ${phaseWork ? exActions(item) : ''}
    <div class="timer-wrap">${timerSvg(phaseWork ? 'buffer' : 'rest')}</div>
    ${upNext}
    <div class="actionbar"><button class="btn ghost" id="skip">Skip ▸</button></div>`);
  const dur = phaseWork ? work : rest;
  if (dur <= 0) return nextInterval();
  if (beginStep(dur, phaseWork ? 'work' : 'rest', 'iv') && phaseWork) say(item.name);
  onStepDone = nextInterval;
  document.getElementById('skip').addEventListener('click', () => { R.clearStep(S); onStepDone = null; nextInterval(); });
}
function nextInterval() {
  const b = block();
  /* no rest after the LAST interval: 10 seconds of nothing before "done" */
  const last = S.iv >= intervalTotal(b) - 1;
  if (S.ivPhase === 'work' && !last && (b.rest ?? (b.format === 'emom' ? 0 : 10)) > 0) { S.ivPhase = 'rest'; R.save(S); return renderInterval(); }
  S.ivPhase = 'work'; S.iv += 1; R.save(S);
  renderInterval();
}

/* ---------------- FOR TIME / STOPWATCH (count up, tap when done) ----------------
   `minutes` is the cap; none means it runs until you stop it. Tapping the
   ring pauses it, which makes it a stopwatch too. */
const NO_CAP = 99 * 60;
function renderForTime() {
  const b = block();
  const cap = (Number(b.minutes) || 0) * 60;
  const dur = cap || NO_CAP;
  const list = b.hideList ? '' : `<div class="circuit-list">${b.items.map(it => `<div class="ci">${rowVid(it)}<span class="nm">${it.name}</span><span class="tg">${it.reps ? it.reps + ' ' + (UNIT[it.measure] || 'reps') : ''}</span></div>`).join('')}</div>`;
  const rounds = b.rounds > 1 ? `${b.rounds} rounds · ` : '';
  shell(`<div class="now-ex"><div class="label">${rounds}${cap ? `cap ${fmt(cap)}` : b.hideList ? 'tap the ring to pause' : 'no cap'}</div>
      <div class="name">${b.hideList ? (b.label || 'Go') : 'For time'}</div></div>
    <div class="timer-wrap">${timerSvg('buffer')}</div>
    ${list}
    <div class="actionbar"><button class="btn lg" id="ftDone">Done ✓</button></div>`);
  const finish = secs => {
    R.clearStep(S); onStepDone = null;
    (S.captured[b.id] || []).forEach(e => { e.sets = [{ value: secs }]; e.unit = 'sec'; e.rounds = true; });
    R.save(S); say(`Done in ${Math.floor(secs / 60)} minutes ${secs % 60} seconds.`);
    completeBlock();
  };
  if (beginStep(dur, cap ? 'work' : 'rest', 'fortime')) say('Go.');
  onStepDone = () => finish(dur);
  document.getElementById('ftDone').addEventListener('click', () => { buzz(40); finish(dur - (R.stepRemaining(S) ?? 0)); });
}

/* ---------------- BENCHMARK / MAX TEST ---------------- */
function renderBenchmark() {
  const b = block(); const item = b.items[0]; const unit = UNIT[item.measure];
  shell(`<div class="center"><div class="eyebrow">Benchmark</div><div class="now-ex"><div class="name">${item.name}</div></div>
    <p class="muted" style="margin:0 0 16px;">One all-out set. It sets your benchmark.</p></div>
    <div class="card logcard">${logRow(item, 'bench', '')}</div>
    <div class="actionbar"><button class="btn lg" id="saveBench">Log my max ✓</button></div>`, { progress: false });
  document.getElementById('saveBench').addEventListener('click', () => {
    S.captured[b.id][0].sets = [{ value: readInput('bench') }]; R.save(S); completeBlock();
  });
}

/* ---------------- log card + summary ---------------- */
function renderLog() {
  const b = block(); const entries = S.captured[b.id];
  onScreen('log');
  // grouped: exercise name once, its sets underneath (no repeated names)
  const word = (b.format === 'circuit' || b.format === 'superset' || entries.some(e => e.rounds)) ? 'Round' : 'Set';
  const groups = entries.map((e, ei) => {
    const sets = e.sets.length ? e.sets : [{ value: null }];
    const rows = sets.map((st, si) => {
      const lbl = st.side ? st.side : (sets.length > 1 ? `${word} ${si + 1}` : word);
      return `<div class="logset"><span class="sn">${lbl}</span>${cellInputs({ measure: e.measure, load: e.load }, `b${ei}_${si}`, st.value, st.weight, e.exId)}</div>`;
    }).join('');
    return `<div class="loggroup"><div class="gname">${e.name}</div>${rows}</div>`;
  }).join('');
  shell(`<div class="center"><div class="eyebrow">${b.role}</div><h2 style="font-size:22px;margin:8px 0 4px;">Log · ${b.name}</h2>
      <p class="muted" style="margin:0 0 14px;">Tweak then confirm.</p></div>
    <div class="card logcard">${groups}</div>
    <div class="actionbar"><button class="btn lg" id="confirm">${isLastBlock() ? 'Finish workout ✓' : 'Confirm ▸'}</button></div>`, { progress: false });
  document.getElementById('confirm').addEventListener('click', () => {
    entries.forEach((e, ei) => {
      const sets = e.sets.length ? e.sets : [{}];
      sets.forEach((st, si) => { st.value = readInput(`b${ei}_${si}`); const w = document.getElementById(`w_b${ei}_${si}`); if (w && w.value !== '') st.weight = Number(w.value); });
      e.sets = sets;
    });
    R.save(S); sectionNext();
  });
}
function renderSummary() {
  const b = block();
  onScreen('summary');
  const rows = S.captured[b.id].map(e => `<div class="row"><span class="nm">${e.name}</span><span class="tg">${e.sets.map(s => s.value ?? '–').join(' · ')} ${e.unit}</span></div>`).join('');
  shell(`<div class="center"><div class="eyebrow">${b.role}</div><h2 style="font-size:22px;margin:8px 0 4px;">${b.name} done</h2></div>
    <div class="card logcard">${rows || '<div class="muted">Logged.</div>'}</div>
    <div class="actionbar"><button class="btn lg" id="confirm">${isLastBlock() ? 'Finish workout ✓' : 'Confirm ▸'}</button></div>`, { progress: false });
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
  const prev = all.slice(0, -1).filter(s => s.name === session.name && s.seconds && !s.partial);   // prior runs of THIS workout; an ended-early run is no pace to beat
  const clean = n => (n || '').replace(/[—·].*$/, '').trim();
  const out = [];
  if (!prev.length) {
    if (session.seconds > 0) out.push({ icon: '📌', text: `Baseline set: ${fmt(session.seconds)} for ${session.name}. Beat it next time.` });
    return out;
  }
  const bestPrev = Math.min(...prev.map(s => s.seconds));
  if (session.seconds > 0 && session.seconds <= bestPrev) {
    out.push({ icon: '🏆', text: `Most efficient ${session.name} yet: ${fmt(session.seconds)} (was ${fmt(bestPrev)}). Tight work.` });
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
  if (bestImp) out.push({ icon: '⚡', text: `Fastest ${bestImp.name} block yet: ${fmt(bestImp.t)}.` });
  if (!out.length && session.seconds > 0) out.push({ icon: '⏱', text: `${fmt(session.seconds)} today · best is ${fmt(bestPrev)}. Chase it next time.` });
  return out.slice(0, 2);
}
/* ---- end-of-session feedback (coachMode plans only) ----
   Three taps and an optional box. Deliberately the last thing between
   him and "done", so it actually gets answered. */
function renderFeedback(next) {
  const flagged = store.flagsSince(new Date().setHours(0, 0, 0, 0));
  host.innerHTML = `
    <div class="screen fade-in bgn">
      <div class="center"><div class="big-emoji">💬</div>
        <h1 style="font-size:24px;margin:4px 0 2px;">How did that feel?</h1>
        <p class="muted" style="margin:0 0 16px;">One tap. It goes straight to your coach.</p></div>
      <div class="fb-grid">
        <button class="fb" data-r="easy"><span class="e">🙂</span><span>Easy</span></button>
        <button class="fb" data-r="right"><span class="e">💪</span><span>About right</span></button>
        <button class="fb" data-r="hard"><span class="e">🥵</span><span>Too hard</span></button>
      </div>
      <textarea id="fbTxt" class="note-input" rows="3" placeholder="Anything else? (optional)"></textarea>
      ${flagged.length ? `<div class="callout warn"><span class="ico">🦵</span><span class="txt">Knee flagged today: <b>${flagged.map(f => f.name).join(', ')}</b></span></div>` : ''}
      <div class="actionbar"><button class="btn lg" id="fbDone">Done ✓</button></div>
    </div>`;
  let rating = null;
  host.querySelectorAll('.fb').forEach(el => el.addEventListener('click', () => {
    rating = el.dataset.r; buzz(30);
    host.querySelectorAll('.fb').forEach(x => x.classList.toggle('on', x === el));
  }));
  host.querySelector('#fbDone').addEventListener('click', () => {
    const text = host.querySelector('#fbTxt').value.trim();
    if (rating || text) store.addFeedback({ sessionId: S.plan.sessionId, name: S.plan.name, rating, text });
    next();
  });
}

/* the one number a Quick Timer produced, per block: rounds, reps or time */
function quickResult(session) {
  const rows = session.blocks.map(b => {
    const e = b.entries[0]; const v = e?.sets?.[0]?.value;
    if (v == null || b.name.startsWith('Countdown')) return '';
    const val = b.format === 'fortime' ? fmt(v)
      : b.format === 'amrap' ? `${v} ${e.unit || 'rounds'}`
      : `${v} interval${v === 1 ? '' : 's'}`;
    return `<div class="eff-row"><span>${b.name}</span><span class="pr-flash" style="margin-left:auto;">${val}</span></div>`;
  }).join('');
  return rows ? `<div class="card"><div class="eyebrow">Result</div>${rows}</div>` : '';
}
function finishSession(opts = {}) {
  const partial = !!opts.partial;
  if (!partial && S?.plan?.coachMode && !S.feedbackDone) {
    // freeze the clock first — answering the prompt must not inflate the session time
    S.finishElapsed = R.sessionElapsed(S);
    S.feedbackDone = true; S.screen = 'feedback'; R.save(S);
    stopTicker(); releaseAwake();
    return renderFeedback(finishSession);
  }
  stopTicker(); releaseAwake(); stopAudio();
  const elapsed = S.finishElapsed != null ? S.finishElapsed : R.sessionElapsed(S);
  /* the block you were in when you stopped has no finish time yet */
  const cur = block();
  if (partial && cur && S.blockStart && !S.blockTimes[cur.id]) S.blockTimes[cur.id] = Math.max(0, Math.round((Date.now() - S.blockStart) / 1000));
  /* an ended-early session keeps only what was actually done: sets with a
     number in them, and the blocks that have any */
  const entriesOf = b => (S.captured[b.id] || [])
    .map(e => partial ? { ...e, sets: (e.sets || []).filter(s => s.value != null && s.value !== '') } : e)
    .filter(e => !partial || e.sets.length)
    /* a typed-in move ("Burpees") has no library id: history keeps it, but it
       is not a movement a record or a "last time" can hang off */
    .map(e => e.exId ? e : { ...e, rounds: true });
  const session = {
    date: new Date().toISOString(), name: S.plan.name, sessionId: S.plan.sessionId,
    duration: S.plan.duration, seconds: elapsed,
    ...(partial ? { partial: true } : {}),
    blocks: S.plan.blocks.map(b => ({ id: b.id, type: b.role, name: b.name, format: b.format, seconds: S.blockTimes[b.id] || 0, entries: entriesOf(b) }))
      .filter(b => !partial || b.entries.length),
  };
  /* a Work Mode preview run (js/runner/demo.js) is a look, not training */
  const { prs } = S.plan.demo ? { prs: [] } : store.saveSession(session);
  const effs = (partial || S.plan.quick) ? [] : efficiencyCallouts(session);
  const resultHtml = S.plan.quick ? quickResult(session) : '';
  R.clear();
  const prText = p => p.weight != null
    ? ((p.l != null || p.r != null) ? `${p.weight}lb · L${p.l ?? '–'} · R${p.r ?? '–'}` : `${p.weight}lb × ${p.value}`)
    : `${p.value} ${p.unit}`;
  if (prs.length) say(`New record. ${prText(prs[0])}.`);
  else if (partial) say('Saved.');
  else if (effs[0]?.icon === '🏆') say('Most efficient session yet. Great work.');
  else say('Workout complete. Strong work.');
  const prHtml = prs.length ? `<div class="card"><div class="eyebrow">New PRs</div>${prs.map(p => `<div class="row" style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--line);"><span>${p.name}</span><span class="pr-flash">${prText(p)}</span></div>`).join('')}</div>` : '';
  const effHtml = effs.length ? `<div class="card"><div class="eyebrow">Pace</div>${effs.map(e => `<div class="eff-row"><span class="eff-ico">${e.icon}</span><span>${e.text}</span></div>`).join('')}</div>` : '';
  host.innerHTML = `<div class="screen fade-in center ${S.plan.coachMode ? 'bgn' : ''}">
    <div class="big-emoji">${prs.length ? '🏆' : '✅'}</div>
    <h1 style="font-size:28px;">${prs.length ? 'New records!' : partial ? 'Saved.' : 'Done.'}</h1>
    <p class="muted">${S.plan.name} · ${fmt(elapsed)}${partial ? ' · ended early' : S.plan.quick ? '' : ` · ${S.plan.duration} min plan`}</p>
    <div style="height:16px;"></div>${resultHtml}${prHtml}${effHtml}
    <div class="actionbar"><button class="btn lg" id="home">${S.plan.finishLabel || 'Back to week'}</button></div></div>`;
  document.getElementById('home').addEventListener('click', () => { clearWorkTheme(); cb.onFinish?.(); });
}
