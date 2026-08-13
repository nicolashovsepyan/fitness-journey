/* ============================================================
   BUILD CLASSIFIER — the file Nicolas classifies exercises in.

   Run:  node tools/build-classifier.mjs

   Writes "FOR NICOLAS/EXERCISE CLASSIFIER.html": every movement in the
   database, with the fields that decide programming editable in place —
   family, level, difficulty, the fundamentals tier, and the easier/harder
   links that make a progression a chain rather than a list.

   WHY A GENERATED FILE AND NOT A HAND-WRITTEN ONE.
   The database moves. A hand-made copy would be wrong the first time an
   exercise was added, and wrong silently. Re-running this picks up whatever
   is in js/data/ today and carries his existing decisions across, because
   his work lives in the browser's own storage and in the file he exports —
   never in the generated HTML.

   IT MUST WORK FROM A DOUBLE-CLICK IN DROPBOX.
   That means file:// — no server, no fetch, no modules. The data is inlined
   as JSON. Pictures are the one exception: they are referenced relatively at
   ../images/exercises/<id>.png, because inlining seventy of them would make
   a five megabyte file that takes a second to open.

   ROUND TRIP.
   He edits, presses "Save file for Claude", and the browser downloads
   classification.json — only the fields he changed, keyed by exercise id.
   That file is what gets applied back to js/data/. Nothing here writes to
   the database directly; a tool that edits the source under you is a tool
   you cannot trust.
   ============================================================ */
