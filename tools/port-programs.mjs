/* ============================================================
   PORT THE REAL PROGRAMS OUT OF THE OLD APP

   Run:  node tools/port-programs.mjs

   Two programs were written before the dashboard existed and live in
   the older modular app at the repo root:

     js/data/sessions.js           Nicolas's five vetted days  -> main
     js/data/sessions-beginner.js  the second user's three days -> beginner_return

   They are real coaching work and they are the only programs any person
   is actually on. This turns them into spine/programs/<id>.json in the
   shape the dashboard reads, so the Coach Console can assign either one
   to a person and the link carries it to their phone.

   Nothing here invents training. Every set, rep, hold and note comes
   from the source session; only the packaging changes.
   ============================================================ */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const p = (...x) => join(ROOT, ...x);

const spine = JSON.parse(readFileSync(p('spine/catalog.json'), 'utf8')).movements;
const { SESSIONS }        = await import(pathToFileURL(p('js/data/sessions.js')));
const { PROGRAM, BEGINNER_PROGRAM, BEGINNER_PROFILE, PROFILE } =
  await import(pathToFileURL(p('js/data/program.js')));

/* ---- prescription: one legacy item -> the string the app prints ----
   The dashboard's own scaler reads "<sets> × <rest>", so anything with a
   set count keeps that exact shape or it silently stops scaling. */
function presc(it, block) {
  /* `perSide: true` means DO BOTH SIDES in this set. `side: 'L'` means THIS
     ROW IS THE LEFT ONE — the coach wrote two rows on purpose, left then
     right, and each is thirty seconds.

     These were treated as the same thing, so a 30-second left-side plank
     and a 30-second right-side plank both came out as "30s each side":
     the work doubled, and which side you were on disappeared. Four rows
     across the two programs, and two of them are Sevan's. */
  const per  = it.perSide === true || it.side === true ? ' each side'
             : it.side === 'L' ? ' left' : it.side === 'R' ? ' right' : '';
  const reps = it.repsText || it.reps;
  let base;

  if (it.hold != null)            base = it.hold + 's';
  else if (it.minutes != null)    base = it.minutes + ' min';
  else if (it.sets && reps)       base = `${it.sets} × ${reps}`;
  else if (reps != null)          base = `${reps} reps`;
  else if (it.distance)           base = it.distance;
  else                            base = '—';

  /* A CIRCUIT OR SUPERSET STATES ITS ROUNDS ON THE BLOCK, so the item says
     only the work — which is exactly the console's Superset and Circuit
     spec, where the rounds box lives on the block and the row carries reps.
     The `!it.repsText` guard used to exclude ranges from this, so an item
     written as "10-15" kept the words "10-15 reps" while its sibling
     written as "10" became a bare number: two rows of one block speaking
     two different dialects, and neither of them stating the 3 rounds. */
  if (!it.sets && block.rounds && it.hold == null && reps != null)
    base = `${reps}`;

  if (it.toFailure) base += ' to failure';
  /* a numeric tempo is a code ("311" -> 3-1-1); anything else is already prose */
  if (it.tempo) base += /^\d+$/.test(String(it.tempo))
    ? ` · tempo ${String(it.tempo).split('').join('-')}`
    : ` · ${it.tempo}`;
  return base + per;
}

/* ---- note: what the coach said about this movement, if anything ---- */
function note(it) {
  const bits = [];
  if (it.name) bits.push(it.name);                 // a session-local rename
  if (it.zone) bits.push(it.zone);
  if (it.pair) bits.push('superset ' + it.pair);
  if (it.rest) bits.push(it.rest + 's rest');
  /* the beginner sessions carry a paragraph of coaching per movement. The
     row under a movement is one line — take the first sentence and let the
     movement sheet carry the rest, which is where a person looks for it. */
  if (it.cue)  bits.push(String(it.cue).split(/(?<=\.)\s+/)[0]);
  return bits.join(' · ') || null;
}

/* ---- minutes: the legacy blocks carry no clock, the dashboard prints one.
   Split the session's own duration by role weight, never below 2. ---- */
