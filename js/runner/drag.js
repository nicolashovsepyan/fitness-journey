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
  const rows = () => [...list.querySelectorAll(rowSel)].filter(r => !r.classList.contains('swipe-under'));

  const begin = (row, y0, isTouch, x0 = 0) => {
    let timer = 0, active = false, from = -1, to = -1, heights = [], tops = [], startY = y0, startX = x0;
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
      const y = isTouch ? e.touches[0].clientY : e.clientY, x = isTouch ? e.touches[0].clientX : e.clientX;
      if (!active) { if (Math.abs(y - startY) > SLOP || Math.abs(x - startX) > SLOP) cleanup(); return; }   // a scroll (or a swipe), not a hold
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
    begin(row, e.touches[0].clientY, true, e.touches[0].clientX);
  }, { passive: true });
  list.addEventListener('mousedown', e => {
    if (e.button) return;
    const row = rows().find(r => r.contains(e.target)); if (!row || e.target.closest(NOT_A_HANDLE) || rows().length < 2) return;
    begin(row, e.clientY, false, e.clientX);
  });
}

/* ============================================================
   SWIPE A MOVE (Nico, 2 Nov 2026): left takes it out, right swaps it for
   another. The row follows the finger over what it will do (red Delete on
   the right, Swap on the left); past a third of its width it happens, else
   it springs back. Mostly sideways only: a vertical move is the page
   scrolling, and a hold is the drag above.
   ============================================================ */
export function makeSwipeable(list, rowSel, { onLeft, onRight, leftLabel = 'Delete', rightLabel = 'Swap' }) {
  if (!list || list.dataset.swipeable) return;
  list.dataset.swipeable = '1';
  if (!document.getElementById('fj-swipe-css')) { const st = document.createElement('style'); st.id = 'fj-swipe-css'; st.textContent = SWIPE_CSS; document.head.appendChild(st); }
  const rows = () => [...list.querySelectorAll(rowSel)].filter(r => !r.classList.contains('swipe-under'));
  list.addEventListener('touchstart', e => {
    const row = rows().find(r => r.contains(e.target)); if (!row || e.target.closest('input')) return;
    const i = rows().indexOf(row);   // now, before the layer under it joins the list
    const x0 = e.touches[0].clientX, y0 = e.touches[0].clientY; let dx = 0, mode = null, under = null;
    const move = ev => {
      const x = ev.touches[0].clientX, y = ev.touches[0].clientY;
      if (!mode) { if (Math.abs(y - y0) > 10) return done(); if (Math.abs(x - x0) > 12) mode = 'swipe'; else return; }
      ev.preventDefault();
      dx = x - x0;
      if (!under) {
        under = document.createElement('div'); under.className = 'swipe-under';
        under.innerHTML = `<span class="sw-r">⇄ ${rightLabel}</span><span class="sw-l">${leftLabel} 🗑</span>`;
        row.classList.add('swiping'); if (getComputedStyle(row.parentElement).position === 'static') row.parentElement.style.position = 'relative';
        row.parentElement.insertBefore(under, row);
        Object.assign(under.style, { top: row.offsetTop + 'px', height: row.offsetHeight + 'px', left: row.offsetLeft + 'px', width: row.offsetWidth + 'px' });
      }
      under.classList.toggle('left', dx < 0); under.classList.toggle('arm', Math.abs(dx) > row.offsetWidth / 3);
      row.style.transform = `translateX(${dx}px)`;
    };
    const done = () => {
      list.removeEventListener('touchmove', move); window.removeEventListener('touchend', done); window.removeEventListener('touchcancel', done);
      if (mode !== 'swipe') return;
      suppressClick = Date.now() + 350;
      const go = Math.abs(dx) > row.offsetWidth / 3;
      row.style.transition = 'transform .18s ease'; row.style.transform = '';
      setTimeout(() => { row.style.transition = ''; row.classList.remove('swiping'); under?.remove(); }, 190);
      if (go) { try { navigator.vibrate?.(20); } catch (e) {} (dx < 0 ? onLeft : onRight)?.(i); }
    };
    list.addEventListener('touchmove', move, { passive: false }); window.addEventListener('touchend', done); window.addEventListener('touchcancel', done);
  }, { passive: true });
}
const SWIPE_CSS = `
  .swiping { position: relative; z-index: 2; background: var(--box, #1d2027); border-radius: 12px; }
  .swipe-under { position: absolute; z-index: 1; display:flex; align-items:center; justify-content:space-between; padding: 0 16px; border-radius: 12px;
    background: var(--wm-accent-soft, rgba(80,200,160,.18)); color: var(--wm-accent, #3ECBA8); font-weight: 800; font-size: 15px; pointer-events: none; }
  .swipe-under.left { background: rgba(255,70,90,.18); color: #FF5A6E; }
  .swipe-under .sw-l { opacity: 0; } .swipe-under.left .sw-l { opacity: 1; } .swipe-under.left .sw-r { opacity: 0; }
  .swipe-under.arm { filter: brightness(1.4); }
  .swipe-under.arm.left { background: rgba(255,70,90,.32); }
`;

/* the order after moving `from` to `to`, as old indexes: [old index at 0, at 1, …] */
export const orderAfter = (n, from, to) => { const o = [...Array(n).keys()]; o.splice(to, 0, o.splice(from, 1)[0]); return o; };

export const SORT_CSS = `
  .sorting { user-select: none; -webkit-user-select: none; }
  .sorting > * { transition: transform .16s ease; }
  .sorting > .lifted { transition: none; position: relative; z-index: 5; border-radius: 12px;
    background: var(--box-2, #262b33); box-shadow: 0 10px 26px rgba(0,0,0,.45), 0 0 0 1px var(--wm-neon-line, rgba(255,255,255,.2)); }
`;
