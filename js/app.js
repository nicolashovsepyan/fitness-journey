/* ============================================================
   APP — router (Home → Week → Day → ready)
   Reads the real program (data/) via the screens. Work Mode
   (live timers per format) is the next build.
   ============================================================ */
import { FORMATS } from './data/formats.js';
import { renderWeek } from './screens/week.js';
import { renderDay } from './screens/day.js';

const app = document.getElementById('app');
let view = { name: 'week', sessionId: null };

function go(name, sessionId) { view = { name, sessionId }; render(); }

function render() {
  if (view.name === 'day') return renderDay(app, view.sessionId, { onBack: () => go('week'), onStart: renderReady });
  renderWeek(app, { onOpenDay: (id) => go('day', id) });   // week = landing page
}

/* ---------------- READY (Work Mode placeholder) ---------------- */
function renderReady(rp) {
  app.innerHTML = `
    <div class="screen fade-in center">
      <div class="big-emoji">✅</div>
      <h1 style="font-size:26px;">${rp.name} — ready</h1>
      <p class="muted">${rp.duration} min · ${rp.blocks.length} blocks</p>
      <div class="card" style="text-align:left; margin-top:14px;">
        ${rp.blocks.map(b => `<div class="goal-row"><span class="goal-name">${b.role} · ${b.name}</span><span class="muted">${FORMATS[b.format]?.short || b.format}</span></div>`).join('')}
      </div>
      <div class="callout" style="margin-top:14px;"><span class="ico">🛠</span><span class="txt">Live <b>Work Mode</b> — timers for every format (Yates · EMOM · AMRAP · Tabata · holds) — is the next build. Your program is locked and ready to run.</span></div>
      <div class="actionbar"><button class="btn lg" id="backWk">Back to week</button></div>
    </div>`;
  app.querySelector('#backWk').addEventListener('click', () => go('week'));
}

/* ---------------- boot ---------------- */
render();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
