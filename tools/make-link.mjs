/* ============================================================
   MINT A HANDOFF LINK

   Run:  node tools/make-link.mjs <programId> <name> [baseUrl]
         node tools/make-link.mjs main Nicolas https://fitness-journey.netlify.app/

   One link provisions a phone from nothing: it carries who the person is,
   the program they are on, and which days are released. Opening it writes
   all three into that phone's storage and clears itself out of the URL.

   This is the same payload the Coach Console sends — the tool exists so a
   link can be made without opening the console, and so the two people who
   already had programs can be put back on them in one step.

   What it CANNOT know is a person's survey answers. Age, height, weight
   and injuries come from onboarding; a link minted here leaves them unset
   and the app falls back to its defaults until that person edits them in
   the Me tab. The program, the days and the units are exact.
   ============================================================ */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const p = (...x) => join(ROOT, ...x);

const [, , progId, personName, baseArg, whereArg] = process.argv;
if (!progId || !personName) {
  console.error('\n  usage: node tools/make-link.mjs <programId> <name> [baseUrl] [coach|client]\n');
  process.exit(1);
}
const base = (baseArg || 'https://nicolashovsepyan.github.io/fitness-journey/').replace(/\/?$/, '/');

/* WHICH DOOR THE LINK OPENS.

   The payload is identical either way — the same person, the same program,
   the same released days. Only the page it lands on differs, and it matters
   which:

     client   dashboard.html   provisions THAT PHONE as this person. The
                               link you send them.
     coach    coach.html       imports this person into the console. The
                               link YOU open, or paste into the add-a-client
                               box.

   This used to write the client form only, so the file sitting in the repo
   for the coach to drop into his console was a link that, if he clicked it,
   would have turned his own dashboard into Sevan's. Both forms paste into
   the console's box — readPastedIntake reads the fragment and ignores the
   page — but a link should do the right thing when it is clicked, too. */
const where = (whereArg || 'coach') === 'client' ? 'dashboard.html' : 'coach.html';
const key   = where === 'coach.html' ? '#fj=' : '#';

const prog = JSON.parse(readFileSync(p('spine/programs', progId + '.json'), 'utf8'));

/* the uid has to be stable, or the same person gets a new drawer every link */
const uid = personName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* Sunday-based days, which is what the dashboard counts in. A program that
   does not state its days leaves them to whatever the person already has. */
const days = prog.trainDays;

const a = {
  name: personName,
  unit: prog.units || 'lb',
  length: String(prog.duration || 30),
  goalsText: prog.goals || [],
  ...(days ? { trainDays: days, dayBase: 'sun', days: days.length } : {}),
  ...(prog.equipment ? { kitFull: prog.equipment } : {}),
  /* THE FIFTH SESSION. A sport the person already plays is training, and the
     week is a lie without it: Nicolas plays on Sundays, which is the whole
     reason Monday is upper body only. The dashboard needs BOTH halves to
     draw it - actDays says when, otherAct says what - and carrying one
     without the other shows nothing. Already Sunday-based, like trainDays. */
  ...(prog.sport && prog.sport.days ? { actDays: prog.sport.days } : {}),
  ...(prog.sport && prog.sport.acts ? { otherAct: prog.sport.acts } : {}),
  ...(prog.constraints && Object.keys(prog.constraints).length
        ? { constraintsText: Object.values(prog.constraints) } : {})
};

const payload = {
  v: 6,
  at: new Date().toISOString(),
  uid, userId: uid, name: personName,
  a,
  /* NAME AND DURATION TRAVEL WITH IT.
     They used to be left behind, and the dashboard has a card that names the
     program the person is on. With nothing to read, that card showed the one
     hard-coded into the page - so every client, on every program, was told
     they were on "Kettlebell Foundation, 20 minutes, one bell". The days were
     right and the title was somebody else's. */
  program: { from: prog.id, version: prog.version,
             name: prog.name, duration: prog.duration,
             /* Whether the app may scale this week to a shorter session.
                A coach who wrote 4 x 5 did not write 3 x 5, and without
                this flag the duration scaler is free to decide otherwise. */
             fixed: !!prog.fixed,
             days: prog.days },
  /* handed over means live — a person opening their link should not find
     every day locked behind a switch only the coach can see */
  released: Object.assign({ shape: true },
    ...Object.keys(prog.days).map(k => ({ [k]: true })))
};

const b64url = o => Buffer.from(JSON.stringify(o), 'utf8')
  .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const frag = key + b64url(payload);
const link = base + where + frag;

const out = p('spine/programs', `link.${uid}.txt`);
writeFileSync(out, link + '\n');

console.log(`\n  ${personName} -> ${prog.name}`);
console.log(`  uid          ${uid}`);
console.log(`  days         ${Object.keys(prog.days).length}${days ? '  on ' + days.join(',') + ' (0=Sun)' : ''}`);
console.log(`  units        ${a.unit}`);
console.log(`  opens        ${where}${where === 'coach.html' ? '  (imports into your console)' : '  (provisions their phone)'}`);
console.log(`  link length  ${link.length} characters`);
console.log(`  written to   spine/programs/link.${uid}.txt\n`);
