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
import { exerciseImage } from '../data/exercise-images.js';
import { DEMOS } from './demo.js';
import { activeUserId } from '../users.js';
import { applyWorkTheme } from './theme.js';
import { loadPrefs, openPrefs, pref } from './prefs.js';
import { installHold } from './hold.js';
import { makeSortable } from './drag.js';
import { readHistory, sigOf, showWeight } from './tally.js';
import { ringHTML, ringBaseCss, ringDesign } from './ring.js';
import { t, t2, num, exName, exCues, lang, setLang } from '../i18n.js';
import { PICKS, LEVEL } from './quick-picks.js';
import { buildFromGoal, burpeeClub } from './rep-goal.js';
import { videoEmbed, videoSearch } from '../data/exercise-videos.js';
import { VOICE_CUES } from '../data/voice-cues.js';
import { isInstalled, isIOS, isIOSSafari, isIOSOtherBrowser, isAndroid, canPromptInstall, promptInstall, onInstallStateChange } from '../install.js';

/* ?demo adds the Work Mode preview: a sample of every program format */
const showDemo = () => new URLSearchParams(location.search).has('demo');
const standalone = () => window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;

/* every type the setup screen offers, with its "how it works" */
const FORMATS = [
  /* simplest and best known first */
  { id: 'stopwatch', name: 'Stopwatch', sub: 'Count up, with laps', moves: false,
    how: ['Counts up from 0.', 'Tap the ring to pause. Tap Done to stop.'] },
  { id: 'timer', name: 'Interval timer', sub: 'Work, rest, rounds', moves: true,
    how: ['Work, rest, repeat.', 'Set how long to work. Add rest and more rounds to repeat it.',
      'Examples: a 2:00 plank (1 round, no rest). Or 5:00 work, 2:00 rest, 3 rounds.',
      'Customize can repeat the whole thing, with a longer break in between: 3 times 4 rounds, 2:00 off between them.'] },
  { id: 'tabata', name: 'Tabata', sub: '20s on, 10s off', moves: true,
    how: ['20 seconds all out, 10 seconds rest, 8 rounds. 4 minutes.', 'With 2 moves it becomes 16 rounds, 8 of each, alternating: move 1, move 2, move 1… Lower the rounds if you want it shorter.', 'Change the times in Customize if you want a different mix.'] },
  { id: 'emom', name: 'EMOM', sub: 'Every minute on the minute', moves: true,
    how: ['Every minute on the minute.', 'When the minute starts, do your reps. Whatever is left of the minute is your rest. Then the next minute starts.',
      'With 2 or more moves, choose in Customize: take turns (minute 1 burpees, minute 2 squats) or all of them every minute.',
      'Example: 10 minutes, 10 burpees = 10 rounds, 1 every minute.'] },
  { id: 'amrap', name: 'AMRAP', sub: 'As many rounds as possible', moves: true,
    how: ['As many rounds as possible.', 'Set the time, then go through your moves again and again until the clock runs out. Tap + each time you finish a round.',
      'Example: 10 minutes of 5 pull-ups, 10 push-ups, 15 squats.'] },
  { id: 'fortime', name: 'For time', sub: 'Finish fast, beat the clock', moves: true,
    how: ['Race the clock.', 'Do all the work as fast as you can, then tap Done. Your time is your score.',
      'Add a time cap and the clock stops you there if you are not finished.'] },
  { id: 'goal', name: 'Rep goal', sub: 'Your totals, built into a workout', moves: true,
    how: ['Set a total for each move, pick how to run it, the timer builds the workout.', 'Example: 200 push-ups, 75 pull-ups, 500 mountain climbers, 300 squats. As an EMOM: 40 minutes, every minute 5 push-ups, 2 pull-ups, 13 mountain climbers, 8 squats.',
      'Ladder: the reps climb rung by rung and add up to your totals. Sets: your totals cut into short sets, rest as long as each set took. For time: tap your reps in as you go.',
      'The sizes come from how long each rep takes, so every minute or rung is doable.'] },
  { id: 'vo2', name: 'VO2 max', sub: 'Proven cardio intervals', moves: false,
    how: ['Intervals that raise your VO2 max: the most oxygen your body can use. The best predictor of fitness and long life.',
      'Pick a protocol. Hard means hard: you should not be able to hold a conversation. Easy means moving, slowly.',
      'Any cardio works: bike, rower, running, ski erg, jump rope. Once or twice a week is plenty.'] },
  { id: 'ladder', name: 'Ladder', sub: 'Reps climb or drop', moves: true,
    how: ['A rep ladder, for time.', 'Each move has its own start and its own change per rung. Pull-ups start at 1 and go up by 1, push-ups start at 40 and go down by 2: rung 1 is 1 + 40, rung 2 is 2 + 38…',
      'Shape: one way (up or down), there and back (pyramid 1→10→1, or valley 10→1→10), or wave (1, 10, 2, 9…).',
      'Tap "Rung done" after each rung. Every rung gets its own time. The presets set it all up in 1 tap.'] },
  { id: 'igyg', name: 'You go, I go', sub: 'Rest as long as your set took', moves: true,
    how: ['Partner style: one team works, the other rests, then swap. Your rest is as long as your last set took.', 'List your sets in order. Tap "Set done" when you finish: the rest runs, the next set starts on its own.',
      'Burpees can carry push-ups: 20 burpees with 5 push-ups each = 100 push-ups. The Burpee Club picks build 1,000 push-ups that way.',
      'Rest can also be fixed (Rest: Fixed).'] },
  { id: 'deathby', name: 'Death By', sub: '+1 rep every minute', moves: true,
    how: ['Death By.', 'Minute 1: 1 rep. Minute 2: 2 reps. Minute 3: 3 reps. Every minute the reps go up.',
      'Keep going until you can\'t finish the reps inside the minute, then tap "I can\'t finish this one". Your score is the last round you completed.',
      'Customize changes the start, the jump each round, and the interval.'] },
  { id: 'pushup', name: 'Push-up test', sub: '1 rep every 3 seconds', moves: false,
    how: ['The push-up beep test.', 'A 10-second countdown, then a DOUBLE beep: that is your start. After it, 1 beep every 3 seconds: on each one, go down and come back up before the next. That is 20 a minute. The coach counts every rep out loud.',
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
  sets:     ['Repeat the whole thing', 'times', 1,  1,  10],
  setRest:  ['Break in between', 'time', 15,  0, 1800],
  pace:     ['Pace',              'a min', 1, 10,  40],
  dbEvery:  ['Every',             'time', 15, 15, 300],
  dbMax:    ['Stop after',        'rounds', 1, 1,  60],
  ldRungs:  ['Rungs',             '',      1,  1,  50],
  ldCap:    ['Time cap',          'min',   1,  0,  90],
  ptCap:    ['Time cap',          'min',   1,  0,  10],
  igRestSec: ['Rest',             'time',  5,  5, 600],
};
const isTime = k => FIELDS[k][1] === 'time';
/* the numbers on the main screen, and the ones under "Customize" */
const MAIN = {
  emom: ['mins'], amrap: ['cap'], fortime: ['ftRounds', 'ftCap'], tabata: ['rounds'],
  timer: ['work', 'rest', 'rounds'], stopwatch: [], pushup: ['pace'],
  deathby: ['dbEvery', 'dbMax'], ladder: ['ldRungs', 'ldCap'], vo2: [], goal: [], igyg: [],
};
const MORE = {
  emom: ['every'], amrap: [], fortime: [], tabata: ['work', 'rest'],
  timer: ['sets', 'setRest'], stopwatch: [], pushup: ['ptCap'],
  deathby: [], ladder: [], vo2: [], goal: [], igyg: [],
};
const DEFAULTS = {
  fmt: 'emom', every: 60, mins: 12, cap: 10, ftCap: 0, ftRounds: 1,
  work: 20, rest: 10, rounds: 8, sets: 1, setRest: 60,
  tWork: 120, tRest: 0, tRounds: 1, pace: 20, paceV: 2, ptCap: 0,
  dbEvery: 60, dbMax: 30,
  ldRungs: 10, ldShape: 'one', ldCap: 0,
  emomStyle: 'turns', ready: 10, vo2: 'n4x4', goalAs: 'emom', igRest: 'same', igRestSec: 30,
};
const TABATA = { work: 20, rest: 10, rounds: 8 };
const PREF = 'quickTimer';

/* the timer workouts done on this device (tally.js), for "last time" */
let hist = [];
let cfg = null, favs = [], host = null, onStart = null, moreOpen = false, guest = false;
let favIdx = null;              // the saved timer currently loaded, if any

/* Tabata and Timer both have work / rest / rounds, with very different
   numbers (20s vs 5 min). Timer keeps its own copy so switching between
   them never turns a 5-minute round into 20 seconds. */
const TIMER_KEYS = { work: 'tWork', rest: 'tRest', rounds: 'tRounds' };
const key = k => (cfg.fmt === 'timer' && TIMER_KEYS[k]) || k;
/* TABATA ROUNDS ARE EVERY INTERVAL. 2 moves = 16 rounds (8 of each,
   alternating), set the moment the second move is added; lower it (or
   raise it) and that number holds until the number of moves changes. */
const tbTotal = () => { const n = perRound(); return cfg.tbN === n && cfg.tbTotal ? cfg.tbTotal : cfg.rounds * n; };
const val = k => cfg.fmt === 'tabata' && k === 'rounds' ? tbTotal() : cfg[key(k)];
const setVal = (k, v) => { if (cfg.fmt === 'tabata' && k === 'rounds') { cfg.tbTotal = v; cfg.tbN = perRound(); return; } cfg[key(k)] = v; };

export async function renderQuick(el, opts = {}) {
  host = el; onStart = opts.onStart; guest = !!opts.guest;
  injectStyle(); applyWorkTheme(); loadPrefs(); installHold();
  onInstallStateChange(() => { if (host && cfg) draw(); });   // Android announces it can install a moment after load
  if (!window.__qtLang) { window.__qtLang = 1; document.addEventListener('fj-lang', () => { if (host && cfg) draw(); }); }   // a new language: redraw
  readHistory().then(h => { hist = h; if (host && cfg) draw(); });
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
  /* a shared timer: index.html?quick&t=<code> opens exactly that setup */
  let shared = false;
  try {
    const p = new URLSearchParams(location.search);
    if (p.get('t')) {
      const got = unpack(p.get('t'));
      /* a shared timer's moves belong to its type, whatever that type is */
      if (got && Array.isArray(got.moves)) { got.movesBy = { [got.fmt]: got.moves }; delete got.moves; }
      if (got) { cfg = migrate({ ...DEFAULTS, ...got, paceV: 2 }); favIdx = null; persist(); shared = true; }
      p.delete('t'); history.replaceState(null, '', `${location.pathname}?${p.toString().replace(/=(&|$)/g, '$1')}`);
    }
  } catch (e) {}
  draw();
  if (shared) toast(t('Timer loaded: {x}', { x: planName() }));
}
/* setups saved before Intervals and Countdown became Timer */
function migrate(c) {
  if (c.fmt === 'intervals') Object.assign(c, { fmt: 'timer', tWork: c.work, tRest: c.rest, tRounds: c.rounds });
  if (c.fmt === 'countdown') Object.assign(c, { fmt: 'timer', tWork: Math.max(5, (c.cdMin || 0) * 60 + (c.cdSec || 0)), tRest: 0, tRounds: 1, sets: 1 });
  if (!FORMATS.some(f => f.id === c.fmt)) c.fmt = 'emom';
  if (c.ldStyle) {
    const lo = Math.min(c.ldFrom || 1, c.ldTo || 10), hi = Math.max(c.ldFrom || 1, c.ldTo || 10), st = c.ldStep || 1;
    c.ldRungs = Math.floor((hi - lo) / st) + 1; c.ldShape = c.ldStyle === 'pyramid' ? 'mirror' : 'one';
    (c.moves || c.movesBy?.ladder || []).forEach(m => { m.ldStart = c.ldStyle === 'down' ? hi : lo; m.ldStep = c.ldStyle === 'down' ? -st : st; });
    delete c.ldStyle;
  }
  /* ONE MOVE LIST PER TYPE. A single shared list carried an EMOM's three
     moves into a Ladder that should start with one. Older saves (and shared
     links) bring their `moves` to the type they were saved under. */
  c.movesBy = { ...(c.movesBy || {}) };
  /* (a Ladder or Death By starts with one clean row: the old shared list
     was usually another type's moves) */
  if (Array.isArray(c.moves) && c.moves.length && !c.movesBy[c.fmt] && !['ladder', 'deathby'].includes(c.fmt)) c.movesBy[c.fmt] = c.moves;
  delete c.moves;
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
/* this type's move rows; a type starts with one empty row */
function MV() {
  const list = cfg.movesBy[cfg.fmt];
  if (Array.isArray(list) && list.length) return list;
  return (cfg.movesBy[cfg.fmt] = [newMove()]);
}
const newMove = () => cfg.fmt === 'deathby' || cfg.fmt === 'ladder' ? { name: '', reps: '', ldStart: 1, ldStep: 1 } : { name: '', reps: '' };
const namedMoves = () => (FORMATS.find(f => f.id === cfg.fmt)?.moves ? MV() : [])
  .filter(m => String(m.name || '').trim())
  .map(m => {
    const ex = m.exId && EXERCISES[m.exId];
    const n = Number(m.reps) > 0 && cfg.fmt !== 'tabata' && cfg.fmt !== 'timer' ? Number(m.reps) : null;   // time-based types carry no rep target
    return ex
      ? { exId: m.exId, name: exName(m.exId, ex.name), measure: ex.measure || 'reps', load: ex.load, laterality: ex.laterality, cue: exCues(m.exId, ex.cues), reps: n, ...(ex.measure === 'hold' && n ? { hold: n } : {}), ...(Number(m.wt) > 0 ? { weight: Number(m.wt), wUnit: wUnit() } : {}), noPR: true }
      : { name: String(m.name).trim(), measure: 'reps', reps: n, ...(Number(m.wt) > 0 ? { weight: Number(m.wt), wUnit: wUnit() } : {}), noPR: true };
  });

/* In Tabata and Timer a round is EVERY move once: 8 rounds of 2 moves is
   16 intervals, not 8 shared between them. */
const perRound = () => Math.max(1, namedMoves().length);
/* ---------------- ladder ----------------
   Every move carries its own start and its own change per rung (ldStart,
   ldStep on the move), so one can climb while another drops. The shape
   decides the order the rungs are walked in:
     one     rung 1 … N                  (up, down, or opposite pairs)
     mirror  1 … N … 1                   (pyramid, or valley if it drops)
     wave    1, N, 2, N-1 …              (the waving ladder) */
const LD_SHAPES = [['one', 'One way'], ['mirror', 'There & back'], ['wave', 'Wave']];
const LD_PRESETS = [
  { id: 'up',     name: '1 → 10',        n: 10, shape: 'one',    m: [[1, 1]] },
  { id: 'down',   name: '10 → 1',        n: 10, shape: 'one',    m: [[10, -1]] },
  { id: 'pyr',    name: 'Pyramid 1→10→1', n: 10, shape: 'mirror', m: [[1, 1]] },
  { id: 'valley', name: 'Valley 10→1→10', n: 10, shape: 'mirror', m: [[10, -1]] },
  { id: 'seesaw', name: 'Seesaw: 1 up, 1 down', n: 10, shape: 'one', m: [[1, 1], [10, -1]] },
  { id: 'wave',   name: 'Wave 1-10-2-9', n: 10, shape: 'wave',   m: [[1, 1]] },
  { id: '21159',  name: '21-15-9',       n: 3,  shape: 'one',    m: [[21, -6]] },
];
const ldStart = m => Number.isFinite(+m.ldStart) && m.ldStart !== '' ? Math.max(1, +m.ldStart) : 1;   // never a 0-rep start, even from an old save
const ldStep = m => Number.isFinite(+m.ldStep) && m.ldStep !== '' ? +m.ldStep : 1;
/* the ladder's moves: the named ones, or the first row as plain "Reps" */
function ladderMoves() {
  const rows = MV().filter(m => String(m.name || '').trim());
  return rows.length ? rows : [MV()[0]];
}
/* NO RUNG EVER HITS 0. A dropping move can only go as far as 1, so the
   ladder stops there: 20 down by 2 is 10 rungs (20 … 2), whatever the
   rung count says. */
function maxRungs() {
  return ladderMoves().reduce((n, m) => {
    const st = ldStep(m), a = ldStart(m);
    return st < 0 && ldMode(m) !== 'flat' ? Math.min(n, Math.max(1, Math.floor((a - 1) / -st) + 1)) : n;
  }, 50);
}
const rungCount = () => Math.max(1, Math.min(cfg.ldRungs, maxRungs()));
/* typing the top (or bottom) number: the rung count that reaches it */
function setLadderEnd(v) {
  const m = ladderMoves()[0], st = ldStep(m);
  cfg.ldRungs = st ? Math.floor((v - ldStart(m)) / st) + 1 : v;
  cfg.ldRungs = Math.max(1, Math.min(cfg.ldRungs, maxRungs()));
}
function rungOrder() {
  const n = rungCount(), idx = [...Array(n).keys()];
  if (cfg.ldShape === 'mirror') return [...idx, ...idx.slice(0, -1).reverse()];
  if (cfg.ldShape === 'wave') { const o = []; for (let a = 0, b = n - 1; a <= b; a++, b--) { o.push(a); if (a !== b) o.push(b); } return o; }
  return idx;
}
const repsAt = (m, i) => Math.max(0, ldStart(m) + i * ldStep(m));
/* EACH MOVE ITS OWN SHAPE on the same rungs: Climb (start, then + or − the
   step each rung), Pyramid (climbs to the middle rung, then back down) or
   Same (the start number every rung). 10 pull-ups climbing, push-ups as a
   pyramid, 20 squats every rung. */
const LD_MODES = [['line', 'Climb'], ['pyr', 'Pyramid'], ['flat', 'Same']];
const ldMode = m => LD_MODES.some(x => x[0] === m?.ldMode) ? m.ldMode : 'line';
function moveSeq(m) {
  const order = rungOrder(), L = order.length, mode = ldMode(m);
  return order.map((i, j) => mode === 'flat' ? ldStart(m) : mode === 'pyr' ? Math.max(1, ldStart(m) + Math.min(j, L - 1 - j) * ldStep(m)) : repsAt(m, i));
}
/* rungs[k] = one number per move */
function rungs() { if (Array.isArray(cfg.ldList)) return cfg.ldList; const seqs = ladderMoves().map(moveSeq); return rungOrder().map((_, j) => seqs.map(q => q[j])); }
function ladderPreview(m) {
  const seq = moveSeq(m); const total = seq.reduce((a, b) => a + b, 0);
  const shown = seq.length > 10 ? `${seq.slice(0, 5).join(', ')} … ${seq.slice(-2).join(', ')}` : seq.join(', ');
  return `${shown} · ${t('{n} total', { n: total })}`;
}
/* Death By: the first rounds, so the climb is obvious */
function deathPreview(m) {
  const r = [0, 1, 2, 3, 4].map(i => Math.max(0, ldStart(m) + i * Math.max(0, ldStep(m))));
  return t('round 1: {a}, round 2: {b}, round 3: {c} …', { a: r[0], b: r[1], c: r[2] });
}
function applyPreset(p) {
  cfg.ldRungs = p.n; cfg.ldShape = p.shape;
  const list = MV();
  while (list.length < p.m.length) list.push(newMove());
  list.forEach((m, i) => { const [a, d] = p.m[Math.min(i, p.m.length - 1)]; m.ldStart = a; m.ldStep = d; });
}
function emomCount() { return Math.max(1, Math.floor((cfg.mins * 60) / cfg.every)); }
/* VO2 MAX: the five protocols Nico picked (docs/WORK-MODE.md has the sources).
   work / rest in seconds, n rounds, an optional warm-up and cool-down. */
const VO2 = [
  { id: 'n4x4', name: 'Norwegian 4×4', sub: '4 min hard, 3 min easy, × 4', note: 'Hard is 90 to 95% of your max heart rate. The most studied VO2 max workout. Warm up 10 minutes first.', work: 240, rest: 180, n: 4 },
  { id: 'h2x2', name: 'Huberman 2×2', sub: '2 min max effort, 2 min rest, × 3', note: 'As hard as you can hold for the full 2 minutes.', work: 120, rest: 120, n: 3 },
  { id: 'z5', name: 'Zone 5 bike', sub: '20 s all-out, 10 s rest, × 8', note: 'Best on an assault bike. Every interval is a sprint.', work: 20, rest: 10, n: 8 },
  { id: 's2040', name: '20/40 sprints', sub: '20 s all-out, 40 s easy, × 8', note: 'Sprint, then keep moving easy while you recover.', work: 20, rest: 40, n: 8 },
  { id: 'g1min', name: 'The 1-minute workout', sub: '3 × 20 s all-out, 2 min easy between', note: 'Gibala\'s study: 2 min warm-up and 3 min cool-down included. 10 minutes in all.', work: 20, rest: 120, n: 3, warm: 120, cool: 180 },
];
const vo2 = () => VO2.find(p => p.id === cfg.vo2) || VO2[0];
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
    case 'tabata': return intervalSec(cfg.work, cfg.rest, tbTotal());
    case 'timer': return intervalSec(cfg.tWork, cfg.tRest, cfg.tRounds * perRound(), cfg.sets, cfg.setRest);
    case 'pushup': return cfg.ptCap ? cfg.ptCap * 60 : null;
    case 'deathby': return cfg.dbMax * cfg.dbEvery;
    case 'ladder': return cfg.ldCap ? cfg.ldCap * 60 : null;
    case 'goal': { const g = goalBuilt(); return g?.cfg.fmt === 'emom' ? g.cfg.mins * 60 : null; }
    case 'vo2': { const p = vo2(); return intervalSec(p.work, p.rest, p.n) + (p.warm || 0) + (p.cool || 0); }
    default: return null;
  }
}
/* the big "how long" above Start */
function totalBadge() {
  const t = totalSec();
  if (t) return { big: fmt(t), small: ['fortime', 'pushup', 'deathby', 'ladder'].includes(cfg.fmt) ? 'max' : 'total' };
  return { big: '∞', small: cfg.fmt === 'pushup' ? 'till you miss' : 'open' };
}
const secs = v => v >= 60 ? fmt(v) : t('{n} s', { n: v });
/* a move's name in the current language (library moves have a French name) */
const mvName = m => exName(m?.exId, String(m?.name || '').trim());
/* one line under it: what you're about to do, in plain words */
function summary() {
  const moves = namedMoves();
  switch (cfg.fmt) {
    case 'goal': { const g = goalBuilt(); if (!g) return t('Add your moves and their totals');
      return g.cfg.fmt === 'emom' ? t('EMOM {n} min', { n: g.cfg.mins }) : g.cfg.fmt === 'ladder' ? t2(g.rows, '{n} rung', '{n} rungs') : g.cfg.fmt === 'igyg' ? t2(g.rows, '{n} set', '{n} sets') : t('For time'); }
    case 'igyg': return igygLine();
    case 'emom': {
      const style = moves.length > 1 ? (cfg.emomStyle === 'all' ? t(' · all {n} moves each round', { n: moves.length }) : t(' · {n} moves take turns', { n: moves.length })) : '';
      return t('{n} rounds, a new one every {every}', { n: emomCount(), every: secs(cfg.every) }) + style;
    }
    case 'amrap': return moves.length ? t2(moves.length, '{n} move per round', '{n} moves per round') : t('Tap + for every round you finish');
    case 'fortime': return `${t2(cfg.ftRounds, '{n} round', '{n} rounds')}, ${cfg.ftCap ? t('{n} min cap', { n: cfg.ftCap }) : t('no cap')}`;
    case 'tabata': {
      const n = perRound();
      return t('{n} rounds', { n: tbTotal() }) + (n > 1 ? t(', alternating {n} moves', { n }) : '') + t(', {on} on, {off} off', { on: secs(cfg.work), off: secs(cfg.rest) });
    }
    case 'vo2': return t(vo2().note);
    case 'timer': {
      const r = cfg.tRounds;
      const n = perRound();
      const core = `${r > 1 ? t('{n} rounds of ', { n: r }) : ''}${n > 1 ? t('{n} moves, ', { n }) : ''}${t('{t} work', { t: secs(cfg.tWork) })}${cfg.tRest && (r > 1 || n > 1) ? t(', {t} rest', { t: secs(cfg.tRest) }) : ''}`;
      return cfg.sets > 1 ? core + t(', done {n} times, {t} break in between', { n: cfg.sets, t: secs(cfg.setRest) }) : core;
    }
    case 'deathby': { const ms = ladderMoves(); return t('Round 1: {what}, then more every {t} until you can\'t', { what: ms.map(m => `${ldStart(m)}${mvName(m) ? ' ' + mvName(m) : ''}`).join(' + '), t: secs(cfg.dbEvery) }); }
    case 'ladder': {
      const ms = ladderMoves(), r = rungs();
      const tot = ms.map((m, i) => `${r.reduce((a, x) => a + x[i], 0)} ${mvName(m) || t('reps')}`).join(', ');
      return `${t('{n} rungs', { n: r.length })} · ${tot}${cfg.ldCap ? ` · ${t('{n} min cap', { n: cfg.ldCap })}` : ''}`;
    }
    case 'stopwatch': return t('Tap the ring to pause');
    case 'pushup': { const h = num(Math.round(3000 * 20 / cfg.pace / 2) / 1000, 2); return t('{n} a minute: {h} s down, {h} s up', { n: cfg.pace, h }) + (cfg.pace === 25 ? ' (NHL)' : ''); }
    default: return '';
  }
}
/* the name of what is about to run (header, result card, history) */
function planName() {
  const f = cfg.fmt;
  if (f === 'emom') return cfg.every === 60 ? `EMOM · ${cfg.mins} min` : `${t('Every {t}', { t: fmt(cfg.every) })} · ${cfg.mins} min`;
  if (f === 'amrap') return `AMRAP · ${cfg.cap} min`;
  if (f === 'fortime') return `${t('For time')}${cfg.ftCap ? ` · ${t('{n} min cap', { n: cfg.ftCap })}` : ''}`;
  if (f === 'tabata') return `Tabata · ${tbTotal()} × ${cfg.work}/${cfg.rest}`;
  if (f === 'timer') return `${t('Interval timer')} · ${cfg.tRounds > 1 ? `${cfg.tRounds} × ` : ''}${fmt(cfg.tWork)}${cfg.tRest && cfg.tRounds > 1 ? ` / ${fmt(cfg.tRest)}` : ''}${cfg.sets > 1 ? ` · ${t('{n} times', { n: cfg.sets })}` : ''}`;
  if (f === 'pushup') return `${t('Push-up test')} · ${t('{n} a min', { n: cfg.pace })}`;
  if (f === 'vo2') return `VO2 max · ${t(vo2().name)}`;
  if (f === 'deathby') { const ms = ladderMoves().filter(m => mvName(m)); return `Death By${ms.length ? ' · ' + ms.map(mvName).join(', ') : ''}${cfg.dbEvery !== 60 ? ` ${t('every {t}', { t: fmt(cfg.dbEvery) })}` : ''}`; }
  if (f === 'goal') return `${t('Rep goal')} · ${namedMoves().map(m => `${m.reps || 0} ${m.name}`).join(', ')}`;
  if (f === 'igyg') return `${t('You go, I go')} · ${t2(namedMoves().length, '{n} set', '{n} sets')}`;
  if (f === 'ladder') { const ms = ladderMoves(); return `${t('Ladder')} · ${ms.map(m => `${mvName(m) || t('reps')} ${ldMode(m) === 'flat' ? t('{n} each rung', { n: ldStart(m) }) : `${ldStart(m)} ${ldStep(m) >= 0 ? '+' : '−'}${Math.abs(ldStep(m))}${ldMode(m) === 'pyr' ? ' ' + t('pyramid') : ''}`}`).join(', ')}${cfg.ldShape === 'mirror' ? t(' and back') : cfg.ldShape === 'wave' ? t(' wave') : ''}`; }
  return t('Stopwatch');
}

const withCfg = (c, plan) => (plan && (plan.quickCfg = c), plan);
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
          ...(moves.length ? { bites: true } : { hideList: true, items: [{ name: 'Time', measure: 'hold' }] }) }];   // moves: tap reps in as you go
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
      case 'deathby':
        blocks = [{ ...base, id: id(1), name, format: 'emom', label: 'Death By', work: cfg.dbEvery, rest: 0, intervals: cfg.dbMax,
          ladder: { start: 1, step: 1 }, allEach: moves.length > 1,
          /* each move climbs on its own: its start, its jump per round */
          items: ladderMoves().map((m, i) => ({ ...(moves[i] || { name: 'Reps', measure: 'reps' }), dbStart: ldStart(m), dbStep: Math.max(0, ldStep(m)) })) }];
        break;
      case 'goal': {
        /* the goal, built into the type picked, then planned as that type */
        const g = goalBuilt(); if (!g) break;
        const goalCfg = JSON.parse(JSON.stringify(cfg));
        cfg = prev;   // restored below by the recursive call's finally
        return withCfg(goalCfg, buildPlan({ ...c, ...g.cfg, movesBy: { ...(c.movesBy || {}), [g.cfg.fmt]: g.moves }, ...(g.list ? { ldList: g.list } : {}) }));
      }
      case 'igyg': {
        /* each set is a row; the moves (for the totals) are the rows' moves, once each */
        const pairs = MV().filter(m => String(m.name || '').trim()).map((m, i) => [m, moves[i]]).filter(([m]) => Number(m.reps) > 0);
        const keyOf = m => m.exId || mvName(m), uniq = [...new Set(pairs.map(([m]) => keyOf(m)))];
        const items = uniq.map(k => ({ ...pairs.find(([m]) => keyOf(m) === k)[1], reps: null }));
        const rows = pairs.map(([m]) => m);
        blocks = [{ ...base, id: id(1), name, format: 'igyg', label: 'You go, I go', items,
          sets: rows.map(m => ({ i: uniq.indexOf(keyOf(m)), reps: Number(m.reps), pumps: Number(m.pumps) || 0 })),
          restMode: cfg.igRest === 'fixed' ? 'fixed' : 'same', rest: cfg.igRestSec, restMin: 10 }];
        break;
      }
      case 'ladder':
        blocks = [{ ...base, id: id(1), name, format: 'fortime', label: 'Ladder', minutes: cfg.ldCap, rungs: rungs(),
          ...(moves.length ? {} : { hideList: true, items: [{ name: 'Reps', measure: 'reps' }] }) }];
        break;
      case 'tabata':
        blocks = [{ ...base, id: id(1), name, format: 'tabata', label: 'Tabata',
          work: cfg.work, rest: cfg.rest, rounds: tbTotal(), perRound: 1, intervals: tbTotal(),
          items: moves.length ? moves : work }];
        break;
      case 'vo2': {
        /* the protocol on the interval engine (round calls, halfway, one
           minute left); a warm-up and cool-down are blocks of their own */
        const p = vo2(), easy = n => ({ name: n, measure: 'rounds' });
        if (p.warm) blocks.push({ ...base, id: id(1), name: 'Warm-up · easy pace', format: 'tabata', label: 'Warm-up', work: p.warm, rest: 0, rounds: 1, perRound: 1, intervals: 1, restAfter: 0, items: [easy('Work')] });
        blocks.push({ ...base, id: id(2), name, format: 'tabata', label: 'VO2 max', work: p.work, rest: p.rest, rounds: p.n, perRound: 1, intervals: p.n, restAfter: 0, items: work });
        if (p.cool) blocks.push({ ...base, id: id(3), name: 'Cool-down · easy pace', format: 'tabata', label: 'Cool-down', work: p.cool, rest: 0, rounds: 1, perRound: 1, intervals: 1, items: [easy('Work')] });
        break;
      }
      case 'timer':
        for (let i = 0; i < cfg.sets; i++) {
          blocks.push({ ...base, id: id(i + 1), format: 'tabata', label: 'Intervals',
            name: cfg.sets > 1 ? `${i + 1} of ${cfg.sets}` : name,
            work: cfg.tWork, rest: cfg.tRest, rounds: cfg.tRounds, perRound: perRound(), intervals: cfg.tRounds * perRound(), restAfter: cfg.setRest,
            items: moves.length ? moves : work });
        }
        break;
    }
    return {
      name, sessionId: 'quick', quick: true, duration: Math.round((totalSec() || 0) / 60),
      quickCfg: JSON.parse(JSON.stringify(cfg)),   // the setup, so the history can run it again or save it
      /* the get-ready countdown is one setting for every timer (Timer
         settings, 8 s unless changed); a plan built in code can still pin it */
      fmt: FORMATS.find(f => f.id === cfg.fmt)?.name || cfg.fmt,
      getReady: cfg.readyOverride ?? pref('ready') ?? 8, returnTo: 'index.html?quick', finishLabel: 'Done', blocks,
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
/* THE LADDER'S TOP (or bottom), not a rung count. "Up to 10" is how a
   person says it, and with There and back it reads "1 up to 10 and back".
   It follows the first move; the rest keep their own start and change.
   + and − always move the shown number up or down. */
/* ONE ROW, EVERY SETTING. A coloured label on top, then − value + across
   the full width: the same shape for the main numbers and for Customize.
   The label's colour says what kind of number it is. */
const ROW_TONE = {
  mins: 'accent', cap: 'accent', work: 'accent', every: 'accent', dbEvery: 'accent', pace: 'accent',
  rest: 'neon', setRest: 'neon',
  rounds: 'violet', ftRounds: 'violet', sets: 'violet', dbMax: 'violet', ldRungs: 'violet',
  ftCap: 'ready', ptCap: 'ready', ldCap: 'ready',
};
function rowShell(k, label, face, foot, minus, plus, extra = '') {
  return `<div class="qt-srow tone-${ROW_TONE[k] || 'accent'}">
    <div class="qt-sl">${t(label)}</div>
    <div class="qt-sline">${minus}<div class="qt-sval">${face}</div>${plus}</div>
    ${foot ? `<div class="qt-su">${t(foot)}</div>` : ''}${extra}
  </div>`;
}
/* THE LADDER'S TOP (or bottom), not a rung count. "Up to 10" is how a
   person says it, and with There and back it reads "1 up to 10 and back".
   It follows the first move; the rest keep their own start and change.
   + and − always move the shown number up or down. */
function ladderEndRow() {
  const m = ladderMoves()[0], st = ldStep(m), n = rungCount();
  const label = st > 0 ? 'Up to' : st < 0 ? 'Down to' : 'Rungs';
  const v = st ? repsAt(m, n - 1) : n;
  const foot = st ? `${t2(n, '{n} rung', '{n} rungs')}${cfg.ldShape === 'mirror' ? t(' · and back') : ''}` : '';
  return rowShell('ldRungs', label,
    `<input class="qt-tv" data-ldend="1" type="number" inputmode="numeric" value="${v}" onfocus="this.select()"/>`, foot,
    '<button class="qt-pm" data-ldend-d="-1" aria-label="Lower">−</button>', '<button class="qt-pm" data-ldend-d="1" aria-label="Higher">+</button>');
}
function stepRow(k) {
  if (k === 'ldRungs') return ladderEndRow();
  const [label, unit] = FIELDS[k];
  const v = val(k);
  const none = ((k === 'ftCap' || k === 'ptCap' || k === 'ldCap') && !v) || ((k === 'rest' || k === 'setRest') && !v);
  const face = isTime(k)
    ? `<button class="qt-tv time" data-qt="${k}">${none ? t('none') : fmt(v)}</button>`
    : `<input class="qt-tv ${none ? 'none' : ''}" data-qf="${k}" type="number" inputmode="numeric" value="${none ? '' : v}" placeholder="${none ? t('none') : ''}" onfocus="this.select()"/>`;
  const tbn = cfg.fmt === 'tabata' && k === 'rounds' ? perRound() : 1;
  const foot = none ? '' : isTime(k) ? 'min : sec' : tbn > 1 ? (v % tbn ? t('alternating {n} moves', { n: tbn }) : t('{n} of each, alternating', { n: v / tbn })) : unit;
  const extra = k === 'pace' ? `<div class="qt-presets"><button class="${v === 20 ? 'on' : ''}" data-pace="20">${t('20 standard')}</button><button class="${v === 25 ? 'on' : ''}" data-pace="25">25 NHL</button></div>` : '';
  return rowShell(k, label, face, foot,
    `<button class="qt-pm" data-q="${k}" data-d="-1" aria-label="Less">−</button>`, `<button class="qt-pm" data-q="${k}" data-d="1" aria-label="More">+</button>`, extra);
}
/* ---------------- the screen's building blocks ----------------
   ONE LOOK FOR EVERYTHING. A section is a header and a card; a card is a
   stack of rows; every row has a small coloured label on top. Numbers are
   − value +; choices are equal buttons; a move is its name, then the same
   small −/+ controls. Nothing on this screen is drawn any other way. */
const sec = (title, right = '') => `<div class="qt-sec"><span>${t(title)}</span>${right}</div>`;
/* a row of equal choices (shape, countdown, EMOM style) */
function segRow(label, tone, opts, cur, attr, foot = '') {
  return `<div class="qt-srow tone-${tone}"><div class="qt-sl">${t(label)}</div>
    <div class="qt-seg2">${opts.map(([v, l]) => `<button class="${String(cur) === String(v) ? 'on' : ''}" ${attr}="${v}">${t(l)}</button>`).join('')}</div>
    ${foot ? `<div class="qt-su">${t(foot)}</div>` : ''}</div>`;
}
/* a timed move (plank, hang, wall sit): its numbers are seconds */
const isHold = m => !!(m && m.exId && EXERCISES[m.exId]?.measure === 'hold');
/* ONE MOVE, the same slim row as in the workout (workmode.js mvRow): the
   full name on one line (tap it to change the move), a small − value +,
   and ✕. A second slim line holds what else the move needs: Ladder /
   Death By's start and change, and the weight when there is one. */
/* weights in lb or kg: one choice for the whole timer, switched by tapping
   the unit itself (no extra button); a switch converts what is set */
const wUnit = () => cfg.wUnit === 'kg' ? 'kg' : 'lb';
const wStep = () => wUnit() === 'kg' ? 2.5 : 5;
const isWeighted = m => !!(m && m.exId && EXERCISES[m.exId]?.load === 'weighted');
function moveCard(m, i) {
  const lad = cfg.fmt === 'ladder', db = cfg.fmt === 'deathby';
  const sec = isHold(m), goal = cfg.fmt === 'goal';
  /* one slim − value + line; `label` sits small on its left */
  const line = (attr, face, label = '') => `<span class="qt-st">${label ? `<span class="qt-stl">${label}</span>` : ''}<button ${attr} data-d="-1" aria-label="${t('Less')}">−</button><b>${face}</b><button ${attr} data-d="1" aria-label="${t('More')}">+</button></span>`;
  const right = [];
  if (lad || db) {
    const step = ldStep(m);
    right.push(line(`data-lm="${i}" data-lf="ldStart"`, `${ldStart(m)}${sec ? '<small>s</small>' : ''}`, t('start')));
    if (!(lad && ldMode(m) === 'flat')) right.push(line(`data-lm="${i}" data-lf="ldStep"`, `${step > 0 ? '+' : ''}${step}`, db ? t('add') : t('per rung')));
  } else if (cfg.fmt !== 'tabata' && cfg.fmt !== 'timer') {   // time-based: no rep target, you log reps in the workout
    right.push(line(`data-mr="${i}"`, `<input data-mv="${i}" data-k="reps" type="number" inputmode="numeric" placeholder="–" value="${esc(m.reps)}" onfocus="this.select()"/>${sec ? '<small>s</small>' : ''}`, goal ? t('total') : ''));
    if (cfg.fmt === 'igyg' && canPump(m)) right.push(line(`data-mp="${i}"`, `${Number(m.pumps) || 0}`, t('push-ups each')));
  }
  /* the weight sits under the reps: always for a loaded move, on request
     (a faint "+ weight") for a bodyweight one */
  const hasWt = m.name && (isWeighted(m) || Number(m.wt) > 0);
  if (hasWt) right.push(line(`data-mw="${i}"`, `${Number(m.wt) > 0 ? m.wt : '–'}<span class="qt-wu" data-wu="1" role="button" aria-label="${t('Switch kg / lb')}">${wUnit()}</span>`));
  else if (m.name) right.push(`<button class="qt-addwt" data-mw="${i}" data-d="1">${t('+ weight')}</button>`);
  const note = lad ? ladderPreview(m) : db ? deathPreview(m) : '';
  return `<div class="qt-mvr">
    <div class="qt-mvr-top"><button class="qt-mvr-n ${m.name ? '' : 'empty'}" data-pick-move="${i}">${m.name ? esc(mvName(m)) : t('Choose move {n}', { n: i + 1 })}</button>
      <div class="qt-mvr-r">${right.join('')}</div>
      ${MV().length > 1 || m.name ? `<button class="qt-mx" data-mvx="${i}" aria-label="${t('Remove')}">✕</button>` : ''}</div>
    ${lad && m.name ? `<div class="qt-ldm">${LD_MODES.map(([v, l]) => `<button class="${ldMode(m) === v ? 'on' : ''}" data-ldmode="${i}" data-v="${v}">${t(l)}</button>`).join('')}</div>` : ''}
    ${note ? `<div class="qt-mnote">${note}</div>` : ''}
  </div>`;
}
function movesCard() {
  return `<div class="qt-mvlist">${MV().map(moveCard).join('')}
    <button class="qt-addrow2" id="qtAdd">${t('+ Add a move')}</button></div>`;
}
/* full names on one line: a list's names at the size its longest needs */
function fitMoveNames() {
  const els = [...host.querySelectorAll('.qt-mvr-n')]; let f = 99;
  els.forEach(el => { el.style.fontSize = ''; let s = parseFloat(getComputedStyle(el).fontSize) || 16;
    while (el.scrollWidth > el.clientWidth + 1 && s > 11) { s -= 0.5; el.style.fontSize = s + 'px'; } f = Math.min(f, s); });
  els.forEach(el => { el.style.fontSize = f + 'px'; });
}

/* GET IT ON THE HOME SCREEN. iPhones never offer it for a website (only
   Android does), so a new user who isn't told never finds it under Share.
   One card at the top until it is installed, in the words their phone
   needs: a real Install button on Android, the 3 Share steps in iPhone
   Safari, "open it in Safari first" anywhere it cannot be done (Chrome on
   iPhone, links opened inside Instagram / Facebook / WhatsApp). ✕ hides it
   for 2 weeks. */
const INSTALL_HIDE = 'fj.installCardHidden';
const inAppBrowser = () => /Instagram|FBAN|FBAV|FB_IAB|Messenger|WhatsApp|Line\/|Snapchat|TikTok|LinkedInApp/i.test(navigator.userAgent || '');
function installCard() {
  if (isInstalled()) return '';
  try { const h = Number(localStorage.getItem(INSTALL_HIDE)); if (h && Date.now() - h < 14 * 864e5) return ''; } catch (e) {}
  const share = '<svg class="qt-ishare" viewBox="0 0 20 24" aria-hidden="true"><path d="M10 15V2M5.5 6.5L10 2l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 10H3.5v12h13V10H14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  let body = '';
  if (canPromptInstall()) {
    body = `<b>${t('Put the timer on your home screen')}</b><small>${t('Its own icon, full screen, works with no signal at the gym.')}</small>
      <button class="btn" id="qtInstall">${t('Install')}</button>`;
  } else if (isIOS() && (isIOSOtherBrowser() || inAppBrowser())) {
    body = `<b>${t('Open this in Safari to install it')}</b><small>${t('On iPhone, only Safari can put the timer on your home screen.')}</small>
      <ol><li>${t('Tap Copy link')}</li><li>${t('Open Safari, paste it in the address bar')}</li><li>${t('Then Share {i}, Add to Home Screen', { i: share })}</li></ol>
      <button class="btn secondary" id="qtCopyLink">${t('Copy link')}</button>`;
  } else if (isIOSSafari()) {
    body = `<b>${t('Put the timer on your home screen')}</b>
      <ol><li>${t('Tap Share {i} at the bottom of Safari', { i: share })}</li><li>${t('Scroll down, tap Add to Home Screen')}</li><li>${t('Tap Add. Then open it from the new icon.')}</li></ol>`;
  } else if (isAndroid()) {
    body = `<b>${t('Put the timer on your home screen')}</b>
      <ol><li>${t('Tap the ⋮ menu, top right')}</li><li>${t('Tap Install app or Add to Home screen')}</li><li>${t('Open it from the new icon')}</li></ol>`;
  } else return '';                                  // a computer: nothing to install
  return `<div class="qt-install" id="qtInstallCard"><button class="qt-ix" id="qtInstallX" aria-label="${t('Hide')}">✕</button>${body}</div>`;
}
function wireInstall($) {
  $('#qtInstallX')?.addEventListener('click', () => { try { localStorage.setItem(INSTALL_HIDE, String(Date.now())); } catch (e) {} $('#qtInstallCard')?.remove(); });
  $('#qtInstall')?.addEventListener('click', async () => { const r = await promptInstall(); if (r === 'accepted') $('#qtInstallCard')?.remove(); });
  $('#qtCopyLink')?.addEventListener('click', async e => {
    const url = location.origin + location.pathname + '?quick';
    try { await navigator.clipboard.writeText(url); e.target.textContent = t('Copied'); } catch (err) { prompt(t('Copy this link'), url); }
  });
}

/* LAST TIME, for this same timer (its type and its moves) */
const curSig = () => sigOf(fmtDef().name, namedMoves().map(m => m.exId || m.name));   // ids: the same timer in either language
const pastRuns = () => hist.filter(x => x.sig === curSig());
const shortDate = iso => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
function lastLine() {
  const runs = pastRuns(); if (!runs.length) return '';
  const r = runs[0];
  return `<button class="qt-last" id="qtLast"><span>${t('Last time')} · ${shortDate(r.at)}</span><b>${t('{n} reps', { n: r.total })}${r.loadKg ? ` · ${showWeight(r.loadKg, wUnit())}` : ''}</b><i>${runs.length > 1 ? `${t('{n} times', { n: runs.length })} ›` : '›'}</i></button>`;
}
function openHistory() {
  const runs = pastRuns();
  const { ov, close } = sheet(`<div class="qt-sheet-h">${t(fmtDef().name)} · ${t('history')}</div>
    <div class="qt-hist">${runs.map(r => `<div class="qt-hrow"><div class="qt-hh"><b>${shortDate(r.at)}</b><span>${t('{n} reps', { n: r.total })}${r.loadKg ? ` · ${showWeight(r.loadKg, wUnit())}` : ''}${r.seconds ? ` · ${fmt(r.seconds)}` : ''}${r.partial ? ` · ${t('ended early')}` : ''}</span></div>
      <small>${r.moves.map(m => `${esc(m.name)} ${m.reps}${m.weight ? ` @ ${m.weight} ${m.wUnit || 'lb'}` : ''}`).join(' · ')}</small></div>`).join('')}</div>
    <button class="btn" id="qtHistOk">${t('Close')}</button>`, 'tall');
  ov.querySelector('#qtHistOk').addEventListener('click', close);
}
/* EVERY WORKOUT DONE on this device, newest first: the week at a glance,
   then each one with its time, total reps and reps per move; run it again
   or save it with the quick picks */
function openAllHistory() {
  const week = hist.filter(r => Date.now() - new Date(r.at) < 7 * 864e5);
  const sum = (a, k) => a.reduce((s, r) => s + (Number(r[k]) || 0), 0);
  const { ov, close } = sheet(`<div class="qt-sheet-h">${t('History')}</div>
    ${hist.length ? `<div class="qt-hweek"><div><b>${week.length}</b><small>${t('workouts this week')}</small></div><div><b>${num(sum(week, 'total'))}</b><small>${t('reps')}</small></div><div><b>${fmt(sum(week, 'seconds'))}</b><small>${t('time')}</small></div></div>` : `<p class="muted center">${t('Your workouts show up here when you finish them.')}</p>`}
    <div class="qt-hist">${hist.map((r, i) => `<div class="qt-hrow"><div class="qt-hh"><b>${shortDate(r.at)} · ${esc(r.title || '')}</b></div>
      <div class="qt-hnums">${r.seconds ? `<span>${fmt(r.seconds)}</span>` : ''}<span>${t('{n} reps', { n: r.total })}</span>${r.loadKg ? `<span>${showWeight(r.loadKg, wUnit())}</span>` : ''}${r.partial ? `<span>${t('ended early')}</span>` : ''}</div>
      <small>${r.moves.map(m => `${esc(m.name)} ${m.reps}${m.weight ? ` @ ${m.weight} ${m.wUnit || 'lb'}` : ''}`).join(' · ')}</small>
      ${r.cfg ? `<div class="qt-hacts"><button data-hagain="${i}">${t('Do it again')}</button><button data-hsave="${i}">★ ${t('Save')}</button></div>` : ''}</div>`).join('')}</div>
    <button class="btn" id="qtAllHistOk">${t('Close')}</button>`, 'tall');
  ov.querySelector('#qtAllHistOk').addEventListener('click', close);
  const load = r => { cfg = migrate({ ...DEFAULTS, ...JSON.parse(JSON.stringify(r.cfg)), paceV: 2 }); favIdx = null; moreOpen = false; persist(); };
  ov.querySelectorAll('[data-hagain]').forEach(b => b.addEventListener('click', () => { load(hist[+b.dataset.hagain]); close(); draw(); scrollTo(0, 0); }));
  ov.querySelectorAll('[data-hsave]').forEach(b => b.addEventListener('click', () => {
    const r = hist[+b.dataset.hsave]; load(r); favs.unshift({ label: r.title || planName(), cfg: JSON.parse(JSON.stringify(cfg)), sub: summary() }); favs = favs.slice(0, 20); favIdx = 0;
    persist(); close(); draw(); toast(t('Saved')); }));
}
/* REP GOAL (rep-goal.js): the totals, built into the type picked */
const GOAL_AS = [['emom', 'EMOM'], ['ladder', 'Ladder'], ['igyg', 'Sets'], ['fortime', 'For time']];
function goalBuilt() { return buildFromGoal(MV().map(m => ({ ...m, name: mvName(m) })), cfg.goalAs); }
function goalPreview() {
  const g = goalBuilt(); if (!g) return '';
  const tot = g.goal.map((m, i) => `${g.totals[i]} ${m.name}`).join(', ');
  switch (g.cfg.fmt) {
    case 'emom': return t('EMOM {n} min. Every minute: {what}. Total: {tot}', { n: g.cfg.mins, what: g.moves.map(m => `${m.reps} ${m.name}`).join(', '), tot });
    case 'ladder': return t('{n} rungs, climbing. Rung 1: {a}. Last rung: {b}. Total: {tot}', { n: g.rows, a: g.list[0].map((r, i) => `${r} ${g.goal[i].name}`).join(', '), b: g.list.at(-1).map((r, i) => `${r} ${g.goal[i].name}`).join(', '), tot });
    case 'igyg': return t('{n} sets of about 40 s, rest as long as each set. Total: {tot}', { n: g.rows, tot });
    default: return t('All of it, any way you like, as fast as you can: {tot}', { tot });
  }
}
/* You go, I go: sets, and the push-ups the burpees carry */
function igygLine() {
  const rows = MV().filter(m => String(m.name || '').trim() && Number(m.reps) > 0);
  const pu = rows.reduce((a, m) => a + (Number(m.pumps) || 0) * Number(m.reps), 0);
  return `${t2(rows.length, '{n} set', '{n} sets')}${pu ? ` · ${t('{n} push-ups', { n: pu })}` : ''} · ${cfg.igRest === 'fixed' ? t('rest {t}', { t: fmt(cfg.igRestSec) }) : t('rest = your set')}`;
}
const canPump = m => /burpee/i.test(`${m.exId || ''} ${m.name || ''}`);
/* QUICK PICKS (quick-picks.js): ready-made workouts for this type, easy
   to hard, one tap fills the setup in */
function picksRow() {
  const ps = PICKS[cfg.fmt] || [];
  const mine = favs.map((f, i) => [f, i]).filter(([f]) => f.cfg?.fmt === cfg.fmt);
  if (!ps.length && !mine.length) return '';
  return `${sec('Quick picks')}<div class="qt-picks">${mine.map(([f, i]) => `<span class="qt-pick mine ${i === favIdx ? 'on' : ''}" data-fav="${i}" role="button">
    <em>★ ${t('Saved')}</em><b>${esc(f.label)}</b><small>${esc(f.sub || '')}</small><i class="qt-pickx" data-favx="${i}" role="button" aria-label="${t('Remove')}">✕</i></span>`).join('')}${ps.map(p => `<button class="qt-pick l${p.lvl}" data-qp="${p.id}">
    <em>${t(LEVEL[p.lvl])}</em><b>${t(p.name)}</b><small>${t(p.sub)}</small></button>`).join('')}</div>`;
}
function applyPick(p) {
  Object.assign(cfg, p.cfg);
  const lad = ['ladder', 'deathby'].includes(cfg.fmt);
  if (p.gen === 'club') cfg.movesBy[cfg.fmt] = burpeeClub(p.total).map(x => ({ ...x }));
  else if (p.m.length) cfg.movesBy[cfg.fmt] = p.m.map(([k, a, b, pumps]) => {
    const ex = EXERCISES[k], base = ex ? { exId: k, name: ex.name } : { exId: null, name: t(k) };
    return lad ? { ...base, reps: '', ldStart: a, ldStep: b } : { ...base, reps: a, ...(pumps ? { pumps } : {}) };
  });
  favIdx = null; moreOpen = (p.m.length > 0 || !!p.gen) && !lad;
  persist(); draw(); toast(t('Loaded: {x}', { x: t(p.name) }));
}
function draw() {
  const def = fmtDef();
  /* the break between repeats only shows once there is more than one */
  const main = MAIN[cfg.fmt], more = (MORE[cfg.fmt] || []).filter(k => k !== 'setRest' || cfg.sets > 1);
  const named = namedMoves().length;
  const lad = cfg.fmt === 'ladder' || cfg.fmt === 'goal' || cfg.fmt === 'igyg', db = cfg.fmt === 'deathby';
  /* SETTINGS: the main numbers, and the ladder's shape as one more row */
  const settings = [
    ...main.map(stepRow),
    ...(cfg.fmt === 'ladder' ? [segRow('Shape', 'violet', LD_SHAPES, cfg.ldShape, 'data-ldshape')] : []),
    ...(cfg.fmt === 'goal' ? [segRow('Run it as', 'accent', GOAL_AS, cfg.goalAs, 'data-goalas')] : []),
    ...(cfg.fmt === 'igyg' ? [segRow('Rest', 'neon', [['same', 'Same as your set'], ['fixed', 'Fixed']], cfg.igRest, 'data-igrest'), ...(cfg.igRest === 'fixed' ? [stepRow('igRestSec')] : [])] : []),
    ...(cfg.fmt === 'vo2' ? [`<div class="qt-srow qt-vo2"><span class="qt-sl" style="color:var(--wm-accent)">${t('Protocol')}</span>
      ${VO2.map(p => `<button class="qt-vo2p ${p.id === vo2().id ? 'on' : ''}" data-vo2="${p.id}"><b>${t(p.name)}</b><small>${t(p.sub)}</small></button>`).join('')}</div>`] : []),
  ];
  /* CUSTOMIZE: the rest, same rows */
  const custom = [
    ...more.map(stepRow),
    ...(cfg.fmt === 'emom' && named > 1 ? [segRow('How the moves run', 'accent', [['turns', 'Take turns'], ['all', 'All every minute']], cfg.emomStyle === 'all' ? 'all' : 'turns', 'data-style',
        cfg.emomStyle === 'all' ? t('All {n} moves inside each minute', { n: named }) : t('Minute 1 is move 1, minute 2 is move 2'))] : []),
  ];
  /* fades in when it opens, never on the redraw after each tap */
  const fade = host.querySelector('.screen.qt') ? '' : 'fade-in';
  host.innerHTML = `
  <div class="screen qt ${fade}">
    <div class="qt-top">
      ${guest ? '' : `<button class="qt-back" id="qtBack" aria-label="${t('Back')}">‹</button>`}
      <h1>${t('Training Timer')}</h1>
      <button class="qt-star" id="qtHist" aria-label="${t('History')}" title="${t('History')}"><svg width="21" height="21" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11a8 8 0 1 0 2.4-5.7"/><path d="M3 3v4h4"/><path d="M11 7v4l3 2"/></svg></button>
      <button class="qt-star" id="qtPrefs" aria-label="${t('Timer settings')}" title="${t('Timer settings')}">⚙︎</button>
      <button class="qt-star" id="qtShare" aria-label="${t('Share this timer')}" title="${t('Share this timer')}"><svg width="20" height="22" viewBox="0 0 20 22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14V2M5 7l5-5 5 5"/><path d="M4 11H2.5v9h15v-9H16"/></svg></button>
      <button class="qt-star ${favIdx != null ? 'on' : ''}" id="qtFav" aria-label="${t('Save this timer')}" title="${t('Save this timer')}">${favIdx != null ? '★' : '☆'}</button>
    </div>


    ${installCard()}
    <button class="qt-type" id="qtType">
      <span class="qt-type-t"><small>${t('Type')}</small><b>${t(def.name)}</b><em>${t(def.sub)}</em></span>
      <span class="qt-chev">▾</span>
    </button>
    ${lastLine()}
    ${picksRow()}

    ${settings.length ? `${sec('Settings', cfg.fmt === 'ladder' ? `<button class="qt-seclink" id="qtPresets">${t('Presets')}</button>` : '')}<div class="qt-rows">${settings.join('')}</div>` : ''}
    ${lad || db ? `${sec(cfg.fmt === 'goal' ? 'Your totals' : cfg.fmt === 'igyg' ? 'Sets, in order' : 'Moves')}${movesCard()}` : ''}
    ${cfg.fmt === 'goal' && goalBuilt() ? `<div class="qt-goalbox"><b>${t('The plan')}</b><span>${esc(goalPreview())}</span>${cfg.goalAs !== 'ladder' ? `<button class="qt-link" id="qtGoalOpen">${t('Open it as {x} to adjust', { x: t(GOAL_AS.find(x => x[0] === cfg.goalAs)[1]) })}</button>` : ''}</div>` : ''}
    ${!settings.length && !lad && !db ? `<div class="qt-empty">${t('Nothing to set. Hit start.')}</div>` : ''}

    ${custom.length || (def.moves && !lad && !db) ? `<button class="qt-more ${moreOpen ? 'open' : ''}" id="qtMore"><span>${custom.length ? t('Customize') : t('Pick your exercises')}</span><i>›</i>${!moreOpen && named && !lad && !db ? `<em>${t2(named, '{n} move', '{n} moves')}</em>` : ''}</button>` : ''}
    ${moreOpen && (custom.length || (def.moves && !lad && !db)) ? `<div class="qt-details">
      <div class="qt-rows">${custom.join('')}</div>
      ${def.moves && !lad && !db ? `${sec('Moves', `<small>${t('optional')}</small>`)}${movesCard()}` : ''}
      ${cfg.fmt === 'tabata' && (cfg.work !== TABATA.work || cfg.rest !== TABATA.rest) ? `<button class="qt-link" id="qtClassic">${t('Back to classic 20s / 10s')}</button>` : ''}
    </div>` : ''}

    ${showDemo() ? `${sec('Work Mode preview')}
    <div class="qt-demos">${DEMOS.map(d => `<button class="qt-demo" data-demo="${d.id}"><b>${d.name}</b><small>${d.sub}</small><span>▸</span></button>`).join('')}</div>` : ''}

    ${guest ? `<button class="qt-link center qt-signin" id="qtSignIn">${t('Have a program from Nico? Sign in')}</button>` : ''}
    <div style="height:200px"></div>
    <div class="actionbar qt-bar">
      <div class="qt-sum">${summary()}</div>
      <div class="qt-go">
        ${badgeRing()}
        <button class="btn lg" id="qtGo">${t('Start')}</button>
      </div>
    </div>
  </div>`;
  wire();
}
/* THE TOTAL, as a small version of the user's own timer ring with the
   time in the middle: what they are about to start, in the look they chose */
function badgeRing() {
  ringBaseCss();
  const tb = totalBadge();
  return `<div class="qt-badge2 ${tb.big.length > 5 ? 'long' : ''}" title="${t('Total time')}">${ringHTML('work', ringDesign(), '-badge').replace('>0:00<', `>${tb.big}<`)}</div>`;
}
/* the ladder presets, one tap away instead of a strip of chips */
function openPresets() {
  const { ov, close } = sheet(`<div class="qt-sheet-h">${t('Ladder presets')}</div>
    ${LD_PRESETS.map(p => `<button class="qt-opt" data-ldp="${p.id}"><b>${t(p.name)}</b><small>${t(presetHint(p))}</small></button>`).join('')}`);
  ov.querySelectorAll('[data-ldp]').forEach(b => b.addEventListener('click', () => { applyPreset(LD_PRESETS.find(p => p.id === b.dataset.ldp)); persist(); close(); draw(); }));
}
const presetHint = p => ({ up: 'Reps go 1, 2, 3 … 10', down: 'Reps go 10, 9, 8 … 1', pyr: 'Up to 10, then back down',
  valley: 'Down to 1, then back up', seesaw: 'One move climbs while the other drops', wave: '1, 10, 2, 9, 3, 8 …', '21159': 'The classic: 21, 15, 9' }[p.id] || '');

/* ---------------- share + save ----------------
   A timer travels as its settings in the link: base64 of the JSON, only
   the fields that matter. Anyone opening it lands on the same setup. */
const b64u = str => btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = str => decodeURIComponent(escape(atob(str.replace(/-/g, '+').replace(/_/g, '/'))));
function pack() {
  const keep = ['fmt', 'ready', ...(MAIN[cfg.fmt] || []), ...(MORE[cfg.fmt] || [])].map(k => (cfg.fmt === 'timer' && TIMER_KEYS[k]) || k);
  if (cfg.fmt === 'emom') keep.push('emomStyle');
  if (cfg.fmt === 'ladder') keep.push('ldShape');
  if (cfg.fmt === 'timer') keep.push('sets', 'setRest');
  if (cfg.fmt === 'vo2') keep.push('vo2');
  const o = {}; keep.forEach(k => { if (cfg[k] != null) o[k] = cfg[k]; });
  const mv = MV().filter(m => String(m.name || '').trim()).map(m => ({ name: m.name, reps: m.reps || '', ...(m.exId ? { exId: m.exId } : {}), ...(cfg.fmt === 'ladder' || cfg.fmt === 'deathby' ? { ldStart: ldStart(m), ldStep: ldStep(m) } : {}), ...(Number(m.wt) > 0 ? { wt: Number(m.wt) } : {}) }));
  if (mv.length && fmtDef().moves) o.moves = mv;
  return b64u(JSON.stringify(o));
}
function unpack(code) {
  try { const o = JSON.parse(unb64u(code)); return o && typeof o === 'object' && o.fmt ? o : null; } catch (e) { return null; }
}
async function shareTimer() {
  const url = `${location.origin}${location.pathname}?quick&t=${pack()}`;
  const title = planName();
  try {
    if (navigator.share) { await navigator.share({ title: t('Timer: {x}', { x: title }), text: t('{x}. Tap to open it ready to go.', { x: title }), url }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url); toast(t('Link copied. Paste it anywhere.')); }
  catch (e) { prompt(t('Copy this link'), url); }
}
function toast(text) {
  document.getElementById('qtToast')?.remove();
  const t = document.createElement('div'); t.id = 'qtToast'; t.className = 'qt-toast'; t.textContent = text;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
}
const defaultLabel = () => { const m = namedMoves().map(x => x.name); return planName() + (m.length ? ` · ${m.slice(0, 2).join(', ')}${m.length > 2 ? '…' : ''}` : ''); };
/* name it, update it, save a copy, or delete it */
function openSave() {
  const cur = favIdx != null ? favs[favIdx] : null;
  const { ov, close } = sheet(`<div class="qt-sheet-h">${cur ? t('Saved timer') : t('Save this timer')}</div>
    <input class="qt-search" id="svName" value="${esc(cur ? cur.label : defaultLabel())}" placeholder="${t('Give it a name')}" autocomplete="off"/>
    ${cur ? `<button class="btn" id="svUpdate">${t('Save changes')}</button>
      <button class="btn secondary" id="svNew">${t('Save as a new timer')}</button>
      <button class="btn ghost" id="svDel">${t('Delete this timer')}</button>`
    : `<button class="btn" id="svNew">${t('Save')}</button>`}`);
  const name = () => (ov.querySelector('#svName').value.trim() || defaultLabel()).slice(0, 60);
  const snap = () => JSON.parse(JSON.stringify(cfg));
  ov.querySelector('#svUpdate')?.addEventListener('click', () => { favs[favIdx] = { label: name(), cfg: snap(), sub: summary() }; persist(); close(); draw(); toast(t('Saved')); });
  ov.querySelector('#svNew').addEventListener('click', () => { favs.unshift({ label: name(), cfg: snap(), sub: summary() }); favs = favs.slice(0, 20); favIdx = 0; persist(); close(); draw(); toast(t('Saved')); });
  ov.querySelector('#svDel')?.addEventListener('click', () => { favs.splice(favIdx, 1); favIdx = null; persist(); close(); draw(); });
  setTimeout(() => ov.querySelector('#svName').select(), 60);
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
  const { ov, close } = sheet(`<div class="qt-sheet-h">${t('Type of timer')}</div>
    ${FORMATS.map(f => `<div class="qt-optrow"><button class="qt-opt ${f.id === cfg.fmt ? 'on' : ''}" data-pick="${f.id}"><b>${t(f.name)}${f.id === cfg.fmt ? ' <i>✓</i>' : ''}</b><small>${t(f.sub)}</small></button><button class="qt-how" data-how="${f.id}" aria-label="${t('How {x} works', { x: t(f.name) })}">?</button></div>`).join('')}`);
  ov.querySelectorAll('[data-how]').forEach(b => b.addEventListener('click', () => openHow(b.dataset.how)));
  ov.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => {
    if (cfg.fmt !== b.dataset.pick) {
      cfg.fmt = b.dataset.pick;
      if (cfg.fmt === 'tabata') Object.assign(cfg, TABATA, { tbN: null, tbTotal: null });
      persist(); draw();
    }
    close();
    /* nothing to set: straight in */
    if (NO_SETUP.has(cfg.fmt)) { persist(); onStart?.(buildPlan()); }
  }));
}
/* types with nothing to set open straight into the clock */
const NO_SETUP = new Set(['stopwatch']);
/* how the chosen type works */
function openHow(id) {
  const def = FORMATS.find(f => f.id === id) || fmtDef();
  const { ov, close } = sheet(`<div class="qt-sheet-h">${t('How {x} works', { x: t(def.name) })}</div>
    <div class="qt-howbody"><p class="lead">${t(def.how[0])}</p>${def.how.slice(1).map(p => `<p>${t(p)}</p>`).join('')}</div>
    <button class="btn" id="qtHowOk">${t('Got it')}</button>`);
  ov.querySelector('#qtHowOk').addEventListener('click', close);
}
/* minutes and seconds, for any time field */
function openTime(k) {
  let v = val(k);
  const [label, , , lo, hi] = FIELDS[k];
  const { ov, close } = sheet(`<div class="qt-sheet-h">${t(label)}</div>
    <div class="qt-tp">
      <div><button data-tp="m" data-d="1">+</button><b id="tpM"></b><small>min</small><button data-tp="m" data-d="-1">−</button></div>
      <span class="qt-tpc">:</span>
      <div><button data-tp="s" data-d="5">+</button><b id="tpS"></b><small>${t('sec')}</small><button data-tp="s" data-d="-5">−</button></div>
    </div>
    <button class="btn" id="tpOk">${t('Done')}</button>`);
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
/* ---------------- search ----------------
   Every word a person might use for a move: its name and aliases, the
   muscles it trains (main and secondary), the body part those belong to
   ("abs" and "core", "quads" and "legs"), the movement (push, pull,
   hinge), the equipment, the level. Muscles come from the shared catalog
   (spine/catalog.json); the app's own library is the fallback offline. */
const WORDS = {
  /* muscles → everything a person calls them */
  quad: 'quads quadriceps thighs legs leg lower body knees', glute: 'glutes butt bum booty hips legs lower body posterior chain',
  hamstring: 'hamstrings hams legs lower body posterior chain', calf: 'calves calf legs lower body ankles',
  tibialis: 'shins shin tibialis legs ankles', adductor: 'adductors groin inner thigh legs',
  chest: 'chest pecs pec upper body push', triceps: 'triceps tricep arms arm upper body', biceps: 'biceps bicep arms arm upper body',
  forearm: 'forearms forearm grip arms', grip: 'grip forearms hands hang', 'front-delt': 'shoulders shoulder front delts upper body',
  'side-delt': 'shoulders shoulder side delts', 'rear-delt': 'shoulders rear delts upper back back', serratus: 'serratus shoulder blades ribs',
  abs: 'abs abdominals core six pack stomach belly midsection', obliques: 'obliques core abs sides waist twist',
  'hip-flexor': 'hip flexors hips core', lat: 'lats back upper body wings', 'mid-back': 'back upper back rhomboids posture',
  'lower-back': 'lower back back spine erectors posterior chain', traps: 'traps trapezius upper back neck back',
  /* movement patterns */
  push: 'push upper body', press: 'press push shoulders overhead', pull: 'pull back upper body', core: 'core abs midsection',
  hinge: 'hinge deadlift posterior chain legs', squat: 'squat legs', lunge: 'lunge single leg legs', jump: 'jump jumping plyo plyometric explosive power',
  'h-push': 'horizontal push chest', 'v-push': 'vertical push overhead shoulders', 'h-pull': 'row rows horizontal pull back',
  'v-pull': 'pull up pull-up chin vertical pull back', 'straight-arm-push': 'planche straight arm', 'straight-arm-pull': 'front lever straight arm',
  'anti-extension': 'core abs plank', 'anti-rotation': 'core obliques', 'anti-lateral-flexion': 'core obliques side', flexion: 'crunch core abs',
  rotation: 'rotation twist obliques core', extension: 'back extension lower back', compression: 'compression l-sit core hip flexors',
  locomotion: 'crawl crawling animal flow', carry: 'carry walk grip', conditioning: 'cardio conditioning hiit sweat metcon engine burn',
  mobility: 'mobility stretch stretching flexibility warm up warmup', skill: 'skill calisthenics gymnastics', full: 'full body total body',
  /* equipment */
  bw: 'bodyweight body weight no equipment home', bb: 'barbell bar', db: 'dumbbell dumbbells', kb: 'kettlebell kettlebells',
  band: 'band bands resistance band', rings: 'rings gymnastic rings', pullupbar: 'pull up bar bar', parallettes: 'parallettes',
  dipbars: 'dip bars dip station', bench: 'bench', vest: 'weighted vest vest', machine: 'machine gym', cable: 'cable gym',
  slantboard: 'slant board', sliders: 'sliders', abwheel: 'ab wheel ab roller', mat: 'mat', rack: 'rack squat rack',
  /* level + shape */
  beg: 'beginner beginners easy easier novice starter start basic basics simple newbie new entry level regression level 1',
  int: 'intermediate medium moderate middle normal level 2',
  adv: 'advanced hard harder difficult tough expert elite pro challenging progression level 3', hold: 'hold isometric static', unilateral: 'single leg single arm one side unilateral',
};
const CHIPS = ['Easy', 'Medium', 'Hard', 'Core', 'Abs', 'Legs', 'Glutes', 'Push', 'Pull', 'Arms', 'Back', 'Shoulders', 'Full body', 'Cardio', 'No equipment'];
/* a move's level: the library's, else the catalog's; mobility and joint
   prep with none count as easy */
const LEVEL_NAME = { beg: 'beginner', int: 'intermediate', adv: 'advanced' };
function levelOf(e, c) { return e.level || c.level || (e.pattern === 'mobility' || c.role === 'joint-prep' ? 'beg' : null); }
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-_/’']/g, ' ').replace(/\s+/g, ' ').trim();   // accents off: "developpe" finds Développé
let catalog = null, lib = null;
async function loadCatalog() {
  if (catalog) return;
  try { const r = await fetch('spine/catalog.json'); if (r.ok) catalog = (await r.json()).movements || {}; } catch (e) {}
  catalog = catalog || {}; lib = null;
}
/* Each move gets 3 word sets: its name, what it MAINLY trains (target
   muscles, pattern, equipment, aliases) and what it also touches (secondary
   muscles). Whole words only, so "lats" never matches "bilateral". */
const wordsOf = str => new Set(norm(str).split(' ').filter(Boolean));
let libLang = null;
function LIB() {
  if (lib && libLang === lang()) return lib;
  libLang = lang();
  const add = (set, v) => [].concat(v || []).forEach(x => { if (!x || typeof x !== 'string') return; set.push(x); if (WORDS[x]) set.push(WORDS[x]); });
  lib = Object.entries(EXERCISES).filter(([, e]) => e.name).map(([id, e]) => {
    const c = (catalog && catalog[id]) || {};
    const main = [], also = [];
    const lvl = levelOf(e, c);
    [e.pattern, c.patterns, e.family, e.families, e.region, e.equipment, c.muscles, c.modality, lvl].forEach(v => add(main, v));
    if (e.measure === 'hold') add(main, 'hold');
    if (e.laterality === 'unilateral') add(main, 'unilateral');
    Object.values(c.aliases || {}).forEach(v => add(main, v));
    add(also, c.musclesAlso);
    const muscles = (c.muscles || []).map(m => t(m.replace(/-/g, ' ')));
    const shown = exName(id, e.name);                 // the French name in French, searchable in both
    return { id, name: shown, n: norm(shown), lvl, mus: c.muscles || [], pat: [e.pattern, ...(c.patterns || [])].filter(Boolean), eq: e.equipment || [], gym: !!e.gymOnly, wn: wordsOf(`${e.name} ${shown} ${id}`), wm: wordsOf(main.join(' ')), wa: wordsOf(also.join(' ')),
      tag: [muscles.join(', ') || t(e.pattern || ''), t(LEVEL_NAME[lvl] || ''), e.gymOnly ? t('gym') : ''].filter(Boolean).join(' · ') };
  }).sort((a, b) => a.name.localeCompare(b.name));
  return lib;
}
/* a query word matches a word exactly, as its singular, or as the start of
   a longer word once 4 letters are typed ("dumb" finds dumbbell) */
function wordHit(set, w) {
  if (set.has(w)) return true;
  if (w.length > 3 && w.endsWith('s') && set.has(w.slice(0, -1))) return true;
  if (w.length >= 4) for (const x of set) if (x.startsWith(w)) return true;
  return false;
}
/* every word must match somewhere; name beats main muscle beats secondary */
/* "easy", "novice", "hard"… are a filter on the move's LEVEL, never a
   name match ("advanced pull" must not open on an intermediate move that
   has "Advanced" in its name) */
const LEVEL_WORD = {};
for (const lv of ['beg', 'int', 'adv']) for (const w of WORDS[lv].split(' ')) if (!/^(level|1|2|3|start|new|basic|entry|normal|middle|pro)$/.test(w)) LEVEL_WORD[w] = lv;
function search(q) {
  let words = norm(q).split(' ').filter(Boolean);
  if (!words.length) return LIB();
  const levels = new Set(words.filter(w => LEVEL_WORD[w]).map(w => LEVEL_WORD[w]));
  words = words.filter(w => !LEVEL_WORD[w]);
  const pool = levels.size ? LIB().filter(e => levels.has(e.lvl)) : LIB();
  if (!words.length) return pool;
  const out = [];
  for (const e of pool) {
    let score = 0, ok = true;
    for (const w of words) {
      const s = wordHit(e.wn, w) ? 5 : wordHit(e.wm, w) ? 3 : wordHit(e.wa, w) ? 1 : 0;
      if (!s) { ok = false; break; }
      score += s;
    }
    if (ok) out.push({ e, score: score + (e.n.startsWith(words[0]) ? 2 : 0) });
  }
  return out.sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name)).map(x => x.e);
}
/* FILTERS YOU TAP, not words you type. A body part is the move's MAIN
   muscles (or its pattern); level and equipment are exact. They combine
   with each other and with the search box. */
