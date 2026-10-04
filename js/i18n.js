/* ============================================================
   LANGUAGES — English and French (France).
   The English text in the code IS the key: t('Start') reads naturally and
   needs no table to understand; French lives in js/i18n-fr.js, written to
   docs/FRENCH.md (France, not Québec; "tu"; kg; decimal comma). A string
   with no French yet shows in English, never a blank or a key.

     t('Round {n}.', { n: 3 })   →  "Tour 3."
     exName(id, 'Push-ups')      →  "Pompes"
     num(2.5)                    →  "2,5"

   The language is per device: the phone's own language the first time,
   then whatever the person picks (Timer settings → Language).
   ============================================================ */
import { FR } from './i18n-fr.js';

const KEY = 'fj.lang';
let current = (() => {
  try { const s = localStorage.getItem(KEY); if (s === 'fr' || s === 'en') return s; } catch (e) {}
  try { return /^fr/i.test(navigator.language || '') ? 'fr' : 'en'; } catch (e) { return 'en'; }
})();
try { document.documentElement.lang = current; } catch (e) {}

export const lang = () => current;
export const isFr = () => current === 'fr';
export function setLang(l) {
  current = l === 'fr' ? 'fr' : 'en';
  try { localStorage.setItem(KEY, current); document.documentElement.lang = current; } catch (e) {}
  try { document.dispatchEvent(new CustomEvent('fj-lang', { detail: current })); } catch (e) {}
}

/* the text, in the current language, with {vars} filled in */
export function t(en, vars) {
  let s = current === 'fr' && FR[en] != null ? FR[en] : en;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
  return s;
}
/* one / many: t2(n, 'round', 'rounds') */
export const t2 = (n, one, many) => t(Number(n) === 1 || (current === 'fr' && Number(n) === 0) ? one : many, { n });

/* numbers the French way: 2,5 · 1 250 (narrow no-break space) */
export function num(n, digits = 1) {
  if (n == null || n === '') return '';
  const v = Number(n); if (!Number.isFinite(v)) return String(n);
  return v.toLocaleString(current === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits: digits });
}

/* EXERCISE NAMES and cues: js/data/exercises-fr.js, loaded once */
let FRX = null;
import('./data/exercises-fr.js').then(m => { FRX = m.EXERCISES_FR || null; }).catch(() => {});
export function exName(id, fallback = '') { return (current === 'fr' && id && FRX?.[id]?.name) || fallback; }
export function exCues(id, fallback = '') { return (current === 'fr' && id && FRX?.[id]?.cues) || fallback; }
