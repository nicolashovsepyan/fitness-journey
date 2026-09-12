/* ============================================================
   SUPABASE ADAPTER — the same storage contract, over the database.

   It implements js/core/storage.js and nothing else. Every screen in
   the app already talks to that contract, so no screen changes.

   WHERE THIS SITS, AND IT IS NOT IN FRONT.

   docs/BACKEND.md: Supabase is the sync target BEHIND LocalAdapter,
   never in front of it. The app reads and writes locally and always
   succeeds; this adapter is what a sync layer drives on the other
   side. A workout in a basement with no signal behaves exactly as it
   does today because the thing the screens hold has not changed.

   So a method here is allowed to throw. LocalAdapter is not.

   THREE THINGS THE SERVER DECIDES AND THE PHONE DOES NOT.

   1. WHO YOU ARE. getActiveUserId() on a phone means "whose device is
      this", answered from a key. Here it means "who is signed in",
      answered by the session. You cannot claim a device by writing a
      row, so setActiveUserId is not a write — it asserts that the id
      handed in is the signed-in one, and throws if it is not. That
      throw is the point: it is the difference between a bug and one
      person reading another person's program.

   2. WHO YOU CAN SEE. listUsers() sends no filter at all. It does not
      need one. Row level security already limits public.users to your
      own row plus the clients whose trainer_id is you, so the honest
      query is "select everything" and let the database answer. A
      filter here would be a second, weaker copy of a rule that is
      already enforced where it cannot be bypassed.

   3. WHAT A NAME IS. getDisplayName is device-local by contract — what
      THIS phone calls somebody, set from the name on an invite link,
      kept out of the record because the repo is public. A server has
      no devices. So the two name methods are the one place this
      adapter deliberately does not go to the server: they stay on the
      device, which is what the contract already says they are.

   NEVER SYNCED, AND THERE IS NO TABLE FOR THEM: run state and device
   preferences. A workout in progress belongs to the phone in your
   hand; if two devices could resume the same session, whichever
   finished last would win. Both are implemented here against the
   device, not the database, and the schema has no room for them on
   purpose.
   ============================================================ */
import { StorageAdapter } from '../core/storage.js';
import { Supabase } from './supabase-rest.js';

const nowISO = () => new Date().toISOString();

/* ---- columns are snake_case, records are camelCase ----------------
   Written out one field at a time rather than converted by a rule.
   A rule looks tidier and hides exactly the bug this app keeps
   finding: a field written by one layer that the next never reads.
   Spelled out, a field with nowhere to go is a missing line you can
   see, and mapping these by hand is what turned up that logs had no
   name column and prs had nowhere to put a per-side record. */

const MAP = {
  users: {
    id: 'id', role: 'role', status: 'status', displayName: 'display_name',
    email: 'email', ui: 'ui', programId: 'program_id', trainerId: 'trainer_id',
    accent: 'accent', createdAt: 'created_at', updatedAt: 'updated_at',
  },
  intakes: {
    id: 'id', userId: 'user_id', version: 'version', answers: 'answers',
    derived: 'derived', submittedAt: 'submitted_at',
    createdAt: 'created_at', updatedAt: 'updated_at',
  },
  programs: {
    id: 'id', ownerId: 'owner_id', assignedTo: 'assigned_to', name: 'name',
    status: 'status', days: 'days', profile: 'profile',
    createdAt: 'created_at', updatedAt: 'updated_at',
  },
  sessions: {
    id: 'id', programId: 'program_id', name: 'name', pattern: 'pattern',
    blocks: 'blocks', createdAt: 'created_at', updatedAt: 'updated_at',
  },
  logs: {
    id: 'id', userId: 'user_id', sessionId: 'session_id', name: 'name',
    date: 'performed_on', blocks: 'blocks', durationSec: 'duration_sec',
    createdAt: 'created_at', updatedAt: 'updated_at',
  },
  messages: {
    id: 'id', fromUserId: 'from_user_id', toUserId: 'to_user_id', body: 'body',
    contextType: 'context_type', contextId: 'context_id', readAt: 'read_at',
    createdAt: 'created_at', updatedAt: 'updated_at',
  },
};

