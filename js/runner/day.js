/* ============================================================
   A WORKOUT DAY, BUILT AS YOU GO (Nico, 8 Nov 2026: "an EMOM, then maybe
   another mode, block after block… register it as one workout day at the
   end, until I say I finished for today").
   After a timer: "Keep going" opens a day; every timer done while it is
   open joins the same saved session (store.js merges by dayId). "Done for
   today" closes it. A day left alone for 3 hours closes on its own.
   ============================================================ */
const KEY = 'fj.day', IDLE = 3 * 3600e3;
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
const write = d => { try { d ? localStorage.setItem(KEY, JSON.stringify(d)) : localStorage.removeItem(KEY); } catch (e) {} };

/* the open day, or null */
export function getDay() {
  const d = read();
  if (!d) return null;
  if (Date.now() - (d.last || 0) > IDLE) { write(null); return null; }
  return d;
}
/* the id the session being saved goes under: the open day's, or a new one */
export const dayIdFor = () => getDay()?.id || `d${Date.now().toString(36)}`;
/* this block joins the day (opens it with this id if none is open) */
export function addToDay(id, blk) {
  const d = getDay() || { id, at: new Date().toISOString(), blocks: [] };
  if (d.id !== id) return d;
  if (!d.blocks.some(b => b.key === blk.key)) d.blocks.push(blk);
  d.last = Date.now(); write(d); return d;
}
/* keep the day open for the next block */
export function keepDay(id, blk) { const d = addToDay(id, blk); d.open = true; d.last = Date.now(); write(d); return d; }
export function endDay() { write(null); }
