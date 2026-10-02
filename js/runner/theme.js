/* ============================================================
   WORK MODE THEME — the dashboard's colours, in the timer.

   The dashboard owns the look: a dark ground, and three colour slots the
   user fills from spine/theme.json's palettes (buttons & rings, glow &
   edges, coach). This reads the SAME choice the dashboard saved, so the
   timer changes colour when the user changes it there. Nothing to keep
   in step by hand.

   Applied as the `wm` class on <html> while Work Mode or the Quick Timer
   is on screen. It redefines the app shell's variables (styles.css) under
   that class, so the rest of the old shell is untouched.

   Phase colours: work = the accent, rest = the neon, get ready = gold.
   House rule from the dashboard kept: neon is structure and glow only,
   never a button, never body text.
   ============================================================ */
import { activeUserId } from '../users.js';

/* the defaults, and the fallback when theme.json can't be read (offline) */
const DEFAULT = { accent: '#3ECBA8', neon: '#FF5FA2' };
let theme = null;

const rgba = (hex, a) => {
  const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.replace(/./g, c => c + c) : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/* the dashboard's weekly shuffle, same seed, so "random" agrees across pages */
function weeklyPick(palettes) {
  const wk = Math.floor((Date.now() - new Date(2026, 0, 1)) / 6048e5);
  const pool = palettes.map(p => p.id); const out = []; let n = wk;
  for (let i = 0; i < 3; i++) { n = (n * 9301 + 49297) % 233280; out.push(pool.splice(n % pool.length, 1)[0]); }
  return { accent: out[0], neon: out[1], coach: out[2] };
}

/* THE VIBE: { slots, glow, themeRandom }. ONE choice for the whole app: a
   signed-in person's lives in the dashboard's own record (its "Customize your
   vibe"), so picking a colour in the timer changes the dashboard too and the
   other way round. A guest timer keeps its own on the device. */
const vibeKey = () => activeUserId() ? `fj.v1.${activeUserId()}.dash` : 'fj.timerVibe';
export function getVibe() {
  try { return JSON.parse(localStorage.getItem(vibeKey()) || '{}') || {}; } catch (e) { return {}; }
}
export function setVibe(patch) {
  try {
    const rec = getVibe();                         // the whole dashboard record: change only these fields
    if (patch.slots) rec.slots = { ...(rec.slots || {}), ...patch.slots };
    if ('glow' in patch) rec.glow = patch.glow;
    if ('themeRandom' in patch) rec.themeRandom = patch.themeRandom;
    localStorage.setItem(vibeKey(), JSON.stringify(rec));
  } catch (e) {}
  paint();
}
/* what the settings sheet shows: the palettes, the two slots the timer uses,
   and what is picked right now */
export function vibeOptions() {
  const t = theme || { palettes: [], slots: [] };
  return { palettes: t.palettes, slots: t.slots.filter(sl => sl.id !== 'coach'), pick: currentPick(), vibe: getVibe() };
}
function currentPick() {
  if (!theme) return {};
  const dash = getVibe();
  return dash.themeRandom ? weeklyPick(theme.palettes)
    : Object.assign(Object.fromEntries(theme.slots.map(s => [s.id, s.default])), dash.slots || {});
}
function colours() {
  if (!theme) return DEFAULT;
  const dash = getVibe();
  const pick = currentPick();
  const hex = id => (theme.palettes.find(p => p.id === id) || theme.palettes[0]).hex;
  return { accent: hex(pick.accent), neon: hex(pick.neon), glow: dash.glow };
}

export async function applyWorkTheme() {
  document.documentElement.classList.add('wm');
  injectStyle();
  paint();
  if (!theme) {
    try {
      const r = await fetch('spine/theme.json', { cache: 'no-cache' });
      if (r.ok) { const t = await r.json(); if (t.palettes && t.slots) theme = t; }
    } catch (e) { /* offline: the defaults already painted are the dashboard's defaults */ }
    paint();
  }
}
export function clearWorkTheme() { document.documentElement.classList.remove('wm'); }

function paint() {
  const c = colours(); const s = document.documentElement.style;
  const k = { soft: 0.45, normal: 1, bold: 1.5 }[c.glow] ?? 1;
  s.setProperty('--wm-accent', c.accent);
  s.setProperty('--wm-accent-soft', rgba(c.accent, 0.14));
  s.setProperty('--wm-neon', c.neon);
  s.setProperty('--wm-neon-soft', rgba(c.neon, 0.13));
  s.setProperty('--wm-neon-line', rgba(c.neon, 0.34));
  s.setProperty('--wm-accent-wash', rgba(c.accent, 0.30));
  s.setProperty('--wm-neon-wash', rgba(c.neon, 0.28));
  s.setProperty('--wm-glow-accent', `0 0 ${Math.round(22 * k)}px ${rgba(c.accent, 0.35)}`);
  s.setProperty('--wm-glow-neon', `0 0 ${Math.round(22 * k)}px ${rgba(c.neon, 0.3)}`);
}

function injectStyle() {
  if (document.getElementById('wm-theme')) return;
  const st = document.createElement('style'); st.id = 'wm-theme';
  st.textContent = `
  html.wm {
    --bg: #171A1E; --bg-2: #1E232A; --box: #212630; --box-2: #282E38;
    --line: #2F3640; --text: #ECEFF3; --muted: #A9B2BC; --faint: #858E99;
    --accent: var(--wm-accent); --accent-dim: var(--wm-accent-soft);
    --good: var(--wm-neon); --warn: #D9A94C;
  }
  html.wm body { background: var(--bg); }
  html.wm .btn:not(.ghost):not(.secondary) { color: #0C1512; }
  html.wm .btn.lg:not(.ghost):not(.secondary) { box-shadow: var(--wm-glow-accent); }
  html.wm .timer .read .t { letter-spacing: -0.02em; }
  html.wm .run-head { border-bottom: 1px solid var(--wm-neon-soft); }
  html.wm .wprog-fill { background: linear-gradient(90deg, var(--wm-neon), var(--wm-accent)); }
  html.wm .bchip.now { background: var(--wm-accent); color: #0C1512; }
  html.wm .sessclock { color: var(--wm-accent); }
  html.wm .overlay-card { border: 1px solid var(--wm-neon-line); box-shadow: var(--wm-glow-neon); }
  /* GLANCE MODE: the screen wears the phase. A wash of colour from the top,
     a bigger ring, bigger digits. Work = accent, rest = neon, ready = gold. */
  html.wm[data-phase] body { transition: background .35s ease; }
  html.wm[data-phase="work"] body { background: radial-gradient(130% 80% at 50% 0%, var(--wm-accent-wash), var(--bg) 70%) var(--bg); }
  html.wm[data-phase="rest"] body { background: radial-gradient(130% 80% at 50% 0%, var(--wm-neon-wash), var(--bg) 70%) var(--bg); }
  html.wm[data-phase="ready"] body { background: radial-gradient(130% 80% at 50% 0%, rgba(217,169,76,.26), var(--bg) 70%) var(--bg); }
  html.wm .screen.run { background: transparent; }
  html.wm[data-phase] .timer { width: min(76vw, 300px); height: min(76vw, 300px); }
  html.wm[data-phase="work"] .now-ex .label { color: var(--wm-accent); }
  html.wm[data-phase="rest"] .now-ex .label { color: var(--wm-neon); }
  html.wm[data-phase="ready"] .now-ex .label { color: #D9A94C; }
  /* one block (most Quick Timers): no progress bar or block strip to read */
  html.wm .screen.run.single .wprog-row, html.wm .screen.run.single .blockstrip { display: none; }
  /* screen flash at the end of a step, softer at 10 seconds */
  html.wm.wm-flash body::after, html.wm.wm-flash-soft body::after { content:""; position: fixed; inset: 0; z-index: 90; pointer-events: none;
    background: #fff; animation: wmFlash .45s ease-out forwards; }
  html.wm.wm-flash-soft body::after { background: var(--wm-accent); animation-duration: .35s; }
  @keyframes wmFlash { from { opacity: .55; } to { opacity: 0; } }
  /* pause */
  html.wm .pausebtn { display:inline-flex; align-items:center; }
  html.wm .wm-paused-ov { position: fixed; inset: 0; z-index: 70; background: rgba(8,10,12,.78); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    display:flex; align-items:center; justify-content:center; padding: 24px; }
  html.wm .wm-paused-card { width: 100%; max-width: 380px; text-align:center; }
  html.wm .wm-paused-t { font-family: var(--tnum); font-size: 72px; font-weight: 800; letter-spacing: -0.04em; margin: 6px 0 2px; color: var(--text); text-shadow: var(--wm-glow-neon); }
  html.wm .wm-paused-card .muted { margin: 0 0 22px; }
  /* settings sheet */
  html.wm .wm-sheet { position: fixed; inset: 0; z-index: 80; background: rgba(8,10,12,0); display:flex; align-items:flex-end; transition: background .18s; }
  html.wm .wm-sheet.open { background: rgba(8,10,12,.62); }
  html.wm .wm-sheet-card { width:100%; max-width: 560px; margin: 0 auto; background: var(--bg-2); border-top: 1px solid var(--wm-neon-line);
    border-radius: 22px 22px 0 0; padding: 10px 16px calc(18px + env(safe-area-inset-bottom)); box-shadow: var(--wm-glow-neon);
    transform: translateY(100%); transition: transform .2s cubic-bezier(.22,1,.36,1); }
  html.wm .wm-sheet.open .wm-sheet-card { transform: none; }
  html.wm .wm-sheet-h { text-align:center; color: var(--muted); font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; padding: 8px 0 10px; }
  html.wm .wm-pref { width:100%; display:flex; align-items:center; gap: 14px; text-align:left; background:none; border:none; border-top: 1px solid var(--line);
    color: var(--text); padding: 14px 2px; cursor:pointer; }
  html.wm .wm-pref span { flex:1; display:flex; flex-direction:column; }
  html.wm .wm-pref b { font-size: 16px; } html.wm .wm-pref small { color: var(--muted); font-size: 13px; margin-top: 2px; }
  html.wm .wm-sw { flex:none; width: 48px; height: 28px; border-radius: 99px; background: var(--box-2); border: 1px solid var(--line); position: relative; transition: background .15s; }
  html.wm .wm-sw:after { content:""; position:absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: var(--muted); transition: transform .15s, background .15s; }
  html.wm .wm-sw.on { background: var(--wm-accent-soft); border-color: var(--wm-accent); }
  html.wm .wm-sw.on:after { transform: translateX(20px); background: var(--wm-accent); }
  html.wm .wm-sheet-card .btn { margin-top: 10px; }
  html.wm .wm-sheet-card { max-height: 88vh; overflow-y: auto; }
  html.wm .wm-sheet-sub { color: var(--muted); font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; margin: 18px 2px 4px; }
  html.wm .wm-vrow { padding: 12px 2px; border-top: 1px solid var(--line); }
  html.wm .wm-vl { display:flex; flex-direction:column; margin-bottom: 10px; }
  html.wm .wm-vl b { font-size: 16px; } html.wm .wm-vl small { color: var(--muted); font-size: 13px; margin-top: 2px; }
  html.wm .wm-sw6 { display:flex; gap: 10px; flex-wrap: wrap; }
  html.wm .wm-dot { width: 38px; height: 38px; border-radius: 50%; border: 2px solid transparent; background: var(--c); cursor:pointer;
    box-shadow: 0 0 12px color-mix(in srgb, var(--c) 45%, transparent); }
  html.wm .wm-dot.on { border-color: var(--text); outline: 2px solid var(--c); outline-offset: 2px; }
  html.wm .wm-rings { display:grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  html.wm .wm-ringopt { display:flex; flex-direction:column; align-items:center; gap: 4px; background: var(--box); border: 1px solid var(--line); border-radius: 14px; padding: 8px 4px 6px; color: var(--muted); font-size: 11.5px; font-weight: 600; cursor:pointer; }
  html.wm .wm-ringopt.on { border-color: var(--wm-accent); color: var(--wm-accent); background: var(--wm-accent-soft); }
  html.wm .wm-mini { display:block; width: 58px; height: 58px; }
  html.wm .wm-mini .timer { width: 58px !important; height: 58px !important; }
  html.wm .wm-mini .read { display: none; }
  html.wm .wm-lab { display:block; text-align:center; text-decoration:none; margin-top: 10px; }
  html.wm .wm-seg3 { display:flex; gap: 6px; }
  html.wm .wm-seg3 button { flex:1; background: var(--box); border: 1px solid var(--line); border-radius: 10px; color: var(--text); padding: 10px 0; font-weight: 600; cursor:pointer; }
  html.wm .wm-seg3 button.on { border-color: var(--wm-accent); color: var(--wm-accent); background: var(--wm-accent-soft); }

  /* stopwatch laps / for-time round splits */
  html.wm .ft-total { text-align:center; color: var(--muted); font-family: var(--tnum); font-size: 18px; margin: -4px 0 8px; }
  html.wm .laps { max-width: 420px; margin: 0 auto 10px; }
  html.wm .lap { display:grid; grid-template-columns: 1fr auto 70px; gap: 10px; align-items: baseline; padding: 8px 4px; border-bottom: 1px solid var(--line); }
  html.wm .lap span { color: var(--muted); font-size: 14px; }
  html.wm .lap b { font-family: var(--tnum); font-size: 18px; color: var(--text); }
  html.wm .lap small { font-family: var(--tnum); color: var(--faint); font-size: 13px; text-align: right; }
  html.wm .lap:first-child b { color: var(--wm-accent); }
  /* the ring itself is drawn by js/runner/ring.js, every property inline */
  html.wm .timer.dial svg { transform: none; overflow: visible; }
  html.wm[data-phase] .timer.dial { width: min(80vw, 310px); height: min(80vw, 310px); }
  /* push-up test: the cue flips pink (down) / accent (up) on each beep */
  html.wm .cad { text-align:center; margin-top: 14px; }
  html.wm .cad-cue { font-size: 68px; font-weight: 800; letter-spacing: -0.03em; text-transform: uppercase; color: var(--muted); }
  html.wm .cad-cue.down { color: var(--wm-neon); text-shadow: var(--wm-glow-neon); }
  html.wm .cad-cue.go { color: #D9A94C; text-shadow: 0 0 22px rgba(217,169,76,.4); }
  html.wm .cad-start { margin-top: 8px; font-size: 18px; color: var(--muted); }
  html.wm .cad-start b { color: #D9A94C; }
  html.wm .cad-cue.up { color: var(--wm-accent); text-shadow: var(--wm-glow-accent); }
  html.wm .cad-reps { margin-top: 10px; }
  html.wm .cad-reps b { display:block; font-family: var(--tnum); font-size: 104px; line-height: 1; letter-spacing: -0.05em; }
  html.wm .cad-reps small { color: var(--muted); font-size: 13px; text-transform: uppercase; letter-spacing: .12em; }
  html.wm .cad-time { font-family: var(--tnum); color: var(--muted); font-size: 18px; margin-top: 14px; }
  html.wm .cad-how { font-size: 13px; margin: 18px 18px 0; line-height: 1.4; }
  `;
  document.head.appendChild(st);
}
