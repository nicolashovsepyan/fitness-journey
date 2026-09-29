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

function colours() {
  if (!theme) return DEFAULT;
  let dash = {};
  try { dash = JSON.parse(localStorage.getItem(`fj.v1.${activeUserId()}.dash`) || '{}') || {}; } catch (e) {}
  const pick = dash.themeRandom ? weeklyPick(theme.palettes)
    : Object.assign(Object.fromEntries(theme.slots.map(s => [s.id, s.default])), dash.slots || {});
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
  /* the ring: work in the accent, rest in the neon, get ready in gold, each with its halo */
  html.wm .timer .fill { stroke: var(--wm-accent); filter: drop-shadow(0 0 8px var(--wm-accent-soft)); }
  html.wm .timer.buffer .fill { stroke: var(--wm-accent); }
  html.wm .timer.rest .fill { stroke: var(--wm-neon); filter: drop-shadow(0 0 10px var(--wm-neon-line)); }
  html.wm .timer.ready .fill { stroke: #D9A94C; filter: none; }
  html.wm .timer .track { stroke: #242A33; }
  html.wm .timer .read .t { letter-spacing: -0.02em; }
  html.wm .run-head { border-bottom: 1px solid var(--wm-neon-soft); }
  html.wm .wprog-fill { background: linear-gradient(90deg, var(--wm-neon), var(--wm-accent)); }
  html.wm .bchip.now { background: var(--wm-accent); color: #0C1512; }
  html.wm .sessclock { color: var(--wm-accent); }
  html.wm .overlay-card { border: 1px solid var(--wm-neon-line); box-shadow: var(--wm-glow-neon); }
  /* stopwatch laps / for-time round splits */
  html.wm .ft-total { text-align:center; color: var(--muted); font-family: var(--tnum); font-size: 18px; margin: -4px 0 8px; }
  html.wm .laps { max-width: 420px; margin: 0 auto 10px; }
  html.wm .lap { display:grid; grid-template-columns: 1fr auto 70px; gap: 10px; align-items: baseline; padding: 8px 4px; border-bottom: 1px solid var(--line); }
  html.wm .lap span { color: var(--muted); font-size: 14px; }
  html.wm .lap b { font-family: var(--tnum); font-size: 18px; color: var(--text); }
  html.wm .lap small { font-family: var(--tnum); color: var(--faint); font-size: 13px; text-align: right; }
  html.wm .lap:first-child b { color: var(--wm-accent); }
  /* push-up test: the cue flips pink (down) / accent (up) on each beep */
  html.wm .cad { text-align:center; margin-top: 14px; }
  html.wm .cad-cue { font-size: 68px; font-weight: 800; letter-spacing: -0.03em; text-transform: uppercase; color: var(--muted); }
  html.wm .cad-cue.down { color: var(--wm-neon); text-shadow: var(--wm-glow-neon); }
  html.wm .cad-cue.up { color: var(--wm-accent); text-shadow: var(--wm-glow-accent); }
  html.wm .cad-reps { margin-top: 10px; }
  html.wm .cad-reps b { display:block; font-family: var(--tnum); font-size: 104px; line-height: 1; letter-spacing: -0.05em; }
  html.wm .cad-reps small { color: var(--muted); font-size: 13px; text-transform: uppercase; letter-spacing: .12em; }
  html.wm .cad-time { font-family: var(--tnum); color: var(--muted); font-size: 18px; margin-top: 14px; }
  html.wm .cad-how { font-size: 13px; margin: 18px 18px 0; line-height: 1.4; }
  `;
  document.head.appendChild(st);
}
