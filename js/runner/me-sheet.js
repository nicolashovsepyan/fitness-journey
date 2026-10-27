/* ============================================================
   "SET UP YOUR TIMER": lb or kg, body weight, age, male or female,
   language. Once per device as the timer opens (prefilled with what is
   known), and any time from Timer settings → You. js/me.js keeps it.
   ============================================================ */
import { getMe, setMe, markMeAsked, toUnit, fromUnit } from '../me.js';
import { t, lang } from '../i18n.js';
import { attachSheet } from './sheet-close.js';

export function openMeSheet(host = document.body, { first = false, onDone } = {}) {
  const me = getMe();
  let u = me.unit, sex = me.sex, lg = lang();
  let wt = me.weightKg ? Math.round(toUnit(me.weightKg, u)) : '', age = me.age || '';
  const ov = document.createElement('div'); ov.className = 'wm-sheet';
  const seg = (attr, opts, cur) => `<div class="wm-seg3">${opts.map(([v, l]) => `<button class="${cur === v ? 'on' : ''}" data-${attr}="${v}">${l}</button>`).join('')}</div>`;
  const draw = () => {
    ov.innerHTML = `<div class="wm-sheet-card me-card">
      <div class="wm-sheet-h">${t(first ? 'Set up your timer' : 'You')}</div>
      ${first ? `<p class="me-intro">${t('Five quick answers, so every timer shows your weights and counts your load the right way.')}</p>` : ''}
      <div class="wm-vrow"><div class="wm-vl"><b>${t('Weights in')}</b></div>${seg('u', [['lb', t('Pounds (lb)')], ['kg', t('Kilos (kg)')]], u)}</div>
      <div class="wm-vrow me-nums">
        <label><b>${t('Body weight')}</b><span class="me-in"><input id="meW" type="number" inputmode="decimal" placeholder="–" value="${wt}"/><i>${u}</i></span><small>${t('Counts bodyweight moves in your load')}</small></label>
        <label><b>${t('Age')}</b><span class="me-in"><input id="meA" type="number" inputmode="numeric" placeholder="–" value="${age}"/></span><small>&nbsp;</small></label>
      </div>
      <div class="wm-vrow"><div class="wm-vl"><b>${t('You are')}</b></div>${seg('sex', [['m', t('Male')], ['f', t('Female')]], sex)}</div>
      <div class="wm-vrow"><div class="wm-vl"><b>${t('Language')}</b></div>${seg('lg', [['en', 'English'], ['fr', 'Français']], lg)}</div>
      <p class="me-where">⚙︎ ${t('You can change all of this anytime in Timer settings.')}</p>
      <button class="btn" id="meSave">${t(first ? "Let's go" : 'Save')}</button>
    </div>`;
    const w = ov.querySelector('#meW'), a = ov.querySelector('#meA');
    w.addEventListener('input', () => { wt = w.value; });
    a.addEventListener('input', () => { age = a.value; });
    ov.querySelectorAll('[data-u]').forEach(b => b.addEventListener('click', () => {
      const nu = b.dataset.u; if (nu === u) return;
      if (Number(wt) > 0) wt = Math.round(toUnit(fromUnit(Number(wt), u), nu));   // the same weight, in the new unit
      u = nu; draw();
    }));
    ov.querySelectorAll('[data-sex]').forEach(b => b.addEventListener('click', () => { sex = b.dataset.sex; draw(); }));
    ov.querySelectorAll('[data-lg]').forEach(b => b.addEventListener('click', () => { lg = b.dataset.lg; draw(); }));
    ov.querySelector('#meSave').addEventListener('click', () => {
      const kg = Number(wt) > 0 ? Math.round(fromUnit(Number(wt), u) * 10) / 10 : 0;
      setMe({ unit: u, weightKg: kg, age: Math.max(0, Math.min(110, Math.round(Number(age) || 0))), sex, lang: lg });
      markMeAsked(); close(); onDone?.();
    });
  };
  const close = () => { ov.classList.remove('open'); setTimeout(() => ov.remove(), 180); };
  /* the first time, it is answered (Let's go), not dismissed by a stray tap; it can still be swiped away */
  ov.addEventListener('click', e => { if (e.target === ov && !first) close(); });
  draw();
  attachSheet(ov, '.wm-sheet-card', () => { if (first) markMeAsked(); close(); onDone?.(); });
  host.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('open'));
}
/* the one line that sums it up, for the settings row */
export function meLine() {
  const me = getMe();
  return [me.weightKg ? '' : me.unit, me.weightKg ? `${Math.round(toUnit(me.weightKg, me.unit))} ${me.unit}` : '', me.age ? t('{n} years', { n: me.age }) : '', me.sex === 'f' ? t('Female') : me.sex === 'm' ? t('Male') : '', lang() === 'fr' ? 'Français' : 'English']
    .filter(Boolean).join(' · ');
}
