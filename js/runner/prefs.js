/* ============================================================
   WORK MODE SETTINGS — how the timer talks to you.
   Device-local (a phone's sound choices are not a profile fact), read at
   boot, changed from the pause screen or the Quick Timer's gear.
   ============================================================ */
import { storage } from '../core/storage.js';
import { setVoice, setBeeps, say, beep } from '../timer.js';
import { vibeOptions, setVibe } from './theme.js';
import { checkForUpdate, runningVersion } from '../update-banner.js';

const KEY = 'workModePrefs';
const DEFAULTS = { voice: true, beeps: true, flash: true, ring: 'tube' };
const RINGS = [['tube', 'Neon tube'], ['led', 'LED'], ['clean', 'Clean']];
let prefs = { ...DEFAULTS };
let loaded = false;

export async function loadPrefs() {
  if (loaded) return prefs;
  try { prefs = { ...DEFAULTS, ...((await storage().getDevicePref(KEY, null)) || {}) }; } catch (e) {}
  loaded = true; apply();
  return prefs;
}
export const pref = k => prefs[k];
function apply() {
  setVoice(!!prefs.voice); setBeeps(!!prefs.beeps);
  const el = document.documentElement;
  RINGS.forEach(([id]) => el.classList.toggle('ring-' + id, prefs.ring === id));
}
function set(k, v) {
  prefs[k] = v; apply();
  try { storage().setDevicePref(KEY, prefs); } catch (e) {}
}

const ROWS = [
  ['voice', 'Coach voice', 'Move names, halfway, last round, 1 minute left'],
  ['beeps', 'Beeps', 'Countdown ticks, the end of each step, the 10-second warning'],
  ['flash', 'Screen flash', 'The screen flashes when a step ends. Handy in a loud gym'],
];

/* CUSTOMIZE YOUR VIBE — the same three choices as the app's own: which
   palette fills each colour slot, how hard it glows, or a weekly shuffle.
   Saved with the app's choice (theme.js), so both always match. */
function vibeHtml() {
  const { palettes, slots, pick, vibe } = vibeOptions();
  if (!palettes.length) return '';
  const glow = vibe.glow || 'normal';
  return `<div class="wm-sheet-sub">Customize your vibe</div>
    <div class="wm-vrow"><div class="wm-vl"><b>Timer ring</b><small>How the countdown circle is drawn</small></div>
      <div class="wm-seg3">${RINGS.map(([v, l]) => `<button class="${prefs.ring === v ? 'on' : ''}" data-vring="${v}">${l}</button>`).join('')}</div></div>
    ${slots.map(sl => `<div class="wm-vrow"><div class="wm-vl"><b>${sl.name}</b><small>${sl.hint}</small></div>
      <div class="wm-sw6">${palettes.map(p => `<button class="wm-dot ${pick[sl.id] === p.id ? 'on' : ''}" style="--c:${p.hex}" data-vslot="${sl.id}:${p.id}" aria-label="${p.name}" title="${p.name}"></button>`).join('')}</div></div>`).join('')}
    <div class="wm-vrow"><div class="wm-vl"><b>Glow</b><small>How hard everything shines</small></div>
      <div class="wm-seg3">${[['soft', 'Soft'], ['normal', 'Normal'], ['bold', 'Bold']].map(([v, l]) => `<button class="${glow === v ? 'on' : ''}" data-vglow="${v}">${l}</button>`).join('')}</div></div>
    <button class="btn ${vibe.themeRandom ? '' : 'secondary'}" data-vshuffle="1">${vibe.themeRandom ? 'Shuffling weekly. Turn off' : 'Surprise me every week'}</button>`;
}

/* the settings sheet, on top of whatever is on screen */
export function openPrefs(host) {
  const ov = document.createElement('div'); ov.className = 'wm-sheet';
  const draw = () => {
    ov.innerHTML = `<div class="wm-sheet-card">
      <div class="wm-sheet-h">Timer settings</div>
      ${ROWS.map(([k, name, sub]) => `<button class="wm-pref" data-pref="${k}">
        <span><b>${name}</b><small>${sub}</small></span><i class="wm-sw ${prefs[k] ? 'on' : ''}"></i></button>`).join('')}
      ${vibeHtml()}
      <div class="wm-sheet-sub">App</div>
      <div class="wm-vrow wm-ver"><div class="wm-vl"><b>Version</b><small id="wmVer">…</small></div>
        <button class="btn secondary" id="wmCheck">Check for updates</button></div>
      <button class="btn" id="wmPrefDone">Done</button>
    </div>`;
    ov.querySelectorAll('[data-pref]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.pref; set(k, !prefs[k]);
      if (k === 'voice' && prefs.voice) say('Voice on.');
      if (k === 'beeps' && prefs.beeps) beep('go');
      draw();
    }));
    ov.querySelector('#wmPrefDone').addEventListener('click', close);
    runningVersion().then(v => { const el = ov.querySelector('#wmVer'); if (el) el.textContent = v || 'unknown'; });
    ov.querySelector('#wmCheck').addEventListener('click', async e => {
      e.currentTarget.textContent = 'Checking…';
      const newer = await checkForUpdate({ manual: true });
      if (newer) close(); else { const b = ov.querySelector('#wmCheck'); if (b) b.textContent = 'Check for updates'; }
    });
    ov.querySelectorAll('[data-vslot]').forEach(b => b.addEventListener('click', () => {
      const [slot, pal] = b.dataset.vslot.split(':'); setVibe({ slots: { [slot]: pal }, themeRandom: false }); draw();
    }));
    ov.querySelectorAll('[data-vring]').forEach(b => b.addEventListener('click', () => { set('ring', b.dataset.vring); draw(); }));
    ov.querySelectorAll('[data-vglow]').forEach(b => b.addEventListener('click', () => { setVibe({ glow: b.dataset.vglow }); draw(); }));
    ov.querySelector('[data-vshuffle]')?.addEventListener('click', () => { const v = vibeOptions(); setVibe({ themeRandom: !v.vibe.themeRandom, slots: v.pick }); draw(); });
  };
  const close = () => { ov.classList.remove('open'); setTimeout(() => ov.remove(), 180); };
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  draw();
  host.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('open'));
}
