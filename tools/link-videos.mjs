/* ============================================================
   READ THE VIDEO FORM BACK IN.

   Run:  node tools/link-videos.mjs

   Reads " FOR NICOLAS/VIDEOS TO LINK.md", takes every line shaped
   `movement_id = https://…`, and writes the URLs into the workbook's
   demo column so the next spine build carries them.

   Lines with nothing after the `=` are skipped, not blanked - the file
   is a worklist that gets filled in over time, not a snapshot.

   It refuses an id it does not recognise rather than silently dropping
   it, because a typo in a movement id is exactly the sort of thing that
   looks like it worked.
   ============================================================ */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, nicolas, must } from './paths.mjs';

const cat = JSON.parse(readFileSync(join(ROOT, 'spine/catalog.json'), 'utf8')).movements;
const form = join(must(nicolas(), 'FOR NICOLAS'), 'VIDEOS TO LINK.md');
if (!existsSync(form)) { console.error('  ! no VIDEOS TO LINK.md — nothing to read'); process.exit(1); }

const links = {}, unknown = [];
for (const line of readFileSync(form, 'utf8').split('\n')) {
  const m = line.match(/^([a-z0-9_]+)\s*=\s*(\S+)\s*$/i);
  if (!m) continue;
  const [, id, url] = m;
  if (!cat[id]) { unknown.push(id); continue; }
  if (!/^https?:\/\//i.test(url)) { unknown.push(`${id} (not a url: ${url})`); continue; }
  links[id] = url;
}

const n = Object.keys(links).length;
console.log(`\n  ${n} video link(s) found in the form`);
for (const [id, url] of Object.entries(links)) console.log(`     ${cat[id].name.padEnd(28)} ${url}`);
if (unknown.length) {
  console.log(`\n  ${unknown.length} line(s) I could not use:`);
  unknown.forEach(u => console.log(`     ${u}`));
}
if (!n) { console.log('\n  Nothing to write yet. Paste URLs after the = signs.\n'); process.exit(0); }

/* Written beside the form rather than into the workbook: the workbook is
   an Excel file this repo does not open, and a JSON sidecar the spine
   build reads is honest about which of the two is the source. */
const side = join(ROOT, 'spine', 'videos.json');
const prev = existsSync(side) ? JSON.parse(readFileSync(side, 'utf8')) : {};
writeFileSync(side, JSON.stringify({ ...prev, ...links }, null, 2) + '\n');
console.log(`\n  written to spine/videos.json — run build-spine.mjs to carry them into the catalog\n`);
