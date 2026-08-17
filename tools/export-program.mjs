#!/usr/bin/env node
/* Pull the hand-written SESSIONS out of dashboard.html and park them in the
   spine as the DEFAULT program.

   Why this exists: the sessions were typed into the client, which meant the
   coach console had nothing to open and no way to change a single exercise.
   A program has to be data before anyone can edit it. This is the one-time
   lift; from here the console owns it, and later the generator writes the
   same shape.                                                             */
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('dashboard.html', 'utf8');
const a = src.indexOf('const SESSIONS = {');
if (a < 0) { console.error('SESSIONS not found'); process.exit(1); }

/* walk the braces so a nested object never ends the slice early */
let i = src.indexOf('{', a), depth = 0, end = -1;
for (let j = i; j < src.length; j++) {
  const c = src[j];
  if (c === '{') depth++;
  else if (c === '}') { depth--; if (!depth) { end = j + 1; break; } }
}
const literal = src.slice(i, end);
const SESSIONS = (0, eval)('(' + literal + ')');

const cat = JSON.parse(readFileSync('spine/catalog.json', 'utf8')).movements;
const known = new Set(Object.keys(cat));
const byAlias = new Map();
for (const [id, m] of Object.entries(cat))
  for (const al of (m.aliases?.dashboard ? [m.aliases.dashboard].flat() : []))
    byAlias.set(al, id);

const missing = new Set();
const out = {};
for (const [day, s] of Object.entries(SESSIONS)) {
  out[day] = {
    name: s.name, tag: s.tag, why: s.why,
    blocks: (s.blocks || []).map(b => ({
      role: b.role, mins: b.mins,
      items: (b.items || []).map(([ex, pres, note]) => {
        const id = known.has(ex) ? ex : (byAlias.get(ex) || ex);
        if (!known.has(id)) missing.add(ex);
        return { ex: id, pres, note: note || '' };
      })
    }))
  };
}

writeFileSync('spine/program.default.json',
  JSON.stringify({ version: 1, built: new Date().toISOString().slice(0, 10),
                   note: 'Exported from dashboard.html. The console owns this now.',
                   days: out }, null, 2));

console.log(`  ${Object.keys(out).length} sessions -> spine/program.default.json`);
if (missing.size) {
  console.log(`\n  ${missing.size} movement id(s) are NOT in the catalog:`);
  for (const m of [...missing].sort()) console.log('    ' + m);
  console.log('\n  The editor will still show them, but the generator cannot use');
  console.log('  what it cannot look up. These belong in the database session.\n');
}
