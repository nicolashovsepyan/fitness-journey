/* ============================================================
   CARRIER — how records cross between devices while there is no backend.

   Two hand-offs exist, and they are the same problem in both directions:

       the survey  →  the app        a finished onboarding becomes a person
       the console →  the app        a released program becomes their week

   Neither can go through localStorage. The survey runs in Safari and the
   installed app on iOS gets its OWN storage container, so nothing written by
   one is visible to the other — and the coach console is usually a different
   machine entirely. Until Supabase lands (docs/BACKEND.md, decided 7 Aug and
   gated on row-level security being verified on) the person carries the data
   themselves, in a link.

   ALWAYS THE FRAGMENT, NEVER THE QUERY STRING.
   An intake carries a PAR-Q and a body map of injuries; a program carries
   what somebody's body is being asked to do. A fragment is never sent to the
   server, so it cannot land in a hosting access log, and every consumer here
   strips it from the address bar the moment it has been read so it is not
   left in history or in a screenshot.

   This is a stopgap and should read like one. When the backend arrives these
   two consumers get their records from it and this file goes away — the
   shape of what travels (a User, an Intake, a Program) is already the schema
   the database will hold, precisely so that swap is not a rewrite.
   ============================================================ */

/* base64url, the same transform onboarding.html uses. Kept symmetrical and
   in one place: the survey is a single file with no module boundary to
   import from, so these two definitions are a pair that must move together
   if the encoding ever changes. */
export function encode(obj) {
  const j = JSON.stringify(obj);
  const b = btoa(unescape(encodeURIComponent(j)));
  return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decode(s) {
  const b = String(s).replace(/-/g, '+').replace(/_/g, '/');
  const pad = b + '='.repeat((4 - (b.length % 4)) % 4);
  return JSON.parse(decodeURIComponent(escape(atob(pad))));
}

/** Pull `#key=…` out of the current URL, or null. */
export function readFragment(key) {
  const m = String(location.hash || '').match(
    new RegExp('[#&]' + key + '=([A-Za-z0-9_\\-]+)')
  );
  return m ? m[1] : null;
}

/** Take it out of the address bar once it has been consumed. */
export function clearFragment() {
  try {
    history.replaceState(null, '', location.pathname + location.search);
  } catch (e) {
    location.hash = '';
  }
}
