#!/usr/bin/env node
/* ============================================================
   THE ODD ONE OUT IN A FAMILY.

   Run:  node tools/check-demands.mjs

   `demands` is how the console routes around an injury. A movement
   tagged wrist-extension is withheld from somebody who reported wrist
   pain, and one that is not is offered to them. So a missing tag is
   not untidy data, it is the safety rail with a gap in it.

   WHAT THIS FOUND, AND WHY THE CHECK LOOKS THE WAY IT DOES.

   "Shorties" is a bottom-half push-up. It sits in the push-up family
   with 20 siblings, every one of which demands wrist extension, and it
   demanded nothing. The rule that derives demands read the movement
   NAME, and Shorties is the one push-up whose name does not contain
   the word, so it fell through.

   Nobody would have noticed by reading the database. It surfaced when
   the program writer withheld every push-up from a client with wrist
   pain, correctly, and then handed them Shorties as the main push of
   the day.

   WHY NOT SIMPLY UNION THE FAMILY. Because real differences exist and
   matter: a pike push-up genuinely demands overhead range that a knee
   push-up does not, and a straight-bar push-up genuinely demands grip.
   Forcing every sibling to carry every sibling demand would withhold
   movements from people who could do them, which is its own harm.

   So this looks for the ODD ONE OUT: a demand almost every member of a
   family carries, missing from one or two. That is the shape of a rule
   that nearly matched, which is the shape of this bug.
   ============================================================ */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cat = JSON.parse(readFileSync(join(root, 'spine/catalog.json'), 'utf8')).movements;

const MIN_FAMILY = 3;      // below this, "almost every" means nothing
const SHARE = 0.8;         // carried by 80% of siblings counts as the family norm

const families = new Map();
for (const m of Object.values(cat)) {
  if (!m.family) continue;
  if (!families.has(m.family)) families.set(m.family, []);
  families.get(m.family).push(m);
}

const found = [];
for (const [fam, members] of families) {
  if (members.length < MIN_FAMILY) continue;
  const counts = new Map();
  for (const m of members) for (const d of m.demands || []) counts.set(d, (counts.get(d) || 0) + 1);
  for (const [demand, n] of counts) {
    if (n / members.length < SHARE) continue;      // not the family norm
    if (n === members.length) continue;            // everybody has it, nothing to say
    for (const m of members) {
      if (!(m.demands || []).includes(demand)) {
        found.push({ fam, id: m.id, name: m.name, demand, n, of: members.length });
      }
    }
  }
}

if (!found.length) {
  console.log(`  ${families.size} families checked: no movement is missing a demand its family carries.`);
  process.exit(0);
}

console.log(`\n  ${found.length} movement(s) missing a demand almost every sibling has:\n`);
for (const f of found) {
  console.log(`    ${f.id}  (${f.fam})`);
  console.log(`      lacks "${f.demand}", which ${f.n} of ${f.of} in that family carry`);
}
console.log(`
  Each of these is a question, not automatically a bug. A real
  difference belongs here; a rule that nearly matched does not.
  demands are derived in " EXERCISE DATABASE/tools/derive.mjs".
`);
process.exit(1);
