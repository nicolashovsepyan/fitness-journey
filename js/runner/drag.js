/* ============================================================
   HOLD AND DRAG — reorder the moves, in setup and mid-workout.
   Press and hold a move (its name, not its − + or ✕) for a beat: it lifts,
   the phone buzzes, and it follows the finger; the others slide out of the
   way. Let go and `onMove(from, to)` gets the new order. A finger that
   moves before the beat is a scroll, and nothing happens.

   Touch events, not pointer events, on phones: a touchmove that is
   cancelled once the drag has started is the one thing both iOS and
   Android honour to stop the page scrolling under the finger.
   ============================================================ */
const HOLD_MS = 380, SLOP = 9;
const NOT_A_HANDLE = 'button:not([data-pick-move]):not([data-pick]), input, .ci-vid, [data-wu], .qt-mx';
let suppressClick = 0;
document.addEventListener('click', e => { if (Date.now() < suppressClick) { e.stopPropagation(); e.preventDefault(); } }, true);

export function makeSortable(list, rowSel, onMove) {
  if (!list || list.dataset.sortable) return;
  list.dataset.sortable = '1';
  if (!document.getElementById('fj-sort-css')) { const st = document.createElement('style'); st.id = 'fj-sort-css'; st.textContent = SORT_CSS; document.head.appendChild(st); }
  const rows = () => [...list.querySelectorAll(rowSel)];

  const begin = (row, y0, isTouch) => {
    let timer = 0, active = false, from = -1, to = -1, heights = [], tops = [], startY = y0;
    const cleanup = () => {
      clearTimeout(timer);
      if (isTouch) { list.removeEventListener('touchmove', move); window.removeEventListener('touchend', end); window.removeEventListener('touchcancel', end); }
      else { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', end); }
    };
    const lift = () => {
      const rs = rows(); from = to = rs.indexOf(row); if (from < 0) return cleanup();
      active = true;
      heights = rs.map(r => r.getBoundingClientRect().height);
      tops = rs.map(r => r.getBoundingClientRect().top);
      list.classList.add('sorting'); row.classList.add('lifted');
      try { navigator.vibrate?.(15); } catch (e) {}
    };
    const move = e => {
      const y = isTouch ? e.touches[0].clientY : e.clientY;
      if (!active) { if (Math.abs(y - startY) > SLOP) cleanup(); return; }   // a scroll, not a hold
      e.preventDefault();
      const dy = y - startY, rs = rows();
      row.style.transform = `translateY(${dy}px)`;
      /* where the lifted row's centre now sits among the others */
      const mid = tops[from] + heights[from] / 2 + dy;
      to = from;
      rs.forEach((r, i) => { if (i === from) return; const c = tops[i] + heights[i] / 2; if (i < from && mid < c) to = Math.min(to, i); if (i > from && mid > c) to = Math.max(to, i); });
      rs.forEach((r, i) => {
        if (i === from) return;
        const shift = from < to && i > from && i <= to ? -heights[from] : from > to && i < from && i >= to ? heights[from] : 0;
        r.style.transform = shift ? `translateY(${shift}px)` : '';
      });
    };
    const end = () => {
      cleanup();
      if (!active) return;
      suppressClick = Date.now() + 350;                       // the lift was not a tap on the name
      rows().forEach(r => { r.style.transform = ''; r.classList.remove('lifted'); });
      list.classList.remove('sorting');
      if (to !== from) { try { navigator.vibrate?.(10); } catch (e) {} onMove(from, to); }
    };
    if (isTouch) { list.addEventListener('touchmove', move, { passive: false }); window.addEventListener('touchend', end); window.addEventListener('touchcancel', end); }
    else { window.addEventListener('mousemove', move); window.addEventListener('mouseup', end); }
    timer = setTimeout(lift, HOLD_MS);
  };

  list.addEventListener('touchstart', e => {
    const row = rows().find(r => r.contains(e.target)); if (!row || e.target.closest(NOT_A_HANDLE) || rows().length < 2) return;
    begin(row, e.touches[0].clientY, true);
  }, { passive: true });
  list.addEventListener('mousedown', e => {
    if (e.button) return;
    const row = rows().find(r => r.contains(e.target)); if (!row || e.target.closest(NOT_A_HANDLE) || rows().length < 2) return;
    begin(row, e.clientY, false);
  });
}

/* the order after moving `from` to `to`, as old indexes: [old index at 0, at 1, …] */
export const orderAfter = (n, from, to) => { const o = [...Array(n).keys()]; o.splice(to, 0, o.splice(from, 1)[0]); return o; };

export const SORT_CSS = `
  .sorting { user-select: none; -webkit-user-select: none; }
  .sorting > * { transition: transform .16s ease; }
  .sorting > .lifted { transition: none; position: relative; z-index: 5; border-radius: 12px;
    background: var(--box-2, #262b33); box-shadow: 0 10px 26px rgba(0,0,0,.45), 0 0 0 1px var(--wm-neon-line, rgba(255,255,255,.2)); }
`;
