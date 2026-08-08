/* ============================================================
   Phase 2a checks — LocalAdapter over today's localStorage keys.

   Run:  node test/local-adapter.test.mjs

   The thing under test is not "does it store something". It is:
   does it store it under EXACTLY the key, in EXACTLY the shape, that
   the app already uses — so that this phase moves no one's training.
   ============================================================ */
import { LocalAdapter } from '../js/adapters/local.js';
import { StorageAdapter } from '../js/core/storage.js';

/* Minimal localStorage. Node has none, and the point of these tests is
   to inspect the raw keys afterwards, which a real one would not let
   us do as clearly. */
const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: k => { store.delete(k); },
  clear: () => store.clear(),
};

let failed = 0;
const t = (name, cond) => { console.log((cond ? '  ok    ' : '  FAIL  ') + name); if (!cond) failed++; };
const group = n => console.log(`\n${n}`);
const reset = () => store.clear();

/* A blob in exactly the shape store.js writes today. */
const legacyBlob = () => JSON.stringify({
  goals: null,
  sessions: [{ date: '2026-07-01', name: 'Push Day', blocks: [{ name: 'Work', entries: [
    { exId: 'pushup', name: 'Push-ups', measure: 'reps', unit: 'reps', load: 'bw',
      sets: [{ value: 30, side: null, weight: null }] }] }] }],
  prs: { pushup: { value: 30, unit: 'reps', date: '2026-07-01' } },
  lastValues: { pushup: { reps: 30 } },
  swaps: { d1: { pushup: 'dip' } },
  habits: { '2026-07-01': { walk: true } },
  startDate: '2026-06-01',
});

/* ---------------------------------------------------------- */
group('it is a real StorageAdapter');
const a = new LocalAdapter();
t('extends StorageAdapter', a instanceof StorageAdapter);
/* Every call is awaited to settle before moving on. An unawaited
   async write lands in a later microtask and turns up in the next
   test's storage — which is exactly what this check did on its first
   run, and exactly the class of bug the rest of this file is for. */
t('every method returns a Promise', await (async () => {
  const ms = ['getUser','listUsers','saveUser','getActiveUserId','getIntake','listIntakes',
              'getProgram','getSession','listSessions','listLogs','getPRs','listMessages',
              'getRunState','getDevicePref','exportUser','init','getUserState'];
  const results = ms.map(m => { const r = a[m]('u1'); return { m, isPromise: r instanceof Promise, r }; });
  await Promise.allSettled(results.map(x => x.r));
  return results.every(x => x.isPromise);
})());

/* ---------------------------------------------------------- */
group('the keys are exactly the keys the app already uses');
reset();
await a.setActiveUserId('nico');
await a.setDisplayName('nico', 'Nicolas');
await a.saveUserState('nico', JSON.parse(legacyBlob()));
await a.saveRunState('nico', { bi: 0, done: false });
await a.setDevicePref('voiceName', 'Daniel');

t("active user is 'fj.user'",        store.has('fj.user'));
t("display name is 'fj.name.nico'",  store.has('fj.name.nico'));
t("training is 'fj.v1.nico'",        store.has('fj.v1.nico'));
t("live workout is 'fj.run.nico'",   store.has('fj.run.nico'));
t("voice is 'fj.voiceName'",         store.has('fj.voiceName'));
t('and nothing else was invented', (() => {
  const unexpected = [...store.keys()].filter(k =>
    !['fj.user','fj.name.nico','fj.v1.nico','fj.run.nico','fj.voiceName'].includes(k));
  if (unexpected.length) console.log('    unexpected:', unexpected.join(', '));
  return unexpected.length === 0;
})());

/* ---------------------------------------------------------- */
group('a blob written by the old store reads back unchanged');
reset();
store.set('fj.v1.nico', legacyBlob());

const state = await a.getUserState('nico');
t('reads the existing blob', !!state && Array.isArray(state.sessions));
t('round-trips byte for byte', (() => {
  return JSON.stringify(state) === JSON.stringify(JSON.parse(legacyBlob()));
})());
t('logs come out of it', (await a.listLogs('nico')).length === 1);
t('PRs come out of it', (await a.getPRs('nico')).pushup?.value === 30);
t('fields the contract has no method for survive a read', (() => {
  const s = state;
  return s.swaps?.d1?.pushup === 'dip' && s.habits?.['2026-07-01']?.walk === true && s.startDate === '2026-06-01';
})());

/* ---------------------------------------------------------- */
group('appending a log changes nothing else');
reset();
store.set('fj.v1.nico', legacyBlob());
const before = JSON.parse(store.get('fj.v1.nico'));
const entry = { date: '2026-07-08', name: 'Pull Day', userId: 'nico', blocks: [] };
await a.appendLog(entry);
const after = JSON.parse(store.get('fj.v1.nico'));

t('the log is appended', after.sessions.length === 2);
t('stored verbatim, not reshaped', JSON.stringify(after.sessions[1]) === JSON.stringify(entry));
t('the earlier log is untouched', JSON.stringify(after.sessions[0]) === JSON.stringify(before.sessions[0]));
t('PRs untouched', JSON.stringify(after.prs) === JSON.stringify(before.prs));
t('swaps, habits, startDate untouched',
  JSON.stringify(after.swaps) === JSON.stringify(before.swaps) &&
  JSON.stringify(after.habits) === JSON.stringify(before.habits) &&
  after.startDate === before.startDate);

