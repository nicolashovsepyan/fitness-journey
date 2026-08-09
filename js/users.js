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
    /* First run on this device — or an upgrade from the version where
       these two were compile-time constants. Same ids, so their
       existing training under fj.v1.nico is picked up untouched. */
    for (const seed of Object.values(SEED)) list.push(await s.saveUser(seed));
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
