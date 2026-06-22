/* ============================================================
   LAYER 3 — THE RUNNER (Working Mode)
   ONE state machine. Reads block.format + exercise flags and
   renders the right experience. Formats: jointprep | straight |
   circuit | benchmark.

   Logging rules (from feedback):
   - Straight: adjust reps inline on the set screen, then "Set done".
   - Circuit: tap through (adjust inline), round done -> rest timer
     runs WHILE you confirm the round, then next round.
   - Section screen between blocks; peek the full day without ending.
   ============================================================ */
import { store } from './store.js';
import { countdown, intervalClock, say, beep, buzz, fmt, keepAwake, releaseAwake, initAudio } from './timer.js';

const UNIT = { reps: 'reps', hold: 'sec', cals: 'cals' };

let S = null, host = null, cb = {}, activeTimer = null;

export function startRunner(session, callbacks = {}) {
  S = { session, bi: 0, captured: {}, ii: 0, si: 0, round: 1, ci: 0, sub: 'work', curVal: 0, roundBuf: {} };
  host = document.getElementById('app');
  cb = callbacks;
  initAudio(); keepAwake();
  enterBlock();
}

function stopTimer() {
  if (activeTimer) { activeTimer.stop(); activeTimer = null; }
  if (S && S.cueTimer) { clearInterval(S.cueTimer); S.cueTimer = null; }
}
function block() { return S.session.blocks[S.bi]; }
const isLastBlock = () => S.bi >= S.session.blocks.length - 1;

function buildEntries(b) {
  if (b.format === 'jointprep') { S.captured[b.id] = null; return; }
  S.captured[b.id] = b.items.map(it => ({
    exId: it.exId, name: it.name, measure: it.measure, unit: UNIT[it.measure],
    load: it.load, noPR: it.noPR,
    sets: b.format === 'circuit' ? []
        : (it.sets || []).map(s => ({ value: s.target === 'MAX' ? null : s.target })),
  }));
}

/* ---------- block lifecycle ---------- */
function enterBlock() {
  stopTimer();
  S.ii = 0; S.si = 0; S.round = 1; S.ci = 0; S.sub = 'work'; S.roundBuf = {};
  const b = block();
  if (!S.captured[b.id] && b.format !== 'jointprep') buildEntries(b);
  else if (b.format === 'jointprep') buildEntries(b);
  beep('go'); say(b.name);
  renderActive();
}
function renderActive() {
  const b = block();
  if (b.format === 'jointprep') return renderJointPrep();
  if (b.format === 'circuit')   return renderCircuit();
  if (b.format === 'benchmark') return renderBenchmark();
  return renderStraight();
}

/* completion routing per block type */
function completeBlock() {
  stopTimer();
  const b = block();
  if (b.format === 'jointprep') return sectionNext();
  if (b.type === 'Mobility')    return sectionNext();      // noPR — no log card
  if (b.format === 'circuit')   return renderCircuitSummary();
  return renderBlockLog();                                  // straight work
}
function sectionNext() {
  stopTimer();
  if (isLastBlock()) return finishSession();
  const next = S.session.blocks[S.bi + 1];
  host.innerHTML = `
    <div class="screen fade-in center">
      <div class="big-emoji">✓</div>
      <h2 style="margin:4px 0;">${block().name} done</h2>
      <p class="muted">Up next</p>
      <div class="card" style="margin-top:10px;">
        <div class="eyebrow">${next.type}${next.minutes ? ` · ${next.minutes} min` : ''}</div>
        <h3 style="margin:6px 0 0;">${next.name}</h3>
      </div>
      <div class="actionbar">
        <div class="btn-row">
          <button class="btn ghost" id="peekBtn">View day</button>
          <button class="btn" id="goNext">Start ▸</button>
        </div>
      </div>
    </div>`;
  document.getElementById('goNext').addEventListener('click', () => { S.bi += 1; enterBlock(); });
  document.getElementById('peekBtn').addEventListener('click', showDayPeek);
}

