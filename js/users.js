/* ============================================================
   USERS — who this device belongs to.

   PHASE 2d: people are RECORDS now, not a constant in this file.

   They used to be a hardcoded pair, which meant onboarding a real
   client was a source edit and a redeploy. The two originals are still
   described below, but only as SEEDS: they are written into storage the
   first time the app runs and read back from there afterwards. Anyone
   the survey creates arrives the same way and is indistinguishable.

   Storage keys are unchanged:
       fj.user        who is active on this device
       fj.name.<uid>  their display name
       fj.v1.<uid>    their training
       fj.run.<uid>   the workout in progress

   IDENTITY RESOLVES ONCE, AT BOOT. Every read and write in the app
   needs to know whose data it is, so if that answer were async then
   everything downstream would be too. loadUsers() is awaited once and
   the answer is held here; the rest of the app asks synchronously.
   ============================================================ */
import { PROFILE, BEGINNER_PROFILE, PROGRAMS } from './data/program.js';
import { storage } from './core/storage.js';

/* ── The two people this app started with ────────────────────
   Seeds, not the source of truth. To rename someone, the app writes a
   record — this file is never edited again. Deliberately generic here:
   the repo is public, so no real name lives in source. The actual name
   arrives via ?name= on the invite link and is kept on that person's
   own device. */
const SEED = {
  nico: {
    id: 'nico', role: 'client', status: 'active',
    displayName: 'Nicolas', short: 'N',
    ui: 'pro', programId: 'main', accent: '#c8ff4d',
  },
  partner: {
    id: 'partner', role: 'client', status: 'active',
    displayName: 'Training Partner', short: 'T',
    ui: 'beginner', programId: 'beginner_return', accent: '#7cb3ff',
  },
};

/* Training profiles still live in code — they are program data, not
   person data, and they move to records when programs do (Phase 4). */
const PROFILE_FOR = { main: PROFILE, beginner_return: BEGINNER_PROFILE };

/* Has this device ever held anything for that person? Their training,
   their display name, or a workout they left running. Any one of the
   three is evidence; none of them is an empty device. */
async function deviceKnows(s, id) {
  try {
    if (await s.getDisplayName(id)) return true;
  } catch (e) {}
  try {
    for (const k of [`fj.v1.${id}`, `fj.v1.${id}.hist`, `fj.run.${id}`, `fj.name.${id}`])
      if (localStorage.getItem(k) != null) return true;
  } catch (e) {}
  return false;
}

let users = {};        // id -> record, loaded at boot
let active = null;     // resolved once, at boot
let ready = false;

/* ── boot ─────────────────────────────────────────────────────
   Awaited by app.js before anything reads. Everything after this point
   is synchronous on purpose. */
export async function loadUsers() {
  const s = storage();
  await s.init();                       // legacy key move, once

  let list = await s.listUsers();
  if (!list.length) {
    /* SEEDS ARE AN UPGRADE PATH, NOT A WELCOME MAT.

       These two were compile-time constants once, and writing them on an
       empty device is how a phone that already held training under
       fj.v1.nico keeps it. That is still worth doing — for a phone that
       has that training.

       On a phone that does not, it put two strangers on the first screen
       a new person ever sees and asked them to pick one. Nicolas filled
       the survey as Nick, installed the app, and was offered "Nicolas"
       and "Training Partner" — neither of them him, both with programs
       he had never been given. The claim screen was doing exactly what it
       was told; it was told the wrong thing.

       So: seed only where there is evidence the seed belongs. A device
       with none of their data starts empty, and the claim screen asks for
       a link instead of offering a stranger. */
    for (const seed of Object.values(SEED)) {
      if (await deviceKnows(s, seed.id)) list.push(await s.saveUser(seed));
    }
  }
  users = Object.fromEntries(list.map(u => [u.id, u]));

  /* ?user=… is an explicit instruction and always wins. Profiles are
     stored under separate keys, so switching never destroys anyone's
     training — it only changes which one is showing. Being
     authoritative rather than first-open-only means re-opening the
     invite link repairs a device that ended up on the wrong profile. */
  let id = null;
  try {
    const p = new URLSearchParams(location.search);
    const q = p.get('user');
    if (q && users[q]) {
      await s.setActiveUserId(q);
      id = q;
      const n = p.get('name');
      if (n) await s.setDisplayName(q, n);
    }
  } catch (e) {}

  if (!id) id = await s.getActiveUserId();
  active = (id && users[id]) ? id : null;   // null means ASK — never guess

  /* Display names live per device and override the record. */
  for (const u of Object.values(users)) {
    const custom = await s.getDisplayName(u.id);
    if (custom) u.displayName = custom;
  }
  ready = true;
  return active;
}

