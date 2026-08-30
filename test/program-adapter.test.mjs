/* ============================================================
   The prescription grammar, and the real programs through it.

   Run:  node test/program-adapter.test.mjs
   Exits non-zero on failure, so it can gate a build.

   WHY THIS EXISTS, AND WHY IT IS THE ONE TEST THAT MATTERS MOST.

   parsePrescription turns what a coach TYPES into what a timer can
   COUNT. It is the only place in the app where prose becomes a number
   of sets, and everything Work Mode does downstream is built on the
   answer. It had no test until 25 Aug 2026, and on that day an audit
   ran every prescription in every program through it:

       14 of 50 came back unreadable.

   An unreadable prescription is not dropped - it is carried through
   with `unparsed` set, which is the right call - but the fallback is
   `sets: 1` with no rep target. So "Bulgarian Split Squat 3 x 8 each
   side" ran as ONE set of nothing. Every unilateral movement in every
   program, every rep range in the beginner program, and every
   prescription carrying a tempo cue behaved the same way.

   Nothing was silent about it: app.js logged a warning. Nobody reads a
   console mid-workout.

   So there are two halves here. The first pins the grammar, form by
   form. The second is the one that would actually have caught it: it
   reads the REAL programs off disk and asserts that every prescription
   in them parses. A new program with a form nobody thought of fails
   this before it reaches a phone.
   ============================================================ */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { parsePrescription, adaptDay } from '../js/program-adapter.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let failed = 0;
const t = (name, cond) => {
  console.log((cond ? '  ok    ' : '  FAIL  ') + name);
  if (!cond) failed++;
};
const group = name => console.log(`\n${name}`);

/* A compact way to say "this text means exactly this". Compares only the
   keys named, so adding a field to the parser does not break every case. */
const reads = (pres, expect) => {
  const p = parsePrescription(pres);
  const got = {};
  for (const k of Object.keys(expect)) got[k] = p[k];
  const ok = JSON.stringify(got) === JSON.stringify(expect);
  t(`"${pres}" -> ${JSON.stringify(expect)}${ok ? '' : `   GOT ${JSON.stringify(got)}`}`, ok);
};

/* ---------------------------------------------------------- */
group('sets and reps');
reads('3 × 8',   { sets: 3, reps: 8 });
reads('3 x 8',   { sets: 3, reps: 8 });
reads('3*8',     { sets: 3, reps: 8 });
reads('4 × 5',   { sets: 4, reps: 5 });

group('holds');
reads('3 × 40s', { sets: 3, hold: 40 });
reads('30s',     { sets: 1, hold: 30 });
reads('45 sec',  { sets: 1, hold: 45 });

group('per side — the forms that were running as one set');
reads('3 × 8 each side',   { sets: 3, reps: 8,  perSide: true });
reads('3 × 10 each side',  { sets: 3, reps: 10, perSide: true });
reads('2 × 8 each side',   { sets: 2, reps: 8,  perSide: true });
reads('3 × 45s each side', { sets: 3, hold: 45, perSide: true });
reads('2 × 20s each side', { sets: 2, hold: 20, perSide: true });
reads('3 × 40s each side', { sets: 3, hold: 40, perSide: true });
reads('30s each side',     { sets: 1, hold: 30, perSide: true });
reads('8 each side',       { sets: 1, reps: 8,  perSide: true });
reads('10 each way',       { sets: 1, reps: 10, perSide: true });
reads('8 reps each side',  { sets: 1, reps: 8,  perSide: true });

group('ranges — the low end is the target, the top stays on screen');
reads('10-15 reps', { sets: 1, reps: 10, repsMax: 15 });
reads('3-5 reps',   { sets: 1, reps: 3,  repsMax: 5 });
reads('12-15 reps', { sets: 1, reps: 12, repsMax: 15 });

group('a cue after a separator is not part of the count');
reads('3 × 6 · tempo 3-1-1',   { sets: 3, reps: 6, cue: 'tempo 3-1-1' });
reads('8 reps · slow + pause', { sets: 1, reps: 8, cue: 'slow + pause' });
t('the cue keeps the WHOLE original text for display',
  parsePrescription('3 × 6 · tempo 3-1-1').raw === '3 × 6 · tempo 3-1-1');

group('deliberately no target is not a failure');
reads('—', { sets: 1, untargeted: true });
t('an em dash is not reported as unparsed', !parsePrescription('—').unparsed);

group('bare counts and cues');
reads('12 reps', { sets: 1, reps: 12 });
reads('8 slow',  { sets: 1, reps: 8 });
reads('20',      { sets: 1, reps: 20 });

group('one named side is not both sides');
/* "30s each side" is one set covering left and right. "30s left" is the
   left one, written as its own row so it gets its own timer. Reading the
   second as the first doubles the work and loses the side. */
reads('30s left',    { sets: 1, hold: 30, side: 'left' });
reads('30s right',   { sets: 1, hold: 30, side: 'right' });
reads('30s each side',{ sets: 1, hold: 30, perSide: true });
reads('12 left',     { sets: 1, reps: 12, side: 'left' });

group('what it still refuses to guess at');
t('empty is unparsed',      parsePrescription('').unparsed === true);
t('prose is unparsed',      parsePrescription('as many as you can').unparsed === true);
t('unparsed keeps its text', parsePrescription('as many as you can').raw === 'as many as you can');

/* ============================================================
   THE PROGRAMS THEMSELVES. This is the half that would have caught it.
   ============================================================ */
group('every prescription in every real program');

const dir = join(ROOT, 'spine', 'programs');
const files = readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'index.json');
t(`${files.length} program file(s) found`, files.length > 0);

let items = 0;
const unreadable = [];
for (const f of files) {
  const prog = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  for (const [dayId, day] of Object.entries(prog.days || {})) {
    const { plan, warnings } = adaptDay(dayId, day, {});
    for (const w of warnings) unreadable.push(`${prog.id}/${dayId}  "${w.pres}"`);
    for (const b of plan.blocks) {
      for (const it of b.items) {
        items++;
        /* The bug in one assertion: an item that carries a set count must
           have somewhere for the person to put a number. */
        if (!it.unparsed && it.reps == null && it.hold == null && !it.untargeted) {
          unreadable.push(`${prog.id}/${dayId}  "${it.pres}" parsed but has no target`);
        }
      }
    }
  }
}
t(`${items} movements read`, items > 0);
for (const u of unreadable) console.log('        ' + u);
t('every prescription in every program is readable', unreadable.length === 0);

/* ---------------------------------------------------------- */
console.log(failed ? `\n${failed} check(s) failed.\n` : '\nAll checks passed.\n');
process.exit(failed ? 1 : 0);
