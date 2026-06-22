/* ============================================================
   LAYER 2 — THE SESSION COMPOSER (pure functions)
   Turns: fundamental + duration + goals + toggles
   Into:  a session of TIME-BOXED blocks, each filled to fit its
          minute budget. This is the architectural core the old
          app lacked (it picked blocks/exercises independently).
   ============================================================ */
import { EXERCISES, BUDGETS, PRESCRIPTION, REP_SEC, TRANSITION, ROUND_REST } from './data.js';

const FOCUS_W = { high: 3, med: 2, low: 1 };

function meta(id) {
  const m = EXERCISES[id];
  return { exId: id, name: m.name, measure: m.measure, load: m.load,
           laterality: m.laterality, noPR: !!m.noPR, repSec: m.repSec || REP_SEC };
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function setTimeFor(m, reps, rest, holdSec) {
  const work = m.measure === 'hold' ? (holdSec || 25) : reps * m.repSec;
  return work + rest;
}

/* split total work minutes into 1–3 blocks of 5–20 min */
function splitWork(workMin) {
  if (workMin <= 0) return [];
  if (workMin <= 16) return [workMin];
  if (workMin <= 32) { const a = Math.round(workMin / 2); return [a, workMin - a]; }
  const a = Math.round(workMin / 3); return [a, a, workMin - 2 * a];
}

/* derive ordered work intents from the goal portfolio */
function workIntents(goals) {
  const ranked = goals
    .map(g => ({ intent: g.intent, w: FOCUS_W[g.focus] || 1 }))
    .filter(g => PRESCRIPTION[g.intent])
    .sort((a, b) => b.w - a.w);
  const seen = new Set(); const out = [];
  for (const g of ranked) if (!seen.has(g.intent)) { seen.add(g.intent); out.push(g.intent); }
  return out.length ? out : ['strength', 'size'];
}

/* ---- block fillers ---- */
let UID = 0;
const nid = (p) => `${p}_${++UID}`;

function fillWork(pool, minutes, intent, used) {
  const sec = minutes * 60;
  const rx = PRESCRIPTION[intent] || PRESCRIPTION.size;
  // setTime drives everything so a block actually FITS its minutes.
  // high-rest intents (strength) naturally get fewer exercises / more sets.
  const setTime = rx.reps * REP_SEC + rx.rest;
  const totalSets = Math.max(rx.sets[0], Math.floor(sec / setTime));
  let K = clamp(Math.round(totalSets / 4), 1, 4);      // aim ~4 sets per exercise
  K = Math.min(K, pool.length);
  const setsPerEx = clamp(Math.round(totalSets / K), rx.sets[0], rx.sets[1]);

  const choices = shuffle(pool).filter(id => !used.has(id)).slice(0, K);
  while (choices.length < K) { const extra = shuffle(pool).find(id => !choices.includes(id)); choices.push(extra || pool[0]); }
  choices.forEach(id => used.add(id));

  const items = choices.map(id => {
    const m = meta(id);
    const target = m.measure === 'hold' ? 25 : rx.reps;
    return { ...m, sets: Array.from({ length: setsPerEx }, () => ({ target })), rest: rx.rest };
  });
  return { id: nid('work'), type: 'Work', format: 'straight', name: labelFor(intent), minutes, intent, items };
}
function labelFor(intent) {
  return { strength: 'Strength', size: 'Hypertrophy', endurance: 'Endurance', skill: 'Skill Work' }[intent] || 'Work';
}

function fillCircuit(pool, minutes, { name, type, reps, roundRest, includeCore }) {
  const sec = minutes * 60;
  const nNonCore = minutes <= 3 ? 2 : 3;          // fewer moves on short blocks so it fits
  let ids = shuffle(pool.filter(id => EXERCISES[id].pattern !== 'core')).slice(0, nNonCore - (includeCore ? 1 : 0));
  if (includeCore) { const core = pool.find(id => EXERCISES[id].pattern === 'core'); if (core) ids.push(core); }
  if (ids.length < 2) ids = pool.slice(0, 2);

  const items = ids.map(id => {
    const m = meta(id);
    const target = m.measure === 'hold' ? 30 : reps;
    return { ...m, target };
  });
  const roundTime = items.reduce((s, it) =>
    s + (it.measure === 'hold' ? it.target : it.target * it.repSec) + TRANSITION, 0) + roundRest;
  const rounds = clamp(Math.round(sec / roundTime), 2, 6);
  return { id: nid(type.toLowerCase()), type, format: 'circuit', name, minutes, rounds,
           transition: TRANSITION, roundRest, items };
}

function fillMobility(pool, minutes) {
  const ids = shuffle(pool).slice(0, clamp(Math.round(minutes), 2, 3));
  const items = ids.map(id => {
    const m = meta(id);
    return { ...m, sets: [{ target: 40 }, { target: 40 }], rest: 15 };
  });
  return { id: nid('mob'), type: 'Mobility', format: 'straight', name: 'Into the Stretch', minutes, items };
}

function fillJointPrep(cues, minutes) {
  return { id: nid('jp'), type: 'Joint Prep', format: 'jointprep', name: 'Joint Prep',
           minutes, interval: 30, cues: shuffle(cues) };
}

function fillBenchmark(pool) {
  const id = pool.find(x => EXERCISES[x].load === 'bw') || pool[0];
  const m = meta(id);
  return { id: nid('bench'), type: 'Benchmark', format: 'benchmark', name: 'Max-Rep Test', minutes: 2,
           items: [{ ...m, sets: [{ target: 'MAX' }], rest: 0 }] };
}

/* outline() — deterministic block plan (types + minutes) for previews,
   without picking exercises. Used by the dashboard & Build Day. */
export function outline(duration, toggles = {}) {
  const b = BUDGETS[duration] || BUDGETS[30];
  const useJP  = toggles.jointPrep ?? (b.jointPrep > 0);
  const useMob = toggles.mobility ?? (b.mobility > 0);
  const useBench = !!toggles.benchmark;
  const jpMin = useJP ? b.jointPrep : 0, mobMin = useMob ? b.mobility : 0, benchMin = useBench ? 2 : 0;
  const workMin = Math.max(5, duration - jpMin - b.primer - b.finisher - mobMin - benchMin);
  const out = [];
  if (useJP) out.push({ type: 'Joint Prep', minutes: jpMin });
  out.push({ type: 'Primer', minutes: b.primer });
  splitWork(workMin).forEach(m => out.push({ type: 'Work', minutes: m }));
  out.push({ type: 'Finisher', minutes: b.finisher });
  if (useBench) out.push({ type: 'Benchmark', minutes: benchMin });
  if (useMob) out.push({ type: 'Mobility', minutes: mobMin });
  return out;
}

/* defaults for the toggles given a duration */
export function defaultToggles(duration) {
  const b = BUDGETS[duration] || BUDGETS[30];
  return { jointPrep: b.jointPrep > 0, mobility: b.mobility > 0, benchmark: false };
}

/* ============================================================
   compose() — the entry point
   opts: { duration, goals, toggles:{jointPrep,mobility,benchmark} }
   ============================================================ */
export function compose(fund, { duration, goals, toggles = {} }) {
  UID = 0;
  const b = BUDGETS[duration] || BUDGETS[30];
  const useJP  = toggles.jointPrep ?? (b.jointPrep > 0);
  const useMob = toggles.mobility ?? (b.mobility > 0);
  const useBench = !!toggles.benchmark;

  const jpMin  = useJP ? b.jointPrep : 0;
  const mobMin = useMob ? b.mobility : 0;
  const benchMin = useBench ? 2 : 0;
  const workMin = Math.max(5, duration - jpMin - b.primer - b.finisher - mobMin - benchMin);

  const intents = workIntents(goals);
  const used = new Set();
  const blocks = [];

  if (useJP) blocks.push(fillJointPrep(fund.jointPrepCues, jpMin));

  // Primer = a pump circuit
  blocks.push(fillCircuit(fund.pools.primer, b.primer,
    { name: 'Primer Pump', type: 'Primer', reps: 12, roundRest: 15, includeCore: false }));

  // Work blocks — one intent each, rotating through the portfolio
  splitWork(workMin).forEach((min, i) => {
    blocks.push(fillWork(fund.pools.work, min, intents[i % intents.length], used));
  });

  // Finisher circuit (with a core TUT)
  blocks.push(fillCircuit(fund.pools.finisher, b.finisher,
    { name: 'Finisher Circuit', type: 'Finisher', reps: 12, roundRest: 25, includeCore: true }));

  if (useBench) blocks.push(fillBenchmark(fund.pools.finisher.concat(fund.pools.work)));
  if (useMob)   blocks.push(fillMobility(fund.pools.mobility, mobMin));

  return { name: fund.name, fundamentalId: fund.id, duration, goals, blocks };
}
