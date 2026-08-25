/* ============================================================
   KETTLEBELL LIBRARY — validate and merge-plan

   Run: node "EXERCISE DATABASE/tools/build-kettlebell.mjs"

   Checks the researched library against the closed vocabularies and
   against what the database already holds, then writes a merge plan.
   It does NOT touch EXERCISES.xlsx — that file is Nicolas's to edit.
   ============================================================ */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const KB = JSON.parse(readFileSync(join(HERE, 'kettlebell-library.json'), 'utf8'));
const { EXERCISES } = await import(join(ROOT, 'js/data/exercises.js'));

/* the closed vocabularies, `rotation` added — the research surfaced that the
   windmill, bent press and figure-8 are LOADED rotation, not resistance to it,
   and the enum only had anti-rotation. */
const PATTERNS = new Set(['h-push','v-push','straight-arm-push','h-pull','v-pull','straight-arm-pull',
  'squat','hinge','lunge','calf','shin','carry','anti-extension','anti-rotation','anti-lateral-flexion',
  'rotation','flexion','extension','compression','jump','locomotion']);
const MUSCLES = new Set(['quad','glute','hamstring','adductor','calf','tibialis','hip-flexor','lower-back',
  'lat','mid-back','traps','rear-delt','front-delt','side-delt','chest','upper-chest','biceps','triceps',
  'forearm','grip','abs','obliques','serratus']);
const JOINTS = new Set(['shoulder','elbow','wrist','neck','lower-back','hip','knee','ankle']);
const LEVELS = new Set(['beg','int','adv']);

const F = ['id','name','patterns','muscles_primary','muscles_secondary','laterality','measure',
           'level','diff','bells','sec_per_rep','contra','cue','standard'];
const rows = KB.movements.map(a => Object.fromEntries(F.map((k, i) => [k, a[i]])));
const split = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean);

/* ---- 1 · validate ------------------------------------------------- */
const errs = [];
const seen = new Set();
for (const r of rows) {
  if (seen.has(r.id)) errs.push(`duplicate id in library: ${r.id}`);
  seen.add(r.id);
  for (const p of split(r.patterns))          if (!PATTERNS.has(p)) errs.push(`${r.id}: bad pattern "${p}"`);
  for (const m of split(r.muscles_primary))   if (!MUSCLES.has(m))  errs.push(`${r.id}: bad primary muscle "${m}"`);
  for (const m of split(r.muscles_secondary)) if (!MUSCLES.has(m))  errs.push(`${r.id}: bad secondary muscle "${m}"`);
  for (const c of split(r.contra))            if (!JOINTS.has(c))   errs.push(`${r.id}: bad joint "${c}"`);
  if (!LEVELS.has(r.level))                                          errs.push(`${r.id}: bad level "${r.level}"`);
  if (!['bilateral','unilateral','alternating'].includes(r.laterality)) errs.push(`${r.id}: bad laterality`);
  if (!['reps','hold'].includes(r.measure))                          errs.push(`${r.id}: bad measure`);
  if (r.measure === 'reps' && !r.sec_per_rep)                        errs.push(`${r.id}: reps movement with no sec_per_rep`);
  if (!r.cue || !r.standard)                                         errs.push(`${r.id}: missing cue or standard`);
}
/* every track member must exist in the library */
for (const [track, members] of Object.entries(KB.tracks))
  for (const id of members) if (!seen.has(id)) errs.push(`track ${track} references unknown id ${id}`);
for (const id of KB.kb_fundamental) if (!seen.has(id)) errs.push(`kb_fundamental references unknown id ${id}`);

/* ---- 2 · reconcile against the database --------------------------- */
const norm = s => s.toLowerCase().replace(/[^a-z]/g, '');
const dbByNorm = {};
for (const [id, m] of Object.entries(EXERCISES)) { dbByNorm[norm(id)] = id; dbByNorm[norm(m.name)] = id; }

const exact = [], likely = [], fresh = [];
for (const r of rows) {
  if (EXERCISES[r.id]) { exact.push([r.id, r.id]); continue; }
  const hit = dbByNorm[norm(r.id)] || dbByNorm[norm(r.name)]
           || dbByNorm[norm(r.name.replace(/^kettlebell /i, ''))]
           || dbByNorm[norm('kb ' + r.name.replace(/^kettlebell /i, ''))];
  if (hit) likely.push([r.id, hit, EXERCISES[hit].name]); else fresh.push(r);
}

/* kettlebell movements already in the database that the library missed */
const kbInDb = Object.entries(EXERCISES)
  .filter(([id, m]) => (m.equipment || []).includes('kb'))
  .map(([id, m]) => id);
const covered = new Set([...exact.map(x => x[1]), ...likely.map(x => x[1])]);
const orphanKb = kbInDb.filter(id => !covered.has(id));

/* ---- 3 · what a kettlebell-only user could reach after the merge --- */
const GROUPS = {
  Push:  ['h-push','v-push','straight-arm-push'],
  Pull:  ['h-pull','v-pull','straight-arm-pull'],
  Lower: ['squat','hinge','lunge','calf','shin'],
  Core:  ['anti-extension','anti-rotation','anti-lateral-flexion','rotation','flexion','extension','compression'],
  'Carry / jump': ['carry','jump','locomotion'],
};
const after = {};
for (const [g, ps] of Object.entries(GROUPS))
  after[g] = rows.filter(r => ps.includes(split(r.patterns)[0])).length;

/* ---- 4 · report --------------------------------------------------- */
console.log(`KETTLEBELL LIBRARY — ${rows.length} movements researched\n`);
if (errs.length) { console.log(`VALIDATION FAILED (${errs.length}):`); errs.forEach(e => console.log('  ' + e)); process.exitCode = 1; }
else console.log('VALIDATION OK — every pattern, muscle, joint and level is in the closed vocabulary.\n');

console.log(`ALREADY IN THE DATABASE, same id (${exact.length}): ${exact.map(x => x[0]).join(', ') || '-'}`);
console.log(`\nSAME MOVEMENT, DIFFERENT ID (${likely.length}) — merge, do not duplicate:`);
likely.forEach(([a, b, n]) => console.log(`  ${a.padEnd(28)} -> ${b.padEnd(20)} (${n})`));
console.log(`\nGENUINELY NEW (${fresh.length}) — these get added.`);
console.log(`\nKETTLEBELL MOVEMENTS ALREADY IN THE DB THE RESEARCH MISSED (${orphanKb.length}): ${orphanKb.join(', ') || '-'}`);

console.log(`\nWHAT A BELLS-ONLY USER GETS FROM THIS LIBRARY ALONE:`);
for (const [g, n] of Object.entries(after)) {
  const flag = n === 0 ? '  <-- NOTHING' : n < 12 ? '  <-- below the floor of 12' : '';
  console.log(`  ${g.padEnd(14)} ${String(n).padStart(3)}${flag}`);
}
console.log(`\nDECLARED COVERAGE EXCEPTION:`);
console.log('  ' + KB.coverage_warning['v-pull'].split('.')[0] + '.');

writeFileSync(join(HERE, '..', 'workbook', '_kettlebell_merge.json'),
  JSON.stringify({ exact, likely, fresh, orphanKb, after }, null, 1));
console.log(`\nmerge plan -> workbook/_kettlebell_merge.json`);
