/* ============================================================
   SCREEN — HOME / WEEK (merged): logo, progress, your 5 days.
   This is the landing page.
   ============================================================ */
import { PROGRAM } from '../data/program.js';
import { SESSIONS } from '../data/sessions.js';
import { store } from '../store.js';
import { setVoice, isVoiceOn } from '../timer.js';

const DAY_IMG = {
  quads_knees: 'images/day-leg.png',
  push_handstand: 'images/day-core.png',
  hinge_posterior: 'images/day-hyp.png',
  pull_frontlever: 'images/day-strength.png',
  full_body_engine: 'images/day-cond.png',
};

function doneThisWeek(s) {
  try {
    const wk = Date.now() - 7 * 864e5;
    return store.all.sessions.some(l =>
      new Date(l.date).getTime() > wk && (l.sessionId === s.id || l.name === s.name));
  } catch (e) { return false; }
}

export function renderWeek(host, { onOpenDay }) {
  const total = PROGRAM.week.length;
  const done = PROGRAM.week.filter(d => doneThisWeek(SESSIONS[d.sessionId])).length;
  const pct = Math.round((done / total) * 100);

  host.innerHTML = `
    <div class="screen fade-in">
      <img class="logo-img" src="images/logo.png" alt="Fitness Journey" />

      <div class="topbar" style="margin-bottom:10px;">
        <div><h1>This week</h1><div class="sub">${PROGRAM.name} · ${PROGRAM.phases[0]} phase</div></div>
        <button class="x" id="settingsBtn" title="Settings">⚙</button>
      </div>

      <div class="progress-pct"><span>${done} of ${total} done</span><span>${pct}%</span></div>
      <div class="progress-bar"><div class="fill" style="width:${pct}%"></div></div>
      <div class="prog-msg">${pct === 100 ? '🔥 Week complete — animal.' : done === 0 ? 'Fresh week. Go get day 1.' : `${total - done} to go. Keep the streak.`}</div>

      ${PROGRAM.week.map(d => {
        const s = SESSIONS[d.sessionId];
        const dn = doneThisWeek(s);
        const anchors = s.blocks.filter(b => b.anchor).map(b => b.name);
        const sub = anchors.length ? anchors.join(' · ') : (s.variant || s.category);
        return `
          <div class="week-day img ${dn ? 'done' : ''}" data-day="${d.sessionId}" style="--img:url('${DAY_IMG[d.sessionId] || ''}')">
            <div class="content">
              <div class="dnum">${dn ? '✓' : d.day}</div>
              <div class="winfo"><div class="wname">${s.name}</div><div class="wsub">${sub}</div></div>
              <div class="wstat">${dn ? '✓' : '›'}</div>
            </div>
          </div>`;
      }).join('')}

      <div id="settingsPanel" style="display:none;">
        <div class="section-title">Settings</div>
        <div class="card">
          <div class="goal-row"><span class="goal-name">Coach voice</span>
            <div class="focus"><button id="voiceToggle" class="${isVoiceOn() ? 'on' : ''}">${isVoiceOn() ? 'On' : 'Off'}</button></div></div>
          <div class="goal-row"><span class="goal-name">Export my data</span>
            <div class="focus"><button id="exportBtn">Export</button></div></div>
        </div>
        <button class="btn ghost" id="resetBtn">Reset all data</button>
      </div>
    </div>`;

  host.querySelectorAll('.week-day[data-day]').forEach(el =>
    el.addEventListener('click', () => onOpenDay(el.dataset.day)));

  host.querySelector('#settingsBtn').addEventListener('click', () => {
    const p = host.querySelector('#settingsPanel');
    p.style.display = p.style.display === 'none' ? 'block' : 'none';
  });
  host.querySelector('#voiceToggle').addEventListener('click', (e) => {
    const on = !isVoiceOn(); setVoice(on);
    e.target.classList.toggle('on', on); e.target.textContent = on ? 'On' : 'Off';
  });
  host.querySelector('#exportBtn').addEventListener('click', () => {
    const blob = new Blob([store.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'fitness-journey-backup.json'; a.click();
  });
  host.querySelector('#resetBtn').addEventListener('click', () => {
    if (confirm('Erase all logs, PRs and goals?')) { store.reset(); renderWeek(host, { onOpenDay }); }
  });
}
