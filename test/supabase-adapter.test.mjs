/* ============================================================
   THE SAME EXAM, AGAINST A REAL DATABASE.

   Run:  FJ_SUPABASE_URL=https://xxxx.supabase.co \
         FJ_SUPABASE_SERVICE_KEY=eyJ... \
         FJ_SUPABASE_SCRATCH=yes-wipe-this-project \
         node test/supabase-adapter.test.mjs

   With those unset it prints how to run it and exits 0, so `npm test`
   on a laptop with no keys stays green and this file stays honest
   about having been skipped rather than quietly passing.

   WHAT THIS TESTS, AND WHAT IT DELIBERATELY DOES NOT.

   It tests the MAPPING: that every record the app holds survives a
   round trip through real columns with real types — that a jsonb
   document comes back nested, that a numeric comes back a number and
   not a string, that a date is a date, that nothing is silently
   dropped on the way down because there is no column for it.

   It does NOT test row level security, and it cannot, because it runs
   as the service role, which bypasses RLS by definition. That is the
   whole job of supabase/03-verify-rls.sql, which runs as a signed-in
   person and proves the locks hold. Two different questions. Running
   one and believing you have answered the other is how a public repo
   ends up publishing a key that opens everything.

   WHY IT NEEDS THE SERVICE KEY. The suite writes two people with ids
   it chose. An ordinary session may only write its own row, which is
   the policy working. So this runs above the policies on purpose, and
   the gate above is the test of the policies themselves.

   WHY IT REFUSES TO RUN WITHOUT FJ_SUPABASE_SCRATCH. It deletes rows.
   Point it at a project with real clients in it and it would take
   their training with it, so it will not start unless it is told, in
   words, that this project is disposable — and it checks first, and
   stops if it finds anybody it did not put there.
   ============================================================ */
import { LocalAdapter } from '../js/adapters/local.js';
import { SupabaseAdapter } from '../js/adapters/supabase.js';
import { Supabase, memorySessionStore } from '../js/adapters/supabase-rest.js';
import { runConformance } from './adapter-conformance.mjs';

const url = process.env.FJ_SUPABASE_URL;
const key = process.env.FJ_SUPABASE_SERVICE_KEY;
const ok  = process.env.FJ_SUPABASE_SCRATCH === 'yes-wipe-this-project';

if (!url || !key) {
  console.log(`
SKIPPED — no project to test against, and that is not a failure.

This is the one test that needs a live Supabase. To run it, make a
SCRATCH project (not the one with real clients in it), apply the files
in supabase/ in the order the README gives, then:

  FJ_SUPABASE_URL=https://xxxx.supabase.co \\
  FJ_SUPABASE_SERVICE_KEY=<the service_role key> \\
  FJ_SUPABASE_SCRATCH=yes-wipe-this-project \\
  node test/supabase-adapter.test.mjs

The service_role key bypasses row level security. It goes in this
command and nowhere else — never in js/config.js, never in a commit.
`);
  process.exit(0);
}
if (!ok) {
  console.error('REFUSING TO RUN. This test deletes rows. Set '
    + 'FJ_SUPABASE_SCRATCH=yes-wipe-this-project only for a disposable project.');
  process.exit(1);
}

/* Two ids the database will actually accept. A uuid column refuses a
   friendly name, which is exactly why the suite stopped hardcoding one. */
const A = 'aaaaaaaa-1111-4111-8111-000000000001';
const B = 'bbbbbbbb-2222-4222-8222-000000000002';

/* Node has no localStorage, and the adapter needs somewhere to keep the
   things that never sync. */
const mem = new Map();
globalThis.localStorage = {
  getItem: k => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => { mem.set(k, String(v)); },
  removeItem: k => { mem.delete(k); },
  clear: () => mem.clear(),
};

const client = new Supabase({ url, anonKey: key, sessionStore: memorySessionStore() });

/* The service role has no session, so every row it writes is written as
   nobody. That is the point — see the header. */

async function wipe() {
  // Order matters only for the rows whose foreign key is set null rather
  // than cascaded; the rest follow the person.
  await client.remove('programs', { or: `(owner_id.in.(${A},${B}),assigned_to.in.(${A},${B}))` });
  await client.remove('users', { id: `in.(${A},${B})` });
}

async function assertEmpty() {
  const rows = await client.select('users', { select: 'id' });
  const strangers = rows.filter(r => r.id !== A && r.id !== B);
  if (strangers.length) {
    console.error(`REFUSING TO RUN. This project has ${strangers.length} `
      + 'people in it that this test did not put there. It is not a scratch project.');
    process.exit(1);
  }
}

let failed = 0;
const t = (name, cond) => { console.log((cond ? '  ok    ' : '  FAIL  ') + name); if (!cond) failed++; };
const group = n => console.log(`\n${n}`);

await assertEmpty();

await runConformance(async () => {
  await wipe();
  mem.clear();
  return new SupabaseAdapter({ client, device: new LocalAdapter() });
}, { label: 'SupabaseAdapter', t, group, ids: [A, B], identity: 'session' });

await wipe();

console.log(failed ? `\n${failed} FAILED` : '\nAll checks passed.');
process.exit(failed ? 1 : 0);
