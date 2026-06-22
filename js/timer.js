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

export function say(text) {
  if (!voiceOn) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.02; u.pitch = 1.0; u.volume = 1.0;
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
  } catch (e) {}
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
export function beep(kind = 'tick') {
  initAudio();
  if (kind === 'go')        { tone(880, 160, 0, 0.55); }              // start
  else if (kind === 'end')  { tone(660, 120, 0, 0.5); tone(990, 200, 0.13, 0.55); } // finish: rising double
  else if (kind === 'count'){ tone(740, 90, 0, 0.4); }               // 3-2-1 ticks
  else                      { tone(700, 80, 0, 0.4); }
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
