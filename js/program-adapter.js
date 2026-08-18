/* ============================================================
   PROGRAM ADAPTER — a program written in the console, made runnable.

   Two shapes exist and they were never introduced to each other.

   The CONSOLE writes what a coach types:
       days.d1.blocks[].items[] = { ex, pres: "3 × 8", note }

   The RUNNER executes what a machine can count:
       plan.blocks[].items[]    = { exId, name, measure, sets, reps|hold }

   `pres` is prose. "3 × 8" and "8 slow" and "3 × 40s" are all obvious to a
   person and none of them are numbers a timer can use. So this parses them —
   over a closed grammar, because the console writes them and the console is
   the only thing that does.

   WHAT IT REFUSES TO DO IS THE IMPORTANT PART. A prescription it cannot read
   is NOT silently turned into one set of ten. It is carried through with
   `unparsed` set and the original text intact, so the day shows what the
   coach actually wrote and the console can be made to flag it. A workout
   that quietly drops two sets is worse than one that admits it did not
   understand — the person doing it has no way to know the difference.

   This exists because the program is data now (tools/export-program.mjs) and
   data has to be executable to be worth anything. When the generator writes
   programs it should emit the structured shape directly and this becomes a
   compatibility shim for hand-written days.
   ============================================================ */
import { EXERCISES } from './data/exercises.js';

/* The console's roles are a coach's words; the runner sorts and styles by
   its own. Hold and Move have no runner equivalent and are not invented —
   they are the closest honest match. */
const ROLE = {
  Prime: 'Primer', Work: 'Work', Finish: 'Finisher',
  Hold: 'Work', Move: 'Mobility',
};

/* ---- the grammar ------------------------------------------------------
   Every form the console currently writes, and nothing speculative:

       3 × 8          sets and reps
       3 × 40s        sets and a hold in seconds
       12 reps        one set, counted
       8 each side    one set, counted, both sides
       8 slow         one set, counted (the adverb is a cue, not a number)

   `×` may be typed as x or *. Everything else comes back unparsed. */
export function parsePrescription(pres) {
  const raw = String(pres == null ? '' : pres).trim();
  if (!raw) return { unparsed: true, raw };

  const sets = raw.match(/^(\d+)\s*[×x*]\s*(\d+)\s*(s|sec|secs)?$/i);
  if (sets) {
    const n = +sets[1], v = +sets[2];
    return sets[3] ? { sets: n, hold: v, raw } : { sets: n, reps: v, raw };
  }

  const hold = raw.match(/^(\d+)\s*(s|sec|secs)$/i);
  if (hold) return { sets: 1, hold: +hold[1], raw };

  const side = raw.match(/^(\d+)\s*(?:reps?\s*)?each\s+(side|way|leg|arm)$/i);
  if (side) return { sets: 1, reps: +side[1], perSide: true, raw };

  /* a bare count, with or without a trailing cue: "12 reps", "8 rocks",
     "8 slow". The number leads in every one of them. */
  const count = raw.match(/^(\d+)(?:\s+[A-Za-z][A-Za-z\s-]*)?$/);
  if (count) return { sets: 1, reps: +count[1], raw };

  return { unparsed: true, raw };
}

/* Names for the two movements the console uses that the app's library does
   not carry. Passed in rather than fetched here so this stays synchronous
   and testable; app.js loads spine/catalog.json once. */
function nameOf(id, catalog) {
  if (EXERCISES[id]) return EXERCISES[id].name;
  if (catalog && catalog[id] && catalog[id].name) return catalog[id].name;
  return id;
}

/**
 * Turn one console day into a plan the runner can execute.
 * Returns { plan, warnings } — warnings names every prescription that could
 * not be read, so a caller can show them rather than discover them mid-set.
 */
export function adaptDay(dayId, day, catalog = {}) {
  const warnings = [];

  const blocks = (day.blocks || []).map((b, i) => {
    const items = (b.items || []).map(it => {
      const p = parsePrescription(it.pres);
      const lib = EXERCISES[it.ex];
      if (p.unparsed) {
        warnings.push({ ex: it.ex, name: nameOf(it.ex, catalog), pres: p.raw });
      }
      return {
        exId: it.ex,
        name: nameOf(it.ex, catalog),
        /* a hold in the prescription overrides whatever the library thinks
           the movement is measured in — the coach is being specific */
        measure: p.hold != null ? 'hold' : (lib && lib.measure) || 'reps',
        load: (lib && lib.load) || 'bw',
        laterality: (lib && lib.laterality) || 'bilateral',
        sets: p.sets ?? 1,
        ...(p.reps != null ? { reps: p.reps } : {}),
        ...(p.hold != null ? { hold: p.hold } : {}),
        ...(p.perSide ? { perSide: true } : {}),
        note: it.note || '',
        pres: p.raw,
        unparsed: !!p.unparsed,
      };
    });

    return {
      id: `${dayId}b${i}`,
      role: ROLE[b.role] || 'Work',
      type: ROLE[b.role] || 'Work',
      name: b.role || 'Block',
      /* 'straight' walks item by item, set by set — the only honest reading
         of a list of movements with sets against each one. Circuits and
         intervals are a different instruction and the console has no way to
         say it yet, so none is assumed. */
      format: 'straight',
      note: '',
      minutes: +b.mins || 0,
      items,
    };
  }).filter(b => b.items.length);

  return {
    plan: {
      name: day.name || 'Session',
      sessionId: dayId,
      pattern: day.tag || null,
      category: null,
      duration: (day.blocks || []).reduce((t, b) => t + (+b.mins || 0), 0) || 30,
      why: day.why || '',
      tags: [],
      blocks,
      fromConsole: true,
    },
    warnings,
  };
}
