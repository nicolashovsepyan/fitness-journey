/* ============================================================
   SCREEN — BEGINNER DAY.
   The workout, laid out the way he will actually read it:
     · supersets drawn as a visually joined pair, not a flat list
     · Day 3 grouped by zone with the equipment named
     · a checkbox per set, so it works as a paper checklist too
     · a VIDEO button on every single row — warm-ups, holds, finishers
     · the plain-language cue always visible under the name
     · notes + knee flag on every exercise
     · the three progression rules pinned at the top
   ============================================================ */
import { blockMinutes } from '../core/resolve.js';
import { EXERCISES } from '../data/exercises.js';
import { BEGINNER_RULES, BEGINNER_RULES_FINE } from '../data/sessions-beginner.js';
import { store } from '../store.js';
import { beginnerPlan, beginnerRunPlan, PROGRAM, DAY_IMG } from '../beginner.js';

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const shortDate = iso => {
  try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
  catch (e) { return ''; }
};

/* Checkbox key. Two rows can share an exercise id (Side Plank left AND right),
   so the tick state has to be keyed per ROW, not per exercise. Notes and knee
   flags deliberately stay keyed on the exercise itself — a bad knee on the side
   plank is about the movement, not about which side you started on. */
const rowKey = it => it.side ? `${it.exId}_${it.side}` : it.exId;

/* how many boxes to draw for one item in one block */
function setCount(b, it) {
  if (b.format === 'superset') return b.rounds || 3;
  if (b.format === 'circuit') return b.rounds || 1;
  if (b.format === 'tabata') return b.rounds || 8;
  return it.sets || 1;
}
function targetText(b, it) {
  const t = it.repsText || it.reps;
  if (it.measure === 'hold') return `${it.hold}s`;
  if (t == null) return b.format === 'tabata' ? `${b.work}s on / ${b.rest}s off` : '';
  return `${t} ${it.unit || 'reps'}`;
}
function prescription(b, it) {
  const n = setCount(b, it);
  const tgt = targetText(b, it);
  if (b.format === 'tabata') return `${n} rounds · ${b.work}s on / ${b.rest}s off`;
  if (b.format === 'superset' || b.format === 'circuit') return `${n} × ${tgt}`;
  return n > 1 ? `${n} × ${tgt}` : tgt;
}

