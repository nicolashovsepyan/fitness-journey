/* ============================================================
   SCREEN — DAY: sections, per-block time, swap (full library),
   swipe-to-remove, and drag-to-reorder (items within a block,
   blocks within a section). Edits persist per day via the store.
   ============================================================ */
import { resolveSession, describeItem, alternatives, blockMinutes, libraryFor } from '../core/resolve.js';
import { FORMATS } from '../data/formats.js';
import { EXERCISES } from '../data/exercises.js';
import { store } from '../store.js';
import { openLibraryPicker, pickerInitialFor } from './library.js';

const DURATIONS = [20, 30, 45, 60];
const DUR_LABEL = { 20: 'Quick', 30: 'Short', 45: 'Full', 60: 'Long' };
const SECTION = { 'Joint Prep': 'Joint Prep', Primer: 'Primer', Work: 'Work', Finisher: 'Finisher', Benchmark: 'Benchmark', Mobility: 'Mobility' };
const SEC_COLOR = { 'Joint Prep': '#b39dff', Primer: '#7cb3ff', Work: '#c8ff4d', Finisher: '#ffb84d', Benchmark: '#ff8f6b', Mobility: '#4dd98b' };

function blockTag(b) {
  if (b.format === 'circuit') return `${b.rounds || ''} rounds`;
  if (b.format === 'tabata') return `${b.work}s/${b.rest}s · ${b.rounds}r`;
  if (b.format === 'amrap') return b.minutes ? `${b.minutes} min` : '';
  return '';
}

