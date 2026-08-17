/* ============================================================
   BUILD LOGO — push the mark from logo/ back into the survey.

   Run:  node tools/build-logo.mjs [--check]

   The logo is worked on in its own session, in logo/LOGO LAB.html, so that
   pulling the mark apart cannot break a survey screen by accident. This is
   the only road back: it replaces two marked blocks in onboarding.html —
   the hero's CSS and the hero() function — and touches nothing else in the
   file.

   IT REFUSES RATHER THAN GUESSES.
   If a marker is missing, or the replacement would change the size of the
   file by more than a third, it stops and says so. A build script that
   silently half-applies to a 980 KB single-file app is worse than no build
   script.

   --check reports whether logo/ and onboarding.html agree, without writing.
   Run it before starting logo work: if they have drifted, someone edited the
   survey's copy of the mark by hand and that needs reconciling first.
   ============================================================ */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { appIconSVG, maskableIconSVG, markSVG, triStampSVG, dbStampSVG, iconClearance,
         TRI_D, PLATES, BAR } from '../logo/mark.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PAGE = join(ROOT, 'onboarding.html');
const CHECK = process.argv.includes('--check');
const PNG   = process.argv.includes('--png');

const BLOCKS = [
  { name: 'CSS', src: 'logo/hero.css',
    open:  '/* ===== LOGO:CSS — generated from logo/hero.css, do not edit here ===== */',
    close: '/* ===== /LOGO:CSS ===== */' },
  { name: 'JS',  src: 'logo/hero.js',
    open:  '/* ===== LOGO:JS — generated from logo/hero.js, do not edit here ===== */',
    close: '/* ===== /LOGO:JS ===== */' },
];

let page = readFileSync(PAGE, 'utf8');
const before = page.length;
let changed = 0, drift = 0;

for (const b of BLOCKS) {
  const i = page.indexOf(b.open);
  const j = page.indexOf(b.close);
  if (i < 0 || j < 0 || j < i) {
    console.error(`\n  MARKER MISSING for ${b.name}.`);
    console.error(`  Expected ${b.open}`);
    console.error(`  onboarding.html has not been prepared for this script. Stopping.\n`);
    process.exit(1);
  }
  const current = page.slice(i + b.open.length, j);
  const wanted  = '\n' + readFileSync(join(ROOT, b.src), 'utf8').replace(/\s*$/, '') + '\n';
  if (current === wanted) { console.log(`  ${b.name}: already in step`); continue; }
  drift++;
  if (CHECK) { console.log(`  ${b.name}: DIFFERS — ${current.length} bytes in the page, ${wanted.length} in ${b.src}`); continue; }
  page = page.slice(0, i + b.open.length) + wanted + page.slice(j);
  changed++;
  console.log(`  ${b.name}: updated from ${b.src}`);
}

/* ============================================================
   THE BEAT, MIRRORED INTO THE PREVIEW.

   logo/LOGO PREVIEW.html carries its own copy of the mark's CSS, because it
   has to be one self-contained file and because its framing differs from the
   survey's. That copy drifted the first time the beat changed — the glare
   was animated in hero.css and still a constant in the preview, so the page
   showed three peaks as two and said nothing was wrong.

   Only the timing-critical region is mirrored: everything between BEAT:START
   and BEAT:END. The preview's layout rules stay its own.
   ============================================================ */
const BEAT_OPEN  = '/* ===== BEAT:START';
const BEAT_CLOSE = '/* ===== BEAT:END ===== */';
const PREVIEW = join(ROOT, 'logo/LOGO PREVIEW.html');

function sliceBeat(text, label) {
  const i = text.indexOf(BEAT_OPEN);
  const j = text.indexOf(BEAT_CLOSE);
  if (i < 0 || j < 0 || j < i) {
    console.error(`\n  BEAT MARKER MISSING in ${label}. Stopping.\n`);
    process.exit(1);
  }
  /* from the end of the opening marker's line to the start of the closer */
  const from = text.indexOf('\n', i) + 1;
  return { from, to: j, body: text.slice(from, j) };
}

