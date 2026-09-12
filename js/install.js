/* ============================================================
   INSTALL — "add this to your home screen", handled per browser.

   Why this exists: installing is not cosmetic. An installed app gets
   persistent storage, so the training log stops being something the OS
   can clear. A browser tab does not, and iOS wipes site data after about
   a week of no use.

   The catch is that every platform does it differently:
     · Android Chrome/Edge  — fires beforeinstallprompt, so we can show a
                              real Install button that does it natively
     · iOS Safari           — no API at all; must be done by hand via Share
     · iOS Chrome/Firefox   — CANNOT install. iOS only allows Safari to add
                              a real home-screen app. Anything else makes a
                              plain bookmark with no persistent storage.
                              We have to tell the user to switch to Safari.
   ============================================================ */

let deferredPrompt = null;
let onChange = () => {};

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();          // stop Chrome's own mini-infobar
  deferredPrompt = e;
  onChange();
});
window.addEventListener('appinstalled', () => { deferredPrompt = null; onChange(); });

export function onInstallStateChange(fn) { onChange = fn; }

const ua = () => navigator.userAgent || '';
export const isIOS = () =>
  /iPad|iPhone|iPod/.test(ua()) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);   // iPadOS masquerades as Mac
export const isAndroid = () => /Android/i.test(ua());
/* On iOS every browser is Safari underneath, so sniff the wrapper instead. */
export const isIOSSafari = () => isIOS() && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua());
export const isIOSOtherBrowser = () => isIOS() && /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua());

export function isInstalled() {
  return window.matchMedia?.('(display-mode: standalone)')?.matches
    || window.navigator.standalone === true;    // iOS
}
export function canPromptInstall() { return !!deferredPrompt; }

/* Fire the real native install dialog (Android Chrome/Edge, desktop Chrome) */
export async function promptInstall() {
  if (!deferredPrompt) return 'unavailable';
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null; onChange();
  return outcome;                               // 'accepted' | 'dismissed'
}

/* What this specific user needs to be told, in their own words. */
export function installGuidance() {
  if (isInstalled()) {
    return { state: 'installed', title: 'Installed ✓',
      body: 'You are running the installed app. Your training is saved safely on this phone.' };
  }
  if (canPromptInstall()) {
    return { state: 'can-prompt', title: 'Install the app',
      body: 'One tap. It gets its own icon, works with no signal at the gym, and your training stops being something the phone can clear.' };
  }
  if (isIOSSafari()) {
    return { state: 'ios-safari', title: 'Add to your home screen',
      steps: ['Tap the Share button at the bottom of Safari (the square with an arrow)',
              'Scroll down and tap "Add to Home Screen"',
              'Tap "Add"'],
      body: 'Then open it from the new icon. This is what keeps your training history safe.' };
  }
  if (isIOSOtherBrowser()) {
    return { state: 'ios-wrong-browser', title: 'Open this in Safari first', warn: true,
      steps: ['Copy this page\'s link', 'Open Safari and paste it', 'Share → Add to Home Screen'],
      body: 'On iPhone, only Safari can install an app properly. Other browsers can only make a bookmark, and your training could be cleared by the phone.' };
  }
  if (isAndroid()) {
    return { state: 'android-manual', title: 'Add to your home screen',
      steps: ['Tap the ⋮ menu (top right)', 'Tap "Add to Home screen" or "Install app"', 'Confirm'],
      body: 'Then open it from the new icon so your training is kept safe.' };
  }
  return { state: 'desktop', title: 'Add to your home screen',
    body: 'On your phone, open this link and use your browser menu to add it to the home screen.' };
}

/* ============================================================
   WHICH ICON LANDS ON THEIR PHONE.

   WHY THIS IS HERE AND NOT IN SETTINGS. iOS reads the icon ONCE, at
   the moment somebody taps Add to Home Screen, and then keeps it. A
   picker inside the installed app would be a control that silently
   does nothing until the app is deleted and re-added, which is worse
   than not offering one. So the choice is offered on the way in, and
   only while it can still take effect.

   The list comes from spine/app-icons.json, which tools/build-app-icons.mjs
   writes from whatever is in images/app-icons/. Adding a design is
   dropping a file in and running that. Nothing here knows any icon by
   name.
   ============================================================ */

let _icons = null;

/** The choices, or an empty list. Never throws: an install screen that
 *  fails because an icon manifest is missing is a worse outcome than
 *  one that quietly offers no choice. */
export async function iconChoices() {
  if (_icons) return _icons;
  try {
    const r = await fetch('spine/app-icons.json', { cache: 'no-cache' });
    _icons = r.ok ? ((await r.json()).icons || []) : [];
  } catch { _icons = []; }
  return _icons;
}

export function chosenIconId() {
  try { return localStorage.getItem('fj.appIcon') || null; } catch { return null; }
}

/** Point the document at this icon, so the add that follows picks it up.
 *
 *  BOTH LINKS, because the two platforms read different ones: iOS takes
 *  apple-touch-icon, Android takes the icons in the manifest. Swapping
 *  only the first would give an iPhone the chosen icon and an Android
 *  the default, which is the kind of half-working nobody reports. */
export async function applyIcon(id) {
  const list = await iconChoices();
  const icon = list.find(i => i.id === id);
  if (!icon) return false;
  try { localStorage.setItem('fj.appIcon', id); } catch { /* private mode */ }

  const head = document.head;
  const set = (sel, attrs) => {
    let el = head.querySelector(sel);
    if (!el) { el = document.createElement('link'); head.appendChild(el); }
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  };
  set('link[rel="apple-touch-icon"]', { rel: 'apple-touch-icon', sizes: '180x180', href: icon.srcset['180'] });
  set('link[rel="manifest"]', { rel: 'manifest', href: icon.manifest });
  return true;
}

/** Put the stored choice back on the page. Called on boot, because a
 *  person who picked an icon, closed Safari, and came back to install
 *  should not silently get the default. */
export async function restoreIcon() {
  const id = chosenIconId();
  if (id) await applyIcon(id);
}
