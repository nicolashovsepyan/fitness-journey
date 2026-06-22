/* ============================================================
   APP — router (Week → Day → Work Mode). Resumes an in-progress
   workout if one was left running.
   ============================================================ */
import { renderWeek } from './screens/week.js';
import { renderDay } from './screens/day.js';
import { renderHistory } from './screens/history.js';
import { startWorkout, resumeWorkout } from './runner/workmode.js';
import * as R from './runner/runstate.js';

const app = document.getElementById('app');
let view = { name: 'week', sessionId: null };

function go(name, sessionId) { view = { name, sessionId }; render(); }

const runCb = { onExit: () => go('week'), onFinish: () => go('week') };

function render() {
  if (view.name === 'day') return renderDay(app, view.sessionId, { onBack: () => go('week'), onStart: rp => startWorkout(rp, runCb) });
  if (view.name === 'history') return renderHistory(app, { onBack: () => go('week') });
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
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
