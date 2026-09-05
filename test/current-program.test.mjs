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
import { readFileSync, readdirSync } from 'node:fs';
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

/* ---------------------------------------------------------- */
/* WHAT THE COACH WROTE PER SET.

   "4 x 5" says four identical sets, and a top set with back-offs is not
   that. A plan travels as one; these prove the three things that have to
   be true of it, and the third is the one that would rot quietly:

     the per-set targets arrive in order;
     `sets` agrees with the plan's length;
     `weight` and `tempo` survive, because the runner reads both and
     neither existed on this path until now. */
group('a set-by-set plan reaches the screens');

setAdapter(new OneProgram({
  id: 'prg_plan', assignedTo: 'nicolas', name: 'Plan test',
  profile: { source: 'console', raw: { name: 'Plan test', duration: 40, days: { d1: {
    name: 'Heavy', blocks: [{ role: 'Work', name: 'A', type: 'Straight', cfg: {}, items: [
      { ex: 'deadlift', pres: '4 × 3', tempo: '3-1-1', weight: 200,
        plan: [{ v: 3, w: 275 }, { v: 5, w: 225 }, { v: 5, w: 225 }, { v: 5, w: 225 }] },
      { ex: 'kb_swing', pres: '3 × 12' },
    ] }] } } } },
}));
await loadCurrentProgram('nicolas');
const heavy = resolveSession('d1', { duration: 40 });
const dl = heavy.blocks[0].items[0], sw = heavy.blocks[0].items[1];

t('the plan arrives',                Array.isArray(dl.plan) && dl.plan.length === 4);
t('  top set is 3 reps',             dl.plan[0].reps === 3);
t('  at 275',                        dl.plan[0].weight === 275);
t('  the back-offs are 5 at 225',    dl.plan[3].reps === 5 && dl.plan[3].weight === 225);
t('sets agrees with the plan',       dl.sets === 4);
t('the starting weight survives',    dl.weight === 200);
t('the tempo survives',              dl.tempo === '3-1-1');
t('a movement with no plan has none', !sw.plan);
t('  and still has its sets',        sw.sets === 3);

/* put the fixture back for the checks below */
setAdapter(new OneProgram({
  id: 'prg_test', assignedTo: 'nicolas', name: fundamentals.name,
  profile: { source: 'console', raw: {
    from: fundamentals.id, version: fundamentals.version, name: fundamentals.name,
    duration: fundamentals.duration, fixed: fundamentals.fixed, days: fundamentals.days } },
}));
await loadCurrentProgram('nicolas');

/* ---------------------------------------------------------- */
/* A PRESCRIPTION IN SECONDS MAKES IT A TIMED MOVEMENT.

   resolve.js spreads the session item over the library record precisely
   so a session can override the library's measure — its own comment names
   the case, "Dead Bug held for 30s instead of counted in reps". Nothing
   ever sent the override, so `hold: 30` landed on a movement the library
   measures in reps, the runner asked `measure === 'hold'`, got false, took
   the reps branch and found no rep count.

   It showed a target of ZERO. Eight movements across four programs, three
   of them in a client's live day 3, and it never threw once.

   This walks every program on the shelf and checks the two things that
   have to hold: a movement prescribed in seconds resolves as timed, and
   nothing resolves with a target of nothing. */
group('seconds and reps, in every program on the shelf');
{
  const dir = join(ROOT, 'spine', 'programs');
  const files = readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'index.json');
  const wrong = [], zero = [];
  for (const f of files) {
    const prog = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    setAdapter(new OneProgram({ id: 'p', assignedTo: 'x', name: prog.name,
      profile: { source: 'console', raw: { from: prog.id, name: prog.name,
        duration: prog.duration, fixed: prog.fixed, days: prog.days } } }));
    await loadCurrentProgram('x');
    for (const d of program().week) {
      const r = resolveSession(d.sessionId, { duration: prog.duration });
      for (const b of r.blocks) for (const it of b.items) {
        const secs = /^(\d+\s*[×x]\s*)?\d+\s*s(\b|ec)/.test(String(it.pres || ''));
        if (secs && it.measure !== 'hold')
          wrong.push(`${prog.name}/${it.exId} "${it.pres}" -> ${it.measure}`);
        /* A timed block sets its own clock, and an em-dash inside one is
           a deliberate "as many as you get". Everything else must carry a
           number somebody chose. */
        const timed = ['tabata', 'amrap', 'emom'].includes(b.format);
        const target = it.measure === 'hold' ? it.hold : (it.reps ?? it.target);
        if (!it.untargeted && !timed && !target)
          zero.push(`${prog.name}/${it.exId} "${it.pres}" -> ${it.measure} with no target`);
      }
    }
  }
  for (const x of wrong.slice(0, 8)) console.log('        ' + x);
  t('seconds always resolve as a timed movement', wrong.length === 0);
  for (const x of zero.slice(0, 8)) console.log('        ' + x);
  t('nothing resolves with a target of nothing', zero.length === 0);
}

/* put the fixture back */
setAdapter(new OneProgram({
  id: 'prg_test', assignedTo: 'nicolas', name: fundamentals.name,
  profile: { source: 'console', raw: {
    from: fundamentals.id, version: fundamentals.version, name: fundamentals.name,
    duration: fundamentals.duration, fixed: fundamentals.fixed, days: fundamentals.days } },
}));
await loadCurrentProgram('nicolas');

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