/* ---------- shell + header ---------- */
function shell(inner, { progress = true } = {}) {
  const b = block();
  const segs = S.session.blocks.map((bl, i) =>
    `<div class="seg ${i < S.bi ? 'done' : i === S.bi ? 'now' : ''}"></div>`).join('');
  host.innerHTML = `
    <div class="screen run fade-in">
      <div class="run-head">
        <div class="blk">${b.type} · ${b.name}</div>
        <div style="display:flex;gap:6px;">
          <button class="x" id="dayBtn" title="View day">☰</button>
          <button class="x" id="exitBtn">✕</button>
        </div>
      </div>
      ${progress ? `<div class="progress">${segs}</div>` : ''}
      ${inner}
    </div>`;
  document.getElementById('exitBtn')?.addEventListener('click', confirmExit);
  document.getElementById('dayBtn')?.addEventListener('click', showDayPeek);
}
function confirmExit() {
  if (confirm('End this workout? Unsaved blocks are lost.')) { stopTimer(); releaseAwake(); cb.onExit?.(); }
}

/* mid-workout peek — overlay, leaves the live screen + timer running underneath */
function showDayPeek() {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `
    <div class="overlay-card">
      <div class="eyebrow">${S.session.name} · ${S.session.duration} min</div>
      <h2 style="margin:6px 0 14px;">Today's day</h2>
      ${S.session.blocks.map((bl, i) => `
        <div class="day-row ${i === S.bi ? 'now' : i < S.bi ? 'done' : ''}">
          <span>${i < S.bi ? '✓' : i === S.bi ? '▸' : '·'} ${bl.type}</span>
          <span class="muted">${bl.name}</span>
        </div>`).join('')}
      <button class="btn" id="resumeBtn" style="margin-top:16px;">Resume ▸</button>
    </div>`;
  host.appendChild(ov);
  ov.querySelector('#resumeBtn').addEventListener('click', () => ov.remove());
}

/* ---------- circular timer fragment ---------- */
function timerSvg(cls) {
  const r = 110, c = 2 * Math.PI * r;
  return `<div class="timer ${cls}" id="timerEl"><svg viewBox="0 0 240 240">
      <circle class="track" cx="120" cy="120" r="${r}"></circle>
      <circle class="fill" id="timerFill" cx="120" cy="120" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="0"></circle>
    </svg><div class="read"><div class="t" id="timerText">0:00</div><div class="cap" id="timerCap"></div></div></div>`;
}
function updateTimerUI(rem, total, cap) {
  const r = 110, c = 2 * Math.PI * r;
  const fill = document.getElementById('timerFill'), txt = document.getElementById('timerText'), ce = document.getElementById('timerCap');
  if (txt) txt.textContent = fmt(rem);
  if (ce && cap != null) ce.textContent = cap;
  if (fill) fill.style.strokeDashoffset = String(c * (1 - (total > 0 ? rem / total : 0)));
}

/* ---------- big editable number (reps) ---------- */
function bigEditable(val, unit) {
  return `<div class="big-edit">
      <button class="rnd" id="decBig">−</button>
      <div><div class="big" id="bigVal">${val}</div><div class="unit">${unit}</div></div>
      <button class="rnd" id="incBig">+</button>
    </div>`;
}
function wireBig() {
  const upd = () => { const e = document.getElementById('bigVal'); if (e) e.textContent = S.curVal; };
  document.getElementById('decBig')?.addEventListener('click', () => { S.curVal = Math.max(0, S.curVal - 1); upd(); buzz(15); });
  document.getElementById('incBig')?.addEventListener('click', () => { S.curVal += 1; upd(); buzz(15); });
}

/* ============================================================
   JOINT PREP — free-flow interval timer
   ============================================================ */
