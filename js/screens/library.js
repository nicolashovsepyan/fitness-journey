/* ============================================================
   SCREEN — LIBRARY (in-app database browser)
   The entire curated DB, browsable: section image banners,
   sticky track headers, and a Group/Track/Work/Level filter bar.
   Reads the LIVE exercises DB so it is the single source of truth
   that Swap mirrors. Self-contained (scoped `lib-` styles).
   ============================================================ */
import { EXERCISES } from '../data/exercises.js';

const LVLC = { beg: '#63b34d', int: '#ffb84d', adv: '#ff6b6b' };
const PATGRP = { quad:'Legs', hinge:'Legs', glute:'Legs', hamstring:'Legs', calf:'Legs', shin:'Legs',
  push:'Push', pull:'Pull', core:'Core', skill:'Skill', conditioning:'Conditioning', full:'Full body', mobility:'Mobility' };
const PATORDER = ['Push','Pull','Legs','Core','Skill','Conditioning','Full body','Mobility'];
const CURATED = { Push:1, Pull:1, Legs:1, Core:1 };
const BANNER = { Push:'images/day-strength.png', Pull:'images/ex-frontlever.png', Legs:'images/day-leg.png',
  Core:'images/day-core.png', Skill:'images/ex-handstand.png', Conditioning:'images/day-cond.png',
  'Full body':'images/day-hyp.png', Mobility:'' };
const CANON = { lsit:'l-sit', vsit:'v-sit', hang:'hanging' };
const canon = t => CANON[t] || t;
const TLABEL = { quads:'Quads', pistol:'Pistol / Single-Leg', hamstrings:'Hamstrings', glutes:'Glutes',
  'knee-ankle':'Knee & Ankle (ATG)', adductor:'Adductors / Mobility',
  'push-up':'Push-Up', dip:'Dip', pike:'Pike Push-Up', handstand:'Handstand', planche:'Planche',
  'planche-accessory':'Planche Accessory', 'ring-support':'Ring Support', 'grip-iso':'Grip / Isometric',
  'vertical-push':'Vertical Push', 'pull-up':'Pull-Up', 'vertical-pull':'Vertical Pull',
  'horizontal-pull':'Horizontal Pull', 'muscle-up':'Muscle-Up', 'front-lever':'Front Lever',
  'front-lever-raise':'Front Lever Raise', grip:'Grip', 'skin-cat':'Skin-the-Cat', scap:'Scapular',
  plank:'Plank', 'side-plank':'Side Plank', hollow:'Hollow Body', hanging:'Hanging', vup:'V-Up',
  dragonflag:'Dragon Flag', 'l-sit':'L-Sit', bear:'Bear', 'v-sit':'V-Sit', 'anti-extension':'Anti-Extension' };
const ORDER = ('push-up dip pike handstand planche-accessory planche ring-support grip-iso vertical-push pull-up '
  + 'horizontal-pull vertical-pull scap grip front-lever-raise front-lever skin-cat muscle-up '
  + 'quads pistol hamstrings glutes knee-ankle adductor '
  + 'plank side-plank anti-extension hollow bear hanging l-sit vup v-sit dragonflag').split(' ');
const torder = t => { const i = ORDER.indexOf(canon(t)); return i < 0 ? 99 : i; };
const tlabel = t => { t = canon(t); if (TLABEL[t]) return TLABEL[t]; if (t === '—') return 'Other';
  return t.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); };
const methodsOf = e => (e.methods && e.methods.length ? e.methods : ['reps']);
const vidUrl = e => e.demoUrl ? e.demoUrl.replace('/embed/', '/watch?v=')
  : 'https://www.youtube.com/results?search_query=' + encodeURIComponent(e.name + ' calisthenics');

