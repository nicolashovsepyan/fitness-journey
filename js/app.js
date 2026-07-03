/* ============================================================
   APP — router. Three pillars (Week · Program · Progress) via a
   bottom tab bar, plus Day → Work Mode drill-in. Resumes an
   in-progress workout if one was left running.
   ============================================================ */
import { renderWeek } from './screens/week.js';
import { renderDay } from './screens/day.js';
import { renderHistory } from './screens/history.js';
import { renderProgram } from './screens/program.js';
import { startWorkout, resumeWorkout } from './runner/workmode.js';
import * as R from './runner/runstate.js';

const app = document.getElementById('app');
let view = { name: 'week', sessionId: null, sub: 'build' };

function go(name, sessionId) { view = { ...view, name, sessionId }; render(); }
function setSub(sub) { view = { ...view, sub }; render(); }

const runCb = { onExit: () => go('week'), onFinish: () => go('week') };

const TABS = [
  { name: 'week',    label: 'This Week', icon: '📅' },
  { name: 'program', label: 'Program',   icon: '🧩' },
  { name: 'history', label: 'Progress',  icon: '📊' },
];
const TAB_NAMES = new Set(TABS.map(t => t.name));

function render() {
  if (view.name === 'day') { renderDay(app, view.sessionId, { onBack: () => go(prevTab()), onStart: rp => startWorkout(rp, runCb) }); showNav(false); return; }
  if (view.name === 'history') renderHistory(app, { onBack: () => go('week') });
  else if (view.name === 'program') renderProgram(app, { sub: view.sub, onOpenDay: id => go('day', id), setSub });
  else renderWeek(app, { onOpenDay: id => go('day', id), onOpenHistory: () => go('history') });
  showNav(true);
  if (R.isActive()) injectResume();
}

/* remember which tab we came from so Day → back returns there */
let lastTab = 'week';
function prevTab() { return lastTab; }

/* ---- bottom tab bar ---- */
let navEl = null;
function buildNav() {
  navEl = document.createElement('nav'); navEl.className = 'tabbar';
  navEl.innerHTML = TABS.map(t =>
    `<button class="tab" data-tab="${t.name}"><span class="ti">${t.icon}</span><span class="tl">${t.label}</span></button>`).join('');
  document.body.appendChild(navEl);
  navEl.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => go(b.dataset.tab)));
}
function showNav(on) {
  if (!navEl) buildNav();
  navEl.style.display = on ? 'flex' : 'none';
  if (on && TAB_NAMES.has(view.name)) lastTab = view.name;
  navEl.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === view.name));
}

function injectResume() {
  const st = R.load(); if (!st) return;
  const screen = app.querySelector('.screen'); if (!screen) return;
  if (screen.querySelector('.callout.resume')) return;
  const bar = document.createElement('div');
  bar.className = 'callout resume'; bar.style.cssText = 'cursor:pointer;margin-top:8px;';
  bar.innerHTML = `<span class="ico">⏱</span><span class="txt">Workout in progress — <b>${st.plan?.name || ''}</b>. Tap to resume.</span>`;
  bar.addEventListener('click', () => resumeWorkout(runCb));
  screen.insertBefore(bar, screen.firstChild.nextSibling);
}

render();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
