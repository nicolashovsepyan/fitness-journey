#!/usr/bin/env node
/* ============================================================
   THE COACH SCRIPT for the studio voices (audio/voices/<voice>/).
   Run:  node tools/voice-script.mjs   → tools/voice-lines.json

   One clip per SENTENCE, the way voice.js plays a line: it splits on
   punctuation and plays the longest recorded pieces back to back. So
   "Round 4. Halfway home. Burpees." is three clips, and every round
   call, motivation line, move name and cue the app can say is covered.

   Each entry: key (the file name), text (what the app writes, for the
   matching), say (what the voice actually reads, with the energy).
   ============================================================ */
import { readFileSync, writeFileSync } from 'node:fs';
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.navigator ??= { language: 'en-US' };
const { LINES, CUES, LAST, TWO, THREE, HALF } = await import('../js/runner/coach-lines.js');

const out = [], seen = new Set();
const norm = t => String(t).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const add = (key, text, say = text) => { const n = norm(text); if (!n || seen.has(n)) return; seen.add(n); out.push({ key, text, say }); };
const slug = t => 's-' + norm(t).replace(/ /g, '-').slice(0, 48);
const sentences = line => line.split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(Boolean);

/* numbers, said as a count */
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const words = n => n < 20 ? ONES[n] : n < 100 ? TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '') : 'one hundred' + (n % 100 ? ' ' + words(n % 100) : '');
const cap = s => s[0].toUpperCase() + s.slice(1);
for (let n = 1; n <= 120; n++) out.push({ key: 'n' + n, text: String(n), say: cap(words(n)) + '.' }), seen.add(String(n));

/* the countdown, sharper than a count */
out.push({ key: 'c-three', text: 'Three', say: 'Three!' }, { key: 'c-two', text: 'Two', say: 'Two!' }, { key: 'c-one', text: 'One', say: 'One!' });

/* the words the timer has always said (same keys as audio/voice) */
const CORE = {
  'c-go': ['Go', 'Go!'], 'c-get-ready': ['Get ready', 'Get ready.'], 'c-rest': ['Rest', 'Rest.'], 'c-switch': ['Switch', 'Switch!'],
  'c-next': ['Next', 'Next.'], 'c-halfway': ['Halfway', 'Halfway!'], 'c-last-round': ['Last round', 'Last round!'],
  'c-one-minute-left': ['One minute left', 'One minute left.'], 'c-ten-seconds': ['Ten seconds', 'Ten seconds!'],
  'c-hold-it': ['Hold it', 'Hold it.'], 'c-hold': ['Hold', 'Hold.'], 'c-round': ['Round', 'Round.'], 'c-rounds': ['Rounds', 'rounds.'],
  'c-done': ['Done', 'Done!'], 'c-round-done': ['Round done', 'Round done!'], 'c-rung-done': ['Rung done', 'Rung done!'],
  'c-seconds': ['Seconds', 'seconds.'], 'c-minutes': ['Minutes', 'minutes.'], 'c-push-ups': ['Push-ups', 'Push-ups.'],
  'c-strong-work': ['Strong work', 'Strong work!'], 'c-well-done': ['Well done', 'Well done!'], 'c-saved': ['Saved', 'Saved.'],
  'c-new-record': ['New record', 'New record!'], 'c-max-reps': ['Max reps', 'Max reps!'],
  'c-every-minute-on-the-minute': ['Every minute on the minute', 'Every minute, on the minute.'], 'c-times-up': ["Time's up", "Time's up!"],
  'c-keep-going': ['Keep going', 'Keep going!'], 'c-breathe': ['Breathe', 'Breathe.'],
  'c-as-many-rounds-as-possible': ['As many rounds as possible', 'As many rounds as possible!'],
  'c-pushup-test-intro': ["This is the push-up test. Start on the double beep. Then one push-up on every beep. I'll count",
    "This is the push-up test. Start on the double beep. Then one push-up on every beep. I'll count."],
  'c-for-time': ['For time', 'For time.'], 'c-minute': ['Minute', 'minute.'], 'c-second': ['Second', 'second.'],
  'c-flagged': ['Flagged. Skip it if it hurts', 'Flagged. Skip it if it hurts.'], 'c-rung': ['Rung', 'Rung.'],
};
for (const [k, [text, say]] of Object.entries(CORE)) add(k, text, say);

/* round and rung calls: "Round 7." is one clip, 1 to 40 */
for (let n = 1; n <= 40; n++) add('r-' + n, `Round ${n}`, `Round ${words(n)}.`);
for (let n = 1; n <= 30; n++) add('g-' + n, `Rung ${n}`, `Rung ${words(n)}.`);

/* every sentence of every coach line and round-call tail */
const energy = s => /^(go|push|let'?s|finish|empty|dig|make it count|everything)/i.test(s) ? s.replace(/\.$/, '!') : s;
const lines = [...Object.values(LINES).flat(), ...LAST, ...TWO, ...THREE, ...HALF,
  'Rest. Next.', 'Halfway.', '1 minute left.', 'Workout complete. Strong work.', 'Most efficient session yet. Great work.',
  'Strong work.', 'Well done.', 'New record.'];
for (const line of lines) for (const s of sentences(line)) {
  if (/^Round \{n\}\.?$/.test(s)) continue;
  add(slug(s), s.replace(/\.$/, ''), energy(s));
}

/* every move: its name, and its one cue */
const names = JSON.parse(readFileSync(new URL('./voice-names.json', import.meta.url)));
const cues = { ...JSON.parse(readFileSync(new URL('./voice-cues.json', import.meta.url))), ...CUES };
for (const [id, name] of Object.entries(names)) out.push({ key: 'm-' + id, text: name, say: name.replace(/\.?$/, '.') });
for (const cue of new Set(Object.values(cues))) for (const s of sentences(cue)) add(slug(s), s.replace(/\.$/, ''), s);

writeFileSync(new URL('./voice-lines.json', import.meta.url), JSON.stringify(out, null, 1));
const chars = out.reduce((a, x) => a + x.say.length, 0);
console.log(`${out.length} clips, ${chars} characters per voice`);
