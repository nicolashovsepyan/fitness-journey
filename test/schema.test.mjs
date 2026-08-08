/* ============================================================
   Phase 1 checks — the schema and the storage contract.

   Run:  node test/schema.test.mjs
   Exits non-zero on failure, so it can gate a build later.

   No framework, no install, no build step — same rule as the rest of
   the repo. The point of committing this is that the checks outlive
   the session that wrote them.

   These are not tests of the app. They test that the shapes a server
   will eventually hold cannot be malformed, and that the storage
   contract fails loudly rather than quietly.
   ============================================================ */
import {
  makeUser, makeIntake, makeProgram, makeSession, makeLogEntry, makeMessage,
  validateUser, validateIntake, validateProgram, validateSession, validateLogEntry, validateMessage,
  unmappedDeckIds, DECK_TO_CANONICAL, newId, stamp,
} from '../js/core/schema.js';
import { StorageAdapter, setAdapter, storage } from '../js/core/storage.js';

let failed = 0;
const t = (name, cond) => {
  console.log((cond ? '  ok    ' : '  FAIL  ') + name);
  if (!cond) failed++;
};
const group = name => console.log(`\n${name}`);

/* ---------------------------------------------------------- */
group('records are well-formed');

const user = makeUser({ displayName: 'Test Person', ui: 'pro' });
t('User validates', validateUser(user).ok);
t('Intake validates', validateIntake(makeIntake({ userId: user.id })).ok);
t('Program validates', validateProgram(makeProgram({ name: 'P' })).ok);
t('Session validates', validateSession(makeSession({ name: 'S' })).ok);
t('LogEntry validates', validateLogEntry(makeLogEntry({ userId: user.id, date: '2026-08-07' })).ok);
t('Message validates', validateMessage(makeMessage({ fromUserId: 'a', toUserId: 'b', body: 'hi' })).ok);

/* ---------------------------------------------------------- */
group('records can live on a server');

t('survives a JSON round trip unchanged',
  JSON.stringify(JSON.parse(JSON.stringify(user))) === JSON.stringify(user));
t('createdAt and updatedAt both set on create', user.createdAt === user.updatedAt);
t('a later write moves updatedAt only', (() => {
  const later = stamp({ ...user, displayName: 'Renamed' });
  return later.createdAt === user.createdAt && later.updatedAt >= user.updatedAt;
})());
t('ids are unique across 500 draws', new Set(Array.from({ length: 500 }, () => newId('x'))).size === 500);

/* undefined survives structuredClone but vanishes through JSON, so a record
   carrying it means one thing here and another on the server. */
t('undefined field is rejected', !validateUser({ ...user, accent: undefined }).ok);
t('function on a record is rejected', !validateUser({ ...user, toJSON: () => 1 }).ok);

/* ---------------------------------------------------------- */
group('the rules the schema exists to enforce');

/* An active user with no program renders the full UI over an empty week —
   the exact "pretends to be a workout" state the pending teaser avoids. */
t('active user with no program is rejected',
  !validateUser({ ...user, status: 'active', programId: null }).ok);

/* Storing an instant here is how a 9pm workout lands on tomorrow's date. */
t('an ISO instant as LogEntry.date is rejected',
  !validateLogEntry(makeLogEntry({ userId: user.id, date: new Date().toISOString() })).ok);
t('a local YYYY-MM-DD is accepted',
  validateLogEntry(makeLogEntry({ userId: user.id, date: '2026-01-09' })).ok);

t('weekday outside 0–6 is rejected',
  !validateProgram(makeProgram({ name: 'P', days: [{ id: 'd1', sessionId: 's1', weekday: 9 }] })).ok);
t('assigned program with no assignee is rejected',
  !validateProgram(makeProgram({ name: 'P', status: 'assigned' })).ok);
t('session block item with no exId is rejected',
  !validateSession(makeSession({ name: 'S', blocks: [{ id: 'b1', items: [{ sets: 3 }] }] })).ok);

/* ---------------------------------------------------------- */
group('the storage contract fails loudly');

const adapter = new StorageAdapter();

t('storage() before setAdapter() explains itself', (() => {
  try { storage(); return false; } catch (e) { return /before setAdapter/.test(e.message); }
})());

setAdapter(adapter);
t('setAdapter installs the adapter', storage() === adapter);
t('setAdapter refuses a non-adapter', (() => {
  try { setAdapter({}); return false; } catch (e) { return true; }
})());

/* A half-built adapter must name the method it is missing rather than
   return undefined and let a screen render an empty week as truth. */
const methods = [
  'getUser', 'listUsers', 'saveUser', 'getActiveUserId', 'setActiveUserId',
  'getIntake', 'saveIntake', 'listIntakes',
  'getProgram', 'savePrograms',
  'getSession', 'listSessions', 'saveSessions',
  'appendLog', 'listLogs', 'getPRs', 'savePRs', 'getUserState', 'saveUserState',
  'listMessages', 'sendMessage',
  'getRunState', 'saveRunState', 'clearRunState',
  'getDevicePref', 'setDevicePref',
  'exportUser', 'importUser', 'init',
];
let named = 0;
for (const m of methods) {
  try { await adapter[m](); } catch (e) { if (e.message.includes(`${m}() is not implemented`)) named++; }
}
t(`all ${methods.length} contract methods reject by name`, named === methods.length);

/* Every method must be async. A method that is synchronous today because it
   happens to be local is a call site that breaks when a server arrives. */
let sync = [];
for (const m of methods) {
  const r = adapter[m]();
  if (!(r instanceof Promise)) sync.push(m);
  else r.catch(() => {});
}
t('every contract method returns a Promise', sync.length === 0 || (console.log('    sync:', sync.join(', ')), false));

/* ---------------------------------------------------------- */
group('the canonical id decision');

t('all 22 survey deck ids are accounted for', Object.keys(DECK_TO_CANONICAL).length === 22);
t('lunge and split collapse to one canonical id',
  DECK_TO_CANONICAL.lunge === DECK_TO_CANONICAL.split && DECK_TO_CANONICAL.lunge === 'bulgarian_split');
t('every mapped value is a snake_case app id',
  Object.values(DECK_TO_CANONICAL).filter(Boolean).every(v => /^[a-z][a-z0-9_]*$/.test(v)));

const unmapped = unmappedDeckIds();
console.log(`\n  ${unmapped.length} deck ids still need a canonical exercise:`);
console.log(`    ${unmapped.join(', ')}`);
console.log('  (2 are variant-vs-generic judgement calls; 7 need a library entry — docs/BACKEND.md)');

/* ---------------------------------------------------------- */
console.log(failed ? `\n${failed} FAILED\n` : '\nAll checks passed.\n');
process.exit(failed ? 1 : 0);
