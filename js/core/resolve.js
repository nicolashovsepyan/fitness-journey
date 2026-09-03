/* ============================================================
   CORE — RESOLVER (pure functions, no DOM)
   Turns a SESSION + duration (+ session index for filler rotation)
   into ONE fully-resolved RunPlan: exercise meta merged in, blocks
   scaled to the duration, rest-fillers chosen. This is the single
   object the Day screen shows and Work Mode will play — the
   no-desync contract from ARCHITECTURE.md.
   ============================================================ */
import { EXERCISES } from '../data/exercises.js';
/* Not the built-in map any more: whichever program this person is on.
   See js/core/current.js — the built-in one is the fallback inside it. */
import { sessions } from './current.js';
import { FILLERS, ANTAGONIST } from '../data/program.js';
import { currentProfile } from '../users.js';

/* group related patterns so a swap can widen sensibly (a quad → other lower-body) */
const FAMILY = { quad: 'lower', glute: 'lower', hamstring: 'lower', calf: 'lower', shin: 'lower', push: 'push', pull: 'pull', core: 'core', skill: 'skill', conditioning: 'cond', mobility: 'mob', full: 'full' };
const canDoWith = (m, have) => (m.equipment || ['bw']).every(e => e === 'bw' || have.includes(e));
const famOf = m => new Set(m.families || (m.family ? [m.family] : []));   // progression track(s)

const UNIT = { reps: 'reps', hold: 'sec', cals: 'cals' };

function meta(id) {
  const m = EXERCISES[id] || { name: id, measure: 'reps', load: 'bw', laterality: 'bilateral' };
  return { exId: id, name: m.name, measure: m.measure, load: m.load,
           laterality: m.laterality, noPR: !!m.noPR, grip: m.grip || null, unit: UNIT[m.measure] };
}

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/* choose a NON-competing filler — a REAL exercise (reps/time you log).
   Consecutive fillers in a session get DIFFERENT types (no dupes);
   the move also varies per filler-block. */
function pickFiller(rawBlock, sessionIndex, fillerIndex) {
  const types = ['mobility', 'antagonist', 'core'];
  const type = types[(sessionIndex + fillerIndex) % types.length];
  const primary = EXERCISES[rawBlock.items[0]?.ex]?.pattern;
  let pool;
  if (type === 'mobility') pool = FILLERS.mobility;
  else if (type === 'core') pool = FILLERS.core;
  else pool = FILLERS[ANTAGONIST[primary] || 'mobility'] || FILLERS.mobility;
  pool = pool.filter(id => EXERCISES[id].pattern !== primary);   // never compete
  if (!pool.length) pool = FILLERS.mobility;
  const move = pool[(sessionIndex + fillerIndex) % pool.length];
  const m = EXERCISES[move];
  const rx = m.measure === 'hold' ? { hold: 20 } : { reps: type === 'core' ? 12 : 10 };
  return { type, exId: move, name: m.name, measure: m.measure, ...rx };
}

/* a movement-mobility block appended at 45/60 min */
function mobilityBlock(session, duration) {
  const lower = ['lower', 'full'].includes(session.pattern);
  const ids = lower ? ['deep_squat_rock', 'leg_swings', 'hip_cars'] : ['thoracic_rotation', 'cat_cow', 'wrist_prep'];
  const n = duration >= 60 ? 3 : 2;
  return {
    id: 'mob', role: 'Mobility', format: 'straight', name: 'Into the Stretch', note: 'Movement mobility',
    items: ids.slice(0, n).map(ex => ({ ex, sets: 1, reps: 10, perSide: EXERCISES[ex].laterality === 'unilateral' })),
  };
}

/* REAL duration scaling — changes sets/rounds on the spot, adds mobility at 45/60.
   A session marked `fixed` opts out entirely: it is the same every week by
   design (the beginner program), so nothing may quietly rewrite its volume. */
