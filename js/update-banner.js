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
const SEEN = 'fj.seenVersion';

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
export async function checkForUpdate({ manual = false, canShow = () => true } = {}) {
  if (!manual && Date.now() - lastCheck < 60000) return false;
  lastCheck = Date.now();
  const [now, live] = await Promise.all([whatsNew(), whatsNew(true)]);
  const newer = !!(now?.version && live?.version && live.version !== now.version);
  if (newer) { try { (await navigator.serviceWorker?.getRegistration())?.update(); } catch (e) {} }
  if (newer && canShow()) updateReady(live);
  else if (manual) toast(newer ? 'An update is ready. Finish your workout, then refresh.' : `You're on the latest version (${now?.version || 'this one'}).`);
  return newer;
}
/* after a check, the same check every time the app comes back to the front */
export function watchForUpdates(canShow) {
  checkForUpdate({ canShow });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkForUpdate({ canShow }); });
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
  if (btn) { btn.disabled = true; btn.textContent = 'Updating…'; }
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
  el.innerHTML = `<span class="tx"><b>Update ready</b>${w?.notes?.[0] ? `<small>${esc(w.notes[0])}</small>` : ''}</span>
    <button class="go">Refresh</button><button class="x" aria-label="Later">✕</button>`;
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
  el.innerHTML = `<span class="tx"><b>Updated ✓</b><small>${esc(w.notes?.[0] || 'You have the latest version.')}</small></span><button class="x" aria-label="Close">✕</button>`;
  el.querySelector('.x').addEventListener('click', () => el.remove());
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 7000);
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