const WEIGHT = { Primer: 1, Prime: 1, Work: 3, Finisher: 1, Finish: 1, Move: 2, Hold: 1 };
function minutes(blocks, total) {
  const w = blocks.map(b => WEIGHT[b.role] ?? 2);
  const sum = w.reduce((a, c) => a + c, 0);
  const raw = w.map(x => Math.max(2, Math.round(total * x / sum)));
  /* make them add up to the stated duration, adjusting the biggest block */
  const drift = total - raw.reduce((a, c) => a + c, 0);
  if (drift) { const i = raw.indexOf(Math.max(...raw)); raw[i] = Math.max(2, raw[i] + drift); }
  return raw;
}

const ROLE = { Primer: 'Prime', Finisher: 'Finish' };

/* ---- THE BLOCK'S SHAPE, WHICH THIS USED TO THROW AWAY ----

   A block in the source says what kind of block it is (`format`), how
   many times through (`rounds`), how long you rest between (`rest`), and
   which movements are paired (`pair: 'A1'`). None of it survived the
   port. Every block arrived as Straight sets, the rounds and the rest
   went into a sentence in the note, and the pairing became the words
   "superset A1" printed under a movement.

   So Sevan's first work block — 3 rounds of a push-up and a pulldown,
   75 seconds between — reached the console as one set of each, with no
   bracket, and every check that reads sets read one. Nothing was
   invented and nothing was corrupted; four fields were simply not
   copied, and everything downstream believed what it was given.

   `skill`, `tempo` and `yates` have no console equivalent and become
   Straight — which is what they are, plus a coaching instruction that
   is already in the note. That is a lossy mapping and it is deliberate:
   inventing a block type nobody can edit would be worse. */
const FORMAT = { superset:'Superset', circuit:'Circuit', emom:'EMOM', amrap:'AMRAP',
                 tabata:'Tabata', straight:'Straight' };
const typeOf = b => FORMAT[b.format] || 'Straight';

/* Which of the console's cfg fields this block type actually owns —
   the same lists NB_SPEC keeps in coach.html, for the same reason. */
function cfgOf(b) {
  const t = typeOf(b), c = {};
  if (t === 'Superset' || t === 'Circuit') {
    if (b.rounds != null) c.rounds = b.rounds;
    if (b.roundRest != null || b.rest != null) c.rest = b.roundRest != null ? b.roundRest : b.rest;
  }
  if (t === 'EMOM')   { if (b.minutes != null) c.mins = b.minutes;
                        if (b.interval != null) c.interval = b.interval; }
  if (t === 'AMRAP')  { if (b.minutes != null || b.cap != null) c.cap = b.cap != null ? b.cap : b.minutes; }
  if (t === 'Tabata') { if (b.work != null) c.work = b.work;
                        if (b.off != null) c.off = b.off;
                        if (b.rounds != null) c.rounds = b.rounds; }
  return c;
}

/* `pair: 'A1'` and `pair: 'A2'` are one superset. The console groups by a
   shared `sg`, so the letter becomes the group and the number is just the
   order it was already in. Blocks with no pairs get no groups, which is
   how a plain block stays plain. */
function groupsOf(b) {
  const letters = new Map();
  return (b.items || []).map(it => {
    const m = /^([A-Z])\s*\d*$/.exec(String(it.pair || ''));
    if (!m) return null;
    if (!letters.has(m[1])) letters.set(m[1], letters.size + 1);
    return letters.get(m[1]);
  });
}

function convert(ses, mins) {
  const ms = minutes(ses.blocks, mins);
  return {
    name: ses.name,
    tag: ses.tags?.[0] ? ses.tags[0].replace(/-/g, ' ') : (ses.category || 'Session'),
    /* a block's note is not the session's reason — better blank than wrong */
    why: ses.why || ses.note || '',
    blocks: ses.blocks.map((b, i) => {
      const sg = groupsOf(b);
      return {
      role: ROLE[b.role] || b.role,
      name: b.name || null,
      note: b.note || (b.rounds ? `${b.rounds} rounds` : null),
      type: typeOf(b),
      cfg: cfgOf(b),
      mins: ms[i],
      /* the console's shape — {ex,pres,note} — because that is what the
         editor edits and what the link carries. The dashboard flattens it
         to an array on arrival; going the other way would not round-trip. */
      items: b.items.map((it, j) => {
        if (!spine[it.ex]) throw new Error(`${ses.id}: no such movement "${it.ex}"`);
        const row = { ex: it.ex, pres: presc(it, b), note: note(it) || '' };
        if (sg[j] != null) row.sg = sg[j];
        if (it.rest != null) row.rest = it.rest;
        return row;
      })
    };})
  };
}

