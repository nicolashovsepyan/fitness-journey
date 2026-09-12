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
   ============================================================ */

export async function runConformance(makeAdapter, { label = 'adapter', t, group }) {
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
  group(`${label} · people`);
  {
    const a = await fresh();
    t('a new adapter knows nobody', (await a.listUsers()).length === 0);
    t('getUser on a stranger is null, not a throw', (await a.getUser('nobody')) === null);

    const saved = await a.saveUser(U('nick'));
    t('saveUser returns the record', saved && saved.id === 'nick');
    t('  and stamps updatedAt', !!saved.updatedAt);
    t('listUsers finds them', (await a.listUsers()).some(u => u.id === 'nick'));
    t('getUser finds them', (await a.getUser('nick')).id === 'nick');

    await a.saveUser(U('nick', { status: 'pending' }));
    t('saving twice updates rather than duplicates',
      (await a.listUsers()).filter(u => u.id === 'nick').length === 1);
    t('  and the change took', (await a.getUser('nick')).status === 'pending');

    await a.saveUser(U('sevan'));
    await a.removeUser('nick');
    t('removeUser drops that one', !(await a.getUser('nick')));
    t('  and leaves the others alone', !!(await a.getUser('sevan')));
  }

  /* ---------------------------------------------------------- */
  group(`${label} · whose device this is`);
  {
    const a = await fresh();
    t('an unclaimed device answers null, never a guess', (await a.getActiveUserId()) === null);
    await a.saveUser(U('nick'));
    await a.setActiveUserId('nick');
    t('claiming sticks', (await a.getActiveUserId()) === 'nick');
    await a.setActiveUserId(null);
    t('and can be released', (await a.getActiveUserId()) === null);

    /* The claim is a property of the DEVICE. Removing the person it
       points at must not leave it pointing at a ghost. */
    await a.setActiveUserId('nick');
    await a.removeUser('nick');
    t('removing the claimed user releases the claim', (await a.getActiveUserId()) === null);
  }

  /* ---------------------------------------------------------- */
  group(`${label} · display names are the device's`);
  {
    const a = await fresh();
    await a.saveUser(U('c1', { displayName: 'Client One' }));
    t('no override to begin with, or the record name',
      [null, 'Client One'].includes(await a.getDisplayName('c1')));
    await a.setDisplayName('c1', 'Nick');
    t('setDisplayName reads back', (await a.getDisplayName('c1')) === 'Nick');
    t('  and does not rewrite the record',
      (await a.getUser('c1')).displayName === 'Client One');
  }

  /* ---------------------------------------------------------- */
  group(`${label} · intake`);
  {
    const a = await fresh();
    await a.saveUser(U('nick'));
    t('no intake yet is null', (await a.getIntake('nick')) === null);

    await a.saveIntake({ id: 'i1', userId: 'nick', version: 6,
      answers: { name: 'Nick', age: 38, pain: ['knee'] }, derived: { tier: 3 },
      submittedAt: '2026-09-01T10:00:00.000Z' });
    const got = await a.getIntake('nick');
    t('it comes back', !!got);
    t('  verbatim — the answers are the record', got.answers.age === 38);
    t('  including arrays', Array.isArray(got.answers.pain) && got.answers.pain[0] === 'knee');
    t('  and what was derived beside them', got.derived.tier === 3);

    await a.saveIntake({ id: 'i2', userId: 'nick', version: 6,
      answers: { name: 'Nick', age: 39 }, derived: {},
      submittedAt: '2026-09-08T10:00:00.000Z' });
    t('a second intake wins — most recent, not first',
      (await a.getIntake('nick')).answers.age === 39);
  }

  /* ---------------------------------------------------------- */
  group(`${label} · programs`);
  {
    const a = await fresh();
    await a.saveUser(U('nick'));
    t('no program yet is null', (await a.getProgram('nick')) === null);
    await a.savePrograms([{ id: 'p1', assignedTo: 'nick', name: 'Levers & Lifts',
      status: 'released', days: {}, profile: { source: 'console', raw: { days: { d1: {} } } } }]);
    const p = await a.getProgram('nick');
    t('the assigned program comes back', p && p.name === 'Levers & Lifts');
    t('  with its profile intact', !!(p.profile && p.profile.raw.days.d1));
  }

  /* ---------------------------------------------------------- */
  group(`${label} · logs and PRs are queryable, not a blob`);
  {
    const a = await fresh();
    await a.saveUser(U('nick'));
    t('no logs yet is an empty list', (await a.listLogs('nick')).length === 0);
    await a.appendLog({ id: 'l1', userId: 'nick', sessionId: 'd1',
      performedOn: '2026-09-01', blocks: [{ name: 'A' }], durationSec: 2400 });
    await a.appendLog({ id: 'l2', userId: 'nick', sessionId: 'd2',
      performedOn: '2026-09-03', blocks: [], durationSec: 1800 });
    t('both are there', (await a.listLogs('nick')).length === 2);
    t('appending never overwrites',
      (await a.listLogs('nick')).some(l => l.sessionId === 'd1'));

    await a.savePRs('nick', { pushup: { value: 30, unit: 'reps', date: '2026-09-01' } });
    const prs = await a.getPRs('nick');
    t('PRs read back', prs && prs.pushup && prs.pushup.value === 30);
  }

  /* ---------------------------------------------------------- */
  group(`${label} · the per-user document`);
  {
    const a = await fresh();
    await a.saveUser(U('nick'));
    t('no state yet is null', (await a.getUserState('nick')) === null);
    await a.saveUserState('nick', { swaps: { d1: { pushup: 'dip' } }, habits: { '2026-09-01': { walk: true } } });
    const st = await a.getUserState('nick');
    t('it round-trips whole', st && st.swaps.d1.pushup === 'dip');
    t('  nested and all', st.habits['2026-09-01'].walk === true);
  }

  /* ---------------------------------------------------------- */
  group(`${label} · run state is the device's and never shared`);
  {
    const a = await fresh();
    await a.saveUser(U('nick'));
    t('nothing running to begin with', (await a.getRunState('nick')) === null);
    await a.saveRunState('nick', { blockIndex: 2, setIndex: 1 });
    t('it comes back', (await a.getRunState('nick')).blockIndex === 2);
    await a.clearRunState('nick');
    t('and clears', (await a.getRunState('nick')) === null);
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
    await a.saveUser(U('nick'));
    await a.saveUser(U('sevan'));
    await a.saveUserState('nick', { habits: { x: 1 } });
    await a.appendLog({ id: 'l1', userId: 'nick', sessionId: 'd1', performedOn: '2026-09-01', blocks: [] });
    await a.savePRs('nick', { pushup: { value: 30 } });
    await a.saveRunState('nick', { blockIndex: 1 });

    t('state is per user', (await a.getUserState('sevan')) === null);
    t('logs are per user', (await a.listLogs('sevan')).length === 0);
    t('run state is per user', (await a.getRunState('sevan')) === null);
    const sp = await a.getPRs('sevan');
    t('PRs are per user', !sp || Object.keys(sp).length === 0);
  }
}
