/* ============================================================
   SCREEN — DAY: sections, per-block time, swap (full library),
   swipe-to-remove, and drag-to-reorder (items within a block,
   blocks within a section). Edits persist per day via the store.
   ============================================================ */
import { resolveSession, describeItem, alternatives, blockMinutes, libraryFor } from '../core/resolve.js';
import { FORMATS } from '../data/formats.js';
import { EXERCISES } from '../data/exercises.js';
import { store } from '../store.js';

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
  });

  function draw() {
    const rp = plan();
    const tags = [rp.category && rp.category.replace('_', ' '), rp.coreDominant ? 'core-dominant' : null, rp.variant].filter(Boolean);
    const total = rp.blocks.reduce((t, b) => t + blockMinutes(b), 0);
    const edited = Object.keys(store.getSwaps(sessionId)).length || store.getRemoved(sessionId).length || Object.keys(store.getOrder(sessionId)).length;

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
        <div class="edit-hint">⇄ swap · ⋮⋮ drag to reorder · swipe left to remove${edited ? ` · <a id="resetEdits">reset edits</a>` : ''}</div>
        ${html}
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
    host.querySelectorAll('.add-ex[data-block]').forEach(el => el.addEventListener('click', () => openAdd(el.dataset.block, el.dataset.bid, rp)));
    host.querySelectorAll('.ex-remove[data-from]').forEach(el => el.addEventListener('click', () => {
      if (el.dataset.added) store.removeAdded(sessionId, el.dataset.bn, el.dataset.from);
      else store.setRemoved(sessionId, el.dataset.from, true);
      draw();
    }));
    host.querySelectorAll('.ex-row').forEach(wireSwipe);

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
          <span class="fmt-chip ${b.anchor ? 'anchor' : ''}">${FORMATS[b.format]?.short || b.format}</span>
        </div>
        <div class="ex-list" data-block="${b.name}">${b.items.map(it => exRow(it, b)).join('')}</div>
        ${b.filler ? fillerRow(b.filler) : ''}
        ${b.format !== 'jointprep' ? `<button class="add-ex" data-block="${b.name}" data-bid="${b.id}">+ Add exercise</button>` : ''}
        ${b.note ? `<div class="bnote">${b.note}</div>` : ''}
      </div>`;
  }

  /* the rest-filler shown as a SECONDARY exercise supersetted with the anchor (not a separate section) */
  function fillerRow(f) {
    const cue = EXERCISES[f.exId]?.cues || '';
    const rx = f.reps ? `${f.reps} reps` : `${f.hold || 20}s`;
    return `
      <div class="ss-pair">
        <span class="ss-link">+ superset</span>
        <div class="ex-row static ss-row">
          <div class="ex-inner">
            <div class="demo" data-cue="1" title="info">ⓘ</div>
            <div class="exmeta">
              <div class="exname">${f.name} <span class="ss-badge">secondary</span></div>
              <div class="exrx">${rx} · in the rest — light, just enough</div>
              <div class="cue" style="display:none; color:var(--faint); font-size:12px; margin-top:3px;">${cue}</div>
            </div>
          </div>
        </div>
      </div>`;
  }

  function exRow(it, b) {
    const cue = EXERCISES[it.exId]?.cues || '';
    const from = it.swappedFrom || it.exId;
    return `
      <div class="ex-row" data-sortable-item data-id="${from}">
        <div class="ex-inner">
          <button class="drag-handle sm" data-drag title="Move">⋮⋮</button>
          <div class="demo" data-cue="1" title="info">ⓘ</div>
          <div class="exmeta">
            <div class="exname">${it.name} ${it.swappedFrom ? '<span class="swapped">swapped</span>' : ''}${it.added ? '<span class="swapped">added</span>' : ''}</div>
            <div class="exrx">${describeItem(b, it)}</div>
            <div class="cue" style="display:none; color:var(--faint); font-size:12px; margin-top:3px;">${cue}</div>
          </div>
          <button class="swap" data-from="${from}" data-block="${b.id}" title="Swap exercise">⇄</button>
        </div>
        <button class="ex-remove" data-from="${from}" data-bn="${b.name}" data-added="${it.added ? '1' : ''}">Remove</button>
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

  /* swipe-left to reveal Remove (touch); ignores touches that begin on a control */
  function wireSwipe(row) {
    const inner = row.querySelector('.ex-inner');
    if (!inner) return;
    let x0 = null, dx = 0;
    inner.addEventListener('touchstart', e => {
      if (e.target.closest('[data-drag],.swap,.demo')) { x0 = null; return; }
      x0 = e.touches[0].clientX;
    }, { passive: true });
    inner.addEventListener('touchmove', e => {
      if (x0 == null) return;
      dx = Math.max(-92, Math.min(0, e.touches[0].clientX - x0));
      inner.style.transform = `translateX(${dx}px)`;
    }, { passive: true });
    inner.addEventListener('touchend', () => {
      if (x0 == null) return;
      const open = dx < -46;
      inner.style.transition = 'transform .18s ease';
      inner.style.transform = open ? 'translateX(-92px)' : 'translateX(0)';
      setTimeout(() => { inner.style.transition = ''; }, 200);
      x0 = null; dx = 0;
    });
  }

  function openSwap(fromEx, blockId, rp) {
    const block = rp.blocks.find(b => b.id === blockId);
    const used = rp.blocks.flatMap(b => b.items.map(i => i.exId)).filter(x => x !== fromEx);
    const alts = alternatives(fromEx, { constraint: rp.constraint }, used);
    const current = block?.items.find(i => (i.swappedFrom || i.exId) === fromEx)?.exId;
    const origName = EXERCISES[fromEx]?.name || fromEx;
    let dividerInserted = false;

    const rows = alts.map(a => {
      let pre = '';
      if (!a.recommended && !dividerInserted) { dividerInserted = true; pre = '<div class="swap-divider">More from your library</div>'; }
      return pre + `<div class="swap-opt ${a.id === current ? 'cur' : ''}" data-id="${a.id}"><span>${a.name}</span>${a.id === current ? '<span class="muted">current</span>' : `<span class="muted">${a.pattern}</span>`}</div>`;
    }).join('');

    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `
      <div class="overlay-card scroll">
        <div class="eyebrow">Swap exercise</div>
        <h2 style="margin:6px 0 12px;">${origName}</h2>
        ${alts.length ? rows : '<div class="muted" style="padding:8px 0;">No alternatives.</div>'}
        ${current !== fromEx ? `<div class="swap-opt revert" data-id="__revert"><span>↩ Revert to ${origName}</span></div>` : ''}
        <button class="btn ghost" id="swapCancel" style="margin-top:12px;">Cancel</button>
      </div>`;
    host.appendChild(ov);
    ov.querySelector('#swapCancel').addEventListener('click', () => ov.remove());
    ov.querySelectorAll('.swap-opt[data-id]').forEach(el => el.addEventListener('click', () => {
      const id = el.dataset.id;
      store.setSwap(sessionId, fromEx, id === '__revert' ? null : id);
      ov.remove(); draw();
    }));
  }

  function openAdd(blockName, bid, rp) {
    const block = rp.blocks.find(b => b.id === bid);
    const measure = block?.items[0]?.measure || 'reps';
    const used = rp.blocks.flatMap(b => b.items.map(i => i.exId));
    const list = libraryFor(measure, { constraint: rp.constraint }, used);
    const tmpl = block?.items[0] || {};
    const prescription = () => {
      const p = {};
      ['sets', 'reps', 'hold', 'rest', 'tempo', 'perSide'].forEach(k => { if (tmpl[k] != null) p[k] = tmpl[k]; });
      if (p.sets == null && ['straight', 'tempo', 'isometric'].includes(block?.format)) p.sets = 3;
      if (measure === 'reps' && p.reps == null) p.reps = 10;
      if (measure === 'hold' && p.hold == null) p.hold = 30;
      if (p.rest == null && p.sets) p.rest = 60;
      return p;
    };
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `
      <div class="overlay-card scroll">
        <div class="eyebrow">Add to ${blockName}</div>
        <h2 style="margin:6px 0 12px;">Add exercise</h2>
        ${list.length ? list.map(a => `<div class="swap-opt" data-id="${a.id}"><span>${a.name}</span><span class="muted">${a.pattern}</span></div>`).join('') : '<div class="muted" style="padding:8px 0;">Nothing to add.</div>'}
        <button class="btn ghost" id="addCancel" style="margin-top:12px;">Cancel</button>
      </div>`;
    host.appendChild(ov);
    ov.querySelector('#addCancel').addEventListener('click', () => ov.remove());
    ov.querySelectorAll('.swap-opt[data-id]').forEach(el => el.addEventListener('click', () => {
      store.addItem(sessionId, blockName, { ex: el.dataset.id, ...prescription() });
      ov.remove(); draw();
    }));
  }

  draw();
}
