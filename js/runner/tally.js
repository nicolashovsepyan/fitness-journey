/* ============================================================
   THE TALLY — what a timer workout added up to, and what it did last time.
   Reps per move, total reps, and the load: the weight added, plus the part
   of the person's own body each bodyweight move lifts (a push-up lifts
   about two thirds of you, a pull-up nearly all of you). Saved per person
   on this device, so the same timer next time can say "last time".
   ============================================================ */
import { storage } from '../core/storage.js';
import { activeUserId } from '../users.js';
import { EXERCISES } from '../data/exercises.js';

const LB = 2.20462;

/* BODY WEIGHT: the dashboard's latest weigh-in, else the onboarding
   weight, else what a guest typed on the result screen */
export function bodyWeight() {
  const uid = activeUserId();
  try {
    const dash = JSON.parse(localStorage.getItem(`fj.v1.${uid}.dash`) || 'null');
    const last = dash?.weights?.length ? Number(dash.weights[dash.weights.length - 1][1]) : null;
    if (last > 0) return { kg: last, unit: dash.unit || profileUnit(uid) || 'lb', from: 'dashboard' };
  } catch (e) {}
  try {
    const p = JSON.parse(localStorage.getItem(`fj.v1.profile.${uid}`) || 'null');
    if (Number(p?.a?.weightKg) > 0) return { kg: Number(p.a.weightKg), unit: p.a.unit || 'lb', from: 'profile' };
  } catch (e) {}
  try { const g = JSON.parse(localStorage.getItem('fj.timerBody') || 'null'); if (g?.kg > 0) return { ...g, from: 'timer' }; } catch (e) {}
  return null;
}
function profileUnit(uid) { try { return JSON.parse(localStorage.getItem(`fj.v1.profile.${uid}`) || 'null')?.a?.unit; } catch (e) { return null; } }
export function setTimerBodyWeight(value, unit) {
  try { localStorage.setItem('fj.timerBody', JSON.stringify({ kg: unit === 'kg' ? value : value / LB, unit })); } catch (e) {}
}

/* the share of body weight a bodyweight move lifts (rough, published
   figures); 0 for holds and moves where it means little */
export function bodyShare(ex, name = '') {
  if (!ex && !name) return 0;
  if (ex && ex.measure === 'hold') return 0;
  const n = `${ex?.name || ''} ${name} ${ex?.family || ''} ${ex?.pattern || ''}`.toLowerCase();
  if (/plank|hold|hang|sit-up|sit up|crunch|bridge|bird|dead bug|cat|stretch|mobility|carry/.test(n)) return 0;
  if (/muscle.?up|pull.?up|chin.?up|\bdip/.test(n)) return 0.95;
  if (/pike|handstand|hspu/.test(n)) return 0.7;
  if (/push.?up|press.?up/.test(n)) return 0.64;
  if (/squat|lunge|step.?up|pistol|split/.test(n)) return 0.7;
  if (/row/.test(n)) return 0.6;
  if (/burpee/.test(n)) return 0.5;
  return 0;
}

/* one move's load in kg: reps × (added weight + body share) */
export function moveLoadKg(item, reps, body) {
  const ex = item.exId ? EXERCISES[item.exId] : null;
  const added = Number(item.weight) > 0 ? (item.wUnit === 'kg' ? Number(item.weight) : Number(item.weight) / LB) : 0;
  const bw = body ? body.kg * bodyShare(ex, item.name) : 0;
  return reps * (added + bw);
}
export const showWeight = (kg, unit) => unit === 'kg' ? `${Math.round(kg).toLocaleString()} kg` : `${Math.round(kg * LB).toLocaleString()} lb`;
export const needsBody = items => items.some(it => bodyShare(it.exId ? EXERCISES[it.exId] : null, it.name) > 0);

/* HISTORY of timer workouts, per person on this device. `sig` is the timer
   itself (its type and its moves), so "last time" is the same workout. */
const KEY = () => `quickHistory.${activeUserId() || 'guest'}`;
export async function readHistory() { try { return (await storage().getDevicePref(KEY(), [])) || []; } catch (e) { return []; } }
export async function addHistory(rec) {
  const h = await readHistory();
  h.unshift(rec);
  try { await storage().setDevicePref(KEY(), h.slice(0, 80)); } catch (e) {}
}
export const sigOf = (fmt, names) => `${fmt}|${names.map(n => String(n || '').toLowerCase().trim()).filter(Boolean).join('+')}`;
