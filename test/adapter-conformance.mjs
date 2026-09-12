/* ============================================================
   THE CONTRACT, AS A TEST ANY ADAPTER MUST PASS.

   Not run directly — a harness. test/local-adapter.test.mjs runs it
   against the localStorage adapter, and test/supabase-adapter.test.mjs
   will run this same file against the server one the day there are keys.

   WHY THIS IS THE FOUNDATION AND NOT A NICE-TO-HAVE.

   A storage contract is a promise that the app can swap what is
   underneath it without changing a single call site. That promise is
   worth exactly as much as the thing that checks it — and nothing was
   checking it. Writing this found three breaks in an afternoon:

     getDisplayName / setDisplayName were called by js/users.js on every
     boot, implemented in the local adapter, and NOT IN THE CONTRACT. A
     second adapter would have been missing two methods nobody knew were
     required.

     removeUser did not exist at all, so the first caller that needed it
     reached around the adapter and deleted localStorage keys by hand —
     which works on the one adapter that happens to be localStorage and
     does nothing on a server.

     saveUsers was called with `?.` against an adapter that has never had
     it, so "forget everyone" silently did nothing through the contract
     and worked only by its raw-key fallback.

   Every one of those is invisible until the second adapter exists, and
   by then it is a debugging session instead of a red line.

   WHAT IT REFUSES TO ASSUME. Only the contract. No key names, no
   localStorage, no ordering that the contract does not promise — those
   belong in the adapter's own test. If a check here needs to know how a
   thing is stored, the check is wrong.

   AND NOT WHAT A USER ID LOOKS LIKE. It used to say "nick" and "sevan"
   in twenty places, which reads well and quietly asserted that an id is
   whatever string you like. Postgres disagrees: a uuid column refuses
   the word nick outright. So the ids come in through `ids` and every check
   below refers to them by position. An adapter that only accepts uuids
   passes the same suite as one that accepts anything, and the suite
   goes on testing behaviour instead of spelling.
   ============================================================ */

import { StorageAdapter } from '../js/core/storage.js';

