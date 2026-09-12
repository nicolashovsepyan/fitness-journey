/* ============================================================
   THE ONE PLACE A BACKEND IS NAMED.

   Nothing else in the app mentions Supabase, a URL or a key. Change
   these two lines and the whole app changes backend; leave them null
   and it runs exactly as it does today, entirely on the device.

   WHY THE KEY IS ALLOWED TO BE HERE AT ALL.

   This repository is public. A Supabase anon key is designed to be
   public — it identifies the project, it authorises nothing. Every
   table denies by default and only a signed-in session opens a row.

   That is true ONLY while row level security is on and correct. So:

     supabase/03-verify-rls.sql must print its checks and every one of
     them must say PASS. Until it does, these stay null.

   That happened on 2026-09-11, on project dmpxtzjlhccxisuofxhd. All
   twelve lines said PASS: a client cannot read another clients intake,
   user row or per-user document; a coach cannot read a client who is
   not theirs; and the key below, alone, reads nothing at all.

   That is not caution for its own sake. This database holds PAR-Q
   answers — heart conditions, medication, pregnancy — and injury maps
   for real people. With RLS off, a key in this file hands all of it to
   anyone who reads the page source.

   THE SERVICE ROLE KEY NEVER GOES IN THIS FILE, OR ANY FILE IN THIS
   REPOSITORY. It bypasses row level security completely. It belongs in
   an environment variable on a machine you control, and the only thing
   here that ever wants one is the conformance test, which reads it
   from the environment and refuses to run without it.
   ============================================================ */

export const BACKEND = {
  /** null means device-only. */
  url: 'https://dmpxtzjlhccxisuofxhd.supabase.co',

  /** The publishable key. Supabase renamed these: what the docs still
   *  call the anon key is now sb_publishable_..., and it means the same
   *  thing — it names the project and authorises nothing by itself.
   *
   *  Committed 2026-09-11, after the gate ran green on all twelve
   *  checks, three of which exist only to prove that THIS key, with no
   *  session behind it, reads no intakes, no people and no per-user
   *  documents. */
  anonKey: 'sb_publishable_E8asr1sjaGKyVeMhtG35EQ_5bvzQ2Qz',

  /** Where a magic link comes back to. Null means wherever the app is
   *  being served from, which is right in every case except a local
   *  file. */
  redirectTo: null,

  /** WHICH COACH A FINISHED SURVEY BELONGS TO.
   *
   *  A client cannot see a coach they have not been handed to — the
   *  policies work from trainer_id and nothing else — so somebody has
   *  to say which coach, and the survey is published by that coach.
   *  This is that answer.
   *
   *  It is a uuid, not a secret. The worst it allows is somebody
   *  pointing their own intake at this console, which shares THEIR
   *  answers with this coach and reveals nothing in the other
   *  direction.
   *
   *  Null means a finished survey still saves to the phone and still
   *  travels by link, it simply does not land in a console by itself. */
  coachId: null,
};

/** True when there is something to sync to. Every caller asks this
 *  rather than testing the two fields, so adding a third condition
 *  later is one edit and not a hunt. */
export function backendConfigured() {
  return Boolean(BACKEND.url && BACKEND.anonKey);
}
