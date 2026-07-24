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
import { startWorkout, resumeWorkout } from './runner/workmode.js';
import * as R from './runner/runstate.js';
import { isBeginner } from './users.js';

const app = document.getElementById('app');
let view = { name: 'home', sessionId: null };

function go(name, sessionId) { view = { name, sessionId }; render(); }

const runCb = { onExit: () => go('home'), onFinish: () => go('home') };

function render() {
  if (isBeginner()) return renderBeginner();
  return renderPro();
}

function renderBeginner() {
  if (view.name === 'day') {
    return renderBDay(app, view.sessionId, {
      onBack: () => go('home'),
      onStart: rp => startWorkout(rp, runCb),
    });
  }
  if (view.name === 'summary') return renderBSummary(app, { onBack: () => go('home') });
  renderBHome(app, { onOpenDay: id => go('day', id), onOpenSummary: () => go('summary') });
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

render();

/* ---- offline shell ----
   The service worker precaches the whole app, so once it has been opened
   once it works with no signal — which is the point at a gym. When a new
   version activates it messages us, and we offer a reload rather than
   yanking the page out from under someone mid-set. */
if ('serviceWorker' in navigator) {
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