/** record -> row. Fields the map does not name are DROPPED, loudly in
 *  the sense that they are absent from the map and therefore from the
 *  schema. Undefined is skipped so a partial write stays partial;
 *  null is kept, because null is an answer. */
function toRow(kind, rec) {
  const m = MAP[kind], row = {};
  for (const k in m) if (rec[k] !== undefined) row[m[k]] = rec[k];
  return row;
}

/** row -> record. */
function toRec(kind, row) {
  if (!row) return null;
  const m = MAP[kind], rec = {};
  for (const k in m) rec[k] = row[m[k]] ?? null;
  return rec;
}

export class SupabaseAdapter extends StorageAdapter {
  #sb; #device;

  /** @param {{ client: Supabase, device: StorageAdapter }} deps
   *  `device` is whatever holds the things that never leave the phone:
   *  the display-name overrides, the run state, the preferences. In the
   *  app that is the LocalAdapter already in memory. In a test it is a
   *  throwaway. Passing it in rather than reaching for localStorage is
   *  what keeps this file runnable outside a browser. */
  constructor({ client, device }) {
    super();
    if (!client) throw new Error('SupabaseAdapter needs a client');
    if (!device) throw new Error('SupabaseAdapter needs a device store for what never syncs');
    this.#sb = client;
    this.#device = device;
  }

