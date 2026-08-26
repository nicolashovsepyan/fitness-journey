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
import { isBeginner, isClaimed, activeUserId, loadUsers } from './users.js';
import { setAdapter } from './core/storage.js';
import { LocalAdapter } from './adapters/local.js';
import { loadStore, flushStore } from './store.js';
import { loadVoicePref } from './timer.js';
import { renderClaim } from './screens/claim.js';
import { consumeSurveyHandoff } from './intake.js';
import { consumeReleaseHandoff } from './release.js';
import { adaptDay } from './program-adapter.js';
import { storage } from './core/storage.js';
import { applyUserManifest } from './manifest-user.js';
import { loadCurrentProgram } from './core/current.js';

const app = document.getElementById('app');
let view = { name: 'home', sessionId: null };

function go(name, sessionId) { view = { name, sessionId }; render(); }

/* WHERE A WORKOUT HANDS BACK TO, AND WHY IT IS NOT ALWAYS 'home'.

   This said go('home') for both, unconditionally. 'home' is a screen in
   THIS router, and every screen in this router reads the built-in program
   from js/data/program.js - not the released one the coach wrote. So
   finishing a session started from the dashboard dropped the person onto a
   week that was somebody else's: the right workout logged, the wrong
   program shown, immediately afterwards.

   A workout that came from the dashboard goes back to the dashboard, which
   is the page that knows their real program. Recorded on the PLAN, so it
   survives the run state being persisted and reloaded - a session resumed
   tomorrow morning still knows where it came from. Read into a variable
   when the run is mounted, because quit() clears the run state before it
   calls back. */
let returnTo = null;
const rememberReturn = (plan) => { returnTo = (plan && plan.returnTo) || null; };
function leaveWorkout() {
  const back = returnTo;
  returnTo = null;
  if (back) { location.replace(back); return; }
  go('home');
}
const runCb = { onExit: leaveWorkout, onFinish: leaveWorkout };

/* ---- the workout day, coming from the dashboard --------------------------
   The spine is onboarding, dashboard, program, workout day: the dashboard is
   where a session is started from, and it is a separate page, so it starts
   one by sending the person here as index.html?run=<dayId>.

   The day it names is a day of THEIR released program — the one the coach
   wrote — not an entry in the built-in library. That is the whole point:
   before this, a released program was stored correctly and the app ran
   somebody else's week, because currentProgram() looked the id up in a
   static map and quietly fell back when it did not recognise it.

   Returns false when there is nothing to run, so boot() can fall through to
   a normal render rather than leaving a blank screen. */
async function startFromProgram(dayId) {
  try {
    const uid = activeUserId();
    const prg = (await storage().getProgram(uid)) || null;
    const raw = prg && prg.profile && prg.profile.raw;
    const day = raw && raw.days && raw.days[dayId];
    if (!day) return false;

    /* two of the console's movements are not in the app's library; the
       catalogue is what gives them a name instead of an id */
    let catalog = {};
    try {
      const r = await fetch('spine/catalog.json', { cache: 'no-cache' });
      if (r.ok) catalog = (await r.json()).movements || {};
    } catch (e) { /* offline: names fall back to ids, nothing breaks */ }

    const { plan, warnings } = adaptDay(dayId, day, catalog);
    if (!plan.blocks.length) return false;
    /* Started from the dashboard, so it hands back to the dashboard. */
    plan.returnTo = 'dashboard.html';
    /* Loud on purpose. A prescription the adapter could not read is carried
       through with its text intact rather than guessed at, and this is the
       breadcrumb for why a set count looks odd. */
    if (warnings.length) {
      console.warn('[program] prescriptions not understood:', warnings);
    }
    rememberReturn(plan);
    startWorkout(plan, runCb);
    return true;
  } catch (e) {
    console.warn('[program] could not start the released day', e);
    return false;
  }
}

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
  rememberReturn(R.load()?.plan);
  return resumeWorkout(runCb);
}

