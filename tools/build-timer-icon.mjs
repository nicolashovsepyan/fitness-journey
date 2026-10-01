/* ============================================================
   BUILD — the FJ Timer's home-screen icon.

   Source: images/timer-icon/timer-j5-sunray.svg, face "J5 Sunray" from
   the logo chat's timer-dial set (sixty faint hairlines on the dial face).
   Output: the PNGs manifest-timer.webmanifest and the Quick Timer's
   apple-touch-icon point at. Same rasteriser as build-logo.mjs (qlmanage,
   macOS only), because it honours the SVG filters the neon depends on.

   Run:  node tools/build-timer-icon.mjs
   ============================================================ */
import { copyFileSync, existsSync, mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'images/timer-icon');
const SRC = join(DIR, 'timer-j5-sunray.svg');
/* the dial sits well inside the 80% safe circle, so one art serves as
   both the plain and the maskable (Android adaptive) icon */
const OUT = [
  { out: 'timer-180.png', size: 180 }, { out: 'timer-192.png', size: 192 },
  { out: 'timer-512.png', size: 512 }, { out: 'timer-512-maskable.png', size: 512 },
];
const tmp = mkdtempSync(join(tmpdir(), 'fj-timer-icon-'));
try {
  for (const o of OUT) {
    const staged = join(tmp, 'timer.svg');
    /* FULL BLEED. The art clips itself to a rounded tile (rx 112); a phone
       rounds the icon itself, and transparent corners show up as black or
       white wedges (Android especially). The rasters fill the square. */
    writeFileSync(staged, readFileSync(SRC, 'utf8').replace('<rect width="512" height="512" rx="112"/>', '<rect width="512" height="512"/>'));
    execFileSync('qlmanage', ['-t', '-s', String(o.size), '-o', tmp, staged], { stdio: 'ignore' });
    if (!existsSync(staged + '.png')) { console.error(`RASTERISE FAILED for ${o.out}`); process.exit(1); }
    copyFileSync(staged + '.png', join(DIR, o.out)); rmSync(staged + '.png');
    console.log(`  ${o.out}: ${o.size}px`);
  }
} finally { rmSync(tmp, { recursive: true, force: true }); }
