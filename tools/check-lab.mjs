#!/usr/bin/env node
/* ============================================================
   IS THE LAB THE CURRENT DASHBOARD?

   Run:  node tools/check-lab.mjs

   dashboard-lab.html is generated from dashboard.html. If the real
   dashboard changes and nobody rebuilds, the lab quietly becomes a
   copy of last week, and then somebody judges a layout against the
   wrong baseline, or reports a bug that was fixed on Tuesday.

   ONLY dashboard.html NEEDS A REBUILD. lab/lab.css and lab/lab.js are
   linked, not copied in, so editing an experiment takes effect on the
   next reload with no build at all. That is the point of the split:
   the part you fiddle with is live, the part you inherit is stamped.

   That failure is silent by nature: the lab still opens, still works,
   still looks plausible. So it gets a check.

   It rebuilds in memory and compares. No file is written, so this is
   safe to run on a dirty tree and in any order.
   ============================================================ */
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LAB = join(ROOT, 'dashboard-lab.html');

if (!existsSync(LAB)) {
  console.log('  No dashboard-lab.html. Nothing to check.');
  console.log('  Make one with: node tools/build-lab.mjs');
  process.exit(0);
}

/* Build into a scratch copy of the tree rather than over the real file:
   a CHECK that writes is a check nobody dares run. */
const tmp = mkdtempSync(join(tmpdir(), 'fj-lab-'));
let fresh;
try {
  const before = readFileSync(LAB, 'utf8');
  copyFileSync(LAB, join(tmp, 'keep.html'));
  execFileSync(process.execPath, [join(ROOT, 'tools', 'build-lab.mjs')], { cwd: ROOT, stdio: 'ignore' });
  fresh = readFileSync(LAB, 'utf8');
  // put the original back, whatever the answer turns out to be
  copyFileSync(join(tmp, 'keep.html'), LAB);

  if (before === fresh) {
    console.log('  dashboard-lab.html is the current dashboard plus lab/.');
    process.exit(0);
  }
  console.log(`
  OUT OF STEP. dashboard.html has changed since the lab was built, so the
  lab is showing an older dashboard than the real one.

  Rebuild it:  node tools/build-lab.mjs
`);
  process.exit(1);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
