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
   Every form the console currently writes, and nothing speculative.

       3 x 8                    sets and reps
       3 x 40s                  sets and a hold in seconds
       3 x 8 each side          sets and reps, per side
       3 x 40s each side        sets and a hold, per side
       10-15 reps               a range: the low end is the target
       12 reps                  one set, counted
       8 each side              one set, counted, both sides
       30s each side            one hold, both sides
       8 slow                   one set, counted (the adverb is a cue)
       3 x 6 - tempo 3-1-1      a count, then a cue after a separator
       (em dash)                deliberately no target: AMRAP, intervals

   `x` may be typed as x, * or the multiplication sign.

   WHY THIS GREW. An audit of all three programs ran every prescription
   through this parser: 14 of 50 came back unreadable, and an unreadable
   one becomes `sets: 1` with no rep target. So "Bulgarian Split Squat
   3 x 8 each side" was running as ONE set of nothing, and the same was
   true of every unilateral movement in every program, every rep range in
   the beginner program, and every prescription carrying a tempo cue.

   Nothing was dropped silently - `unparsed` was set and app.js logged a
   warning to the console - but nobody reads a console mid-workout. The
   grammar simply did not cover what the coach actually types.

   THE RULE HAS NOT CHANGED: anything still unrecognised is carried
   through with `unparsed` and its text intact, never guessed at. A
   workout that quietly drops two sets is worse than one that admits it
   did not understand. */

/* A cue after a separator is not part of the count. "3 x 6 - tempo 3-1-1"
   is three sets of six; the rest is instruction for the person, not the
   timer. Split it off, parse the head, and keep the WHOLE original text
   for display so nothing the coach wrote disappears from the screen. */
const SEP = /\s*[·•|]\s*/;                 // middot, bullet, pipe
const SIDE = '(?:reps?\\s*)?each\\s+(?:side|way|leg|arm)';
const X = '\\s*[\\u00d7x*]\\s*';                     // multiplication sign, x, *

export function parsePrescription(pres) {
  const raw = String(pres == null ? '' : pres).trim();
  if (!raw) return { unparsed: true, raw };

  /* Deliberately no target: an AMRAP, or one leg of an interval. The coach
     means "as many as you get", not "one rep". Marked rather than left
     unparsed, so it stops being reported as a failure it never was. */
  if (/^[—–-]+$/.test(raw)) return { sets: 1, untargeted: true, raw };

  const parts = raw.split(SEP);
  const head = parts[0].trim();
  const cue = parts.slice(1).join(' · ').trim();
  const done = o => (cue ? { ...o, cue, raw } : { ...o, raw });

  /* sets x reps|hold, per side — the most specific form, so it goes first */
  const setsSide = head.match(new RegExp('^(\\d+)' + X + '(\\d+)\\s*(s|sec|secs)?\\s*' + SIDE + '$', 'i'));
  if (setsSide) {
    const n = +setsSide[1], v = +setsSide[2];
    return done(setsSide[3] ? { sets: n, hold: v, perSide: true }
                            : { sets: n, reps: v, perSide: true });
  }

  /* sets x reps|hold */
  const sets = head.match(new RegExp('^(\\d+)' + X + '(\\d+)\\s*(s|sec|secs)?$', 'i'));
  if (sets) {
    const n = +sets[1], v = +sets[2];
    return done(sets[3] ? { sets: n, hold: v } : { sets: n, reps: v });
  }

  /* a range: "10-15 reps". The LOW end is the target, because a range is a
     floor with room above it, and a target you have already beaten is not a
     target. The full text stays on screen, so the top of the range is never
     hidden from the person doing it. */
  const range = head.match(/^(\d+)\s*[-–—]\s*(\d+)\s*(?:reps?)?$/i);
  if (range) return done({ sets: 1, reps: +range[1], repsMax: +range[2] });

  /* one hold, per side, then one hold */
  const holdSide = head.match(new RegExp('^(\\d+)\\s*(?:s|sec|secs)\\s*' + SIDE + '$', 'i'));
  if (holdSide) return done({ sets: 1, hold: +holdSide[1], perSide: true });

  const hold = head.match(/^(\d+)\s*(s|sec|secs)$/i);
  if (hold) return done({ sets: 1, hold: +hold[1] });

  /* one set, counted, both sides */
  const side = head.match(new RegExp('^(\\d+)\\s*' + SIDE + '$', 'i'));
  if (side) return done({ sets: 1, reps: +side[1], perSide: true });

  /* a bare count, with or without a trailing cue: "12 reps", "8 rocks",
     "8 slow". The number leads in every one of them. */
  const count = head.match(/^(\d+)(?:\s+[A-Za-z][A-Za-z\s-]*)?$/);
  if (count) return done({ sets: 1, reps: +count[1] });

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
        /* the top of a range, and the coach's cue, both carried so the screen
           can show what was written rather than only what was counted */
        ...(p.repsMax != null ? { repsMax: p.repsMax } : {}),
        ...(p.cue ? { cue: p.cue } : {}),
        ...(p.untargeted ? { untargeted: true } : {}),
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
