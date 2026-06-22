# Fitness Journey 2.0 — Architecture (the foundation)

The goal: build so any change is a **data edit or one isolated module**, never a change that
can crash the rest. This is the structural answer to v1's "every edit broke something."

## The one rule that prevents v1's bugs
> **Everything is DATA that references other DATA by id. Every screen is a pure READ over a
> single store. Every training method is DATA + one isolated renderer. Adding/swapping an
> exercise, a format, a session, or a day = editing data, never touching another module.**

Nothing reaches across modules. The Dashboard can't break Work Mode. Adding a Quad-day
option can't break the timer. That isolation is the whole point.

---

## The data spine (single source of truth)

```
EXERCISE      id, name, pattern(quad/hinge/push/pull/core/skill…), equipment(bw/db/bb/rings/
              parallettes/band/vest/slantboard), measure(reps/hold/cals/dist), load(bw/weighted),
              laterality(bilateral/unilateral), demoUrl, noPR, cues
FORMAT        id, name, shortLabel, kind(see library below), timing/log behaviour descriptor
SESSION       id, name, category, pattern, coreDominant, blocks[]
                block: { role: Primer|Work|Finisher, format: <formatId>,
                         items: [{ exId, prescription:{sets,reps,hold,rest,tempo,perSide,toFailure…} }],
                         notes }
SESSION_LIBRARY  categories → [session options]   (Quad×2-3, Hinge×2-3, Push+Skill×2-3,
                 Push×2-3, Full×3-4, Push+Pull×2-3)
PROGRAM       { name, phaseModel, week: [ {day, sessionId} × 5 ] }   ← references sessions by id
PROFILE       goals[], equipment[], units(kg/lb), constraints(e.g. forearm: supinated/neutral)
LOG           completed session: per block → per item → per set {value, side, weight, unit}
BENCHMARK/PR  per exercise: best + history (excludes noPR)
PROGRESSION   { phase: Foundation|Build|Peak, weekIndex, rules per format }
```

Each screen is just a view over this:
- **Dashboard** = read PROFILE + PR + LOG + PROGRAM (progress, current phase, journey).
- **Week** = read PROGRAM + LOG (5 days, done/not-done).
- **Day** = read one SESSION, scaled to chosen duration (20/30/45/60 add/remove blocks).
- **Work Mode** = run a SESSION's blocks; each block's FORMAT picks its renderer.
- **Builder** = create/edit SESSIONS into the SESSION_LIBRARY and arrange the WEEK.
- **Benchmarks** = read PR history.

---

## Format library (the recurring "what am I doing?" answer)
Each format is named + visible everywhere, and owns ONE renderer in Work Mode.

| id | label | behaviour |
|---|---|---|
| `straight` | Straight sets | sets × reps, rest timer, inline ± |
| `tempo` | Tempo (e.g. 311) | straight + tempo cue/metronome |
| `yates` | Yates / HIT | warm-up ramp → ONE all-out set to failure (+ optional rest-pause) |
| `rest_pause` | Rest-pause | one load, mini-rests to a rep target |
| `isometric` | Isometric hold | hold timer per set |
| `emom` | EMOM | every-minute interval clock |
| `amrap` | AMRAP | count-up window, log rounds/reps |
| `tabata` | Tabata | 20s/10s × 8 interval |
| `circuit` | Circuit | rounds, log-during-rest (built) |
| `skill` | Skill practice | fresh, low-fatigue, practice timer |
| `volume` | Volume / max-set | AMRAP single set for reps |
| `max_test` | Max-rep test | benchmark capture (built) |

Adding a format later = one row here + one renderer module. Nothing else changes.

---

## Module layout
```
js/
  data/      exercises.js · formats.js · sessions.js · program.js   (pure content)
  core/      store.js · selectors.js · progression.js               (state + logic, no DOM)
  screens/   dashboard.js · week.js · day.js · builder.js · benchmarks.js
  runner/    runner.js (orchestrator) · formats/<formatId>.js (one renderer each) · timer.js
  ui/        components.js · theme(css)
  app.js     router only
```

