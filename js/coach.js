/* ============================================================
   COACH REPORT — packages a week of training into plain markdown
   that Nicolas can paste straight into a chat with Claude and ask
   for a program adjustment.

   Everything that would need a judgement call is included raw:
   knee flags first (they change the program), then feedback, then
   notes, then what was actually lifted. No summarising away detail.

   DELIVERY: the app has no backend, so "send" means the OS share
   sheet (navigator.share) with a clipboard + mailto fallback. A
   truly unattended weekly email would need a server — see README.
   ============================================================ */
import { store, dayKey } from './store.js';
import { EXERCISES } from './data/exercises.js';
import {
  PROGRAM, HABITS, weekStartMs, weekDates, workoutsDone,
  habitCount, weekStreak, sessionsInWeek,
} from './beginner.js';
import { activeUser } from './users.js';

const nameOf = id => EXERCISES[id]?.name || id;
const dshort = iso => { try { return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); } catch (e) { return iso; } };

/* one set list → "10 @ 90lb · 10 @ 90lb · 8 @ 90lb" */
function setsLine(entry) {
  const sets = (entry.sets || []).filter(s => s.value != null && s.value !== '');
  if (!sets.length) return '–';
  return sets.map(s => {
    let t = String(s.value);
    if (s.side) t = `${s.side}${t}`;
    if (s.weight != null && s.weight !== '') t += ` @${s.weight}lb`;
    return t;
  }).join(' · ') + ` ${entry.unit || ''}`;
}

/* ---- the report ------------------------------------------- */
export function buildReport({ offsetWeeks = 0 } = {}) {
  const start = weekStartMs(offsetWeeks), end = start + 7 * 86400000;
  const dates = weekDates(offsetWeeks);
  const user = activeUser();
  const L = [];

  L.push(`# Training report — ${user.name}`);
  L.push(`Week of ${dshort(new Date(start).toISOString())} · program week ${store.programWeek()} of "${PROGRAM.name}"`);
  L.push('');

  /* --- knee flags FIRST: they are the thing that changes the program --- */
  const flags = store.flagsSince(start).filter(f => new Date(f.date + 'T00:00:00').getTime() < end);
  L.push('## ⚠️ Knee flags');
  if (!flags.length) L.push('None this week.');
  else flags.forEach(f => L.push(`- **${f.name || nameOf(f.exId)}** — flagged ${f.date}${f.text ? ` · "${f.text}"` : ''}`));
  const tally = store.flagTally();
  if (tally.length) {
    L.push('');
    L.push('Standing watch list (all time):');
    tally.forEach(t => L.push(`- ${t.name || nameOf(t.exId)} — flagged ${t.count}×, last ${t.last}`));
  }
  L.push('');

  /* --- consistency --- */
  const done = workoutsDone(offsetWeeks);
  const h = habitCount(offsetWeeks);
  L.push('## Consistency');
  L.push(`- Gym sessions: **${done} / ${PROGRAM.week.length}**`);
  L.push(`- Daily habits: **${h.daily} / ${h.dailyPossible}** ticked (${h.pct}%)`);
  L.push(`- Sport session: ${h.sport ? 'yes ✅' : 'not yet'}`);
  L.push(`- Week streak: **${weekStreak()}**`);
  L.push('');
  L.push('| Day | Walk | No food after 8pm | High-protein first meal | Sport |');
  L.push('| --- | :--: | :--: | :--: | :--: |');
  dates.forEach(d => {
    const x = store.getHabits(d);
    const m = v => (v ? '✅' : '·');
    L.push(`| ${d} | ${m(x.walk)} | ${m(x.no8pm)} | ${m(x.protein)} | ${m(x.sport)} |`);
  });
  L.push('');

  /* --- how the sessions felt --- */
  const fb = store.feedbackSince(start).filter(f => new Date(f.date + 'T00:00:00').getTime() < end);
  L.push('## How it felt');
  if (!fb.length) L.push('No session feedback recorded.');
  else fb.forEach(f => L.push(`- ${f.date} · **${f.name}** — ${f.rating || 'no rating'}${f.text ? ` · "${f.text}"` : ''}`));
  L.push('');

  /* --- his own notes --- */
  const notes = store.notesSince(start).filter(n => new Date(n.date + 'T00:00:00').getTime() < end);
  L.push('## His notes');
  if (!notes.length) L.push('No exercise notes this week.');
  else notes.forEach(n => L.push(`- ${n.date} · **${n.name || nameOf(n.exId)}** — "${n.text}"`));
  L.push('');

  /* --- what actually got lifted --- */
  const sessions = sessionsInWeek(offsetWeeks);
  L.push('## Completed sessions');
  if (!sessions.length) L.push('No sessions completed this week.');
  sessions.forEach(s => {
    const mins = Math.round((s.seconds || 0) / 60);
    L.push('');
    L.push(`### ${s.name} — ${dshort(s.date)} (${mins} min)`);
    (s.blocks || []).forEach(b => {
      const ents = (b.entries || []).filter(e => (e.sets || []).some(x => x.value != null && x.value !== ''));
      if (!ents.length) return;
      L.push(`**${b.name}**`);
      ents.forEach(e => L.push(`- ${e.name}: ${setsLine(e)}`));
    });
  });
  L.push('');

  /* --- the ask --- */
  L.push('## Ask');
  L.push('Given the above, what should change in the program for next week?');
  L.push('Constraints: knee — no treadmill, no running, no jumping, no deep knee flexion under load.');
  L.push('Priorities in order: (1) keep showing up, (2) build muscle and armour the joints, (3) lose weight over time.');
  L.push('Rules in force: stop 2–3 reps short of failure; add the smallest increment once the top rep number is hit on all sets;');
  L.push('push-ups progress by lowering the bar, dips by removing assistance, holds by making the movement harder — never longer.');

  return L.join('\n');
}

/* ---- delivery --------------------------------------------- */
export async function sendReport(text, { title = 'Training report' } = {}) {
  // 1. native share sheet — the one that can actually reach Nicolas from a phone
  try {
    if (navigator.share) { await navigator.share({ title, text }); markSent(); return 'shared'; }
  } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
  // 2. clipboard — paste straight into a Claude chat
  try {
    await navigator.clipboard.writeText(text);
    markSent(); return 'copied';
  } catch (e) {}
  // 3. last resort: hand it to the mail client
  try {
    location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text.slice(0, 1800))}`;
    markSent(); return 'mail';
  } catch (e) {}
  return 'failed';
}
function markSent() { store.setSetting('lastCoachSend', new Date().toISOString()); }

/* Automatic weekly summary: with no backend the app cannot push on its own,
   so it *prompts* instead — from Sunday onward, once per week, until sent. */
export function weeklyPromptDue() {
  const today = new Date();
  if (today.getDay() !== 0 && today.getDay() !== 1) return false;   // Sunday or Monday
  const last = store.getSetting('lastCoachSend');
  if (!last) return true;
  return new Date(last).getTime() < weekStartMs(today.getDay() === 0 ? 0 : 1);
}

export function downloadReport(text) {
  const blob = new Blob([text], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `training-report-${dayKey()}.md`;
  a.click();
}
