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
import { say, beep, buzz, fmt, initAudio, keepAwake, releaseAwake } from '../timer.js';

const UNIT = { reps: 'reps', hold: 'sec', cals: 'cals' };
const WUNIT = 'lb';                       // weight unit (Nicolas trains in pounds)
let S = null, host = null, cb = {}, ticker = null, onStepDone = null, curVal = 0, roundBuf = {};
const numAt = id => { const e = document.getElementById(id); return e && e.value !== '' ? Number(e.value) : null; };

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
function quit() { stopTicker(); releaseAwake(); R.clear(); cb.onExit?.(); }

const block = () => S.plan.blocks[S.bi];
const isLastBlock = () => S.bi >= S.plan.blocks.length - 1;

/* ---------------- ticker (drives clocks + step completion) ---------------- */
function startTicker() { stopTicker(); ticker = setInterval(tick, 250); }
function stopTicker() { if (ticker) clearInterval(ticker); ticker = null; }
function tick() {
  const sc = document.getElementById('sessClock'); if (sc) sc.textContent = fmt(R.sessionElapsed(S));
  const rem = R.stepRemaining(S);
  if (rem != null) {
    updateTimer(rem, S.stepDur);
    if (rem <= 0 && onStepDone) { const f = onStepDone; onStepDone = null; R.clearStep(S); f(); }
  }
}

/* ---------------- block routing ---------------- */
function enterBlock(i, resuming) {
  S.bi = i;
  if (!resuming) { S.ii = 0; S.si = 0; S.ci = 0; S.round = 1; S.sub = 'work'; S.amrapRounds = 0; S.iv = null; S.ivPhase = 'work'; }
  R.clearStep(S); R.save(S);
  roundBuf = {}; onStepDone = null;
  const b = block();
  if (!S.captured[b.id]) buildEntries(b);
  if (resuming) { beep('go'); say(b.name); return renderActive(); }
  renderGetReady();
}
/* 10-second "get set up" countdown before each block (skippable) */
function renderGetReady() {
  const b = block();
  beep('go'); say(`Get ready. ${b.name}.`);
  shell(`<div class="now-ex getready"><div class="label">Get ready</div><div class="name">${b.name}</div>
      <div class="side">${b.role}</div></div>
    <div class="timer-wrap">${timerSvg('buffer')}</div>
    <div class="actionbar"><button class="btn lg" id="go">I'm ready ▸</button></div>`);
  const begin = () => { R.clearStep(S); onStepDone = null; renderActive(); };
  R.beginStep(S, 10); onStepDone = begin;
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
  if (b.type === 'Mobility' || b.format === 'jointprep') return sectionNext();
  if (['circuit', 'amrap', 'tabata', 'emom'].includes(b.format)) return renderSummary();
  return renderLog();
}
function sectionNext() {
  if (isLastBlock()) return finishSession();
  const next = S.plan.blocks[S.bi + 1];
  shellPlain(`
    <div class="big-emoji">✓</div>
    <h2 style="margin:4px 0;">${block().name} done</h2>
    <p class="muted">Up next</p>
    <div class="card" style="margin-top:10px;"><div class="eyebrow">${next.role}</div><h3 style="margin:6px 0 0;">${next.name}</h3></div>
    <div class="actionbar"><button class="btn lg" id="goNext">Start ▸</button></div>`);
  document.getElementById('goNext').addEventListener('click', () => enterBlock(S.bi + 1));
}

