/* ============================================================
   SCHEMA — the shapes the survey and the app both agree on.

   One file, so there is exactly one definition of what a User is.
   Today the survey and the app describe the same person in two
   incompatible ways (see docs/AUDIT.md §4.2 and §6.2); this is where
   that stops.

   Rules every shape here obeys, because a record has to be able to
   live on a server as easily as in this browser:

     · every id is a stable, opaque string — never an array index,
       never a name, never a number that could be renumbered
     · every record carries createdAt and updatedAt as ISO strings
     · plain JSON only: no functions, no class instances, no Date
       objects, no undefined. Absent means null, explicitly.
     · nothing depends on being in this tab, this device, or this
       browser at all

   No library, no build step. JSDoc typedefs give editors the shape;
   the validators below give the running code a way to refuse a
   malformed record before it is written anywhere.

   NOTHING IMPORTS THIS YET. Phase 1 defines the vocabulary; Phase 2
   moves the storage layer onto it. Adding this file changes no
   behaviour.
   ============================================================ */

/* ---- ids ---------------------------------------------------
   Opaque and stable. The prefix is a convenience for reading logs
   and database rows with the naked eye — nothing branches on it, so
   it can never become load-bearing.

   randomUUID needs a secure context (https or localhost). A file://
   preview or an old browser falls back; the fallback is not
   cryptographically strong and does not need to be. Ids identify,
   they do not authorise. */
