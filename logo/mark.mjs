/* ============================================================
   THE MARK — one source of geometry for everything that is not
   the animation.

   hero.js owns the moving version, because the draw-in and the trace need
   the numbers inline in a single-file app. This module owns the STATIC
   exports: the app icon, the stamps, anything rasterised. The numbers below
   are the same numbers, and tools/build-logo.mjs --check will tell you if
   they have drifted apart.

   Coordinates:
     triangle   a 300 x 268 box; top edge at y=16, apex at (150,252)
     dumbbell   a 260 x 130 box; bar at y=65, mirrored about x=130
   ============================================================ */

/* The outline. Not a closed triangle — it starts right of a 40-unit break in
   the top-left and stops left of it, the way a neon tube has a dead segment. */
export const TRI_D = 'M100 16 H286 L150 252 L14 16 H60';
export const TRI_LEN = 777;
export const TRI_BOX = { w: 300, h: 268 };

/* The dumbbell: bar, then three plates a side, each 90% of the one inside it.
   Mirrored with x -> 260-x. */
export const BAR = { d: 'M86 65 H174', w: 7 };
export const PLATES = [
  { x: 86,   y1: 38,    y2: 92,    w: 12.65 },
  { x: 66.8, y1: 40.70, y2: 89.30, w: 9.90  },
  { x: 52.4, y1: 47.50, y2: 82.50, w: 7.13  },
];
export const DB_BOX = { w: 260, h: 130 };
export const mirror = x => 260 - x;

/* The ground the tile is drawn on, and the squircle iOS masks it with. */
export const TILE = { bg: '#171A1E', r: 112, size: 512 };

/* ---- colour --------------------------------------------------------------
   Both ramps run ACROSS their shape, not down it: light sits where the two
   halves of the dumbbell face each other and falls away outward. The neon
   runs DOWN, because across put its bright middle on the centre of the top
   edge and on the apex — the two places the dumbbell is nowhere near.

   gradientUnits is userSpaceOnUse everywhere, always. objectBoundingBox has
   bitten this file three times: on a straight line the bounding box has zero
   area and the gradient renders nothing at all in iOS Safari. */
export const NEON = ['#FF5FA2', '#FF8FBE', '#FFD9E8', '#FF8FBE', '#FF5FA2'];
export const JADE = ['#34B396', '#93EAD7', '#A8F5E1', '#93EAD7', '#34B396'];

export function triGradient(id = 'triGrad') {
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="268">
      <stop offset="0%"   stop-color="${NEON[0]}"/>
      <stop offset="26%"  stop-color="${NEON[1]}"/>
      <stop offset="37%"  stop-color="${NEON[2]}"/>
      <stop offset="50%"  stop-color="${NEON[3]}"/>
      <stop offset="100%" stop-color="${NEON[4]}"/>
    </linearGradient>`;
}

export function dbGradient(id = 'dbGrad') {
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="52" y1="0" x2="208" y2="0">
      <stop offset="0%"   stop-color="${JADE[0]}"/>
      <stop offset="22%"  stop-color="${JADE[1]}"/>
      <stop offset="50%"  stop-color="${JADE[2]}"/>
      <stop offset="78%"  stop-color="${JADE[3]}"/>
      <stop offset="100%" stop-color="${JADE[4]}"/>
    </linearGradient>`;
}

/* The bar carries the same colour as everything else, but its middle falls
   away to nothing. Not a cut — the ends hold full weight, then dissolve, so
   the two halves read as one object with air in it. The stops are sampled
   off dbGrad at the same x, which is why the seam is invisible. */
