/* ============================================================
   APP — router. Two UIs over one engine:
     'pro'      → Week → Day → Work Mode (Nicolas)
     'beginner' → Home (habits) → Day → Work Mode → Weekly summary
   The active user picks which. Work Mode is shared by both.
   Resumes an in-progress workout if one was left running.
   ============================================================ */
import { renderWeek } from './screens/week.js';
import { renderDay } from './screens/day.js';
import { renderHistory } from './screens/history.js';
import { renderBHome } from './screens/b-home.js';
import { renderBDay } from './screens/b-day.js';
import { renderBSummary } from './screens/b-summary.js';
import { renderBHistory } from './screens/b-history.js';
import { startWorkout, resumeWorkout } from './runner/workmode.js';
import * as R from './runner/runstate.js';
import { isBeginner, isClaimed } from './users.js';
import { renderClaim } from './screens/claim.js';
import { applyUserManifest } from './manifest-user.js';

const app = document.getElementById('app');
let view = { name: 'home', sessionId: null };

function go(name, sessionId) { view = { name, sessionId }; render(); }

const runCb = { onExit: () => go('home'), onFinish: () => go('home') };

function render() {
  // Never guess whose phone this is — ask once if we were never told.
  if (!isClaimed()) return renderClaim(app, { onDone: () => { applyUserManifest(); render(); } });
  if (isBeginner()) return renderBeginner();
  return renderPro();
}

/* ---- never lose a workout ----------------------------------
   A phone will freeze or discard a backgrounded tab whenever it feels like
   it (iOS is aggressive about this). The run state is timestamp-based and
   lives in localStorage, so it always survives — the bug was that we came
   back to the HOME screen with a "tap to resume" bar, which reads as "the
   app restarted and lost my workout".
   Now: if a workout is running, we go straight back into it. The only way
   out is the user ending it. */
function bootIntoActiveRun() {
  if (!R.isActive()) return false;
  return resumeWorkout(runCb);
}

/* Re-assert on every return to the foreground. If the page was merely frozen
   the runner is still mounted and does its own thing; if the DOM was wiped
   (or a stale screen is showing) we remount the workout. */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (!R.isActive()) return;
  const inRunner = !!document.querySelector('.screen.run');
  if (!inRunner) resumeWorkout(runCb);
});
window.addEventListener('pageshow', (e) => {
  // e.persisted = restored from the back/forward cache
  if (!R.isActive()) return;
  if (e.persisted || !document.querySelector('.screen.run')) resumeWorkout(runCb);
});

/* A workout in progress also blocks accidental tab-closes / back-swipes. */
window.addEventListener('beforeunload', (e) => {
  if (!R.isActive()) return;
  e.preventDefault();
  e.returnValue = '';
});

function renderBeginner() {
  if (view.name === 'day') {
    return renderBDay(app, view.sessionId, {
      onBack: () => go('home'),
      onStart: rp => startWorkout(rp, runCb),
    });
  }
  if (view.name === 'summary') return renderBSummary(app, { onBack: () => go('home') });
  if (view.name === 'history') return renderBHistory(app, { onBack: () => go('home') });
  renderBHome(app, {
    onOpenDay: id => go('day', id),
    onOpenSummary: () => go('summary'),
    onOpenHistory: () => go('history'),
  });
  if (R.isActive()) injectResume();
}

function renderPro() {
  if (view.name === 'day') return renderDay(app, view.sessionId, { onBack: () => go('home'), onStart: rp => startWorkout(rp, runCb) });
  if (view.name === 'history') return renderHistory(app, { onBack: () => go('home') });
  renderWeek(app, { onOpenDay: (id) => go('day', id), onOpenHistory: () => go('history') });
  if (R.isActive()) injectResume();    // a workout was left in progress
}

function injectResume() {
  const st = R.load(); if (!st) return;
  const screen = app.querySelector('.screen'); if (!screen) return;
  const bar = document.createElement('div');
  bar.className = 'callout'; bar.style.cssText = 'cursor:pointer;margin-top:8px;';
  bar.innerHTML = `<span class="ico">⏱</span><span class="txt">Workout in progress — <b>${st.plan?.name || ''}</b>. Tap to resume.</span>`;
  bar.addEventListener('click', () => resumeWorkout(runCb));
  screen.insertBefore(bar, screen.firstChild.nextSibling);
}

/* ---- keep his training data from being evicted ----
   All logs live in localStorage on the device. By default a browser treats
   that as disposable — iOS in particular clears site data after about a week
   of not opening the site, which would silently wipe his history.
   Asking for persistent storage marks it as "do not evict". It is granted
   outright once the app is installed to the home screen. */
if (navigator.storage?.persist) {
  navigator.storage.persisted()
    .then(already => already || navigator.storage.persist())
    .catch(() => {});
}

// Point the install manifest at THIS user, so the home-screen icon opens
// their program and not the default one.
if (isClaimed()) applyUserManifest();

// If a workout was left running, go straight back into it — never to home.
if (!bootIntoActiveRun()) render();

/* ---- offline shell ----
   The service worker precaches the whole app, so once it has been opened
   once it works with no signal — which is the point at a gym. When a new
   version activates it messages us, and we offer a reload rather than
   yanking the page out from under someone mid-set. */
// ?nosw disables the offline cache and tears down any existing one — a dev
// escape hatch so code changes are never masked by a stale cached build.
const NO_SW = new URLSearchParams(location.search).has('nosw');
if (NO_SW && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
  if (self.caches) caches.keys().then(ks => ks.forEach(k => caches.delete(k)));
}
if (!NO_SW && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
  let seenController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type !== 'sw-updated') return;
    if (!seenController) { seenController = true; return; }   // first ever install, nothing to update
    showUpdateBar();
  });
}
function showUpdateBar() {
  if (document.getElementById('updBar') || R.isActive()) return;   // never interrupt a live workout
  const bar = document.createElement('div');
  bar.id = 'updBar'; bar.className = 'toast go';
  bar.style.cursor = 'pointer';
  bar.textContent = '↻ New version ready — tap to update';
  bar.addEventListener('click', () => location.reload());
  document.body.appendChild(bar);
  setTimeout(() => bar.remove(), 12000);
}
