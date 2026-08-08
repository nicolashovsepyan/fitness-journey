/* ============================================================
   LOCAL ADAPTER — the storage contract over localStorage.

   After Phase 2 this is the ONLY file in the app that mentions
   localStorage. Everything else goes through the contract in
   js/core/storage.js and gets a Promise back.

   THE KEYS DO NOT CHANGE. Every key below is exactly the key the app
   already writes, in exactly the same shape:

     fj.user           who this device belongs to
     fj.name.<uid>     that person's display name
     fj.v1.<uid>       their training — logs, PRs, and everything else
     fj.run.<uid>      the workout currently in progress
     fj.voiceName      the chosen speech voice
     fj.migrated.v2    marks the one-time legacy key move as done
     fj.v1 · fj.run    the pre-multi-user keys, left untouched

   That is deliberate and it is the whole safety story for this phase.
   Nobody's training is migrated, rewritten, re-keyed or re-shaped. If
   this adapter were deleted and the old synchronous store dropped back
   in, it would find its data exactly where it left it.

   Records that do not exist yet — user records, intakes, programs,
   messages — get new keys of their own. Nothing reads them until the
   phase that introduces them.

   WHY EVERYTHING RETURNS A PROMISE EVEN THOUGH IT DOES NOT NEED TO:
   because the point is the call sites, not this file. localStorage can
   answer instantly; a server cannot. If this adapter answered
   instantly, every caller would quietly depend on that and the swap to
   a server would mean rewriting all of them again.
   ============================================================ */
import { StorageAdapter } from '../core/storage.js';

const ACTIVE_KEY   = 'fj.user';
const MIGRATED_KEY = 'fj.migrated.v2';
const NAME_KEY     = uid => `fj.name.${uid}`;
const STATE_KEY    = uid => `fj.v1.${uid}`;
const RUN_KEY      = uid => `fj.run.${uid}`;
const PREF_KEY     = k   => `fj.${k}`;

/* New records. Nothing writes these until the phase that adds them. */
const USERS_KEY    = 'fj.users';
const INTAKES_KEY  = 'fj.intakes';
const PROGRAMS_KEY = 'fj.programs';
const SESSIONS_KEY = 'fj.sessions';
const MESSAGES_KEY = 'fj.messages';

/* Legacy single-user keys. Read once by init(), never written, never removed. */
const LEGACY_STATE = 'fj.v1';
const LEGACY_RUN   = 'fj.run';

export class LocalAdapter extends StorageAdapter {

  /* ---- the only three storage calls in the application ---------- */

