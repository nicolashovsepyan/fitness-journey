/* ============================================================
   BUILD AVATARS — slice the body-type sheets into the survey.

   Run:  node tools/build-avatars.mjs ["<sheets folder>"]
   Default folder: "EXERCISE LIBRARY" (and one level below it)

   Nicolas renders one sheet per sex per age band: five figures in a
   row, transparent background, no labels. This script finds the five
   figures by their alpha channel, crops each one, scales it, encodes
   it, and rewrites the <script id="avatarart"> island inside
   onboarding.html.

   WHY A SCRIPT AND NOT A ONE-OFF PASTE:
   the artwork is already on v4. Every re-render would otherwise mean
   hand-editing half a megabyte of base64 inside a 700 KB HTML file.
   Re-run this instead; it is idempotent.

   WHY THE FIGURES ARE FOUND RATHER THAN HARDCODED:
   the sheets have been re-rendered at different canvas sizes and with
   the figures in slightly different places. Measuring the alpha
   channel each time means a re-render cannot silently shift a crop
   and put someone's head half out of frame.

   WHY A SHARED VERTICAL CROP:
   all five figures are cut between the same two scanlines — the top
   of the tallest and the bottom of the lowest across the whole sheet.
   Cropping each figure to its own height would scale them all to the
   same size and quietly destroy the height difference between a thin
   frame and a heavy one, which is the entire point of the picture.

   FORMAT: 8-bit palette PNG. Alpha is required (the figures sit on a
   dark screen), which rules out JPEG, and this ffmpeg has no WebP
   encoder. A 128-colour palette holds the skin gradients without
   visible banding and costs about a third of full-colour PNG —
   roughly 7 KB per figure.

   Needs ffmpeg on PATH. No npm install.
   ============================================================ */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC_DIR = process.argv[2] || join(ROOT, 'EXERCISE LIBRARY');
const PAGE = join(ROOT, 'onboarding.html');
const OUT_DIR = join(ROOT, 'images', 'avatars');

/* Order matters and is not alphabetical — it is the order the figures
   appear in the sheet, and it must match SHAPE_NOTE[0..4] in the survey. */
const TYPES = ['thin', 'athletic', 'average', 'soft', 'overweight'];
const FIG_HEIGHT = 300;    // the carousel shows one figure large, not a row of five
const PALETTE = 96;
const PAD = 6;               // px of breathing room either side of a figure

const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { maxBuffer: 1 << 30, ...opts });

function dims(file) {
  const out = sh('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file]).toString();
  const g = k => +out.split('\n').find(l => l.includes(k)).split(':')[1];
  return { w: g('pixelWidth'), h: g('pixelHeight') };
}

/* Sheets whose filename carries no age band. Written down rather than
   guessed: a wrong guess here puts a 25-year-old body on a 60-year-old's
   screen, and nothing in the app would ever flag it. */
const OVERRIDE = {
  'fitness-journey-female-avatar-card-athletic-refined-v1.png': { sex: 'f', band: 'a1' },
};

/** Which sheet is this? Sex from the filename, age band from the numbers in it. */
function classify(name) {
  if (OVERRIDE[name]) return OVERRIDE[name];
  const n = name.toLowerCase();
  const sex = /female|woman|women|_f[_.-]|-f-/.test(n) ? 'f' : 'm';
  let band = null;
  if (/12[^0-9]?-?[^0-9]?37|young/.test(n)) band = 'a1';
  else if (/38[^0-9]{0,3}5[45]|40[^0-9]{0,3}5[45]/.test(n)) band = 'a2';
  else if (/55[^0-9]*(\+|plus)|65/.test(n)) band = 'a3';
  return { sex, band };
}

/* Columns that contain any non-transparent pixel, merged into five runs. */
function findFigures(rgba, w, h) {
  const solid = new Array(w).fill(0);
  for (let x = 0; x < w; x++) {
    let n = 0;
    for (let y = 0; y < h; y += 2) if (rgba[(y * w + x) * 4 + 3] > 16) n++;
    solid[x] = n;
  }
  const runs = [];
  let cur = null;
  for (let x = 0; x < w; x++) {
    if (solid[x] > 2) cur = cur ? [cur[0], x] : [x, x];
    else { if (cur && cur[1] - cur[0] > 20) runs.push(cur); cur = null; }
  }
  if (cur && cur[1] - cur[0] > 20) runs.push(cur);

  /* A raised arm or a loose shoe can read as its own column. Anything
     closer than 2% of the sheet width belongs to the figure beside it. */
  const merged = [];
  for (const r of runs) {
    const last = merged[merged.length - 1];
    if (last && r[0] - last[1] < w * 0.02) last[1] = r[1];
    else merged.push([...r]);
  }
  return merged;
}

function verticalExtent(rgba, w, h) {
  let top = null, bot = null;
  for (let y = 0; y < h; y++) {
    let any = false;
    for (let x = 0; x < w; x += 3) if (rgba[(y * w + x) * 4 + 3] > 16) { any = true; break; }
    if (any) { if (top === null) top = y; bot = y; }
  }
  return { top, bot };
}

/* Look in the folder and one level down. The sheets have arrived in both
   "EXERCISE LIBRARY" and "EXERCISE LIBRARY/Body Shape", and which one a
   render lands in is not something worth having to remember. */
function findSheets(dir, depth = 1) {
  const out = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    if (name.name.startsWith('.')) continue;
    const full = join(dir, name.name);
    if (name.isDirectory()) { if (depth > 0) out.push(...findSheets(full, depth - 1)); }
    else if (/\.png$/i.test(name.name) && classify(name.name).band) out.push(full);
  }
  return out;
}
const sheets = findSheets(SRC_DIR);
if (!sheets.length) {
  console.error(`No body-type sheets found in ${SRC_DIR}`);
  console.error('Expected filenames carrying an age band, e.g. ...age-12-37...png');
  process.exit(1);
}

