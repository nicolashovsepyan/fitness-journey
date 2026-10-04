/* ============================================================
   TIMER AUDIT — hear what every timer actually says, in order.
   Dev only. Loaded into the running app (index.html?quick) from the
   browser pane:   const A = await import('/tools/audit/timer-audit.js');
   1. A.setup(mode)    writes a short version of that timer + audit prefs, reload
   2. A.run(mode)      after the reload: listens, presses Start, plays the
                       workout like a person would, returns the timeline
   It listens at the audio engine itself, so it hears exactly what a phone
   would: every beep (by its tones), every piece of Nico's voice (by file),
   and every line the phone's robot voice had to read.
   ============================================================ */

const MOVES = {
  burpee: { exId: 'burpee', name: 'Burpee' }, pushup: { exId: 'pushup', name: 'Push-ups' },
  pullup: { exId: 'pullup', name: 'Pull-Up' }, plank: { exId: 'forearm_plank', name: 'Forearm Plank' },
  squat: { exId: 'goblet_squat', name: 'Goblet Squat' },
};
const mv = (k, extra = {}) => ({ ...MOVES[k], reps: '', ...extra });
/* each timer, short enough to run for real */
export const MODES = {
  tabata:   { cfg: { fmt: 'tabata', work: 5, rest: 3, rounds: 4, tbN: null, tbTotal: null, movesBy: { tabata: [mv('burpee'), mv('pushup')] } }, secs: 70 },
  emom:     { cfg: { fmt: 'emom', every: 15, mins: 1, movesBy: { emom: [mv('pullup', { reps: 5 }), mv('pushup', { reps: 10 })] } }, secs: 66, taps: [{ at: 6, sel: '#ivDone' }, { at: 22, sel: '#ivDone' }] },
  timer:    { cfg: { fmt: 'timer', tWork: 8, tRest: 4, tRounds: 3, sets: 1, movesBy: { timer: [mv('plank')] } }, secs: 40 },
  amrap:    { cfg: { fmt: 'amrap', cap: 1, movesBy: { amrap: [mv('squat', { reps: 10 }), mv('pushup', { reps: 10 })] } }, secs: 34, taps: [{ at: 8, sel: '#rdPlus' }, { at: 16, sel: '#rdPlus' }, { at: 24, sel: '#rdPlus' }, { at: 28, sel: '#endAmrap' }, { at: 30, sel: '#confirm' }] },
  fortime:  { cfg: { fmt: 'fortime', ftRounds: 1, ftCap: 0, movesBy: { fortime: [mv('burpee', { reps: 10 })] } }, secs: 14, taps: [{ at: 10, sel: '#ftDone' }] },
  deathby:  { cfg: { fmt: 'deathby', dbEvery: 15, dbMax: 30, movesBy: { deathby: [{ ...MOVES.burpee, reps: '', ldStart: 1, ldStep: 1 }] } }, secs: 40, taps: [{ at: 36, sel: '#dbOut' }] },
  ladder:   { cfg: { fmt: 'ladder', ldRungs: 4, ldShape: 'one', ldCap: 0, movesBy: { ladder: [{ ...MOVES.pushup, reps: '', ldStart: 1, ldStep: 1 }] } }, secs: 24, taps: [{ at: 7, sel: '#ftLap' }, { at: 11, sel: '#ftLap' }, { at: 15, sel: '#ftLap' }, { at: 19, sel: '#ftLap' }] },
  stopwatch:{ cfg: { fmt: 'stopwatch' }, secs: 12, taps: [{ at: 9, sel: '#ftDone' }] },
  pushup:   { cfg: { fmt: 'pushup', pace: 20, ptCap: 0 }, secs: 30, taps: [{ at: 22, sel: '#cadStop' }] },
};

export function setup(mode) {
  const m = MODES[mode];
  const prev = JSON.parse(localStorage.getItem('fj.quickTimer') || '{}');
  localStorage.setItem('fj.quickTimer', JSON.stringify({ last: { ...(prev.last || {}), ...m.cfg, movesBy: { ...(prev.last?.movesBy || {}), ...m.cfg.movesBy } }, favs: prev.favs || [] }));
  const p = JSON.parse(localStorage.getItem('fj.workModePrefs') || '{}');
  localStorage.setItem('fj.workModePrefs', JSON.stringify({ ...p, voice: true, beeps: true, cues: true, ready: 3 }));
  location.reload();
}

