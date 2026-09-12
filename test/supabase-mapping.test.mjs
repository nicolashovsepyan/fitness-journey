/* ============================================================
   THE SUPABASE ADAPTER, AGAINST A FAKE DATABASE.

   Run:  node test/supabase-mapping.test.mjs

   No keys, no network, no project. This is the run that happens on
   every commit; test/supabase-adapter.test.mjs is the same suite
   against real Postgres on the days there is one.

   It answers one question and answers it completely: does every record
   the app holds survive a round trip through the column names, the
   filters and the upsert keys this adapter sends. That is where the
   bugs in this codebase have always been.

   It answers nothing about row level security. See the note at the top
   of test/fake-postgrest.mjs, and supabase/03-verify-rls.sql.
   ============================================================ */
import { LocalAdapter } from '../js/adapters/local.js';
import { SupabaseAdapter } from '../js/adapters/supabase.js';
import { Supabase, memorySessionStore } from '../js/adapters/supabase-rest.js';
import { installFakePostgrest } from './fake-postgrest.mjs';
import { runConformance } from './adapter-conformance.mjs';

const mem = new Map();
globalThis.localStorage = {
  getItem: k => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => { mem.set(k, String(v)); },
  removeItem: k => { mem.delete(k); },
  clear: () => mem.clear(),
};

const BASE = 'https://fake.supabase.co';
let fake = installFakePostgrest({ base: BASE });

/* Real uuids, because the real database will insist and a suite that
   passes on friendly names teaches the adapter a lie. */
const A = 'aaaaaaaa-1111-4111-8111-000000000001';
const B = 'bbbbbbbb-2222-4222-8222-000000000002';

let failed = 0;
const t = (name, cond) => { console.log((cond ? '  ok    ' : '  FAIL  ') + name); if (!cond) failed++; };
const group = n => console.log(`\n${n}`);

await runConformance(async () => {
  fake.restore();
  fake = installFakePostgrest({ base: BASE });
  mem.clear();
  const client = new Supabase({ url: BASE, anonKey: 'fake-anon', sessionStore: memorySessionStore() });
  return new SupabaseAdapter({ client, device: new LocalAdapter() });
}, { label: 'SupabaseAdapter (fake db)', t, group, ids: [A, B], identity: 'session' });

fake.restore();
console.log(failed ? `\n${failed} FAILED` : '\nAll checks passed.');
process.exit(failed ? 1 : 0);