export function barGradient(id = 'dbBar') {
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="86" y1="0" x2="174" y2="0">
      <stop offset="0%"   stop-color="#93EAD7" stop-opacity="1"/>
      <stop offset="32%"  stop-color="#8FE6D3" stop-opacity="1"/>
      <stop offset="36%"  stop-color="#89DFCC" stop-opacity=".60"/>
      <stop offset="39%"  stop-color="#83D9C6" stop-opacity=".22"/>
      <stop offset="41%"  stop-color="#7FD5C2" stop-opacity="0"/>
      <stop offset="59%"  stop-color="#7FD5C2" stop-opacity="0"/>
      <stop offset="61%"  stop-color="#83D9C6" stop-opacity=".22"/>
      <stop offset="64%"  stop-color="#89DFCC" stop-opacity=".60"/>
      <stop offset="68%"  stop-color="#8FE6D3" stop-opacity="1"/>
      <stop offset="100%" stop-color="#93EAD7" stop-opacity="1"/>
    </linearGradient>`;
}

/* The seven strokes of the finished dumbbell, in draw order. */
export function dumbbellPaths({ grad = 'dbGrad', bar = 'dbBar', indent = '    ' } = {}) {
  const rows = [`<path d="${BAR.d}" stroke="url(#${bar})" stroke-width="${BAR.w}"/>`];
  for (const p of PLATES) {
    for (const cx of [p.x, mirror(p.x)]) {
      rows.push(`<path d="M${cx} ${p.y1} V${p.y2}" stroke-width="${p.w}"/>`);
    }
  }
  return rows.map(r => indent + r).join('\n');
}

/* ---- the app icon --------------------------------------------------------
   The whole mark on the tile: outline and dumbbell together, so the home
   screen and the opening screen agree.

   THE BINDING CONSTRAINT IS NOT THE BAR. The triangle narrows as it
   descends, and the plates hang BELOW the bar — so the tightest point is the
   bottom outer corner of the smallest plate, not the bar's width. A dumbbell
   sized by eye at the bar line reads as comfortable and is actually 3px off
   the neon. Measured instead: iconClearance() below returns the real worst
   case, and the build refuses to write an icon where it goes tight.

   At scale 1.115 the worst gap is ~18px on a 512 tile and the bar sits 34%
   down the outline — against the hero's 35.8%, so the composition matches.

   No ECG here. The trace is motion; a still frame of it is just a bent
   triangle. */
/* THE STROKE. At 9 the outline was thicker than the outermost plate it
   surrounds — ratio 1.13, where the hero's is 0.36 — and it read as a heavy
   frame around a delicate object.

   The hero's proportion is internally consistent: measured against the outer
   plate, the widest plate and the bar it gives 2.86px every time. That is
   the honest answer and it is too thin here, because a 512 tile is drawn at
   60px on a home screen and 2.86 becomes a third of a pixel.

   4.5 is the compromise — ratio 0.57 to the outer plate, half the old weight,
   still 1.6px at apple-touch size and carried by the glow below that. */
export const ICON_LAYOUT = {
  tri: { cx: 256, cy: 268, scale: 1.42, stroke: 4.5 },
  db:  { cx: 256, cy: 214, scale: 1.115 },
};

/* The smallest distance, anywhere, between a plate and the neon it sits
   inside — in tile pixels, both stroke widths accounted for. Negative means
   the plates are crossing the outline. */
export function iconClearance(layout = ICON_LAYOUT) {
  const { tri, db } = layout;
  const P = u => [(u[0] - 150) * tri.scale + tri.cx, (u[1] - 134) * tri.scale + tri.cy];
  const L = P([14, 16]), A = P([150, 252]);
  const dx = A[0] - L[0], dy = A[1] - L[1], len = Math.hypot(dx, dy);
  const halfNeon = tri.stroke / 2;
  let worst = Infinity, where = null;
  for (const p of PLATES) {
    const halfW = (p.w * db.scale) / 2;
    const cx = (p.x - 130) * db.scale + db.cx;
    for (let t = 0; t <= 1; t += 0.02) {
      const uy = p.y1 + (p.y2 - p.y1) * t;
      const py = (uy - 65) * db.scale + db.cy;
      /* perpendicular distance to the left edge; the mark is symmetric so
         the right side is the mirror of this and cannot be tighter */
      const d = ((cx - halfW - L[0]) * dy - (py - L[1]) * dx) / len - halfNeon;
      if (d < worst) { worst = d; where = `plate w=${p.w} at y=${uy.toFixed(1)}`; }
    }
  }
  return { px: +worst.toFixed(1), where, barPct: +(((db.cy - L[1]) / (A[1] - L[1])) * 100).toFixed(1) };
}

export function appIconSVG() {
  const { tri, db } = ICON_LAYOUT;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TILE.size} ${TILE.size}">
  <!-- GENERATED by tools/build-logo.mjs from logo/mark.mjs — do not edit.
       The mark: an inverted neon triangle with a dumbbell centred in it.
       Both gradients live in the transformed local space of the groups
       below, which is why their coordinates match the 300x268 and 260x130
       drawings rather than this 512 canvas. -->
  <defs>
${triGradient()}
${dbGradient()}
${barGradient()}
    <!-- The mark is neon, and a flat stroke reads as a line drawing rather
         than as light. Two shadows on the outline — a wide soft bloom and a
         tight core — is the still equivalent of what hero.css does with
         drop-shadow on .tri-l. feDropShadow rather than a blur-and-merge
         because it survives every rasteriser tried on it.

         The filter regions have to be generous: the default -10%/120% clips
         a 22px bloom on a shape that already reaches the tile's edges. -->
    <filter id="neonGlow" x="-25%" y="-25%" width="150%" height="150%">
      <feDropShadow dx="0" dy="0" stdDeviation="11" flood-color="#FF5FA2" flood-opacity=".55"/>
      <feDropShadow dx="0" dy="0" stdDeviation="3"  flood-color="#FFC2DC" flood-opacity=".45"/>
    </filter>
    <filter id="jadeGlow" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="0" stdDeviation="9" flood-color="#3ECBA8" flood-opacity=".42"/>
    </filter>
  </defs>
  <rect width="${TILE.size}" height="${TILE.size}" rx="${TILE.r}" fill="${TILE.bg}"/>
  <g filter="url(#neonGlow)">
    <g transform="translate(${tri.cx},${tri.cy}) scale(${tri.scale}) translate(-150,-134)">
      <path d="${TRI_D}" fill="none" stroke="url(#triGrad)"
            stroke-width="${(tri.stroke / tri.scale).toFixed(2)}"
            stroke-linejoin="round" stroke-linecap="round"/>
    </g>
  </g>
  <g filter="url(#jadeGlow)">
    <g transform="translate(${db.cx},${db.cy}) scale(${db.scale}) translate(-130,-65)"
       fill="none" stroke="url(#dbGrad)" stroke-linecap="round">
${dumbbellPaths({ indent: '      ' })}
    </g>
  </g>
</svg>
`;
}

