/* ============================================================
   HOLD TO REPEAT — every − and + in the timer.
   A tap is one step, as before. Held, it starts repeating after a beat and
   speeds up the longer it is held. The screens redraw after each step, so
   the button is found again by its data attributes every time rather than
   kept as an element. The click that ends a hold is swallowed, so letting
   go never adds one more.
   ============================================================ */
const STEPPERS = 'button[data-d], button[data-ldend-d], button[data-rd], #decBig, #incBig';
let installed = false, swallowUntil = 0;

const selectorFor = b => b.id ? `#${CSS.escape(b.id)}`
  : 'button' + [...b.attributes].filter(a => a.name.startsWith('data-')).map(a => `[${a.name}="${CSS.escape(a.value)}"]`).join('');

export function installHold() {
  if (installed) return; installed = true;
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest(STEPPERS); if (!b || e.button > 0) return;
    const sel = selectorFor(b);
    let n = 0, timer = 0, held = false;
    const step = () => {
      const el = document.querySelector(sel);
      if (!el) return stop();
      held = true; el.click(); n++;
      timer = setTimeout(step, n < 4 ? 170 : n < 12 ? 95 : 55);   // faster the longer it is held
    };
    const stop = () => {
      clearTimeout(timer);
      ['pointerup', 'pointercancel'].forEach(t => window.removeEventListener(t, stop, true));
      if (held) swallowUntil = Date.now() + 400;
    };
    ['pointerup', 'pointercancel'].forEach(t => window.addEventListener(t, stop, true));
    timer = setTimeout(step, 420);
  }, { passive: true });
  /* the real click at the end of a hold: already counted */
  document.addEventListener('click', e => {
    if (e.isTrusted && Date.now() < swallowUntil && e.target.closest(STEPPERS)) { e.stopPropagation(); e.preventDefault(); swallowUntil = 0; }
  }, true);
  /* no copy / magnifier callout from a long press on a stepper */
  const st = document.createElement('style');
  st.textContent = `${STEPPERS} { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; touch-action: manipulation; }`;
  document.head.appendChild(st);
}