function scaleForDuration(session, duration) {
  if (session.fixed) return session.blocks.map(b => ({ ...b, items: b.items.map(it => ({ ...it })) }));
  const dSets = { 20: -1, 30: 0, 45: 1, 60: 2 }[duration] ?? 0;
  const dRounds = { 20: -1, 30: 0, 45: 0, 60: 1 }[duration] ?? 0;
  const out = session.blocks.map(b => {
    const nb = { ...b, items: b.items.map(it => ({ ...it })) };
    if (nb.role === 'Work') {
      nb.items.forEach(it => { if (typeof it.sets === 'number') it.sets = clamp(it.sets + dSets, 2, 6); });
    }
    if (nb.role === 'Primer' || nb.role === 'Finisher') {
      /* ROUNDS ARE A VOLUME DIAL IN A CIRCUIT AND A PROTOCOL IN A TABATA.
         Eight rounds of twenty on and ten off is what the word Tabata
         means; an EMOM's round count is however many intervals fill the
         time the coach asked for. Clamping those to five did not shorten
         the session, it turned the protocol into something else wearing
         the same name — and silently, because five rounds is a perfectly
         plausible number to see. Only the formats where rounds really are
         volume get scaled. */
      const roundsAreVolume = !nb.format || nb.format === 'circuit' || nb.format === 'superset';
      if (roundsAreVolume && typeof nb.rounds === 'number') nb.rounds = clamp(nb.rounds + dRounds, 1, 5);
      if (duration <= 20 && nb.role === 'Primer' && nb.format === 'straight' && nb.items.length > 2)
        nb.items = nb.items.slice(0, Math.max(2, nb.items.length - 2));
    }
    return nb;
  });
  if (duration >= 45) out.push(mobilityBlock(session, duration));
  return out;
}

const TIER = { 'Joint Prep': 0, Primer: 1, Work: 2, Finisher: 3, Benchmark: 4, Mobility: 5 };
const oidx = (arr, v) => { const i = (arr || []).indexOf(v); return i < 0 ? 1e6 : i; };

export function resolveSession(sessionId, { duration = 30, sessionIndex = 0, swaps = {}, removed = [], order = {}, added = {}, fillerSwaps = {} } = {}) {
  const s = sessions()[sessionId];
  if (!s) throw new Error(`Unknown session '${sessionId}'`);

  let fillerIndex = 0;
  const blocks = scaleForDuration(s, duration).map((b, i) => {
    let items = b.items
      .filter(it => !removed.includes(it.ex))            // drop removed exercises (by original id)
      .map(it => {
        const swapTo = swaps[it.ex];                     // apply a saved swap
        const useId = swapTo || it.ex;
        const r = { ...meta(useId), ...it, exId: useId, swappedFrom: swapTo ? it.ex : null };
        // a session may override the library measure (e.g. Dead Bug held for 30s
        // instead of counted in reps) — keep the display unit consistent with it
        r.unit = UNIT[r.measure] || r.unit;
        return r;
      });
    const add = (added[b.name] || []).map(ai => ({ ...meta(ai.ex), ...ai, exId: ai.ex, added: true }));
    items = items.concat(add);                            // append added exercises
    const io = order.items && order.items[b.name];        // apply saved item order
    if (io) items = items.slice().sort((x, y) => oidx(io, x.ex) - oidx(io, y.ex));
    const block = {
      id: b.id || `b${i}`, role: b.role, type: b.role, name: b.name, format: b.format, note: b.note || '',
      anchor: !!b.anchor, rounds: b.rounds, work: b.work, rest: b.rest,
      transition: b.transition, roundRest: b.roundRest, minutes: b.minutes,
      coachMinutes: !!b.coachMinutes, items,
      zoned: !!b.zoned, fromWeek: b.fromWeek || 1,
      optional: !!b.optional, extra: !!b.extra,
    };
    if (b.filler && block.items.length) {
      let f = pickFiller(b, sessionIndex, fillerIndex++);
      const swapTo = fillerSwaps[b.name];               // user swapped the secondary/superset move
      if (swapTo && EXERCISES[swapTo]) {
        const m = EXERCISES[swapTo];
        const rx = m.measure === 'hold' ? { hold: f.hold || 20 } : { reps: f.reps || (f.type === 'core' ? 12 : 10) };
        f = { type: f.type, exId: swapTo, name: m.name, measure: m.measure, swapped: true, ...rx };
      }
      block.filler = f;
    }
    return block;
  }).filter(block => block.items.length > 0 || block.format === 'jointprep');

  // saved block order — within each role section (sections stay grouped)
  blocks.sort((a, b) => ((TIER[a.role] ?? 9) - (TIER[b.role] ?? 9)) || (oidx(order.blocks, a.name) - oidx(order.blocks, b.name)));

  return {
    name: s.name, sessionId: s.id, pattern: s.pattern, category: s.category,
    duration, variant: s.variant || null, constraint: s.constraint || null,
    coreDominant: !!s.coreDominant, tags: s.tags || [],
    scalingNote: (s.scaling && s.scaling[duration]) || null,
    fixed: !!s.fixed,
    coachMode: !!s.coachMode,       // notes / knee flag / end-of-session feedback
    blocks,
  };
}