/* the ears */
const SIG = { '1046,1568': 'go', '1318,1568,2093': 'end', '1760': 'count', '1175,1175': 'warn', '1046,1318,1568,2093': 'round', '1568,1568': 'start', '1318': 'rep/tick', '784': 'down', '1568': 'up' };
function listen() {
  const log = [], t0 = performance.now(), now = () => +((performance.now() - t0) / 1000).toFixed(2);
  const urlOf = new WeakMap();
  const f0 = window.fetch;
  window.fetch = async (u, ...a) => { const r = await f0(u, ...a); if (/\.mp3/.test(String(u))) { const ab = r.arrayBuffer.bind(r); r.arrayBuffer = async () => { const b = await ab(); urlOf.set(b, String(u)); return b; }; } return r; };
  const dec = AudioContext.prototype.decodeAudioData;
  AudioContext.prototype.decodeAudioData = function (ab, ok, no) {
    const u = urlOf.get(ab);
    return dec.call(this, ab, b => { if (b && u) b.__key = u.replace(/^.*audio\//, '').replace('.mp3', ''); ok && ok(b); }, no);
  };
  const bs = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (when = 0, ...a) {
    if (this.buffer?.__key) log.push({ t: now(), kind: 'voice', key: this.buffer.__key, at: +(when - this.context.currentTime).toFixed(2) });
    return bs.call(this, when, ...a);
  };
  const os = OscillatorNode.prototype.start;
  let toneBuf = [];
  OscillatorNode.prototype.start = function (when = 0, ...a) {
    const f = Math.round(this.frequency.value);
    if (Number.isInteger(this.frequency.value)) toneBuf.push({ t: now() + Math.max(0, when - this.context.currentTime), f });
    return os.call(this, when, ...a);
  };
  const sp = speechSynthesis.speak.bind(speechSynthesis);
  speechSynthesis.speak = u => { if (u.text.trim()) log.push({ t: now(), kind: 'ROBOT', text: u.text }); return sp(u); };
  /* tones that start within 0.35 s of each other are one beep */
  const beeps = () => {
    const out = []; const ts = toneBuf.sort((a, b) => a.t - b.t);
    for (const x of ts) { const g = out.at(-1); if (g && x.t - g.t0 < 0.35 && g.fs.length < 4) g.fs.push(x.f); else out.push({ t0: +x.t.toFixed(2), fs: [x.f] }); }
    return out.map(g => ({ t: g.t0, kind: 'beep', key: SIG[g.fs.join(',')] || g.fs.join(',') }));
  };
  return { log, beeps, now };
}

/* the voice pieces back into words, a line = pieces closer than 0.7 s */
async function words(log) {
  let idx = {};
  try { idx = (await (await fetch('audio/voice/index.json')).json()).pieces; } catch (e) {}
  const lines = [];
  for (const e of log) {
    const key = e.key?.split('/').pop(), text = e.kind === 'voice' ? (idx[key] ?? key) : e.text;
    const last = lines.at(-1);
    if (e.kind === 'voice' && last?.kind === 'voice' && e.t - last.end < 0.7) { last.text += ' · ' + text; last.end = e.t; }
    else lines.push({ t: e.t, end: e.t, kind: e.kind, text });
  }
  return lines;
}

/* step 1 after the reload: start listening (then tap Start with a real
   tap, so the phone-like audio engine actually runs), then run() */
export function arm() { window.__ears = listen(); return 'listening'; }
export async function run(mode) {
  const m = MODES[mode];
  const w = ms => new Promise(r => setTimeout(r, ms));
  const ears = window.__ears || listen();
  if (!window.__ears) { await w(800); document.getElementById('qtGo')?.click(); }
  await w(900);
  const t0 = performance.now(); const el = () => (performance.now() - t0) / 1000;
  const taps = [...(m.taps || [])];
  while (el() < m.secs) {
    while (taps.length && el() >= taps[0].at + 3 + 0.9) { const t = taps.shift(); document.querySelector(t.sel)?.click(); }
    await w(100);
  }
  await w(1500);
  return (window.__auditResult = await report(mode));
}
/* the timeline so far (also callable mid-run) */
export async function report(mode = '') {
  const ears = window.__ears;
  const lines = await words(ears.log);
  const all = [...lines.map(l => ({ t: l.t, kind: l.kind, what: l.text })), ...ears.beeps().map(b => ({ t: b.t, kind: 'beep', what: b.key }))].sort((a, b) => a.t - b.t);
  const screen = document.body.innerText.slice(0, 160).replace(/\s+/g, ' ');
  return { mode, robot: lines.filter(l => l.kind === 'ROBOT').map(l => l.text), timeline: all.map(x => `${x.t.toFixed(1).padStart(5)}s ${x.kind === 'beep' ? '  ♪' : x.kind === 'ROBOT' ? '🤖' : '🗣'} ${x.what}`), screen };
}
