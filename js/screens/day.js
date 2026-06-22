/* ============================================================
   SCREEN — DAY (full session, formats visible, duration picker)
   Pure view over a resolved RunPlan. "Start" hands the RunPlan up.
   ============================================================ */
import { resolveSession, describeItem } from '../core/resolve.js';
import { FORMATS } from '../data/formats.js';
import { EXERCISES } from '../data/exercises.js';

const DURATIONS = [20, 30, 45, 60];
const DUR_LABEL = { 20: 'Quick', 30: 'Short', 45: 'Full', 60: 'Long' };

/* block-level meta line (rounds / interval / minutes) */
function blockMeta(b) {
  if (b.format === 'circuit') return `${b.rounds || ''} rounds`;
  if (b.format === 'tabata') return `${b.work}s / ${b.rest}s · ${b.rounds} rounds`;
  if (b.format === 'amrap') return b.minutes ? `${b.minutes} min · max` : '';
  if (b.format === 'emom') return b.minutes ? `${b.minutes} min` : '';
  return '';
}

export function renderDay(host, sessionId, { onBack, onStart, duration = 30, sessionIndex = 0 }) {
  let dur = duration;

  function draw() {
    const rp = resolveSession(sessionId, { duration: dur, sessionIndex });
    const tags = [
      rp.category && rp.category.replace('_', ' '),
      rp.coreDominant ? 'core-dominant' : null,
      rp.variant,
    ].filter(Boolean);

    host.innerHTML = `
      <div class="screen fade-in">
        <div class="run-head"><div class="blk">${rp.name}</div><button class="x" id="back">✕</button></div>
        <h1 style="margin:6px 0 6px;">${rp.name}</h1>
        <div class="tags">
          ${tags.map(t => `<span class="tag">${t}</span>`).join('')}
          ${rp.constraint ? `<span class="tag warn">⚠ ${rp.constraint}</span>` : ''}
        </div>

        <div class="section-title">Time available</div>
        <div class="dur-grid" id="durs">
          ${DURATIONS.map(d => `<div class="dur ${dur === d ? 'on' : ''}" data-d="${d}"><div class="m">${d}</div><div class="x">${DUR_LABEL[d]}</div></div>`).join('')}
        </div>
        ${rp.scalingNote ? `<div class="scaling-note">@${dur}min · ${rp.scalingNote}</div>` : ''}

        ${rp.blocks.map(b => blockCard(b)).join('')}

        <div class="actionbar"><button class="btn lg" id="start">Start workout ▸</button></div>
      </div>`;

    host.querySelector('#back').addEventListener('click', onBack);
    host.querySelectorAll('#durs .dur').forEach(el => el.addEventListener('click', () => { dur = Number(el.dataset.d); draw(); }));
    host.querySelector('#start').addEventListener('click', () => onStart(resolveSession(sessionId, { duration: dur, sessionIndex })));
    host.querySelectorAll('.demo[data-cue]').forEach(el => el.addEventListener('click', () => {
      const cue = el.nextElementSibling?.querySelector('.cue');
      if (cue) cue.style.display = cue.style.display === 'block' ? 'none' : 'block';
    }));
  }

  function blockCard(b) {
    const meta = blockMeta(b);
    return `
      <div class="block-card">
        <div class="bhead">
          <div><div class="brole">${b.role}${b.anchor ? ' · anchor' : ''}</div><div class="bname">${b.name}</div></div>
          <span class="fmt-chip ${b.anchor ? 'anchor' : ''}">${FORMATS[b.format]?.short || b.format}${meta ? ` · ${meta}` : ''}</span>
        </div>
        ${b.items.map(it => exRow(it, b)).join('')}
        ${b.filler ? `<div class="filler-note">⚡ Rest superset (${b.filler.type}): <b>${b.filler.name}</b> · ${b.filler.reps ? b.filler.reps + ' reps' : b.filler.hold + 's'}</div>` : ''}
        ${b.note ? `<div class="bnote">${b.note}</div>` : ''}
      </div>`;
  }

  function exRow(it, b) {
    const cue = EXERCISES[it.exId]?.cues || '';
    return `
      <div class="ex-row">
        <div class="demo" data-cue="1" title="info">ⓘ</div>
        <div class="exmeta">
          <div class="exname">${it.name} ${it.anchor ? '<span class="anchor-dot">●</span>' : ''}</div>
          <div class="exrx">${describeItem(b, it)}</div>
          <div class="cue" style="display:none; color:var(--faint); font-size:12px; margin-top:3px;">${cue}</div>
        </div>
      </div>`;
  }

  draw();
}
