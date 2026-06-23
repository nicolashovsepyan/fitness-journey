/* ============================================================
   TIMER PRIMITIVES + AUDIO (beeps) + COACH VOICE
   A small set of reusable clocks the block formats compose.

   Audio policy (from feedback): short BEEPS for frequent cues
   (they mix cleanly over music), VOICE only for milestones
   (halfway, 3-2-1, round done, PR). No spoken "Time".
   ============================================================ */

/* ---- coach voice ---- */
let voiceOn = true;
export function setVoice(on) { voiceOn = on; }
export function isVoiceOn() { return voiceOn; }

/* coach voice selection — auto-pick the most natural English voice,
   but let the user override it in Settings (saved). */
let preferredVoice = null;
let savedVoiceName = (() => { try { return localStorage.getItem('fj.voiceName') || ''; } catch (e) { return ''; } })();

function enVoices() { try { return speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang)); } catch (e) { return []; } }
function pickVoice() {
  try {
    const vs = speechSynthesis.getVoices(); if (!vs.length) return null;
    if (savedVoiceName) { const s = vs.find(v => v.name === savedVoiceName); if (s) return s; }
    const want = ['Samantha', 'Ava', 'Allison', 'Serena', 'Karen', 'Moira', 'Daniel',
      'Google US English', 'Microsoft Aria', 'Microsoft Jenny', 'Microsoft Guy'];
    for (const name of want) { const v = vs.find(x => x.name.includes(name) && /en/i.test(x.lang)); if (v) return v; }
    return vs.find(x => /en[-_]US/i.test(x.lang)) || vs.find(x => /^en/i.test(x.lang)) || vs[0];
  } catch (e) { return null; }
}
try { speechSynthesis.onvoiceschanged = () => { preferredVoice = pickVoice(); }; } catch (e) {}

/* Settings API */
export function listVoices() { return enVoices().map(v => ({ name: v.name, lang: v.lang })); }
export function getVoiceName() { return savedVoiceName || (preferredVoice && preferredVoice.name) || ''; }
export function setVoiceName(name) { savedVoiceName = name || ''; try { localStorage.setItem('fj.voiceName', savedVoiceName); } catch (e) {} preferredVoice = pickVoice(); }

export function say(text) {
  if (!voiceOn) return;
  try {
    if (!preferredVoice) preferredVoice = pickVoice();
    const u = new SpeechSynthesisUtterance(text);
    if (preferredVoice) { u.voice = preferredVoice; u.lang = preferredVoice.lang; }
    u.rate = 0.92; u.pitch = 1.0; u.volume = 1.0;   // slightly slower = less robotic
    speechSynthesis.cancel();   // never let lines pile up
    speechSynthesis.speak(u);
  } catch (e) { /* silent fallback */ }
}

/* ---- Web Audio beeps (mix over music, don't interrupt it) ---- */
let actx = null;
export function initAudio() {
  // call on a user gesture (workout start) so iOS unlocks audio
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    // play a 1-sample silent buffer — the reliable iOS unlock so later beeps actually fire
    const b = actx.createBuffer(1, 1, 22050);
    const src = actx.createBufferSource(); src.buffer = b; src.connect(actx.destination); src.start(0);
  } catch (e) {}
  try { if (!preferredVoice) preferredVoice = pickVoice(); } catch (e) {}   // warm up the voice list
}
function tone(freq, ms, when = 0, vol = 0.5) {
  if (!actx) return;
  const t0 = actx.currentTime + when;
  const osc = actx.createOscillator();
  const gain = actx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
  osc.connect(gain).connect(actx.destination);
  osc.start(t0); osc.stop(t0 + ms / 1000 + 0.02);
}
const VOL = 0.5;                 // standard cue volume (3-2-1 ticks, etc.)
const VOL_END = VOL * 1.15;      // the final beep pops 15% louder than the others
export function beep(kind = 'tick') {
  initAudio();
  if (kind === 'go')        { tone(880, 160, 0, 0.55); }              // start
  else if (kind === 'end')  { tone(700, 120, 0, VOL); tone(1040, 240, 0.13, VOL_END); } // finish: rising double, last beep louder
  else if (kind === 'count'){ tone(740, 90, 0, VOL); }               // 3-2-1 ticks
  else                      { tone(700, 80, 0, VOL); }
}

