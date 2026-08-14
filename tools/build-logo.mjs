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
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PAGE = join(ROOT, 'onboarding.html');
const CHECK = process.argv.includes('--check');

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

if (CHECK) {
  console.log(drift ? `\n${drift} block(s) out of step. Reconcile before working on the logo.\n`
                    : '\nlogo/ and onboarding.html agree.\n');
  process.exitCode = drift ? 1 : 0;
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
  console.log('Re-run node build-sw.mjs before deploying.\n');
} else {
  console.log('\nNothing to do.\n');
}