  #get(key) {
    try { return localStorage.getItem(key); }
    catch (e) { return null; }          // Safari private mode throws on read
  }

  #set(key, value) {
    try { localStorage.setItem(key, value); return true; }
    catch (e) {
      /* Quota, or private mode. Loud, because a silent failure here is
         a workout that looks saved and is not. */
      console.error(`storage write failed for ${key}`, e);
      return false;
    }
  }

  #del(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }

  #readJSON(key, fallback = null) {
    const raw = this.#get(key);
    if (!raw) return fallback;
    try { return JSON.parse(raw); }
    catch (e) {
      console.warn(`storage: ${key} is not valid JSON, ignoring it`, e);
      return fallback;
    }
  }

  #writeJSON(key, value) { return this.#set(key, JSON.stringify(value)); }

  /* ---- lifecycle ------------------------------------------------
     The legacy key move used to happen as a side effect of importing
     users.js, which worked only because it was synchronous. It is an
     explicit awaited step now: a read that landed before the move
     would see an empty account and treat a returning user as brand
     new. The app must await this before it reads anything. */

  async init() {
    if (this.#get(MIGRATED_KEY)) return;

    const legacyState = this.#get(LEGACY_STATE);
    if (legacyState && !this.#get(STATE_KEY('nico'))) {
      this.#set(STATE_KEY('nico'), legacyState);
    }
    const legacyRun = this.#get(LEGACY_RUN);
    if (legacyRun && !this.#get(RUN_KEY('nico'))) {
      this.#set(RUN_KEY('nico'), legacyRun);
    }
    /* The legacy keys are left in place on purpose. They cost a few KB
       and they are the only copy if this ever goes wrong. */
    this.#set(MIGRATED_KEY, new Date().toISOString());
  }

  /* ---- identity -------------------------------------------------- */

  async listUsers() {
    return this.#readJSON(USERS_KEY, []);
  }

  async getUser(id) {
    const users = await this.listUsers();
    return users.find(u => u.id === id) || null;
  }

  async saveUser(user) {
    const users = await this.listUsers();
    const i = users.findIndex(u => u.id === user.id);
    const next = { ...user, updatedAt: new Date().toISOString() };
    if (i >= 0) users[i] = next; else users.push(next);
    this.#writeJSON(USERS_KEY, users);
    /* Display names have their own key and predate user records. Keep
       both in step so a half-converted app cannot show two names. */
    if (next.displayName) this.#set(NAME_KEY(next.id), String(next.displayName).slice(0, 60));
    return next;
  }

  /* Never guessed. A null here means ASK — it is what the claim screen
     is for, and guessing is what once put one person's program on
     another person's phone. */
  async getActiveUserId() {
    return this.#get(ACTIVE_KEY) || null;
  }

  async setActiveUserId(userId) {
    this.#set(ACTIVE_KEY, userId);
  }

  /* Display name, stored per user on this device and never in source —
     this repo is public. */
  async getDisplayName(uid) {
    return this.#get(NAME_KEY(uid)) || null;
  }

  async setDisplayName(uid, name) {
    this.#set(NAME_KEY(uid), String(name).slice(0, 60));
  }

  /* ---- the per-user document ------------------------------------
     One blob per user under fj.v1.<uid>. Logs and PRs live inside it
     today, which is why the methods below reach into it rather than
     into keys of their own — moving them would be a migration, and
     this phase does not migrate anything. */

  async getUserState(userId) {
    return this.#readJSON(STATE_KEY(userId), null);
  }

  async saveUserState(userId, state) {
    this.#writeJSON(STATE_KEY(userId), state);
  }

  /* ---- logs ------------------------------------------------------
     Append and read. No update, no delete: a finished workout is a
     fact about the past. */

  async appendLog(entry) {
    const uid = entry.userId;
    const state = (await this.getUserState(uid)) || {};
    state.sessions = state.sessions || [];
    /* Stored exactly as given. This adapter adds nothing and reshapes
       nothing — the log written today must be byte-identical to the
       log written before this phase. */
    state.sessions.push(entry);
    await this.saveUserState(uid, state);
    return entry;
  }

  async listLogs(userId, range = {}) {
    const state = (await this.getUserState(userId)) || {};
    let logs = state.sessions || [];
    const { from = null, to = null } = range || {};
    if (from) logs = logs.filter(l => String(l.date).slice(0, 10) >= from);
    if (to)   logs = logs.filter(l => String(l.date).slice(0, 10) <= to);
    return logs;
  }

  async getPRs(userId) {
    const state = (await this.getUserState(userId)) || {};
    return state.prs || {};
  }

  async savePRs(userId, prs) {
    const state = (await this.getUserState(userId)) || {};
    state.prs = prs;
    await this.saveUserState(userId, state);
    return prs;
  }

  /* ---- live workout ---------------------------------------------
     Device-local and never synced. A workout in progress belongs to
     the phone in your hand; two devices resuming the same session
     would overwrite each other, and "never lose a workout" is the one
     promise this app cannot break. */

  async getRunState(userId) {
    return this.#readJSON(RUN_KEY(userId), null);
  }

  async saveRunState(userId, state) {
    this.#writeJSON(RUN_KEY(userId), state);
  }

  async clearRunState(userId) {
    this.#del(RUN_KEY(userId));
  }

  /* ---- device preferences ---------------------------------------
     Also never synced: the voices on an iPhone are not the ones on a
     laptop. */

  async getDevicePref(key, fallback = null) {
    const v = this.#get(PREF_KEY(key));
    return v === null ? fallback : v;
  }

  async setDevicePref(key, value) {
    this.#set(PREF_KEY(key), String(value));
  }

  /* ---- intakes, programs, sessions, messages --------------------
     Real implementations over new keys. Nothing calls them yet; they
     are here so the adapter satisfies the whole contract rather than
     half of it, and so Phase 3 has somewhere to write to. */

  async #list(key) { return this.#readJSON(key, []); }

  async #upsert(key, records) {
    const all = await this.#list(key);
    const stamp = new Date().toISOString();
    for (const rec of records) {
      const next = { ...rec, updatedAt: stamp };
      const i = all.findIndex(r => r.id === next.id);
      if (i >= 0) all[i] = next; else all.push(next);
    }
    this.#writeJSON(key, all);
    return records;
  }

  async listIntakes({ status = null } = {}) {
    const all = await this.#list(INTAKES_KEY);
    return all.slice().sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
  }

  async getIntake(userId) {
    const all = await this.listIntakes();
    return all.find(i => i.userId === userId) || null;   // newest first, so this is the latest
  }

  async saveIntake(intake) {
    await this.#upsert(INTAKES_KEY, [intake]);
    return intake;
  }

  async getProgram(userId) {
    const user = await this.getUser(userId);
    const all = await this.#list(PROGRAMS_KEY);
    if (user?.programId) return all.find(p => p.id === user.programId) || null;
    return all.find(p => p.assignedTo === userId) || null;
  }

  async savePrograms(programs) {
    return this.#upsert(PROGRAMS_KEY, programs);
  }

  async getSession(sessionId) {
    const all = await this.#list(SESSIONS_KEY);
    return all.find(s => s.id === sessionId) || null;
  }

  async listSessions(userId, range) {
    const program = await this.getProgram(userId);
    if (!program) return [];
    const all = await this.#list(SESSIONS_KEY);
    return all.filter(s => s.programId === program.id);
  }

  async saveSessions(sessions) {
    return this.#upsert(SESSIONS_KEY, sessions);
  }

  async listMessages(userId, { withUserId = null, since = null } = {}) {
    let all = await this.#list(MESSAGES_KEY);
    all = all.filter(m => m.fromUserId === userId || m.toUserId === userId);
    if (withUserId) all = all.filter(m => m.fromUserId === withUserId || m.toUserId === withUserId);
    if (since) all = all.filter(m => m.createdAt >= since);
    return all.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  }

  async sendMessage(message) {
    await this.#upsert(MESSAGES_KEY, [message]);
    return message;
  }

  /* ---- backup ----------------------------------------------------
     Raw passthrough. How two backups are reconciled is a decision
     about training data, not about storage, so the merge rules stay
     in the store where they can be read alongside what they protect. */

  async exportUser(userId) {
    const state = (await this.getUserState(userId)) || {};
    return JSON.stringify(state, null, 2);
  }

  async importUser(userId, json, { mode = 'merge' } = {}) {
    let incoming;
    try { incoming = typeof json === 'string' ? JSON.parse(json) : json; }
    catch (e) { return { ok: false, error: 'That file is not a valid backup.' }; }
    if (!incoming || typeof incoming !== 'object' || !Array.isArray(incoming.sessions)) {
      return { ok: false, error: "That doesn't look like a Fitness Journey backup." };
    }
    await this.saveUserState(userId, incoming);
    return { ok: true, added: incoming.sessions.length, mode: 'replace' };
  }
}
