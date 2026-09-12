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

     supabase/03-verify-rls.sql must print 11 lines and every one of
     them must say PASS. Until it does, these stay null.

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
  /** e.g. 'https://abcdefgh.supabase.co' — null means device-only. */
  url: null,

  /** The anon / publishable key. Null means device-only. */
  anonKey: null,

  /** Where a magic link comes back to. Null means wherever the app is
   *  being served from, which is right in every case except a local
   *  file. */
  redirectTo: null,
};

/** True when there is something to sync to. Every caller asks this
 *  rather than testing the two fields, so adding a third condition
 *  later is one edit and not a hunt. */
export function backendConfigured() {
  return Boolean(BACKEND.url && BACKEND.anonKey);
}
