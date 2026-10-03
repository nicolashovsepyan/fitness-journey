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
    const qs = uid ? `user=${encodeURIComponent(uid)}${full ? `&name=${encodeURIComponent(full)}` : ''}` : '';
    /* On the Quick Timer the icon being added is THE TIMER: its own id, so
       it sits beside the main app instead of replacing it, and it opens
       straight onto the timer. */
    const quick = new URLSearchParams(location.search).has('quick');
    /* THE TIMER'S MANIFEST IS A REAL FILE. A manifest built as a blob
       resolves "./index.html?quick" against blob:…, which is no address at
       all; phones fell back to the main app's start page, and a home-screen
       timer opened on "Let us find you". manifest-timer.webmanifest starts
       on the timer, on every phone. */
    if (quick) {
      link.setAttribute('href', 'manifest-timer.webmanifest');
      document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', 'Training Timer');
      document.title = 'Training Timer';
      /* the timer's own face (J5 Sunray). iOS takes the icon from this tag
         at the moment of "Add to Home Screen", not from the manifest */
      document.querySelector('link[rel="apple-touch-icon"]')?.setAttribute('href', 'images/timer-icon/timer-180.png');
      document.querySelector('link[rel="icon"][type="image/png"]')?.setAttribute('href', 'images/timer-icon/timer-192.png');
      return;
    }
    const m = {
      ...base,
      id: `fitness-journey-${uid}`,
      start_url: `./index.html?${qs}`,
      name: who ? `Fitness Journey — ${who}` : base.name,
      short_name: who || base.short_name,
    };
    /* ABSOLUTE ADDRESSES. Inside a blob manifest a relative URL resolves
       against blob:…, which is no address; Android's install would point
       nowhere. Every URL in it is spelled out in full. */
    const abs = u => new URL(u, location.href).href;
    m.start_url = abs(m.start_url); m.scope = abs(m.scope || './');
    m.icons = (m.icons || []).map(i => ({ ...i, src: abs(i.src) }));

    if (blobUrl) URL.revokeObjectURL(blobUrl);
    blobUrl = URL.createObjectURL(new Blob([JSON.stringify(m)], { type: 'application/manifest+json' }));
    link.setAttribute('href', blobUrl);
  } catch (e) {
    /* keep the static manifest — the app still works, the icon just opens
       the default profile and the first-run picker catches it */
  }
}
