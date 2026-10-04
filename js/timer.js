/* ============================================================
   TIMER PRIMITIVES + AUDIO (beeps) + COACH VOICE
   A small set of reusable clocks the block formats compose.

   Audio policy (from feedback): short BEEPS for frequent cues
   (they mix cleanly over music), VOICE only for milestones
   (halfway, 3-2-1, round done, PR). No spoken "Time".
   ============================================================ */

import { storage } from './core/storage.js';
import { loadVoicePack, warmVoice, plan, playLine, stopVoice } from './voice.js';
loadVoicePack();

/* ---- coach voice ---- */
let voiceOn = true;
export function setVoice(on) { voiceOn = on; }
/* Muted while the runner fast-forwards through steps that ran out while the
   phone was locked: 12 missed intervals must not fire 12 beeps at once. */
let muted = false;
export function setMuted(on) { muted = !!on; }
/* the user's own switch for the beeps (Work Mode settings) */
let beepsOn = true;
export function setBeeps(on) { beepsOn = !!on; }
export function isVoiceOn() { return voiceOn; }

/* coach voice selection — auto-pick the most natural English voice,
   but let the user override it in Settings (saved). */
let preferredVoice = null;
/* Read at boot rather than at import. This used to run at module
   evaluation time, which only worked because storage was synchronous —
   an ES module cannot await before it finishes evaluating. app.js
   awaits loadVoicePref() instead. */
let savedVoiceName = '';
export async function loadVoicePref() {
  savedVoiceName = (await storage().getDevicePref('voiceName', '')) || '';
  preferredVoice = pickVoice();
}

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
export function setVoiceName(name) {
  savedVoiceName = name || '';
  storage().setDevicePref('voiceName', savedVoiceName);   // device-local, never synced
  preferredVoice = pickVoice();
}

/* `keep`: a milestone ("Last round.") gets that many ms before the next
   line may cut it off; anything said inside the window queues behind it
   instead of cancelling it. */
let keepUntil = 0;
/* the phone's voice, for a word Nico has not recorded: resolves when done */
function speakNow(text) {
  return new Promise(done => {
    try {
      if (!text) return done();
      if (!preferredVoice) preferredVoice = pickVoice();
      const u = new SpeechSynthesisUtterance(text);
      if (preferredVoice) { u.voice = preferredVoice; u.lang = preferredVoice.lang; }
      u.rate = 0.92;
      const t = setTimeout(done, 600 + text.length * 90);      // onend is not reliable everywhere
      u.onend = () => { clearTimeout(t); done(); };
      speechSynthesis.speak(u);
    } catch (e) { done(); }
  });
}
let voiceChain = Promise.resolve();
export function say(text, keep = 0) {
  if (!voiceOn || muted) return;
  /* NICO'S RECORDED VOICE first (js/voice.js); the phone's voice only for
     the words not recorded yet */
  try { if (actx && actx.state !== 'running') actx.resume().catch?.(() => {}); } catch (e) {}   // interrupted mid-workout: wake it
  const steps = actx && plan(text);
  if (steps) {
    const now = Date.now() >= keepUntil;
    if (keep) keepUntil = Date.now() + keep;
    if (now) { stopVoice(); try { speechSynthesis.cancel(); } catch (e) {} voiceChain = playLine(actx, steps, speakNow, beepUntil).catch(() => {}); }
    else voiceChain = voiceChain.then(() => playLine(actx, steps, speakNow, beepUntil)).catch(() => {});
    return;
  }
  try {
    if (!preferredVoice) preferredVoice = pickVoice();
    const u = new SpeechSynthesisUtterance(text);
    if (preferredVoice) { u.voice = preferredVoice; u.lang = preferredVoice.lang; }
    u.rate = 0.92; u.pitch = 1.0; u.volume = 1.0;   // slightly slower = less robotic
    if (Date.now() >= keepUntil) speechSynthesis.cancel();   // never let lines pile up
    if (keep) keepUntil = Date.now() + keep;
    speechSynthesis.speak(u);
  } catch (e) { /* silent fallback */ }
}

/* ---- Web Audio beeps (mix over music, don't interrupt it) ---- */
let actx = null;
let speechPrimed = false;
/* "Sound on silent mode" (Work Mode settings): off by default, because on
   an iPhone the only way past the ringer switch also stops the music */
let silentOverride = false;
let voiceWarm = false;
let sessionType = null;
function setSessionType() {
  const want = silentOverride ? 'playback' : 'ambient';
  if (want === sessionType) return;
  try { if (navigator.audioSession) { navigator.audioSession.type = want; sessionType = want; } } catch (e) {}
  try { if (actx && actx.state !== 'running') actx.resume().catch?.(() => {}); } catch (e) {}
}
export function setSilentOverride(on) { silentOverride = !!on; setSessionType(); if (!silentOverride) { try { keepalive?.pause?.(); } catch (e) {} } }
let keepalive = null;

