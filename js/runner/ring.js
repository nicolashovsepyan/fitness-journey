/* ============================================================
   THE TIMER RING — one design, drawn from data.

   Everything about how the countdown circle looks is a DESIGN object
   (below). The app draws the get-ready, work and rest timers from it,
   and ring-lab.html edits it live and saves it here. One drawing
   function for both, so what you design is exactly what you train with.

   Saved on the device as `fj.ringDesign` (the lab's "Use on my timer",
   or a preset picked in Timer settings). No design saved = PRESETS[0].

   Every visual property is written inline on the SVG, so no stylesheet
   elsewhere can quietly override a design.
   ============================================================ */
export const RING_R = 100;
const C = 120;
const KEY = 'fj.ringDesign';

/* the starting points; every number in them is a lab control */
/* the starting points (Nicolas's three: Chrono, LED, Laser); every
   number in them is a lab control. Colours are electro only. */
export const PRESETS = [
  { id: 'chrono', name: 'Chrono', note: 'Like the app icon: pink dial, lit ticks',
    arc: { width: 8, style: 'solid', core: 0.42, coreColor: 'tint', coreSoft: 0.45, coreOpacity: 0.92, glow: 0.8, glare: false, cap: 'round', segments: 60, gap: 0.35 },
    track: { width: 8, opacity: 0.05, core: false },
    ticks: { count: 60, length: 7, quarters: true, opacity: 0.8, color: 'phase', position: 'outside' },
    rays: 0.05, crown: true, face: 'disc',
    digits: { font: 'mono', weight: 700, glow: 0.8, color: 'phase', size: 1 },
    colors: { work: 'neon', rest: 'accent', ready: 'royal', grad: 'accent' } },
  { id: 'led', name: 'LED', note: 'Segments, like an 80s display',
    arc: { width: 14, style: 'segments', core: 0, coreColor: 'white', coreSoft: 0.3, coreOpacity: 0.92, glow: 0.6, glare: false, cap: 'butt', segments: 60, gap: 0.4 },
    track: { width: 14, opacity: 0.08, core: false },
    ticks: { count: 0, length: 5, quarters: false, opacity: 0.4, color: 'muted', position: 'outside' },
    rays: 0, crown: true, face: 'none',
    digits: { font: 'mono', weight: 700, glow: 0.7, color: 'phase', size: 1 },
    colors: { work: 'accent', rest: 'neon', ready: 'royal', grad: 'neon' } },
  { id: 'laser', name: 'Laser', note: 'A thin white beam with a big glow',
    arc: { width: 3.5, style: 'solid', core: 1, coreColor: 'white', coreSoft: 0.2, coreOpacity: 0.95, glow: 2, glare: false, cap: 'round', segments: 60, gap: 0.35 },
    track: { width: 2, opacity: 0.06, core: false },
    ticks: { count: 60, length: 4, quarters: true, opacity: 0.3, color: 'muted', position: 'outside' },
    rays: 0.03, crown: true, face: 'none',
    digits: { font: 'system', weight: 300, glow: 1, color: 'white', size: 1.1 },
    colors: { work: 'accent', rest: 'neon', ready: 'royal', grad: 'neon' } },
];
const clone = o => JSON.parse(JSON.stringify(o));
/* fill any field an older saved design is missing from the Neon tube */
function complete(d) {
  const base = clone(PRESETS[0]);
  if (!d || typeof d !== 'object') return base;
  for (const k of Object.keys(base)) {
    if (d[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) base[k] = { ...base[k], ...d[k] };
    else if (d[k] !== undefined) base[k] = d[k];
  }
  return base;
}
export function presetById(id) { return clone(PRESETS.find(p => p.id === id) || PRESETS[0]); }
export function ringDesign() {
  try { return complete(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch (e) { return complete(null); }
}
export function saveRingDesign(d) { try { localStorage.setItem(KEY, JSON.stringify(complete(d))); } catch (e) {} }

/* colour words → CSS. The theme words follow the user's own palette. */
export function colour(v) {
  return ({ accent: 'var(--wm-accent, #3ECBA8)', neon: 'var(--wm-neon, #FF5FA2)', white: '#ECEFF3',
    cyan: '#4FD8FF', royal: '#3D6BFF', green: '#39FF14', violet: '#B57BFF', yellow: '#FFE24A', lime: '#B6FF3D',
    gold: '#3D6BFF' })[v] || v;
}
/* single quotes only: these go inside a style="…" attribute */
const FONTS = {
  mono: "var(--tnum, 'SF Mono', ui-monospace, monospace)",
  system: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
  rounded: "ui-rounded, 'SF Pro Rounded', system-ui, -apple-system, sans-serif",
};
const f1 = n => n.toFixed(1);
const at = (a, r) => { const t = (a - 90) * Math.PI / 180; return [C + r * Math.cos(t), C + r * Math.sin(t)]; };
const seg = (a, r1, r2) => { const [x1, y1] = at(a, r1), [x2, y2] = at(a, r2); return `M${f1(x1)} ${f1(y1)}L${f1(x2)} ${f1(y2)}`; };

/* A STOPWATCH CROWN at 12, standing on the ring: a stem rising from the
   ring's outer edge and a wider cap, together exactly as tall as the
   outside ticks, so it replaces the 12 o'clock tick instead of floating
   above it. */
function crownSvg(cx, outer, reach, rc) {
  const top = C - outer - reach - 7;                 // cap top
  const stemTop = top + 6, stemBottom = C - outer + 2;
  const glowF = `filter:drop-shadow(0 0 5px color-mix(in srgb, ${rc} 55%, transparent))`;
  return `<g style="${glowF}">
    <rect x="${f1(cx - 3.5)}" y="${f1(stemTop)}" width="7" height="${f1(stemBottom - stemTop)}" rx="1.5" style="fill:${rc}"/>
    <rect x="${f1(cx - 9)}" y="${f1(top)}" width="18" height="8" rx="3" style="fill:${rc}"/>
    <rect x="${f1(cx - 6)}" y="${f1(top + 2)}" width="12" height="2" rx="1" style="fill:#fff;fill-opacity:.55"/>
  </g>`;
}
/* the ring, as an HTML string. `phase` is 'work' | 'rest' | 'ready' (the
   app's old 'buffer' means work). `uid` keeps ids unique when the lab draws
   several rings on one page; the app draws one and uses the plain ids. */
export function ringHTML(phase, d = ringDesign(), uid = '') {
  d = complete(d);
  const ph = phase === 'buffer' ? 'work' : phase;
  const a = d.arc, tr = d.track, tk = d.ticks, dg = d.digits;
  const cap = a.style === 'segments' ? 'butt' : a.cap;   // a round end would light a sliver of the next segment
  const c = 2 * Math.PI * RING_R;
  const id = s => `${s}${uid}`;
  const rc = 'var(--rc)';
  const outer = RING_R + Math.max(a.width, tr.width) / 2 + 3;
  /* ticks */
  /* TICKS outside the ring (a stopwatch bezel) or inside it (a watch face) */
  const inside = tk.position === 'inside';
  const inner = RING_R - Math.max(a.width, tr.width) / 2 - 3;
  let ticks = '', quarters = '';
  if (tk.count > 0) {
    const step = 360 / tk.count;
    for (let i = 0; i < tk.count; i++) {
      const ang = i * step, q = tk.quarters && Math.abs(ang % 90) < 0.01;
      if (d.crown && !inside && ang === 0) continue;            // the crown stands on this spot
      if (inside) {
        if (q) quarters += seg(ang, inner - tk.length - 4, inner + 1); else ticks += seg(ang, inner - 1 - tk.length, inner - 1);
      } else if (q) quarters += seg(ang, outer - 1, outer + tk.length + 4); else ticks += seg(ang, outer + 1, outer + 1 + tk.length);
    }
  }
  const raysTo = (inside && tk.count > 0 ? inner - tk.length - 6 : inner - 1);
  let rays = '';
  if (d.rays > 0 && raysTo > 20) for (let i = 0; i < 60; i++) rays += seg(i * 6, 16, raysTo);
  const tickCol = tk.color === 'phase' ? rc : 'var(--muted, #A9B2BC)';
  const glow = a.glow > 0
    ? `filter: drop-shadow(0 0 ${f1(3 * a.glow)}px ${rc}) drop-shadow(0 0 ${f1(12 * a.glow)}px color-mix(in srgb, ${rc} 45%, transparent));` : '';
  const coreCol = a.coreColor === 'tint' ? `color-mix(in srgb, ${rc} 30%, #ffffff)` : colour(a.coreColor);
  const stroke = a.style === 'gradient' ? `url(#${id('rg')})` : rc;
  const arc = (cls, extraStyle, elId) => `<circle class="${cls}" ${elId ? `id="${elId}"` : ''} cx="${C}" cy="${C}" r="${RING_R}" fill="none"
    stroke-dasharray="${f1(c)}" stroke-dashoffset="0" transform="rotate(-90 ${C} ${C})" style="${extraStyle} transition: ${a.style === 'segments' ? 'none' : 'stroke-dashoffset .95s linear'};"></circle>`;
  const segW = (2 * Math.PI * RING_R) / Math.max(4, a.segments);
  const mask = a.style === 'segments' ? `mask="url(#${id('rm')})"` : '';
  const glareD = (() => { const [x1, y1] = at(12, RING_R), [x2, y2] = at(34, RING_R); return `M${f1(x1)} ${f1(y1)} A${RING_R} ${RING_R} 0 0 1 ${f1(x2)} ${f1(y2)}`; })();
  const face = d.face === 'disc'
    ? `<circle cx="${C}" cy="${C}" r="${f1(RING_R - a.width / 2 - 2)}" fill="url(#${id('rf')})"/>`
    : d.face === 'glow' ? `<circle cx="${C}" cy="${C}" r="${f1(RING_R - a.width / 2 - 2)}" fill="url(#${id('rgw')})"/>` : '';
  const vars = `--ring-work:${colour(d.colors.work)};--ring-rest:${colour(d.colors.rest)};--ring-ready:${colour(d.colors.ready)};--ring-grad:${colour(d.colors.grad)};`;
  const digitCol = dg.color === 'phase' ? rc : colour(dg.color);
  const digitStyle = `color:${digitCol};font-family:${FONTS[dg.font] || FONTS.mono};font-weight:${dg.weight};`
    + `font-size:calc(min(19vw, 76px) * ${dg.size});`
    + (dg.glow > 0 ? `text-shadow:0 0 ${f1(18 * dg.glow)}px color-mix(in srgb, ${rc} ${Math.round(40 * dg.glow)}%, transparent);` : 'text-shadow:none;');
  const segAttr = a.style === 'segments' ? ` data-seg="${Math.max(4, Math.round(a.segments))}"` : '';
  return `<div class="timer dial rg ${ph}"${segAttr} style="${vars}">
  <svg viewBox="-14 -18 268 272" style="transform:none;overflow:visible;">
    <defs>
      <linearGradient id="${id('rg')}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" style="stop-color:${rc}"/><stop offset="100%" style="stop-color:var(--ring-grad)"/></linearGradient>
      <radialGradient id="${id('rf')}"><stop offset="0%" stop-color="#ffffff" stop-opacity=".05"/><stop offset="100%" stop-color="#000000" stop-opacity=".35"/></radialGradient>
      <radialGradient id="${id('rgw')}"><stop offset="0%" style="stop-color:${rc};stop-opacity:.12"/><stop offset="100%" style="stop-color:${rc};stop-opacity:0"/></radialGradient>
      <filter id="${id('cb')}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${f1(Math.max(0.01, (a.coreSoft || 0) * a.width * a.core * 0.55))}"/></filter>
      <filter id="${id('ch')}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${f1(Math.max(0.01, (a.coreSoft || 0) * a.width * 0.45))}"/></filter>
      <mask id="${id('rm')}"><circle cx="${C}" cy="${C}" r="${RING_R}" fill="none" stroke="#fff" stroke-width="${a.width + 6}"
        stroke-dasharray="${f1(segW * (1 - a.gap))} ${f1(segW * a.gap)}" transform="rotate(-90 ${C} ${C})"/></mask>
    </defs>
    ${face}
    ${rays ? `<path d="${rays}" style="stroke:#fff;stroke-opacity:${d.rays};stroke-width:1;fill:none"/>` : ''}
    ${ticks ? `<path d="${ticks}" style="stroke:${tickCol};stroke-opacity:${tk.opacity};stroke-width:1.6;stroke-linecap:round;fill:none"/>` : ''}
    ${quarters ? `<path d="${quarters}" style="stroke:${tk.color === 'phase' ? rc : 'var(--text, #ECEFF3)'};stroke-opacity:${Math.min(1, tk.opacity + 0.35)};stroke-width:3;stroke-linecap:round;fill:none"/>` : ''}
    ${d.crown ? crownSvg(C, outer, !inside && tk.count > 0 ? tk.length + 4 : 4, rc) : ''}
    <g ${mask}>
      <circle cx="${C}" cy="${C}" r="${RING_R}" fill="none" style="stroke:#fff;stroke-opacity:${tr.opacity};stroke-width:${tr.width};"/>
      ${tr.core ? `<circle cx="${C}" cy="${C}" r="${RING_R}" fill="none" style="stroke:#fff;stroke-opacity:${f1(tr.opacity + 0.03)};stroke-width:${f1(Math.max(1.5, tr.width * 0.18))};"/>` : ''}
      ${arc('fill', `stroke:${stroke};stroke-width:${a.width};stroke-linecap:${cap};${glow}`, uid ? '' : 'timerFill')}
      ${a.core > 0 && a.coreSoft > 0 ? arc('core halo', `stroke:color-mix(in srgb, ${rc} 45%, #ffffff);stroke-opacity:${f1(0.55 * (a.coreOpacity ?? 0.92))};stroke-width:${f1(Math.min(a.width, a.width * a.core * (1 + 1.4 * a.coreSoft)))};stroke-linecap:${cap};`, '').replace('<circle ', `<circle filter="url(#${id('ch')})" `) : ''}
      ${a.core > 0 ? arc('core', `stroke:${coreCol};stroke-opacity:${a.coreOpacity ?? 0.92};stroke-width:${f1(a.width * a.core * (1 - 0.35 * (a.coreSoft || 0)))};stroke-linecap:${cap};`, uid ? '' : 'timerCore').replace('<circle ', a.coreSoft > 0 ? `<circle filter="url(#${id('cb')})" ` : '<circle ') : ''}
    </g>
    ${a.glare ? `<path class="glare" ${uid ? '' : 'id="timerGlare"'} d="${glareD}" style="fill:none;stroke:#fff;stroke-width:${f1(Math.max(1.6, a.width * 0.22))};stroke-linecap:round;stroke-opacity:.8;transform:translate(-${f1(a.width * 0.2)}px,-${f1(a.width * 0.2)}px)"/>` : ''}
  </svg>
  <div class="read"><div class="t" ${uid ? '' : 'id="timerText"'} style="${digitStyle}">0:00</div><div class="cap" ${uid ? '' : 'id="timerCap"'}></div></div>
</div>`;
}

/* the phase colour for each phase class, plus the few rules an inline
   style cannot express. Injected once by whoever draws a ring. */
export function ringBaseCss() {
  if (document.getElementById('ring-css')) return;
  const st = document.createElement('style'); st.id = 'ring-css';
  st.textContent = `
  .rg { --rc: var(--ring-work); }
  .rg.rest { --rc: var(--ring-rest); }
  .rg.ready { --rc: var(--ring-ready); }
  .rg .glare.off { display: none; }
  .rg .read .cap { letter-spacing: .14em; font-size: 11px; opacity: .8; }`;
  document.head.appendChild(st);
}

/* move every arc layer of a ring to `frac` of the time left (lab use;
   the app's updateTimer moves #timerFill / #timerCore itself) */
/* SEGMENTS GO OUT WHOLE: a segmented ring shows only full segments, so the
   time left is rounded up to the next segment and one drops at a time */
export function snapToSegments(root, frac) {
  const n = +(root?.dataset?.seg || 0);
  return n ? Math.min(1, Math.ceil(frac * n - 1e-6) / n) : frac;
}
export function setRingProgress(root, frac) {
  frac = snapToSegments(root, frac);
  const c = 2 * Math.PI * RING_R;
  root.querySelectorAll('.fill, .core').forEach(el => { el.style.strokeDashoffset = String(c * (1 - frac)); });
  root.querySelectorAll('.glare').forEach(el => el.classList.toggle('off', frac < 0.11));
}
