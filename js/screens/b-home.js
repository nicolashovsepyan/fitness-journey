/* ============================================================
   SCREEN — BEGINNER HOME.
   One question answered above the fold: what do I do today?
   Then the four habit checkboxes, then the week at a glance.

   Everything else (choosing, editing, swapping) is deliberately
   pushed down or out. He should never have to decide anything.
   ============================================================ */
import { store, dayKey } from '../store.js';
import { BEGINNER_SESSIONS } from '../data/sessions-beginner.js';
import {
  PROGRAM, HABITS, DAY_LABEL, weekDates, workoutsDone, habitCount,
  weekStreak, didSessionThisWeek, todaysSession, nextTrainingDay,
  scheduleId, beginnerPlan,
} from '../beginner.js';
import { blockMinutes } from '../core/resolve.js';
import { USERS, activeUser, switchUser } from '../users.js';
import { weeklyPromptDue } from '../coach.js';

export function renderBHome(host, { onOpenDay, onOpenSummary }) {
  function draw() {
    const week = store.programWeek();
    const today = todaysSession();
    const next = todaysSession() ? null : nextTrainingDay();
    const done = workoutsDone(0);
    const h = habitCount(0);
    const streak = weekStreak();
    const todayHabits = store.getHabits();
    const dates = weekDates(0);
    const todayKey = dayKey();

    const todayDone = today && didSessionThisWeek(today.sessionId);
    const heroSession = today ? BEGINNER_SESSIONS[today.sessionId] : null;
    const heroPlan = today ? beginnerPlan(today.sessionId, { week }) : null;
    const heroMins = heroPlan ? heroPlan.blocks.reduce((t, b) => t + blockMinutes(b), 0) : 0;

    host.innerHTML = `
      <div class="screen fade-in bgn">

        <div class="topbar" style="margin-bottom:12px;">
          <div><h1 style="margin:0;">Hi, ${activeUser().name.split(' ')[0]}</h1>
            <div class="sub">${PROGRAM.name} · week ${week}</div></div>
          <div style="display:flex;gap:8px;align-items:center;">
            <button class="gear" id="summaryBtn" title="My week">📊</button>
            <button class="gear" id="settingsBtn" title="Settings">⚙</button>
          </div>
        </div>

        ${week <= PROGRAM.introWeeks ? `
          <div class="callout soft"><span class="ico">🌱</span><span class="txt">
            <b>Week ${week} of ${PROGRAM.introWeeks} — easing in.</b> Warm-up plus the A and B pairs only.
            The rest gets added in week ${PROGRAM.introWeeks + 1}. Turning up three times is the whole job right now.
          </span></div>` : ''}

        ${weeklyPromptDue() ? `<div class="callout act" id="weeklyNudge"><span class="ico">📤</span><span class="txt">
          Your weekly summary is ready — tap to send it to your coach.</span></div>` : ''}

        <!-- TODAY -->
        ${today ? `
          <div class="today-card ${todayDone ? 'done' : ''}" id="todayCard">
            <div class="tc-tag">${todayDone ? '✓ Done today' : 'Today'}</div>
            <div class="tc-name">${heroSession.name}</div>
            <div class="tc-meta">${heroPlan.blocks.length} blocks · about ${heroMins} min</div>
            <div class="tc-go">${todayDone ? 'Look at it again ›' : 'Start ›'}</div>
          </div>`
        : `
          <div class="today-card rest">
            <div class="tc-tag">Today</div>
            <div class="tc-name">Rest day</div>
            <div class="tc-meta">${next ? `Next up: ${BEGINNER_SESSIONS[next.sessionId].name}, ${next.inDays === 1 ? 'tomorrow' : DAY_LABEL[next.date.getDay()]}` : ''}</div>
            <div class="tc-go soft">Still get your walk in ›</div>
          </div>`}

        <!-- HABITS -->
        <div class="section-title">Today's four</div>
        <div class="habits">
          ${HABITS.map(x => `
            <button class="habit ${todayHabits[x.id] ? 'on' : ''}" data-habit="${x.id}">
              <span class="box">${todayHabits[x.id] ? '✓' : ''}</span>
              <span class="lbl">${x.label}${x.note ? `<em>${x.note}</em>` : ''}</span>
            </button>`).join('')}
        </div>
        <div class="habit-foot">${PROGRAM.longWalk}</div>

        <!-- WEEK STRIP -->
        <div class="section-title">This week</div>
        <div class="streak-card">
          <div class="sc-top">
            <div><div class="sc-big">${streak}</div><div class="sc-lbl">week streak</div></div>
            <div class="sc-right">
              <div class="sc-row"><span>Gym</span><b>${done} / ${PROGRAM.week.length}</b></div>
              <div class="sc-row"><span>Habits</span><b>${h.pct}%</b></div>
              <div class="sc-row"><span>Sport</span><b>${h.sport ? '✓' : '–'}</b></div>
            </div>
          </div>
          <div class="daystrip">
            ${dates.map(d => {
              const x = store.getHabits(d);
              const n = HABITS.filter(k => k.daily).filter(k => x[k.id]).length;
              const dt = new Date(d + 'T00:00:00');
              const future = d > todayKey;
              return `<div class="ds ${d === todayKey ? 'now' : ''} ${future ? 'future' : ''}">
                <span class="dl">${DAY_LABEL[dt.getDay()][0]}</span>
                <span class="dd n${n}">${future ? '' : n === 3 ? '★' : n || ''}</span></div>`;
            }).join('')}
          </div>
        </div>

        <!-- THE THREE WORKOUTS -->
        <div class="section-title">Your three workouts</div>
        ${PROGRAM.week.map((d, i) => {
          const s = BEGINNER_SESSIONS[d.sessionId];
          const dn = didSessionThisWeek(d.sessionId);
          const isToday = today && today.sessionId === d.sessionId;
          return `
            <div class="week-day plain ${dn ? 'done' : ''} ${isToday ? 'today' : ''}" data-day="${d.sessionId}">
              <div class="content">
                <div class="dnum">${dn ? '✓' : i + 1}</div>
                <div class="winfo"><div class="wname">${s.name}</div>
                  <div class="wsub">${dn ? 'done this week' : (s.tags || []).join(' · ')}</div></div>
                <div class="wstat">›</div>
              </div>
            </div>`;
        }).join('')}

        <div class="spacer" style="height:40px;"></div>
      </div>`;

    /* --- wiring --- */
    host.querySelectorAll('[data-habit]').forEach(el => el.addEventListener('click', () => {
      store.toggleHabit(el.dataset.habit);
      try { navigator.vibrate?.(20); } catch (e) {}
      draw();
    }));
    host.querySelectorAll('.week-day[data-day]').forEach(el =>
      el.addEventListener('click', () => onOpenDay(el.dataset.day)));
    host.querySelector('#todayCard')?.addEventListener('click', () => onOpenDay(today.sessionId));
    host.querySelector('#summaryBtn').addEventListener('click', () => onOpenSummary());
    host.querySelector('#weeklyNudge')?.addEventListener('click', () => onOpenSummary());
    host.querySelector('#settingsBtn').addEventListener('click', openSettings);
  }

  function openSettings() {
    const cur = scheduleId();
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `
      <div class="overlay-card scroll">
        <div class="eyebrow">Settings</div>
        <h2 style="margin:6px 0 14px;">Settings</h2>

        <div class="goal-row"><span class="goal-name">Training days</span></div>
        <div class="choice-grid">
          ${Object.entries(PROGRAM.schedules).map(([id, s]) =>
            `<button class="choice ${id === cur ? 'on' : ''}" data-sched="${id}">${s.label}</button>`).join('')}
        </div>

        <div class="goal-row" style="margin-top:14px;"><span class="goal-name">Who's training</span></div>
        <div class="choice-grid">
          ${Object.values(USERS).map(u =>
            `<button class="choice ${u.id === activeUser().id ? 'on' : ''}" data-user="${u.id}">${u.name}</button>`).join('')}
        </div>

        <div class="goal-row" style="margin-top:14px;"><span class="goal-name">Export my data</span>
          <div class="focus"><button id="exportBtn">Export</button></div></div>

        <button class="btn" id="close" style="margin-top:14px;">Done</button>
      </div>`;
    host.appendChild(ov);
    ov.querySelector('#close').addEventListener('click', () => ov.remove());
    ov.querySelectorAll('[data-sched]').forEach(el => el.addEventListener('click', () => {
      store.setSetting('schedule', el.dataset.sched); ov.remove(); draw();
    }));
    ov.querySelectorAll('[data-user]').forEach(el => el.addEventListener('click', () => switchUser(el.dataset.user)));
    ov.querySelector('#exportBtn').addEventListener('click', () => {
      const blob = new Blob([store.exportJSON()], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `fitness-journey-${activeUser().id}.json`; a.click();
    });
  }

  store.startDate();      // stamp day one on first ever open
  draw();
}
