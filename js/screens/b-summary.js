/* ============================================================
   SCREEN — WEEKLY SUMMARY + SEND TO COACH.
   Knee flags sit at the very top, above everything else: they are
   the one signal that should change the program, so they must not
   be something you scroll to find.
   ============================================================ */
import { store } from '../store.js';
import { EXERCISES } from '../data/exercises.js';
import {
  PROGRAM, HABITS, DAY_LABEL, weekStartMs, weekDates,
  workoutsDone, habitCount, weekStreak, sessionsInWeek,
} from '../beginner.js';
import { buildReport, sendReport, downloadReport } from '../coach.js';

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const nameOf = id => EXERCISES[id]?.name || id;
const fmtDur = s => `${Math.floor((s || 0) / 60)} min`;

export function renderBSummary(host, { onBack }) {
  let offset = 0;                     // 0 = this week, 1 = last week

  function draw() {
    const start = weekStartMs(offset), end = start + 7 * 86400000;
    const inWeek = t => t >= start && t < end;
    const flags = store.flagsSince(start).filter(f => inWeek(new Date(f.date + 'T00:00:00').getTime()));
    const notes = store.notesSince(start).filter(n => inWeek(new Date(n.date + 'T00:00:00').getTime()));
    const fb = store.feedbackSince(start).filter(f => inWeek(new Date(f.date + 'T00:00:00').getTime()));
    const sessions = sessionsInWeek(offset);
    const h = habitCount(offset);
    const done = workoutsDone(offset);
    const dates = weekDates(offset);

    host.innerHTML = `
      <div class="screen fade-in bgn">
        <div class="topbar" style="margin-bottom:6px;">
          <button class="histbtn" id="back">‹ Back</button>
          <h1 style="margin:0;font-size:22px;">My week</h1>
          <span style="width:54px;"></span>
        </div>
        <div class="hist-tabs">
          <button class="${offset === 0 ? 'on' : ''}" id="tThis">This week</button>
          <button class="${offset === 1 ? 'on' : ''}" id="tLast">Last week</button>
        </div>

        <!-- KNEE FLAGS — always first -->
        <div class="flagcard ${flags.length ? 'hot' : ''}">
          <div class="fc-head">🦵 Knee flags</div>
          ${flags.length
            ? flags.map(f => `<div class="fc-row"><span class="fn">${esc(f.name || nameOf(f.exId))}</span><span class="fd">${f.date}</span></div>`).join('')
            : `<div class="fc-none">Nothing flagged this week. Good sign.</div>`}
        </div>

        <!-- CONSISTENCY -->
        <div class="streak-card">
          <div class="sc-top">
            <div><div class="sc-big">${weekStreak()}</div><div class="sc-lbl">week streak</div></div>
            <div class="sc-right">
              <div class="sc-row"><span>Gym</span><b>${done} / ${PROGRAM.week.length}</b></div>
              <div class="sc-row"><span>Habits</span><b>${h.daily} / ${h.dailyPossible}</b></div>
              <div class="sc-row"><span>Sport</span><b>${h.sport ? '✓' : '–'}</b></div>
            </div>
          </div>
          <div class="habtable">
            <div class="ht-row head"><span class="ht-d"></span>${HABITS.map(x => `<span class="ht-c">${x.id === 'walk' ? '🚶' : x.id === 'no8pm' ? '🌙' : x.id === 'protein' ? '🍳' : '⚽'}</span>`).join('')}</div>
            ${dates.map(d => {
              const x = store.getHabits(d);
              return `<div class="ht-row"><span class="ht-d">${DAY_LABEL[new Date(d + 'T00:00:00').getDay()]}</span>
                ${HABITS.map(k => `<span class="ht-c ${x[k.id] ? 'on' : ''}">${x[k.id] ? '✓' : '·'}</span>`).join('')}</div>`;
            }).join('')}
          </div>
        </div>

        <!-- HOW IT FELT -->
        <div class="section-title">How it felt</div>
        ${fb.length ? fb.map(f => `
          <div class="fb-row"><span class="fbr ${f.rating || ''}">${f.rating === 'easy' ? '🙂 Easy' : f.rating === 'hard' ? '🥵 Too hard' : f.rating === 'right' ? '💪 About right' : '—'}</span>
            <span class="fbn">${esc(f.name)}</span>${f.text ? `<div class="fbt">"${esc(f.text)}"</div>` : ''}</div>`).join('')
          : `<div class="hist-empty">No session feedback yet.</div>`}

        <!-- NOTES -->
        <div class="section-title">Notes</div>
        ${notes.length ? notes.map(n => `
          <div class="note-row"><b>${esc(n.name || nameOf(n.exId))}</b><span class="nd">${n.date}</span>
            <div class="nt">"${esc(n.text)}"</div></div>`).join('')
          : `<div class="hist-empty">No notes yet.</div>`}

        <!-- SESSIONS -->
        <div class="section-title">Sessions done</div>
        ${sessions.length ? sessions.map(s => `
          <div class="hist-card"><div class="htop">
            <div><div class="hname">${esc(s.name)}</div>
              <div class="hmeta">${new Date(s.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ⏱ ${fmtDur(s.seconds)}</div></div>
          </div></div>`).join('')
          : `<div class="hist-empty">Nothing logged this week yet.</div>`}

        <div class="spacer" style="height:100px;"></div>
        <div class="actionbar"><div class="btn-row">
          <button class="btn secondary" id="preview">Preview</button>
          <button class="btn lg" id="send">📤 Send to coach</button>
        </div></div>
      </div>`;

    host.querySelector('#back').addEventListener('click', onBack);
    host.querySelector('#tThis').addEventListener('click', () => { offset = 0; draw(); });
    host.querySelector('#tLast').addEventListener('click', () => { offset = 1; draw(); });
    host.querySelector('#send').addEventListener('click', doSend);
    host.querySelector('#preview').addEventListener('click', doPreview);
  }

  async function doSend() {
    const text = buildReport({ offsetWeeks: offset });
    const how = await sendReport(text, { title: `Training report — week ${store.programWeek()}` });
    if (how === 'cancelled') return;
    toast(how === 'shared' ? 'Sent ✓'
      : how === 'copied' ? 'Copied ✓ — paste it into the chat with your coach'
      : how === 'mail' ? 'Opening your mail app…'
      : 'Could not send — use Preview and copy it by hand');
    draw();
  }

  function doPreview() {
    const text = buildReport({ offsetWeeks: offset });
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `
      <div class="overlay-card scroll">
        <div class="eyebrow">What gets sent</div>
        <h2 style="margin:6px 0 10px;">Report preview</h2>
        <pre class="report-pre">${esc(text)}</pre>
        <button class="btn" id="dl" style="margin-top:12px;">Save as file</button>
        <button class="btn ghost" id="close" style="margin-top:8px;">Close</button>
      </div>`;
    host.appendChild(ov);
    ov.querySelector('#close').addEventListener('click', () => ov.remove());
    ov.querySelector('#dl').addEventListener('click', () => downloadReport(text));
  }

  function toast(msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
    host.appendChild(t);
    setTimeout(() => t.classList.add('go'), 10);
    setTimeout(() => t.remove(), 3600);
  }

  draw();
}
