/* ============================================================
   ONE PROGRAM, ONE PLACE.

   Run:  node test/current-program.test.mjs

   The app used to hold two answers to "what am I training this week".
   dashboard.html read the program the coach released; every screen in
   js/ read a hardcoded Foundation Block. Same device, one tap apart,
   two different weeks — and finishing a workout dropped you on the
   wrong one, which is the exact moment a person looks at their program.

   js/core/current.js is now the single answer. This proves three things
   about it, and the third is the one that matters:

     1. with no released program it hands back the built-in pair, so
        somebody who has never been given a program still gets a screen;
     2. with one, program() and sessions() describe THAT program;
     3. resolveSession() — the function every screen actually calls —
        returns the released day, with the coach's set counts intact.

   The third is the whole point. It is not enough for the data to be
   loaded; the path the screens take has to reach it.
   ============================================================ */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { StorageAdapter, setAdapter } from '../js/core/storage.js';
import { loadCurrentProgram, program, sessions, isReleased } from '../js/core/current.js';
import { resolveSession } from '../js/core/resolve.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let failed = 0;
const t = (name, cond) => {
  console.log((cond ? '  ok    ' : '  FAIL  ') + name);
  if (!cond) failed++;
};
const group = name => console.log(`\n${name}`);

/* A storage adapter that holds exactly one thing: whatever program we
   hand it. Everything else stays unimplemented and throws, which is the
   contract's own promise — a half-built adapter fails loudly. */
class OneProgram extends StorageAdapter {
  constructor(prg) { super(); this.prg = prg; }
  async getProgram() { return this.prg; }
}

const fundamentals = JSON.parse(
  readFileSync(join(ROOT, 'spine', 'programs', 'fundamentals.json'), 'utf8'));

/* ---------------------------------------------------------- */
group('with no released program, the built-in one still answers');

setAdapter(new OneProgram(null));
await loadCurrentProgram('nobody');
t('isReleased() is false',            isReleased() === false);
t('program() still returns a week',   Array.isArray(program().week) && program().week.length > 0);
t('sessions() still resolves it',     !!sessions()[program().week[0].sessionId]);
t('and it is the built-in block',     program().id === 'main');

/* ---------------------------------------------------------- */
group('with a released program, every reader describes THAT one');

setAdapter(new OneProgram({
  id: 'prg_test', assignedTo: 'nicolas', name: fundamentals.name,
  profile: { source: 'console', raw: {
    from: fundamentals.id, version: fundamentals.version, name: fundamentals.name,
    duration: fundamentals.duration, fixed: fundamentals.fixed, days: fundamentals.days } },
}));
const ok = await loadCurrentProgram('nicolas');

t('loadCurrentProgram reports success', ok === true);
t('isReleased() is true',               isReleased() === true);
t('program().name is The Fundamentals', program().name === 'The Fundamentals');
t('4 days, not the built-in 5',         program().week.length === 4);
t('defaultDuration is 40',              program().defaultDuration === 40);
t('the week names the released days',
  program().week.map(d => d.sessionId).join(',') === 'd1,d2,d3,d4');
t('every day in the week has a session',
  program().week.every(d => !!sessions()[d.sessionId]));

/* ---------------------------------------------------------- */
group('resolveSession — the path the screens actually take');

const d4 = resolveSession('d4', { duration: fundamentals.duration });
t('resolves the released day',       d4.name === 'Squat & Carry');
t('keeps all five blocks',           d4.blocks.length === 5);

const find = name => d4.blocks
  .flatMap(b => b.items)
  .find(i => (i.name || '').toLowerCase().includes(name));

const bulg = find('bulgarian');
t('Bulgarian Split Squat is there',  !!bulg);
t('  it kept the coach\'s 3 sets',   bulg && bulg.sets === 3);
t('  8 reps',                        bulg && bulg.reps === 8);
t('  and it is per side',            bulg && (bulg.perSide === true || bulg.laterality === 'unilateral'));

const squat = find('back squat');
t('Back Squat kept 4 sets',          squat && squat.sets === 4);
t('  of 5',                          squat && squat.reps === 5);

const carry = find('suitcase');
t('Suitcase Carry is a 40s hold',    carry && carry.hold === 40);
t('  for 3 sets',                    carry && carry.sets === 3);

/* The bug that started all of this: a movement whose prescription the
   parser could not read fell back to one set. Nothing in a real program
   may do that any more. */
group('no day in the released program has a set count of nothing');
let thin = [];
for (const d of program().week) {
  const r = resolveSession(d.sessionId, { duration: fundamentals.duration });
  for (const b of r.blocks) for (const it of b.items) {
    if (it.reps == null && it.hold == null && it.value == null && !it.untargeted) {
      thin.push(`${d.sessionId}/${b.name}/${it.exId || it.ex}  "${it.pres || ''}"`);
    }
  }
}
for (const x of thin) console.log('        ' + x);
t('every movement has something to count', thin.length === 0);

/* ---------------------------------------------------------- */
console.log(failed ? `\n${failed} check(s) failed.\n` : '\nAll checks passed.\n');
process.exit(failed ? 1 : 0);