/* a human-readable prescription string for one resolved item (for the Day view) */
export function describeItem(block, it) {
  const u = it.unit;
  const target = it.repsText || it.reps;      // '10-15' beats a bare 12
  // superset — N rounds of the pair, rest only after the pair
  if (block.format === 'superset') {
    const tgt = it.measure === 'hold' ? `${it.hold}s` : `${target} ${u}`;
    return `${block.rounds || 3} × ${tgt}`;
  }
  // circuit / amrap / tabata / emom — single target or interval
  if (['circuit', 'amrap', 'emom'].includes(block.format)) {
    const extra = it.tempo ? ` · ${it.tempo}` : (it.note ? ` · ${it.note}` : '');
    if (it.reps != null) return `${target} ${u}${it.perSide ? ' / side' : ''}${extra}`;
    if (it.hold != null) return `${it.hold}s${it.perSide ? ' / side' : ''}${extra}`;
    if (it.target === 'MAX') return `${it.minutes ? it.minutes + ' min · ' : ''}max reps`;
    if (it.minutes) return `${it.minutes} min`;
    return it.note || '';
  }
  if (block.format === 'tabata') return `${block.work}s on / ${block.rest}s off`;
  if (block.format === 'skill') {
    return it.sets ? `${it.sets} × ${it.hold}s · rest ${fmtRest(it.rest)}` : `${it.minutes || ''} min`;
  }
  if (block.format === 'yates') {
    return `${it.warmups || 0} warm-up → 1 all-out${it.perSide ? ' / side' : ''} (~${it.reps} ${u})`;
  }
  if (block.format === 'rest_pause') return `rest-pause → ${it.target} ${u}`;
  // straight / tempo / isometric
  const sets = it.sets || 1;
  const tgt = it.hold != null ? `${it.hold}s` : `${it.reps != null ? it.reps : (it.target ?? '')} ${u}`;
  const warm = it.warmups ? `${it.warmups} warm-up → ` : '';
  const rest = it.rest != null ? ` · rest ${fmtRest(it.rest)}` : '';
  const tempo = it.tempo ? ` · ${it.tempo}` : '';
  return `${warm}${sets} × ${tgt}${rest}${tempo}`;
}

function fmtRest(s) {
  if (s == null) return '';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), ss = s % 60;
  return ss ? `${m}:${String(ss).padStart(2, '0')}` : `${m}:00`;
}