export function newId(prefix = 'id') {
  let body;
  try {
    body = crypto.randomUUID();
  } catch (e) {
    body = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
  return `${prefix}_${body}`;
}

export function nowISO() { return new Date().toISOString(); }

/* Stamp a record on the way in. Creation sets both; every later write
   moves updatedAt only, so "when did this person last change anything"
   survives a sync, a merge and a restore from backup. */
export function stamp(record, { created = false } = {}) {
  const at = nowISO();
  return { ...record, createdAt: created ? at : (record.createdAt || at), updatedAt: at };
}

/* ============================================================
   USER
   ============================================================ */
/**
 * @typedef {Object} User
 * @property {string}  id
 * @property {'trainer'|'client'} role
 * @property {'pending'|'active'|'archived'} status
 *   pending  — intake submitted, no program written yet. The app opens
 *              on the teaser: their answers reflected back, and an
 *              honest "your program is being written". Never a fake workout.
 *   active   — has a program and can train.
 *   archived — kept for history, hidden from the roster.
 * @property {string}       displayName   what they are called. NEVER hardcoded in source — see note below.
 * @property {string|null}  email         null until they give one
 * @property {'pro'|'beginner'} ui        which of the two UIs they get
 * @property {string|null}  programId     null while pending
 * @property {string|null}  trainerId     which trainer owns this client; null for a trainer
 * @property {string|null}  accent        hex colour for their theme
 * @property {string}       createdAt     ISO
 * @property {string}       updatedAt     ISO
 *
 * PRIVACY: this repo is public. A real person's name, email or notes
 * must never appear in a source file — they live in records only.
 * js/users.js currently hardcodes two people; replacing that with
 * records is the point of Phase 2d.
 */

export function makeUser(partial = {}) {
  return stamp({
    id: partial.id || newId('usr'),
    role: partial.role || 'client',
    status: partial.status || 'pending',
    displayName: partial.displayName || '',
    email: partial.email ?? null,
    ui: partial.ui || 'beginner',
    programId: partial.programId ?? null,
    trainerId: partial.trainerId ?? null,
    accent: partial.accent ?? null,
  }, { created: true });
}

/* ============================================================
   INTAKE — one completed survey.
   ============================================================ */
/**
 * @typedef {Object} Intake
 * @property {string}  id
 * @property {string}  userId          the User this created or belongs to
 * @property {number}  version         onboarding.html payload version (`v`, currently 6)
 * @property {Object}  answers         the survey's answer bag, verbatim — see docs/AUDIT.md §6.1
 * @property {Object}  derived         levels / patterns the survey computed from the answers
 * @property {string}  submittedAt     ISO — when they pressed Finish
 * @property {string}  createdAt
 * @property {string}  updatedAt
 *
 * `answers` is stored verbatim and never edited in place. If a later
 * survey version renames a field, that is a new Intake at a new
 * version, not a mutation of this one — the record of what somebody
 * actually said has to stay true.
 *
 * HEALTH DATA. `answers.parq` is medical screening and `answers.pain`
 * is a body map of current injuries. This is the most sensitive thing
 * the product holds and it is the reason row-level security is not
 * optional — see docs/BACKEND.md.
 */

export function makeIntake(partial = {}) {
  return stamp({
    id: partial.id || newId('itk'),
    userId: partial.userId,
    version: partial.version ?? 6,
    answers: partial.answers || {},
    derived: partial.derived || {},
    submittedAt: partial.submittedAt || nowISO(),
  }, { created: true });
}

/* ============================================================
   PROGRAM — what a trainer writes for one person.
   ============================================================ */
/**
 * @typedef {Object} Program
 * @property {string}   id
 * @property {string|null} ownerId    the trainer who wrote it; null for a built-in
 * @property {string|null} assignedTo the client it was written for; null for a template
 * @property {string}   name
 * @property {'draft'|'assigned'|'archived'} status
 * @property {ProgramDay[]} days      the week, in order
 * @property {Object}   profile       training profile — benchmarks, starting loads
 * @property {string}   createdAt
 * @property {string}   updatedAt
 *
 * @typedef {Object} ProgramDay
 * @property {string}  id             stable id, NOT the position in the array
 * @property {number}  weekday        0=Sunday … 6=Saturday
 * @property {string}  sessionId      the Session to run
 * @property {string|null} label
 *
 * Programs are DATA. js/data/program.js is a source module today, which
 * is why writing a different program per client means editing code and
 * redeploying (docs/AUDIT.md §3.2).
 */

export function makeProgram(partial = {}) {
  return stamp({
    id: partial.id || newId('prg'),
    ownerId: partial.ownerId ?? null,
    assignedTo: partial.assignedTo ?? null,
    name: partial.name || 'Untitled program',
    status: partial.status || 'draft',
    days: partial.days || [],
    profile: partial.profile || {},
  }, { created: true });
}

/* ============================================================
   SESSION — one workout as PRESCRIBED (not as performed).
   ============================================================ */
/**
 * @typedef {Object} Session
 * @property {string}  id             stable and real — see the note below
 * @property {string|null} programId
 * @property {string}  name
 * @property {string|null} pattern    'push' | 'pull' | 'legs' | 'core' | 'conditioning' | …
 * @property {SessionBlock[]} blocks
 * @property {string}  createdAt
 * @property {string}  updatedAt
 *
 * @typedef {Object} SessionBlock
 * @property {string}  id
 * @property {string}  name
 * @property {string|null} format     'straight' | 'emom' | 'amrap' | 'circuit' | …
 * @property {SessionItem[]} items
 *
 * @typedef {Object} SessionItem
 * @property {string}  exId           CANONICAL exercise id — see CANONICAL IDS below
 * @property {number|null} sets
 * @property {number|null} reps
 * @property {number|null} holdSec
 * @property {number|null} restSec
 * @property {'reps'|'hold'|'cals'} measure
 * @property {boolean} noPR           warm-up / mobility — never counts as a record
 *
 * WHY SESSION IDS MATTER MORE THAN THEY LOOK:
 * the store keys five different maps by session id — swaps, removed,
 * order, added, blockSkips (docs/AUDIT.md §3.1). Those work today only
 * because sessions are compiled in and their ids never move. The moment
 * a trainer authors a program per client, an id that is really a
 * position ("day3") collides across clients and one person's swaps land
 * on another person's workout. Session ids must be generated, not
 * derived from position or name.
 */

export function makeSession(partial = {}) {
  return stamp({
    id: partial.id || newId('ses'),
    programId: partial.programId ?? null,
    name: partial.name || 'Untitled session',
    pattern: partial.pattern ?? null,
    blocks: partial.blocks || [],
  }, { created: true });
}

/* ============================================================
   LOG ENTRY — one workout as PERFORMED. The irreplaceable record.
   ============================================================ */
/**
 * @typedef {Object} LogEntry
 * @property {string}  id
 * @property {string}  userId
 * @property {string|null} sessionId  what they were following, if anything
 * @property {string}  date           LOCAL 'YYYY-MM-DD' — never UTC, so a 9pm
 *                                    workout does not land on tomorrow
 * @property {string}  name
 * @property {LoggedBlock[]} blocks
 * @property {number|null} durationSec
 * @property {string}  createdAt
 * @property {string}  updatedAt
 *
 * @typedef {Object} LoggedBlock
 * @property {string}  name
 * @property {LoggedEntry[]} entries
 *
 * @typedef {Object} LoggedEntry
 * @property {string}  exId
 * @property {string}  name
 * @property {'reps'|'hold'|'cals'} measure
 * @property {string}  unit
 * @property {'bw'|'weighted'|'assisted'} load
 * @property {number|null} rounds     set for circuit/interval work; those are
 *                                    not a per-exercise best, so they never set a PR
 * @property {boolean} noPR
 * @property {LoggedSet[]} sets
 *
 * @typedef {Object} LoggedSet
 * @property {number|string} value
 * @property {'L'|'R'|null}  side
 * @property {number|null}   weight
 *
 * This shape deliberately matches what store.saveSession already writes
 * (docs/AUDIT.md §3.1), plus the ids a server needs. Logs and records
 * are the only data in the product that cannot be regenerated if lost,
 * so the migration path for them must be additive and never destructive.
 */

export function makeLogEntry(partial = {}) {
  return stamp({
    id: partial.id || newId('log'),
    userId: partial.userId,
    sessionId: partial.sessionId ?? null,
    date: partial.date,
    name: partial.name || '',
    blocks: partial.blocks || [],
    durationSec: partial.durationSec ?? null,
  }, { created: true });
}

/* ============================================================
   MESSAGE — trainer ↔ client. Not built yet; shaped now so that
   building it later is not a schema change.
   ============================================================ */
/**
 * @typedef {Object} Message
 * @property {string}  id
 * @property {string}  fromUserId
 * @property {string}  toUserId
 * @property {string}  body
 * @property {string|null} contextType  'session' | 'log' | 'program' | null
 * @property {string|null} contextId    lets a message hang off a specific workout
 * @property {string|null} readAt       ISO, or null while unread
 * @property {string}  createdAt
 * @property {string}  updatedAt
 */

export function makeMessage(partial = {}) {
  return stamp({
    id: partial.id || newId('msg'),
    fromUserId: partial.fromUserId,
    toUserId: partial.toUserId,
    body: partial.body || '',
    contextType: partial.contextType ?? null,
    contextId: partial.contextId ?? null,
    readAt: partial.readAt ?? null,
  }, { created: true });
}

/* ============================================================
   CANONICAL EXERCISE IDS

   Decided in Phase 1: the canonical id space is the app's snake_case
   ids from js/data/exercises.js.

   Not a style preference. Logged sessions and personal records on real
   devices are keyed by these ids — sessions[].blocks[].entries[].exId
   and prs{exId}. Renaming them orphans every workout anyone has ever
   logged. Renaming the survey's 22 deck ids costs some string edits in
   a file whose stored output is currently read by nothing. The risk
   runs one way, so the decision does too.

   Below: the survey deck's ids mapped onto canonical ones.
   `null` means the movement has no library entry yet and one must be
   added before the deck can use a canonical id for it.

   Nothing imports this map yet. It is the record of the decision and
   the work order for the survey rewrite.
   ============================================================ */
export const DECK_TO_CANONICAL = {
  /* ---- exact, already in js/data/exercises.js ---- */
  pushup:    'pushup',
  pullup:    'pullup',
  hang:      'dead_hang',
  dead:      'deadlift',
  rdl:       'romanian_deadlift',
  slrdl:     'single_leg_rdl',
  thrust:    'hip_thrust',
  jumpsquat: 'jump_squat',
  pike:      'pike_push_up',
  mtnclimb:  'mountain_climber',

  /* ---- the survey asks a generic; the library holds only variants.
     One variant has to be named as the benchmark. These three are
     judgement calls, not lookups. ---- */
  invrow:    'wide_inverted_row',   // provisional — the nearest existing entry
  row:       null,                  // 10 row variants, no plain "Row"
  plank:     null,                  // 20 plank variants, no plain "Plank"

  /* ---- the survey names the same movement twice, in two decks.
     Collapsing them is a fix, not a loss: today a person who saw both
     decks would produce two records for one exercise. ---- */
  lunge:     'bulgarian_split',
  split:     'bulgarian_split',

  /* ---- no library entry at all. Mostly barbell — the library was
     built calisthenics-first. Each needs an entry written before the
     deck can reference it. ---- */
  squat:     null,   // Back squat
  bench:     null,   // Bench press
  ohp:       null,   // Overhead press
  carry:     null,   // Farmer carry
  kbswing:   null,   // Kettlebell swing — db_swing is a DUMBBELL swing, a different movement
  bwsquat:   null,   // Bodyweight squat
  wallsit:   null,   // Wall sit — horse_stance is close but is not the same exercise
};

/** Deck ids still waiting on a canonical exercise. */
export function unmappedDeckIds() {
  return Object.keys(DECK_TO_CANONICAL).filter(k => DECK_TO_CANONICAL[k] === null);
}

/* ============================================================
   VALIDATORS

   Cheap and strict. They exist to refuse a malformed record BEFORE it
   is written, because a bad record that reaches storage is a bad record
   that syncs, and one that syncs is one that has to be cleaned up in
   two places.

   Every validator returns { ok, errors } — never throws, never
   console.logs. The caller decides how loud to be.
   ============================================================ */

function base(rec, kind, errors) {
  if (!rec || typeof rec !== 'object') { errors.push(`${kind}: not an object`); return false; }
  if (typeof rec.id !== 'string' || !rec.id) errors.push(`${kind}.id must be a non-empty string`);
  for (const f of ['createdAt', 'updatedAt']) {
    if (typeof rec[f] !== 'string' || Number.isNaN(Date.parse(rec[f]))) {
      errors.push(`${kind}.${f} must be an ISO date string`);
    }
  }
  /* undefined survives a structuredClone but vanishes through JSON, so a
     record carrying it means one thing on this device and another on the
     server. Absent must be spelled null. */
  for (const [k, v] of Object.entries(rec)) {
    if (v === undefined) errors.push(`${kind}.${k} is undefined — use null`);
    if (typeof v === 'function') errors.push(`${kind}.${k} is a function — records must be plain JSON`);
  }
  return true;
}

const oneOf = (v, allowed, path, errors) => {
  if (!allowed.includes(v)) errors.push(`${path} must be one of ${allowed.join(' | ')} (got ${JSON.stringify(v)})`);
};
const str = (v, path, errors, { allowEmpty = true } = {}) => {
  if (typeof v !== 'string') errors.push(`${path} must be a string`);
  else if (!allowEmpty && !v) errors.push(`${path} must not be empty`);
};
const strOrNull = (v, path, errors) => {
  if (v !== null && typeof v !== 'string') errors.push(`${path} must be a string or null`);
};

export function validateUser(u) {
  const errors = [];
  if (base(u, 'User', errors)) {
    oneOf(u.role, ['trainer', 'client'], 'User.role', errors);
    oneOf(u.status, ['pending', 'active', 'archived'], 'User.status', errors);
    oneOf(u.ui, ['pro', 'beginner'], 'User.ui', errors);
    str(u.displayName, 'User.displayName', errors);
    strOrNull(u.email, 'User.email', errors);
    strOrNull(u.programId, 'User.programId', errors);
    strOrNull(u.trainerId, 'User.trainerId', errors);
    /* An active user with no program would render the full UI over an
       empty week — the exact "pretends to be a workout" state the
       pending teaser exists to avoid. */
    if (u.status === 'active' && !u.programId) errors.push('User.status is active but programId is null');
  }
  return { ok: errors.length === 0, errors };
}

export function validateIntake(i) {
  const errors = [];
  if (base(i, 'Intake', errors)) {
    str(i.userId, 'Intake.userId', errors, { allowEmpty: false });
    if (!Number.isInteger(i.version)) errors.push('Intake.version must be an integer');
    if (!i.answers || typeof i.answers !== 'object') errors.push('Intake.answers must be an object');
    if (!i.derived || typeof i.derived !== 'object') errors.push('Intake.derived must be an object');
    str(i.submittedAt, 'Intake.submittedAt', errors, { allowEmpty: false });
  }
  return { ok: errors.length === 0, errors };
}

export function validateProgram(p) {
  const errors = [];
  if (base(p, 'Program', errors)) {
    oneOf(p.status, ['draft', 'assigned', 'archived'], 'Program.status', errors);
    str(p.name, 'Program.name', errors, { allowEmpty: false });
    strOrNull(p.ownerId, 'Program.ownerId', errors);
    strOrNull(p.assignedTo, 'Program.assignedTo', errors);
    if (!Array.isArray(p.days)) errors.push('Program.days must be an array');
    else p.days.forEach((d, n) => {
      str(d?.id, `Program.days[${n}].id`, errors, { allowEmpty: false });
      str(d?.sessionId, `Program.days[${n}].sessionId`, errors, { allowEmpty: false });
      if (!Number.isInteger(d?.weekday) || d.weekday < 0 || d.weekday > 6) {
        errors.push(`Program.days[${n}].weekday must be 0–6`);
      }
    });
    if (p.status === 'assigned' && !p.assignedTo) errors.push('Program.status is assigned but assignedTo is null');
  }
  return { ok: errors.length === 0, errors };
}

export function validateSession(s) {
  const errors = [];
  if (base(s, 'Session', errors)) {
    str(s.name, 'Session.name', errors, { allowEmpty: false });
    strOrNull(s.programId, 'Session.programId', errors);
    if (!Array.isArray(s.blocks)) errors.push('Session.blocks must be an array');
    else s.blocks.forEach((b, n) => {
      str(b?.id, `Session.blocks[${n}].id`, errors, { allowEmpty: false });
      if (!Array.isArray(b?.items)) errors.push(`Session.blocks[${n}].items must be an array`);
      else b.items.forEach((it, m) => str(it?.exId, `Session.blocks[${n}].items[${m}].exId`, errors, { allowEmpty: false }));
    });
  }
  return { ok: errors.length === 0, errors };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateLogEntry(l) {
  const errors = [];
  if (base(l, 'LogEntry', errors)) {
    str(l.userId, 'LogEntry.userId', errors, { allowEmpty: false });
    strOrNull(l.sessionId, 'LogEntry.sessionId', errors);
    /* A local YYYY-MM-DD, not an ISO instant. Storing an instant here is
       how a 9pm workout ends up logged on tomorrow's date. */
    if (typeof l.date !== 'string' || !DATE_RE.test(l.date)) errors.push('LogEntry.date must be local YYYY-MM-DD');
    if (!Array.isArray(l.blocks)) errors.push('LogEntry.blocks must be an array');
    else l.blocks.forEach((b, n) => {
      if (!Array.isArray(b?.entries)) { errors.push(`LogEntry.blocks[${n}].entries must be an array`); return; }
      b.entries.forEach((e, m) => {
        const p = `LogEntry.blocks[${n}].entries[${m}]`;
        str(e?.exId, `${p}.exId`, errors, { allowEmpty: false });
        if (!Array.isArray(e?.sets)) errors.push(`${p}.sets must be an array`);
      });
    });
  }
  return { ok: errors.length === 0, errors };
}

export function validateMessage(m) {
  const errors = [];
  if (base(m, 'Message', errors)) {
    str(m.fromUserId, 'Message.fromUserId', errors, { allowEmpty: false });
    str(m.toUserId, 'Message.toUserId', errors, { allowEmpty: false });
    str(m.body, 'Message.body', errors, { allowEmpty: false });
    strOrNull(m.contextType, 'Message.contextType', errors);
    strOrNull(m.contextId, 'Message.contextId', errors);
    strOrNull(m.readAt, 'Message.readAt', errors);
  }
  return { ok: errors.length === 0, errors };
}

export const VALIDATORS = {
  User: validateUser,
  Intake: validateIntake,
  Program: validateProgram,
  Session: validateSession,
  LogEntry: validateLogEntry,
  Message: validateMessage,
};