const STYLE = `
.lib{--lm:#9a9aa6}
.lib .lbar{position:sticky;top:0;z-index:30;background:rgba(10,10,12,.97);backdrop-filter:blur(12px);border-bottom:1px solid var(--line);padding:10px 0 11px;margin:0 0 4px}
.lib #lq{width:100%;background:var(--box-2);border:1px solid var(--line);color:var(--text);border-radius:10px;padding:9px 12px;font-size:14px;margin-bottom:8px}
.lib .lselrow{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.lib select{appearance:none;-webkit-appearance:none;background:var(--box-2) url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'><path d='M2 4l4 4 4-4' stroke='%239a9aa6' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>") no-repeat right 10px center;border:1px solid var(--line);color:var(--text);border-radius:10px;padding:9px 28px 9px 11px;font-size:13px;font-weight:600;width:100%}
.lib select:focus{outline:none;border-color:var(--accent)}
.lib .lclr{background:none;border:none;color:var(--faint);font-size:12px;font-weight:600;padding:5px 0 0;cursor:pointer;text-decoration:underline;display:none}
.lib .lclr.show{display:block}
.lib .banner{position:relative;height:120px;border-radius:16px;overflow:hidden;margin:16px 0 4px;background:#20202a center/cover no-repeat;border:1px solid var(--line)}
.lib .banner::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(8,8,11,.88) 0%,rgba(8,8,11,.5) 55%,rgba(8,8,11,.12) 100%)}
.lib .banner.nolvl{background:linear-gradient(120deg,#1c2413,#0e0e12)}
.lib .banner .bt{position:absolute;left:16px;bottom:13px;z-index:2}
.lib .banner .bt h2{margin:0;font-size:25px;font-weight:800;letter-spacing:-.02em;color:#fff;text-shadow:0 2px 12px rgba(0,0,0,.6)}
.lib .banner .bt .bc{font-size:11px;font-weight:700;color:var(--accent);letter-spacing:.04em;text-transform:uppercase;margin-top:2px}
.lib .banner .bt .bc.prov{color:var(--warn)}
.lib .thd{position:sticky;top:118px;z-index:20;background:rgba(10,10,12,.94);backdrop-filter:blur(8px);font-size:12px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--accent);margin:12px calc(-1*var(--pad)) 6px;padding:7px var(--pad) 6px;border-bottom:1px solid var(--line)}
.lib .thd .tn{color:var(--faint);font-weight:600}
.lib .ex{background:var(--box);border:1px solid var(--line);border-radius:12px;padding:10px 13px;margin-bottom:6px}
.lib .ex.main{border-color:rgba(200,255,77,.4)}
.lib .exrow{display:flex;align-items:center;gap:9px}
.lib .db{flex:0 0 auto;width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-family:var(--tnum);font-weight:800;font-size:13px;color:#15150f}
.lib .exn{flex:1;min-width:0;font-size:15px;font-weight:600}
.lib .exn .star{color:var(--accent);font-size:12px;margin-left:5px}
.lib .vid{flex:0 0 auto;color:var(--warn);font-size:12px;font-weight:700;text-decoration:none;border:1px solid rgba(255,184,77,.3);border-radius:8px;padding:5px 9px;white-space:nowrap}
.lib .tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}
.lib .tag{font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px;text-transform:uppercase;letter-spacing:.03em;background:var(--box-2);color:var(--lm);border:1px solid var(--line)}
.lib .tag.gs{color:var(--good);border-color:rgba(77,217,139,.3)}
.lib .tag.lvl{color:#15150f}
.lib .tag.meth{color:var(--warn);border-color:rgba(255,184,77,.25)}
.lib .chain{color:var(--faint);font-size:11px;margin-top:6px}.lib .chain b{color:var(--lm)}
.lib .cues{color:var(--lm);font-size:12px;margin-top:6px;line-height:1.45}
.lib .empty{color:var(--lm);text-align:center;padding:40px}`;

function buildList() {
  return Object.entries(EXERCISES).map(([id, e]) => {
    const fams = (e.families || (e.family ? [e.family] : ['—'])).map(canon);
    return Object.assign({ id, grp: PATGRP[e.pattern] || e.pattern, fams: Array.from(new Set(fams)) }, e);
  });
}