/* THREE SEPARATE THINGS SILENCE A PHONE, AND UNLOCKING ONE FIXES NOTHING
   FOR THE OTHER TWO. All three are handled here, and all three have to
   happen inside a real user gesture or they do not count.

   1. THE AUDIO CONTEXT. Created suspended unless a gesture has happened.
      This one was already handled - resume, plus a one-sample silent
      buffer, which is the reliable iOS unlock.

   2. SPEECH. On iOS, speechSynthesis ignores every speak() that did not
      follow a gesture, permanently, for the life of the page. Warming up
      the VOICE LIST is not the same thing and is what this used to do, so
      the beeps could come back while the coach voice stayed dead. It has
      to actually speak once, during the gesture. A single space at zero
      volume is enough and is inaudible.

   3. THE RINGER SWITCH. This is the one that is nobody's bug and silences
      everything anyway. iOS plays Web Audio on the ambient channel, which
      the hardware mute switch cuts - and a phone at a gym is on silent.
      Playing an HTML media element moves the whole audio session to the
      playback channel, which ignores the switch. So a silent looping clip
      runs for the length of the workout and stops when it ends.

   Called on every gesture; everything here is idempotent and cheap after
   the first time. */
export function initAudio() {
  /* the audio session type is set BEFORE the context exists, and only when
     it changes: changing it under a running context is what Safari answers
     with an "interrupted" context, which then plays nothing */
  setSessionType();
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    /* "suspended" (no gesture yet) AND "interrupted" (Safari, after a call,
       Siri, another app, a session change): either way, start it again */
    if (actx.state !== 'running') actx.resume().catch?.(() => {});
    // play a 1-sample silent buffer — the reliable iOS unlock so later beeps actually fire
    const b = actx.createBuffer(1, 1, 22050);
    const src = actx.createBufferSource(); src.buffer = b; src.connect(actx.destination); src.start(0);
  } catch (e) {}

  /* the recorded voice: decoded in the background, one piece at a time */
  if (actx && !voiceWarm) { voiceWarm = true; warmVoice(actx); }

  /* 2 — speech has its own gate, and it is one-shot */
  try {
    if (!speechPrimed && typeof speechSynthesis !== 'undefined') {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      speechSynthesis.speak(u);
      speechPrimed = true;
    }
  } catch (e) {}

  /* 3 — MUSIC FIRST. By default the timer mixes with whatever is playing
     (Spotify, Apple Music): the audio session is "ambient", the kind iOS
     plays alongside music. The cost: the ringer switch silences it. Only
     when the person asks for "Sound on silent mode" does the old trick
     below run, and that one pauses their music, which is why it is off
     unless chosen. */
  /* 3b — take the session off the ringer channel. iPHONE ONLY, OPT-IN.
     Android has no ringer switch that silences Web Audio, and on Android
     Chrome a playing <audio> element asks for audio focus: volume 0 is not
     muted, so a looping clip held "may duck" focus for the whole session
     and turned the client's Spotify down from the first tap to the last.
     The beeps are Web Audio and mix over music on their own. */
  try {
    const ios = /iP(hone|ad|od)/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (!ios || !silentOverride) { keepalive?.pause?.(); throw 0; }
    if (!keepalive) {
      keepalive = new Audio(SILENCE);
      keepalive.loop = true;
      keepalive.volume = 0;
      /* not a track anybody chose; keep it off the lock screen where we can */
      keepalive.setAttribute('playsinline', '');
    }
    if (keepalive.paused) { const pr = keepalive.play(); if (pr && pr.catch) pr.catch(() => {}); }
  } catch (e) {}

  try { if (!preferredVoice) preferredVoice = pickVoice(); } catch (e) {}   // warm up the voice list
}

/* Stop the silent clip when the workout does. Leaving it running holds an
   audio session open for no reason, and an app that quietly keeps the
   speaker awake after you have finished training is its own small bug. */
export function stopAudio() {
  try { keepalive?.pause?.(); } catch (e) {}
}

/* A real silent clip - 8 kHz, 8-bit mono, a quarter second - not a
   zero-length one. A WAV with no samples ends the instant it starts and
   some browsers never fire the loop, which puts the session straight back
   on the ringer channel it was moved off. Inline because it has to work
   with no connection. */
const SILENCE = 'data:audio/wav;base64,UklGRvQHAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YdAHAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';
/* Master chain: everything routes through a compressor + make-up gain so the
   cues stay audible OVER music. A pure sine is the easiest thing in the world
   for a mix to mask, so the tones are now harmonically rich (square/sawtooth)
   and land in the 1-3 kHz band where the ear is most sensitive and where most
   music has the least energy. */
