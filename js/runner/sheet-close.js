/* ============================================================
   EVERY BOTTOM SHEET CLOSES THREE WAYS: a tap on the screen behind it,
   a swipe down on the sheet, or the ✕ at its top right. A small grab bar
   on top says it can be swiped.
   attachSheet(overlay, '.card-selector', close): works even when the
   sheet redraws its card (Timer settings does), since it decorates each
   new card and listens on the overlay.
   The swipe only starts when whatever is under the finger is scrolled to
   its top (a list still scrolls up normally) and never inside a list that
   reorders by hold and drag.
   ============================================================ */
const CSS = `
.sh-grab { width: 40px; height: 4px; border-radius: 2px; background: var(--line, #2a2a36); margin: -4px auto 10px; }
.sh-x { position: sticky; top: 0; float: right; z-index: 3; width: 34px; height: 34px; margin: -8px -6px 0 8px; border-radius: 50%;
  border: 1px solid var(--line, #2a2a36); background: var(--bg-2, #15151d); color: var(--muted, #9a9aab); font-size: 15px; line-height: 1; cursor: pointer; }
.sh-x:active { color: var(--text, #fff); border-color: var(--wm-accent, #a855f7); }
`;
function decorate(card, close) {
  if (!card || card.dataset.shDone) return;
  card.dataset.shDone = '1';
  const x = document.createElement('button'); x.className = 'sh-x'; x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.textContent = '✕';
  x.addEventListener('click', e => { e.stopPropagation(); close(); });
  const bar = document.createElement('div'); bar.className = 'sh-grab';
  card.prepend(bar); card.prepend(x);
}
/* is anything between the finger and the card scrolled down? */
function scrolled(el, card) {
  for (let n = el; n && n !== card.parentNode; n = n.parentNode) if (n.scrollTop > 0) return true;
  return false;
}
export function attachSheet(ov, cardSel, close) {
  if (!document.getElementById('sh-css')) { const st = document.createElement('style'); st.id = 'sh-css'; st.textContent = CSS; document.head.appendChild(st); }
  const card = () => ov.querySelector(cardSel);
  decorate(card(), close);
  new MutationObserver(() => decorate(card(), close)).observe(ov, { childList: true });
  let y0 = null, dy = 0, t0 = 0, drag = false, c = null;
  ov.addEventListener('touchstart', e => {
    c = card(); if (!c || !c.contains(e.target) || e.touches.length > 1) return;
    if (e.target.closest('input, textarea, select, [data-sortable], .qt-picks') || scrolled(e.target, c)) return;
    y0 = e.touches[0].clientY; dy = 0; t0 = Date.now(); drag = false;
  }, { passive: true });
  ov.addEventListener('touchmove', e => {
    if (y0 == null) return;
    dy = e.touches[0].clientY - y0;
    if (!drag) { if (dy < -6) { y0 = null; return; } if (dy > 8) { drag = true; c.style.transition = 'none'; } }
    if (drag) { e.preventDefault(); c.style.transform = `translateY(${Math.max(0, dy)}px)`; }
  }, { passive: false });
  const end = () => {
    if (y0 == null) return;
    const fast = dy / Math.max(1, Date.now() - t0) > 0.6;
    c.style.transition = '';
    if (drag && (dy > 110 || (fast && dy > 40))) { c.style.transform = ''; close(); }
    else c.style.transform = '';
    y0 = null; drag = false;
  };
  ov.addEventListener('touchend', end);
  ov.addEventListener('touchcancel', end);
}