export function renderLibrary(host, { onPick } = {}) {
  if (!document.getElementById('lib-style')) {
    const s = document.createElement('style'); s.id = 'lib-style'; s.textContent = STYLE; document.head.appendChild(s);
  }
  const list = buildList();
  const groupsPresent = PATORDER.filter(p => list.some(x => x.grp === p));
  const opt = (v, l, sel) => `<option value="${v}"${sel ? ' selected' : ''}>${l}</option>`;

  let trackHtml = opt('', 'All tracks');
  groupsPresent.forEach(g => {
    let ts = Array.from(new Set(list.filter(x => x.grp === g).reduce((a, x) => a.concat(x.fams), [])));
    ts = ts.filter(t => t !== '—').sort((a, b) => (torder(a) - torder(b)) || (a < b ? -1 : 1));
    if (ts.length) trackHtml += `<optgroup label="${g}">${ts.map(t => opt(t, tlabel(t))).join('')}</optgroup>`;
  });

  host.innerHTML = `
    <div class="lib">
      <div class="lbar">
        <input id="lq" placeholder="Search exercises, tracks, cues…" autocomplete="off">
        <div class="lselrow">
          <select id="lGroup">${opt('', 'All sections')}${groupsPresent.map(g => opt(g, g)).join('')}</select>
          <select id="lTrack">${trackHtml}</select>
          <select id="lWork">${opt('', 'Any work type')}${['reps','hold','weighted','banded','tempo'].map(w => opt(w, w[0].toUpperCase()+w.slice(1))).join('')}</select>
          <select id="lLevel">${opt('', 'Any level')}${[['beg','Beginner'],['int','Intermediate'],['adv','Advanced']].map(p => opt(p[0], p[1])).join('')}</select>
        </div>
        <button class="lclr" id="lClr">Clear filters</button>
      </div>
      <div id="lOut"></div>
    </div>`;

  const F = { grp:'', track:'', work:'', lvl:'', q:'' };
  const $ = id => host.querySelector(id);
  const out = $('#lOut');

  function exCard(x) {
    const lc = LVLC[x.level] || '#888';
    const gs = x.grip === 'supinated' || x.grip === 'neutral';
    const pickBtn = onPick ? `<a class="vid" data-pick="${x.id}" style="color:var(--accent);border-color:rgba(200,255,77,.4)">＋ pick</a>` : '';
    return `<div class="ex ${x.main ? 'main' : ''}">
      <div class="exrow"><div class="db" style="background:${lc}">${x.diff || '?'}</div>
        <div class="exn">${x.name}${x.main ? '<span class="star">✦</span>' : ''}</div>
        ${pickBtn}<a class="vid" href="${vidUrl(x)}" target="_blank" rel="noopener">▶ ${x.demoUrl ? 'video' : 'find'}</a></div>
      <div class="tags">
        ${x.level ? `<span class="tag lvl" style="background:${lc}">${x.level}</span>` : ''}
        ${x.grip ? `<span class="tag ${gs ? 'gs' : ''}">${x.grip}${gs ? ' ✓' : ''}</span>` : ''}
        <span class="tag">${(x.equipment || ['bw']).join(' · ')}</span>
        ${methodsOf(x).map(m => `<span class="tag meth">${m}</span>`).join('')}
      </div>
      ${(x.easier || x.harder) ? `<div class="chain">${x.easier ? `<b>${(EXERCISES[x.easier]||{}).name || x.easier}</b> ← ` : ''}${x.name}${x.harder ? ` → <b>${(EXERCISES[x.harder]||{}).name || x.harder}</b>` : ''}</div>` : ''}
      ${x.cues ? `<div class="cues">${x.cues}</div>` : ''}
    </div>`;
  }

  function render() {
    const on = F.grp || F.track || F.work || F.lvl || F.q;
    $('#lClr').classList.toggle('show', !!on);
    const f = list.filter(x => {
      if (F.grp && x.grp !== F.grp) return false;
      if (F.track && x.fams.indexOf(F.track) < 0) return false;
      if (F.lvl && x.level !== F.lvl) return false;
      if (F.work && methodsOf(x).indexOf(F.work) < 0) return false;
      if (F.q && (x.name + ' ' + x.fams.join(' ') + ' ' + (x.cues || '')).toLowerCase().indexOf(F.q) < 0) return false;
      return true;
    });
    const grps = PATORDER.filter(p => f.some(x => x.grp === p));
    out.innerHTML = grps.length ? grps.map(g => {
      const items = f.filter(x => x.grp === g);
      const img = BANNER[g];
      const banner = `<div class="banner${img ? '' : ' nolvl'}"${img ? ` style="background-image:url('${img}')"` : ''}>
        <div class="bt"><h2>${g}</h2><div class="bc${CURATED[g] ? '' : ' prov'}">${CURATED[g] ? 'Curated ✦ · ' : ''}${items.length} exercises</div></div></div>`;
      const tracks = Array.from(new Set(items.reduce((a, x) => a.concat(x.fams), [])))
        .sort((a, b) => (torder(a) - torder(b)) || (a < b ? -1 : 1));
      const body = tracks.map(tr => {
        const ti = items.filter(x => x.fams.indexOf(tr) >= 0).sort((a, b) => (a.diff || 5) - (b.diff || 5));
        if (!ti.length) return '';
        return `<div class="thd">${tlabel(tr)} <span class="tn">· ${ti.length}</span></div>${ti.map(exCard).join('')}`;
      }).join('');
      return `<div>${banner}${body}</div>`;
    }).join('') : '<div class="empty">No exercises match these filters.</div>';

    if (onPick) out.querySelectorAll('[data-pick]').forEach(el =>
      el.addEventListener('click', () => onPick(el.dataset.pick)));
  }

  $('#lq').addEventListener('input', e => { F.q = e.target.value.toLowerCase(); render(); });
  $('#lGroup').addEventListener('change', e => { F.grp = e.target.value; F.track = ''; $('#lTrack').value = ''; render(); });
  $('#lTrack').addEventListener('change', e => { F.track = e.target.value; render(); });
  $('#lWork').addEventListener('change', e => { F.work = e.target.value; render(); });
  $('#lLevel').addEventListener('change', e => { F.lvl = e.target.value; render(); });
  $('#lClr').addEventListener('click', () => {
    Object.assign(F, { grp:'', track:'', work:'', lvl:'', q:'' });
    ['#lGroup','#lTrack','#lWork','#lLevel'].forEach(i => $(i).value = '');
    $('#lq').value = ''; render();
  });

  render();
}
