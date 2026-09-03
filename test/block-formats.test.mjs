/* ============================================================
   THE CONSOLE AND THE RUNNER SPELL THE SAME IDEAS THE SAME WAY.

   Run:  node test/block-formats.test.mjs

   The console writes a block's settings into `cfg`, using the words its
   own editor uses. The runner reads them off the block, using the words
   IT uses. Nobody ever checked that those were the same words.

   They were not. Four of the seven settings a coach can type went
   nowhere:

     console cfg.off       Tabata's rest    runner reads b.rest
     console cfg.cap       AMRAP's cap      runner reads b.minutes
     console cfg.interval  EMOM's interval  runner reads b.work
     console cfg.mins      EMOM's length    runner counts rounds
     console cfg.rest      a Circuit's rest runner reads b.roundRest

   Nothing threw. The runner has a default for every one of them, so an
   EMOM written as 12 minutes on a 90-second interval ran as 60-second
   intervals for as long as its round count said, and looked fine doing
   it. That is the shape of every bug in this file's history: not a
   crash, a field that quietly stops being read.

   This builds one block of each type, sends it through the REAL path —
   loadCurrentProgram, then resolveSession, the same two calls the app
   makes — and asserts the runner's own field names arrive with the
   coach's numbers in them.
   ============================================================ */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { StorageAdapter, setAdapter } from '../js/core/storage.js';
import { loadCurrentProgram } from '../js/core/current.js';
import { resolveSession } from '../js/core/resolve.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;
const t = (name, cond, got) => {
  console.log((cond ? '  ok    ' : '  FAIL  ') + name + (cond ? '' : `   got ${JSON.stringify(got)}`));
  if (!cond) failed++;
};
const group = n => console.log('\n' + n);

class One extends StorageAdapter {
  constructor(p) { super(); this.p = p; }
  async getProgram() { return this.p; }
}

/* One block per type, every setting given a value that is NOT the
   runner's default — a test that passes on defaults proves nothing. */
const BLOCKS = [
  { role:'Work', name:'Superset', type:'Superset', cfg:{ rounds:5, rest:110 },
    items:[{ ex:'dip', pres:'8' }, { ex:'pullup', pres:'6' }] },
  { role:'Work', name:'Circuit', type:'Circuit', cfg:{ rounds:6, rest:35 },
    items:[{ ex:'kb_swing', pres:'12' }, { ex:'goblet_squat', pres:'10' }] },
  { role:'Finish', name:'AMRAP', type:'AMRAP', cfg:{ cap:9 },
    items:[{ ex:'burpee', pres:'8' }] },
  { role:'Finish', name:'Tabata', type:'Tabata', cfg:{ rounds:8, work:25, off:15 },
    items:[{ ex:'jump_squat', pres:'10' }, { ex:'pushup', pres:'10' }] },
  { role:'Work', name:'EMOM', type:'EMOM', cfg:{ mins:12, interval:90 },
    items:[{ ex:'kb_swing', pres:'10' }] },
];

setAdapter(new One({ id:'p', assignedTo:'n', name:'Formats',
  profile:{ source:'console', raw:{ name:'Formats', duration:40,
    days:{ d1:{ name:'All formats', blocks:BLOCKS } } } } }));
await loadCurrentProgram('n');
const ses = resolveSession('d1', { duration: 40 });
const by = {}; for (const b of ses.blocks) by[b.format] = b;

group('every block type reaches the runner as the runner spells it');
t('all five blocks survived', ses.blocks.length === 5, ses.blocks.length);

const sup = by.superset || {};
t('superset · rounds',    sup.rounds === 5,   sup.rounds);
t('superset · rest',      sup.rest === 110,   sup.rest);

const cir = by.circuit || {};
t('circuit · rounds',     cir.rounds === 6,   cir.rounds);
t('circuit · roundRest',  cir.roundRest === 35, cir.roundRest);

const am = by.amrap || {};
t('amrap · minutes',      am.minutes === 9,   am.minutes);

const tb = by.tabata || {};
t('tabata · rounds',      tb.rounds === 8,    tb.rounds);
t('tabata · work',        tb.work === 25,     tb.work);
t('tabata · rest',        tb.rest === 15,     tb.rest);

const em = by.emom || {};
t('emom · work is the interval', em.work === 90, em.work);
t('emom · rounds cover the stated length',
  em.rounds === 8, em.rounds);   /* 12 min / 90s / 1 item = 8 */

/* The runner has a default for every one of these, so a field that never
   arrives looks exactly like a field that arrived with the default in
   it. This is the check that tells those two apart. */
group('the runner actually reads the names we are sending');
const wm = readFileSync(join(ROOT, 'js/runner/workmode.js'), 'utf8');
for (const [fmt, fields] of Object.entries({
  superset:['rounds','rest'], circuit:['rounds','roundRest'],
  amrap:['minutes'], tabata:['rounds','work','rest'], emom:['work'],
})) for (const f of fields)
  t(`workmode reads b.${f}   (${fmt})`, new RegExp(`\\bb\\.${f}\\b`).test(wm));

console.log(failed ? `\n${failed} check(s) failed.\n` : '\nAll checks passed.\n');
process.exit(failed ? 1 : 0);