/* ---------------------------------------------------------- */
group('the one-time legacy move');
reset();
store.set('fj.v1', legacyBlob());
store.set('fj.run', JSON.stringify({ bi: 2, done: false }));
await a.init();

t('legacy training is copied to the namespaced key', store.get('fj.v1.nico') === legacyBlob());
t('legacy workout is copied too', !!store.get('fj.run.nico'));
t('the legacy keys are LEFT IN PLACE as the safety copy', store.has('fj.v1') && store.has('fj.run'));
t('a marker is written', !!store.get('fj.migrated.v2'));

/* Running twice must not overwrite newer data with the old copy. */
await a.saveUserState('nico', { sessions: [{ date: '2026-08-01', name: 'Newer' }] });
await a.init();
t('running init again does not clobber newer training',
  (await a.getUserState('nico')).sessions[0].name === 'Newer');

reset();
store.set('fj.v1', legacyBlob());
store.set('fj.v1.nico', JSON.stringify({ sessions: [{ date: '2026-08-01', name: 'Existing' }] }));
await a.init();
t('a device that already has namespaced data is not overwritten',
  (await a.getUserState('nico')).sessions[0].name === 'Existing');

/* ---------------------------------------------------------- */
group('users are records');
reset();
await a.saveUser({ id: 'nico', role: 'client', status: 'active', displayName: 'Nicolas',
                   email: null, ui: 'pro', programId: 'main', trainerId: null, accent: '#c8ff4d',
                   createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });
t('saved and read back', (await a.getUser('nico'))?.ui === 'pro');
t('listUsers sees it', (await a.listUsers()).length === 1);
t('display name key is kept in step', store.get('fj.name.nico') === 'Nicolas');
t('updatedAt is refreshed on write', (await a.getUser('nico')).updatedAt !== '2026-01-01T00:00:00.000Z');
t('an unknown user is null, not a guess', (await a.getUser('nobody')) === null);
t('an unclaimed device answers null, not a default', (reset(), await a.getActiveUserId()) === null);

/* ---------------------------------------------------------- */
group('the live workout is device-local');
reset();
await a.saveRunState('nico', { bi: 1, ii: 2, done: false });
t('saved under its own key', !!store.get('fj.run.nico'));
t('read back', (await a.getRunState('nico')).ii === 2);
await a.clearRunState('nico');
t('cleared', (await a.getRunState('nico')) === null);
t('clearing it did not touch training', !store.has('fj.v1.nico'));

/* ---------------------------------------------------------- */
group('two users never share state');
reset();
await a.saveUserState('nico', { sessions: [{ date: '2026-07-01', name: 'His' }] });
await a.saveUserState('partner', { sessions: [{ date: '2026-07-02', name: 'Theirs' }] });
t('separate keys', store.has('fj.v1.nico') && store.has('fj.v1.partner'));
t("one cannot read the other's", (await a.getUserState('nico')).sessions[0].name === 'His');
t('and the reverse', (await a.getUserState('partner')).sessions[0].name === 'Theirs');

/* ---------------------------------------------------------- */
group('bad data does not take the app down');
reset();
store.set('fj.v1.nico', '{ this is not json');
t('a corrupt blob reads as null rather than throwing', (await a.getUserState('nico')) === null);
store.set('fj.run.nico', 'also not json');
t('a corrupt run state reads as null', (await a.getRunState('nico')) === null);

/* ---------------------------------------------------------- */
group('records for the phases not yet built');
reset();
await a.saveIntake({ id: 'itk_1', userId: 'u1', version: 6, answers: { name: 'X' }, derived: {},
                     submittedAt: '2026-08-01T00:00:00.000Z', createdAt: '2026-08-01T00:00:00.000Z',
                     updatedAt: '2026-08-01T00:00:00.000Z' });
t('an intake round-trips', (await a.getIntake('u1'))?.answers.name === 'X');
await a.savePrograms([{ id: 'prg_1', ownerId: null, assignedTo: 'u1', name: 'P', status: 'assigned',
                        days: [], profile: {}, createdAt: 'x', updatedAt: 'x' }]);
t('a program can be found by who it is assigned to', (await a.getProgram('u1'))?.id === 'prg_1');
await a.sendMessage({ id: 'msg_1', fromUserId: 'u1', toUserId: 'u2', body: 'hi',
                      contextType: null, contextId: null, readAt: null,
                      createdAt: '2026-08-01T00:00:00.000Z', updatedAt: 'x' });
t('a message is visible to both parties',
  (await a.listMessages('u1')).length === 1 && (await a.listMessages('u2')).length === 1);
t('and to nobody else', (await a.listMessages('u3')).length === 0);

/* ---------------------------------------------------------- */
console.log(failed ? `\n${failed} FAILED\n` : '\nAll checks passed.\n');
process.exit(failed ? 1 : 0);
