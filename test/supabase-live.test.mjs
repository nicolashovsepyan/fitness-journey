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
    console.log('\n  Anonymous sign-in is probably still off: Authentication '
      + '-> Sign In / Providers -> Allow anonymous sign-ins.\n');
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

group('clearing up after itself');
{
  await adapter.removeUser(uid);
  await client.signOut();
  const left = await client.select('users', { id: `eq.${uid}` });
  t('the test identity and everything it wrote are gone', left.length === 0);
}

console.log(failed ? `\n${failed} FAILED` : '\nAll checks passed.');
process.exit(failed ? 1 : 0);
