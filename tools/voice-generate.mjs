#!/usr/bin/env node
/* ============================================================
   MAKE THE STUDIO VOICES. Run (your ElevenLabs API key in the terminal):
     ELEVENLABS_API_KEY=... node tools/voice-generate.mjs
   Optional: a list of voices, e.g.  node tools/voice-generate.mjs kevin tess

   Reads tools/voice-lines.json (node tools/voice-script.mjs), finds each
   voice in "My Voices" by name, and writes one mp3 per line to
   audio/voices/<voice>/<key>.mp3 with its index.json, then the list of
   voices the app offers (audio/voices/voices.json). Safe to stop and run
   again: a clip already on disk is skipped. Uses Eleven v4.
   ============================================================ */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) { console.error('Set ELEVENLABS_API_KEY first.'); process.exit(1); }
/* the app's voices, in the order they appear in Timer settings */
const VOICES = [
  { id: 'kevin', find: /^Coach Kevin/, label: 'Coach Kevin', kind: 'm', accent: 'American' },
  { id: 'tess', find: /^Tess/, label: 'Tess', kind: 'f', accent: 'British' },
  { id: 'dominic', find: /^Dominic/, label: 'Dominic', kind: 'm', accent: 'British' },
  { id: 'louise', find: /^Gee Louise/, label: 'Louise', kind: 'f', accent: 'British' },
];
const want = process.argv.slice(2);
const lines = JSON.parse(readFileSync(join(root, 'tools/voice-lines.json'), 'utf8'));
const api = (p, o = {}) => fetch('https://api.elevenlabs.io' + p, { ...o, headers: { 'xi-api-key': KEY, 'content-type': 'application/json', ...(o.headers || {}) } });

const sub = await (await api('/v1/user/subscription')).json();
console.log(`Plan ${sub.tier}: ${sub.character_count} of ${sub.character_limit} credits used.`);
const mine = (await (await api('/v2/voices?page_size=100')).json()).voices || [];

async function tts(vid, text) {
  for (let a = 0; a < 5; a++) {
    const r = await api(`/v1/text-to-speech/${vid}?output_format=mp3_44100_32`, { method: 'POST',
      body: JSON.stringify({ text, model_id: 'eleven_v4', voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true } }) }).catch(e => null);
    if (r?.ok) return Buffer.from(await r.arrayBuffer());
    const body = r ? (await r.text()).slice(0, 200) : 'network';
    if (r && [400, 401, 403, 422].includes(r.status)) throw new Error(`${r.status} ${body}`);
    await new Promise(x => setTimeout(x, 3000 * (a + 1)));
  }
  throw new Error('gave up after 5 tries');
}

for (const v of VOICES.filter(v => !want.length || want.includes(v.id))) {
  const found = mine.find(x => v.find.test(x.name));
  if (!found) { console.log(`✗ ${v.label}: not in My Voices, skipped`); continue; }
  const dir = join(root, 'audio/voices', v.id); mkdirSync(dir, { recursive: true });
  const queue = lines.filter(l => !existsSync(join(dir, l.key + '.mp3')));
  let done = lines.length - queue.length, fail = 0;
  console.log(`${v.label}: ${queue.length} clips to make`);
  const worker = async () => { while (queue.length) { const l = queue.shift();
    try { writeFileSync(join(dir, l.key + '.mp3'), await tts(found.voice_id, l.say)); done++; if (done % 50 === 0) console.log(`  ${v.label} ${done}/${lines.length}`); }
    catch (e) { fail++; console.log(`  ✗ ${l.key}: ${e.message}`); if (/quota|credit/i.test(e.message)) process.exit(2); } } };
  await Promise.all([worker(), worker(), worker()]);
  const pieces = Object.fromEntries(lines.filter(l => existsSync(join(dir, l.key + '.mp3'))).map(l => [l.key, l.text]));
  writeFileSync(join(dir, 'index.json'), JSON.stringify({ voice: v.label, pieces }, null, 0));
  console.log(`✓ ${v.label}: ${Object.keys(pieces).length} clips${fail ? `, ${fail} failed (run again to retry)` : ''}`);
}
/* what the app offers: every voice with a full set */
const ready = VOICES.filter(v => existsSync(join(root, 'audio/voices', v.id, 'index.json')))
  .map(({ id, label, kind, accent }) => ({ id, label, kind, accent }));
writeFileSync(join(root, 'audio/voices/voices.json'), JSON.stringify({ voices: ready }, null, 1) + '\n');
const after = await (await api('/v1/user/subscription')).json();
console.log(`Done. Credits used now: ${after.character_count} of ${after.character_limit}. Voices ready: ${ready.map(v => v.label).join(', ') || 'none'}.`);