function renderJointPrep() {
  const b = block();
  let cueIdx = 0;
  const total = (b.minutes || 3) * 60;
  let interval = b.interval || 30;
  shell(`
    <div class="now-ex"><div class="label">Flow — switch every ${interval}s</div>
      <div class="name" id="jpCue">${b.cues[0]}</div></div>
    <div class="timer-wrap">${timerSvg('buffer')}</div>
    <div class="dur-grid" id="ivGrid" style="margin-top:6px;">
      ${[10, 20, 30, 60].map(n => `<div class="dur ${n === interval ? 'on' : ''}" data-iv="${n}"><div class="m">${n}</div><div class="x">sec</div></div>`).join('')}
    </div>
    <div class="actionbar"><button class="btn" id="jpDone">Done ▸</button></div>
  `);
  stopTimer();
  const start = (iv) => {
    stopTimer();
    activeTimer = intervalClock({
      totalSeconds: total, interval: iv,
      onTick: (rem, since) => updateTimerUI(rem, total, 'flow'),
      onDone: () => completeBlock(),
    });
    // advance cue on each switch by polling sinceSwitch via wrapper:
  };
  // cue rotation: re-point say('Switch') moments by listening on interval through a second ticker
  start(interval);
  // rotate cue label every `interval` seconds (tracked on S so stopTimer clears it)
  let sec = 0;
  if (S.cueTimer) clearInterval(S.cueTimer);
  S.cueTimer = setInterval(() => {
    sec++; if (sec % interval === 0) { cueIdx = (cueIdx + 1) % b.cues.length; const el = document.getElementById('jpCue'); if (el) el.textContent = b.cues[cueIdx]; }
  }, 1000);
  document.querySelectorAll('#ivGrid .dur').forEach(d => d.addEventListener('click', () => {
    interval = Number(d.dataset.iv); sec = 0;
    document.querySelectorAll('#ivGrid .dur').forEach(x => x.classList.remove('on')); d.classList.add('on');
    document.querySelector('.label').textContent = `Flow — switch every ${interval}s`;
    start(interval);
  }));
  document.getElementById('jpDone').addEventListener('click', () => completeBlock());
}

/* ============================================================
   STRAIGHT SETS — inline rep adjust, capture as you go
   ============================================================ */
function renderStraight() {
  const b = block();
  const item = b.items[S.ii];
  const unit = UNIT[item.measure];
  const setNo = S.si + 1, setTotal = item.sets.length;

  if (S.sub === 'rest') return; // handled by renderRest flow

  if (item.measure === 'hold') {
    const target = item.sets[S.si].target;
    shell(`
      <div class="now-ex"><div class="label">Set ${setNo} / ${setTotal}</div><div class="name">${item.name}</div></div>
      <div class="timer-wrap">${timerSvg('buffer')}</div>
      <div class="actionbar"><button class="btn ghost" id="skipBtn">Skip timer ▸</button></div>
    `);
    document.getElementById('skipBtn')?.addEventListener('click', () => { stopTimer(); captureStraight(target); afterSet(); });
    stopTimer();
    activeTimer = countdown({ seconds: Number(target) || 25, kind: 'hold',
      onTick: (rem) => updateTimerUI(rem, Number(target) || 25, 'hold'),
      onDone: () => { captureStraight(target); afterSet(); } });
  } else {
    S.curVal = Number(item.sets[S.si].value ?? item.sets[S.si].target) || 0;
    shell(`
      <div class="now-ex"><div class="label">Set ${setNo} / ${setTotal}${weightHint(item)}</div><div class="name">${item.name}</div></div>
      <div class="target">${bigEditable(S.curVal, `${unit} · tap ± to adjust`)}</div>
      <div class="actionbar"><button class="btn lg" id="doneBtn">Set done ✓</button></div>
    `);
    wireBig();
    document.getElementById('doneBtn')?.addEventListener('click', () => { buzz(40); captureStraight(S.curVal); afterSet(); });
  }
}
function weightHint(item) { return item.load === 'weighted' ? ' · add weight in log' : ''; }
function captureStraight(val) { S.captured[block().id][S.ii].sets[S.si].value = val; }