if (existsSync(PREVIEW)) {
  const heroCss = readFileSync(join(ROOT, 'logo/hero.css'), 'utf8');
  const want = sliceBeat(heroCss, 'logo/hero.css').body;
  let prev = readFileSync(PREVIEW, 'utf8');
  const got = sliceBeat(prev, 'logo/LOGO PREVIEW.html');
  if (got.body === want) {
    console.log('  preview beat: already in step');
  } else if (CHECK) {
    console.log(`  preview beat: DIFFERS — ${got.body.length} bytes in the preview, ${want.length} in hero.css`);
    drift++;
  } else {
    writeFileSync(PREVIEW, prev.slice(0, got.from) + want + prev.slice(got.to));
    changed++;
    console.log('  preview beat: updated from logo/hero.css');
  }
}

/* ============================================================
   THE STATIC EXPORTS.

   Everything above pushes the MOVING mark into the survey. Everything below
   writes the still ones — the app icon and the two stamps — from
   logo/mark.mjs. Before this existed, icon.svg was drawn by hand and had
   drifted: it carried the dumbbell alone, in teal, with no triangle in it at
   all, so the home screen and the opening screen were different marks.

   Each file is only rewritten if its contents would actually change, so
   running this twice is a no-op and `git status` stays honest.
   ============================================================ */
const ASSETS = [
  { name: 'icon.svg',           out: 'icon.svg',                  make: appIconSVG },
  { name: 'icon-maskable.svg',  out: 'icon-maskable.svg',         make: maskableIconSVG },
  { name: 'logo-mark.svg',      out: 'images/logo-mark.svg',      make: markSVG },
  { name: 'stamp-triangle.svg', out: 'images/stamp-triangle.svg', make: triStampSVG },
  { name: 'stamp-dumbbell.svg', out: 'images/stamp-dumbbell.svg', make: dbStampSVG },
];

/* The PNGs the manifest and apple-touch-icon point at. Opt-in with --png
   because it shells out to qlmanage, which only exists on macOS: a build
   that silently does less on Linux is worse than one that has to be asked. */
const PNGS = [
  { out: 'icon-512.png',          size: 512, from: 'icon.svg' },
  { out: 'icon-192.png',          size: 192, from: 'icon.svg' },
  { out: 'icon-180.png',          size: 180, from: 'icon.svg' },
  { out: 'icon-512-maskable.png', size: 512, from: 'icon-maskable.svg' },
];

/* A guard against mark.mjs and hero.js drifting apart. hero.js keeps its
   geometry inline because the survey has to be one file, so the same numbers
   live in two places; this makes a mismatch loud instead of shipping a home
   screen and an opening screen that are different marks.

   It compares NUMBERS, not text. Matching on substrings looked fine until
   hero.js wrote y1:40.70 where mark.mjs holds 40.7, and the check failed on
   a difference that does not exist. */
const heroJs = readFileSync(join(ROOT, 'logo/hero.js'), 'utf8');
const flat = heroJs.replace(/\s+/g, '');
const near = (a, b) => Math.abs(a - b) < 1e-6;

const heroPlates = [...flat.matchAll(/\{x:([\d.]+),y1:([\d.]+),y2:([\d.]+),w:([\d.]+)\}/g)]
  .map(m => ({ x: +m[1], y1: +m[2], y2: +m[3], w: +m[4] }));
const heroBar = flat.match(/BAR=\{d:'([^']+)',w:([\d.]+)\}/);

const problems = [];
if (!heroJs.includes(TRI_D)) problems.push(`triangle path — hero.js does not contain "${TRI_D}"`);
if (!heroBar) problems.push('bar — could not find BAR = {d:…, w:…} in hero.js');
else {
  /* both sides stripped: heroBar came out of the whitespace-free copy, so
     'M86 65 H174' is sitting there as 'M8665H174' */
  if (heroBar[1] !== BAR.d.replace(/\s+/g, ''))
    problems.push(`bar path — hero.js "${heroBar[1]}" vs mark.mjs "${BAR.d}"`);
  if (!near(+heroBar[2], BAR.w)) problems.push(`bar width — hero.js ${heroBar[2]} vs mark.mjs ${BAR.w}`);
}
if (heroPlates.length !== PLATES.length) {
  problems.push(`plates — hero.js declares ${heroPlates.length}, mark.mjs declares ${PLATES.length}`);
} else {
  PLATES.forEach((p, i) => {
    const h = heroPlates[i];
    for (const k of ['x', 'y1', 'y2', 'w']) {
      if (!near(h[k], p[k])) problems.push(`plate ${i + 1} ${k} — hero.js ${h[k]} vs mark.mjs ${p[k]}`);
    }
  });
}
if (problems.length) {
  console.error(`\n  GEOMETRY DRIFT between logo/mark.mjs and logo/hero.js:`);
  for (const p of problems) console.error(`    ${p}`);
  console.error(`  The moving mark and the exported one would not match. Stopping.\n`);
  process.exit(1);
}

