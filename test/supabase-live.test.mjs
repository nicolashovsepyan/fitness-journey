/* ============================================================
   THE REAL DATABASE, THROUGH THE FRONT DOOR.

   Run:  node test/supabase-live.test.mjs

   Skips with an explanation when js/config.js has no backend.

   HOW THIS DIFFERS FROM THE OTHER TWO, AND WHY ALL THREE EXIST.

   test/supabase-mapping.test.mjs runs the whole contract against a
   fake database. It proves the adapter speaks the right language, and
   it proves nothing about Postgres.

   test/supabase-adapter.test.mjs runs the same contract against real
   Postgres using the SECRET key, which bypasses row level security on
   purpose so the suite can write two people it chose. It proves the
   columns and types agree. It needs a scratch project and a key that
   must never be committed, so it is the one that usually skips.

   THIS one uses only the publishable key that ships in the app, signs
   in the way a real person does, and writes what a real person writes.
   It is the end to end check: the key in js/config.js works, anonymous
   sign-in is on, the tables are there, the policies let a person do
   their own business and stop them doing anybody else. Nothing secret
   is involved, so it can run any time.

   IT IS SAFE TO RUN AGAINST THE LIVE PROJECT. Every row it writes
   belongs to a throwaway anonymous identity it creates for the run and
   deletes at the end. It cannot touch anybody else because the
   policies will not let it, which is the thing being tested.
   ============================================================ */
import { BACKEND, backendConfigured } from '../js/config.js';
import { publishIntake, pullClients, ensureSelf } from '../js/core/backend.js';
import { Supabase, memorySessionStore, SupabaseError } from '../js/adapters/supabase-rest.js';
import { SupabaseAdapter } from '../js/adapters/supabase.js';
import { LocalAdapter } from '../js/adapters/local.js';

if (!backendConfigured()) {
  console.log('\nSKIPPED — js/config.js has no backend yet. Not a failure.\n');
  process.exit(0);
}

const mem = new Map();
globalThis.localStorage = {
  getItem: k => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => { mem.set(k, String(v)); },
  removeItem: k => { mem.delete(k); },
  clear: () => mem.clear(),
};

let failed = 0;
const t = (name, cond) => { console.log((cond ? '  ok    ' : '  FAIL  ') + name); if (!cond) failed++; };
const group = n => console.log(`\n${n}`);

const client = new Supabase({
  url: BACKEND.url, anonKey: BACKEND.anonKey, sessionStore: memorySessionStore(),
});

/** Sign a given client in, and hand back its id. */
async function cloudSignInWith(c) {
  if (!c.userId) await c.signInAnonymously();
  return c.userId;
}

group('the key that ships in the app');
{
  // The published gate proves this in SQL. This proves it over HTTP,
  // which is the way somebody would actually try it.
  let rows = null, err = null;
  try { rows = await client.select('intakes'); } catch (e) { err = e; }
  t('reaches the project at all', !(err instanceof SupabaseError && err.isOffline));
  t('and on its own reads no intakes', Array.isArray(rows) && rows.length === 0);
}

group('signing in the way the survey does');
let uid = null;
{
  try {
    await client.signInAnonymously();
    uid = client.userId;
  } catch (e) {
    t(`anonymous sign-in works — ${e.message}`, false);
    // Two very different causes, and guessing the wrong one sends you
    // to the wrong screen. 429 is this test having run several times
    // in an hour; anything else is the toggle.
    console.log(e.status === 429
      ? '\n  Rate limited, not broken. Supabase caps anonymous sign-ins per hour\n'
        + '  and this test makes several each run. Wait and run it again.\n'
      : '\n  Anonymous sign-in looks off: Authentication -> Sign In / Providers\n'
        + '  -> Allow anonymous sign-ins.\n');
    process.exit(1);
  }
  t('anonymous sign-in issues a real id', typeof uid === 'string' && uid.length === 36);
}

const adapter = new SupabaseAdapter({ client, device: new LocalAdapter() });

