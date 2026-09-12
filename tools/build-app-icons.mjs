#!/usr/bin/env node
/* ============================================================
   THE ICONS SOMEBODY CAN CHOOSE BETWEEN.

   Run:  node tools/build-app-icons.mjs

   HOW TO ADD ONE. Drop a square PNG or SVG into images/app-icons/ and
   run this. The file name is the choice: "midnight.png" becomes an
   option called Midnight. Nothing else to edit, here or anywhere else.
   Delete a file and the option goes with it.

   WHAT IT MAKES. For each source, the three sizes iOS and Android ask
   for, plus a web manifest of its own, plus one index the app reads:

     icons/<id>-180.png        apple-touch-icon, the iPhone home screen
     icons/<id>-192.png        Android
     icons/<id>-512.png        splash and stores
     manifest-<id>.webmanifest so Android gets the chosen one too
     spine/app-icons.json      the list the install screen renders

   WHY IT HAS TO BE CHOSEN BEFORE THEY INSTALL, WHICH IS THE WHOLE
   REASON THIS EXISTS AND NOT A PICKER IN SETTINGS.

   iOS reads the icon ONCE, at the moment somebody taps Add to Home
   Screen, and then keeps it. Changing it afterwards does nothing at
   all until the app is deleted and added again. So a picker inside the
   installed app would be a control that silently does not work, which
   is worse than not offering one. The choice belongs on the way in.

   SIZES. 180 is what iOS actually uses. Give it a source of at least
   512 square so nothing is upscaled.
   ============================================================ */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, rmSync, copyFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, basename } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'images', 'app-icons');
const OUT = join(ROOT, 'icons');
const SIZES = [180, 192, 512];

/* A file name is the option. "deep-space.png" reads as Deep Space. */
const titleOf = f => basename(f, extname(f))
  .replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
  .replace(/\b\w/g, c => c.toUpperCase());
const idOf = f => basename(f, extname(f)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

if (!existsSync(SRC)) {
  mkdirSync(SRC, { recursive: true });
  console.log(`  Created ${SRC.replace(ROOT + '/', '')}. Drop square PNG or SVG files in it and run this again.`);
  process.exit(0);
}

const sources = readdirSync(SRC)
  .filter(f => /\.(png|svg)$/i.test(f) && !f.startsWith('.'))
  .sort();

if (!sources.length) {
  console.log(`  No icons in ${SRC.replace(ROOT + '/', '')} yet. Drop square PNG or SVG files in and run this again.`);
  process.exit(0);
}

mkdirSync(OUT, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'fj-icons-'));
const built = [];

for (const file of sources) {
  const id = idOf(file), name = titleOf(file);
  const from = join(SRC, file);
  const svg = /\.svg$/i.test(file);
  const made = {};

  for (const size of SIZES) {
    const out = join(OUT, `${id}-${size}.png`);
    try {
      if (svg) {
        // qlmanage renders SVG; it names its output after the input, so
        // the render happens in a temp directory and is then moved.
        const staged = join(tmp, `${id}.svg`);
        copyFileSync(from, staged);
        execFileSync('qlmanage', ['-t', '-s', String(size), '-o', tmp, staged], { stdio: 'ignore' });
        copyFileSync(join(tmp, `${id}.svg.png`), out);
      } else {
        copyFileSync(from, out);
        execFileSync('sips', ['-Z', String(size), out], { stdio: 'ignore' });
      }
      made[size] = `icons/${id}-${size}.png`;
    } catch (e) {
      console.error(`  FAILED ${file} at ${size}px: ${e.message}`);
      console.error('  Needs macOS (sips for PNG, qlmanage for SVG).');
      process.exit(1);
    }
  }

  /* Android reads the manifest, not apple-touch-icon, so each choice
     gets one. The install screen points <link rel="manifest"> at it
     before the add happens, the same way it points the touch icon. */
  const mf = JSON.parse(readFileSync(join(ROOT, 'manifest.webmanifest'), 'utf8'));
  mf.icons = [
    { src: made[180], sizes: '180x180', type: 'image/png', purpose: 'any' },
    { src: made[192], sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: made[512], sizes: '512x512', type: 'image/png', purpose: 'any' },
  ];
  writeFileSync(join(ROOT, `manifest-${id}.webmanifest`), JSON.stringify(mf, null, 2) + '\n');

  built.push({ id, name, src: made[180], srcset: made, manifest: `manifest-${id}.webmanifest` });
}

rmSync(tmp, { recursive: true, force: true });

writeFileSync(join(ROOT, 'spine', 'app-icons.json'),
  JSON.stringify({ version: 1, built: new Date().toISOString().slice(0, 10),
                   count: built.length, icons: built }, null, 2) + '\n');

console.log(`  ${built.length} icon${built.length === 1 ? '' : 's'} built: ${built.map(b => b.name).join(', ')}`);
if (built.length < 2) {
  console.log('  The picker hides itself below 2 choices, which is right: one option is not a choice.');
}