  async init() { await this.#device.init?.(); return this; }

  /** The signed-in id. Null when nobody is. */
  get signedInId() { return this.#sb.userId; }

  /* ---- people --------------------------------------------------- */

  async getUser(id) {
    return toRec('users', await this.#sb.selectOne('users', { id: `eq.${id}` }));
  }

  async listUsers() {
    // No filter, deliberately. See note 2 at the top of this file.
    const rows = await this.#sb.select('users', { order: 'created_at.asc' });
    return rows.map(r => toRec('users', r));
  }

  async saveUser(user) {
    if (!user?.id) throw new Error('saveUser needs an id');
    const row = toRow('users', { ...user, updatedAt: nowISO() });
    const [saved] = await this.#sb.upsert('users', [row], { onConflict: 'id' });
    return toRec('users', saved);
  }

  async removeUser(id) {
    /* NOT A DELETE, AND THAT IS THE CONTRACT BEING KEPT RATHER THAN
       BROKEN.

       js/core/storage.js says this removes the PERSON, not their
       training: "logs and intakes are addressed separately and
       deleting those is a different decision with different
       consequences." On a phone that is true for free, because
       removing somebody from a device roster touches nothing else.

       A delete here would not be that. Every foreign key in
       01c-links-and-indexes.sql cascades from users, so one statement
       would take their intakes, their logs, their records and their
       settings with it. That is the opposite of what the method
       promises.

       What a coach actually means by removing a client is that this
       person is no longer theirs. So that is what it does. The client
       keeps everything they have ever done, and this coach stops being
       able to see any of it, which is what row level security decides
       the moment trainer_id stops pointing here.

       IT ALSO USED TO DO NOTHING AT ALL, SILENTLY. There is no delete
       policy on public.users, so the delete matched zero rows and
       PostgREST answered 204 — success, no error, nothing changed. A
       method that reports success and does nothing is worse than one
       that throws, so this one throws. */
    if (id === this.#sb.userId) {
      throw new Error(
        'removeUser will not delete your own account. That is a bigger decision '
        + 'than this method makes, and it would take every log and record with it.');
    }
    const changed = await this.#sb.update('users', { id: `eq.${id}` }, { trainer_id: null });
    if (!changed.length) {
      throw new Error(`removeUser(${id}) changed nothing — they are not your client.`);
    }
  }

  /* ---- names are the device's, by contract ---------------------- */

  async getDisplayName(id) { return this.#device.getDisplayName(id); }
  async setDisplayName(id, name) { return this.#device.setDisplayName(id, name); }

  /* ---- who is signed in ----------------------------------------- */

  async getActiveUserId() { return this.#sb.userId; }

  async setActiveUserId(userId) {
    // Not a write. An assertion, and a loud one. See note 1 above.
    if (userId == null) { await this.#sb.signOut(); return; }
    const who = this.#sb.userId;
    if (who !== userId) {
      throw new Error(
        `cannot claim this session for ${userId}: ${who ? `it belongs to ${who}` : 'nobody is signed in'}`);
    }
  }

  /* ---- intake ---------------------------------------------------- */

  async getIntake(userId) {
    return toRec('intakes', await this.#sb.selectOne('intakes',
      { user_id: `eq.${userId}`, order: 'submitted_at.desc' }));
  }

  async saveIntake(intake) {
    // Insert, never upsert. 02-rls.sql grants no update and no delete on
    // this table on purpose: what somebody actually said has to stay
    // true, and a correction is a new intake.
    const row = toRow('intakes', { ...intake, submittedAt: intake.submittedAt || nowISO() });
    delete row.id;                              // let the database name it
    const [saved] = await this.#sb.insert('intakes', [row]);
    return toRec('intakes', saved);
  }

  async listIntakes({ status = null } = {}) {
    // RLS decides whose. A coach sees their clients; a client sees one.
    const rows = await this.#sb.select('intakes', { order: 'submitted_at.desc' });
    const recs = rows.map(r => toRec('intakes', r));
    if (!status) return recs;
    // status lives on the person, not the intake, so it is a join the
    // caller asked for rather than a column that exists.
    const users = await this.listUsers();
    const keep = new Set(users.filter(u => u.status === status).map(u => u.id));
    return recs.filter(r => keep.has(r.userId));
  }

  /* ---- programs and sessions -------------------------------------- */

  async getProgram(userId) {
    return toRec('programs', await this.#sb.selectOne('programs',
      { assigned_to: `eq.${userId}`, status: 'neq.archived', order: 'updated_at.desc' }));
  }

  async savePrograms(programs) {
    const list = Array.isArray(programs) ? programs : [programs];
    if (!list.length) return [];
    // One request, so assigning a program and archiving the one it
    // replaces cannot half-fail. The contract says plural for exactly
    // this reason and PostgREST honours it as a single statement.
    const rows = list.map(p => toRow('programs', { ...p, updatedAt: nowISO() }));
    const saved = await this.#sb.upsert('programs', rows, { onConflict: 'id' });
    return saved.map(r => toRec('programs', r));
  }

  async getSession(id) {
    return toRec('sessions', await this.#sb.selectOne('sessions', { id: `eq.${id}` }));
  }

  async listSessions(userId) {
    // A session is reachable only through the program that owns it,
    // which is also exactly what the policy in 02-rls.sql says. No
    // program means no sessions, not an error.
    const prog = await this.getProgram(userId);
    if (!prog) return [];
    const rows = await this.#sb.select('sessions',
      { program_id: `eq.${prog.id}`, order: 'created_at.asc' });
    return rows.map(r => toRec('sessions', r));
  }

  async saveSessions(sessions) {
    const list = Array.isArray(sessions) ? sessions : [sessions];
    if (!list.length) return [];
    const rows = list.map(s => toRow('sessions', { ...s, updatedAt: nowISO() }));
    const saved = await this.#sb.upsert('sessions', rows, { onConflict: 'id' });
    return saved.map(r => toRec('sessions', r));
  }

  /* ---- logs ------------------------------------------------------- */

  async appendLog(entry) {
    // Insert only. A completed workout is a fact about the past, and
    // the policies offer no delete.
    const row = toRow('logs', { ...entry, createdAt: undefined, updatedAt: undefined });
    if (!row.id) delete row.id;
    const [saved] = await this.#sb.insert('logs', [row]);
    return toRec('logs', saved);
  }

  async listLogs(userId, range = {}) {
    const q = { user_id: `eq.${userId}`, order: 'performed_on.desc' };
    // Both ends inclusive, matching the DateRange the contract defines.
    // Two bounds on one column go in a single and(...) rather than two
    // performed_on parameters, because a query string cannot carry the
    // same key twice and the second would silently replace the first.
    const bounds = [];
    if (range?.from) bounds.push(`performed_on.gte.${range.from}`);
    if (range?.to) bounds.push(`performed_on.lte.${range.to}`);
    if (bounds.length) q.and = `(${bounds.join(',')})`;
    const rows = await this.#sb.select('logs', q);
    return rows.map(r => toRec('logs', r));
  }

  /* ---- personal records ------------------------------------------
     A cache, by the contract. Rebuildable from the logs if it is ever
     lost, which is why overwriting the whole bag is acceptable here
     and would not be for a log. */

  async getPRs(userId) {
    const rows = await this.#sb.select('prs', { user_id: `eq.${userId}` });
    const out = {};
    for (const row of rows) {
      out[row.ex_id] = {
        value: row.value === null ? null : Number(row.value),
        unit: row.unit,
        date: row.achieved_on,
        ...(row.weight !== null ? { weight: Number(row.weight) } : {}),
        ...(row.l !== null ? { l: Number(row.l) } : {}),
        ...(row.r !== null ? { r: Number(row.r) } : {}),
      };
    }
    return out;
  }

  async savePRs(userId, prs) {
    const rows = Object.entries(prs || {}).map(([exId, p]) => ({
      user_id: userId, ex_id: exId,
      value: p.value ?? null, unit: p.unit ?? null, weight: p.weight ?? null,
      l: p.l ?? null, r: p.r ?? null,
      achieved_on: p.date ?? null,
    }));
    if (rows.length) await this.#sb.upsert('prs', rows, { onConflict: 'user_id,ex_id' });
    return prs;
  }

  /* ---- the per-user document --------------------------------------
     One jsonb row, exactly as js/core/storage.js said it would be. */

  async getUserState(userId) {
    const row = await this.#sb.selectOne('user_state', { user_id: `eq.${userId}` });
    return row ? row.state : null;
  }

  async saveUserState(userId, state) {
    await this.#sb.upsert('user_state',
      [{ user_id: userId, state: state ?? {} }], { onConflict: 'user_id' });
  }

  /* ---- messages ---------------------------------------------------- */

  async sendMessage(message) {
    const row = toRow('messages', { ...message, createdAt: undefined, updatedAt: undefined });
    if (!row.id) delete row.id;
    const [saved] = await this.#sb.insert('messages', [row]);
    return toRec('messages', saved);
  }

  async listMessages(userId, withUserId = null) {
    const q = { order: 'created_at.asc' };
    // RLS already restricts this to conversations you are part of; the
    // filter is about which conversation, not about permission.
    q.or = withUserId
      ? `(and(from_user_id.eq.${userId},to_user_id.eq.${withUserId}),and(from_user_id.eq.${withUserId},to_user_id.eq.${userId}))`
      : `(from_user_id.eq.${userId},to_user_id.eq.${userId})`;
    const rows = await this.#sb.select('messages', q);
    return rows.map(r => toRec('messages', r));
  }

  async markRead(id) {
    await this.#sb.update('messages', { id: `eq.${id}` }, { read_at: nowISO() });
  }

  /* ---- whole-account operations ------------------------------------
     A backup file has to mean the same thing whichever adapter wrote
     it, or a file exported from a phone will not restore on a laptop.
     So the shape is the per-user document, byte for byte what
     LocalAdapter writes. */

  async exportUser(userId) {
    const state = (await this.getUserState(userId)) || {};
    return JSON.stringify(state, null, 2);
  }

  async importUser(userId, json, { mode = 'merge' } = {}) {
    let incoming;
    try { incoming = typeof json === 'string' ? JSON.parse(json) : json; }
    catch { return { ok: false, error: 'That file is not a valid backup.' }; }
    if (!incoming || typeof incoming !== 'object' || !Array.isArray(incoming.sessions)) {
      return { ok: false, error: "That doesn't look like a Fitness Journey backup." };
    }
    await this.saveUserState(userId, incoming);
    return { ok: true, added: incoming.sessions.length, mode: 'replace' };
  }

  /* ---- what never leaves the phone ---------------------------------
     No table, no request, no sync. See the note at the top. */

  async getRunState(userId) { return this.#device.getRunState(userId); }
  async saveRunState(userId, s) { return this.#device.saveRunState(userId, s); }
  async clearRunState(userId) { return this.#device.clearRunState(userId); }
  async getDevicePref(k, fb = null) { return this.#device.getDevicePref(k, fb); }
  async setDevicePref(k, v) { return this.#device.setDevicePref(k, v); }
}