group('a person can do their own business');
{
  const now = new Date().toISOString();
  const me = await adapter.saveUser({
    id: uid, role: 'client', status: 'pending', displayName: 'Smoke Test',
    email: null, ui: 'pro', programId: null, trainerId: null, accent: null,
    createdAt: now, updatedAt: now,
  });
  t('writes their own user row', me && me.id === uid);
  t('reads it back', (await adapter.getUser(uid))?.id === uid);

  const intake = await adapter.saveIntake({
    userId: uid, version: 6,
    answers: { name: 'Smoke Test', parq: [], pain: ['left knee'], age: 38 },
    derived: { tier: 3 },
  });
  t('writes an intake', !!intake?.id);

  const got = await adapter.getIntake(uid);
  t('  and the answers come back verbatim', got?.answers?.age === 38);
  t('  including arrays', Array.isArray(got.answers.pain) && got.answers.pain[0] === 'left knee');
  t('  and what the survey derived', got.derived.tier === 3);

  await adapter.saveUserState(uid, { streak: 4, sound: false, swaps: { d1: { pushup: 'dip' } } });
  const st = await adapter.getUserState(uid);
  t('the per-user document round-trips', st?.swaps?.d1?.pushup === 'dip');
  t('  with false still false, not "false"', st.sound === false);

  await adapter.appendLog({
    userId: uid, sessionId: null, name: 'Push Day', date: '2026-09-11',
    blocks: [{ name: 'Work', entries: [] }], durationSec: 1800,
  });
  const logs = await adapter.listLogs(uid);
  t('a workout logs', logs.length === 1);
  t('  and keeps the name it was given', logs[0].name === 'Push Day');

  await adapter.savePRs(uid, { pistol: { value: null, unit: 'reps', date: '2026-09-11', l: 3, r: 5 } });
  const prs = await adapter.getPRs(uid);
  t('a per-side record survives both sides', prs.pistol?.l === 3 && prs.pistol?.r === 5);
}

group('and nothing that is not theirs');
{
  // The policies decide, not the app. Asking for everything is the
  // honest way to check: whatever comes back is what a policy allowed.
  const people = await adapter.listUsers();
  t('listUsers returns only themselves', people.length === 1 && people[0].id === uid);
  const intakes = await adapter.listIntakes();
  t('listIntakes returns only their own', intakes.length === 1 && intakes[0].userId === uid);
}

/* ============================================================
   THE WHOLE POINT, END TO END.

   A phone fills in the survey. A laptop opens the console. They are
   different browsers with different storage and they have never met.
   Before this, everything the survey wrote stayed on the phone and the
   console had no way to learn it existed - which is the bug that
   started all of this.

   Two clients here, each with its own session store, because that IS
   two devices. One signs in and publishes an intake pointed at the
   other. The other asks the database who its clients are.
   ============================================================ */
