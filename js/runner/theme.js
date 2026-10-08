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

   Phase colours: work = the accent, rest = the neon, get ready = electric royal blue.
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
    --good: var(--wm-neon); --warn: var(--wm-ready); --wm-ready: #3D6BFF; --wm-ready-wash: rgba(61,107,255,.28);
  }
  html.wm body { background: var(--bg); }
  html.wm .btn:not(.ghost):not(.secondary) { color: #0C1512; }
  html.wm .btn.lg:not(.ghost):not(.secondary) { box-shadow: var(--wm-glow-accent); }
  html.wm .timer .read .t { letter-spacing: -0.02em; }
  html.wm .run-head { border-bottom: 1px solid var(--wm-neon-soft); }
  html.wm .run-head .blk { white-space: nowrap !important; overflow: hidden; text-overflow: ellipsis; }
  html.wm .wprog-fill { background: linear-gradient(90deg, var(--wm-neon), var(--wm-accent)); }
  html.wm .bchip.now { background: var(--wm-accent); color: #0C1512; }
  html.wm .sessclock { color: var(--wm-accent); }
  html.wm .overlay-card { border: 1px solid var(--wm-neon-line); box-shadow: var(--wm-glow-neon); }
  /* GLANCE MODE: the screen wears the phase. A wash of colour from the top,
     a bigger ring, bigger digits. Work = accent, rest = neon, ready = royal blue. */
  html.wm[data-phase] body { transition: background .35s ease; }
  html.wm[data-phase="work"] body { background: radial-gradient(130% 80% at 50% 0%, var(--wm-accent-wash), var(--bg) 70%) var(--bg); }
  html.wm[data-phase="rest"] body { background: radial-gradient(130% 80% at 50% 0%, var(--wm-neon-wash), var(--bg) 70%) var(--bg); }
  html.wm[data-phase="ready"] body { background: radial-gradient(130% 80% at 50% 0%, var(--wm-ready-wash), var(--bg) 70%) var(--bg); }
  html.wm .screen.run { background: transparent; }
  html.wm[data-phase] .timer { width: min(76vw, 300px); height: min(76vw, 300px); }
  html.wm[data-phase="work"] .now-ex .label { color: var(--wm-accent); }
  html.wm[data-phase="rest"] .now-ex .label { color: var(--wm-neon); }
  html.wm[data-phase="ready"] .now-ex .label { color: var(--wm-ready); }
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
  html.wm .wm-rings { display:grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  html.wm .wm-ringopt { display:flex; flex-direction:column; align-items:center; gap: 4px; background: var(--box); border: 1px solid var(--line); border-radius: 14px; padding: 8px 4px 6px; color: var(--muted); font-size: 11.5px; font-weight: 600; cursor:pointer; }
  html.wm .wm-ringopt.on { border-color: var(--wm-accent); color: var(--wm-accent); background: var(--wm-accent-soft); }
  html.wm .wm-mini { display:block; width: 58px; height: 58px; }
  html.wm .wm-phases { display:flex; justify-content: space-around; padding: 6px 0 2px; }
  html.wm .wm-ph { display:flex; flex-direction:column; align-items:center; gap: 4px; }
  html.wm .wm-ph small { color: var(--muted); font-size: 12px; font-weight: 700; }
  html.wm .wm-note { color: var(--faint); font-size: 12.5px; text-align:center; margin: 4px 0 10px; }
  html.wm .wm-mini .timer { width: 58px !important; height: 58px !important; }
  html.wm .wm-mini .read { display: none; }
  html.wm .wm-lab { display:block; text-align:center; text-decoration:none; margin-top: 10px; }
  /* settings row that opens the Timer look */
  html.wm .wm-lookrow { width:100%; display:flex; align-items:center; gap: 12px; text-align:left; background: var(--box); border: 1px solid var(--line); border-radius: 16px; padding: 10px 12px; margin: 6px 0; color: var(--text); cursor:pointer; }
  html.wm .wm-lookrow span { flex:1; display:flex; flex-direction:column; } html.wm .wm-lookrow b { font-size: 16px; } html.wm .wm-lookrow small { color: var(--muted); font-size: 12.5px; margin-top: 2px; }
  html.wm .wm-lookrow i { font-style: normal; font-size: 22px; color: var(--muted); }
  /* THE TIMER LOOK: full screen, real-size rings, swipe */
  html.wm .wm-look { position: fixed; inset: 0; z-index: 120; background: var(--bg); display:flex; flex-direction:column; opacity: 0; transform: translateY(16px); transition: opacity .2s, transform .2s;
    padding: calc(10px + env(safe-area-inset-top)) 0 calc(14px + env(safe-area-inset-bottom)); }
  html.wm .wm-look.open { opacity: 1; transform: none; }
  html.wm .wm-look-top { display:flex; align-items:center; justify-content:space-between; padding: 0 16px; }
  html.wm .wm-look-top b { font-size: 18px; }
  html.wm .wm-look-x { background:none; border:none; color: var(--muted); font-size: 30px; line-height: 1; padding: 4px 10px 4px 0; cursor:pointer; }
  html.wm .wm-look-edit { color: var(--wm-neon); font-size: 13px; font-weight: 800; text-decoration:none; border: 1px solid var(--wm-neon-line); border-radius: 999px; padding: 6px 12px; }
  html.wm .wm-car { flex: none; display:flex; overflow-x: auto; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; scrollbar-width: none; margin-top: 8px; }
  html.wm .wm-car::-webkit-scrollbar { display:none; }
  html.wm .wm-slide { flex: 0 0 100%; scroll-snap-align: center; display:flex; flex-direction:column; align-items:center; text-align:center; padding: 6px 16px; }
  html.wm .wm-bigring .timer { width: min(76vw, 310px); height: min(76vw, 310px); position: relative; }
  html.wm .wm-bigring .timer .read { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
  html.wm .wm-slide b { font-size: 22px; margin-top: 10px; } html.wm .wm-slide small { color: var(--muted); font-size: 13.5px; margin-top: 3px; }
  html.wm .wm-dots { display:flex; justify-content:center; gap: 8px; margin: 10px 0 4px; }
  html.wm .wm-dots i { width: 8px; height: 8px; border-radius: 50%; background: var(--line); cursor:pointer; }
  html.wm .wm-dots i.on { background: var(--wm-accent); box-shadow: 0 0 8px var(--wm-accent); width: 22px; border-radius: 99px; }
  html.wm .wm-strips { flex: 1; overflow-y: auto; padding: 4px 0; }
  html.wm .wm-strip { margin-top: 12px; }
  html.wm .wm-stl { padding: 0 16px; color: var(--muted); font-size: 11.5px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 8px; }
  html.wm .wm-swipe { display:flex; gap: 14px; overflow-x: auto; scroll-snap-type: x proximity; padding: 4px 16px 8px; scrollbar-width: none; }
  html.wm .wm-swipe::-webkit-scrollbar { display:none; }
  html.wm .wm-swipe .wm-dot { flex: none; width: 52px; height: 52px; scroll-snap-align: start; position: relative; }
  html.wm .wm-swipe .wm-dot span { position:absolute; top: 58px; left: 50%; transform: translateX(-50%); color: var(--muted); font-size: 11px; white-space: nowrap; }
  html.wm .wm-swipe { padding-bottom: 26px; }
  html.wm .wm-look-bar { padding: 8px 16px 0; }
  html.wm .wm-readyrow { display:flex; align-items:center; gap: 10px; border-top: none; }
  html.wm .wm-readyrow .wm-vl { flex: 1; margin: 0; }
  html.wm .wm-rstep { display:flex; align-items:center; background: var(--box); border: 1px solid var(--line); border-radius: 12px; }
  html.wm .wm-rstep button { width: 42px; height: 42px; background:none; border:none; color: var(--text); font-size: 22px; cursor:pointer; }
  html.wm .wm-rstep b { min-width: 42px; text-align:center; font-family: var(--tnum); font-size: 18px; color: var(--wm-ready); }
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
  /* AMRAP screen */
  html.wm .am-top { display:flex; align-items:center; justify-content:center; gap: 18px; }
  html.wm .am-ring .timer { width: min(52vw, 210px) !important; height: min(52vw, 210px) !important; }
  html.wm .am-ring .timer .read .t { font-size: min(12vw, 48px) !important; }
  html.wm .am-count { display:flex; flex-direction:column; align-items:center; min-width: 86px; }
  html.wm .am-count small { color: var(--muted); font-size: 11px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
  html.wm .am-count b { font-family: var(--tnum); font-size: 64px; line-height: 1; color: var(--text); display:inline-block; }
  html.wm .am-count span { color: var(--muted); font-size: 12px; text-align:center; margin-top: 4px; max-width: 110px; }
  html.wm .am-moves { background: var(--box); border-radius: 16px; padding: 6px 12px; margin-top: 10px; }
  html.wm .am-h { color: var(--wm-accent); font-size: 11.5px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; padding: 6px 0 2px; }
  html.wm .am-h small { color: var(--muted); text-transform: none; letter-spacing: 0; font-weight: 500; font-size: 12px; }
  html.wm .am-move { display:flex; align-items:center; gap: 8px; padding: 8px 0; border-top: 1px solid var(--line); }
  html.wm .am-h + .am-move { border-top: none; }
  html.wm .am-move .nm { flex:1; font-size: 16px; font-weight: 600; }
  html.wm .am-move small { color: var(--muted); font-size: 12px; min-width: 30px; }
  html.wm .am-step { display:flex; align-items:center; background: var(--bg); border-radius: 12px; }
  html.wm .am-step button { width: 42px; height: 40px; background:none; border:none; color: var(--text); font-size: 22px; cursor:pointer; touch-action: manipulation; }
  html.wm .am-step b { min-width: 34px; text-align:center; font-family: var(--tnum); font-size: 20px; }
  html.wm .am-log { display:flex; flex-direction:column; gap: 6px; margin-top: 10px; }
  html.wm .am-r { display:grid; grid-template-columns: 1fr auto; text-align:left; background: var(--box); border: 1px solid var(--line); border-radius: 12px; padding: 9px 12px; color: var(--text); cursor:pointer; }
  html.wm .am-r span { color: var(--muted); font-size: 13px; font-weight: 700; } html.wm .am-r b { font-family: var(--tnum); font-size: 16px; grid-row: span 2; align-self:center; }
  html.wm .am-r small { color: var(--faint); font-size: 12px; font-family: var(--tnum); }
  html.wm .am-r:first-child { border-color: var(--wm-accent); }
  html.wm .am-bar .btn.lg { flex: 2.4; }
  /* LADDER screen */
  html.wm .ld-bars { width: 100%; height: 64px; display:block; margin: 6px 0 12px; }
  /* THE MOVE ROW (mvRow), every mode: one slim list, full names, small − + */
  /* For time by bites: a big tank for the total, a bar and quick-add chips per move */
  html.wm .bt-sm { zoom: .68; margin: 6px 0 14px; }
  html.wm .bt-tank { position: relative; height: 34px; border-radius: 17px; background: var(--box); border: 1px solid var(--wm-neon-line); overflow: hidden; margin: 4px 0 6px; }
  html.wm .bt-fill { position:absolute; inset: 0 auto 0 0; background: linear-gradient(90deg, var(--wm-neon), var(--wm-accent)); box-shadow: 0 0 18px var(--wm-neon-line); transition: width .35s cubic-bezier(.2,.9,.3,1.2); }
  html.wm .bt-tank span { position: relative; display:grid; place-items:center; height:100%; font-family: var(--tnum); font-weight: 800; font-size: 17px; color:#fff; text-shadow: 0 1px 4px rgba(0,0,0,.6); }
  html.wm .bt-tankn { display:flex; align-items:center; justify-content:space-between; color: var(--muted); font-family: var(--tnum); font-size: 15px; margin: 0 4px 10px; }
  html.wm .bt-undo { background:none; border: 1px solid var(--line); color: var(--muted); border-radius: 999px; padding: 5px 12px; font-size: 13px; font-weight: 700; }
  html.wm .bt-undo:disabled { opacity: .35; }
  html.wm .bt-rows { background: var(--box); border-radius: 16px; padding: 2px 12px; }
  html.wm .bt-row { padding: 10px 0; border-top: 1px solid var(--line); }
  html.wm .bt-row:first-child { border-top: none; }
  html.wm .bt-top { display:flex; align-items:baseline; gap: 8px; }
  html.wm .bt-row.now .mvr-n { color: #fff; text-shadow: 0 0 10px var(--wm-neon-line); }
  html.wm .bt-row.full .mvr-n, html.wm .bt-row.full .bt-v { color: var(--muted); }
  html.wm .bt-v { font-family: var(--tnum); font-size: 18px; }
  html.wm .bt-v small { color: var(--muted); font-size: 13px; }
  html.wm .bt-bar { height: 6px; border-radius: 3px; background: var(--line); margin: 7px 0 9px; overflow:hidden; }
  html.wm .bt-bar i { display:block; height:100%; background: var(--wm-neon); box-shadow: 0 0 8px var(--wm-neon); transition: width .3s ease; }
  html.wm .bt-cs { display:flex; gap: 8px; }
  html.wm .bt-c { flex: 1; height: 40px; border-radius: 12px; background: transparent; border: 1.5px solid var(--wm-neon-line); color: #fff; font-family: var(--tnum); font-size: 17px; font-weight: 800; }
  html.wm .bt-c:active { background: var(--wm-neon-soft); border-color: var(--wm-neon); }
  html.wm .bt-ok { color: var(--wm-neon); font-weight: 800; font-size: 18px; }
  html.wm .mvr-list { background: var(--box); border-radius: 16px; padding: 2px 10px; }
  html.wm .mvr { display:flex; align-items:center; gap: 8px; min-height: 44px; padding: 3px 0; border-top: 1px solid var(--line); }
  html.wm .mvr:first-child { border-top: none; }
  html.wm .mvr .ci-vid, html.wm .mvr-sp { flex: 0 0 24px; width: 24px; height: 24px; margin: 0; border-radius: 50%; font-size: 9px; padding: 0; display:grid; place-items:center; }
  html.wm .mvr .ci-vid { background: transparent; border: 1.5px solid var(--line); color: var(--muted); }
  html.wm .mvr .ci-vid.has { border-color: var(--wm-accent); color: var(--wm-accent); background: transparent; }
  html.wm .mvr-n { flex: 1; min-width: 0; font-size: 16px; font-weight: 600; white-space: nowrap; overflow: hidden; }
  html.wm .mvr-n small { color: var(--muted); font-weight: 500; font-size: .85em; }
  html.wm .mvr.rest .mvr-n { color: var(--muted); }
  html.wm .mvr-st { flex: 0 0 auto; display:flex; align-items:center; }
  html.wm .mvr-st button { width: 32px; height: 36px; background: none; border: none; color: var(--wm-accent); font-size: 20px; line-height: 1; cursor: pointer; touch-action: manipulation; padding: 0; }
  html.wm .mvr-st button:active { transform: scale(.85); }
  html.wm .mvr-st b, html.wm .mvr-v { min-width: 30px; text-align: center; font-family: var(--tnum); font-size: 18px; font-weight: 700; }
  html.wm .mvr-v { color: var(--wm-neon); padding-right: 4px; }
  html.wm .mvr-st b small, html.wm .mvr-v small { font-size: 12px; color: var(--muted); margin-left: 1px; }
  html.wm .overlay-card .mvr-list { background: var(--bg); margin-bottom: 4px; }
  /* the older lists (program circuits, supersets) take the same slim look */
  html.wm .circuit-list { background: var(--box); border-radius: 16px; padding: 2px 10px; }
  html.wm .circuit-list .ci { background: none; border: none; border-top: 1px solid var(--line); border-radius: 0; margin: 0; padding: 3px 0; min-height: 44px; gap: 8px; }
  html.wm .circuit-list .ci:first-child { border-top: none; }
  html.wm .circuit-list .ci .nm { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; }
  html.wm .circuit-list .ci .ci-vid { flex: 0 0 24px; width: 24px; height: 24px; margin: 0; border-radius: 50%; font-size: 9px; padding: 0; background: transparent; border: 1.5px solid var(--line); color: var(--muted); }
  html.wm .circuit-list .ci .ci-vid.has { border-color: var(--wm-accent); color: var(--wm-accent); }
  html.wm .circuit-list .ci.active .nm { color: var(--wm-accent); }
  html.wm .am-moves { padding: 6px 10px 2px; } html.wm .am-moves .mvr:nth-child(2) { border-top: none; }
  html.wm .iv-bars { height: 40px; margin: 4px 0 8px; } html.wm .iv-bars rect.done { cursor:pointer; }
  html.wm .iv-moves { display:flex; flex-direction:column; gap: 6px; }
  html.wm .iv-mv { display:flex; align-items:center; gap: 8px; background: var(--box); border-radius: 14px; padding: 6px 8px 6px 10px; }
  html.wm .iv-mv .nm { flex:1; min-width:0; font-size: 17px; font-weight: 700; white-space: nowrap; overflow:hidden; text-overflow: ellipsis; }
  html.wm .iv-mv small { color: var(--muted); font-size: 12px; min-width: 28px; }
  html.wm .iv-mv.rest { justify-content: space-between; padding: 12px 14px; } html.wm .iv-mv.rest .nm { color: var(--wm-rest, var(--text)); }
  html.wm .iv-mv .ci-vid { flex: 0 0 auto; }
  html.wm .iv-ring { margin: 10px 0 6px; }
  html.wm .iv-out { white-space: nowrap; font-size: 15px; padding-left: 8px; padding-right: 8px; }
  html.wm .iv-ring .timer { width: min(74vw, 300px) !important; height: min(74vw, 300px) !important; }
  html.wm .ld-stats b i { font-style: normal; color: var(--muted); font-size: 14px; }
  html.wm .iv-nx { font-family: inherit; font-size: 13px; font-weight: 700; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding-top: 6px; }
  html.wm .ld-bars rect { fill: #fff; fill-opacity: .08; }
  html.wm .ld-bars rect.done { fill: var(--wm-accent); fill-opacity: .55; }
  html.wm .ld-bars rect.now { fill: var(--wm-neon); fill-opacity: 1; filter: drop-shadow(0 0 6px var(--wm-neon)); }
  html.wm .ld-card { width:100%; background: var(--box); border: 1.5px solid var(--wm-neon-line); border-radius: 22px; padding: 16px 12px 12px; color: var(--text); cursor:pointer;
    box-shadow: var(--wm-glow-neon); touch-action: manipulation; }
  html.wm .ld-card:active { transform: scale(.985); }
  html.wm .ld-mvs { display:flex; justify-content:center; gap: 22px; flex-wrap: wrap; }
  html.wm .ld-mv { display:flex; flex-direction:column; align-items:center; }
  html.wm .ld-mv b { font-family: var(--tnum); font-size: min(20vw, 84px); line-height: 1; color: var(--wm-neon); text-shadow: 0 0 22px var(--wm-neon-soft); display:inline-block; }
  html.wm .ld-mv span { font-size: 15px; font-weight: 700; margin-top: 4px; }
  /* two moves side by side: a thin line between them, so 5 and 12 read as two numbers */
  html.wm .ld-mv + .ld-mv { border-left: 1px solid var(--wm-neon-line); padding-left: 22px; }
  html.wm .ld-next { color: var(--muted); font-size: 13.5px; margin-top: 10px; }
  html.wm .ld-stats { display:grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 10px; }
  html.wm .ld-stats div { background: var(--box); border-radius: 14px; padding: 9px 6px; text-align:center; }
  html.wm .ld-stats small { display:block; color: var(--muted); font-size: 10.5px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
  html.wm .ld-stats b { font-family: var(--tnum); font-size: 22px; }
  html.wm .ld-reps { display:flex; flex-direction:column; gap: 6px; margin-top: 8px; }
  html.wm .ld-reps div { position: relative; overflow: hidden; display:flex; align-items: baseline; gap: 6px; background: var(--box); border-radius: 12px; padding: 9px 12px; }
  html.wm .ld-reps span { flex:1; font-size: 14px; font-weight: 600; z-index: 1; } html.wm .ld-reps b { font-family: var(--tnum); font-size: 17px; z-index: 1; }
  html.wm .ld-reps small { color: var(--muted); font-family: var(--tnum); z-index: 1; }
  html.wm .ld-reps i { position:absolute; left:0; top:0; bottom:0; background: var(--wm-accent-soft); }
  /* THE MOVE YOU ARE ON: the app's lit-habit look. A glowing neon edge on
     the left, a neon wash fading off it, a neon outline. */
  html.wm .ld-reps div { border: 1px solid transparent; transition: border-color .25s, box-shadow .25s; }
  html.wm .ld-reps div::before { content:''; position:absolute; left:0; top:0; bottom:0; width:3px; background: var(--wm-neon); opacity:0; box-shadow: 0 0 10px var(--wm-neon); transition: opacity .25s; z-index: 2; }
  html.wm .ld-reps div::after { content:''; position:absolute; left:0; top:0; bottom:0; width: 70%; background: linear-gradient(90deg, var(--wm-neon-soft), transparent); opacity:0; transition: opacity .25s; pointer-events:none; }
  /* lit: the OUTLINE glows with a glint of light on its top edge and a
     streak across the glass; the words stay white and glow */
  html.wm .ld-reps div.now { border-color: var(--wm-neon); box-shadow: 0 0 16px var(--wm-neon-soft), 0 0 4px var(--wm-neon-line), inset 0 1px 0 rgba(255,255,255,.35);
    background: linear-gradient(105deg, transparent 52%, rgba(255,255,255,.09) 60%, transparent 68%), var(--box); }
  html.wm .ld-reps div.now::before, html.wm .ld-reps div.now::after { opacity: 1; }
  html.wm .ld-reps div.now span, html.wm .ld-reps div.now b { color: #fff; text-shadow: 0 0 10px var(--wm-neon), 0 0 2px rgba(255,255,255,.8); }
  html.wm .mvr-n[data-mvw] { cursor: pointer; }
  html.wm .mvr-st .wm-wu { text-decoration: underline dotted; text-underline-offset: 3px; cursor: pointer; }
  html.wm .tally .tally-sum { border-top: 1px solid var(--line); margin-top: 4px; padding-top: 8px; }
  html.wm .tally .tnum { font-family: var(--tnum); }
  html.wm .tally-body { display:flex; flex-direction:column; gap: 8px; padding: 10px 0 4px; color: var(--muted); font-size: 13px; text-align:left; }
  html.wm .tally-body input { width: 70px; background: var(--bg); border: 1px solid var(--line); border-radius: 10px; color: var(--text); font: inherit; font-size: 18px; padding: 6px 8px; text-align:center; }
  html.wm .tally-body .btn { width:auto; padding: 8px 14px; margin-left: 8px; }
  html.wm .tally-last b.up { color: var(--wm-accent); } html.wm .tally-last b.down { color: #ff8a8a; }
  html.wm .mvr-n .mvr-wt { color: var(--wm-accent); font-weight: 700; font-family: var(--tnum); }
  /* the round-done burst (workmode.js celebrate) */
  .wm-burst { position: fixed; z-index: 150; width: 0; height: 0; pointer-events: none; }
  .wm-burst i { position: absolute; width: 8px; height: 8px; margin: -4px; border-radius: 50%; background: var(--c); box-shadow: 0 0 10px var(--c);
    animation: wmSpark .8s cubic-bezier(.15,.7,.3,1) forwards; }
  .wm-burst b { position: absolute; transform: translate(-50%, -50%); font-size: 34px; font-weight: 900; color: #fff; text-shadow: 0 0 18px var(--wm-accent);
    animation: wmPlus .9s ease-out forwards; font-family: var(--tnum); }
  @keyframes wmSpark { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { transform: translate(var(--dx), var(--dy)) scale(.3); opacity: 0; } }
  @keyframes wmPlus { 0% { opacity: 0; transform: translate(-50%, -30%) scale(.6); } 25% { opacity: 1; transform: translate(-50%, -90%) scale(1.15); } 100% { opacity: 0; transform: translate(-50%, -190%) scale(1); } }
  .wm-pop.popping { animation: wmPop .45s cubic-bezier(.2,1.6,.4,1); }
  @keyframes wmPop { 0% { transform: scale(1); } 40% { transform: scale(1.35); color: var(--wm-accent); text-shadow: 0 0 24px var(--wm-accent); } 100% { transform: scale(1); } }
  /* push-up test: the cue flips pink (down) / accent (up) on each beep */
  html.wm .cad { text-align:center; margin-top: 14px; }
  html.wm .cad-cue { font-size: 68px; font-weight: 800; letter-spacing: -0.03em; text-transform: uppercase; color: var(--muted); }
  html.wm .cad-cue.down { color: var(--wm-neon); text-shadow: var(--wm-glow-neon); }
  html.wm .cad-cue.go { color: var(--wm-ready); text-shadow: 0 0 22px var(--wm-ready-wash); }
  html.wm .cad-start { margin-top: 8px; font-size: 18px; color: var(--muted); }
  html.wm .cad-start b { color: var(--wm-ready); }
  html.wm .cad-cue.up { color: var(--wm-accent); text-shadow: var(--wm-glow-accent); }
  html.wm .cad-reps { margin-top: 10px; }
  html.wm .cad-reps b { display:block; font-family: var(--tnum); font-size: 104px; line-height: 1; letter-spacing: -0.05em; }
  html.wm .cad-reps small { color: var(--muted); font-size: 13px; text-transform: uppercase; letter-spacing: .12em; }
  html.wm .cad-time { font-family: var(--tnum); color: var(--muted); font-size: 18px; margin-top: 14px; }
  html.wm .cad-how { font-size: 13px; margin: 18px 18px 0; line-height: 1.4; }
  `;
  document.head.appendChild(st);
}