const PARTS = [
  ['all', 'All'], ['chest', 'Chest'], ['back', 'Back'], ['shoulders', 'Shoulders'], ['arms', 'Arms'],
  ['core', 'Core'], ['legs', 'Legs'], ['glutes', 'Glutes'], ['full', 'Full body'],
];
const PART_TEST = {
  chest: e => e.mus.includes('chest'),
  back: e => e.mus.some(m => ['lat', 'mid-back', 'lower-back', 'traps'].includes(m)) || e.pat.includes('pull'),
  shoulders: e => e.mus.some(m => ['front-delt', 'side-delt', 'rear-delt'].includes(m)),
  arms: e => e.mus.some(m => ['biceps', 'triceps', 'forearm', 'grip'].includes(m)),
  core: e => e.mus.some(m => ['abs', 'obliques', 'hip-flexor'].includes(m)) || e.pat.includes('core'),
  legs: e => e.mus.some(m => ['quad', 'hamstring', 'calf', 'tibialis', 'adductor', 'glute'].includes(m)) || e.pat.some(p => ['quad', 'hinge', 'hamstring', 'calf', 'squat', 'lunge'].includes(p)),
  glutes: e => e.mus.includes('glute') || e.pat.includes('glute'),
  full: e => e.pat.some(p => ['full', 'conditioning', 'locomotion'].includes(p)) || e.mus.length >= 4,
};
const LEVELS = [['', 'Any level'], ['beg', 'Easy'], ['int', 'Medium'], ['adv', 'Hard']];
const EQUIP = [
  ['', 'Any kit'], ['none', 'No equipment'], ['db', 'Dumbbell'], ['kb', 'Kettlebell'], ['band', 'Band'],
  ['pullupbar', 'Pull-up bar'], ['bb', 'Barbell'], ['rings', 'Rings'], ['gym', 'Gym machine'],
];
const EQUIP_TEST = {
  none: e => e.eq.every(x => ['bw', 'mat'].includes(x)),
  gym: e => e.gym || e.eq.some(x => ['machine', 'cable'].includes(x)),
};
let moveFilter = { part: 'all', lvl: '', eq: '' };
function passes(e) {
  const f = moveFilter;
  if (f.part !== 'all' && !PART_TEST[f.part]?.(e)) return false;
  if (f.lvl && e.lvl !== f.lvl) return false;
  if (f.eq && !(EQUIP_TEST[f.eq] ? EQUIP_TEST[f.eq](e) : e.eq.includes(f.eq))) return false;
  return true;
}
/* THE MOVE LIST'S TOP, before anything is typed: your favourites (★ on any
   row), what you picked lately, moves like those, then the fundamentals
   everyone knows. Everything else sits under "All moves". Kept per device. */