/* ---------------- shells ---------------- */
function shell(inner, { progress = true } = {}) {
  const b = block();
  host.innerHTML = `
    <div class="screen run fade-in">
      <div class="run-head">
        <button class="x back" id="backBtn" ${S.bi <= 0 ? 'disabled' : ''}>‹</button>
        <div class="blk">${b.role} · ${b.name}</div>
        <div class="right"><span class="sessclock" id="sessClock">${fmt(R.sessionElapsed(S))}</span><button class="x" id="exitBtn">✕</button></div>
      </div>
      <div class="wprog"><div class="wprog-fill" style="width:${overallPct()}%"></div></div>
      <div class="blockstrip">${blockStrip()}</div>
      ${inner}
    </div>`;
  document.getElementById('exitBtn').addEventListener('click', confirmExit);
  document.getElementById('backBtn')?.addEventListener('click', backBlock);
  const now = host.querySelector('.bchip.now'); if (now) now.scrollIntoView({ inline: 'center', block: 'nearest' });
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
function backBlock() {
  if (S.bi <= 0) return;
  const prev = S.plan.blocks[S.bi - 1];
  (S.captured[prev.id] || []).forEach(e => e.sets = []);
  R.clearStep(S); onStepDone = null; roundBuf = {};
  enterBlock(S.bi - 1);
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
    <div class="read"><div class="t" id="timerText">0:00</div><div class="cap" id="timerCap"></div></div></div>`;
}
function updateTimer(rem, total) {
  const r = 110, c = 2 * Math.PI * r;
  const fillEl = document.getElementById('timerFill'), txt = document.getElementById('timerText');
  if (txt) txt.textContent = fmt(rem);
  if (fillEl) fillEl.style.strokeDashoffset = String(c * (1 - (total > 0 ? rem / total : 0)));
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
function renderSets() {
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
    shell(`<div class="now-ex"><div class="label">${label}</div><div class="name">${item.name}</div></div>
      <div class="timer-wrap">${timerSvg('buffer')}</div>
      <div class="actionbar"><button class="btn ghost" id="skip">Skip ▸</button></div>`);
    document.getElementById('skip').addEventListener('click', () => { R.clearStep(S); onStepDone = null; capture(target); afterSet(); });
    R.beginStep(S, target); say(`${item.name}. Hold.`); onStepDone = () => { capture(target); afterSet(); };
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
    shell(`<div class="now-ex"><div class="label">${label}</div><div class="name">${item.name}</div>${item.tempo ? `<div class="side">tempo ${item.tempo}</div>` : ''}</div>
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
function renderRest(prevItem) {
  const rest = Number(prevItem.rest) || (block().format === 'yates' ? 120 : 60);
  if (rest <= 0) { S.sub = 'work'; R.save(S); return renderSets(); }
  shell(`<div class="now-ex"><div class="label">Rest</div><div class="name">Recover</div></div>
    <div class="timer-wrap">${timerSvg('rest')}</div>
    <div class="actionbar"><div class="btn-row">
      <button class="btn secondary" id="sub20">−20s</button><button class="btn secondary" id="add20">+20s</button>
      <button class="btn" id="skip">Skip ▸</button></div></div>`);
  R.beginStep(S, rest); say(`Rest. ${rest} seconds.`);
  onStepDone = () => { S.sub = 'work'; R.save(S); renderSets(); };
  document.getElementById('add20').addEventListener('click', () => { S.stepDur += 20; R.save(S); });
  document.getElementById('sub20').addEventListener('click', () => { if (R.stepRemaining(S) > 25) { S.stepDur -= 20; R.save(S); } });
  document.getElementById('skip').addEventListener('click', () => { R.clearStep(S); onStepDone = null; S.sub = 'work'; R.save(S); renderSets(); });
}

/* ---------------- SKILL (practice timer, or sets×hold) ---------------- */
function renderSkill() {
  const b = block(); const item = b.items[0];
  if (item.minutes) {
    const total = item.minutes * 60;
    shell(`<div class="now-ex"><div class="label">Skill · practice fresh</div><div class="name">${item.name}</div></div>
      <div class="timer-wrap">${timerSvg('buffer')}</div>
      <div class="actionbar"><button class="btn" id="doneSkill">Done ▸</button></div>`);
    R.beginStep(S, total); say(`${item.name}. Practice.`);
    onStepDone = () => completeBlock();
    document.getElementById('doneSkill').addEventListener('click', () => { R.clearStep(S); onStepDone = null; completeBlock(); });
  } else { renderSets(); }   // sets×hold skill (e.g. front lever holds) handled by sets player
}

/* ---------------- CIRCUIT (rounds; hold items auto-TUT; log during inter-round rest) ---------------- */
function renderCircuit() {
  const b = block(); const item = b.items[S.ci || (S.ci = 0)];
  if (S.sub === 'roundrest') return renderRoundRest();
  if (S.sub === 'buffer') return renderBuffer();
  const unit = UNIT[item.measure];
  const dots = Array.from({ length: b.rounds || 1 }, (_, i) => `<div class="r ${i + 1 < S.round ? 'done' : i + 1 === S.round ? 'now' : ''}">${i + 1}</div>`).join('');
  const list = b.items.map((it, i) => `<div class="ci ${i === S.ci ? 'active' : ''}"><span class="nm">${it.name}${it.side ? ' ' + it.side : ''}</span><span class="tg">${it.measure === 'hold' ? it.hold + 's' : (it.reps ?? it.target) + ' ' + UNIT[it.measure]}</span></div>`).join('');

  if (item.measure === 'hold') {
    shell(`<div class="rounds">${dots}</div><div class="now-ex"><div class="label">Round ${S.round} / ${b.rounds}</div><div class="name">${item.name}${item.side ? ' ' + item.side : ''}</div></div>
      <div class="timer-wrap">${timerSvg('buffer')}</div><div class="circuit-list">${list}</div>
      <div class="actionbar"><button class="btn ghost" id="skip">Skip ▸</button></div>`);
    R.beginStep(S, item.hold || 30); say(`${item.name}. Go.`);
    const adv = () => { roundBuf[S.ci] = item.hold; afterCircuitItem(); };
    onStepDone = adv;
    document.getElementById('skip').addEventListener('click', () => { R.clearStep(S); onStepDone = null; adv(); });
  } else {
    curVal = Number(roundBuf[S.ci] ?? item.reps ?? item.target) || 0;
    shell(`<div class="rounds">${dots}</div><div class="now-ex"><div class="label">Round ${S.round} / ${b.rounds}</div><div class="name">${item.name}</div></div>
      <div class="target">${bigEditable(curVal, unit)}</div><div class="circuit-list">${list}</div>
      <div class="actionbar"><button class="btn lg" id="next">${S.ci >= b.items.length - 1 ? 'Round done ✓' : 'Next ▸'}</button></div>`);
    wireBig();
    document.getElementById('next').addEventListener('click', () => { buzz(40); roundBuf[S.ci] = curVal; afterCircuitItem(); });
  }
}
function renderBuffer() {
  const b = block(); const next = b.items[S.ci];
  shell(`<div class="now-ex"><div class="label">Get ready</div><div class="name">${next.name}</div></div>
    <div class="timer-wrap">${timerSvg('buffer')}</div>
    <div class="actionbar"><button class="btn" id="go">Go now ▸</button></div>`);
  const t = Number(b.transition) || 8;
  R.beginStep(S, t);
  onStepDone = () => { S.sub = 'work'; R.save(S); renderCircuit(); };
  document.getElementById('go').addEventListener('click', () => { R.clearStep(S); onStepDone = null; S.sub = 'work'; R.save(S); renderCircuit(); });
}
function afterCircuitItem() {
  const b = block();
  if (S.ci < b.items.length - 1) { S.ci += 1; S.sub = (b.transition ? 'buffer' : 'work'); R.save(S); return b.transition ? renderBuffer() : renderCircuit(); }
  endRound();
}
function endRound() {
  const b = block();
  b.items.forEach((it, i) => S.captured[b.id][i].sets.push({ value: roundBuf[i] ?? (it.hold ?? it.reps ?? it.target) }));
  R.save(S); buzz(60); say(`Round ${S.round} done.`);
  if (S.round < (b.rounds || 1)) {
    if ((b.roundRest ?? 30) > 0) { S.sub = 'roundrest'; R.save(S); renderRoundRest(); }
    else { S.round += 1; S.ci = 0; roundBuf = {}; S.sub = 'work'; R.save(S); renderCircuit(); }
  } else renderSummary();
}
function renderRoundRest() {
  const b = block(); const rest = Number(b.roundRest) || 30;
  const rows = b.items.map((it, i) => logRow(it, `rr_${i}`, S.captured[b.id][i].sets.at(-1)?.value)).join('');
  shell(`<div class="center"><div class="eyebrow">Round ${S.round} done · rest</div></div>
    <div class="timer-wrap" style="margin:6px 0;">${timerSvg('rest')}</div>
    <div class="card logcard">${rows}</div>
    <div class="actionbar"><button class="btn lg" id="nextRound">Start round ${S.round + 1} ▸</button></div>`, { progress: false });
  const proceed = () => {
    b.items.forEach((it, i) => { const v = readInput(`rr_${i}`); if (v != null) S.captured[b.id][i].sets[S.captured[b.id][i].sets.length - 1].value = v; });
    R.clearStep(S); onStepDone = null; S.round += 1; S.ci = 0; roundBuf = {}; S.sub = 'work'; R.save(S); renderCircuit();
  };
  R.beginStep(S, rest); onStepDone = proceed;
  document.getElementById('nextRound').addEventListener('click', proceed);
}

/* ---------------- AMRAP (count-up window; tap rounds) ---------------- */
function renderAmrap() {
  const b = block(); const mins = b.minutes || 5;
  if (S.stepDur == null) { R.beginStep(S, mins * 60); say(`A.M.R.A.P. ${mins} minutes. Go.`); }
  onStepDone = () => completeBlock();
  if (!S.amrapRounds) S.amrapRounds = 0;
  const list = b.items.map(it => `<div class="ci"><span class="nm">${it.name}</span><span class="tg">${it.measure === 'hold' ? it.hold + 's' : (it.reps ?? it.target ?? 'max') + (it.reps ? ' reps' : '')}</span></div>`).join('');
  shell(`<div class="now-ex"><div class="label">AMRAP — ${mins} min</div><div class="name">As many rounds as possible</div></div>
    <div class="timer-wrap">${timerSvg('buffer')}</div>
    <div class="center" style="margin:4px 0 12px;"><span class="eyebrow">Rounds</span> <span class="big" style="font-size:40px;" id="amrapN">${S.amrapRounds}</span></div>
    <div class="circuit-list">${list}</div>
    <div class="actionbar"><div class="btn-row"><button class="btn secondary" id="rdMinus">−</button><button class="btn" id="rdPlus">+ Round</button><button class="btn ghost" id="endAmrap">End ▸</button></div></div>`);
  document.getElementById('rdPlus').addEventListener('click', () => { S.amrapRounds++; R.save(S); document.getElementById('amrapN').textContent = S.amrapRounds; buzz(30); });
  document.getElementById('rdMinus').addEventListener('click', () => { S.amrapRounds = Math.max(0, S.amrapRounds - 1); R.save(S); document.getElementById('amrapN').textContent = S.amrapRounds; });
  document.getElementById('endAmrap').addEventListener('click', () => { R.clearStep(S); onStepDone = null; completeBlock(); });
}

/* ---------------- INTERVAL (tabata / emom): work/rest cycling items ---------------- */
function renderInterval() {
  const b = block();
  const work = b.work || (b.format === 'emom' ? 60 : 20);
  const rest = b.rest ?? (b.format === 'emom' ? 0 : 10);
  const rounds = b.rounds || 8;
  if (S.iv == null) { S.iv = 0; S.ivPhase = 'work'; R.save(S); }   // iv = interval index across rounds×items
  const totalIv = rounds * b.items.length;
  if (S.iv >= totalIv) return completeBlock();
  const item = b.items[S.iv % b.items.length];
  const roundN = Math.floor(S.iv / b.items.length) + 1;
  const phaseWork = S.ivPhase === 'work';
  shell(`<div class="now-ex"><div class="label">${b.format === 'emom' ? 'EMOM' : 'Tabata'} · round ${roundN}/${rounds}</div>
      <div class="name">${phaseWork ? item.name : 'Rest'}</div></div>
    <div class="timer-wrap">${timerSvg(phaseWork ? 'buffer' : 'rest')}</div>
    <div class="actionbar"><button class="btn ghost" id="skip">Skip ▸</button></div>`);
  const dur = phaseWork ? work : rest;
  if (dur <= 0) return nextInterval();
  R.beginStep(S, dur); if (phaseWork) say(item.name);
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
    <div class="actionbar"><button class="btn lg" id="saveBench">Log my max ✓</button></div>`, { progress: false });
  document.getElementById('saveBench').addEventListener('click', () => {
    S.captured[b.id][0].sets = [{ value: readInput('bench') }]; R.save(S); completeBlock();
  });
}

/* ---------------- log card + summary ---------------- */
function renderLog() {
  const b = block(); const entries = S.captured[b.id];
  // grouped: exercise name once, its sets underneath (no repeated names)
  const groups = entries.map((e, ei) => {
    const sets = e.sets.length ? e.sets : [{ value: null }];
    const rows = sets.map((st, si) => {
      const lbl = st.side ? st.side : (sets.length > 1 ? `Set ${si + 1}` : 'Set');
      return `<div class="logset"><span class="sn">${lbl}</span>${cellInputs({ measure: e.measure, load: e.load }, `b${ei}_${si}`, st.value, st.weight, e.exId)}</div>`;
    }).join('');
    return `<div class="loggroup"><div class="gname">${e.name}</div>${rows}</div>`;
  }).join('');
  shell(`<div class="center"><div class="eyebrow">${b.role}</div><h2 style="font-size:22px;margin:8px 0 4px;">Log — ${b.name}</h2>
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
  const rows = S.captured[b.id].map(e => `<div class="row"><span class="nm">${e.name}</span><span class="tg">${e.sets.map(s => s.value ?? '–').join(' · ')} ${e.unit}</span></div>`).join('');
  shell(`<div class="center"><div class="eyebrow">${b.role}</div><h2 style="font-size:22px;margin:8px 0 4px;">${b.name} — done</h2></div>
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
function finishSession() {
  stopTicker(); releaseAwake();
  const elapsed = R.sessionElapsed(S);
  const session = {
    date: new Date().toISOString(), name: S.plan.name, duration: S.plan.duration, seconds: elapsed,
    blocks: S.plan.blocks.map(b => ({ id: b.id, type: b.role, name: b.name, entries: S.captured[b.id] || [] })),
  };
  const { prs } = store.saveSession(session);
  R.clear();
  if (prs.length) say(`New record. ${prs[0].value} ${prs[0].unit}.`); else say('Workout complete. Strong work.');
  const prHtml = prs.length ? `<div class="card"><div class="eyebrow">New PRs</div>${prs.map(p => `<div class="row" style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--line);"><span>${p.name}</span><span class="pr-flash">${p.value} ${p.unit}</span></div>`).join('')}</div>` : '';
  host.innerHTML = `<div class="screen fade-in center">
    <div class="big-emoji">${prs.length ? '🏆' : '✅'}</div>
    <h1 style="font-size:28px;">${prs.length ? 'New records!' : 'Done.'}</h1>
    <p class="muted">${S.plan.name} · ${fmt(elapsed)} · ${S.plan.duration} min plan</p>
    <div style="height:16px;"></div>${prHtml}
    <div class="actionbar"><button class="btn lg" id="home">Back to week</button></div></div>`;
  document.getElementById('home').addEventListener('click', () => cb.onFinish?.());
}
