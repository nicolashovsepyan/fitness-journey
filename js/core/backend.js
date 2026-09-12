/* ============================================================
   THE CLOUD, AS THE REST OF THE APP SEES IT.

   Three surfaces need the database and none of them should have to
   know how to build one: the survey pushes a finished intake, the
   console pulls its clients, the app syncs training. This is the one
   place that assembles a client, and the one place that decides there
   is no backend and says so calmly.

   EVERY FUNCTION HERE IS SAFE TO CALL WITH NO BACKEND CONFIGURED.
   None of them throws for that reason; they answer `{ ok: false }`
   with a reason a human can read. A survey must finish whether or not
   the internet exists, and a console must open.

   WHY ONE SHARED CLIENT. The session lives in it. Two clients on one
   page would each sign in separately and the second would overwrite
   the first, which is how one person quietly becomes two.

   WHAT THIS IS NOT: a sync engine. Nothing here runs in the
   background, retries, or resolves a conflict. It is the plumbing the
   surfaces call deliberately, at moments a person can see.
   ============================================================ */
import { BACKEND, backendConfigured } from '../config.js';
import { Supabase, localSessionStore, SupabaseError } from '../adapters/supabase-rest.js';
import { SupabaseAdapter } from '../adapters/supabase.js';
import { LocalAdapter } from '../adapters/local.js';

let _client = null;
let _adapter = null;

/** The shared client, or null when js/config.js names no backend. */
export function cloud() {
  if (!backendConfigured()) return null;
  if (!_client) {
    _client = new Supabase({
      url: BACKEND.url,
      anonKey: BACKEND.anonKey,
      sessionStore: localSessionStore(),
    });
    // A magic link lands with the session in the fragment. Picking it up
    // here means every page that imports this file can be returned to.
    try { _client.adoptSessionFromUrl(); } catch { /* not a browser */ }
  }
  return _client;
}

/** The storage contract over that client. */
export function cloudAdapter() {
  const c = cloud();
  if (!c) return null;
  if (!_adapter) _adapter = new SupabaseAdapter({ client: c, device: new LocalAdapter() });
  return _adapter;
}

/** Who we are to the server, without asking it. Null when signed out. */
export function cloudUserId() { return cloud()?.userId ?? null; }

/** Sign in if we are not already, the way the survey does: no email, no
 *  password, a real id from the first second. See docs/BACKEND.md for
 *  why this and not a magic link. */
export async function cloudSignIn() {
  const c = cloud();
  if (!c) return { ok: false, reason: 'no backend configured' };
  if (c.userId) return { ok: true, uid: c.userId, existing: true };
  try {
    await c.signInAnonymously();
    return { ok: true, uid: c.userId, existing: false };
  } catch (e) {
    return { ok: false, reason: readable(e) };
  }
}

/** Attach an email to the identity we already have, so it can be got
 *  back on another device. THE ID DOES NOT CHANGE, which is the whole
 *  point — everything already written stays pointing at the same
 *  person. Supabase sends a confirmation link; until it is clicked the
 *  identity carries on working exactly as it did. */
export async function cloudAttachEmail(email) {
  const c = cloud();
  if (!c) return { ok: false, reason: 'no backend configured' };
  if (!c.userId) return { ok: false, reason: 'nobody is signed in yet' };
  try {
    await c.linkEmail(email);
    return { ok: true, sent: true };
  } catch (e) {
    return { ok: false, reason: readable(e) };
  }
}

/** Come back on a new device, as the person that email belongs to. */
export async function cloudSendLink(email) {
  const c = cloud();
  if (!c) return { ok: false, reason: 'no backend configured' };
  try {
    await c.signInWithOtp(email, {
      redirectTo: BACKEND.redirectTo || (globalThis.location?.href.split('#')[0] ?? null),
      shouldCreateUser: false,
    });
    return { ok: true, sent: true };
  } catch (e) {
    return { ok: false, reason: readable(e) };
  }
}

/** Make sure the signed-in identity has a row in public.users.
 *
 *  SIGNING IN IS NOT THE SAME AS EXISTING, and the difference is a
 *  foreign key. Supabase issues an auth identity; public.users is our
 *  table and starts empty. A client whose trainer_id points at a coach
 *  who never wrote their own row is rejected outright - the survey
 *  fails with "violates foreign key constraint users_trainer_fk", at
 *  the moment somebody has just finished answering a PAR-Q.
 *
 *  So the console introduces itself the first time it opens. It is
 *  cheap, it is idempotent, and it has to happen before any client can
 *  be pointed at this coach.
 *
 *  @returns {Promise<{ok:boolean, uid?:string, reason?:string}>} */
export async function ensureSelf({ role = 'client', displayName = '', client = null } = {}) {
  const signed = client ? await signInWith(client) : await cloudSignIn();
  if (!signed.ok) return signed;
  const a = client ? new SupabaseAdapter({ client, device: new LocalAdapter() }) : cloudAdapter();
  try {
    const existing = await a.getUser(signed.uid);
    if (existing) return { ok: true, uid: signed.uid, existing: true };
    const now = new Date().toISOString();
    await a.saveUser({
      id: signed.uid, role, status: role === 'trainer' ? 'active' : 'pending',
      displayName, email: null, ui: 'pro', programId: null, trainerId: null,
      accent: null, createdAt: now, updatedAt: now,
    });
    return { ok: true, uid: signed.uid, existing: false };
  } catch (e) {
    return { ok: false, reason: readable(e) };
  }
}