/* The same sex+band gets rendered more than once (…-v4, and older
   exports left beside the new ones). Most recently written wins —
   by modification time, not by filename, because "v4" and "final"
   and "Body_type_Male_…" do not sort into any useful order. */
const pick = new Map();
for (const f of sheets) {
  const { sex, band } = classify(basename(f));
  const key = `${sex}_${band}`;
  const mtime = statSync(f).mtimeMs;
  const prev = pick.get(key);
  if (!prev || mtime > prev.mtime) pick.set(key, { file: f, mtime });
}

/* Rebuilt from scratch each run so a renamed or removed sheet cannot leave
   an orphan behind that the manifest no longer mentions. */
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const art = {};
let bytes = 0;
for (const [key, { file }] of [...pick].sort()) {
  const full = file;
  const { w, h } = dims(full);
  const rgba = sh('ffmpeg', ['-v', 'error', '-i', full, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-']);
  if (rgba.length < w * h * 4) { console.error(`  ${basename(file)}: could not decode`); continue; }

  const figs = findFigures(rgba, w, h);
  if (figs.length !== 5) {
    console.error(`  ${basename(file)}: found ${figs.length} figures, expected 5 — skipped.`);
    console.error('    The five bodies must not touch or overlap in the sheet.');
    continue;
  }
  const { top, bot } = verticalExtent(rgba, w, h);
  const ch = bot - top + 2;

  console.log(`${basename(file)}  (${w}x${h})  ->  ${key}`);
  for (let i = 0; i < 5; i++) {
    const [a, b] = figs[i];
    const cx = Math.max(0, a - PAD);
    const cw = Math.min(w - cx, b - a + PAD * 2);
    const png = sh('ffmpeg', ['-v', 'error', '-i', full, '-vf',
      `crop=${cw}:${ch}:${cx}:${top},scale=-1:${FIG_HEIGHT}:flags=lanczos,split[a][b];` +
      `[a]palettegen=max_colors=${PALETTE}:reserve_transparent=1[p];[b][p]paletteuse=alpha_threshold=128`,
      '-f', 'image2pipe', '-vcodec', 'png', '-']);
    /* Written as a file, not inlined. Thirty figures is ~470 KB of base64 in
       a page where any one person ever sees five of them — six times the
       bytes for no benefit. As files the browser fetches only the five it
       needs, and the survey page drops by the whole amount. It still works
       from a shared link: the link needs a connection anyway. */
    const name = `${key}_${TYPES[i]}.png`;
    writeFileSync(join(OUT_DIR, name), png);
    art[`${key}_${TYPES[i]}`] = 1;
    bytes += png.length;
    console.log(`    ${TYPES[i].padEnd(11)} ${String(cw).padStart(4)}px wide  ${(png.length / 1024).toFixed(1)} KB`);
  }
}

if (!Object.keys(art).length) { console.error('Nothing to write.'); process.exit(1); }

/* Rewrite the island in place, or add it beside the deck artwork.
   Same trick as deckart: the browser does not parse a JSON island as
   JavaScript, so this costs nothing until the screen actually needs it. */
let page = readFileSync(PAGE, 'utf8');
/* The island is now just the list of which figures exist — under 400 bytes.
   The survey checks it before building a URL, so a sheet that has not been
   rendered yet falls back to the drawn silhouette exactly as before rather
   than requesting a file that is not there. */
const island = `<script type="application/json" id="avatarart">${JSON.stringify(Object.keys(art))}<\/script>`;
const re = /<script type="application\/json" id="avatarart">[\s\S]*?<\/script>/;
if (re.test(page)) {
  page = page.replace(re, island);
} else {
  const anchor = /<script type="application\/json" id="deckart">[\s\S]*?<\/script>/;
  if (!anchor.test(page)) { console.error('Could not find the deckart island to anchor to.'); process.exit(1); }
  page = page.replace(anchor, m => `${m}\n${island}`);
}
writeFileSync(PAGE, page);

const have = new Set(Object.keys(art).map(k => k.split('_').slice(0, 2).join('_')));
const want = ['m_a1', 'm_a2', 'm_a3', 'f_a1', 'f_a2', 'f_a3'];
const missing = want.filter(k => !have.has(k));

console.log(`\n${Object.keys(art).length} figures, ${(bytes / 1024).toFixed(0)} KB` +
            ` (${(bytes * 1.34 / 1024).toFixed(0)} KB once inlined)`);
console.log(`onboarding.html is now ${(readFileSync(PAGE).length / 1024).toFixed(0)} KB`);
if (missing.length) {
  console.log(`\nStill missing: ${missing.join(', ')}`);
  console.log('Those fall back to the drawn silhouettes until the sheets exist.');
}