/* rough minute estimate for one resolved block (for the Day view) */
const RS = 2;
function itemWorkSec(it) { return it.measure === 'hold' ? (it.hold || it.target || 20) : (it.reps || it.target || 10) * RS; }
export function blockMinutes(b) {
  /* A coach's own number beats an estimate of it. Everything below works
     out how long a block SHOULD take from its sets and rests; a block a
     person wrote already carries how long they meant it to take. */
  if (b.coachMinutes && b.minutes) return b.minutes;
  if (['jointprep', 'amrap', 'emom'].includes(b.format)) return b.minutes || 0;
  if (b.format === 'tabata') return Math.max(1, Math.round((b.rounds * b.items.length * ((b.work || 20) + (b.rest || 10))) / 60));
  if (b.format === 'circuit') {
    const rt = b.items.reduce((s, it) => s + itemWorkSec(it) + (b.transition ?? 8), 0) + (b.roundRest ?? 0);
    return Math.max(1, Math.round((b.rounds || 1) * rt / 60));
  }
  if (b.format === 'superset') {
    // both moves back-to-back, then one rest — that pattern, N times
    const rt = b.items.reduce((s, it) => s + itemWorkSec(it) + 8, 0) + (b.rest ?? 75);
    return Math.max(1, Math.round((b.rounds || 3) * rt / 60));
  }
  let sec = 0;
  for (const it of b.items) {
    const sets = it.sets || (b.format === 'yates' ? (it.warmups || 0) + 1 : 1);
    const rest = it.rest ?? (b.format === 'yates' ? 120 : 60);
    sec += sets * (itemWorkSec(it) + rest);
  }
  return Math.max(1, Math.round(sec / 60));
}

/* addable exercises of a given measure (for "+ Add exercise"), forearm-aware */
export function libraryFor(measure, { constraint, equipment } = {}, exclude = []) {
  const prof = currentProfile();
  const have = equipment || prof.equipment;
  const gymOk = !!prof.gymLibrary;
  let list = Object.entries(EXERCISES).filter(([id, m]) =>
    m.measure === measure && !exclude.includes(id) && canDoWith(m, have) && (!m.gymOnly || gymOk));
  if (constraint && /supinated|neutral/.test(constraint)) list = list.filter(([, m]) => m.grip !== 'pronated');
  return list.map(([id, m]) => ({ id, name: m.name, pattern: m.pattern, level: m.level }))
    .sort((a, b) => a.pattern.localeCompare(b.pattern) || (a.level || 5) - (b.level || 5) || a.name.localeCompare(b.name));
}

/* swap candidates from the FULL library: any exercise of the same measure
   (so the prescription stays valid), minus what's already in the day,
   respecting the forearm grip constraint. Same-pattern ones are flagged
   `recommended` and sorted first. */
export function alternatives(exId, { constraint, equipment } = {}, exclude = []) {
  const cur = EXERCISES[exId];
  if (!cur) return [];
  const prof = currentProfile();
  const have = equipment || prof.equipment;        // only offer moves you can actually do
  const gymOk = !!prof.gymLibrary;
  const fam = FAMILY[cur.pattern];
  const diff = cur.diff || 5;                          // numeric 1-10 for difficulty distance
  const curFams = famOf(cur);
  let list = Object.entries(EXERCISES).filter(([id, m]) =>
    id !== exId && !exclude.includes(id) && m.measure === cur.measure && (!!m.noPR === !!cur.noPR)
    && canDoWith(m, have) && (!m.gymOnly || gymOk));
  if (constraint && /supinated|neutral/.test(constraint))
    list = list.filter(([, m]) => m.grip !== 'pronated');
  return list
    .map(([id, m]) => ({
      id, name: m.name, pattern: m.pattern, diff: m.diff, level: m.level,
      sameTrack: curFams.size > 0 && [...famOf(m)].some(f => curFams.has(f)),
      samePat: m.pattern === cur.pattern, sameFam: FAMILY[m.pattern] === fam, dl: Math.abs((m.diff || 5) - diff),
    }))
    // same track (progression family) first → same movement pattern → same family → closest difficulty
    .sort((a, b) => (b.sameTrack - a.sameTrack) || (b.samePat - a.samePat) || (b.sameFam - a.sameFam) || (a.dl - b.dl) || a.name.localeCompare(b.name))
    .map(a => ({ id: a.id, name: a.name, pattern: a.pattern, diff: a.diff, level: a.level, recommended: a.samePat || a.sameFam }));
}
