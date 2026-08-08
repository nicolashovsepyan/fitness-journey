/* ============================================================
   BUILD DECK ART — the survey's exercise cards.

   Run:  node tools/build-deck-art.mjs

   Rewrites the <script id="deckart"> island in onboarding.html from
   the artwork in "EXERCISE LIBRARY".

   The survey shows twelve cards, drawn from two decks — a gym deck if
   the person has weights, a bodyweight deck otherwise. Twenty-two
   distinct movements across the two. This keeps their pictures in step
   with the folder instead of a hand-pasted blob nobody dares touch.

   The keys are the DECK's ids (pushup, bwsquat, kbswing…), which are
   not the app's exercise ids. That mismatch is real and is recorded in
   DECK_TO_CANONICAL in js/core/schema.js; this script is not the place
   to fix it.

   A movement with no entry here falls back to the drawn stick figure,
   so a missing picture is a plainer card, never a broken one.
   ============================================================ */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = process.argv[2] || join(ROOT, 'EXERCISE LIBRARY');
const PAGE = join(ROOT, 'onboarding.html');

/* The card renders about 340px wide. 440 covers that comfortably; going to
   520 and a 128-colour palette cost 30% more bytes for no visible gain on
   flat-shaded illustration. This page is shared as a cold link on mobile
   data, so the bytes are the constraint, not the pixels. */
const WIDTH = 440;
const PALETTE = 96;

/* deck id  ->  file in EXERCISE LIBRARY */
const MAP = {
  /* bodyweight deck */
  pushup:    'push-up-anime.png',
  bwsquat:   'bodyweight-squat-anime.png',
  lunge:     'bulgarian-split-squat-anime.png',
  jumpsquat: 'jump-squat-anime.png',
  slrdl:     'single-leg-rdl-right-hand-contralateral-corrected.png',
  pullup:    'pull-up-anime-male.png',
  invrow:    'inverted-row-squat-rack-barbell-lower-v2.png',
  pike:      'pike-push-up-anime-transparent-v2.png',
  mtnclimb:  'mountain-climber-anime.png',
  wallsit:   'wall-sit-anime.png',
  plank:     'plank-forearms-and-straight-arms-stacked-transparent.png',
  hang:      'dead-hang-anime.png',

  /* gym deck */
  squat:     'back-squat-135lb-anime-transparent.png',
  bench:     'flat-barbell-bench-press-185lb-anime-transparent.png',
  ohp:       'standing-barbell-overhead-press-90lb-anime-transparent.png',
  row:       'bent-over-barbell-row-135lb-Supinated.png',
  carry:     'farmers-carry-anime-transparent.png',
  kbswing:   'kettlebell-swing-anime.png',
  split:     'bulgarian-split-squat-50lb-dumbbells-anime.png',   // gym deck = loaded version
};

/* Asked for by the deck, no artwork yet. Listed rather than left silent. */
const MISSING = {
  dead:   'Deadlift',
  rdl:    'Romanian deadlift',
  thrust: 'Hip thrust (the 45-degree hip extension and glute bridge renders are different movements)',
};

const sh = (c, a) => execFileSync(c, a, { maxBuffer: 1 << 30 });

const art = {};
let bytes = 0;
for (const [id, file] of Object.entries(MAP)) {
  const src = join(SRC, file);
  if (!existsSync(src)) { console.error(`  MISSING FILE  ${file}  (for ${id})`); continue; }
  const png = sh('ffmpeg', ['-v', 'error', '-i', src, '-vf',
    `scale=${WIDTH}:-1:flags=lanczos:force_original_aspect_ratio=decrease,split[a][b];` +
    `[a]palettegen=max_colors=${PALETTE}:reserve_transparent=1[p];[b][p]paletteuse=alpha_threshold=128`,
    '-f', 'image2pipe', '-vcodec', 'png', '-']);
  art[id] = `data:image/png;base64,${png.toString('base64')}`;
  bytes += png.length;
  console.log(`  ${id.padEnd(11)} ${(png.length / 1024).toFixed(0).padStart(4)} KB   ${file}`);
}

let page = readFileSync(PAGE, 'utf8');
const before = page.length;
const island = `<script type="application/json" id="deckart">${JSON.stringify(art)}<\/script>`;
const re = /<script type="application\/json" id="deckart">[\s\S]*?<\/script>/;
if (!re.test(page)) { console.error('Could not find the deckart island.'); process.exit(1); }
writeFileSync(PAGE, page.replace(re, island));

console.log(`\n${Object.keys(art).length} of ${Object.keys(art).length + Object.keys(MISSING).length} deck movements have artwork`);
console.log(`${(bytes / 1024).toFixed(0)} KB raw, ${(bytes * 1.34 / 1024).toFixed(0)} KB inlined`);
console.log(`onboarding.html ${(before / 1024).toFixed(0)} KB -> ${(statSync(PAGE).size / 1024).toFixed(0)} KB`);
console.log('\nStill needs artwork:');
for (const [id, label] of Object.entries(MISSING)) console.log(`  ${id.padEnd(8)} ${label}`);
