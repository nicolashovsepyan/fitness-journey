# EXERCISE DATABASE

Everything about the movement library lives here. One folder, nothing scattered.

---

## What is in here

```
EXERCISE DATABASE/
  README.md                  ← you are here
  DASHBOARD.html             the visual view — open it in a browser
  SCHEMA-AND-AUDIT.md        the full audit + the proposed schema, in writing
  workbook/
    EXERCISES.xlsx           THE DATABASE — this is where you work
    _derived.json            intermediate, rebuilt by the tools, ignore
  tools/
    derive.mjs               js/data/exercises.js  →  _derived.json
    build-workbook.py        _derived.json         →  EXERCISES.xlsx
    build-dashboard.py       _derived.json         →  DASHBOARD.html
    dashboard.template.html  the dashboard's source
    gym-library-seed.json    the 110 proposed classic-gym movements
    fundamentals.json        the 15 / 30 / 50 list, from FOR NICOLAS/FUNDAMENTALS.md
```

---

## Open these two

**`DASHBOARD.html`** — double-click it. Tick the equipment a person owns and
watch what the database can and cannot give them. That is the fastest way to
see why this rebuild matters.

**`workbook/EXERCISES.xlsx`** — the database. Six sheets:

| Sheet | What it is |
|---|---|
| **START HERE** | Curation state, coverage per profile, your task list |
| **MOVEMENTS** | All 307, one row each, every field. Dropdowns on every list column |
| **TRACKS** | Progression chains, easiest → hardest. Gaps are marked |
| **CALIBRATION** | Blank on purpose. This is the batch job that is yours |
| **FUNDAMENTALS** | The 15 / 30 / 50 we promise to teach. Cards and artwork attach here |
| **GYM LIBRARY** | The parallel classic-gym build. Say yes / no / later per line |
| **LISTS** | The allowed values. Anything outside them fails the build |

### Colour key, everywhere in the workbook

| | |
|---|---|
| 🟡 pale yellow | you decide, or I guessed and want your eyes |
| 🟢 pale green | derived automatically, probably fine |
| 🔴 pale red | required and still empty |

---

## The three disciplines

A new axis, per your note. Every movement carries exactly one.

| Discipline | What it is | Count today |
|---|---|---|
| **Calisthenics** | Bodyweight strength. **The only one that also holds skills** | 236 |
| **Functional** | Loaded real-world patterns — kettlebell, carries, get-ups, complexes | 37 |
| **Gym** | Barbell, dumbbell, cable, machine. Predictable load, small increments | 34 |

Skills — handstand, planche, front lever, muscle-up, L-sit — are a flag inside
calisthenics (`Skill?` column), not a fourth discipline. That is what your
sentence described, and it keeps the placement rule clean: skill *practice*
needs a fresh nervous system, skill *strength* can go anywhere.

---

## Cards, fundamentals and artwork are DB fields

Your rule, and it is now built that way: a movement knows whether it is a
fundamental, which tier, what its card says, and whether its picture exists.
Nothing about movements is kept in a side document — that is how four alias
tables drifted.

The fundamentals are the **15 / 30 / 50** from `FOR NICOLAS/FUNDAMENTALS.md`,
across 14 families. Cumulative: advanced means all fifty, including the fifteen.
The number is what you have MASTERED; about twelve is what you TRAIN in a week
at any level.

**37 of the 50 exist in the database. 13 do not:**

| Tier | Missing |
|---|---|
| 15 | Hip hinge (bodyweight RDL) · Reverse lunge · Joint-prep CARs circuit · Zone 2 walk/jog |
| 30 | Assisted / box pistol squat · Box jump · VO2 intervals 4×4 |
| 50 | Pistol squat · Shrimp squat · Sprint · Power clean → overhead press · Jefferson curl · Long-duration Zone 2 / ruck |

Two patterns in that list: **single-leg** is the biggest hole, and **aerobic and
mobility are families on the fundamentals list that barely exist as movements** —
all three aerobic entries are missing.

**Artwork: 57 of 307 drawn.** Only **20 of the 36** fundamentals that do exist
have a picture. I checked `EXERCISE LIBRARY/Exercise_Illustration_Collection/`
(67 illustrations) hoping for free wins — 32 are already cropped in and most of
the rest are alternate framings of movements already drawn. Only 3 were genuinely
unlinked: `planche_lean`, `high_plank`, `turkish_get_up`. So artwork is a real
~247-movement job, not a linking problem.

**Cards do not exist yet** in any form. The FUNDAMENTALS sheet is where they get
written, one per movement on the list.

---

## Curation status

"Curated" = the movement has a level, a difficulty, and a place in a
progression chain.

| Area | Movements | State |
|---|---|---|
| Core | 78 | **done** |
| Push | 96 | **done** |
| Pull | 71 | to do |
| Lower body | 39 | to do — and it was never really started |
| Full body / conditioning | 5 | to do — barely exists |
| Mobility / prep | 18 | to do |

---

## The finding that matters most

Ozzy's kit is a kettlebell, a bench and a mat.

**The database holds zero pulling movements he can perform.** Not few — none.
Bodyweight-only is also zero. Every pull-free session he has been given was
pull-free because there was nothing to give him, and nothing in the app said so.

Add a pull-up bar in the dashboard and Pull goes from 0 to 34. That single
toggle is the argument for this whole rebuild.

---

## How to work in the workbook

1. **Filter, do not scroll.** Every sheet has filters on the header row.
   To curate Pull: MOVEMENTS → filter *Patterns* → pick the three pull values.
2. **Use the dropdowns.** List columns are constrained. Multi-value columns
   (patterns, muscles, role, demands, joints) take several values separated by
   commas — the dropdown is there as a reminder of what is allowed.
3. **Batch the calibration.** 25 rows at a sitting. The sheet is sorted so the
   movements that get prescribed most often are at the top.
4. **Leave a cell blank rather than guess.** A blank is visible and gets fixed.
   A wrong number is invisible and gets prescribed to somebody.

---

## Rebuilding

If `js/data/exercises.js` changes, regenerate from the repo root:

```bash
node "EXERCISE DATABASE/tools/derive.mjs" && python3 "EXERCISE DATABASE/tools/build-workbook.py" && python3 "EXERCISE DATABASE/tools/build-dashboard.py"
```

⚠️ **This overwrites `EXERCISES.xlsx`.** Safe today, because nothing has been
edited by hand yet. The moment you start editing, the direction reverses: the
workbook becomes the source of truth and a new tool generates `exercises.js`
from it. Tell me when you have started and I will build that half and remove
this footgun.

---

## Open questions for you

1. **Does calibration split by sex?** The rank gates in
   `FOR NICOLAS/BENCHMARKS - {Male,Female}.csv` do. Simpler if calibration does
   not — but push-up and pull-up expectations differ enough that one number may
   misprescribe for half the users.
2. **Is the gym list right?** 110 proposed in the GYM LIBRARY sheet, 15 of which
   already exist. Add what is missing, strike what you would never program.
3. **Anything in the workbook you would rather see differently** — a column
   order, a sheet split, a name. It is cheap to change now and expensive later.