/* ============================================================
   THE SURVEY SIDE.
   ============================================================ */

/** Push a finished survey to the database, as its own owner.
 *
 *  WHAT MAKES THIS WORK AT ALL: it signs in first, so the intake is
 *  written by the person it is about. Row level security would refuse
 *  it any other way, and rightly — an intake with no owner is a PAR-Q
 *  belonging to nobody.
 *
 *  trainerId comes from config rather than from the answers. A client
 *  cannot see a coach they have not been given to, so somebody has to
 *  say which coach, and the survey is published by that coach.
 *
 *  @returns {Promise<{ok:boolean, uid?:string, reason?:string}>}
 */
export async function publishIntake({ answers = {}, version = 6, at = null } = {},
                                    { client = null, trainerId = undefined } = {}) {
  /* `client` is here so a test can be two people at once. The survey
     and the console run in different browsers in real life, which is
     the whole point of the feature; a test in one process has to be
     able to say which of them it is being. Left out, everything uses
     the one shared client, which is what every real caller wants. */
  let signed = client ? await signInWith(client) : await cloudSignIn();
  if (!signed.ok) return signed;

  const c = client || cloud();
  let a = client ? new SupabaseAdapter({ client, device: new LocalAdapter() }) : cloudAdapter();

  /* A COACH FILLING IN THEIR OWN SURVEY MUST NOT STOP BEING THE COACH.
     The console and the survey are the same origin, so on one computer
     they share a session and therefore an identity. Writing this
     intake would then turn the coach row into a client row, pointed at
     itself, and every client in the database would be left hanging off
     an id that is no longer a trainer.

     So if this identity is already a coach, the survey takes a new
     one. That is the truthful answer anyway: the person answering is a
     client, and a client is somebody else. */
  try {
    const existing = await a.getUser(signed.uid);
    if (existing && existing.role === 'trainer') {
      await c.signOut();
      await c.signInAnonymously();
      signed = { ok: true, uid: c.userId };
      a = client ? new SupabaseAdapter({ client, device: new LocalAdapter() }) : cloudAdapter();
    }
  } catch { /* cannot read it, carry on and let the write decide */ }

  const uid = signed.uid;
  const when = at || new Date().toISOString();

  try {
    await a.saveUser({
      id: uid,
      role: 'client',
      status: 'pending',
      displayName: String(answers.name || '').trim(),
      email: String(answers.email || '').trim() || null,
      ui: (typeof answers.tier === 'number' && answers.tier >= 2) ? 'pro' : 'beginner',
      programId: null,
      trainerId: trainerId !== undefined ? trainerId : (BACKEND.coachId || null),
      accent: null,
      createdAt: when,
      updatedAt: when,
    });
    await a.saveIntake({
      userId: uid,
      version,
      answers,
      derived: { tier: answers.tier ?? null, levels: answers.levels ?? null },
      submittedAt: when,
    });
    return { ok: true, uid };
  } catch (e) {
    return { ok: false, reason: readable(e) };
  }
}

/* ============================================================
   THE CONSOLE SIDE.
   ============================================================ */

/** Everybody this coach can see, and their latest intake.
 *
 *  Sends no filter and trusts the database, which is the honest thing:
 *  the policies already limit this to the signed-in person plus the
 *  clients whose trainer_id is them. A filter here would be a second,
 *  weaker copy of a rule enforced where it cannot be bypassed.
 *
 *  @returns {Promise<{ok:boolean, clients?:Array, reason?:string}>}
 */
export async function pullClients({ client = null } = {}) {
  // A coach who has never written their own row cannot be pointed at.
  const signed = await ensureSelf({ role: 'trainer', displayName: 'Coach', client });
  if (!signed.ok) return signed;

  const a = client ? new SupabaseAdapter({ client, device: new LocalAdapter() }) : cloudAdapter();
  try {
    const [users, intakes] = await Promise.all([a.listUsers(), a.listIntakes()]);
    const me = signed.uid;
    const latest = new Map();
    for (const i of intakes) {                  // newest first, by the query
      if (!latest.has(i.userId)) latest.set(i.userId, i);
    }
    const clients = users
      .filter(u => u.id !== me)                 // the coach is not their own client
      .map(u => ({ user: u, intake: latest.get(u.id) || null }));
    return { ok: true, me, clients };
  } catch (e) {
    return { ok: false, reason: readable(e) };
  }
}

async function signInWith(c) {
  if (c.userId) return { ok: true, uid: c.userId, existing: true };
  try { await c.signInAnonymously(); return { ok: true, uid: c.userId, existing: false }; }
  catch (e) { return { ok: false, reason: readable(e) }; }
}

/* An error a person can act on. A SupabaseError carries a status that
   separates "your wifi" from "the server said no", and those two want
   completely different sentences. */
function readable(e) {
  if (e instanceof SupabaseError) {
    if (e.isOffline) return 'No connection to the database.';
    if (e.status === 422 || /anonymous/i.test(e.message)) {
      return 'Anonymous sign-in is off for this project. '
        + 'Authentication -> Sign In / Providers -> Allow anonymous sign-ins.';
    }
    return `${e.message}${e.hint ? ` (${e.hint})` : ''}`;
  }
  return e?.message || String(e);
}
