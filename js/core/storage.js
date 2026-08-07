/* ============================================================
   STORAGE CONTRACT — the only legal way to reach persisted data.

   This is an INTERFACE, not an implementation. It defines what any
   storage backend must be able to do; Phase 2 writes LocalAdapter
   against it (today's localStorage keys, unchanged), and a Supabase
   adapter arrives later without a single screen being rewritten.

   Two rules, and they are the whole point of the file:

   1. EVERY METHOD RETURNS A PROMISE — including the ones that could
      answer instantly from localStorage. If a method is synchronous
      today because it happens to be local, every call site quietly
      grows a dependency on that, and swapping in a server means
      rewriting all of them. The audit counted 99 such call sites
      (docs/AUDIT.md §2). We pay the await now, once.

   2. AFTER PHASE 2, localStorage APPEARS IN THE ADAPTER AND NOWHERE
      ELSE. Not in users.js, not in runstate.js, not in a screen.

   Local-first is not negotiable. The adapter in front of the app is
   always the local one; a remote backend syncs behind it. A workout
   in a basement with no signal must behave exactly as it does now.

   NOTHING IMPORTS THIS YET.
   ============================================================ */

/**
 * @typedef {import('./schema.js').User} User
 * @typedef {import('./schema.js').Intake} Intake
 * @typedef {import('./schema.js').Program} Program
 * @typedef {import('./schema.js').Session} Session
 * @typedef {import('./schema.js').LogEntry} LogEntry
 * @typedef {import('./schema.js').Message} Message
 */

/**
 * @typedef {Object} DateRange
 * @property {string|null} from  local 'YYYY-MM-DD', inclusive
 * @property {string|null} to    local 'YYYY-MM-DD', inclusive
 */

/* ============================================================
   The interface.

   Implemented as a class whose every method throws. A half-built
   adapter then fails loudly and immediately, naming the method it is
   missing — rather than returning undefined and letting a screen
   render an empty week as though that were the truth.
   ============================================================ */
export class StorageAdapter {
  /** @param {string} m */
  #todo(m) { return Promise.reject(new Error(`${this.constructor.name}.${m}() is not implemented`)); }

  /* ---- identity ------------------------------------------------
     Users are RECORDS, not a compile-time constant. js/users.js
     currently hardcodes exactly two people, which is why onboarding a
     real client means editing source and redeploying (docs/AUDIT.md
     §3.2). This is where that changes. */