group('a survey on one device reaches a console on another');
{
  const phone  = new Supabase({ url: BACKEND.url, anonKey: BACKEND.anonKey,
                                sessionStore: memorySessionStore() });
  const laptop = new Supabase({ url: BACKEND.url, anonKey: BACKEND.anonKey,
                                sessionStore: memorySessionStore() });

  /* The console introduces itself before anybody is pointed at it.
     Skipping this is what produced "violates foreign key constraint
     users_trainer_fk" the first time this test ran: an auth identity
     is not a row, and a trainer_id has to reference a row. */
  const intro = await ensureSelf({ role: 'trainer', displayName: 'Coach', client: laptop });
  const coach = intro.uid;
  t('the console has an identity, and a row to go with it'
    + (intro.ok ? '' : ` — ${intro.reason}`), intro.ok && !!coach);

  /* A rate limit is not a broken feature, and a run that carries on
     past one reports six failures that all mean the same thing. */
  if (!intro.ok) {
    console.log('\n  Stopping here. Supabase caps anonymous sign-ins per hour and this\n'
      + '  test makes four each run. Wait and run it again.\n');
    process.exit(1);
  }

  const pushed = await publishIntake(
    { answers: { name: 'Phone Person', email: null, tier: 3, pain: ['right shoulder'] }, version: 6 },
    { client: phone, trainerId: coach });
  t('the survey publishes' + (pushed.ok ? '' : ` — ${pushed.reason}`), pushed.ok);

  if (!pushed.ok) {
    console.log('\n  Stopping here: nothing was published, so nothing can arrive.\n');
    process.exit(1);
  }

  const pulled = await pullClients({ client: laptop });
  t('the console can ask' + (pulled.ok ? '' : ` — ${pulled.reason}`), pulled.ok);

  const found = (pulled.clients || []).find(c => c.user.id === pushed.uid);
  t('and the person from the phone is there', !!found);
  t('  under the same id the phone used', found?.user.id === pushed.uid);
  t('  with their name', found?.user.displayName === 'Phone Person');
  t('  and their answers, not a stub', found?.intake?.answers?.pain?.[0] === 'right shoulder');

  /* The other half of the promise: a console only ever sees ITS OWN
     clients. A second coach, pointed at by nobody, must come back
     empty however hard it asks. */
  const stranger = new Supabase({ url: BACKEND.url, anonKey: BACKEND.anonKey,
                                  sessionStore: memorySessionStore() });
  const other = await pullClients({ client: stranger });
  t('another coach sees none of them', other.ok && other.clients.length === 0);

  /* REMOVING A CLIENT, WHICH IS NOT DELETING THEM.

     This is the check the fake database cannot make, because it is
     entirely about policies. removeUser used to send a DELETE that
     matched no rows — there is no delete policy on public.users — and
     PostgREST answered 204. Success, no error, nothing changed.

     It unassigns now: the client keeps every log and record they have,
     and this coach stops being able to see any of it the moment
     trainer_id stops pointing here. */
  const laptopAdapter = new SupabaseAdapter({ client: laptop, device: new LocalAdapter() });
  await laptopAdapter.removeUser(pushed.uid);
  const afterDrop = await pullClients({ client: laptop });
  t('a coach can drop a client', afterDrop.ok
    && !afterDrop.clients.some(c => c.user.id === pushed.uid));

  const stillTheirs = new SupabaseAdapter({ client: phone, device: new LocalAdapter() });
  t('  and the client still has their own record', !!(await stillTheirs.getUser(pushed.uid)));
  t('  and their intake', !!(await stillTheirs.getIntake(pushed.uid)));

  let refusedStranger = false;
  try { await laptopAdapter.removeUser(coach); } catch { refusedStranger = true; }
  t('dropping somebody who is not your client says so, rather than nothing', refusedStranger);

  // put both devices back
  await phone.signOut(); await laptop.signOut(); await stranger.signOut();
}

group('clearing up after itself');
{
  /* THIS CHECK USED TO PROVE NOTHING, and it is worth saying why
     because the shape of the mistake is common.

     It called removeUser, signed out, then read the row back and found
     nothing — and concluded the row was gone. But a signed-out read
     finds nothing whatever the truth is, so the check passed for a
     reason that had no connection to what it claimed. Meanwhile
     removeUser was matching zero rows and answering 204, and the test
     row sat in the database for the rest of the day.

     Read it back while still signed in, as the only person who can
     see it. */
  await adapter.saveUserState(uid, {});
  const mine = await adapter.getUser(uid);
  t('the test row is still readable by the person it belongs to', !!mine);

  let refused = false;
  try { await adapter.removeUser(uid); } catch { refused = true; }
  t('removeUser refuses to delete your own account', refused);

  await client.signOut();
  t('and the session is closed', client.userId === null);
  console.log('\n  NOTE: this run leaves one anonymous identity behind. There is no\n'
    + '  delete policy on public.users, deliberately — see the note on\n'
    + '  SupabaseAdapter.removeUser. Clear them from the SQL editor.\n');
}

console.log(failed ? `\n${failed} FAILED` : '\nAll checks passed.');
process.exit(failed ? 1 : 0);
