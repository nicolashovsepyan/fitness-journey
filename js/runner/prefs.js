/* ============================================================
   WORK MODE SETTINGS — how the timer talks to you.
   Device-local (a phone's sound choices are not a profile fact), read at
   boot, changed from the pause screen or the Quick Timer's gear.
   ============================================================ */
import { storage } from '../core/storage.js';
import { setVoice, setBeeps, say, beep, setSilentOverride } from '../timer.js';
import { setVoiceKind, studioVoices, studioReady } from '../voice.js';
import { t, lang, setLang } from '../i18n.js';
import { vibeOptions, setVibe } from './theme.js';
import { checkForUpdate, runningVersion } from '../update-banner.js';
import { PRESETS, designFor, ringChoice, chooseRing, ringHTML, ringBaseCss, setRingProgress } from './ring.js';

const KEY = 'workModePrefs';
const DEFAULTS = { voice: true, beeps: true, flash: true, ready: 8, silent: false, voiceKind: 'm', cues: true };
let prefs = { ...DEFAULTS };
let loaded = false;

export async function loadPrefs() {
  if (loaded) return prefs;
  try { prefs = { ...DEFAULTS, ...((await storage().getDevicePref(KEY, null)) || {}) }; } catch (e) {}
  loaded = true; apply();
  return prefs;
}
export const pref = k => prefs[k];
function apply() { setVoice(!!prefs.voice); setBeeps(!!prefs.beeps); setSilentOverride(!!prefs.silent); setVoiceKind(prefs.voiceKind); }
function set(k, v) {
  prefs[k] = v; apply();
  try { storage().setDevicePref(KEY, prefs); } catch (e) {}
}

const ROWS = [
  ['voice', 'Coach voice', 'Rounds, move names, halfway, last round, 1 minute left'],
  ['cues', 'Exercise cues', 'A short coaching tip the first time each move comes up'],
  ['beeps', 'Beeps', 'Countdown ticks, the end of each step, the 10-second warning'],
  ['flash', 'Screen flash', 'The screen flashes when a step ends. Handy in a loud gym'],
  ['silent', 'Sound on silent mode', 'Plays even with the silent switch on. iPhone pauses your music for it. Want both? Leave the switch off and turn on Do Not Disturb or a Focus: no distractions, music and timer together'],
];

/* CUSTOMIZE YOUR VIBE — the same three choices as the app's own: which
   palette fills each colour slot, how hard it glows, or a weekly shuffle.
   Saved with the app's choice (theme.js), so both always match. */
/* a small live ring for each preset, at 70% through */
function miniRing(p) {
  ringBaseCss();
  return `<span class="wm-mini">${ringHTML('work', designFor(p.id), '-m' + p.id).replace('stroke-dashoffset="0"', 'stroke-dashoffset="188"').replace('stroke-dashoffset="0"', 'stroke-dashoffset="188"').replace('>0:00<', '><')}</span>`;
}
/* the two colours, named by what they light in the timer (the dashboard
   calls the same two slots "Buttons & rings" and "Glow & edges") */
const SLOT_TEXT = { accent: ['Main color', 'Buttons and the work timer'], neon: ['Second color', 'The rest timer and highlights'] };
const slotName = sl => t((SLOT_TEXT[sl.id] || [sl.name])[0]);
const slotHint = sl => t((SLOT_TEXT[sl.id] || [, sl.hint])[1]);
/* a live preview: the chosen ring in its three phases */
function phasePreview() {
  ringBaseCss();
  const d = designFor(ringChoice());
  const one = (cls, label) => `<span class="wm-ph"><span class="wm-mini">${ringHTML(cls, d, '-p' + cls).replace(/stroke-dashoffset="0"/g, 'stroke-dashoffset="188"').replace('>0:00<', '><')}</span><small>${t(label)}</small></span>`;
  return `<div class="wm-phases">${one('ready', 'Get ready')}${one('work', 'Work')}${one('rest', 'Rest')}</div>`;
}
function vibeHtml() {
  const { palettes, slots, pick, vibe } = vibeOptions();
  const cur = ringChoice();
  if (!palettes.length) return '';
  const glow = vibe.glow || 'normal';
  return `<div class="wm-sheet-sub">${t('Colors')}</div>
    ${phasePreview()}
    <p class="wm-note">${t('Get ready is always blue. These are the same colors as your Fitness Journey app.')}</p>
    <button class="wm-lookrow" data-look="1">${miniRing(PRESETS.find(p => p.id === cur) || PRESETS[0])}<span><b>${t('Timer look')}</b><small>${(PRESETS.find(p => p.id === cur) || PRESETS[0]).name} · ${t('swipe through the designs and colors')}</small></span><i>›</i></button>
    ${slots.map(sl => `<div class="wm-vrow"><div class="wm-vl"><b>${slotName(sl)}</b><small>${slotHint(sl)}</small></div>
      <div class="wm-sw6">${palettes.map(p => `<button class="wm-dot ${pick[sl.id] === p.id ? 'on' : ''}" style="--c:${p.hex}" data-vslot="${sl.id}:${p.id}" aria-label="${p.name}" title="${p.name}"></button>`).join('')}</div></div>`).join('')}
    <div class="wm-vrow"><div class="wm-vl"><b>${t('Glow strength')}</b><small>${t('How hard everything shines')}</small></div>
      <div class="wm-seg3">${[['soft', 'Soft'], ['normal', 'Normal'], ['bold', 'Bold']].map(([v, l]) => `<button class="${glow === v ? 'on' : ''}" data-vglow="${v}">${t(l)}</button>`).join('')}</div></div>
    <button class="btn ${vibe.themeRandom ? '' : 'secondary'}" data-vshuffle="1">${vibe.themeRandom ? t('Shuffling weekly. Turn off') : t('Surprise me every week')}</button>`;
}

