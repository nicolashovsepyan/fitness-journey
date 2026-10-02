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

async function whatsNew() {
  try { const r = await fetch('whatsnew.json', { cache: 'no-store' }); if (r.ok) return await r.json(); } catch (e) {}
  return null;
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
export async function updateReady() {
  if (document.getElementById('fjUpd')) return;
  const w = await whatsNew();
  style();
  const el = document.createElement('div'); el.id = 'fjUpd'; el.className = 'fj-upd';
  el.innerHTML = `<span class="tx"><b>Update ready</b>${w?.notes?.[0] ? `<small>${esc(w.notes[0])}</small>` : ''}</span>
    <button class="go">Refresh</button><button class="x" aria-label="Later">✕</button>`;
  el.querySelector('.go').addEventListener('click', () => location.reload());
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