/* A maskable icon is cropped by the platform to whatever shape it likes —
   circle, squircle, teardrop — and only the middle 80% is guaranteed to
   survive. So: square corners, because the platform rounds them itself, and
   the mark pulled in to sit inside a centred circle of radius 40%.

   The binding points are the triangle's two top corners — the mark is widest
   where it is tallest. At 0.78 they sit 196.9 from the centre against a safe
   radius of 204.8: 7.9px of margin. The apex has 61.2px and never matters.
   Above about 0.81 the corners start being cropped on a circular mask. */
export const MASKABLE_SAFE = 0.78;

export function maskableIconSVG() {
  const inner = appIconSVG()
    /* square off — the launcher supplies the corner radius */
    .replace(`rx="${TILE.r}" `, '')
    .replace('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">', '')
    .replace('</svg>\n', '');
  const m = (1 - MASKABLE_SAFE) / 2 * TILE.size;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TILE.size} ${TILE.size}">
  <!-- GENERATED by tools/build-logo.mjs from logo/mark.mjs — do not edit.
       Maskable: square to the edges, mark inset to the safe circle. -->
  <rect width="${TILE.size}" height="${TILE.size}" fill="${TILE.bg}"/>
  <g transform="translate(${m.toFixed(1)},${m.toFixed(1)}) scale(${MASKABLE_SAFE})">
${inner.trim()}
  </g>
</svg>
`;
}

/* ---- the stamps ----------------------------------------------------------
   Each half on its own, for the places the app marks a selection. The
   outline is the one that survives small: below about 20px the dumbbell's
   outer plates close up and it turns into a bar, while the triangle keeps
   its shape all the way down.

   currentColor rather than the gradient, because a stamp has to take the
   colour of the state it is marking — pink when chosen, grey when not. */
/* The optical weight a triangle stamp wants at a given pixel size. It cannot
   follow the hero's proportion — 2.6 units on a 300 box is 0.24px at stamp
   size, which is nothing — but the first version overcorrected and the mark
   came out as a thick chevron. This is about a third lighter:

     16px -> 1.6px    28px -> 2.1px    44px -> 2.7px    64px -> 3.5px

   growing with the stamp but far more slowly than the stamp does. */
export const stampStrokePx = px => 0.95 + px * 0.04;

export function triStampSVG({ flat = true, nominal = 28 } = {}) {
  /* the file carries one concrete weight, set for a 28px stamp; call sites
     that draw it larger or smaller should override stroke-width */
  const units = (stampStrokePx(nominal) * 312 / nominal).toFixed(1);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -6 312 280">
  <!-- GENERATED by tools/build-logo.mjs from logo/mark.mjs — do not edit.
       The viewBox is padded by 6 so the stroke cannot clip at the corners.
       stroke-width is set for a ${nominal}px stamp; override it if you draw
       this larger — see stampStrokePx() in logo/mark.mjs. -->
  <path d="${TRI_D}" fill="none" stroke="${flat ? 'currentColor' : 'url(#triGrad)'}"
        stroke-width="${units}" stroke-linejoin="round" stroke-linecap="round"/>
</svg>
`;
}

export function dbStampSVG({ flat = true } = {}) {
  const stroke = flat ? 'currentColor' : 'url(#dbGrad)';
  const defs = flat ? '' : `  <defs>
${dbGradient()}
${barGradient()}
  </defs>\n`;
  const bar = flat
    ? `    <path d="${BAR.d}" stroke-width="${BAR.w}"/>`
    : `    <path d="${BAR.d}" stroke="url(#dbBar)" stroke-width="${BAR.w}"/>`;
  const plates = PLATES.flatMap(p =>
    [p.x, mirror(p.x)].map(cx => `    <path d="M${cx} ${p.y1} V${p.y2}" stroke-width="${p.w}"/>`)
  ).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 268 138">
  <!-- GENERATED by tools/build-logo.mjs from logo/mark.mjs — do not edit. -->
${defs}  <g fill="none" stroke="${stroke}" stroke-linecap="round">
${bar}
${plates}
  </g>
</svg>
`;
}