export async function runConformance(makeAdapter, {
  label = 'adapter', t, group,
  /* Two people. Any two ids this adapter will accept. */
  ids = ['nick', 'sevan'],
  /* 'device' — identity is a key this adapter owns and can be set.
     'session' — identity comes from a signed-in session and setting it
     is an assertion the adapter is entitled to refuse. */
  identity = 'device',
} = {}) {
  const [A, B] = ids;
  /* Every section gets a clean adapter: a suite that depends on the
     order its own sections run in is a suite that passes for the wrong
     reason. */
  const fresh = async () => { const a = await makeAdapter(); await a.init(); return a; };

  const U = (id, over = {}) => ({
    id, role: 'client', status: 'active', displayName: id, email: null,
    ui: 'pro', programId: null, trainerId: null, accent: '#3ECBA8',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...over,
  });

  /* ---------------------------------------------------------- */
  /* THE WHOLE CONTRACT, NOT MOST OF IT.

     Every check below this exercises a method, so a missing one would
     eventually surface as a throw somewhere. Eventually is the problem:
     it surfaces on the screen that calls it, in front of somebody, and
     it names one method when three are gone. Counting them first says
     so in one line, before a single request is made. */
  group(`${label} · implements the contract`);
  {
    const want = Object.getOwnPropertyNames(StorageAdapter.prototype)
      .filter(n => n !== 'constructor');
    const a = await makeAdapter();
    const missing = want.filter(n => typeof a[n] !== 'function'
      || a[n] === StorageAdapter.prototype[n]);
    t(`all ${want.length} contract methods are implemented`
      + (missing.length ? ` — missing ${missing.join(', ')}` : ''), missing.length === 0);
  }

  /* ---------------------------------------------------------- */
  group(`${label} · people`);
  {
    const a = await fresh();
    t('a new adapter knows nobody', (await a.listUsers()).length === 0);
    t('getUser on a stranger is null, not a throw', (await a.getUser('nobody')) === null);

    const saved = await a.saveUser(U(A));
    t('saveUser returns the record', saved && saved.id === A);
    t('  and stamps updatedAt', !!saved.updatedAt);
    t('listUsers finds them', (await a.listUsers()).some(u => u.id === A));
    t('getUser finds them', (await a.getUser(A)).id === A);

    await a.saveUser(U(A, { status: 'pending' }));
    t('saving twice updates rather than duplicates',
      (await a.listUsers()).filter(u => u.id === A).length === 1);
    t('  and the change took', (await a.getUser(A)).status === 'pending');

    await a.saveUser(U(B));
    await a.removeUser(A);
    t('removeUser drops that one', !(await a.getUser(A)));
    t('  and leaves the others alone', !!(await a.getUser(B)));
  }

  /* ---------------------------------------------------------- */
  /* WHO THE ADAPTER THINKS YOU ARE, AND THE TWO HONEST ANSWERS.

     A device-held adapter answers from a key: this phone belongs to
     whoever last claimed it, and claiming is a write. A session-held
     one answers from the signed-in session: you cannot become somebody
     by writing a row, and asking to would be the bug.

     These are not the same promise and pretending they are is how the
     seam between them rots. Both are tested, each against its own.
     What they share is the line that matters more than either: an
     adapter that does not know who you are says so, and never guesses. */
  group(`${label} · who this adapter thinks you are`);
  {
    const a = await fresh();
    t('not knowing is answered null, never a guess', (await a.getActiveUserId()) === null);

    if (identity === 'device') {
      await a.saveUser(U(A));
      await a.setActiveUserId(A);
      t('claiming sticks', (await a.getActiveUserId()) === A);
      await a.setActiveUserId(null);
      t('and can be released', (await a.getActiveUserId()) === null);

      /* The claim is a property of the DEVICE. Removing the person it
         points at must not leave it pointing at a ghost. */
      await a.setActiveUserId(A);
      await a.removeUser(A);
      t('removing the claimed user releases the claim', (await a.getActiveUserId()) === null);
    } else {
      await a.saveUser(U(A));
      let threw = false;
      try { await a.setActiveUserId(A); } catch { threw = true; }
      t('claiming a session that is not yours is refused, not obeyed', threw);
      t('  and the refusal did not quietly claim it anyway',
        (await a.getActiveUserId()) === null);
    }
  }

  /* ---------------------------------------------------------- */
  group(`${label} · display names are the device's`);
  {
    const a = await fresh();
    await a.saveUser(U(A, { displayName: 'Client One' }));
    t('no override to begin with, or the record name',
      [null, 'Client One'].includes(await a.getDisplayName(A)));
    await a.setDisplayName(A, 'Nick');
    t('setDisplayName reads back', (await a.getDisplayName(A)) === 'Nick');
    t('  and does not rewrite the record',
      (await a.getUser(A)).displayName === 'Client One');
  }

  /* ---------------------------------------------------------- */
  group(`${label} · intake`);
  {
    const a = await fresh();
    await a.saveUser(U(A));
    t('no intake yet is null', (await a.getIntake(A)) === null);

    await a.saveIntake({ id: 'i1', userId: A, version: 6,
      answers: { name: 'Nick', age: 38, pain: ['knee'] }, derived: { tier: 3 },
      submittedAt: '2026-09-01T10:00:00.000Z' });
    const got = await a.getIntake(A);
    t('it comes back', !!got);
    t('  verbatim — the answers are the record', got.answers.age === 38);
    t('  including arrays', Array.isArray(got.answers.pain) && got.answers.pain[0] === 'knee');
    t('  and what was derived beside them', got.derived.tier === 3);

    await a.saveIntake({ id: 'i2', userId: A, version: 6,
      answers: { name: 'Nick', age: 39 }, derived: {},
      submittedAt: '2026-09-08T10:00:00.000Z' });
    t('a second intake wins — most recent, not first',
      (await a.getIntake(A)).answers.age === 39);
  }

  /* ---------------------------------------------------------- */
  group(`${label} · programs`);
  {
    const a = await fresh();
    await a.saveUser(U(A));
    t('no program yet is null', (await a.getProgram(A)) === null);
    await a.savePrograms([{ id: 'p1', assignedTo: A, name: 'Levers & Lifts',
      status: 'released', days: {}, profile: { source: 'console', raw: { days: { d1: {} } } } }]);
    const p = await a.getProgram(A);
    t('the assigned program comes back', p && p.name === 'Levers & Lifts');
    t('  with its profile intact', !!(p.profile && p.profile.raw.days.d1));
  }

  /* ---------------------------------------------------------- */
  group(`${label} · logs and PRs are queryable, not a blob`);
  {
    const a = await fresh();
    await a.saveUser(U(A));
    t('no logs yet is an empty list', (await a.listLogs(A)).length === 0);
    await a.appendLog({ id: 'l1', userId: A, sessionId: 'd1',
      performedOn: '2026-09-01', blocks: [{ name: 'A' }], durationSec: 2400 });
    await a.appendLog({ id: 'l2', userId: A, sessionId: 'd2',
      performedOn: '2026-09-03', blocks: [], durationSec: 1800 });
    t('both are there', (await a.listLogs(A)).length === 2);
    t('appending never overwrites',
      (await a.listLogs(A)).some(l => l.sessionId === 'd1'));

    await a.savePRs(A, { pushup: { value: 30, unit: 'reps', date: '2026-09-01' } });
    const prs = await a.getPRs(A);
    t('PRs read back', prs && prs.pushup && prs.pushup.value === 30);
  }

  /* ---------------------------------------------------------- */
  group(`${label} · the per-user document`);
  {
    const a = await fresh();
    await a.saveUser(U(A));
    t('no state yet is null', (await a.getUserState(A)) === null);
    await a.saveUserState(A, { swaps: { d1: { pushup: 'dip' } }, habits: { '2026-09-01': { walk: true } } });
    const st = await a.getUserState(A);
    t('it round-trips whole', st && st.swaps.d1.pushup === 'dip');
    t('  nested and all', st.habits['2026-09-01'].walk === true);
  }

  /* ---------------------------------------------------------- */
  group(`${label} · run state is the device's and never shared`);
  {
    const a = await fresh();
    await a.saveUser(U(A));
    t('nothing running to begin with', (await a.getRunState(A)) === null);
    await a.saveRunState(A, { blockIndex: 2, setIndex: 1 });
    t('it comes back', (await a.getRunState(A)).blockIndex === 2);
    await a.clearRunState(A);
    t('and clears', (await a.getRunState(A)) === null);
  }

  /* ---------------------------------------------------------- */
  group(`${label} · device preferences`);
  {
    const a = await fresh();
    t('an unset pref returns the fallback', (await a.getDevicePref('voice', 'none')) === 'none');
    await a.setDevicePref('voice', 'Daniel');
    t('a set pref reads back', (await a.getDevicePref('voice', 'none')) === 'Daniel');
    t('falsy values survive — false is an answer, not an absence',
      (await a.setDevicePref('sound', false), (await a.getDevicePref('sound', true)) === false));
  }

  /* ---------------------------------------------------------- */
  group(`${label} · one person's data never leaks into another's`);
  {
    const a = await fresh();
    await a.saveUser(U(A));
    await a.saveUser(U(B));
    await a.saveUserState(A, { habits: { x: 1 } });
    await a.appendLog({ id: 'l1', userId: A, sessionId: 'd1', performedOn: '2026-09-01', blocks: [] });
    await a.savePRs(A, { pushup: { value: 30 } });
    await a.saveRunState(A, { blockIndex: 1 });

    t('state is per user', (await a.getUserState(B)) === null);
    t('logs are per user', (await a.listLogs(B)).length === 0);
    t('run state is per user', (await a.getRunState(B)) === null);
    const sp = await a.getPRs(B);
    t('PRs are per user', !sp || Object.keys(sp).length === 0);
  }
}