/* Re-assert on every return to the foreground. If the page was merely frozen
   the runner is still mounted and does its own thing; if the DOM was wiped
   (or a stale screen is showing) we remount the workout. */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (!R.isActive()) return;
  const inRunner = !!document.querySelector('.screen.run');
  if (!inRunner) { rememberReturn(R.load()?.plan); resumeWorkout(runCb); }
});
window.addEventListener('pageshow', (e) => {
  // e.persisted = restored from the back/forward cache
  if (!R.isActive()) return;
  if (e.persisted || !document.querySelector('.screen.run')) { rememberReturn(R.load()?.plan); resumeWorkout(runCb); }
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
  bar.addEventListener('click', () => { rememberReturn(R.load()?.plan); resumeWorkout(runCb); });
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

/* ---- boot ------------------------------------------------------
   Everything that used to happen as a side effect of importing a module
   now happens here, in order, awaited.

   That mattered the moment storage stopped being synchronous. Importing
   users.js used to run the legacy key migration; importing store.js used
   to read the training log. Neither can be relied on to have finished
   before a render once there is an await in the middle — and a render
   that lands first sees an empty account and treats a returning person
   as brand new.

   Order is not arbitrary. The adapter has to exist before anything asks
   it for data; identity has to resolve before we know whose document to
   load; the run state has to be in memory before we can ask whether a
   workout is in progress. */
async function boot() {
  setAdapter(new LocalAdapter());

  let uid = await loadUsers();            // also runs the one-time key move

  /* THE SURVEY'S WAY IN. A finished onboarding arrives as #fj=… on the
     first open; this turns it into a User and an Intake and claims the
     device to them. Runs AFTER loadUsers because it needs the roster to
     exist before it can add to it, and BEFORE the claim screen because a
     person who just finished the survey must never be asked whose phone
     this is — they have only this second told us. */
  const fromSurvey = await consumeSurveyHandoff();
  if (fromSurvey) uid = fromSurvey;

  /* A program released from the console. After the intake, because a link
     may carry a program for somebody this device has not met yet — the
     Program is kept either way and attaches when they onboard. */
  const fromRelease = await consumeReleaseHandoff();
  if (fromRelease && !uid) uid = fromRelease;

  if (!uid) {                             // never guess whose phone this is
    return renderClaim(app, { onDone: async () => { await boot(); } });
  }

  await Promise.all([
    loadStore(uid),
    R.loadRunState(uid),
    loadVoicePref(),
    /* WHAT THIS PERSON IS ACTUALLY TRAINING, resolved once, here, before
       anything draws. Every screen reads it synchronously afterwards —
       same rule as identity, and for the same reason: a screen that has
       to await its own program renders an empty week first and calls it
       the truth. See js/core/current.js. */
    loadCurrentProgram(uid),
  ]);

  applyUserManifest();                    // home-screen icon opens THEIR program

  // If a workout was left running, go straight back into it — never to home.
  if (bootIntoActiveRun()) return;

  /* THE SPINE: onboarding, dashboard, program, workout day.

     The user lives in the dashboard. It is where they come back every day,
     where they see their program, and where a session is started from — so
     the app opening straight onto the week was skipping the room the whole
     product happens in.

     The dashboard is its own page rather than a screen in this router, so
     landing on it is a redirect. index.html stays the entry point because it
     is the only thing that can consume a hand-off and resolve identity —
     the dashboard needs both to have happened before it can draw anything.

     ?view=week and ?run=<id> come back here for the program and the runner,
     which is why this is a redirect and not a rewrite of the manifest. */
  const q = new URLSearchParams(location.search);
  if (!q.has('view') && !q.has('run')) {
    location.replace('dashboard.html');
    return;
  }
  if (q.has('run')) {
    const started = await startFromProgram(q.get('run'));
    if (started) return;
  }
  render();
}

/* A write that has not reached disk when the tab goes away is a lost set.
   On this backend writes land synchronously, so this is really insurance
   for the day the backend is a server. */
document.addEventListener('visibilitychange', () => { if (document.hidden) flushStore(); });
window.addEventListener('pagehide', () => { flushStore(); });

boot().catch(err => {
  console.error('boot failed', err);
  app.innerHTML = '<div class="screen"><h1 class="q">Something went wrong starting up.</h1>'
    + '<p class="sub">Your training is safe — it is stored on this device. '
    + 'Close the app and open it again.</p></div>';
});

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
  window.addEventListener('load', async () => {
    try {
      /* updateViaCache:'none' IS THE IMPORTANT PART.

         GitHub Pages sends `cache-control: max-age=600` on everything and
         there is no way to change that - it is not configurable. That
         header applies to sw.js TOO, so for ten minutes after a deploy the
         browser would not even re-read the worker to notice a new version
         existed. A fix could be live and a phone would keep serving the old
         app, with nothing on screen to say so.

         This tells the browser to bypass its HTTP cache for the worker
         script specifically. The worker then notices a new version on the
         next check, and its own precache does the rest. */
      const reg = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
      /* And actively ask, rather than waiting for the browser to feel like
         it. Coming back to the app is exactly when a person is most likely
         to be holding a version from before the last fix. */
      const poke = () => { if (!document.hidden) reg.update().catch(() => {}); };
      document.addEventListener('visibilitychange', poke);
      poke();
    } catch (e) { /* no worker is survivable; the app still runs online */ }
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
