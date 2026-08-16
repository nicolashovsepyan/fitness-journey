#!/usr/bin/env node
/* CLASS-COLLISION AUDIT
   Four bugs in one week came from a short class name in one component
   silently restyling another built weeks earlier:

     .ring  the fold outline   AND the program dial   (dial thrown into the header)
     .bar   the ember gauge    AND the photo bars     (pill radius, stray outline)
     .rx    the reactor        AND a sheet label      (labels forced to 88x88)
     .tb    a chat bubble      AND the tab bar        (every bubble centred)

   What they have in common is NOT that the class is used a lot — .card and
   .go are used everywhere and are perfectly fine. It is that the rules for
   one name are written in two DISTANT places in the stylesheet, which is
   what happens when two people (or one person, months apart) reach for the
   same short word for unrelated things.

   So: group every rule by the class it targets, and flag a class whose
   rules sit in two clusters far apart. That is the shape of the bug.        */
import { readFileSync } from 'node:fs';

const GAP = 250;          /* lines between clusters before it is suspicious */
const MAXLEN = 6;         /* only short names collide by accident           */

/* Modifiers. These are SUPPOSED to appear in every component's block —
   .fold.done, .hab.on, .wd.now — and flagging them buries the real thing. */
const MODIFIER = new Set(['done','now','open','full','on','free','plan','lead',
  'more','just','miss','part','next','out','off','live','has','sm','alt','tick']);

const files = process.argv.slice(2);
if (!files.length) { console.error('usage: audit-classes.mjs <file.html…>'); process.exit(2); }

let bad = 0;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const start = src.indexOf('<style>'), end = src.lastIndexOf('</style>');
  if (start < 0) continue;
  const before = src.slice(0, start).split('\n').length;
  const lines = src.slice(start, end).split('\n');

  const at = new Map();                       /* class -> [line numbers] */
  lines.forEach((ln, i) => {
    if (!/[{,]\s*$/.test(ln) && !ln.includes('{')) return;
    const sel = ln.split('{')[0];
    /* A BARE rule is one with no ancestor in front of it — .foo{…} or
       .foo.bar{…}. Those are the dangerous ones: they apply to every
       element with that class anywhere in the app. A scoped rule
       (.prog .ring) can only ever hit its own component. */
    for (const part of sel.split(',')) {
      const t = part.trim();
      if (!t.startsWith('.')) continue;
      const first = t.split(/[\s>+~]/)[0];
      const m = first.match(/^\.([a-z][\w-]*)/);
      if (!m) continue;
      const c = m[1];
      if (c.length > MAXLEN || MODIFIER.has(c)) continue;
      if (!at.has(c)) at.set(c, []);
      at.get(c).push(before + i);
    }
  });

  const hits = [];
  for (const [c, ls] of at) {
    if (ls.length < 2) continue;
    const clusters = [[ls[0]]];
    for (let i = 1; i < ls.length; i++) {
      if (ls[i] - ls[i-1] > GAP) clusters.push([ls[i]]);
      else clusters[clusters.length-1].push(ls[i]);
    }
    if (clusters.length > 1)
      hits.push({ c, where: clusters.map(g => `${g[0]}–${g[g.length-1]}`).join('  and  ') });
  }

  if (hits.length) {
    bad += hits.length;
    console.log(`\n  ${f}`);
    for (const h of hits.sort((a,b)=>a.c.localeCompare(b.c)))
      console.log(`    .${h.c.padEnd(7)} styled at lines ${h.where}`);
  }
}

if (bad) {
  console.error(`\n  ${bad} class name(s) styled from two distant places.`);
  console.error(`  Check each: shared component (fine) or two things wearing one name (bug).\n`);
  process.exit(1);
}
console.log('  no split-brain class names');