import { writeFileSync, existsSync, statSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/* Same tolerance as the other tools — the folder has turned up renamed with
   a leading space more than once, and it is a reasonable thing to want. */
function resolveDir(parent, wanted) {
  const want = wanted.trim().toLowerCase();
  const exact = join(parent, wanted);
  try { if (statSync(exact).isDirectory()) return exact; } catch {}
  for (const name of readdirSync(parent)) {
    if (name.trim().toLowerCase() !== want) continue;
    const full = join(parent, name);
    try { if (statSync(full).isDirectory()) return full; } catch {}
  }
  return exact;
}
const OUT_DIR = resolveDir(ROOT, 'FOR NICOLAS');
const OUT = join(OUT_DIR, 'EXERCISE CLASSIFIER.html');

/* Import the database rather than parse it. A regex over the source is what
   the image tool has to do (it needs filenames too) and it has already been
   wrong twice; here we can just run the module and read the truth. */
const { EXERCISES } = await import(pathToFileURL(join(ROOT, 'js/data/exercises.js')).href);

/* ---- which movements have a picture ---- */
const imgDir = join(ROOT, 'images', 'exercises');
const HAS_IMG = new Set(
  (existsSync(imgDir) ? readdirSync(imgDir) : [])
    .filter(f => f.endsWith('.png')).map(f => f.slice(0, -4))
);

/* ---- the fourteen families ----
   Nicolas's twelve slots plus mobility and aerobic, which he asked not to be
   treated as warm-up and cool-down. This list is the vocabulary of the whole
   system, so it lives in one place and everything else refers to it. */
const FAMILIES = [
  ['squat',    'Squat'],
  ['hinge',    'Hinge'],
  ['unilat',   'Single leg'],
  ['hpush',    'Horizontal push'],
  ['vpush',    'Vertical push'],
  ['hpull',    'Horizontal pull'],
  ['vpull',    'Vertical pull'],
  ['power',    'Explosive'],
  ['carry',    'Carry / grip'],
  ['fullbody', 'Full body'],
  ['coredyn',  'Core, dynamic'],
  ['corestat', 'Core, static'],
  ['mobility', 'Mobility'],
  ['aerobic',  'Aerobic'],
];

/* A first guess at the family from what the database already says, so he is
   correcting rather than filling in three hundred blanks. Guesses are marked
   in the UI and do not count as decisions until he confirms them. */
function guessFamily(id, m) {
  const p = m.pattern || '';
  const n = ((m.family || '') + ' ' + (m.name || '') + ' ' + id).toLowerCase();

  /* Name first, pattern second. The database's `pattern` is about which
     muscles a movement trains, which is not the same question: a burpee and
     a Turkish get-up are both filed under `push` and neither belongs there
     once the families are about movement roles. Getting this order wrong put
     the burpee, the man-maker and the get-up in Horizontal push. */
  if (/burpee|man.?maker|devil|get.?up|thruster|clean/.test(n))        return 'fullbody';
  if (/sprint|jump|hop|bound|plyo|swing|snatch|explosive|clap|slam/.test(n)) return 'power';
  if (/carry|farmer|suitcase|grip hold|crush|hang\b|dead.?hang|active.?hang/.test(n)) return 'carry';
  if (/run|jog|row erg|bike|skip|march|zone ?2|interval/.test(n))      return 'aerobic';
  if (/cars\b|mobility|stretch|cat.?cow|dog|thread|dislocate|90.?90|prep/.test(n)) return 'mobility';

  if (p === 'mobility')     return 'mobility';
  if (p === 'conditioning') return 'aerobic';
  if (p === 'quad')  return /split|pistol|shrimp|lunge|step|single|one.?leg/.test(n) ? 'unilat' : 'squat';
  if (p === 'hinge') return /single|one.?leg/.test(n) ? 'unilat' : 'hinge';
  if (p === 'glute' || p === 'hamstring') return 'hinge';
  if (p === 'calf' || p === 'shin')       return 'unilat';
  if (p === 'core')  return m.measure === 'hold' ? 'corestat' : 'coredyn';
  if (p === 'push')  return /pike|handstand|hspu|overhead|press to|shoulder press/.test(n) ? 'vpush' : 'hpush';
  if (p === 'pull')  return /pull.?up|chin|muscle.?up|lever|lat ?pull/.test(n) ? 'vpull' : 'hpull';
  if (p === 'skill') return 'vpull';
  return '';
}

/* ---- the fifty I proposed, seeded so he edits rather than starts blank ----
   Names that have no movement in the database are reported in the tool, not
   silently dropped — several of them are real gaps. */
const SEED = {
  beg: ['bodyweight_squat','single_leg_rdl','bulgarian_split','pushup','pike_push_up',
        'incline_row','negative_pullup','farmers_carry','jump_squat','full_burpee',
        'forearm_plank','dead_bug','hip_cars','deep_squat_rock'],
  int: ['bulgarian_split_loaded','nordic_curl','pullup','dip','pseudo_planche_push_up',
        'wall_handstand_hold','hollow_hold','hanging_knee_raise','tuck_l_sit','kb_swing',
        'turkish_get_up','cat_cow','hollow_rocks','goblet_squat','deadlift'],
  adv: ['pistol_squat','archer_pullup','muscle_up_bar','full_front_lever','handstand',
        'handstand_push_up','one_arm_push_up','ring_dip','l_sit','v_sit','dragon_flag',
        'tuck_planche_hold','man_maker','weighted_dip','weighted_chinup','navy_seal_burpee',
        'back_squat','bench_press','overhead_press','bent_over_row'],
};
const seedTier = {}, seedMissing = [];
for (const [tier, ids] of Object.entries(SEED)) {
  for (const id of ids) {
    if (EXERCISES[id]) seedTier[id] = tier;
    else seedMissing.push(`${tier}: ${id}`);
  }
}

/* ---- the payload ---- */
/* A link that names a movement the database does not have is a dead chain —
   no regression to offer a beginner, no next step to offer anyone. Most were
   repaired by tools/fix-progression-links.mjs; the ones left are missing
   movements, so they are shown rather than hidden. */
const REAL = new Set(Object.keys(EXERCISES));
const dead = v => !!v && !REAL.has(v);

const rows = Object.entries(EXERCISES).map(([id, m]) => ({
  id,
  name: m.name || id,
  pattern: m.pattern || '',
  dbFamily: m.family || '',
  equipment: m.equipment || [],
  measure: m.measure || '',
  level: m.level || '',
  diff: m.diff ?? null,
  easier: m.easier || '',
  harder: m.harder || '',
  ess: !!m.ess,
  gymOnly: !!m.gymOnly,
  img: HAS_IMG.has(id),
  badEasier: dead(m.easier),
  badHarder: dead(m.harder),
  guess: guessFamily(id, m),
  seed: seedTier[id] || '',
  cues: (m.cues || '').slice(0, 240),
})).sort((a, b) => a.name.localeCompare(b.name));

const DATA = JSON.stringify({ rows, families: FAMILIES, seedMissing });

/* ============================================================
   The page. Written as one string on purpose — it has to survive being
   copied, emailed and opened from a Dropbox folder with no build step.
   ============================================================ */
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Exercise classifier — Fitness Journey</title>
<style>
:root{
  --bg:#15181c; --panel:#1c2026; --line:#2b3138; --tx:#e9edf2; --tx2:#96a0ac;
  --ac:#7BE3C4; --ac2:#4fbfa0; --pink:#FF5FA2; --amber:#F2C14E; --bad:#ef6b6b;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--tx);
  font:14px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
h1{margin:0;font-size:17px;letter-spacing:-.2px}
.sub{color:var(--tx2);font-size:12px;margin-top:2px}

/* ---- header ---- */
header{position:sticky;top:0;z-index:20;background:var(--panel);
  border-bottom:1px solid var(--line);padding:12px 16px}
.hrow{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.spacer{flex:1}
button{font:inherit;cursor:pointer;border-radius:8px;border:1px solid var(--line);
  background:#222831;color:var(--tx);padding:7px 13px}
button:hover{border-color:#3d4650}
button.go{background:var(--ac);color:#0d1114;border-color:transparent;font-weight:650}
button.go:hover{background:var(--ac2)}
button.warn{color:var(--bad)}

/* ---- the three counters ---- */
.counts{display:flex;gap:8px}
.cnt{background:#222831;border:1px solid var(--line);border-radius:8px;
  padding:5px 11px;font-size:12px;min-width:96px}
.cnt b{font-size:16px;display:block;line-height:1.2}
.cnt.beg b{color:var(--ac)} .cnt.int b{color:var(--amber)} .cnt.adv b{color:var(--pink)}
.cnt.over b{color:var(--bad)}
.cnt small{color:var(--tx2)}

/* ---- filters ---- */
.filters{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:11px}
input[type=search],select,input[type=number],input.link{
  font:inherit;background:#171b20;color:var(--tx);border:1px solid var(--line);
  border-radius:8px;padding:6px 9px}
input[type=search]{min-width:230px}
.chip{font-size:12px;padding:5px 10px;border-radius:99px;background:#222831;
  border:1px solid var(--line);color:var(--tx2);cursor:pointer;user-select:none}
.chip.on{background:var(--ac);color:#0d1114;border-color:transparent;font-weight:600}

/* ---- table ---- */
.wrap{padding:14px 16px 80px}
table{border-collapse:separate;border-spacing:0;width:100%}
th{position:sticky;top:0;background:#191d23;color:var(--tx2);font-size:11px;
  text-transform:uppercase;letter-spacing:.06em;text-align:left;
  padding:8px 8px;border-bottom:1px solid var(--line);z-index:5}
td{padding:6px 8px;border-bottom:1px solid #23282f;vertical-align:middle}
tr.touched td{background:#1a2420}
tr:hover td{background:#1e2329}
.thumb{width:52px;height:38px;object-fit:contain;background:#11151a;
  border-radius:6px;display:block}
.noimg{width:52px;height:38px;border-radius:6px;background:#171b20;
  border:1px dashed #2f353d}
.nm{font-weight:600}
.id{color:#6c7783;font-size:11px;font-family:ui-monospace,Menlo,monospace}
.eq{color:var(--tx2);font-size:11px}
.gymtag{color:var(--amber);font-size:10px;font-weight:700}

/* ---- the tier control ---- */
.tier{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden}
.tier button{border:0;border-radius:0;padding:5px 9px;background:#171b20;
  color:var(--tx2);font-size:12px;font-weight:700;min-width:30px}
.tier button+button{border-left:1px solid var(--line)}
.tier button.on[data-t=""]{background:#39414a;color:var(--tx)}
.tier button.on[data-t="beg"]{background:var(--ac);color:#0d1114}
.tier button.on[data-t="int"]{background:var(--amber);color:#0d1114}
.tier button.on[data-t="adv"]{background:var(--pink);color:#0d1114}

select.fam.guessed{color:var(--tx2);font-style:italic;border-style:dashed}
input.link{width:150px;font-size:12px}
input.link.dead{border-color:var(--bad);color:var(--bad)}
input[type=number]{width:56px}
.miss{color:var(--bad)}

/* ---- ladder view ---- */
.lad{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:14px}
.lcard{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:13px}
.lcard h3{margin:0 0 3px;font-size:13px;letter-spacing:.05em;text-transform:uppercase}
.lcard .n{color:var(--tx2);font-size:11px;margin-bottom:9px}
.step{display:flex;align-items:center;gap:8px;padding:4px 0;font-size:13px}
.dot{width:7px;height:7px;border-radius:99px;flex:none;background:#39414a}
.dot.beg{background:var(--ac)} .dot.int{background:var(--amber)} .dot.adv{background:var(--pink)}
.step .d{color:#6c7783;font-size:11px;margin-left:auto}
.empty{color:var(--bad);font-size:12px}

.note{background:#1c2026;border:1px solid var(--line);border-left:3px solid var(--amber);
  border-radius:8px;padding:11px 13px;margin-bottom:14px;font-size:13px;color:var(--tx2)}
.note b{color:var(--tx)}
.hide{display:none}
</style></head><body>

<header>
  <div class="hrow">
    <div>
      <h1>Exercise classifier</h1>
      <div class="sub"><span id="shown">0</span> of <span id="total">0</span> movements ·
        <span id="dirty">0</span> changed</div>
    </div>
    <div class="counts">
      <div class="cnt beg" id="cBeg"><b>0</b><small>Beginner / 15</small></div>
      <div class="cnt int" id="cInt"><b>0</b><small>Intermediate / 15</small></div>
      <div class="cnt adv" id="cAdv"><b>0</b><small>Advanced / 20</small></div>
    </div>
    <div class="spacer"></div>
    <button id="vClassify" class="chip on">Classify</button>
    <button id="vLadders" class="chip">Ladders</button>
    <button class="go" id="save">Save file for Claude</button>
    <button id="load">Load a saved file</button>
    <button class="warn" id="reset">Start over</button>
  </div>

  <div class="filters" id="filters">
    <input type="search" id="q" placeholder="Search name, id or cue…">
    <select id="fFam"><option value="">Every family</option></select>
    <select id="fPat"><option value="">Every pattern</option></select>
    <select id="fLvl"><option value="">Every level</option>
      <option value="beg">beg</option><option value="int">int</option>
      <option value="adv">adv</option><option value="__none">no level set</option></select>
    <span class="chip" data-f="fund">In the fundamentals</span>
    <span class="chip" data-f="nodiff">Missing difficulty</span>
    <span class="chip" data-f="noimg">No picture</span>
    <span class="chip" data-f="deadlink">Link to nowhere</span>
    <span class="chip" data-f="bw">Bodyweight only</span>
    <span class="chip" data-f="touched">I have changed</span>
  </div>
</header>

<div class="wrap">
  <div id="seedNote" class="note hide"></div>

  <div id="viewClassify">
    <table><thead><tr>
      <th style="width:60px"></th><th>Movement</th><th style="width:150px">Family</th>
      <th style="width:96px">Level</th><th style="width:70px">Diff</th>
      <th style="width:132px">Fundamental</th>
      <th style="width:160px">Easier than this</th><th style="width:160px">Harder than this</th>
    </tr></thead><tbody id="tb"></tbody></table>
  </div>

  <div id="viewLadders" class="hide"><div class="lad" id="ladders"></div></div>
</div>

<datalist id="allIds"></datalist>
<input type="file" id="file" accept="application/json" style="display:none">

<script id="payload" type="application/json">${DATA}</script>
<script>
'use strict';
const PAY = JSON.parse(document.getElementById('payload').textContent);
const ROWS = PAY.rows, FAMS = PAY.families;
const FAMNAME = Object.fromEntries(FAMS);
const KEY = 'fj.classifier.v1';

/* His decisions, kept apart from the generated data so re-running the build
   script never destroys them. Only what he actually changed is stored. */
let EDITS = {};
try { EDITS = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { EDITS = {}; }

/* First run seeds from the proposed fifty. After that his file is the truth,
   even where he emptied something — otherwise a deletion would come back. */
if (!localStorage.getItem(KEY)) {
  for (const r of ROWS) if (r.seed) EDITS[r.id] = { tier: r.seed };
  save();
}
function save(){ localStorage.setItem(KEY, JSON.stringify(EDITS)); }
function edit(id){ return EDITS[id] || (EDITS[id] = {}); }
function val(r, k){
  const e = EDITS[r.id];
  if (e && e[k] !== undefined) return e[k];
  if (k === 'fam')  return r.guess;
  if (k === 'tier') return '';
  return r[k] === null ? '' : r[k];
}
/* "Changed" means different from what the database says, not merely present.
   A confirmed guess is a decision and has to count as one. */
function touched(r){
  const e = EDITS[r.id]; if (!e) return false;
  return Object.keys(e).some(k => {
    if (k === 'tier') return !!e[k];
    if (k === 'fam')  return e[k] !== r.guess;
    return String(e[k] ?? '') !== String(r[k] ?? '');
  });
}

/* ---- filters ---- */
const F = { q:'', fam:'', pat:'', lvl:'', flags:new Set() };
function match(r){
  if (F.fam && val(r,'fam') !== F.fam) return false;
  if (F.pat && r.pattern !== F.pat) return false;
  if (F.lvl === '__none') { if (val(r,'level')) return false; }
  else if (F.lvl && val(r,'level') !== F.lvl) return false;
  if (F.flags.has('fund')    && !val(r,'tier')) return false;
  if (F.flags.has('nodiff')  && val(r,'diff') !== '') return false;
  if (F.flags.has('noimg')   && r.img) return false;
  if (F.flags.has('bw')      && !(r.equipment.length === 1 && r.equipment[0] === 'bw')) return false;
  if (F.flags.has('deadlink') && !(r.badEasier || r.badHarder)) return false;
  if (F.flags.has('touched') && !touched(r)) return false;
  if (F.q) {
    const s = (r.name + ' ' + r.id + ' ' + r.cues).toLowerCase();
    if (!s.includes(F.q)) return false;
  }
  return true;
}

/* ---- counters ---- */
function counts(){
  const c = { beg:0, int:0, adv:0 };
  for (const r of ROWS) { const t = val(r,'tier'); if (t) c[t]++; }
  const targets = { beg:15, int:15, adv:20 };
  for (const k of ['beg','int','adv']) {
    const el = document.getElementById('c' + k[0].toUpperCase() + k.slice(1));
    el.querySelector('b').textContent = c[k];
    el.classList.toggle('over', c[k] > targets[k]);
  }
  document.getElementById('dirty').textContent = ROWS.filter(touched).length;
}

/* ---- the table ---- */
const tb = document.getElementById('tb');
function render(){
  const list = ROWS.filter(match);
  document.getElementById('shown').textContent = list.length;
  tb.innerHTML = list.map(r => {
    const tier = val(r,'tier'), fam = val(r,'fam');
    const guessed = !(EDITS[r.id] && EDITS[r.id].fam !== undefined);
    return \`<tr data-id="\${r.id}" class="\${touched(r)?'touched':''}">
      <td>\${r.img
        ? \`<img class="thumb" loading="lazy" src="../images/exercises/\${r.id}.png" alt="">\`
        : '<div class="noimg"></div>'}</td>
      <td><div class="nm">\${esc(r.name)}\${r.gymOnly?' <span class="gymtag">GYM</span>':''}</div>
          <div class="id">\${r.id}</div>
          <div class="eq">\${r.pattern} · \${r.equipment.join(', ')||'—'} · \${r.measure||'—'}</div></td>
      <td><select class="fam \${guessed?'guessed':''}">\${
        ['<option value="">—</option>'].concat(FAMS.map(f =>
          \`<option value="\${f[0]}" \${fam===f[0]?'selected':''}>\${f[1]}</option>\`)).join('')
      }</select></td>
      <td><select class="lvl"><option value="">—</option>\${
        ['beg','int','adv'].map(l => \`<option \${val(r,'level')===l?'selected':''}>\${l}</option>\`).join('')
      }</select></td>
      <td><input type="number" class="diff" min="1" max="10" value="\${val(r,'diff')}"></td>
      <td><span class="tier">\${
        [['',' — '],['beg','B'],['int','I'],['adv','A']].map(t =>
          \`<button data-t="\${t[0]}" class="\${tier===t[0]?'on':''}">\${t[1]}</button>\`).join('')
      }</span></td>
      <td><input class="link easier \${r.badEasier?'dead':''}" list="allIds" value="\${val(r,'easier')}"></td>
      <td><input class="link harder \${r.badHarder?'dead':''}" list="allIds" value="\${val(r,'harder')}"></td>
    </tr>\`;
  }).join('');
  counts();
}
function esc(s){ return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

/* One listener for the whole table rather than eight per row — three hundred
   rows re-render on every filter keystroke and re-binding each time is what
   makes a page like this feel sticky. */
tb.addEventListener('change', e => {
  const tr = e.target.closest('tr'); if (!tr) return;
  const id = tr.dataset.id, t = e.target;
  if (t.classList.contains('fam'))    { edit(id).fam = t.value; t.classList.remove('guessed'); }
  if (t.classList.contains('lvl'))    edit(id).level = t.value;
  if (t.classList.contains('diff'))   edit(id).diff = t.value === '' ? '' : +t.value;
  if (t.classList.contains('easier')) edit(id).easier = t.value.trim();
  if (t.classList.contains('harder')) edit(id).harder = t.value.trim();
  save();
  tr.classList.toggle('touched', touched(ROWS.find(r => r.id === id)));
  counts();
});
tb.addEventListener('click', e => {
  const b = e.target.closest('.tier button'); if (!b) return;
  const tr = b.closest('tr'), id = tr.dataset.id;
  edit(id).tier = b.dataset.t; save();
  b.parentNode.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  tr.classList.toggle('touched', touched(ROWS.find(r => r.id === id)));
  counts();
});

/* ---- ladders: what he has actually built, family by family ---- */
function ladders(){
  const box = document.getElementById('ladders');
  box.innerHTML = FAMS.map(([key, label]) => {
    const inFam = ROWS.filter(r => val(r,'fam') === key)
      .sort((a,b) => (val(a,'diff')||99) - (val(b,'diff')||99));
    const fund = inFam.filter(r => val(r,'tier'));
    const body = fund.length
      ? fund.map(r => \`<div class="step"><span class="dot \${val(r,'tier')}"></span>
          <span>\${esc(r.name)}</span><span class="d">\${val(r,'diff')||'?'}</span></div>\`).join('')
      : '<div class="empty">Nothing marked as fundamental yet.</div>';
    return \`<div class="lcard"><h3>\${label}</h3>
      <div class="n">\${fund.length} fundamental of \${inFam.length} in this family</div>
      \${body}</div>\`;
  }).join('');
}

/* ---- save / load ---- */
document.getElementById('save').onclick = () => {
  const out = {};
  for (const r of ROWS) {
    if (!touched(r)) continue;
    const e = EDITS[r.id], o = {};
    if (e.tier)   o.fundamental = e.tier;
    if (e.fam !== undefined && e.fam !== r.guess) o.family = e.fam;
    if (e.level !== undefined && e.level !== r.level) o.level = e.level;
    if (e.diff  !== undefined && String(e.diff) !== String(r.diff ?? '')) o.diff = e.diff;
    if (e.easier !== undefined && e.easier !== r.easier) o.easier = e.easier;
    if (e.harder !== undefined && e.harder !== r.harder) o.harder = e.harder;
    if (Object.keys(o).length) out[r.id] = o;
  }
  const blob = new Blob([JSON.stringify({
    savedAt: new Date().toISOString(),
    counts: ['beg','int','adv'].reduce((a,k) =>
      (a[k] = ROWS.filter(r => val(r,'tier') === k).length, a), {}),
    changes: out,
  }, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'classification.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
};
document.getElementById('load').onclick = () => document.getElementById('file').click();
document.getElementById('file').onchange = ev => {
  const f = ev.target.files[0]; if (!f) return;
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const j = JSON.parse(fr.result), ch = j.changes || j;
      EDITS = {};
      for (const [id, o] of Object.entries(ch)) {
        const e = EDITS[id] = {};
        if (o.fundamental) e.tier = o.fundamental;
        if (o.family !== undefined) e.fam = o.family;
        if (o.level  !== undefined) e.level = o.level;
        if (o.diff   !== undefined) e.diff = o.diff;
        if (o.easier !== undefined) e.easier = o.easier;
        if (o.harder !== undefined) e.harder = o.harder;
      }
      save(); render(); ladders();
      alert('Loaded ' + Object.keys(ch).length + ' movements.');
    } catch (err) { alert('That file could not be read: ' + err.message); }
  };
  fr.readAsText(f);
};
document.getElementById('reset').onclick = () => {
  if (!confirm('Throw away every change and go back to the proposed fifty?')) return;
  localStorage.removeItem(KEY);
  EDITS = {};
  for (const r of ROWS) if (r.seed) EDITS[r.id] = { tier: r.seed };
  save(); render(); ladders();
};

/* ---- wiring ---- */
const vC = document.getElementById('viewClassify'), vL = document.getElementById('viewLadders');
document.getElementById('vClassify').onclick = () => {
  vC.classList.remove('hide'); vL.classList.add('hide');
  document.getElementById('vClassify').classList.add('on');
  document.getElementById('vLadders').classList.remove('on');
  document.getElementById('filters').classList.remove('hide');
};
document.getElementById('vLadders').onclick = () => {
  ladders();
  vL.classList.remove('hide'); vC.classList.add('hide');
  document.getElementById('vLadders').classList.add('on');
  document.getElementById('vClassify').classList.remove('on');
  document.getElementById('filters').classList.add('hide');
};
document.getElementById('q').oninput = e => { F.q = e.target.value.trim().toLowerCase(); render(); };
document.getElementById('fFam').onchange = e => { F.fam = e.target.value; render(); };
document.getElementById('fPat').onchange = e => { F.pat = e.target.value; render(); };
document.getElementById('fLvl').onchange = e => { F.lvl = e.target.value; render(); };
document.querySelectorAll('.chip[data-f]').forEach(c => c.onclick = () => {
  const k = c.dataset.f;
  F.flags.has(k) ? F.flags.delete(k) : F.flags.add(k);
  c.classList.toggle('on'); render();
});

/* option lists */
document.getElementById('fFam').innerHTML += FAMS
  .map(f => \`<option value="\${f[0]}">\${f[1]}</option>\`).join('');
document.getElementById('fPat').innerHTML += [...new Set(ROWS.map(r => r.pattern))]
  .filter(Boolean).sort().map(p => \`<option>\${p}</option>\`).join('');
document.getElementById('allIds').innerHTML = ROWS
  .map(r => \`<option value="\${r.id}">\${esc(r.name)}</option>\`).join('');
document.getElementById('total').textContent = ROWS.length;

if (PAY.seedMissing.length) {
  const n = document.getElementById('seedNote');
  n.classList.remove('hide');
  n.innerHTML = '<b>' + PAY.seedMissing.length + ' of the fifty I proposed have no movement ' +
    'in the database yet,</b> so they are not pre-marked below. They are real gaps rather ' +
    'than mistakes — pick the closest movement instead, or tell me to add them:<br>' +
    PAY.seedMissing.map(esc).join(' · ');
}

render();
</script></body></html>`;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, html);

const withImg = rows.filter(r => r.img).length;
const noLevel = rows.filter(r => !r.level).length;
console.log(`EXERCISE CLASSIFIER.html written — ${(html.length / 1024).toFixed(0)} KB`);
console.log(`  ${rows.length} movements, ${withImg} with a picture, ${noLevel} with no level set`);
console.log(`  seeded ${Object.keys(seedTier).length} of 50 proposed fundamentals`);
if (seedMissing.length) {
  console.log(`  no movement in the database for ${seedMissing.length}:`);
  for (const m of seedMissing) console.log(`    ${m}`);
}