## Build order (one solid block at a time)
1. **Foundation** — data spine + store + selectors; encode the 5 sessions + exercise library + formats.
2. **Week** overview (agenda, done/not-done) + **Day** view (formats visible, time-flex).
3. **Work Mode** format renderers — one format at a time (start with the program's: yates, tempo, isometric, emom, amrap, tabata, skill, volume). Fold in fixes: kill double-tap zoom, tap-number-to-type, grouped log card (name once + sets under), progress bar = sets of current block, joint-prep timer, kg/lb.
4. **Dashboard** (rich).
5. **Builder** (add day-options into the library).
6. **Benchmarks** + **Progression** engine (Foundation→Build→Peak, 4 wks each).
7. Theme polish (lighter boxes), exercise demos.

## The RunPlan contract (Day ⇄ Work Mode) — kills the v1 desync bug
v1's worst bug: you'd adjust a day, but Work Mode/the timer ran something else — because the
runner re-derived or kept its own copy of the session. Fixed structurally:

> **There is ONE object — the `RunPlan` — that is the only thing Work Mode ever reads.
> The Day screen PRODUCES it; the runner CONSUMES it. The runner never re-computes,
> never re-reads the template, never holds a second copy.**

Flow:
1. **Session template** (data) = defaults/seed only.
2. **Day screen** applies, in order: duration scaling (protect anchors) → your edits (reps/
   sets/weight/time/swaps) → **resolution**: expand into an explicit, ordered list of steps —
   every set, per-side split, warm-up set, rest value, timer seconds, rep target — all spelled
   out. Result = the `RunPlan`.
3. **Validation at the boundary**: before handoff, assert every block has a real format, every
   timed step has a number, every set a target. A gap is filled with a safe default + flagged
   here — never as a mid-timer crash.
4. **Start** hands that exact `RunPlan` to the runner. Timers read their seconds straight from
   the RunPlan step. Set 90s rest → RunPlan carries 90 → timer shows 1:30. No path to a stale
   value or a recomputed default.
5. **Mid-workout edits** (inline ±, swap, skip) mutate the **same** RunPlan in place; the
   runner's step pointer reads live from it. Still one object.

Why it can't desync: there is only one source. The runner is a pure consumer of resolved data,
so "what you locked" and "what runs" are literally the same object. Warm-ups, per-side, tempo,
formats are all *resolved into the step list* — the runner has no special cases to drift on.

## Rest fillers / non-competing supersets (efficiency feature)
A long-rest anchor block sets `filler: true`. When the engine resolves the RunPlan it attaches
ONE filler to that block's rest, drawn from `FILLERS` (data/program.js), with two rules:
- **Rotate the type per session**: mobility → antagonist → core/skill → repeat (deterministic,
  by session index — varied, not random). Nicolas wants all three rotating.
- **Never compete with the working muscle**: the filler must NOT share the block's pattern, so
  the primary set's quality is preserved. Antagonist = the opposite-pattern pool (pull anchor →
  push filler, push anchor → pull filler, lower → core/upper).
Work Mode shows the chosen filler as an optional prompt inside the rest countdown. Mobility
fillers also fold the **mobility goal** into idle minutes. Unilateral lifts (e.g. Single-Arm Row)
are self-filling — one side works while the other rests — so they don't need a filler.

## In-app editing & calibration (core requirement)
- Every prescription (reps / sets / weight / time / rest) is **editable and lockable from the
  Day screen** — Nicolas never edits code for routine tweaks.
- **Week 1 = calibration**: the first time through a phase sets the baseline numbers per
  exercise (his real reps/weight/holds). Progression then runs off *those* locked baselines,
  not the seed values. Seeds in the session data are just starting suggestions.

## Standing constraints
- Equipment: all except kettlebell (+ squat rack, 20 lb vest). KB → dumbbell.
- Forearm constraint on pull days: supinated/neutral grips only (data flag on PROFILE).
- Units: kg ⇄ lb toggle, global.
- Duration picker reshapes the session (add/remove blocks), never just shrinks.