export function renderBDay(host, sessionId, { onBack, onStart }) {
  const openRows = new Set();       // which exercise explanations are expanded
  const rowUid = (b, it) => `${b.id || b.name}|${rowKey(it)}`;

  function draw() {
    const plan = beginnerPlan(sessionId);
    const active = plan.blocks.filter(b => !b.skipped);
    const total = active.reduce((t, b) => t + blockMinutes(b), 0);
    const anySkippable = plan.blocks.some(b => b.skippable);

    host.innerHTML = `
      <div class="screen fade-in bgn">
        <div class="run-head"><div class="blk">${esc(plan.name)}</div><button class="x" id="back">✕</button></div>

        <div class="day-hero" style="--img:url('${DAY_IMG[sessionId] || ''}')">
          <div class="dh-inner">
            <h1>${esc(plan.name)}</h1>
            <div class="dh-meta">About ${total} min · ${active.length} block${active.length > 1 ? 's' : ''} on · week ${plan.week}</div>
          </div>
        </div>

        <div class="rules-card">
          <div class="rc-head">Every session</div>
          <ol class="rc-list">${BEGINNER_RULES.map(r => `<li>${esc(r)}</li>`).join('')}</ol>
          <details class="rc-more"><summary>How each exercise gets harder</summary>
            <ul>${BEGINNER_RULES_FINE.map(r => `<li>${esc(r)}</li>`).join('')}</ul></details>
        </div>

        ${anySkippable ? `<div class="callout soft"><span class="ico">🌱</span><span class="txt">
          <b>Do the warm-up, the two main pairs, and the finisher.</b> The extra pairs are here whenever you feel good — tap <b>Do it</b> to add one, or leave it on <b>Skip</b>.</span></div>` : ''}

        ${plan.blocks.map(blockCard).join('')}

        <div class="spacer" style="height:90px;"></div>
        <div class="actionbar"><button class="btn lg" id="start">Start workout ▸</button></div>
      </div>`;

    host.querySelector('#back').addEventListener('click', onBack);
    host.querySelector('#start').addEventListener('click', () => onStart(beginnerRunPlan(sessionId)));

    // Do-it / Skip per block
    host.querySelectorAll('[data-skip]').forEach(el => el.addEventListener('click', e => {
      e.stopPropagation();
      store.setBlockSkip(sessionId, el.dataset.skip, el.dataset.to === 'skip');
      try { navigator.vibrate?.(20); } catch (err) {}
      draw();
    }));

    // expand / collapse an exercise's explanation drop-down
    host.querySelectorAll('[data-expand]').forEach(el => el.addEventListener('click', e => {
      if (e.target.closest('.vid')) return;          // play button has its own job
      const uid = el.dataset.expand;
      openRows.has(uid) ? openRows.delete(uid) : openRows.add(uid);
      draw();
    }));
    // per-set checkboxes
    host.querySelectorAll('[data-check]').forEach(el => el.addEventListener('click', e => {
      e.stopPropagation();
      store.toggleCheck(sessionId, el.dataset.check, Number(el.dataset.i));
      try { navigator.vibrate?.(15); } catch (err) {}
      draw();
    }));
    // video
    host.querySelectorAll('[data-video]').forEach(el => el.addEventListener('click', e => {
      e.stopPropagation(); openVideo(el.dataset.video, el.dataset.cue);
    }));
    // note
    host.querySelectorAll('[data-note]').forEach(el => el.addEventListener('click', e => {
      e.stopPropagation(); openNote(el.dataset.note, el.dataset.name);
    }));
    // knee flag
    host.querySelectorAll('[data-knee]').forEach(el => el.addEventListener('click', e => {
      e.stopPropagation();
      store.toggleFlag(sessionId, el.dataset.knee, el.dataset.name);
      try { navigator.vibrate?.(60); } catch (err) {}
      draw();
    }));
    // prescribed swaps
    host.querySelectorAll('[data-swap]').forEach(el => el.addEventListener('click', e => {
      e.stopPropagation(); openSwap(el.dataset.swap, (el.dataset.subs || '').split(',').filter(Boolean));
    }));
  }

  /* ---- one block ---- */
  function blockCard(b) {
    const isSuper = b.format === 'superset';
    const tag = isSuper ? `${b.rounds || 3} rounds · rest ${b.rest ?? 75}s`
      : b.format === 'circuit' ? `${b.rounds || 1} rounds${b.roundRest ? ` · rest ${b.roundRest}s` : ' · no rest'}`
      : b.format === 'tabata' ? `${b.rounds}× ${b.work}s on / ${b.rest}s off` : '';

    // Do-it / Skip toggle (skippable blocks only). Warm-up is always on.
    const toggle = b.skippable ? `
      <div class="blk-toggle" role="group">
        <button class="bt ${!b.skipped ? 'on' : ''}" data-skip="${esc(b.name)}" data-to="do">Do it</button>
        <button class="bt ${b.skipped ? 'on skip' : ''}" data-skip="${esc(b.name)}" data-to="skip">Skip</button>
      </div>` : (b.role === 'Primer' ? `<span class="always-chip">always</span>` : '');

    // a skipped block collapses to just its header + toggle
    if (b.skipped) {
      return `
        <div class="block-card bgn skipped ${b.role === 'Finisher' ? 'finisher' : ''}">
          <div class="bhead">
            <div><div class="bname">${esc(b.name)}</div>
              <div class="bmeta">skipped today${b.extra ? ' · extra pair' : ''}</div></div>
            ${toggle}
          </div>
        </div>`;
    }

    let body;
    if (isSuper) {
      body = `<div class="ss-block">${b.items.map(it => exRow(b, it, true)).join('<div class="ss-join">no rest ↓</div>')}</div>`;
    } else if (b.zoned) {
      // group consecutive items by their zone label, naming the equipment
      const groups = [];
      b.items.forEach(it => {
        const last = groups[groups.length - 1];
        if (last && last.zone === it.zone) last.items.push(it);
        else groups.push({ zone: it.zone, items: [it] });
      });
      body = groups.map(g => `
        <div class="zone">
          <div class="zone-head">${esc(g.zone || 'Zone')}</div>
          ${g.items.map(it => exRow(b, it)).join('')}
        </div>`).join('');
    } else {
      body = b.items.map(it => exRow(b, it)).join('');
    }

    return `
      <div class="block-card bgn ${isSuper ? 'super' : ''} ${b.role === 'Primer' ? 'primer' : ''} ${b.role === 'Finisher' ? 'finisher' : ''}">
        <div class="bhead">
          <div><div class="bname">${esc(b.name)}</div>
            <div class="bmeta">~${blockMinutes(b)} min${tag ? ` · ${tag}` : ''}</div></div>
          ${toggle || `<span class="fmt-chip ${isSuper ? 'anchor' : ''}">${b.role}</span>`}
        </div>
        ${body}
        ${b.note ? `<div class="bnote">${esc(b.note)}</div>` : ''}
      </div>`;
  }

  /* ---- one exercise row ----
     Compact by default: play · [pair] name · reps · expand chevron.
     The explanation, notes, set boxes and actions live in a drop-down so
     the block reads as a clean scannable list. Same row is used for the
     warm-up, the superset pairs and the finisher. */
  function exRow(b, it, paired = false) {
    const ex = EXERCISES[it.exId] || {};
    const cue = it.cue || ex.cues || '';
    const hasVid = !!(it.demoUrl || ex.demoUrl);
    const n = setCount(b, it);
    const checks = store.getChecks(sessionId, rowKey(it));
    const flagged = store.isFlagged(sessionId, it.exId);
    const hasNote = !!store.getNote(sessionId, it.exId);
    const savedNote = store.getNote(sessionId, it.exId);
    const subs = (it.subs || []).filter(id => EXERCISES[id]);
    const nm = esc(it.name);
    const uid = rowUid(b, it);
    const open = openRows.has(uid);

    const boxes = Array.from({ length: n }, (_, i) =>
      `<button class="setbox ${checks[i] ? 'on' : ''}" data-check="${rowKey(it)}" data-i="${i}">${checks[i] ? '✓' : i + 1}</button>`).join('');

    /* What he did last time — the thing to beat. Shown right on the collapsed
       row so a new week opens with last week's numbers already visible. */
    const hist = store.exerciseHistory(it.exId, 4);
    const last = hist[0];
    const lastChip = last ? `<span class="last-chip" title="last time">↩ ${esc(last.text)}</span>` : '';
    const histRows = hist.length ? `
      <div class="ex-hist">
        <div class="eh-head">Your history</div>
        ${hist.map((h, i) => `<div class="eh-row ${i === 0 ? 'recent' : ''}">
            <span class="eh-d">${esc(shortDate(h.date))}</span>
            <span class="eh-v">${esc(h.setsText)}</span></div>`).join('')}
      </div>` : `<div class="ex-hist none">First time — today sets your baseline 💪</div>`;

    return `
      <div class="bex ${flagged ? 'flagged' : ''} ${open ? 'open' : ''}">
        <div class="bex-top" data-expand="${uid}">
          <button class="vid ${hasVid ? 'has' : ''}" data-video="${it.exId}" data-cue="${esc(cue)}" title="Watch it">▶</button>
          ${paired && it.pair ? `<span class="pairtag">${esc(it.pair)}</span>` : ''}
          <div class="bex-main">
            <div class="bex-name">${nm}${it.swappedFrom ? '<span class="swapped">swapped</span>' : ''}${flagged ? '<span class="knee-dot" title="knee flagged">🦵</span>' : ''}${hasNote ? '<span class="note-dot" title="note saved">📝</span>' : ''}</div>
            <div class="bex-rx">${prescription(b, it)}${it.side ? ` · ${it.side}` : ''}${lastChip}</div>
          </div>
          <button class="bex-chev" aria-label="Details">⌄</button>
        </div>
        <div class="bex-drop">
          ${cue ? `<div class="bex-cue">${esc(cue)}</div>` : ''}
          ${it.note ? `<div class="bex-note">${esc(it.note)}</div>` : ''}
          ${savedNote ? `<div class="bex-yournote">📝 ${esc(savedNote)}</div>` : ''}
          ${histRows}
          <div class="setboxes"><span class="sb-lbl">Sets</span>${boxes}</div>
          <div class="bex-actions">
            ${subs.length ? `<button class="mini" data-swap="${it.exId}" data-subs="${subs.join(',')}">⇄ swap</button>` : ''}
            <button class="mini ${hasNote ? 'has' : ''}" data-note="${it.exId}" data-name="${nm}">📝 note</button>
            <button class="mini knee ${flagged ? 'on' : ''}" data-knee="${it.exId}" data-name="${nm}">🦵 ${flagged ? 'flagged' : 'knee'}</button>
          </div>
        </div>
      </div>`;
  }

  /* ---- overlays ---- */
  function openVideo(exId, cue) {
    const ex = EXERCISES[exId] || {};
    const url = ex.demoUrl;
    const q = encodeURIComponent(`${ex.name} form tutorial`);
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `
      <div class="overlay-card">
        <div class="eyebrow">How to do it</div>
        <h2 style="margin:6px 0 12px;">${esc(ex.name || exId)}</h2>
        ${url
          ? `<div class="video-wrap"><iframe src="${url}" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe></div>`
          : `<div class="video-stub"><div class="pl">▶</div><div>Video coming soon</div>
               <a class="ytlink" href="https://www.youtube.com/results?search_query=${q}" target="_blank" rel="noopener">Search YouTube meanwhile</a></div>`}
        <p class="cue-big">${esc(cue || ex.cues || '')}</p>
        <button class="btn" id="close" style="margin-top:14px;">Got it</button>
      </div>`;
    host.appendChild(ov);
    ov.querySelector('#close').addEventListener('click', () => ov.remove());
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  }

  function openNote(exId, name) {
    const cur = store.getNote(sessionId, exId);
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `
      <div class="overlay-card">
        <div class="eyebrow">Note</div>
        <h2 style="margin:6px 0 4px;">${esc(name)}</h2>
        <p class="muted" style="margin:0 0 12px;">How did it feel? Too easy, too hard, couldn't find it in the gym?</p>
        <textarea id="t" class="note-input" rows="4" placeholder="Type anything…">${esc(cur)}</textarea>
        <button class="btn" id="save" style="margin-top:12px;">Save</button>
        <button class="btn ghost" id="cancel" style="margin-top:8px;">Cancel</button>
      </div>`;
    host.appendChild(ov);
    ov.querySelector('#t').focus();
    ov.querySelector('#save').addEventListener('click', () => {
      store.setNote(sessionId, exId, name, ov.querySelector('#t').value);
      ov.remove(); draw();
    });
    ov.querySelector('#cancel').addEventListener('click', () => ov.remove());
  }

  function openSwap(exId, subs) {
    const ov = document.createElement('div'); ov.className = 'overlay';
    const cur = store.getSwaps(sessionId)[exId];
    ov.innerHTML = `
      <div class="overlay-card scroll">
        <div class="eyebrow">Swap it for</div>
        <h2 style="margin:6px 0 12px;">${esc(EXERCISES[exId]?.name || exId)}</h2>
        ${subs.map(id => `<div class="swap-opt sub ${cur === id ? 'cur' : ''}" data-id="${id}">
            <span>${esc(EXERCISES[id].name)}</span><span class="muted">${cur === id ? 'in use' : 'easier / knee-safe'}</span></div>`).join('')}
        ${cur ? `<div class="swap-opt revert" data-id="__revert"><span>↩ Back to ${esc(EXERCISES[exId]?.name)}</span></div>` : ''}
        <button class="btn ghost" id="cancel" style="margin-top:12px;">Cancel</button>
      </div>`;
    host.appendChild(ov);
    ov.querySelector('#cancel').addEventListener('click', () => ov.remove());
    ov.querySelectorAll('.swap-opt[data-id]').forEach(el => el.addEventListener('click', () => {
      store.setSwap(sessionId, exId, el.dataset.id === '__revert' ? null : el.dataset.id);
      ov.remove(); draw();
    }));
  }

  draw();
}
