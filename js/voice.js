/* ============================================================
   NICO'S VOICE — the coach voice, recorded.
   audio/voice/ holds one short mp3 per piece (numbers 1 to 120, the cues,
   the fundamental moves), built by tools/build-voice.py from Nico's Voice
   Memos takes. A line the timer wants to say is broken into the longest
   recorded pieces it can find ("Rest. Next, Burpees." = Rest + Next +
   Burpees) and they play back to back. A word nobody has recorded yet is
   handed to the phone's own voice, in its place in the line.

   Played through Web Audio on the same context as the beeps, never an
   <audio> element: Web Audio mixes with the person's music (an element
   would take the audio focus and pause it).
   ============================================================ */
import { EXERCISES } from './data/exercises.js';

let index = null, loading = null;
const buffers = new Map();
let dict = null, maxWords = 1;

const norm = t => String(t).toLowerCase()
  .replace(/\(.*?\)/g, ' ').replace(/[’']/g, '').replace(/[-–—]/g, ' ')
  .replace(/[^a-z0-9 .,]/g, ' ').replace(/\s+/g, ' ').trim();

/* every way a piece can be written in a line → its file */
function buildDict(pieces) {
  const d = new Map();
  const add = (text, key) => { const n = norm(text).replace(/[.,]/g, '').trim(); if (n && !d.has(n)) d.set(n, key); };
  for (const [key, text] of Object.entries(pieces)) {
    if (key.startsWith('n')) { add(text, key); continue; }
    if (key.startsWith('m-')) {
      const ex = EXERCISES[key.slice(2)];
      for (const t of [text, ex?.name].filter(Boolean)) {
        add(t, key);
        const n = norm(t);                                  // plural and singular both
        add(n.endsWith('s') ? n.slice(0, -1) : n + 's', key);
      }
      continue;
    }
    add(text, key);
  }
  /* the same thing, written the way the timer writes it */
  const alias = { '1 minute left': 'c-one-minute-left', '10 seconds': 'c-ten-seconds', 'times up': 'c-times-up',
    'round done': 'c-round-done', 'rung done': 'c-rung-done', 'push ups': 'c-push-ups',
    'push up test start on the double beep then one push up on every beep ill count': 'c-pushup-test-intro' };
  for (const [t, k] of Object.entries(alias)) if (pieces[k]) d.set(t, k);
  maxWords = Math.max(...[...d.keys()].map(k => k.split(' ').length));
  return d;
}

/* load the index once; the pieces themselves load as they are first needed
   (and all of them in the background after the first gesture) */
export function loadVoicePack() {
  if (loading) return loading;
  loading = fetch('audio/voice/index.json').then(r => r.ok ? r.json() : null)
    .then(j => { if (j?.pieces) { index = j.pieces; dict = buildDict(index); } })
    .catch(() => {});
  return loading;
}
export const hasVoicePack = () => !!dict;

async function bufferFor(actx, key) {
  if (buffers.has(key)) return buffers.get(key);
  const p = fetch(`audio/voice/${key}.mp3`).then(r => r.arrayBuffer())
    .then(ab => new Promise((ok, no) => actx.decodeAudioData(ab, ok, no)))
    .catch(() => null);
  buffers.set(key, p);
  return p;
}
export async function warmVoice(actx) {
  await loadVoicePack();
  if (!index || !actx) return;
  for (const key of Object.keys(index)) await bufferFor(actx, key);   // one at a time: never a burst of decoding mid-workout
}

/* a line → [{ key } | { tts }] */
export function plan(text) {
  if (!dict) return null;
  /* the whole line recorded as one piece ("Workout complete. Strong work.") */
  const whole = dict.get(norm(text).replace(/[.,]/g, '').replace(/\s+/g, ' ').trim());
  if (whole) return [{ key: whole, stop: true }];
  const sentences = norm(text).split(/[.,]+/).map(x => x.trim()).filter(Boolean);
  const out = [];
  for (const sent of sentences) {
    const w = sent.split(' ');
    let parts = [], i = 0;
    while (i < w.length) {
      let hit = null, len = 0;
      for (let n = Math.min(maxWords, w.length - i); n > 0; n--) {
        const k = dict.get(w.slice(i, i + n).join(' '));
        if (k) { hit = k; len = n; break; }
      }
      if (hit) { parts.push({ key: hit, words: w.slice(i, i + len) }); i += len; }
      else { parts.push({ tts: true, words: [w[i]] }); i++; }
    }
    /* half a move name in each voice sounds wrong ("Archer" + Nico's
       "Push-ups"): a recorded move touching unrecorded words goes to the
       phone's voice with them */
    parts = parts.map((p, j) => p.key?.startsWith('m-') && (parts[j - 1]?.tts || parts[j + 1]?.tts) ? { tts: true, words: p.words } : p);
    const merged = [];
    for (const p of parts) {
      if (p.tts && merged.at(-1)?.tts) merged.at(-1).words.push(...p.words);
      else merged.push({ ...p, words: [...p.words] });
    }
    merged.forEach(p => out.push(p.tts ? { tts: p.words.join(' ') } : { key: p.key }));
    if (out.length) out[out.length - 1].stop = true;     // a breath at the end of a sentence
  }
  /* "3", "2", "1" alone are a countdown: the countdown takes, not the count */
  if (out.length === 1 && /^n[123]$/.test(out[0].key || '')) {
    const k = { n3: 'c-three', n2: 'c-two', n1: 'c-one' }[out[0].key];
    if (index[k]) out[0].key = k;
  }
  return out.some(x => x.key) ? out : null;
}

/* PLAYBACK. One line at a time; a new line cuts the old one (the timer's
   rule), unless the caller queues it. Pieces carry a little air at each
   end, so they overlap slightly to sound like one sentence. */
let playing = null;
export function stopVoice() { if (playing) { playing.cancelled = true; playing.sources.forEach(s => { try { s.stop(); } catch (e) {} }); playing = null; } }

export async function playLine(actx, steps, speak) {
  const run = { cancelled: false, sources: [] };
  playing = run;
  let t = actx.currentTime + 0.03;
  for (const st of steps) {
    if (run.cancelled) return;
    if (st.tts) {
      /* wait for what is scheduled, then let the phone's voice say it */
      await new Promise(r => setTimeout(r, Math.max(0, (t - actx.currentTime) * 1000)));
      if (run.cancelled) return;
      await speak(st.tts);
      t = actx.currentTime + 0.05;
      continue;
    }
    const buf = await bufferFor(actx, st.key);
    if (run.cancelled) return;
    if (!buf) { await speak(index[st.key] || ''); t = actx.currentTime + 0.05; continue; }
    const src = actx.createBufferSource(); src.buffer = buf;
    const g = actx.createGain(); g.gain.value = 1.0;
    src.connect(g).connect(actx.destination);
    t = Math.max(t, actx.currentTime + 0.01);
    src.start(t);
    run.sources.push(src);
    t += buf.duration - (st.stop ? 0.02 : 0.13);           // pieces run into each other; a sentence end keeps its pause
  }
  await new Promise(r => setTimeout(r, Math.max(0, (t - actx.currentTime) * 1000)));
  if (playing === run) playing = null;
}
