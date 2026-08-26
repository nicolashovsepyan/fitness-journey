/* ============================================================
   THE CURRENT PROGRAM — one answer, and every screen asks it.

   THE PROBLEM THIS ENDS.

   This app had two answers to "what am I training this week", and which
   one you got depended on which page you happened to be looking at.

       dashboard.html   read the program the coach RELEASED
       js/screens/*     read a hardcoded Foundation Block from
                        js/data/program.js and js/data/sessions.js

   So the dashboard showed The Fundamentals and the app's own week screen
   showed somebody else's five-day block, on the same device, a tap apart.
   Finish a workout and you landed on the wrong one — which is exactly the
   moment a person looks at their program.

   Only app.js had ever been taught about the released program, and only
   for the single job of starting a workout. Everything else was still
   reading the file that shipped with the repo.

   Now: the released program is resolved ONCE at boot and held here, and
   every screen reads it through program() and sessions(). The built-in
   pair is what those return when a person has no released program — a
   fallback, which is what it always should have been.

   WHY IT RESOLVES ONCE, SYNCHRONOUSLY AFTERWARDS.

   The same reason identity does, and the reason is written at the top of
   js/users.js: reading a program is async, and if every screen had to
   await one then every screen would need a "not loaded yet" state, and
   a render that lands first would draw an empty week and call it the
   truth. app.js awaits this at boot, before anything renders. After that
   the answer is a synchronous call.

   THE OBJECTS ARE LIVE, NOT COPIES. js/screens/program.js builds a day
   and writes it straight into the session map. That still works, and it
   only works because these return the real object.
   ============================================================ */
import { PROGRAM as BUILTIN_PROGRAM } from '../data/program.js';
import { SESSIONS as BUILTIN_SESSIONS } from '../data/sessions.js';
import { parsePrescription } from '../program-adapter.js';
import { storage } from './storage.js';

let PROG = null;      // PROGRAM-shaped, or null for "use the built-in"
let SESS = null;      // SESSIONS-shaped, or null

/* The console writes a coach's words; the app sorts and styles by its own.
   Same map the runner's adapter uses, and for the same reason: Hold and
   Move have no runner equivalent and are not invented, they are the
   closest honest match. */
const ROLE = { Prime: 'Primer', Work: 'Work', Finish: 'Finisher', Hold: 'Work', Move: 'Mobility' };

/* One console day, in the shape the screens already understand.

   The console writes prose — "3 × 8 each side" — and the screens want
   numbers. parsePrescription is the one place that translation happens,
   so it happens here too rather than growing a second dialect. A
   prescription it cannot read keeps its text and simply carries no
   numbers, which is the same promise the runner makes. */
function toSession(dayId, day, fixed) {
  const blocks = (day.blocks || []).map((b, i) => ({
    id: `${dayId}b${i}`,
    role: ROLE[b.role] || 'Work',
    /* 'straight' walks item by item, set by set — the only honest reading
       of a list of movements with sets written against each one. The
       console has no way to say "circuit" yet, so none is assumed. */
    format: 'straight',
    name: b.name || b.role || 'Block',
    note: b.note || '',
    minutes: +b.mins || 0,
    items: (b.items || []).map(it => {
      const p = parsePrescription(it.pres);
      const o = { ex: it.ex, note: it.note || '', pres: p.raw };
      if (p.sets != null) o.sets = p.sets;
      if (p.reps != null) o.reps = p.reps;
      if (p.hold != null) o.hold = p.hold;
      if (p.perSide) o.perSide = true;
      return o;
    }),
  })).filter(b => b.items.length);

  return {
    id: dayId,
    name: day.name || 'Session',
    /* The console's tag is the one line describing what a day IS -
       "lower · squat", "upper · bench". Both of these are display only
       (the week row's subtitle, the day screen's chips), so the tag is
       the honest thing to put in them rather than an invented grouping. */
    category: day.tag || null,
    pattern: day.tag || null,
    coreDominant: false,
    tags: day.tag ? [day.tag] : [],
    why: day.why || '',
    /* A coach wrote these numbers. `fixed` is what stops the duration
       scaler quietly turning 4 x 5 into 3 x 5 because somebody picked a
       shorter session — and the program file itself says whether that is
       allowed, so this asks it rather than deciding. */
    fixed,
    blocks,
  };
}

/**
 * Resolve this person's program once. Awaited by app.js at boot, before
 * anything renders. Returns true when a released program was found.
 */
export async function loadCurrentProgram(uid) {
  PROG = null; SESS = null;
  try {
    if (!uid) return false;
    const prg = await storage().getProgram(uid);
    const raw = prg && prg.profile && prg.profile.raw;
    if (!raw || !raw.days || !Object.keys(raw.days).length) return false;

    const sessions = {};
    const week = [];
    Object.entries(raw.days).forEach(([id, day], i) => {
      sessions[id] = toSession(id, day, !!raw.fixed);
      week.push({ day: i + 1, sessionId: id });
    });

    SESS = sessions;
    PROG = {
      id: raw.from || 'released',
      name: raw.name || prg.name || 'Your program',
      phases: ['Foundation', 'Build', 'Peak'],
      phaseWeeks: 4,
      defaultDuration: +raw.duration || 30,
      week,
    };
    return true;
  } catch (e) {
    /* A program we cannot read must not stop the app opening. The built-in
       pair is still there and the person still gets a working screen. */
    console.warn('[program] could not read the released program', e);
    PROG = null; SESS = null;
    return false;
  }
}

/** The week. The released one if there is one, the built-in otherwise. */
export function program() { return PROG || BUILTIN_PROGRAM; }

/** The sessions that week refers to, from the same source. */
export function sessions() { return SESS || BUILTIN_SESSIONS; }

/** True when the person is on a program a coach actually wrote for them. */
export function isReleased() { return !!PROG; }
