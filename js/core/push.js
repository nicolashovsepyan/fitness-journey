/* ============================================================
   NOTIFICATIONS, FROM THE PHONE SIDE.

   Asking for permission, subscribing, telling the server where to
   reach this device, and keeping the number on the icon honest.

   WHAT IOS ACTUALLY ALLOWS, because it is narrower than the web
   generally and everything here is shaped by it:

     · Push works ONLY in an app added to the home screen. In Safari
       itself there is no permission to grant and no subscription to
       make. Asking would fail, so we do not ask.
     · The prompt may only be raised from a real tap. Calling
       requestPermission() on load is refused outright, and on some
       versions counts against you.
     · A denied permission cannot be asked for again from the web. The
       only way back is through iPhone Settings. So the ask happens
       once, deliberately, at a moment somebody has a reason to say
       yes, and never as a surprise on first open.

   EVERY FUNCTION IS SAFE TO CALL ANYWHERE. None throws for want of a
   backend, a service worker, a key or a permission. They answer
   { ok:false, reason } and the caller decides whether that is worth
   saying out loud.
   ============================================================ */
import { BACKEND, backendConfigured } from '../config.js';
import { cloud, cloudAdapter, cloudSignIn } from './backend.js';

/** Push needs an installed app on iOS, and a service worker everywhere. */
export function pushPossible() {
  if (!backendConfigured() || !BACKEND.vapidPublicKey) return false;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  if (!('Notification' in window)) return false;
  // On iOS the API exists in Safari and does not work there. Installed is
  // the real condition, and it is cheap to check.
  if (isIOS() && !isStandalone()) return false;
  return true;
}

const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) && !window.MSStream;
const isStandalone = () => window.matchMedia?.('(display-mode: standalone)')?.matches
  || window.navigator.standalone === true;

/** granted | denied | default | unavailable */
export function pushState() {
  if (!pushPossible()) return 'unavailable';
  return Notification.permission;
}

/** What to say to somebody about why this is or is not on offer. */
export function pushExplain() {
  if (!backendConfigured() || !BACKEND.vapidPublicKey) return 'Notifications are not set up yet.';
  if (isIOS() && !isStandalone()) return 'Add the app to your home screen first. On iPhone, only the installed app can receive messages.';
  if (!('PushManager' in window)) return 'This browser cannot receive notifications.';
  if (Notification.permission === 'denied') return 'Notifications are blocked. Turn them back on in your phone Settings, under this app.';
  if (Notification.permission === 'granted') return 'On. Your coach can reach you here.';
  return 'Off. Turn it on to hear when your program is ready.';
}

/* base64url to the bytes subscribe() wants. The key travels as text and
   arrives as a Uint8Array, and nothing else in the app needs this. */
function keyBytes(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

/** MUST BE CALLED FROM A TAP. See the note at the top.
 *  @returns {Promise<{ok:boolean, reason?:string}>} */
export async function pushEnable() {
  if (!pushPossible()) return { ok: false, reason: pushExplain() };

  let perm = Notification.permission;
  if (perm === 'default') {
    try { perm = await Notification.requestPermission(); }
    catch (e) { return { ok: false, reason: 'The permission prompt could not be shown.' }; }
  }
  if (perm !== 'granted') return { ok: false, reason: pushExplain() };

  const signed = await cloudSignIn();
  if (!signed.ok) return signed;

  try {
    const reg = await navigator.serviceWorker.ready;
    /* An existing subscription is reused. Subscribing twice with the
       same key returns the same endpoint anyway, but asking first keeps
       the row count honest and avoids a pointless round trip. */
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,                 // iOS refuses anything else
        applicationServerKey: keyBytes(BACKEND.vapidPublicKey),
      });
    }
    await saveSubscription(sub, signed.uid);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e?.message || 'Could not subscribe on this device.' };
  }
}

/** Stop this device receiving. Their other devices are untouched. */
export async function pushDisable() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return { ok: true };
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    const c = cloud();
    if (c) await c.remove('push_subscriptions', { endpoint: `eq.${endpoint}` });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e?.message || 'Could not turn it off here.' };
  }
}

async function saveSubscription(sub, uid) {
  const c = cloud();
  if (!c) return;
  const j = sub.toJSON();
  await c.upsert('push_subscriptions', [{
    endpoint: sub.endpoint,
    user_id: uid,
    p256dh: j.keys?.p256dh || '',
    auth: j.keys?.auth || '',
    agent: navigator.userAgent.slice(0, 180),
  }], { onConflict: 'endpoint' });
}

/* ============================================================
   THE NUMBER ON THE ICON.

   It is a count of unread notifications, and the count lives in the
   database rather than on the phone, so it is the same number on every
   device somebody owns and it survives a reinstall.

   Push updates it while the app is closed; this updates it whenever
   the app is open, which covers the case where a push never arrived
   because the phone was off.
   ============================================================ */

/** @returns {Promise<Array>} newest first */
export async function unread() {
  const c = cloud();
  if (!c) return [];
  if (!c.userId) return [];
  try {
    return await c.select('notifications',
      { read_at: 'is.null', order: 'created_at.desc', limit: 50 });
  } catch { return []; }
}

/** Put the count on the icon, and tell the worker so it agrees. */
export async function refreshBadge() {
  const list = await unread();
  const n = list.length;
  try {
    if ('setAppBadge' in navigator) {
      if (n > 0) await navigator.setAppBadge(n); else await navigator.clearAppBadge();
    }
  } catch { /* Safari without permission throws. Not worth reporting. */ }
  try { navigator.serviceWorker?.controller?.postMessage({ type: 'badge', count: n }); } catch {}
  return list;
}

/** They have seen it. Clears the badge if that was the last one. */
export async function markRead(ids) {
  const c = cloud();
  if (!c || !ids?.length) return;
  try {
    await c.update('notifications', { id: `in.(${ids.join(',')})` },
      { read_at: new Date().toISOString() }, { minimal: true });
  } catch { /* it stays unread, which is the safe way to be wrong */ }
  await refreshBadge();
}
