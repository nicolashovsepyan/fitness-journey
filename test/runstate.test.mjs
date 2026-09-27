/* ============================================================
   WORK MODE'S CLOCK — a reopened app lands mid-countdown.

   Run:  node test/runstate.test.mjs

   Two promises the timer makes and used to half-keep:

   1. Reopen the app during a 60s rest and the rest carries on from
      where it was. It used to start again from 60, because every
      screen asked for a new step on its way up.
   2. Back-to-back intervals keep a fixed wall-clock schedule. Each one
      used to start when its screen drew, so an EMOM drifted and a
      locked phone came back 1 interval later instead of caught up.
   ============================================================ */
const mem = new Map();
globalThis.localStorage = {
  getItem: k => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => { mem.set(k, String(v)); },
  removeItem: k => { mem.delete(k); },
};
const { LocalAdapter } = await import('../js/adapters/local.js');
const { setAdapter } = await import('../js/core/storage.js');
const R = await import('../js/runner/runstate.js');

let failed = 0;
const t = (n, c, got) => { console.log((c ? '  ok    ' : '  FAIL  ') + n + (c ? '' : `   got ${JSON.stringify(got)}`)); if (!c) failed++; };
const group = n => console.log(`\n${n}`);

/* a clock we can move */
let now = 1_000_000;
Date.now = () => now;

setAdapter(new LocalAdapter());
await R.loadRunState('test');
const S = R.start({ name: 'T', blocks: [] });

group('asking again for the SAME step keeps its clock');
t('a new step reports itself as new', R.beginStep(S, 60, 'rest|0|1') === true);
now += 25_000;
t('the same key again is not new', R.beginStep(S, 60, 'rest|0|1') === false);
t('and 35s are left, not 60', R.stepRemaining(S) === 35, R.stepRemaining(S));

group('a different step starts fresh');
t('new key is new', R.beginStep(S, 20, 'iv|0|2') === true);
t('20s on the clock', R.stepRemaining(S) === 20, R.stepRemaining(S));

group('clearing a step forgets its key');
R.clearStep(S);
t('the old key starts over', R.beginStep(S, 20, 'iv|0|2') === true);

group('a chained step starts where the last one ended');
R.clearStep(S);
R.beginStep(S, 20, 'iv|a');
const end = R.stepEndsAt(S);
t('stepEndsAt is start + duration', end === now + 20_000, end);
now += 50_000;                                   // phone locked for 50s
R.clearStep(S);
R.beginStep(S, 20, 'iv|b', end);                 // next interval, chained
t('the chained step already ran out (caught up, not restarted)', R.stepRemaining(S) === 0, R.stepRemaining(S));
R.clearStep(S);
R.beginStep(S, 20, 'iv|c', end + 20_000);
t('the one after that has 10s left, on schedule', R.stepRemaining(S) === 10, R.stepRemaining(S));

group('pausing the ring moves the end with it');
R.clearStep(S);
R.beginStep(S, 30, 'hold|x');
R.pauseStep(S); now += 7_000; R.resumeStep(S);
t('7s of pause leaves all 30s on the clock', R.stepRemaining(S) === 30, R.stepRemaining(S));

group('the step survives a reload');
await R.flushRunState();
await R.loadRunState('test');
const back = R.load();
t('the key came back', back.stepKey === 'hold|x', back.stepKey);
t('so asking for it again keeps it', R.beginStep(back, 30, 'hold|x') === false);
t('the round buffer is part of the saved run', 'roundBuf' in back);

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