export function usersLoaded() { return ready; }

/* ── forget everyone on this device ──────────────────────────
   Removes the PEOPLE and the device's claim, and nothing else. Each
   person's training lives under its own key and is left alone: losing
   a name is a mistake you can recover from by pasting a link again,
   and losing a training log is not.

   After this the app has nobody, which is the state a freshly installed
   app is in — so it asks whose phone this is and offers the paste box,
   which is exactly the way back in. */
export async function forgetEveryone() {
  const s = storage();
  const ids = Object.keys(users);
  /* The adapter can save a user and read them back but has never been
     able to delete one — there was no caller until now. Written through
     the roster it does expose: an empty list IS no people. */
  try { await s.saveUsers?.([]); } catch (e) {}
  for (const id of ids) {
    try { localStorage.removeItem(`fj.name.${id}`); } catch (e) {}
  }
  try { await s.setActiveUserId(null); } catch (e) {}
  /* and the keys underneath, because an adapter that grew a cache would
     otherwise hand the same people back on the next read */
  try {
    localStorage.removeItem('fj.users');
    localStorage.removeItem('fj.user');
  } catch (e) {}
  users = {}; active = null;
}

/* ── who is here ─────────────────────────────────────────────
   Never guessed. A null active user means the claim screen runs —
   guessing is what once put one person's program on another's phone. */
export function isClaimed() { return active !== null; }
export function activeUserId() { return active; }

export function listUsers() { return Object.values(users); }
export const USERS = new Proxy({}, {          // legacy shape, still read by screens
  get: (_, k) => users[k],
  has: (_, k) => k in users,
  ownKeys: () => Object.keys(users),
  getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
});

export function activeUser() {
  const u = users[active];
  if (!u) return null;
  return { ...u, name: u.displayName, profile: PROFILE_FOR[u.programId] || PROFILE };
}
export function displayName(uid = active) { return users[uid]?.displayName || ''; }
export function currentProfile() { return activeUser()?.profile || PROFILE; }
export function currentProgram() { return PROGRAMS[activeUser()?.programId] || PROGRAMS.main; }
export function isBeginner() { return activeUser()?.ui === 'beginner'; }

/* ── changing who is here ────────────────────────────────────
   Both reload. Switching swaps every storage namespace at once, and a
   full reload is the cleanest way to be sure no stale module state
   survives it. */
export async function claimDevice(id, name) {
  if (!users[id]) return false;
  const s = storage();
  await s.setActiveUserId(id);
  if (name) { await s.setDisplayName(id, name); users[id].displayName = name; }
  active = id;
  return true;
}

export async function switchUser(id) {
  if (!users[id]) return false;
  await storage().setActiveUserId(id);
  active = id;
  try { location.reload(); } catch (e) {}
  return true;
}

/* Someone the survey just created. Written through the adapter like
   anyone else, so there is no such thing as a second-class user. */
export async function addUser(record) {
  const saved = await storage().saveUser(record);
  users[saved.id] = saved;
  return saved;
}

/* namespaced storage keys — kept for runstate.js */
export function storeKey(uid) { return `fj.v1.${uid || active}`; }
export function runKey(uid) { return `fj.run.${uid || active}`; }
