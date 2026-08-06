/* ============================================================
   PER-USER MANIFEST.
   The static manifest has start_url "./index.html" — no profile. That is
   what a home-screen icon launches, and on iOS an installed app cannot see
   the profile chosen in Safari (separate storage container), so it opened
   on the wrong program.

   Fix: before the user installs, swap in a manifest whose start_url carries
   the active profile — ./index.html?user=<uid>. The icon then always opens
   the right person's app, regardless of what storage the installed app can
   or cannot see.

   Built as a blob at runtime because the site is statically hosted: there is
   one manifest file and it cannot be personalised server-side.
   ============================================================ */
import { activeUserId, displayName } from './users.js';

let blobUrl = null;

export async function applyUserManifest() {
  try {
    const link = document.querySelector('link[rel="manifest"]');
    if (!link) return;
    const uid = activeUserId();

    // start from the real manifest so icons/colours stay in one place
    const res = await fetch('manifest.webmanifest', { cache: 'no-cache' });
    const base = await res.json();

    /* Carry the display name too. On iOS the installed app cannot read the
       name that Safari stored, so without this it would fall back to the
       generic profile name forever. */
    const full = (displayName(uid) || '').trim();
    const who = full.split(' ')[0];
    const qs = `user=${encodeURIComponent(uid)}${full ? `&name=${encodeURIComponent(full)}` : ''}`;
    const m = {
      ...base,
      id: `fitness-journey-${uid}`,
      start_url: `./index.html?${qs}`,
      name: who ? `Fitness Journey — ${who}` : base.name,
      short_name: who || base.short_name,
    };

    if (blobUrl) URL.revokeObjectURL(blobUrl);
    blobUrl = URL.createObjectURL(new Blob([JSON.stringify(m)], { type: 'application/manifest+json' }));
    link.setAttribute('href', blobUrl);
  } catch (e) {
    /* keep the static manifest — the app still works, the icon just opens
       the default profile and the first-run picker catches it */
  }
}
