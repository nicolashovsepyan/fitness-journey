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