const FUNDAMENTALS = ['pushup', 'pullup', 'bodyweight_squat', 'burpee', 'forearm_plank', 'dip', 'chin_up', 'mountain_climber',
  'jump_squat', 'glute_bridge', 'sit_up', 'ring_row', 'hollow_hold', 'dead_hang', 'wall_sit', 'kb_swing', 'goblet_squat',
  'deadlift', 'back_squat', 'bench_press', 'overhead_press', 'bent_over_row', 'farmers_carry'];
const lsList = k => { try { const v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v.filter(id => EXERCISES[id]) : []; } catch (e) { return []; } };
const lsSave = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const favMoves = () => lsList('fj.favMoves');
const recentMoves = () => lsList('fj.recentMoves');
function rememberPick(id) { if (id && EXERCISES[id]) lsSave('fj.recentMoves', [id, ...recentMoves().filter(x => x !== id)].slice(0, 8)); }
function toggleFav(id) { const f = favMoves(); lsSave('fj.favMoves', f.includes(id) ? f.filter(x => x !== id) : [id, ...f]); }
/* like what you picked lately: same movement pattern or main muscles */
function suggestedMoves(skip) {
  const rec = recentMoves().map(id => LIB().find(e => e.id === id)).filter(Boolean);
  if (!rec.length) return [];
  const pats = new Set(rec.flatMap(e => e.pat)), mus = new Set(rec.flatMap(e => e.mus));
  return LIB().filter(e => !skip.has(e.id))
    .map(e => ({ e, sc: e.pat.filter(x => pats.has(x)).length * 2 + e.mus.filter(x => mus.has(x)).length }))
    .filter(x => x.sc > 0).sort((a, b) => b.sc - a.sc || a.e.name.localeCompare(b.e.name)).slice(0, 6).map(x => x.e);
}
/* SEE THE MOVE before picking it: the clip (or a YouTube search when there
   is none yet), the picture, the one cue, and "Use this move" */