/* ---- build one program file ---- */
function build(id, prog, profile, who) {
  const days = {};
  prog.week.forEach((w, i) => {
    const ses = SESSIONS[w.sessionId];
    if (!ses) throw new Error(`${id}: week day ${w.day} points at missing session ${w.sessionId}`);
    days['d' + (i + 1)] = convert(ses, prog.defaultDuration);
  });
  const out = {
    id, version: 1, name: prog.name, who,
    source: `ported from js/data/${id === 'main' ? 'sessions' : 'sessions-beginner'}.js — the program ${who} is actually on`,
    duration: prog.defaultDuration,
    fixed: !!prog.fixed,
    /* 0 = Sunday, the convention the dashboard counts in.
       A program that names a schedule keeps it. One that does not — the
       five-day block never did, because its user picked — gets consecutive
       weekdays from Monday, which is the only defensible guess and is
       editable in the Me tab. Leaving it null was worse: the app fell back
       to somebody else's four days and quietly dropped the fifth session. */
    trainDays: prog.schedules?.[prog.defaultSchedule]?.days
      ?? Array.from({ length: prog.week.length }, (_, i) => (i % 7) + 1).map(d => d % 7),
    units: profile.units,
    equipment: profile.equipment,
    constraints: profile.constraints || {},
    goals: (profile.goals || []).map(g => g.name),
    habits: prog.habits || [],
    days
  };
  writeFileSync(p('spine/programs', id + '.json'), JSON.stringify(out, null, 2) + '\n');
  const ids = new Set();
  Object.values(days).forEach(d => d.blocks.forEach(b => b.items.forEach(it => ids.add(it.ex))));
  console.log(`  ${id.padEnd(16)} ${Object.keys(days).length} days  ${ids.size} movements  (${prog.name})`);
  return ids;
}

console.log('\nPORTING PROGRAMS');
const used = new Set();
for (const id of [...build('main', PROGRAM, PROFILE, 'Nicolas')]) used.add(id);
/* Named, not described. He was "Training partner" while there was only
   one, and every re-port quietly renamed him back to it after the file
   had been corrected by hand — a label belongs in the tool that writes
   it, not in a patch applied afterwards. */
for (const id of [...build('beginner_return', BEGINNER_PROGRAM, BEGINNER_PROFILE, 'Sevan')]) used.add(id);

/* THE INDEX IS THE DIRECTORY, NOT WHAT THIS SCRIPT JUST PORTED.
   It used to hardcode the two ported ids, so any program written by hand
   into spine/programs/ disappeared from the manifest the next time this
   ran - present on disk, absent from the index, and no error either way.
   Scanned instead, so a hand-authored program survives a re-port. */
const onDisk = readdirSync(p('spine/programs'))
  .filter(f => f.endsWith('.json') && f !== 'index.json')
  .map(f => f.slice(0, -5)).sort();
onDisk.forEach(id => {
  if (id === 'main' || id === 'beginner_return') return;
  const prog = JSON.parse(readFileSync(p('spine/programs', id + '.json'), 'utf8'));
  Object.values(prog.days || {}).forEach(d =>
    (d.blocks || []).forEach(b => (b.items || []).forEach(it => used.add(it.ex))));
});

writeFileSync(p('spine/programs/index.json'),
  JSON.stringify({ built: new Date().toISOString().slice(0, 10),
                   programs: onDisk,
                   movements: [...used].sort() }, null, 2) + '\n');

console.log(`\n  ${used.size} distinct movements across both programs`);
console.log('  written to spine/programs/ — run build-app-data.mjs next so the app carries them.\n');