let masterGain = null;
function master() {
  if (!actx) return null;
  if (masterGain) return masterGain;
  // input gain → compressor → MAKE-UP gain → out.
  // The make-up stage after the compressor is the part that actually makes it
  // loud: the compressor flattens the peaks, then we push the whole thing back
  // up. Gain before the compressor alone just gets squashed away.
  const comp = actx.createDynamicsCompressor();
  comp.threshold.value = -24; comp.knee.value = 3; comp.ratio.value = 8;
  comp.attack.value = 0.001; comp.release.value = 0.12;
  const makeup = actx.createGain();
  makeup.gain.value = 2.2;                 // ~+7 dB after compression
  // Soft clipper (tanh). Two jobs: it stops the make-up gain from clipping
  // into harsh digital distortion, and the gentle saturation adds upper
  // harmonics — which is exactly what helps a cue cut through music.
  const shaper = actx.createWaveShaper();
  const n = 1024, curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 1.8) * 0.92;
  }
  shaper.curve = curve; shaper.oversample = '4x';
  masterGain = actx.createGain();
  masterGain.gain.value = 1.0;
  masterGain.connect(comp).connect(makeup).connect(shaper).connect(actx.destination);
  return masterGain;
}

/* one tone. `type` picks the timbre: 'square' cuts hardest, 'sawtooth' is
   bright but slightly smoother, 'sine' is reserved for soft cues. */
function tone(freq, ms, when = 0, vol = 0.5, type = 'square') {
  if (!actx) return;
  const out = master(); if (!out) return;
  const t0 = actx.currentTime + when;
  const osc = actx.createOscillator();
  const gain = actx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  // a touch of detune thickens the tone so it doesn't vanish into a dense mix
  const osc2 = actx.createOscillator();
  osc2.type = type; osc2.frequency.value = freq * 1.005;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.006);   // fast attack = percussive
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
  osc.connect(gain); osc2.connect(gain); gain.connect(out);
  osc.start(t0); osc2.start(t0);
  osc.stop(t0 + ms / 1000 + 0.02); osc2.stop(t0 + ms / 1000 + 0.02);
}

/* Cue volume. Deliberately hot — these have to be heard over headphones
   playing music at gym volume. The compressor keeps it from clipping. */
const VOL = 1.0;
const VOL_END = 1.0;
/* `at` = seconds from now. Scheduled on the audio clock, which is exact to
   the sample, so a cadence (the push-up test) stays on the beat even when
   the page's timers wobble. */
/* when the last beep finishes, on the audio clock: the voice waits for it
   instead of talking over the end-of-step chime */
let beepUntil = 0;
const BEEP_LEN = { go: 0.3, end: 0.5, count: 0.1, warn: 0.2, round: 0.45, start: 0.33, rep: 0.15, down: 0.12, up: 0.12 };
export function beep(kind = 'tick', at = 0) {
  if (muted || !beepsOn) return;
  initAudio();
  const w = Math.max(0, at);
  try { if (kind !== 'count' && kind !== 'rep') beepUntil = Math.max(beepUntil, actx.currentTime + w + (BEEP_LEN[kind] || 0.1) + 0.06); } catch (e) {}
  if (kind === 'go') {                       // start — rising two-tone
    tone(1046, 110, w,        0.85, 'square');
    tone(1568, 190, w + 0.09, VOL,  'square');
  } else if (kind === 'end') {               // finish — bright triple, unmistakable
    tone(1318, 110, w,        VOL,     'square');
    tone(1568, 110, w + 0.10, VOL,     'square');
    tone(2093, 280, w + 0.20, VOL_END, 'square');
  } else if (kind === 'count') {             // 3-2-1 ticks — short and sharp
    tone(1760, 95, w, VOL, 'square');
  } else if (kind === 'warn') {              // 10 seconds left — a quick double, not a countdown
    tone(1175, 70, w,        VOL, 'square');
    tone(1175, 70, w + 0.12, VOL, 'square');
  } else if (kind === 'round') {             // a round done: a quick rising victory chime
    tone(1046, 70, w,        VOL, 'square');
    tone(1318, 70, w + 0.07, VOL, 'square');
    tone(1568, 70, w + 0.14, VOL, 'square');
    tone(2093, 220, w + 0.21, VOL, 'square');
  } else if (kind === 'start') {             // push-up test, first rep: a double beep = "go now"
    tone(1568, 110, w,        VOL, 'square');
    tone(1568, 160, w + 0.16, VOL, 'square');
  } else if (kind === 'rep') {               // push-up test: one clear beep per rep
    tone(1318, 150, w, VOL, 'square');
  } else if (kind === 'down') {              // push-up test: go down — low
    tone(784, 120, w, VOL, 'square');
  } else if (kind === 'up') {                // push-up test: come up — high
    tone(1568, 120, w, VOL, 'square');
  } else {
    tone(1318, 85, w, 0.9, 'square');
  }
}

/* light haptic if supported */
export function buzz(ms = 30) { try { navigator.vibrate?.(ms); } catch (e) {} }   // a number, or a pattern [on, off, on…]

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