/* The icon's plates must not crowd the neon they sit inside. This is the
   same guarantee the hero gets from its live clearance readout — the hero
   just has a person watching it, and the icon does not. */
const clear = iconClearance();
const MIN_CLEAR = 8;
if (clear.px < MIN_CLEAR) {
  console.error(`\n  ICON TOO TIGHT: ${clear.px}px between the plates and the outline (${clear.where}).`);
  console.error(`  Wanted at least ${MIN_CLEAR}px on a 512 tile. Adjust ICON_LAYOUT in logo/mark.mjs.`);
  console.error(`  Nothing written.\n`);
  process.exit(1);
}
console.log(`  icon geometry: ${clear.px}px clear, bar ${clear.barPct}% down the outline`);

let wrote = 0, assetDrift = 0;
for (const a of ASSETS) {
  const path = join(ROOT, a.out);
  const wanted = a.make();
  const current = existsSync(path) ? readFileSync(path, 'utf8') : null;
  if (current === wanted) { console.log(`  ${a.name}: already in step`); continue; }
  assetDrift++;
  if (CHECK) {
    console.log(`  ${a.name}: ${current === null ? 'MISSING' : 'DIFFERS'} — would write ${wanted.length} bytes`);
    continue;
  }
  writeFileSync(path, wanted);
  wrote++;
  console.log(`  ${a.name}: written${current === null ? ' (new)' : ''}`);
}

/* ---- the rasters ---------------------------------------------------------
   qlmanage is a thumbnailer, not a renderer, and it insists on naming its
   output <input>.png next to wherever it was told to put it — hence the temp
   directory and the copy. It does honour SVG filters, which is the thing
   that actually mattered: without them the icon is a line drawing rather
   than neon. */
if (PNG && !CHECK) {
  let rasterised = 0;
  const tmp = mkdtempSync(join(tmpdir(), 'fj-icon-'));
  try {
    for (const p of PNGS) {
      const src = join(ROOT, p.from);
      if (!existsSync(src)) { console.error(`  ${p.out}: SKIPPED — ${p.from} is missing`); continue; }
      const staged = join(tmp, p.from.replace(/\//g, '_'));
      copyFileSync(src, staged);
      execFileSync('qlmanage', ['-t', '-s', String(p.size), '-o', tmp, staged], { stdio: 'ignore' });
      const produced = staged + '.png';
      if (!existsSync(produced)) {
        console.error(`\n  RASTERISE FAILED for ${p.out}. qlmanage wrote nothing.`);
        console.error(`  Leaving the existing PNGs alone.\n`);
        process.exit(1);
      }
      copyFileSync(produced, join(ROOT, p.out));
      rmSync(produced, { force: true });
      rasterised++;
      console.log(`  ${p.out}: rasterised at ${p.size}px`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`  ${rasterised} PNG(s) written.`);
}

if (CHECK) {
  const total = drift + assetDrift;
  console.log(total ? `\n${total} item(s) out of step. Reconcile before working on the logo.\n`
                    : '\nlogo/, onboarding.html and the exported assets all agree.\n');
  process.exitCode = total ? 1 : 0;
} else if (changed) {
  /* A single-file app is easy to destroy with a bad slice. This is the seat
     belt: a legitimate logo edit moves a few kilobytes, not a third of the
     document. */
  const ratio = Math.abs(page.length - before) / before;
  if (ratio > 0.33) {
    console.error(`\n  REFUSING: that would change the file by ${(ratio*100).toFixed(0)}%.`);
    console.error(`  ${(before/1024).toFixed(0)} KB -> ${(page.length/1024).toFixed(0)} KB. Nothing written.\n`);
    process.exit(1);
  }
  writeFileSync(PAGE, page);
  console.log(`\nonboarding.html ${(before/1024).toFixed(0)} KB -> ${(page.length/1024).toFixed(0)} KB`);
  console.log(`${wrote} asset(s) written.`);
  console.log('Re-run node build-sw.mjs before deploying.\n');
} else if (wrote) {
  console.log(`\n${wrote} asset(s) written; the survey was already in step.`);
  console.log('Re-run node build-sw.mjs before deploying.\n');
} else {
  console.log('\nNothing to do.\n');
}