export function renderDay(host, sessionId, { onBack, onStart, duration = 30, sessionIndex = 0 }) {
  let dur = duration;

  const plan = () => resolveSession(sessionId, {
    duration: dur, sessionIndex,
    swaps: store.getSwaps(sessionId), removed: store.getRemoved(sessionId),
    order: store.getOrder(sessionId), added: store.getAdded(sessionId),
    fillerSwaps: store.getFillerSwaps(sessionId),
    removedBlocks: store.getRemovedBlocks(sessionId), addedBlocks: store.getAddedBlocks(sessionId),
  });
  const LVLC = { beg: '#63b34d', int: '#ffb84d', adv: '#ff6b6b' };
  const diffBadge = exId => { const e = EXERCISES[exId] || {}; return e.diff ? `<span class="rowdiff" style="background:${LVLC[e.level] || '#7a7a86'}">${e.diff}</span>` : ''; };
  const playBtn = exId => { const e = EXERCISES[exId] || {}; const url = e.demoUrl ? e.demoUrl.replace('/embed/', '/watch?v=') : 'https://www.youtube.com/results?search_query=' + encodeURIComponent((e.name || '') + ' calisthenics'); return `<a class="rowplay" href="${url}" target="_blank" rel="noopener" title="Watch">▶</a>`; };

  function draw() {
    const rp = plan();
    const tags = [rp.category && rp.category.replace('_', ' '), rp.coreDominant ? 'core-dominant' : null, rp.variant].filter(Boolean);
    const total = rp.blocks.reduce((t, b) => t + blockMinutes(b), 0);
    const edited = Object.keys(store.getSwaps(sessionId)).length || store.getRemoved(sessionId).length
      || Object.keys(store.getOrder(sessionId)).length || Object.keys(store.getFillerSwaps(sessionId)).length
      || store.getRemovedBlocks(sessionId).length || store.getAddedBlocks(sessionId).length;

    let html = '', lastRole = null, group = [];
    const flush = () => {
      if (!group.length) return;
      const mins = group.reduce((t, b) => t + blockMinutes(b), 0);
      const c = SEC_COLOR[lastRole] || 'var(--accent)';
      html += `<div class="sec-head" style="--sc:${c}"><span class="sec-name">${SECTION[lastRole] || lastRole}</span><span class="sec-line"></span><span class="sec-time">~${mins} min</span></div>`;
      html += `<div class="sec-blocks" data-section="${lastRole}">${group.map(blockCard).join('')}</div>`;
      group = [];
    };
    rp.blocks.forEach(b => { if (b.role !== lastRole) { flush(); lastRole = b.role; } group.push(b); });
    flush();

    host.innerHTML = `
      <div class="screen fade-in">
        <div class="run-head"><div class="blk">${rp.name}</div><button class="x" id="back">✕</button></div>
        <h1 style="margin:6px 0 6px;">${rp.name}</h1>
        <div class="tags">
          ${tags.map(t => `<span class="tag">${t}</span>`).join('')}
          ${rp.constraint ? `<span class="tag warn">⚠ ${rp.constraint}</span>` : ''}
        </div>
        <div class="section-title">Time available · ≈ ${total} min total</div>
        <div class="dur-grid" id="durs">
          ${DURATIONS.map(d => `<div class="dur ${dur === d ? 'on' : ''}" data-d="${d}"><div class="m">${d}</div><div class="x">${DUR_LABEL[d]}</div></div>`).join('')}
        </div>
        ${rp.scalingNote ? `<div class="scaling-note">@${dur}min · ${rp.scalingNote}</div>` : ''}
        <div class="edit-hint">⇄ swap · ⋮⋮ drag to reorder · swipe ← to remove${edited ? ` · <a id="resetEdits">reset edits</a>` : ''}</div>
        ${html}
        <button class="add-block" id="addBlock">+ Add a block</button>
        <div class="actionbar"><button class="btn lg" id="start">Start workout ▸</button></div>
      </div>`;

    host.querySelector('#back').addEventListener('click', onBack);
    host.querySelectorAll('#durs .dur').forEach(el => el.addEventListener('click', () => { dur = Number(el.dataset.d); draw(); }));
    host.querySelector('#start').addEventListener('click', () => onStart(plan()));
    host.querySelector('#resetEdits')?.addEventListener('click', () => { store.resetDay(sessionId); draw(); });
    host.querySelectorAll('.demo[data-cue]').forEach(el => el.addEventListener('click', () => {
      const cue = el.parentElement.querySelector('.cue'); if (cue) cue.style.display = cue.style.display === 'block' ? 'none' : 'block';
    }));
    host.querySelectorAll('.swap[data-from]').forEach(el => el.addEventListener('click', () => openSwap(el.dataset.from, el.dataset.block, rp)));
    host.querySelectorAll('.swap[data-filler]').forEach(el => el.addEventListener('click', () => openFillerSwap(el.dataset.block, el.dataset.filler, rp)));
    host.querySelectorAll('.add-ex[data-block]').forEach(el => el.addEventListener('click', () => openAdd(el.dataset.block, el.dataset.bid, rp)));
    host.querySelectorAll('.ex-row[data-remove]').forEach(wireSwipe);   // swipe left to remove
    host.querySelectorAll('.filler-x[data-block]').forEach(el => el.addEventListener('click', e => {
      e.stopPropagation(); store.setFillerSwap(sessionId, el.dataset.block, '__none'); draw();   // remove the secondary
    }));
    host.querySelectorAll('.block-x[data-block]').forEach(el => el.addEventListener('click', e => {
      e.stopPropagation();
      if (el.dataset.added) store.removeAddedBlock(sessionId, el.dataset.block);
      else store.setBlockRemoved(sessionId, el.dataset.block, true);
      draw();
    }));
    host.querySelector('#addBlock')?.addEventListener('click', () => openAddBlock(rp));
    // tap a row (not a control) to expand its cue
    host.querySelectorAll('.ex-row .exmeta').forEach(el => el.addEventListener('click', () => {
      const cue = el.querySelector('.cue'); if (cue) cue.style.display = cue.style.display === 'block' ? 'none' : 'block';
    }));

    // drag-to-reorder: items within each block, blocks within each section
    host.querySelectorAll('.ex-list').forEach(list => makeSortable(list, ids => { store.setItemOrder(sessionId, list.dataset.block, ids); }));
    host.querySelectorAll('.sec-blocks').forEach(sec => makeSortable(sec, () => {
      const names = [...host.querySelectorAll('.block-card[data-id]')].map(c => c.dataset.id);
      store.setBlockOrder(sessionId, names);
    }));
  }

  function blockCard(b) {
    const tag = blockTag(b);
    return `
      <div class="block-card" data-sortable-item data-id="${b.name}">
        <div class="bhead">
          <div class="bleft"><button class="drag-handle" data-drag title="Move block">⋮⋮</button>
            <div><div class="bname">${b.name} ${b.anchor ? '<span class="anchor-dot">●</span>' : ''}</div><div class="bmeta">~${blockMinutes(b)} min${tag ? ` · ${tag}` : ''}</div></div></div>
          <div class="bright"><span class="fmt-chip ${b.anchor ? 'anchor' : ''}">${FORMATS[b.format]?.short || b.format}</span>
            <button class="block-x" data-block="${b.name}" data-added="${b.addedBlock ? '1' : ''}" title="Remove block">✕</button></div>
        </div>
        <div class="ex-list" data-block="${b.name}">${b.items.map(it => exRow(it, b)).join('')}</div>
        ${b.filler ? fillerRow(b.filler, b) : ''}
        ${b.format !== 'jointprep' ? `<button class="add-ex" data-block="${b.name}" data-bid="${b.id}">＋ Add exercise to this block</button>` : ''}
        ${b.note ? `<div class="bnote">${b.note}</div>` : ''}
      </div>`;
  }

  /* the rest-filler shown as a SECONDARY exercise supersetted with the anchor (not a separate section) */
  function fillerRow(f, b) {
    const cue = EXERCISES[f.exId]?.cues || '';
    const rx = f.reps ? `${f.reps} reps` : `${f.hold || 20}s`;
    return `
      <div class="ss-pair">
        <span class="ss-link">+ superset</span>
        <div class="ex-row static ss-row">
          <div class="ex-inner">
            ${diffBadge(f.exId)}
            <div class="exmeta">
              <div class="exname">${f.name} <span class="ss-badge">secondary</span>${f.swapped ? '<span class="swapped">swapped</span>' : ''}</div>
              <div class="exrx">${rx} · in the rest — light, just enough</div>
              <div class="cue" style="display:none; color:var(--faint); font-size:12px; margin-top:3px;">${cue}</div>
            </div>
            ${playBtn(f.exId)}
            <button class="swap" data-filler="${f.exId}" data-block="${b.name}" title="Swap secondary">⇄</button>
            <button class="row-x filler-x" data-block="${b.name}" title="Remove secondary">✕</button>
          </div>
        </div>
      </div>`;
  }

  function exRow(it, b) {
    const cue = EXERCISES[it.exId]?.cues || '';
    const from = it.swappedFrom || it.exId;
    return `
      <div class="ex-row" data-sortable-item data-id="${from}" data-remove="${from}" data-bn="${b.name}" data-added="${it.added ? '1' : ''}">
        <div class="ex-swipe-bg">← remove</div>
        <div class="ex-inner">
          <button class="drag-handle sm" data-drag title="Move">⋮⋮</button>
          ${diffBadge(it.exId)}
          <div class="exmeta">
            <div class="exrow1">
              <div class="exname">${it.name} ${it.swappedFrom ? '<span class="swapped">swapped</span>' : ''}${it.added ? '<span class="swapped">added</span>' : ''}</div>
              ${playBtn(it.exId)}
              <button class="swap" data-from="${from}" data-block="${b.id}" title="Swap exercise">⇄</button>
            </div>
            <div class="exrx">${describeItem(b, it)}</div>
            <div class="cue" style="display:none; color:var(--faint); font-size:12px; margin-top:3px;">${cue}</div>
          </div>
        </div>
      </div>`;
  }

  /* pointer-based reorder (works on touch + mouse). Reorders DOM live, commits ids on drop. */
  function makeSortable(container, onCommit) {
    container.querySelectorAll('[data-drag]').forEach(handle => {
      const item = handle.closest('[data-sortable-item]');
      if (!item || item.parentElement !== container) return;     // scope to direct children
      handle.style.touchAction = 'none';
      handle.addEventListener('pointerdown', e => {
        e.preventDefault(); e.stopPropagation();
        item.classList.add('dragging');
        document.body.classList.add('dragging');     // lock scroll + selection while dragging
        const move = ev => {
          ev.preventDefault();
          const sibs = [...container.querySelectorAll(':scope > [data-sortable-item]:not(.dragging)')];
          let before = null;
          for (const s of sibs) { const r = s.getBoundingClientRect(); if (ev.clientY < r.top + r.height / 2) { before = s; break; } }
          if (before) container.insertBefore(item, before); else container.appendChild(item);
        };
        const up = () => {
          item.classList.remove('dragging');
          document.body.classList.remove('dragging');
          document.removeEventListener('pointermove', move);
          document.removeEventListener('pointerup', up);
          onCommit([...container.querySelectorAll(':scope > [data-sortable-item]')].map(el => el.dataset.id));
        };
        document.addEventListener('pointermove', move, { passive: false });
        document.addEventListener('pointerup', up);
      });
    });
  }

  function doRemoveRow(row) {
    const id = row.dataset.remove; if (!id) return;
    if (row.dataset.added) store.removeAdded(sessionId, row.dataset.bn, id);
    else store.setRemoved(sessionId, id, true);
    draw();
  }
  /* swipe LEFT past a threshold to remove (works on touch + mouse via pointer events) */
  function wireSwipe(row) {
    const inner = row.querySelector('.ex-inner'); if (!inner) return;
    let x0 = null, dx = 0;
    inner.addEventListener('pointerdown', e => {
      if (e.target.closest('[data-drag], .swap, .rowplay, a, button')) return;   // let controls work
      x0 = e.clientX; dx = 0; inner.style.transition = '';
    });
    inner.addEventListener('pointermove', e => {
      if (x0 == null) return;
      dx = Math.min(0, e.clientX - x0);
      inner.style.transform = `translateX(${dx}px)`;
      row.classList.toggle('will-remove', dx < -90);
    });
    const finish = () => {
      if (x0 == null) return;
      const commit = dx < -90; x0 = null;
      inner.style.transition = 'transform .18s ease';
      if (commit) { inner.style.transform = 'translateX(-110%)'; setTimeout(() => doRemoveRow(row), 150); }
      else { inner.style.transform = 'translateX(0)'; row.classList.remove('will-remove'); }
    };
    inner.addEventListener('pointerup', finish);
    inner.addEventListener('pointercancel', finish);
    inner.addEventListener('pointerleave', finish);
  }

  function openSwap(fromEx, blockId, rp) {
    const origName = EXERCISES[fromEx]?.name || fromEx;
    openLibraryPicker({ title: 'Swap · ' + origName, initial: pickerInitialFor(fromEx),
      onPick: id => { store.setSwap(sessionId, fromEx, id === fromEx ? null : id); draw(); } });
  }

  function openFillerSwap(blockName, fromEx, rp) {
    const origName = EXERCISES[fromEx]?.name || fromEx;
    openLibraryPicker({ title: 'Swap secondary · ' + origName, initial: pickerInitialFor(fromEx),
      onPick: id => { store.setFillerSwap(sessionId, blockName, id); draw(); } });
  }

  function openAdd(blockName, bid, rp) {
    const block = rp.blocks.find(b => b.id === bid);
    const tmpl = block?.items[0] || {};
    openLibraryPicker({ title: 'Add to ' + blockName, initial: pickerInitialFor(block?.items[0]?.exId), onPick: id => {
      const m = EXERCISES[id]; const measure = m?.measure || tmpl.measure || 'reps';
      const p = {};
      ['sets', 'reps', 'hold', 'rest', 'tempo', 'perSide'].forEach(k => { if (tmpl[k] != null) p[k] = tmpl[k]; });
      if (p.sets == null && ['straight', 'tempo', 'isometric'].includes(block?.format)) p.sets = 3;
      if (measure === 'reps' && p.reps == null) p.reps = 10;
      if (measure === 'hold') { if (p.hold == null) p.hold = 30; delete p.reps; }
      if (p.rest == null && p.sets) p.rest = 60;
      store.addItem(sessionId, blockName, { ex: id, ...p });
      draw();
    } });
  }

  /* full block builder: type · method · exercises · prescription → a runner-ready block */
  function openAddBlock(rp) {
    const st = { role: 'Work', format: 'straight', items: [], sets: 3, reps: 10, hold: 30, rest: 90, roundRest: 30, rounds: 3, minutes: 5, work: 20, restSec: 10 };
    const ROLES = ['Primer', 'Work', 'Finisher'];
    const METHODS = [['straight', 'Straight'], ['superset', 'Superset'], ['circuit', 'Circuit'], ['amrap', 'AMRAP'], ['tabata', 'Tabata'], ['emom', 'EMOM']];
    const FIELDS = { sets: ['Sets', 1], rounds: ['Rounds', 1], minutes: ['Minutes', 1], reps: ['Reps', 1], hold: ['Hold · s', 5], rest: ['Rest · s', 15], roundRest: ['Round rest · s', 15], work: ['Work · s', 5], restSec: ['Rest · s', 5] };
    const METHOD_FIELDS = { straight: ['sets', 'rest'], superset: ['sets', 'rest'], circuit: ['rounds', 'roundRest'], amrap: ['minutes'], tabata: ['rounds', 'work', 'restSec'], emom: ['rounds'] };
    const hasReps = () => !st.items.length || st.items.some(id => EXERCISES[id]?.measure !== 'hold');
    const hasHold = () => st.items.some(id => EXERCISES[id]?.measure === 'hold');
    const label = () => METHODS.find(m => m[0] === st.format)[1];
    const autoName = () => { const first = st.items[0] ? EXERCISES[st.items[0]].name : ''; return first ? `${first}${st.items.length > 1 ? ' +' + (st.items.length - 1) : ''} · ${label()}` : `${st.role} · ${label()}`; };
    function fieldsFor() {
      const f = METHOD_FIELDS[st.format].slice();
      if (st.format !== 'tabata') { const ins = []; if (hasReps()) ins.push('reps'); if (hasHold()) ins.push('hold'); f.splice(1, 0, ...ins); }
      return f;
    }
    function buildBlock() {
      const fmt = st.format === 'superset' ? 'circuit' : st.format;
      const items = st.items.map(id => {
        const m = EXERCISES[id]; const isHold = m.measure === 'hold'; const it = { ex: id };
        if (['straight', 'superset'].includes(st.format)) { it.sets = st.sets; if (isHold) it.hold = st.hold; else it.reps = st.reps; it.rest = st.rest; }
        else { if (isHold) it.hold = st.hold; else it.reps = st.reps; }
        return it;
      });
      let name = autoName(); const existing = new Set(rp.blocks.map(b => b.name)); let n = 2; while (existing.has(name)) name = `${autoName()} ${n++}`;
      const block = { name, role: st.role, format: fmt, items };
      if (st.format === 'superset') { block.rounds = st.sets; block.roundRest = st.rest; block.transition = 8; }
      if (st.format === 'circuit') { block.rounds = st.rounds; block.roundRest = st.roundRest; block.transition = 8; }
      if (st.format === 'amrap') block.minutes = st.minutes;
      if (st.format === 'tabata' || st.format === 'emom') { block.rounds = st.rounds; block.work = st.work; block.rest = st.restSec; }
      return block;
    }
    const ov = document.createElement('div'); ov.className = 'overlay'; host.appendChild(ov);
    const close = () => ov.remove();
    function render() {
      ov.innerHTML = `<div class="overlay-card scroll bb-card">
        <div class="picker-head"><div class="eyebrow">New block</div><button class="x pk-x" id="bbClose">✕</button></div>
        <div class="bb-body">
          <div class="bb-l">Type</div>
          <div class="segrow">${ROLES.map(r => `<button class="seg ${st.role === r ? 'on' : ''}" data-role="${r}">${r}</button>`).join('')}</div>
          <div class="bb-l">Method</div>
          <div class="chipwrap">${METHODS.map(([v, l]) => `<button class="bchip ${st.format === v ? 'on' : ''}" data-fmt="${v}">${l}</button>`).join('')}</div>
          <div class="bb-l">Exercises <span class="muted">· ${st.items.length}</span></div>
          <div class="bb-exlist">${st.items.map((id, i) => `<div class="bb-ex"><span class="bb-exn">${EXERCISES[id]?.name || id}</span><button class="bb-exx" data-rmex="${i}">✕</button></div>`).join('') || '<div class="muted" style="padding:6px 2px;font-size:13px;">Nothing added yet.</div>'}</div>
          <button class="add-ex" id="bbAddEx">＋ Add exercise</button>
          <div class="bb-l">Prescription</div>
          ${fieldsFor().map(k => { const [lbl, step] = FIELDS[k]; return `<div class="brow"><span class="blabel">${lbl}</span><div class="ed-step"><button data-fld="${k}" data-d="-${step}">−</button><input data-fldin="${k}" type="number" inputmode="numeric" value="${st[k]}"><button data-fld="${k}" data-d="${step}">+</button></div></div>`; }).join('')}
          <button class="btn" id="bbCreate" style="margin-top:16px;" ${st.items.length ? '' : 'disabled'}>Create block ▸</button>
        </div></div>`;
      ov.querySelector('#bbClose').addEventListener('click', close);
      ov.querySelectorAll('[data-role]').forEach(b => b.addEventListener('click', () => { st.role = b.dataset.role; render(); }));
      ov.querySelectorAll('[data-fmt]').forEach(b => b.addEventListener('click', () => { st.format = b.dataset.fmt; render(); }));
      ov.querySelectorAll('[data-rmex]').forEach(b => b.addEventListener('click', () => { st.items.splice(+b.dataset.rmex, 1); render(); }));
      ov.querySelector('#bbAddEx').addEventListener('click', () => openLibraryPicker({ title: 'Add exercise', onPick: id => { st.items.push(id); render(); } }));
      ov.querySelectorAll('[data-fld]').forEach(b => b.addEventListener('click', () => { const k = b.dataset.fld; st[k] = Math.max(0, (Number(st[k]) || 0) + Number(b.dataset.d)); ov.querySelector(`[data-fldin="${k}"]`).value = st[k]; }));
      ov.querySelectorAll('[data-fldin]').forEach(inp => inp.addEventListener('change', () => { st[inp.dataset.fldin] = Math.max(0, Number(inp.value) || 0); }));
      ov.querySelector('#bbCreate').addEventListener('click', () => { if (!st.items.length) return; store.addBlock(sessionId, buildBlock()); close(); draw(); });
    }
    render();
  }

  draw();
}
