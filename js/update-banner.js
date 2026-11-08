/* ============================================================
   UPDATES YOU CAN SEE.
   One module for every page (index.html and dashboard.html), so an
   update reads the same everywhere:

     a new version arrived  → an "Update ready" bar with what changed and a
                              Refresh button. Nothing reloads under you.
     you refreshed          → "Updated" with the same line, once.

   What changed comes from whatsnew.json at the site root. Every release
   bumps its `version` and puts the newest line first. Self-contained
   (its own styles) because the two pages share no stylesheet.
   ============================================================ */
import { t, isFr } from './i18n.js';
const SEEN = 'fj.seenVersion';
/* what changed, in the reader's language (whatsnew.json may carry notes_fr) */
const note = w => (isFr() && w?.notes_fr?.[0]) || w?.notes?.[0] || '';

/* the version this page is RUNNING (through the offline cache), and the
   one on the site RIGHT NOW (?live skips the cache, see build-sw.mjs) */
async function whatsNew(live = false) {
  try { const r = await fetch(live ? `whatsnew.json?live=${Date.now()}` : 'whatsnew.json', { cache: 'no-store' }); if (r.ok) return await r.json(); } catch (e) {}
  return null;
}
export async function runningVersion() { return (await whatsNew())?.version || ''; }

/* IS THERE A NEWER VERSION ON THE SITE? Asked on every open and every
   return to the app, not only when the background updater happens to
   announce one (a home-screen app can miss that and sit on an old build).
   canShow() lets a page hold the bar back, e.g. during a workout. */
let lastCheck = 0;
/* THE VERSION THIS PAGE IS ACTUALLY RUNNING, which is not always what
   the cache says. The check compared "cached" against "live", and that
   only means something on a page a service worker controls. The coach
   console registers none, so both fetches hit the same server, the two
   versions were always equal, and the bar could never fire there - you
   had to reload and hope. Remembering what the page loaded with answers
   it on any page: if the site is now serving something else, there is
   something else to take. */
let loaded = null;
export async function checkForUpdate({ manual = false, canShow = () => true } = {}) {
  if (!manual && Date.now() - lastCheck < 60000) return false;
  lastCheck = Date.now();
  const [now, live] = await Promise.all([whatsNew(), whatsNew(true)]);
  if (loaded == null) loaded = now?.version || live?.version || null;
  const newer = !!(live?.version && (
    (now?.version && live.version !== now.version) ||      /* a cache is holding an old build */
    (loaded && live.version !== loaded)));                  /* or the site moved under us */
  if (newer) { try { (await navigator.serviceWorker?.getRegistration())?.update(); } catch (e) {} }
  if (newer && canShow()) updateReady(live);
  else if (manual) toast(newer ? t('An update is ready. Finish your workout, then refresh.') : t("You're on the latest version ({v}).", { v: now?.version || t('this one') }));
  return newer;
}
/* after a check, the same check every time the app comes back to the front */
export function watchForUpdates(canShow) {
  checkForUpdate({ canShow });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkForUpdate({ canShow }); });
  /* AND WHILE YOU ARE SITTING ON THE PAGE. It asked on open and on coming
     back to the front, which means a release that lands while the page is
     in front of you goes unannounced until you leave and return. Every
     minute, only while visible; checkForUpdate throttles itself to the
     same minute, so a tab switch and a tick never both pay for it. */
  setInterval(() => { if (!document.hidden) checkForUpdate({ canShow }); }, 60000);
}
function toast(text) {
  style();
  document.getElementById('fjUpdToast')?.remove();
  const el = document.createElement('div'); el.id = 'fjUpdToast'; el.className = 'fj-upd done';
  el.innerHTML = `<span class="tx"><b>${esc(text)}</b></span>`;
  document.body.appendChild(el); setTimeout(() => el.remove(), 3500);
}
/* Refresh = take the new version for real: ask the service worker to fetch
   it, wait (briefly) until it is in charge, then reload onto it. */
async function refreshNow(btn) {
  if (btn) { btn.disabled = true; btn.textContent = t('Updating…'); }
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.update();
      if (reg.installing || reg.waiting) {
        await new Promise(r => { const t = setTimeout(r, 6000); navigator.serviceWorker.addEventListener('controllerchange', () => { clearTimeout(t); r(); }, { once: true }); });
      }
    }
  } catch (e) {}
  location.reload();
}
function style() {
  if (document.getElementById('fj-upd-style')) return;
  const st = document.createElement('style'); st.id = 'fj-upd-style';
  st.textContent = `
  .fj-upd { position: fixed; left: 12px; right: 12px; top: calc(10px + env(safe-area-inset-top)); z-index: 200; max-width: 520px; margin: 0 auto;
    display: flex; align-items: center; gap: 12px; padding: 12px 12px 12px 16px; border-radius: 18px;
    background: #1E232A; color: #ECEFF3; border: 1.5px solid rgba(255,95,162,.6); box-shadow: 0 0 26px rgba(255,95,162,.28), 0 10px 30px rgba(0,0,0,.5);
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif; animation: fjUpdIn .25s ease-out; }
  .fj-upd .tx { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .fj-upd b { font-size: 15px; } .fj-upd small { color: #A9B2BC; font-size: 12.5px; margin-top: 2px; line-height: 1.3; }
  .fj-upd button.go { flex: none; background: #3ECBA8; color: #0C1512; border: none; border-radius: 12px; padding: 11px 16px; font-size: 15px; font-weight: 700; cursor: pointer; }
  .fj-upd button.x { flex: none; background: none; border: none; color: #858E99; font-size: 16px; padding: 6px; cursor: pointer; }
  .fj-upd.done { border-color: rgba(62,203,168,.6); box-shadow: 0 0 26px rgba(62,203,168,.25), 0 10px 30px rgba(0,0,0,.5); }
  @keyframes fjUpdIn { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: none; } }`;
  document.head.appendChild(st);
}

/* a new version is on the phone: say so, and let them take it */
export async function updateReady(known) {
  if (document.getElementById('fjUpd')) return;
  const w = known || await whatsNew(true) || await whatsNew();
  style();
  const el = document.createElement('div'); el.id = 'fjUpd'; el.className = 'fj-upd';
  el.innerHTML = `<span class="tx"><b>${t('Update ready')}</b>${note(w) ? `<small>${esc(note(w))}</small>` : ''}</span>
    <button class="go">${t('Refresh')}</button><button class="x" aria-label="${t('Later')}">✕</button>`;
  el.querySelector('.go').addEventListener('click', e => refreshNow(e.currentTarget));
  el.querySelector('.x').addEventListener('click', () => el.remove());
  document.body.appendChild(el);
}

/* after a refresh: say what changed, once per version */
export async function announceUpdate() {
  const w = await whatsNew(); if (!w?.version) return;
  let seen = null; try { seen = localStorage.getItem(SEEN); localStorage.setItem(SEEN, w.version); } catch (e) {}
  if (!seen || seen === w.version) return;          // first visit, or nothing new
  style();
  const el = document.createElement('div'); el.className = 'fj-upd done';
  el.innerHTML = `<span class="tx"><b>${t('Updated ✓')}</b><small>${esc(note(w) || t('You have the latest version.'))}</small></span><button class="x" aria-label="${t('Close')}">✕</button>`;
  el.querySelector('.x').addEventListener('click', () => el.remove());
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 7000);
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