/* is this the coach's phone? (the coach console has run here, or the lab
   has been opened here once) — the only place "Edit designs" shows */
export function isCoachDevice() {
  try { return localStorage.getItem('fj.coachDevice') === '1' || !!localStorage.getItem('fj.coach.seeded') || !!localStorage.getItem('fj.coach.client'); } catch (e) { return false; }
}

/* THE TIMER LOOK. Each design at the size it is in a workout, the clock
   running, swiped left and right; the colours underneath, swiped too, and
   the rings change as you tap. "Use this look" keeps it. */
export function openLook(host, onDone) {
  ringBaseCss();
  const ids = PRESETS.map(p => p.id);
  let idx = Math.max(0, ids.indexOf(ringChoice())), raf = 0;
  const ov = document.createElement('div'); ov.className = 'wm-look';
  const slides = () => PRESETS.map(p => `<div class="wm-slide"><div class="wm-bigring">${ringHTML('work', designFor(p.id), '-l' + p.id)}</div>
    <b>${p.name}</b><small>${p.note}</small></div>`).join('');
  const strips = () => {
    const { palettes, slots, pick } = vibeOptions();
    return slots.map(sl => `<div class="wm-strip"><div class="wm-stl">${slotName(sl)}</div><div class="wm-swipe">${palettes.map(p => `<button class="wm-dot ${pick[sl.id] === p.id ? 'on' : ''}" style="--c:${p.hex}" data-lslot="${sl.id}:${p.id}" aria-label="${p.name}"><span>${p.name}</span></button>`).join('')}</div></div>`).join('');
  };
  ov.innerHTML = `<div class="wm-look-top"><button class="wm-look-x" aria-label="${t('Back')}">‹</button><b>${t('Timer look')}</b>
      <span></span></div>
    <div class="wm-car" id="lookCar">${slides()}</div>
    <div class="wm-dots">${ids.map((_, i) => `<i class="${i === idx ? 'on' : ''}"></i>`).join('')}</div>
    <div class="wm-strips" id="lookStrips">${strips()}</div>
    <div class="wm-look-bar"><button class="btn lg" id="lookUse">${t('Use this look')}</button></div>`;
  host.appendChild(ov);
  const car = ov.querySelector('#lookCar');
  requestAnimationFrame(() => { car.scrollLeft = idx * car.clientWidth; ov.classList.add('open'); });
  const dots = () => ov.querySelectorAll('.wm-dots i').forEach((d, i) => d.classList.toggle('on', i === idx));
  car.addEventListener('scroll', () => { const i = Math.round(car.scrollLeft / Math.max(1, car.clientWidth)); if (i !== idx) { idx = i; dots(); } }, { passive: true });
  ov.querySelectorAll('.wm-dots i').forEach((d, i) => d.addEventListener('click', () => car.scrollTo({ left: i * car.clientWidth, behavior: 'smooth' })));
  const wireStrips = () => ov.querySelectorAll('[data-lslot]').forEach(b => b.addEventListener('click', () => {
    const [slot, pal] = b.dataset.lslot.split(':'); setVibe({ slots: { [slot]: pal }, themeRandom: false });
    ov.querySelector('#lookStrips').innerHTML = strips(); wireStrips();
  }));
  wireStrips();
  /* the clock runs on every ring, the way it will in a workout */
  const fmt = n => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
  const loop = t => {
    const frac = 1 - ((t / 12000) % 1);
    ov.querySelectorAll('.wm-bigring .timer').forEach(el => { setRingProgress(el, frac); const tx = el.querySelector('.t'); if (tx) tx.textContent = fmt(Math.ceil(frac * 45)); });
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  const close = () => { cancelAnimationFrame(raf); ov.classList.remove('open'); setTimeout(() => ov.remove(), 200); onDone?.(); };
  ov.querySelector('.wm-look-x').addEventListener('click', close);
  ov.querySelector('#lookUse').addEventListener('click', () => { chooseRing(ids[idx]); refreshRings(); close(); });
}

/* a running timer redraws its ring when the design changes */
function refreshRings() { document.dispatchEvent(new CustomEvent('fj-ring-changed')); }

/* the settings sheet, on top of whatever is on screen */
export function openPrefs(host) {
  const ov = document.createElement('div'); ov.className = 'wm-sheet';
  const draw = () => {
    ov.innerHTML = `<div class="wm-sheet-card">
      <div class="wm-sheet-h">${t('Timer settings')}</div>
      <div class="wm-vrow"><div class="wm-vl"><b>${t('Language')}</b><small>${t('The whole app, and the coach voice')}</small></div>
        <div class="wm-seg3">${[['en', 'English'], ['fr', 'Français']].map(([v, l]) => `<button class="${lang() === v ? 'on' : ''}" data-lang="${v}">${l}</button>`).join('')}</div></div>
      <div class="wm-vrow wm-readyrow"><div class="wm-vl"><b>${t('Get-ready countdown')}</b><small>${t('Seconds to get in position before every timer starts')}</small></div>
        <div class="wm-rstep"><button data-rd="-1" aria-label="Less">−</button><b>${prefs.ready}s</b><button data-rd="1" aria-label="More">+</button></div></div>
      <div class="wm-vrow wm-vkrow"><div class="wm-vl"><b>${t('Coach voice')}</b><small>${studioVoices().length ? t('Pick who coaches you. Studio voices speak English; in French the coach is Nico.') : t("Nico's voice, or the same coaching in a female voice")}</small></div>
        <div class="wm-vks">${[['m', t('Nico'), t('Male')], ['f', t('Nico'), t('Female')], ...studioVoices().map(v => [v.id, v.label, `${t(v.kind === 'f' ? 'Female' : 'Male')} · ${t(v.accent)}`])]
          .map(([v, l, sub]) => `<button class="${prefs.voiceKind === v ? 'on' : ''}" data-vk="${v}"><b>${l}</b><small>${sub}</small></button>`).join('')}</div></div>
      ${ROWS.map(([k, name, sub]) => `<button class="wm-pref" data-pref="${k}">
        <span><b>${t(name)}</b><small>${t(sub)}</small></span><i class="wm-sw ${prefs[k] ? 'on' : ''}"></i></button>`).join('')}
      ${vibeHtml()}
      <div class="wm-sheet-sub">${t('App')}</div>
      <div class="wm-vrow wm-ver"><div class="wm-vl"><b>${t('Version')}</b><small id="wmVer">…</small></div>
        <button class="btn secondary" id="wmCheck">${t('Check for updates')}</button></div>
      <button class="btn" id="wmPrefDone">${t('Done')}</button>
    </div>`;
    ov.querySelectorAll('[data-pref]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.pref; set(k, !prefs[k]);
      if (k === 'voice' && prefs.voice) say(t('Voice on.'));
      if (k === 'beeps' && prefs.beeps) beep('go');
      draw();
    }));
    ov.querySelector('#wmPrefDone').addEventListener('click', close);
    /* a new language: everything on screen redraws in it */
    ov.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => { setLang(b.dataset.lang); draw(); }));
    ov.querySelectorAll('[data-vk]').forEach(b => b.addEventListener('click', () => { set('voiceKind', b.dataset.vk); say('Get ready.'); draw(); }));
    ov.querySelectorAll('[data-rd]').forEach(b => b.addEventListener('click', () => { set('ready', Math.max(0, Math.min(30, (prefs.ready ?? 8) + Number(b.dataset.rd)))); draw(); }));
    if (!draw.studio) { draw.studio = 1; studioReady.then(() => { if (ov.isConnected) draw(); }); }
    runningVersion().then(v => { const el = ov.querySelector('#wmVer'); if (el) el.textContent = v || 'unknown'; });
    ov.querySelector('#wmCheck').addEventListener('click', async e => {
      e.currentTarget.textContent = t('Checking…');
      const newer = await checkForUpdate({ manual: true });
      if (newer) close(); else { const b = ov.querySelector('#wmCheck'); if (b) b.textContent = t('Check for updates'); }
    });
    ov.querySelectorAll('[data-vslot]').forEach(b => b.addEventListener('click', () => {
      const [slot, pal] = b.dataset.vslot.split(':'); setVibe({ slots: { [slot]: pal }, themeRandom: false }); draw();
    }));
    ov.querySelector('[data-look]')?.addEventListener('click', () => openLook(document.body, draw));
    /* THE LABS ARE THE COACH'S (labs.html: logo, ring, voice, dashboard),
       not part of the app. No button: five taps on Version open them. */
    let taps = 0, tapT = null;
    ov.querySelector('.wm-ver .wm-vl')?.addEventListener('click', () => {
      taps++; clearTimeout(tapT); tapT = setTimeout(() => { taps = 0; }, 1500);
      if (taps >= 5) location.href = 'labs.html';
    });
    ov.querySelectorAll('[data-vglow]').forEach(b => b.addEventListener('click', () => { setVibe({ glow: b.dataset.vglow }); draw(); }));
    ov.querySelector('[data-vshuffle]')?.addEventListener('click', () => { const v = vibeOptions(); setVibe({ themeRandom: !v.vibe.themeRandom, slots: v.pick }); draw(); });
  };
  const close = () => { ov.classList.remove('open'); setTimeout(() => ov.remove(), 180); };
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  draw();
  host.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('open'));
}