function afterSet() {
  const b = block(); const item = b.items[S.ii];
  let nextRest;
  if (S.si < item.sets.length - 1) { S.si += 1; nextRest = item.rest; }
  else if (S.ii < b.items.length - 1) { nextRest = item.rest; S.ii += 1; S.si = 0; }
  else return completeBlock();
  renderRest(nextRest);
}
function renderRest(sec) {
  sec = Number(sec) || 0;
  if (sec <= 0) { S.sub = 'work'; return renderStraight(); }
  S.sub = 'rest';
  shell(`
    <div class="now-ex"><div class="label">Rest</div><div class="name">Recover</div></div>
    <div class="timer-wrap">${timerSvg('rest')}</div>
    <div class="actionbar"><div class="btn-row">
      <button class="btn secondary" id="sub20">−20s</button>
      <button class="btn secondary" id="add20">+20s</button>
      <button class="btn" id="skipRest">Skip ▸</button>
    </div></div>
  `);
  stopTimer();
  activeTimer = countdown({ seconds: sec, kind: 'rest',
    onTick: (rem) => updateTimerUI(rem, sec, 'rest'),
    onDone: () => { S.sub = 'work'; renderStraight(); } });
  document.getElementById('add20').addEventListener('click', () => activeTimer?.addTime(20));
  document.getElementById('sub20').addEventListener('click', () => { if (activeTimer && activeTimer.remaining() > 25) activeTimer.addTime(-20); });
  document.getElementById('skipRest').addEventListener('click', () => { stopTimer(); S.sub = 'work'; renderStraight(); });
}

/* ============================================================
   CIRCUIT — tap through, log during inter-round rest
   ============================================================ */
function renderCircuit() {
  const b = block();
  const item = b.items[S.ci];
  const unit = UNIT[item.measure];
  if (S.sub === 'buffer') return renderBuffer();
  if (S.sub === 'roundrest') return renderRoundRest();

  const list = b.items.map((it, i) =>
    `<div class="ci ${i === S.ci ? 'active' : ''}"><span class="nm">${it.name}</span><span class="tg">${it.target} ${UNIT[it.measure]}</span></div>`).join('');
  const dots = Array.from({ length: b.rounds }, (_, i) =>
    `<div class="r ${i + 1 < S.round ? 'done' : i + 1 === S.round ? 'now' : ''}">${i + 1}</div>`).join('');

  if (item.measure === 'hold') {
    shell(`
      <div class="rounds">${dots}</div>
      <div class="now-ex"><div class="label">Round ${S.round} / ${b.rounds}</div><div class="name">${item.name}</div></div>
      <div class="timer-wrap">${timerSvg('buffer')}</div>
      <div class="circuit-list">${list}</div>
      <div class="actionbar"><button class="btn ghost" id="skipBtn">Skip ▸</button></div>
    `);
    document.getElementById('skipBtn')?.addEventListener('click', () => { stopTimer(); S.roundBuf[S.ci] = item.target; afterCircuitItem(); });
    stopTimer();
    activeTimer = countdown({ seconds: Number(item.target) || 30, kind: 'hold',
      onTick: (rem) => updateTimerUI(rem, Number(item.target) || 30, 'TUT'),
      onDone: () => { S.roundBuf[S.ci] = item.target; afterCircuitItem(); } });
  } else {
    S.curVal = Number(S.roundBuf[S.ci] ?? item.target) || 0;
    shell(`
      <div class="rounds">${dots}</div>
      <div class="now-ex"><div class="label">Round ${S.round} / ${b.rounds}</div><div class="name">${item.name}</div></div>
      <div class="target">${bigEditable(S.curVal, unit)}</div>
      <div class="circuit-list">${list}</div>
      <div class="actionbar"><button class="btn lg" id="nextBtn">${S.ci >= b.items.length - 1 ? 'Round done ✓' : 'Next ▸'}</button></div>
    `);
    wireBig();
    document.getElementById('nextBtn')?.addEventListener('click', () => { buzz(40); S.roundBuf[S.ci] = S.curVal; afterCircuitItem(); });
  }
}
function renderBuffer() {
  const b = block(); const next = b.items[S.ci];
  shell(`
    <div class="now-ex"><div class="label">Get ready</div><div class="name">${next.name}</div></div>
    <div class="timer-wrap">${timerSvg('buffer')}</div>
    <div class="actionbar"><button class="btn" id="goNow">Go now ▸</button></div>
  `);
  stopTimer();
  const t = Number(b.transition) || 8;
  activeTimer = countdown({ seconds: t, kind: 'buffer',
    onTick: (rem) => updateTimerUI(rem, t, 'ready'),
    onDone: () => { S.sub = 'work'; renderCircuit(); } });
  document.getElementById('goNow').addEventListener('click', () => { stopTimer(); S.sub = 'work'; renderCircuit(); });
}
function afterCircuitItem() {
  const b = block();
  if (S.ci < b.items.length - 1) { S.ci += 1; S.sub = 'buffer'; return renderBuffer(); }
  endRound();
}
function endRound() {
  const b = block();
  // push this round's values into captured
  b.items.forEach((it, i) => S.captured[b.id][i].sets.push({ value: S.roundBuf[i] ?? it.target }));
  buzz(60); say(`Round ${S.round} done`);
  if (S.round < b.rounds) {
    if (b.roundRest > 0) { S.sub = 'roundrest'; renderRoundRest(); }
    else { S.round += 1; S.ci = 0; S.roundBuf = {}; S.sub = 'work'; renderCircuit(); } // AMRAP-style
  } else {
    renderCircuitSummary();
  }
}
/* inter-round rest WITH the round-confirm card (edit while resting) */
function renderRoundRest() {
  const b = block();
  const rest = Number(b.roundRest) || 45;
  const rows = b.items.map((it, i) => {
    const last = S.captured[b.id][i].sets.length - 1;
    return logRow({ name: it.name, measure: it.measure, load: it.load }, `rr_${i}`, S.captured[b.id][i].sets[last].value);
  }).join('');
  shell(`
    <div class="center"><div class="eyebrow">Round ${S.round} done · rest</div></div>
    <div class="timer-wrap" style="margin:6px 0;">${timerSvg('rest')}</div>
    <div class="card logcard" id="logCard">${rows}</div>
    <div class="actionbar"><button class="btn lg" id="nextRound">Start round ${S.round + 1} ▸</button></div>
  `, { progress: false });
  const proceed = () => {
    b.items.forEach((it, i) => { const last = S.captured[b.id][i].sets.length - 1; const v = readInput(`rr_${i}`); if (v != null) S.captured[b.id][i].sets[last].value = v; });
    stopTimer(); S.round += 1; S.ci = 0; S.roundBuf = {}; S.sub = 'work'; renderCircuit();
  };
  stopTimer();
  activeTimer = countdown({ seconds: rest, kind: 'rest',
    onTick: (rem) => updateTimerUI(rem, rest, 'rest'), onDone: proceed });
  document.getElementById('nextRound').addEventListener('click', proceed);
}
/* light end-of-circuit summary (rounds already logged) */
function renderCircuitSummary() {
  stopTimer();
  const b = block();
  const rows = S.captured[b.id].map(e =>
    `<div class="row"><span class="nm">${e.name}</span><span class="tg">${e.sets.map(s => s.value ?? '–').join('  ·  ')} ${e.unit}</span></div>`).join('');
  shell(`
    <div class="center"><div class="eyebrow">${b.type}</div><h2 style="font-size:22px;margin:8px 0 4px;">${b.name} — summary</h2>
      <p class="muted" style="margin:0 0 14px;">Logged per round. Looks good?</p></div>
    <div class="card logcard">${rows}</div>
    <div class="actionbar"><button class="btn lg" id="confirmBlock">${isLastBlock() ? 'Finish workout ✓' : 'Confirm ▸'}</button></div>
  `, { progress: false });
  document.getElementById('confirmBlock').addEventListener('click', sectionNext);
}

