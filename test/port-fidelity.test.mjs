/* ============================================================
   THE PORTED PROGRAMS STILL SAY WHAT THE SOURCE SAID.

   Run:  node test/port-fidelity.test.mjs

   Two programs were written before any of this existed and live as
   JavaScript objects in js/data/. tools/port-programs.mjs turns them into
   spine/programs/*.json. Nothing in that step is allowed to invent
   training — and for a long time it was not inventing anything, it was
   QUIETLY DROPPING things, which is worse because it looks like data.

   Two real losses, both found by reading a client's program back and not
   believing it:

     THE BLOCK'S SHAPE. `format`, `rounds`, `rest` and `pair` were never
     copied. A three-round superset with 75 seconds between became one
     Straight block, one set of each, no bracket — and every check
     downstream read the 1 and agreed with it.

     WHICH SIDE. `perSide: true` means do both sides in this set.
     `side: 'L'` means this row IS the left one, written as two rows on
     purpose. Both were read as "each side", so a 30-second left plank and
     a 30-second right plank both became "30s each side": the work
     doubled and the side vanished.

   Neither threw. Neither showed up in a diff anybody read. This is the
   check that would have caught them on the day.
   ============================================================ */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { SESSIONS } = await import(pathToFileURL(join(ROOT, 'js/data/sessions.js')));
const { PROGRAM, BEGINNER_PROGRAM } = await import(pathToFileURL(join(ROOT, 'js/data/program.js')));

const FORMAT = { superset:'Superset', circuit:'Circuit', emom:'EMOM',
                 amrap:'AMRAP', tabata:'Tabata', straight:'Straight' };
/* skill, tempo and yates have no console equivalent and become Straight —
   a deliberate, documented loss, so they are not failures here */
const MAPPED = new Set(Object.keys(FORMAT));

let failed = 0, blocks = 0, items = 0;
const bad = (m) => { console.log('  FAIL  ' + m); failed++; };
const group = (n) => console.log('\n' + n);

function verify(id, prog) {
  const j = JSON.parse(readFileSync(join(ROOT, 'spine/programs', id + '.json'), 'utf8'));
  prog.week.forEach((w, i) => {
    const src = SESSIONS[w.sessionId], out = j.days['d' + (i + 1)], where = `${id} d${i + 1}`;
    if (!out) return bad(`${where}: missing from the ported file`);
    if (src.blocks.length !== out.blocks.length)
      bad(`${where}: ${src.blocks.length} blocks in, ${out.blocks.length} out`);

    src.blocks.forEach((sb, bi) => {
      const ob = out.blocks[bi]; if (!ob) return;
      const at = `${where} b${bi} "${sb.name || sb.role}"`;
      const cfg = ob.cfg || {};
      blocks++;

      /* --- the block's shape --- */
      if (sb.format && MAPPED.has(sb.format) && ob.type !== FORMAT[sb.format])
        bad(`${at} type: source ${sb.format}, ported ${ob.type}`);
      const carriesRounds = ['Superset', 'Circuit', 'Tabata'].includes(ob.type);
      if (sb.rounds != null && carriesRounds && cfg.rounds !== sb.rounds)
        bad(`${at} rounds: source ${sb.rounds}, ported ${cfg.rounds}`);
      const srest = sb.roundRest != null ? sb.roundRest : sb.rest;
      if (srest != null && ['Superset', 'Circuit'].includes(ob.type) && cfg.rest !== srest)
        bad(`${at} rest: source ${srest}, ported ${cfg.rest}`);

      /* --- the movements, in order --- */
      if (sb.items.length !== (ob.items || []).length)
        bad(`${at} item count: source ${sb.items.length}, ported ${(ob.items || []).length}`);

      sb.items.forEach((si, ii) => {
        const oi = (ob.items || [])[ii]; if (!oi) return;
        items++;
        if (si.ex !== oi.ex) bad(`${at} item ${ii}: source ${si.ex}, ported ${oi.ex}`);

        /* --- which side --- */
        const p = String(oi.pres || '');
        if (si.side === 'L' || si.side === 'R') {
          const want = si.side === 'L' ? 'left' : 'right';
          if (p.includes('each side'))
            bad(`${at} item ${ii} ${si.ex}: source is the ${want} row, ported says "each side"`);
          else if (!p.includes(want))
            bad(`${at} item ${ii} ${si.ex}: source side ${si.side}, ported "${p}"`);
        }
        if (si.perSide === true && !p.includes('each side'))
          bad(`${at} item ${ii} ${si.ex}: source is per-side, ported "${p}"`);

        /* --- the work itself survives into the string --- */
        const n = si.hold != null ? si.hold : (si.repsText || si.reps);
        if (n != null && !p.includes(String(n)))
          bad(`${at} item ${ii} ${si.ex}: source ${n}, ported "${p}"`);

        /* --- pairing --- */
        if (!!si.pair !== (oi.sg != null))
          bad(`${at} item ${ii} ${si.ex}: source pair ${si.pair || 'none'}, ported sg ${oi.sg}`);
      });

      /* both halves of A1/A2 must land in the SAME group, or the bracket
         draws around one movement and calls it a superset */
      const letters = {};
      sb.items.forEach((si, ii) => { if (si.pair) (letters[String(si.pair)[0]] ||= []).push(ii); });
      for (const [L, idx] of Object.entries(letters)) {
        const sgs = new Set(idx.map(ii => (ob.items[ii] || {}).sg));
        if (sgs.size !== 1) bad(`${at} pair ${L}: rows ${idx.join('+')} landed in groups ${[...sgs].join('/')}`);
      }
    });
  });
}

group('every block keeps its shape, and every row its side');
verify('main', PROGRAM);
verify('beginner_return', BEGINNER_PROGRAM);
console.log(`  ok    ${blocks} blocks and ${items} movements compared against the source`);

console.log(failed ? `\n${failed} check(s) failed.\n` : '\nAll checks passed.\n');
process.exit(failed ? 1 : 0);
