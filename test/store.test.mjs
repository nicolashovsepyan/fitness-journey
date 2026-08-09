/* ============================================================
   Phase 2b checks — the store over the adapter.

   Run:  node test/store.test.mjs

   The property this design exists to protect is the one at the top:
   overlapping writes must not lose each other. Everything else is
   making sure the behaviour did not shift while that was fixed.
   ============================================================ */
const mem = new Map();
globalThis.localStorage = {
  getItem: k => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => { mem.set(k, String(v)); },
  removeItem: k => { mem.delete(k); },
};

const { LocalAdapter } = await import('../js/adapters/local.js');
const { setAdapter } = await import('../js/core/storage.js');
const { store, loadStore, flushStore, storeLoaded, dayKey } = await import('../js/store.js');
const { createWriter } = await import('../js/core/persist.js');

let failed = 0;
const t = (n, c) => { console.log((c ? '  ok    ' : '  FAIL  ') + n); if (!c) failed++; };
const group = n => console.log(`\n${n}`);

setAdapter(new LocalAdapter());
const raw = () => JSON.parse(mem.get('fj.v1.nico') || '{}');

/* ---------------------------------------------------------- */
group('reading before the document is loaded fails loudly');
t('it throws rather than pretending the user is new', (() => {
  try { store.sessionCount(); return false; }
  catch (e) { return /loadStore/.test(e.message); }
})());
t('storeLoaded() says so', storeLoaded() === false);

/* ---------------------------------------------------------- */
group('it loads what is already on the device');
mem.set('fj.v1.nico', JSON.stringify({
  sessions: [{ date: '2026-07-01', name: 'Push Day', blocks: [] }],
  prs: { pushup: { value: 30, unit: 'reps', date: '2026-07-01' } },
  habits: { '2026-07-01': { walk: true } },
  startDate: '2026-06-01',
}));
await loadStore('nico');
t('existing training is there', store.sessionCount() === 1);
t('existing records are there', store.getPR('pushup')?.value === 30);
t('existing habits are there', store.getHabits('2026-07-01').walk === true);
t('start date is preserved', store.startDate() === '2026-06-01');
t('defaults fill in what the document lacks', Array.isArray(store.all.notes));

/* ---------------------------------------------------------- */
group('THE POINT: overlapping writes do not lose each other');
/* The exact shape that loses two of three writes under naive await:
   three taps in the same instant, no awaiting between them. */
store.toggleCheck('d1', 'pushup', 0, '2026-07-02');
store.toggleCheck('d1', 'pushup', 1, '2026-07-02');
store.toggleCheck('d1', 'pushup', 2, '2026-07-02');
await flushStore();
const checks = store.getChecks('d1', 'pushup', '2026-07-02');
t('all three ticks survive in memory', JSON.stringify(checks) === '[true,true,true]');
t('all three ticks survive on disk',
  JSON.stringify(raw().checks['2026-07-02|d1|pushup']) === '[true,true,true]');

/* Different fields, same instant — the interleave that silently drops one. */
store.toggleHabit('walk', '2026-07-03');
store.setNote('d1', 'pushup', 'Push-ups', 'felt strong', '2026-07-03');
store.toggleFlag('d1', 'squat', 'Squat', '', '2026-07-03');
store.setSetting('schedule', 'mwf');
await flushStore();
const d = raw();
t('habit, note, flag and setting all landed',
  d.habits['2026-07-03'].walk === true &&
  d.notes.some(n => n.text === 'felt strong') &&
  d.flags.some(f => f.exId === 'squat') &&
  d.settings.schedule === 'mwf');

/* ---------------------------------------------------------- */
group('writes are durable immediately on this backend');
store.setSetting('probe', 'x');
t('setItem happened before we awaited anything', raw().settings.probe === 'x');
await flushStore();

/* ---------------------------------------------------------- */
group('the parts that must not have shifted');
await loadStore('nico');
const before = store.sessionCount();
const res = store.saveSession({
  date: '2026-07-05', name: 'Push Day',
  blocks: [{ name: 'Work', entries: [
    { exId: 'pushup', name: 'Push-ups', measure: 'reps', unit: 'reps', load: 'bw',
      sets: [{ value: 42, side: null, weight: null }] }] }],
});
await flushStore();
t('the session is logged', store.sessionCount() === before + 1);
t('a beaten record is reported', res.prs.length === 1 && res.prs[0].exId === 'pushup');
t('and stored', store.getPR('pushup').value === 42);
t('last values are remembered for pre-fill', store.getLast('pushup')?.reps === 42);
t('history reads back', store.exerciseHistory('pushup')[0].best === 42);
t('it reached the device', raw().sessions.length === before + 1);

/* rounds-based work is not a per-exercise best */
store.saveSession({ date: '2026-07-06', name: 'Circuit', blocks: [{ name: 'AMRAP', entries: [
  { exId: 'pushup', name: 'Push-ups', measure: 'reps', unit: 'reps', load: 'bw', rounds: 5,
    sets: [{ value: 99, side: null, weight: null }] }] }] });
await flushStore();
t('a circuit round does not set a record', store.getPR('pushup').value === 42);

/* ---------------------------------------------------------- */
group('two users never share a document');
await loadStore('partner');
t("the partner's document is empty, not his", store.sessionCount() === 0);
store.toggleHabit('walk', '2026-07-01');
await flushStore();
t('written under their own key', !!mem.get('fj.v1.partner'));
t("his document is untouched", JSON.parse(mem.get('fj.v1.nico')).sessions.length > 0);
await loadStore('nico');
t('switching back finds his training', store.sessionCount() > 0);

/* ---------------------------------------------------------- */
group('reset clears the document without removing the key');
await loadStore('partner');
store.reset();
await flushStore();
t('emptied', store.sessionCount() === 0 && Object.keys(store.all.habits).length === 0);

/* ---------------------------------------------------------- */
group('the writer itself');
t('coalesces to the last value', await (async () => {
  const seen = [];
  const w = createWriter(async v => { await new Promise(r => setTimeout(r, 5)); seen.push(v); });
  w.put(1); w.put(2); w.put(3);
  await w.flush();
  return seen[seen.length - 1] === 3 && seen.length <= 2;   // 1 goes out, 2 is replaced by 3
})());
t('a failing save is reported, not swallowed', await (async () => {
  const w = createWriter(async () => { throw new Error('disk full'); });
  w.put('x'); await w.flush();
  return /disk full/.test(w.lastError()?.message || '');
})());
t('and the next save can still succeed', await (async () => {
  let n = 0;
  const w = createWriter(async () => { if (++n === 1) throw new Error('once'); });
  w.put('a'); await w.flush();
  w.put('b'); await w.flush();
  return w.lastError() === null;
})());

/* ---------------------------------------------------------- */
group('local dates, not UTC');
t('dayKey is local YYYY-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(dayKey(new Date('2026-07-05T21:30:00'))));
t('a 9pm workout does not land on tomorrow', dayKey(new Date('2026-07-05T21:30:00')) === '2026-07-05');

console.log(failed ? `\n${failed} FAILED\n` : '\nAll checks passed.\n');
process.exit(failed ? 1 : 0);