/* ============================================================
   BENCHMARK
   ============================================================ */
function renderBenchmark() {
  const b = block(); const item = b.items[0]; const unit = UNIT[item.measure];
  const pr = store.getPR(item.exId);
  shell(`
    <div class="center"><div class="eyebrow">Benchmark</div>
      <div class="now-ex"><div class="name">${item.name}</div></div>
      <p class="muted" style="margin:0 0 16px;">One all-out set — sets your benchmark.</p>
      ${pr ? `<div class="pill" style="margin-bottom:16px;">Best: ${pr.value} ${pr.unit}</div>` : ''}</div>
    <div class="card logcard">${logRow(item, 'bench', '')}</div>
    <div class="actionbar"><button class="btn lg" id="saveBench">Log my max ✓</button></div>
  `, { progress: false });
  document.getElementById('saveBench').addEventListener('click', () => {
    S.captured[b.id][0].sets = [{ value: readInput('bench') }];
    completeBlock();
  });
}

/* ============================================================
   BLOCK LOG (straight work) — editable checkpoint
   ============================================================ */
function renderBlockLog() {
  const b = block();
  const entries = S.captured[b.id];
  const rows = entries.map((e, ei) =>
    e.sets.map((st, si) => logRow({ name: e.name, measure: e.measure, load: e.load }, `b${ei}_${si}`, st.value, null, e.exId, st.weight)).join('')
  ).join('');
  shell(`
    <div class="center"><div class="eyebrow">${b.type}</div><h2 style="font-size:22px;margin:8px 0 4px;">Log — ${b.name}</h2>
      <p class="muted" style="margin:0 0 14px;">Pre-filled. Tweak, then confirm.</p></div>
    <div class="card logcard">${rows}</div>
    <div class="actionbar"><button class="btn lg" id="confirmBlock">${isLastBlock() ? 'Finish workout ✓' : 'Confirm ▸'}</button></div>
  `, { progress: false });
  document.getElementById('confirmBlock').addEventListener('click', () => {
    entries.forEach((e, ei) => e.sets.forEach((st, si) => {
      st.value = readInput(`b${ei}_${si}`);
      const w = document.getElementById(`w_b${ei}_${si}`); if (w && w.value !== '') st.weight = Number(w.value);
    }));
    sectionNext();
  });
}