/* light haptic if supported */
export function buzz(ms = 30) { try { navigator.vibrate?.(ms); } catch (e) {} }

/* ============================================================
   Countdown — used for: rest, holds (TUT), transition buffer,
   inter-round rest. Beeps on milestones; voice only when useful.
   opts: { seconds, onTick(remaining), onDone(), kind, coach }
   kind: 'rest' | 'hold' | 'buffer'
   Returns: { stop(), addTime(n), remaining() }
   ============================================================ */
export function countdown({ seconds, onTick, onDone, kind = 'rest', coach = true }) {
  let remaining = seconds;
  let total = seconds;
  let stopped = false;
  const spoken = new Set();

  function announceStart() {
    if (kind === 'hold') { beep('go'); if (coach) say('Go'); }
    else if (kind === 'buffer') { beep('tick'); }
  }

  function milestones() {
    if (total >= 30 && remaining === Math.round(total / 2) && !spoken.has('half')) {
      spoken.add('half'); if (coach) say('Halfway');
    }
    if (remaining === 10 && total > 14 && !spoken.has('ten')) { spoken.add('ten'); if (coach) say('10 seconds'); }
    if (remaining === 3 && !spoken.has('3')) { spoken.add('3'); beep('count'); }
    else if (remaining === 2 && !spoken.has('2')) { spoken.add('2'); beep('count'); }
    else if (remaining === 1 && !spoken.has('1')) { spoken.add('1'); beep('count'); }
  }

  onTick?.(remaining);
  announceStart();
  milestones();

  const iv = setInterval(() => {
    if (stopped) return;
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(iv);
      onTick?.(0);
      buzz(60); beep('end');     // <-- beep, not the spoken word "Time"
      onDone?.();
      return;
    }
    milestones();
    onTick?.(remaining);
  }, 1000);

  return {
    stop() { stopped = true; clearInterval(iv); },
    addTime(n) { remaining += n; total = Math.max(total + n, remaining); },
    remaining: () => remaining,
  };
}

/* ============================================================
   Interval clock — for Joint Prep free-flow: counts down a total
   duration, and beeps + says "switch" every `interval` seconds so
   you flow through movements hands-free.
   opts: { totalSeconds, interval, onTick(remaining, sinceSwitch), onDone() }
   ============================================================ */
export function intervalClock({ totalSeconds, interval, onTick, onDone, coach = true }) {
  let remaining = totalSeconds;
  let sinceSwitch = 0;
  let stopped = false;
  onTick?.(remaining, 0);
  beep('go'); if (coach) say('Joint prep. Flow.');
  const iv = setInterval(() => {
    if (stopped) return;
    remaining -= 1; sinceSwitch += 1;
    if (remaining <= 0) { clearInterval(iv); onTick?.(0, sinceSwitch); buzz(60); beep('end'); onDone?.(); return; }
    if (sinceSwitch >= interval) { sinceSwitch = 0; beep('go'); if (coach) say('Switch'); }
    onTick?.(remaining, sinceSwitch);
  }, 1000);
  return {
    stop() { stopped = true; clearInterval(iv); },
    setInterval(n) { interval = n; sinceSwitch = 0; },
    remaining: () => remaining,
  };
}

/* mm:ss formatter */
export function fmt(s) {
  s = Math.max(0, Math.round(s));
  const m = Math.floor(s / 60), ss = s % 60;
  return `${m}:${ss.toString().padStart(2, '0')}`;
}

/* keep the screen awake during a workout (best-effort) */
let wakeLock = null;
export async function keepAwake() {
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch (e) {}
}
export function releaseAwake() { try { wakeLock?.release?.(); wakeLock = null; } catch (e) {} }
