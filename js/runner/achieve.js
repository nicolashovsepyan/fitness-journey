/* ============================================================
   ACHIEVEMENT CHECKMARKS (Nico's export, Oct 2026): "done" (Power Stroke)
   and "best" (Victory Shield), in the person's OWN colours. The art is
   two-tone, lime + violet; each pixel's hue moves to the matching slot
   (lime to the accent, violet to the neon), keeping its brightness, glow
   and highlights. Drawn once per colour pair, then reused.
   ============================================================ */
const SRC = { done: 'images/achievements/done.png', best: 'images/achievements/best.png' };
const LIME = 82, VIOLET = 271;                     // the art's own two hues
const cache = new Map();

function hueOf(color) {
  const m = String(color).trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, c => c + c) : m[1], n = parseInt(h, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(x => x / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d < 0.08) return null;                       // grey or white: no hue to move to
  const hh = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (hh * 60 + 360) % 360;
}
const angle = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

function recolor(img, toA, toB) {
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    if (p[i + 3] < 4) continue;
    const r = p[i] / 255, g = p[i + 1] / 255, b = p[i + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), dd = mx - mn;
    if (dd < 0.06) continue;                       // white highlights stay white
    let h = mx === r ? ((g - b) / dd) % 6 : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4;
    h = (h * 60 + 360) % 360;
    const lime = angle(h, LIME) < angle(h, VIOLET);
    const to = lime ? toA : toB; if (to == null) continue;
    const nh = ((to + h - (lime ? LIME : VIOLET)) % 360 + 360) % 360;
    /* back to rgb, same saturation and value */
    const s = mx ? dd / mx : 0, v = mx, k = n => (n + nh / 60) % 6;
    const f = n => v - v * s * Math.max(0, Math.min(k(n), 4 - k(n), 1));
    p[i] = f(5) * 255; p[i + 1] = f(3) * 255; p[i + 2] = f(1) * 255;
  }
  x.putImageData(d, 0, 0);
  return c.toDataURL('image/png');
}

/* the <img>; paintAchievements() swaps in the recoloured version */
export const achieveImg = (kind, cls = '') => `<img class="wm-ach ${cls}" data-ach="${kind}" src="${SRC[kind]}" alt="" aria-hidden="true">`;
export function paintAchievements(root = document) {
  const css = getComputedStyle(document.documentElement);
  const a = hueOf(css.getPropertyValue('--wm-accent')), b = hueOf(css.getPropertyValue('--wm-neon'));
  if (a == null && b == null) return;
  root.querySelectorAll('img[data-ach]').forEach(el => {
    const kind = el.dataset.ach, key = `${kind}|${a}|${b}`;
    if (cache.has(key)) { el.src = cache.get(key); return; }
    const img = new Image();
    img.onload = () => { try { const url = recolor(img, a, b); cache.set(key, url); el.src = url; } catch (e) {} };
    img.src = SRC[kind];
  });
}
