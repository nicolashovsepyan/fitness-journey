/* ============================================================
   ME — the person's own settings, asked once, used everywhere: lb or kg,
   body weight, age, male or female, language (Nico, 26 Oct 2026: "not all
   moments offer lb / kg… ask once, show it is in settings, no switching").

   ONE PLACE PER PERSON. A signed-in person already has a profile (the
   onboarding survey, the dashboard's lb / kg): these are read from and
   written to it (fj.v1.profile.<uid>.a: unit, weightKg, age, sex), so the
   dashboard and the timer always agree. A guest timer keeps them on the
   device (fj.me). Weight is kept in kg; shown in the person's unit.
   ============================================================ */
import { activeUserId } from './users.js';
import { lang, setLang } from './i18n.js';

const LB = 2.20462;
const GUEST = 'fj.me', ASKED = 'fj.meAsked';
const uid = () => { const u = activeUserId(); return u && u !== 'demo' && u !== 'guest' ? u : null; };
const pKey = u => `fj.v1.profile.${u}`;
const read = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

/* the latest weigh-in on the dashboard (kg), if any */
function dashWeight(u) {
  const d = read(`fj.v1.${u}.dash`);
  const last = d?.weights?.length ? Number(d.weights[d.weights.length - 1][1]) : 0;
  return last > 0 ? last : 0;
}
export function getMe() {
  const u = uid();
  const g = read(GUEST) || {};
  const legacy = read('fj.timerBody');            // the weight a guest typed on a result screen, before this existed
  let me;
  if (u) {
    const a = read(pKey(u))?.a || {};
    me = { unit: a.unit || g.unit, weightKg: dashWeight(u) || Number(a.weightKg) || g.weightKg || 0, age: Number(a.age) || g.age || 0, sex: a.sex || g.sex || '' };
  } else me = { unit: g.unit || legacy?.unit, weightKg: g.weightKg || legacy?.kg || 0, age: g.age || 0, sex: g.sex || '' };
  me.unit = me.unit === 'kg' ? 'kg' : 'lb';
  me.lang = lang();
  return me;
}
export const unit = () => getMe().unit;
/* asked yet on this device? (everyone sees it once, prefilled with what is known) */
export const meAsked = () => { try { return !!localStorage.getItem(ASKED); } catch (e) { return true; } };
export function markMeAsked() { try { localStorage.setItem(ASKED, new Date().toISOString()); } catch (e) {} }

export function setMe(patch) {
  const before = getMe();
  const u = uid();
  const g = read(GUEST) || {};
  ['unit', 'weightKg', 'age', 'sex'].forEach(k => { if (k in patch) g[k] = patch[k]; });
  write(GUEST, g);                                 // always: a sign-out keeps the device's choice
  if (u) {
    const p = read(pKey(u));
    if (p) { p.a = p.a || {}; ['unit', 'weightKg', 'age', 'sex'].forEach(k => { if (k in patch) p.a[k] = patch[k]; }); p.at = new Date().toISOString(); write(pKey(u), p); }
  }
  if ('weightKg' in patch) write('fj.timerBody', { kg: patch.weightKg, unit: patch.unit || before.unit });
  if (patch.lang && patch.lang !== lang()) setLang(patch.lang);
  if ('unit' in patch && patch.unit !== before.unit) { try { document.dispatchEvent(new CustomEvent('fj-unit', { detail: patch.unit })); } catch (e) {} }
}

/* weights in the person's unit */
export const toUnit = (kg, u = unit()) => u === 'kg' ? kg : kg * LB;
export const fromUnit = (v, u = unit()) => u === 'kg' ? v : v / LB;
/* a weight given in one unit, in another: kg to the half kilo (35 lb is a
   16 kg bell, and back again), lb to the 5 lb plate */
export function convertWeight(v, from, to) {
  if (!(v > 0) || from === to) return v;
  return to === 'kg' ? Math.max(0.5, Math.round(v / LB * 2) / 2) : Math.max(5, Math.round(v * LB / 5) * 5);
}
