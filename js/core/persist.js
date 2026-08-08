/* ============================================================
   PERSIST — a serialised, coalescing writer.

   The problem it exists to solve, demonstrated before it was written:

     three checkbox toggles in the same instant
       synchronous (today)    → [true, true, true]
       naive await everywhere → [null, null, true]     two writes lost

   Every await between "read the document" and "write it back" is a
   door another operation can walk through. The second write is built
   on the state the first one already replaced, so the first silently
   disappears. Nothing throws. The tick just does not stick.

   Fifteen of the store's writes are fired straight from tap handlers —
   habit ticks, set checkboxes, exercise swaps — so overlapping writes
   are the normal case, not an edge case.

   The fix is to stop treating a write as "read, change, save" and make
   it "change what is already in memory, then save the whole thing".
   Memory is changed synchronously, so it cannot interleave. Saving is
   serialised here, so two saves cannot overlap either.

   COALESCING IS CORRECT HERE, not a shortcut. What gets written is the
   whole user document. If three changes happen while one save is in
   flight, writing the final document once is not a compromise — it is
   exactly the same end state, with two fewer round trips.

   DURABILITY. put() calls flush() synchronously, and LocalAdapter's
   write reaches localStorage.setItem before its first await. So on
   this backend a write is on disk by the time put() returns, exactly
   as it is today. A remote backend genuinely defers, which is the
   whole point of a queue — and flush() is there for the moments that
   must not be lost.
   ============================================================ */

/**
 * @param {(value:any) => Promise<any>} save
 * @returns {{ put(value:any):void, flush():Promise<void>, pending():boolean, lastError():Error|null }}
 */
export function createWriter(save) {
  let queued = null;        // the newest value waiting to go out
  let has = false;          // queued===null is a legitimate value, so track separately
  let running = null;       // the in-flight drain, or null
  let lastError = null;

  async function drain() {
    while (has) {
      const value = queued;
      has = false; queued = null;
      try {
        await save(value);
        lastError = null;
      } catch (e) {
        /* Loud. A silent failure here is a workout that looks saved and
           is not — the single worst thing this app can do. */
        lastError = e;
        console.error('persist failed', e);
      }
    }
    running = null;
  }

  return {
    put(value) {
      queued = value; has = true;
      if (!running) running = drain();
    },
    /* Await everything currently queued. For the moments that must not
       be lost: leaving a screen, backgrounding the tab, finishing a
       workout, switching user. */
    async flush() {
      while (running) await running;
    },
    pending() { return has || !!running; },
    lastError() { return lastError; },
  };
}