function openMoveDemo(id, onUse) {
  const ex = EXERCISES[id] || {}, name = exName(id, ex.name), url = videoEmbed(id), img = exerciseImage(id);
  const cue = VOICE_CUES[id] ? t(VOICE_CUES[id]) : '';
  const { ov, close } = sheet(`<div class="qt-sheet-h">${esc(name)}</div>
    ${url ? `<div class="qt-vid"><iframe src="${url}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`
      : img ? `<img class="qt-demoimg" src="${img}" alt=""/>` : ''}
    ${cue ? `<p class="qt-democue">${esc(cue)}</p>` : ''}
    ${url ? '' : `<a class="btn secondary qt-yt" href="${videoSearch(ex.name || name)}" target="_blank" rel="noopener">▶ ${t('Watch on YouTube')}</a>`}
    <button class="btn" id="mdUse">${t('Use this move')}</button>
    <button class="qt-link center" id="mdBack">${t('Back to the list')}</button>`, 'tall');
  ov.classList.add('qt-sheet-top');
  ov.querySelector('#mdUse').addEventListener('click', () => { close(); onUse?.(); });
  ov.querySelector('#mdBack').addEventListener('click', close);
}
async function openMovePicker(i) {
  const { ov, close } = sheet(`<div class="qt-sheet-h">${t('Pick a move')}</div>
    <input class="qt-search" id="mvQ" placeholder="${MV()[i]?.name ? t('{x} · search to change', { x: esc(mvName(MV()[i])) }) : t('Search by name, or tap the filters')}" autocomplete="off" value=""/>
    <div class="qt-filters" id="mvF"></div>
    <div class="qt-results" id="mvR"></div>`, 'tall');
  const q = ov.querySelector('#mvQ'), out = ov.querySelector('#mvR');
  const pick = m => { rememberPick(m.exId); MV()[i] = { ...MV()[i], ...m }; persist(); close(); draw(); };
  const chipRow = (opts, key) => `<div class="qt-frow">${opts.map(([v, l]) => `<button class="${moveFilter[key] === v ? 'on' : ''}" data-f="${key}" data-v="${v}">${t(l)}</button>`).join('')}</div>`;
  const filters = () => {
    ov.querySelector('#mvF').innerHTML = chipRow(PARTS, 'part') + chipRow(LEVELS, 'lvl') + chipRow(EQUIP, 'eq');
    ov.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => { moveFilter[b.dataset.f] = b.dataset.v; filters(); list(); }));
  };
  const list = () => {
    const qs = norm(q.value);
    const all = search(qs).filter(passes);
    const filtered = moveFilter.part !== 'all' || moveFilter.lvl || moveFilter.eq;
    const exact = qs && LIB().some(e => e.n === qs);
    const favs = new Set(favMoves());
    const row = e => { const img = exerciseImage(e.id);
      return `<button class="qt-res pic" data-ex="${e.id}"><span class="qt-th">${img ? `<img src="${img}" alt="" loading="lazy" decoding="async"/>` : esc(e.name[0])}</span><span class="qt-rt"><b>${esc(e.name)}</b><small>${esc(e.tag)}</small></span><span class="qt-play ${videoEmbed(e.id) ? 'has' : ''}" data-demo="${e.id}" role="button" aria-label="${t('Watch it')}">▶</span><span class="qt-star ${favs.has(e.id) ? 'on' : ''}" data-fav="${e.id}" role="button" aria-label="${t('Favorite')}">${favs.has(e.id) ? '★' : '☆'}</span></button>`; };
    const head = (title, n) => `<div class="qt-count qt-grp">${title}${n != null ? ` <span>${n}</span>` : ''}</div>`;
    let html = '';
    if (qs) {
      html = (!exact ? `<button class="qt-res own" data-own="1"><b>${t('Use "{x}"', { x: esc(q.value.trim()) })}</b><small>${t('your own move, not from the library')}</small></button>` : '')
        + head(t2(all.length, '{n} move', '{n} moves')) + all.slice(0, 120).map(row).join('');
    } else {
      /* nothing typed: the groups first, then the rest, each move once */
      const byId = new Map(all.map(e => [e.id, e])), shown = new Set();
      const grp = ids => ids.map(id => byId.get(id)).filter(e => e && !shown.has(e.id) && shown.add(e.id));
      const fav = grp([...favs]), rec = grp(recentMoves()), sug = grp(suggestedMoves(new Set([...favs, ...recentMoves()])).map(e => e.id)), fun = grp(FUNDAMENTALS);
      const rest = all.filter(e => !shown.has(e.id));
      html = (fav.length ? head('★ ' + t('Favorites')) + fav.map(row).join('') : '')
        + (rec.length ? head(t('Recent')) + rec.map(row).join('') : '')
        + (sug.length ? head(t('Suggested for you')) + sug.map(row).join('') : '')
        + (fun.length ? head(t('Fundamentals')) + fun.map(row).join('') : '')
        + head(filtered ? t('More moves') : t('All moves'), rest.length) + rest.map(row).join('');
    }
    out.innerHTML = html;
    out.querySelectorAll('[data-demo]').forEach(pl => pl.addEventListener('click', e => { e.stopPropagation(); openMoveDemo(pl.dataset.demo, () => pick({ exId: pl.dataset.demo, name: EXERCISES[pl.dataset.demo].name })); }));
    out.querySelectorAll('[data-fav]').forEach(st => st.addEventListener('click', e => { e.stopPropagation(); toggleFav(st.dataset.fav); const top = out.scrollTop; list(); out.scrollTop = top; }));
    out.querySelectorAll('[data-ex]').forEach(b => b.addEventListener('click', () => pick({ exId: b.dataset.ex, name: EXERCISES[b.dataset.ex].name })));
    out.querySelector('[data-own]')?.addEventListener('click', () => pick({ exId: null, name: q.value.trim() }));
  };
  q.addEventListener('input', list);
  filters();
  loadCatalog().then(() => { lib = null; list(); });
  q.addEventListener('keydown', e => { if (e.key === 'Enter') { const first = out.querySelector('.qt-res'); first?.click(); } });
  list();
  setTimeout(() => { q.focus(); q.select(); }, 60);
}

function wire() {
  const $ = s => host.querySelector(s);
  $('#qtBack')?.addEventListener('click', () => { location.href = 'dashboard.html'; });
  $('#qtSignIn')?.addEventListener('click', () => { try { localStorage.removeItem('fj.launchTimer'); } catch (e) {} location.href = 'index.html'; });
  wireInstall($);
  $('#qtType').addEventListener('click', openTypes);
  $('#qtLast')?.addEventListener('click', openHistory);
  $('#qtPrefs').addEventListener('click', () => openPrefs(host));
  $('#qtMore')?.addEventListener('click', () => { moreOpen = !moreOpen; draw(); });
  host.querySelectorAll('[data-qp]').forEach(b => b.addEventListener('click', () => { const p = PICKS[cfg.fmt]?.find(x => x.id === b.dataset.qp); if (p) applyPick(p); }));
  host.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => { bump(b.dataset.q, Number(b.dataset.d)); persist(); draw(); }));
  host.querySelectorAll('[data-qt]').forEach(b => b.addEventListener('click', () => openTime(b.dataset.qt)));
  host.querySelectorAll('[data-qf]').forEach(inp => {
    inp.addEventListener('change', () => { setVal(inp.dataset.qf, clamp(inp.value, inp.dataset.qf)); persist(); draw(); });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); });
  });
  host.querySelectorAll('[data-pace]').forEach(b => b.addEventListener('click', () => { cfg.pace = +b.dataset.pace; persist(); draw(); }));
  host.querySelectorAll('[data-ldend-d]').forEach(b => b.addEventListener('click', () => {
    const st = ldStep(ladderMoves()[0]), d = +b.dataset.ldendD;
    cfg.ldRungs = Math.min(maxRungs(), Math.max(1, rungCount() + (st < 0 ? -d : d)));   // the shown number moves the way the button says
    persist(); draw();
  }));
  host.querySelector('[data-ldend]')?.addEventListener('change', e => { setLadderEnd(+e.target.value || 0); persist(); draw(); });
  host.querySelectorAll('[data-ldshape]').forEach(b => b.addEventListener('click', () => { cfg.ldShape = b.dataset.ldshape; persist(); draw(); }));
  $('#qtPresets')?.addEventListener('click', openPresets);
  host.querySelectorAll('[data-vo2]').forEach(b => b.addEventListener('click', () => { cfg.vo2 = b.dataset.vo2; persist(); draw(); }));
  host.querySelectorAll('[data-mr]').forEach(b => b.addEventListener('click', () => {
    const m = MV()[+b.dataset.mr], v = Number(m.reps) || 0, k = isHold(m) ? 5 : cfg.fmt === 'goal' ? (v >= 100 ? 25 : v >= 30 ? 10 : 5) : 1;
    /* seconds move 5 at a time, landing on a multiple of 5 (12 → 15, not 17) */
    const nv = Number(b.dataset.d) > 0 ? Math.floor(v / k) * k + k : Math.ceil(v / k) * k - k;
    m.reps = Math.max(0, Math.min(cfg.fmt === 'goal' ? 5000 : 999, nv)) || ''; persist(); draw();
  }));
  host.querySelectorAll('[data-mp]').forEach(b => b.addEventListener('click', () => {
    const m = MV()[+b.dataset.mp]; m.pumps = Math.max(0, Math.min(20, (Number(m.pumps) || 0) + Number(b.dataset.d))); persist(); draw();
  }));
  host.querySelectorAll('[data-ldmode]').forEach(b => b.addEventListener('click', () => { MV()[+b.dataset.ldmode].ldMode = b.dataset.v; persist(); draw(); }));
  host.querySelectorAll('[data-goalas]').forEach(b => b.addEventListener('click', () => { cfg.goalAs = b.dataset.goalas; persist(); draw(); }));
  host.querySelectorAll('[data-igrest]').forEach(b => b.addEventListener('click', () => { cfg.igRest = b.dataset.igrest; persist(); draw(); }));
  $('#qtGoalOpen')?.addEventListener('click', () => {
    const g = goalBuilt(); if (!g) return;
    Object.assign(cfg, g.cfg); cfg.movesBy[g.cfg.fmt] = g.moves.map(m => ({ ...m })); favIdx = null; moreOpen = true;
    persist(); draw(); toast(t('Loaded: {x}', { x: planName() }));
  });
  host.querySelectorAll('[data-lm]').forEach(b => b.addEventListener('click', () => {
    const m = MV()[+b.dataset.lm], f = b.dataset.lf, d = +b.dataset.d;
    const k = isHold(m) ? 5 : 1;
    if (f === 'ldStart') m.ldStart = Math.min(500, Math.max(1, ldStart(m) + d * k));
    else m.ldStep = Math.min(50 * k, Math.max(cfg.fmt === 'deathby' ? 0 : -50 * k, ldStep(m) + d * k));
    persist(); draw();
  }));
  host.querySelectorAll('[data-style]').forEach(b => b.addEventListener('click', () => { cfg.emomStyle = b.dataset.style; persist(); draw(); }));
  host.querySelectorAll('[data-pick-move]').forEach(b => b.addEventListener('click', () => openMovePicker(+b.dataset.pickMove)));
  /* typing reps must not redraw (the keyboard would drop); the total line
     does not depend on reps, so nothing on screen goes stale */
  host.querySelectorAll('[data-mv]').forEach(inp => {
    inp.addEventListener('input', () => { MV()[+inp.dataset.mv][inp.dataset.k] = inp.value; persist(); });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); });
  });
  host.querySelectorAll('[data-mw]').forEach(b => b.addEventListener('click', () => {
    const m = MV()[+b.dataset.mw], v = Number(m.wt) || 0, d = Number(b.dataset.d), k = wStep();
    const nv = d > 0 ? Math.floor(v / k + 1e-9) * k + k : Math.ceil(v / k - 1e-9) * k - k;
    m.wt = Math.max(0, Math.min(1000, Math.round(nv * 10) / 10)) || ''; persist(); draw();
  }));
  host.querySelectorAll('[data-wu]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const toKg = wUnit() === 'lb';
    /* convert every weight already set, to that unit's step (2.5 kg / 5 lb) */
    Object.values(cfg.movesBy || {}).forEach(list => (list || []).forEach(m => { const v = Number(m.wt) || 0; if (!v) return;
      m.wt = toKg ? Math.max(2.5, Math.round(v / 2.20462 / 2.5) * 2.5) : Math.max(5, Math.round(v * 2.20462 / 5) * 5); }));
    cfg.wUnit = toKg ? 'kg' : 'lb'; persist(); draw();
  }));
  requestAnimationFrame(fitMoveNames);
  /* hold a move and drag it to change the order */
  makeSortable(host.querySelector('.qt-mvlist'), '.qt-mvr', (from, to) => {
    const list = MV(); list.splice(to, 0, list.splice(from, 1)[0]); persist(); draw();
  });
  host.querySelectorAll('[data-mvx]').forEach(b => b.addEventListener('click', () => {
    MV().splice(+b.dataset.mvx, 1);
    if (!MV().length) MV().push(newMove());
    persist(); draw();
  }));
  $('#qtAdd')?.addEventListener('click', () => {
    MV().push(newMove()); persist(); draw();
    openMovePicker(MV().length - 1);
  });
  $('#qtClassic')?.addEventListener('click', () => { Object.assign(cfg, TABATA, { tbN: null, tbTotal: null }); persist(); draw(); });
  host.querySelectorAll('[data-fav]').forEach(b => b.addEventListener('click', () => {
    const f = favs[+b.dataset.fav]; if (!f) return;
    cfg = migrate({ ...DEFAULTS, ...JSON.parse(JSON.stringify(f.cfg)), paceV: 2 }); favIdx = +b.dataset.fav; persist(); draw();
  }));
  host.querySelectorAll('[data-favx]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation(); if (!confirm(t('Remove "{x}" from your saved workouts?', { x: favs[+b.dataset.favx]?.label || '' }))) return;
    const i = +b.dataset.favx; favs.splice(i, 1);
    if (favIdx === i) favIdx = null; else if (favIdx > i) favIdx--;
    persist(); draw();
  }));
  $('#qtFav').addEventListener('click', openSave);
  $('#qtHist').addEventListener('click', openAllHistory);
  $('#qtShare').addEventListener('click', shareTimer);
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
  .qt-top h1 { flex:1; margin: 0; font-size: 26px; letter-spacing: -0.03em; white-space: nowrap; }
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

  .qt-ldm { display:flex; gap: 6px; margin: 2px 0 2px 2px; }
  .qt-ldm button { background: none; border: 1px solid var(--line); color: var(--muted); border-radius: 999px; padding: 3px 11px; font-size: 12.5px; font-weight: 700; cursor: pointer; }
  .qt-ldm button.on { border-color: var(--wm-accent); color: var(--wm-accent); background: var(--wm-accent-soft, transparent); }
  .qt-play { flex: none; width: 34px; height: 34px; border-radius: 50%; display:grid; place-items:center; font-size: 12px; color: var(--muted); border: 1.5px solid var(--line); margin-right: 4px; cursor: pointer; }
  .qt-play.has { color: var(--wm-accent); border-color: var(--wm-accent); }
  .qt-vid { position: relative; width: 100%; aspect-ratio: 9 / 12; max-height: 52vh; border-radius: 14px; overflow: hidden; background: #000; margin-bottom: 10px; }
  .qt-vid iframe { position:absolute; inset:0; width:100%; height:100%; border:0; }
  .qt-demoimg { width: 100%; max-height: 40vh; object-fit: contain; border-radius: 14px; background: var(--box); margin-bottom: 10px; }
  .qt-democue { font-size: 17px; font-weight: 600; text-align: center; margin: 4px 0 14px; }
  .qt-yt { display:block; text-align:center; text-decoration:none; margin-bottom: 8px; }
  .qt-sheet-top { z-index: 95; }
  .qt-pick.mine { position: relative; border-color: var(--wm-accent); }
  .qt-pick b, .qt-pick small { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
  .qt-pick.mine b { padding-right: 14px; }
  .qt-pick.mine em { color: var(--wm-accent); }
  .qt-pickx { position:absolute; top: 6px; right: 8px; font-style: normal; color: var(--muted); font-size: 13px; padding: 4px; }
  .qt-hweek { display:grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
  .qt-hweek div { background: var(--box); border-radius: 12px; padding: 10px; text-align:center; }
  .qt-hweek b { display:block; font-family: var(--tnum); font-size: 20px; color: var(--wm-neon); } .qt-hweek small { color: var(--muted); font-size: 12px; }
  .qt-hnums { display:flex; gap: 10px; flex-wrap: wrap; font-family: var(--tnum); font-size: 15px; margin: 2px 0 4px; }
  .qt-hacts { display:flex; gap: 8px; margin-top: 8px; }
  .qt-hacts button { flex: 1; background: none; border: 1px solid var(--line); color: var(--text); border-radius: 10px; padding: 8px; font-weight: 700; font-size: 13.5px; }
  .qt-goalbox { display:flex; flex-direction:column; gap: 6px; margin: 10px 0 4px; padding: 12px 14px; border-radius: 14px; background: var(--box); border: 1px solid var(--wm-neon-line); }
  .qt-goalbox b { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--wm-neon); }
  .qt-goalbox span { font-size: 14.5px; line-height: 1.4; }
  .qt-goalbox .qt-link { align-self: flex-start; padding: 0; }
  .qt-picks { display:flex; gap: 10px; overflow-x: auto; margin: 0 calc(-1 * var(--pad)) 6px; padding: 2px var(--pad) 10px; scroll-snap-type: x mandatory; scroll-padding: 0 var(--pad); scrollbar-width: none; }
  .qt-picks::-webkit-scrollbar { display: none; }
  .qt-pick { flex: 0 0 158px; scroll-snap-align: start; display:flex; flex-direction:column; align-items:flex-start; gap: 4px; text-align:left; padding: 11px 12px 12px;
    background: var(--box); border: 1px solid var(--line); border-radius: 14px; color: var(--text); cursor:pointer; }
  .qt-pick:active { border-color: var(--wm-accent); }
  .qt-pick em { font-style: normal; font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; padding: 2px 8px; border-radius: 999px; border: 1px solid currentColor; }
  .qt-pick.l1 em { color: var(--wm-neon); } .qt-pick.l2 em { color: var(--wm-accent); } .qt-pick.l3 em { color: #FF3B6B; }
  .qt-pick b { font-size: 16px; line-height: 1.2; }
  .qt-pick small { color: var(--muted); font-size: 12.5px; line-height: 1.3; }
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

  .qt-bar { background: linear-gradient(180deg, transparent 0, var(--bg) 18px); padding-top: 22px; }

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
  .qt-res.pic { flex-direction:row; align-items:center; gap: 12px; }
  .qt-rt { flex: 1; }
  .qt-star { flex: 0 0 auto; width: 40px; height: 40px; display:grid; place-items:center; font-size: 22px; color: var(--faint); cursor:pointer; }
  .qt-star.on { color: var(--wm-neon); text-shadow: 0 0 10px var(--wm-neon); }
  .qt-grp { margin-top: 14px; color: var(--wm-accent); font-weight: 800; text-transform: uppercase; letter-spacing: .1em; font-size: 11px; }
  .qt-grp span { color: var(--faint); font-weight: 600; margin-left: 4px; }
  .qt-rt { display:flex; flex-direction:column; min-width:0; }
  .qt-th { flex: 0 0 64px; width:64px; height:64px; border-radius: 12px; overflow:hidden; background: #eef1f5; display:grid; place-items:center; font-weight:800; font-size:20px; color: var(--wm-accent); }
  .qt-th:not(:has(img)) { background: color-mix(in srgb, var(--wm-accent) 14%, transparent); }
  .qt-th img { width:100%; height:100%; object-fit:contain; }
  .qt-star.on { color: var(--wm-neon); text-shadow: var(--wm-glow-neon); }
  .qt-star svg { display:block; }
  .qt-fav.on { border-color: var(--wm-neon); } .qt-fav.on button:first-child { color: var(--wm-neon); }
  .qt-ldstyle { margin-top: 10px; }
  .qt-signin { display:block; margin: 26px auto 0; color: var(--muted); font-weight: 500; }
  .qt-presets2 { padding-top: 10px; }
  .qt-lmove { padding: 4px 0 10px; border-bottom: 1px solid var(--line); }
  .qt-lmove:last-of-type { border-bottom: none; }
  .qt-lrow { display:flex; align-items:center; gap: 8px; font-size: 13px; color: var(--muted); font-weight: 600; }
  .qt-lrow .qt-step button { width: 36px; height: 36px; }
  .qt-lv { min-width: 34px; text-align:center; font-family: var(--tnum); font-size: 17px; color: var(--text); }
  .qt-lprev { color: var(--wm-accent); font-size: 12.5px; margin-top: 6px; font-family: var(--tnum); }
  .qt-sheet-card .btn + .btn { margin-top: 8px; }
  .qt-toast { position: fixed; left: 50%; bottom: calc(120px + env(safe-area-inset-bottom)); transform: translateX(-50%); z-index: 95;
    background: var(--bg-2); border: 1px solid var(--wm-neon-line); box-shadow: var(--wm-glow-neon); color: var(--text);
    padding: 11px 18px; border-radius: 999px; font-size: 14px; font-weight: 600; white-space: nowrap; animation: qtIn .2s ease-out; }
  .qt-optrow { display:flex; align-items:center; border-top: 1px solid var(--line); }
  .qt-optrow .qt-opt { flex: 1; border-top: none; }
  .qt-optrow .qt-how { flex: none; width: 40px; height: 40px; border-radius: 50%; margin-right: 2px; font-size: 17px; }
  .qt-opt b i { color: var(--wm-accent); font-style: normal; font-size: 15px; margin-left: 4px; }
  .qt-go { display:flex; align-items:center; gap: 12px; }
  .qt-go .btn { flex: 1; }
  .qt-badge2 { flex: none; width: 92px; height: 92px; position: relative; }
  .qt-badge2 .timer { width: 92px !important; height: 92px !important; position: relative; }
  .qt-badge2 .timer .read { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; }
  .qt-badge2 .timer .read .t { font-size: 20px !important; letter-spacing: -0.03em; }
  .qt-badge2.long .timer .read .t { font-size: 15px !important; }
  .qt-badge2 .timer .read .cap { display: none; }
  .qt-badge { flex: none; width: 84px; height: 84px; border-radius: 50%; display:flex; flex-direction:column; align-items:center; justify-content:center;
    border: 3px solid var(--wm-neon); background: radial-gradient(circle at 50% 35%, var(--wm-neon-soft), var(--bg) 70%);
    box-shadow: 0 0 22px var(--wm-neon-line), inset 0 0 14px var(--wm-neon-soft); }
  .qt-badge b { font-family: var(--tnum); font-size: 22px; letter-spacing: -0.04em; color: var(--text); line-height: 1; text-shadow: 0 0 10px var(--wm-neon-line); }
  .qt-badge.long b { font-size: 17px; }
  .qt-badge small { color: var(--wm-neon); font-size: 10px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; margin-top: 3px; }
  .qt-chips { display:flex; gap: 6px; overflow-x:auto; padding: 10px 0 2px; scrollbar-width: none; flex: none; }
  .qt-chips::-webkit-scrollbar { display:none; }
  .qt-chips button { flex: none; background: var(--box); border: 1px solid var(--line); border-radius: 999px; color: var(--text); font-size: 13.5px; padding: 7px 13px; cursor:pointer; }
  .qt-chips button.on { border-color: var(--wm-neon); color: var(--wm-neon); background: var(--wm-neon-soft); }
  .qt-filters { flex: none; padding-top: 8px; }
  .qt-frow { display:flex; gap: 6px; overflow-x:auto; padding: 4px 0; scrollbar-width: none; }
  .qt-frow::-webkit-scrollbar { display:none; }
  .qt-frow button { flex: none; background: var(--box); border: 1px solid var(--line); border-radius: 999px; color: var(--muted); font-size: 13.5px; font-weight: 600; padding: 8px 13px; cursor:pointer; }
  .qt-frow button.on { color: var(--text); border-color: var(--wm-neon); background: var(--wm-neon-soft); }
  .qt-frow + .qt-frow button.on { border-color: var(--wm-accent); background: var(--wm-accent-soft); }
  .qt-count { color: var(--faint); font-size: 12px; padding: 8px 4px 2px; }
  .qt-rows { display:flex; flex-direction:column; gap: 3px; margin-top: 12px; border-radius: 18px; overflow: hidden; }
  .qt-srow { background: var(--box); padding: 12px 14px 10px; text-align:center; }
  .qt-sl { font-size: 12px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
  .qt-srow.tone-accent .qt-sl { color: var(--wm-accent); }
  .qt-srow.tone-neon .qt-sl { color: var(--wm-neon); }
  .qt-srow.tone-violet .qt-sl { color: #B57BFF; }
  .qt-srow.tone-ready .qt-sl { color: var(--wm-ready, #3D6BFF); }
  .qt-sline { display:flex; align-items:center; justify-content: space-between; gap: 8px; }
  .qt-pm { flex: none; width: 56px; height: 52px; background: none; border: none; color: var(--text); font-size: 30px; font-weight: 300; cursor:pointer; border-radius: 14px; touch-action: manipulation; }
  .qt-pm:active { background: var(--box-2); }
  .qt-sval { flex: 1; min-width: 0; }
  .qt-sval .qt-tv { font-size: 44px; width: 100%; padding: 0; line-height: 1.15; }
  .qt-su { color: var(--faint); font-size: 11.5px; margin-top: -2px; }
  /* the unified rows (draw: sec, segRow, mini, moveCard) */
  .qt-sec { display:flex; align-items:center; justify-content:space-between; }
  .qt-sec small { text-transform:none; letter-spacing:0; font-weight:500; color: var(--faint); }
  .qt-seclink { background:none; border:none; color: var(--wm-accent); font-size: 13px; font-weight: 700; letter-spacing: .02em; padding: 0; cursor:pointer; text-transform:none; }
  .qt-seg2 { display:flex; gap: 6px; margin-top: 8px; }
  .qt-seg2 button { white-space: nowrap; flex:1; min-height: 42px; background: var(--bg); border: 1px solid var(--line); border-radius: 12px; color: var(--muted); font-size: 14px; font-weight: 600; cursor:pointer; padding: 0 6px; }
  .qt-srow.tone-accent .qt-seg2 button.on { color: var(--wm-accent); border-color: var(--wm-accent); background: var(--wm-accent-soft); }
  .qt-srow.tone-violet .qt-seg2 button.on { color: #B57BFF; border-color: #B57BFF; background: rgba(181,123,255,.12); }
  .qt-srow.tone-ready .qt-seg2 button.on { color: #7D9BFF; border-color: var(--wm-ready, #3D6BFF); background: rgba(61,107,255,.14); }
  .qt-srow .qt-su { margin-top: 6px; }
  .qt-move2 { text-align:left; }
  /* THE MOVE ROW, setup side: the workout's slim row (workmode mvRow) */
  .qt-mvlist { background: var(--box); border-radius: 16px; padding: 2px 12px; }
  .qt-mvr { border-top: 1px solid var(--line); padding: 4px 0; }
  .qt-mvr:first-child { border-top: none; }
  .qt-mvr-top { display:flex; align-items:center; gap: 4px; min-height: 44px; }
  .qt-mvr-top .qt-mx { width: 24px; flex: 0 0 24px; padding: 0; align-self: center; }
  .qt-mvr-n { flex:1; min-width:0; text-align:left; background:none; border:none; color: var(--text); font-size: 16px; font-weight: 600; white-space: nowrap; overflow:hidden; padding: 0; cursor:pointer; font-family: inherit; align-self: stretch; display:flex; align-items:center; }
  .qt-mvr-n.empty { color: var(--wm-accent); }
  /* the numbers, stacked on the right: reps, then the weight under it */
  .qt-mvr-r { flex: 0 0 auto; display:flex; flex-direction:column; align-items:flex-end; }
  .qt-st { display:flex; align-items:center; height: 34px; }
  .qt-st button { width: 28px; height: 34px; background:none; border:none; color: var(--wm-accent); font-size: 20px; line-height:1; cursor:pointer; padding:0; touch-action: manipulation; }
  .qt-st button:active { transform: scale(.85); }
  .qt-st b { min-width: 30px; text-align:center; font-family: var(--tnum); font-size: 18px; font-weight: 700; display:flex; align-items:baseline; justify-content:center; }
  .qt-st b small { font-size: 12px; color: var(--muted); margin-left: 1px; }
  .qt-st input { width: 2.3ch; background:none; border:none; text-align:center; color: var(--text); font: inherit; padding:0; -moz-appearance: textfield; }
  .qt-st input::-webkit-outer-spin-button, .qt-st input::-webkit-inner-spin-button { -webkit-appearance:none; }
  .qt-stl { color: var(--muted); font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; margin-right: 2px; }
  /* the unit IS the kg / lb switch: small, quiet, dotted underline */
  .qt-wu { font-size: 12px; color: var(--muted); padding-left: 2px; text-decoration: underline dotted; text-underline-offset: 3px; cursor: pointer; }
  .qt-addwt { background:none; border:none; color: var(--wm-accent); opacity: .75; font-size: 12.5px; font-weight: 600; padding: 0 30px 6px 0; cursor:pointer; }
  .qt-addrow2 { width:100%; background:none; border:none; border-top: 1px solid var(--line); color: var(--wm-accent); font-size: 15px; font-weight: 700; padding: 13px 0; cursor:pointer; }
  .qt-mvlist .qt-mnote { margin: 0 0 6px; }
  .qt-install { position: relative; background: linear-gradient(135deg, var(--wm-accent-soft), transparent 70%), var(--box); border: 1.5px solid var(--wm-accent); border-radius: 18px; padding: 14px 40px 14px 16px; margin-bottom: 12px; display:flex; flex-direction:column; gap: 6px; box-shadow: 0 0 18px var(--wm-accent-soft); }
  .qt-install b { font-size: 16px; } .qt-install small { color: var(--muted); font-size: 13px; }
  .qt-install ol { margin: 2px 0 0; padding-left: 20px; display:flex; flex-direction:column; gap: 5px; font-size: 14.5px; }
  .qt-install .btn { margin-top: 6px; }
  .qt-ishare { width: 15px; height: 18px; vertical-align: -3px; color: var(--wm-accent); margin: 0 2px; }
  .qt-ix { position:absolute; top: 8px; right: 8px; width: 30px; height: 30px; background:none; border:none; color: var(--faint); font-size: 15px; cursor:pointer; }
  .qt-vo2 { display:flex; flex-direction:column; gap: 8px; text-align:left; }
  .qt-vo2p { display:flex; flex-direction:column; gap: 2px; text-align:left; background: var(--bg); border: 1.5px solid var(--line); border-radius: 14px; padding: 11px 14px; color: var(--text); cursor:pointer; font: inherit; }
  .qt-vo2p b { font-size: 16px; } .qt-vo2p small { color: var(--muted); font-size: 13px; }
  .qt-vo2p.on { border-color: var(--wm-accent); background: var(--wm-accent-soft); box-shadow: 0 0 14px var(--wm-accent-soft); }
  .qt-last { width:100%; display:flex; align-items:center; gap: 8px; margin-top: 8px; background: var(--box); border: 1px solid var(--line); border-radius: 14px; padding: 10px 14px; color: var(--text); cursor:pointer; font: inherit; text-align:left; }
  .qt-last span { color: var(--muted); font-size: 13px; flex: 1; } .qt-last b { font-family: var(--tnum); font-size: 14px; } .qt-last i { font-style: normal; color: var(--wm-accent); font-size: 13px; }
  .qt-hist { display:flex; flex-direction:column; gap: 8px; margin-bottom: 12px; text-align:left; }
  .qt-hrow { background: var(--bg); border-radius: 12px; padding: 10px 12px; }
  .qt-hh { display:flex; justify-content:space-between; gap: 8px; } .qt-hh span { font-family: var(--tnum); font-size: 13.5px; }
  .qt-hrow small { display:block; color: var(--muted); font-size: 12px; margin-top: 4px; }
  .qt-mhead { display:flex; align-items:center; gap: 8px; }
  .qt-mname2 { flex:1; min-width:0; display:flex; align-items:center; justify-content:space-between; gap: 8px; background:none; border:none; padding: 2px 0;
    color: var(--text); font-size: 17px; font-weight: 700; text-align:left; cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .qt-mname2.empty { color: var(--faint); font-weight: 600; }
  .qt-mname2 span { color: var(--wm-accent); font-size: 15px; flex:none; }
  .qt-mnums { display:flex; gap: 10px; margin-top: 8px; }
  .qt-mini { flex:1; min-width:0; background: var(--bg); border-radius: 12px; padding: 6px 4px 4px; text-align:center; }
  .qt-ml { display:block; font-size: 10.5px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
  .qt-mline { display:flex; align-items:center; justify-content:space-between; }
  .qt-pm.sm { width: 40px; height: 38px; font-size: 22px; }
  .qt-mv { flex:1; font-family: var(--tnum); font-size: 22px; font-weight: 700; color: var(--text); }
  .qt-mv input { width: 100%; background:none; border:none; text-align:center; color: var(--text); font: inherit; -moz-appearance: textfield; padding: 0; }
  .qt-mv input::-webkit-outer-spin-button, .qt-mv input::-webkit-inner-spin-button { -webkit-appearance:none; }
  .qt-mnote { color: var(--faint); font-size: 12px; margin-top: 7px; font-family: var(--tnum); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .qt-addrow { width:100%; border: none; color: var(--wm-accent); font-size: 15px; font-weight: 700; cursor:pointer; padding: 14px; }
  .qt-more { display:flex; align-items:center; justify-content:center; gap: 8px; width:100%; margin: 14px 0 0; }
  .qt-more i { font-style: normal; font-size: 18px; transform: rotate(90deg); transition: transform .2s; color: var(--muted); }
  .qt-more.open i { transform: rotate(-90deg); }
  .qt-more em { font-style: normal; color: var(--wm-accent); font-size: 13px; }
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