  /** @returns {Promise<User|null>} */
  getUser(id) { return this.#todo('getUser'); }

  /** Everyone this device knows about. The claim screen lists these
   *  rather than a hardcoded pair.
   *  @returns {Promise<User[]>} */
  listUsers() { return this.#todo('listUsers'); }

  /** Create or update. Must stamp updatedAt. @returns {Promise<User>} */
  saveUser(user) { return this.#todo('saveUser'); }

  /* Which user this DEVICE belongs to.
     Deliberately separate from listUsers(): "who exists" and "whose
     phone is this" are different questions, and conflating them is
     what put one person's program on another person's device. The app
     must never guess — if this returns null, ask. */

  /** @returns {Promise<string|null>} */
  getActiveUserId() { return this.#todo('getActiveUserId'); }

  /** @returns {Promise<void>} */
  setActiveUserId(userId) { return this.#todo('setActiveUserId'); }

  /* ---- intake --------------------------------------------------- */

  /** Most recent intake for a user. @returns {Promise<Intake|null>} */
  getIntake(userId) { return this.#todo('getIntake'); }

  /** @returns {Promise<Intake>} */
  saveIntake(intake) { return this.#todo('saveIntake'); }

  /** Every intake, newest first — the trainer's review queue.
   *  @returns {Promise<Intake[]>} */
  listIntakes({ status = null } = {}) { return this.#todo('listIntakes'); }

  /* ---- programs -------------------------------------------------- */

  /** The program assigned to a user, or null while they are pending.
   *  @returns {Promise<Program|null>} */
  getProgram(userId) { return this.#todo('getProgram'); }

  /** Save one or many. Plural because assigning a program and
   *  archiving the one it replaces must not be two writes that can
   *  half-fail — a client whose old program is gone and whose new one
   *  did not land has no app at all.
   *  @param {Program[]} programs @returns {Promise<Program[]>} */
  savePrograms(programs) { return this.#todo('savePrograms'); }

  /* ---- sessions (prescribed) -------------------------------------- */

  /** @returns {Promise<Session|null>} */
  getSession(sessionId) { return this.#todo('getSession'); }

  /** Sessions in a user's program.
   *  @param {string} userId @param {DateRange} [range]
   *  @returns {Promise<Session[]>} */
  listSessions(userId, range) { return this.#todo('listSessions'); }

  /** @param {Session[]} sessions @returns {Promise<Session[]>} */
  saveSessions(sessions) { return this.#todo('saveSessions'); }

  /* ---- logs (performed) -------------------------------------------
     The irreplaceable data. Note there is no updateLog and no
     deleteLog: a completed workout is a fact about the past, and the
     API should not offer a way to rewrite one. */

  /** Append one completed workout. @returns {Promise<LogEntry>} */
  appendLog(entry) { return this.#todo('appendLog'); }

  /** @param {string} userId @param {DateRange} [range]
   *  @returns {Promise<LogEntry[]>} */
  listLogs(userId, range) { return this.#todo('listLogs'); }

  /* ---- personal records --------------------------------------------
     Derived from logs in principle, cached in practice — recomputing
     every record from every session on each render is not free, and
     the beaten-a-PR moment has to be instant. Treated as a cache: if
     it is ever lost it can be rebuilt from the logs. */

  /** @returns {Promise<Object>} { exId: { value, unit, date, weight?, l?, r? } } */
  getPRs(userId) { return this.#todo('getPRs'); }

  /** @returns {Promise<Object>} */
  savePRs(userId, prs) { return this.#todo('savePRs'); }

  /* ---- messages ----------------------------------------------------
     Not built yet. Present so that building it is not a schema change. */

  /** @returns {Promise<Message[]>} */
  listMessages(userId, { withUserId = null, since = null } = {}) { return this.#todo('listMessages'); }

  /** @returns {Promise<Message>} */
  sendMessage(message) { return this.#todo('sendMessage'); }

  /* ---- live workout state ------------------------------------------
     NOT IN THE ORIGINAL PHASE 1 LIST — added deliberately.

     js/runner/runstate.js writes localStorage directly (docs/AUDIT.md
     §1.2). Phase 2 says localStorage must appear only inside the
     adapter, so the contract has to cover the run state or that rule
     is unachievable. Better to find it now than to discover it
     halfway through the conversion.

     DEVICE-LOCAL, AND IT MUST NEVER SYNC. A workout in progress
     belongs to the phone in your hand. Syncing it would let a second
     device resume a session the first device is still running, and
     whichever finished last would overwrite the other. The whole
     "never lose a workout" guarantee rests on this state being
     single-device and timestamp-based. */

  /** @returns {Promise<Object|null>} */
  getRunState(userId) { return this.#todo('getRunState'); }

  /** @returns {Promise<void>} */
  saveRunState(userId, state) { return this.#todo('saveRunState'); }

  /** @returns {Promise<void>} */
  clearRunState(userId) { return this.#todo('clearRunState'); }

  /* ---- device preferences -------------------------------------------
     Also not in the original list, same reason: js/timer.js persists
     the chosen speech voice (docs/AUDIT.md §1.2). It belongs to the
     device, not the person — the voice available on an iPhone is not
     the one on a laptop — so it never syncs either. */

  /** @returns {Promise<*>} */
  getDevicePref(key, fallback = null) { return this.#todo('getDevicePref'); }

  /** @returns {Promise<void>} */
  setDevicePref(key, value) { return this.#todo('setDevicePref'); }

  /* ---- whole-account operations -------------------------------------- */

  /** Everything for one user, as a backup file. @returns {Promise<string>} */
  exportUser(userId) { return this.#todo('exportUser');  }

  /** Restore a backup. 'merge' adds what is missing and never deletes
   *  newer training; 'replace' overwrites. Merge is the default because
   *  restoring an old backup must not cost somebody last week's work.
   *  @returns {Promise<{ok:boolean, added?:number, error?:string}>} */
  importUser(userId, json, { mode = 'merge' } = {}) { return this.#todo('importUser'); }

  /* ---- lifecycle -------------------------------------------------------
     Somewhere to put the work that currently happens at module load.

     js/users.js calls migrate() as a side effect of being imported
     (docs/AUDIT.md §2.3). That works only because it is synchronous.
     Once storage is async, an import can no longer guarantee migration
     has finished, and a read that lands first would see an empty
     account and treat it as a new one. The app must await this before
     it reads anything. */

  /** @returns {Promise<void>} */
  init() { return this.#todo('init'); }
}

/* ============================================================
   Module-level access.

   One adapter per running app, set once at boot. A getter rather than
   a bare export so that reaching for storage before init() fails with
   a sentence that says what went wrong.
   ============================================================ */
let _adapter = null;

/** @param {StorageAdapter} adapter */
export function setAdapter(adapter) {
  if (!(adapter instanceof StorageAdapter)) {
    throw new Error('setAdapter() expects a StorageAdapter');
  }
  _adapter = adapter;
}

/** @returns {StorageAdapter} */
export function storage() {
  if (!_adapter) throw new Error('storage() called before setAdapter() — the app must install an adapter at boot');
  return _adapter;
}

/* ============================================================
   Boundary guard.

   The rule "nothing outside the adapter touches localStorage" is only
   worth stating if something checks it. The real enforcement will be a
   source-level check added in Phase 2c, once there is something for it
   to pass; this is the belt-and-braces runtime version, for development
   only.

   Off by default: it deliberately breaks any code still reaching
   around the adapter, which is exactly what you want while converting
   call sites in Phase 2 and exactly what you do not want in a user's
   hands mid-workout.
   ============================================================ */
export function sealLocalStorage({ allow = [] } = {}) {
  if (typeof localStorage === 'undefined') return () => {};
  const real = { getItem: localStorage.getItem, setItem: localStorage.setItem, removeItem: localStorage.removeItem };
  const guard = name => function (key, ...rest) {
    if (!allow.includes(key)) {
      throw new Error(`Direct localStorage.${name}('${key}') — go through the storage adapter (js/core/storage.js)`);
    }
    return real[name].call(localStorage, key, ...rest);
  };
  localStorage.getItem = guard('getItem');
  localStorage.setItem = guard('setItem');
  localStorage.removeItem = guard('removeItem');
  return () => Object.assign(localStorage, real);
}
