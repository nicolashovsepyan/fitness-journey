/* ============================================================
   USERS — multi-user support.

   The app used to write to two fixed localStorage keys, so it could
   only ever hold one person's training. Everything is now namespaced
   by user id:
       fj.v1.<uid>    logs, PRs, swaps, habits, notes, flags
       fj.run.<uid>   the live workout (survives reload)
       fj.user        who is active right now

   Nicolas's existing data lives under the legacy un-suffixed keys.
   migrate() moves it to 'nico' once, on first load, and leaves a
   marker so it never runs twice. Nothing is deleted.
   ============================================================ */
import { PROFILE, BEGINNER_PROFILE, PROGRAMS } from './data/program.js';

const ACTIVE_KEY = 'fj.user';
const MIGRATED_KEY = 'fj.migrated.v2';

/* ── The people this app serves ──────────────────────────────
   To rename the second user, change `name` (and `short`) here.
   Nothing else references the display name.                   */
export const USERS = {
  nico: {
    id: 'nico',
    name: 'Nicolas',
    short: 'N',
    ui: 'pro',                       // the full week/day/work-mode UI
    programId: 'main',
    profile: PROFILE,
    accent: '#c8ff4d',
  },
  partner: {
    id: 'partner',
    // Deliberately generic: this repo is public, so no real name lives in the
    // source. The actual name arrives once via ?name= in the invite link and
    // is kept in localStorage on that person's own device. See displayName().
    name: 'Training Partner',
    short: 'T',
    ui: 'beginner',                  // the simplified, habit-first UI
    programId: 'beginner_return',
    profile: BEGINNER_PROFILE,
    accent: '#7cb3ff',
  },
};

export const DEFAULT_USER = 'nico';

/* ── active user ─────────────────────────────────────────── */
let active = null;

/* Has this device been told who it belongs to? If not we must ASK — never
   guess. Guessing is what put Nicolas's program on a phone that had just
   installed Sevan's link: iOS gives an installed app a storage container
   separate from Safari's, so the choice made in the browser is not there
   when the installed app first launches, and a silent default takes over. */
export function isClaimed() {
  try {
    if (localStorage.getItem(ACTIVE_KEY)) return true;
    const q = new URLSearchParams(location.search).get('user');
    return !!(q && USERS[q]);
  } catch (e) { return false; }
}

export function claimDevice(id, name) {
  if (!USERS[id]) return false;
  try { localStorage.setItem(ACTIVE_KEY, id); } catch (e) {}
  if (name) setDisplayName(id, name);
  active = id;
  return true;
}

export function activeUserId() {
  if (active) return active;
  let id = null;
  /* ?user=… is an explicit instruction and always wins. Profiles are stored
     under separate keys (fj.v1.<uid>), so switching never destroys anyone's
     training — it only changes which profile is showing. Making it
     authoritative (rather than first-open-only) means re-opening the invite
     link repairs a device that ended up on the wrong profile. */
  try {
    const p = new URLSearchParams(location.search);
    const q = p.get('user');
    if (q && USERS[q]) {
      localStorage.setItem(ACTIVE_KEY, q);
      id = q;
      const n = p.get('name');
      if (n) setDisplayName(q, n);        // the invite link carries the name
    }
  } catch (e) {}
  try { id = id || localStorage.getItem(ACTIVE_KEY); } catch (e) {}
  active = (id && USERS[id]) ? id : DEFAULT_USER;
  return active;
}
/* ---- display name ----------------------------------------
   Stored per user on the device, never in the source. An invite link may
   carry ?name=... to set it once; after that the stored value wins, so a
   re-shared link can't rename someone who has already been set up.      */
const NAME_KEY = uid => `fj.name.${uid}`;

export function setDisplayName(uid, name) {
  try { localStorage.setItem(NAME_KEY(uid), String(name).slice(0, 60)); } catch (e) {}
}
export function displayName(uid = activeUserId()) {
  try {
    const custom = localStorage.getItem(NAME_KEY(uid));
    if (custom) return custom;
  } catch (e) {}
  return USERS[uid]?.name || '';
}

export function activeUser() {
  const u = USERS[activeUserId()];
  return { ...u, name: displayName(u.id) };
}
export function currentProfile() { return activeUser().profile; }
export function currentProgram() { return PROGRAMS[activeUser().programId] || PROGRAMS.main; }
export function isBeginner() { return activeUser().ui === 'beginner'; }

/* Switching users swaps every storage namespace at once, so the cleanest
   and safest thing is a full reload — no stale module state survives. */
export function switchUser(id) {
  if (!USERS[id]) return false;
  try { localStorage.setItem(ACTIVE_KEY, id); } catch (e) {}
  active = id;
  try { location.reload(); } catch (e) {}
  return true;
}

/* namespaced storage keys — used by store.js and runstate.js */
export function storeKey(uid) { return `fj.v1.${uid || activeUserId()}`; }
export function runKey(uid) { return `fj.run.${uid || activeUserId()}`; }

/* ── one-time migration of the legacy single-user keys ────── */
export function migrate() {
  try {
    if (localStorage.getItem(MIGRATED_KEY)) return;
    const legacyStore = localStorage.getItem('fj.v1');
    if (legacyStore && !localStorage.getItem(storeKey('nico'))) {
      localStorage.setItem(storeKey('nico'), legacyStore);
    }
    const legacyRun = localStorage.getItem('fj.run');
    if (legacyRun && !localStorage.getItem(runKey('nico'))) {
      localStorage.setItem(runKey('nico'), legacyRun);
    }
    localStorage.setItem(MIGRATED_KEY, new Date().toISOString());
    // legacy keys are intentionally left in place as a safety copy
  } catch (e) { console.warn('user migration skipped', e); }
}

migrate();