/* one editable row */
function logRow(meta, key, value, side, exId, weight) {
  const isHold = meta.measure === 'hold';
  const unit = UNIT[meta.measure];
  const step = isHold ? 5 : 1;
  const wField = meta.load === 'weighted'
    ? `<div class="weight-field ${weight == null ? 'empty' : ''}"><input id="w_${key}" type="number" inputmode="decimal" placeholder="–" onfocus="this.select()" value="${weight ?? (exId ? (store.getLast(exId)?.weight ?? '') : '')}"/><span class="u">kg</span></div>`
    : '';
  const val = value === 'MAX' ? '' : (value ?? '');
  return `<div class="row"><span class="nm">${meta.name}</span>${side ? `<span class="side-tag">${side}</span>` : ''}${wField}
      <div class="stepper">
        <button data-step="-${step}" data-k="${key}">−</button>
        <input id="i_${key}" type="number" inputmode="numeric" value="${val}" placeholder="${value === 'MAX' ? 'max' : '0'}" onfocus="this.select()"/>
        <button data-step="${step}" data-k="${key}">+</button>
        <span class="u">${unit}</span>
      </div></div>`;
}
function readInput(key) { const el = document.getElementById(`i_${key}`); if (!el || el.value === '') return null; return Number(el.value); }

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.stepper button[data-step]');
  if (!btn) return;
  const input = document.getElementById(`i_${btn.dataset.k}`);
  if (!input) return;
  input.value = Math.max(0, (Number(input.value) || 0) + Number(btn.dataset.step));
});

/* ============================================================
   FINISH
   ============================================================ */
function finishSession() {
  stopTimer(); releaseAwake();
  const session = {
    date: new Date().toISOString(), name: S.session.name, duration: S.session.duration,
    fundamental: S.session.fundamentalId,
    blocks: S.session.blocks.map(b => ({ id: b.id, type: b.type, name: b.name, entries: S.captured[b.id] || [] })),
  };
  const { prs } = store.saveSession(session);
  if (prs.length) say(`New record. ${prs[0].value} ${prs[0].unit}. ${prs[0].name}.`);
  else say('Session complete. Strong work.');

  const prHtml = prs.length
    ? `<div class="card"><div class="eyebrow">New PRs</div>${prs.map(p =>
        `<div class="row" style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--line);"><span>${p.name}</span><span class="pr-flash">${p.value} ${p.unit}</span></div>`).join('')}</div>`
    : '';
  host.innerHTML = `
    <div class="screen fade-in center">
      <div class="big-emoji">${prs.length ? '🏆' : '✅'}</div>
      <h1 style="font-size:28px;">${prs.length ? 'New records!' : 'Done.'}</h1>
      <p class="muted">${S.session.name} · ${S.session.duration} min</p>
      <div style="height:18px;"></div>${prHtml}
      <div class="actionbar"><button class="btn lg" id="homeBtn">Back to dashboard</button></div>
    </div>`;
  document.getElementById('homeBtn').addEventListener('click', () => cb.onFinish?.());
}
