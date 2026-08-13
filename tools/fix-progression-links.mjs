/* ============================================================
   FIX PROGRESSION LINKS

   Run:  node tools/fix-progression-links.mjs [--write]

   `easier` and `harder` are how the database says which movement comes
   before or after another. 181 of the 304 links pointed at an id that does
   not exist, because they were written with the underscores stripped —
   `kneepushup` for `knee_push_up`. Every one of those chains was silently
   dead: no regression to offer a beginner, no next step to offer anyone.

   The repair is mechanical and only applied where it is unambiguous: strip
   the underscores from every real id, and if exactly one matches, rewrite
   the link. Two ids collide when stripped (ring_push_up / ring_pushup and
   turkish_get_up / turkish_getup — duplicate entries that want merging by
   hand) so anything pointing at those is left alone.

   ALIASES is the short list of links written under an older name. Each one
   is a judgement, so each one is written down rather than guessed at
   run time. Anything not in there and not resolvable stays broken on
   purpose, and shows up in the classifier as a link to nowhere — a gap for
   Nicolas to fill, not something to paper over.
   ============================================================ */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const WRITE = process.argv.includes('--write');
const { EXERCISES } = await import(pathToFileURL(join(ROOT, 'js/data/exercises.js')).href);

const ALIASES = {
  hollowbodyhold:      'hollow_hold',
  hollowbodyrocks:     'hollow_rocks',
  tuckdragonflag:      'tuck_dragon_flag_hold',
  '90degreehspunegative': 'x90_degree_hspu_negative',
  kbdbswing:           'db_swing',
};

const ids = Object.keys(EXERCISES);
const real = new Set(ids);
const strip = s => s.replace(/_/g, '').toLowerCase();
const byStripped = {};
for (const i of ids) (byStripped[strip(i)] ||= []).push(i);

/* value -> replacement, or null when it cannot be resolved safely */
function resolve(v) {
  if (real.has(v)) return null;                       // already fine
  if (ALIASES[strip(v)]) return ALIASES[strip(v)];
  const c = byStripped[strip(v)];
  return c && c.length === 1 ? c[0] : null;
}

const plan = [];
for (const [id, m] of Object.entries(EXERCISES)) {
  for (const k of ['easier', 'harder']) {
    if (!m[k] || real.has(m[k])) continue;
    const to = resolve(m[k]);
    if (to) plan.push({ id, key: k, from: m[k], to });
    else    plan.push({ id, key: k, from: m[k], to: null });
  }
}
const fixable = plan.filter(p => p.to);
const stuck   = plan.filter(p => !p.to);

if (WRITE) {
  for (const f of ['js/data/exercises.js', 'js/data/exercises-gym.js']) {
    const p = join(ROOT, f);
    let src = readFileSync(p, 'utf8'), n = 0;
    for (const { key, from, to } of fixable) {
      /* Anchored on the field name and quotes so a movement whose cue text
         happens to contain the same word cannot be rewritten. */
      const re = new RegExp(`(${key}:\\s*)'${from}'`, 'g');
      const before = src;
      src = src.replace(re, `$1'${to}'`);
      if (src !== before) n++;
    }
    writeFileSync(p, src);
    console.log(`${f}: rewrote ${n} link targets`);
  }
}

console.log(`${plan.length} broken links — ${fixable.length} resolved, ${stuck.length} left`);
for (const s of stuck) console.log(`  no movement named "${s.from}"  (${s.id}.${s.key})`);
if (!WRITE) console.log('\nDry run. Re-run with --write to apply.');
