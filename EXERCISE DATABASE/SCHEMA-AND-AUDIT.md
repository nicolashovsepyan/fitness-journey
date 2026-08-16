# THE EXERCISE DATABASE — audit and proposed schema

Written 2026-08-15. Companion to `SYSTEM.md` (how the pieces connect).
Source under audit: `js/data/exercises.js` + `js/data/exercises-gym.js` → 307 entries.

**Status: proposal. No movements added, no fields changed yet.**

---

## 1 · What is actually there

307 entries. Every one has `name`, `pattern`, `equipment`, `measure`, `load`,
`laterality`, `cues`. After that it thins out fast.

| Field | Coverage | Field | Coverage |
|---|---|---|---|
| name / pattern / equipment / measure / load / laterality / cues | 307 (100%) | `families[]` | 73 (24%) |
| `level` | 268 (87%) | `region` | 73 (24%) |
| `diff` | 268 (87%) | `rx` | 71 (23%) |
| `workType` | 257 (84%) | `grip` | 67 (22%) |
| `easier` | 186 (61%) | `noPR` / `main` | 49 (16%) |
| `family` | 155 (50%) | `gymOnly` | 36 (12%) |
| `harder` | 118 (38%) | `ess` | 29 (9%) |
| `methods[]` | 81 (26%) | `dual` | 9 (3%) |

Generated spine, today: 307 movements, **11** with a benchmark, **36** with
coaching copy, **57** with artwork, **249** with none.

`node tools/build-spine.mjs` exits 0. The invariant reports OK. Section 3 is
why that is not the reassurance it looks like.

---

## 2 · Five structural defects

Ranked by how much they block the generator.

### D1 — `pattern` is three different fields wearing one name

The generator's most important filter is the least trustworthy thing in the file.
`pattern` currently mixes:

- **mechanics** — `push`, `pull`, `hinge`, `press`
- **body region** — `quad`, `glute`, `hamstring`, `calf`, `shin`, `core`
- **session role** — `mobility`, `conditioning`, `skill`

So `push` = 94 entries, and it contains push-ups, handstands, planches, burpees,
Turkish get-ups, man-makers, devil's press, `burpee_pull_up` (a pull), and
`seated_knee_tuck_raises` / `seated_straight_leg_raises` / `straddle_leg_lifts`
(core compression work, filed under push). A filter for "give me a push movement"
returns a movement that is mostly a pull, or a core hold, or a full-body complex.

Everything downstream inherits this: pattern balance, antagonist pairing,
finisher matching, the lower-body quad/glute/hamstring trio, the 48-hour
muscle rule. None of them can work on this axis.

### D2 — progression links are hand-written in one direction, so they don't hold

186 `easier`, 118 `harder`, and **118 of them are asymmetric** — `A.easier = B`
while `B.harder` is something else or nothing. Four point at movements that do
not exist:

```
bottoms_up_kb_hold.easier    -> crushgriphold      (missing)
high_plank.harder            -> plankshouldertap   (missing)
plank_opposite_arm_leg.easier-> plankshouldertap   (missing)
mountain_climber.harder      -> bearcrawl          (missing)
```

99 entries have no link in either direction — including 10 of 15 quad, 7 of 9
hinge, 6 of 7 glute. The memory note "progressions only exist for core" is
right in effect: core is the only place the chains are complete.

Root cause is the shape, not the diligence. Two hand-maintained pointers per
movement across 307 movements is 614 chances to drift, and it has drifted.

### D3 — calibration does not exist in this repo at all

There is no `BENCHMARK_MAX`, no calibration table, no per-level expected max —
not on 200 entries, on **all 307**. The table described in memory lives in
`WOD_v35.html`, a different app in the old folder. Nothing in Fitness Journey 2.0
reads it.

What does exist is `FOR NICOLAS/BENCHMARKS - {Male,Female}.csv` — 31 rows of
**rank gates** (Beg / Int / Adv / Elite thresholds). That is a different quantity
and the two must not be merged. The CSV says a beginner push-up standard is 20
reps; the calibration table in memory says a beginner's working max is ~10. Both
are correct about different things — one is the gate you pass to be called a
beginner, the other is what you can do in a set today. The generator needs the
second to prescribe, and the app needs the first to rank.

Of the 31 CSV rows, **11 reach the catalog**. The other 20 are dropped because
`BENCH_ALIAS` in `build-spine.mjs` doesn't name them — including Squat, Deadlift,
Back Squat, Bench Press, Overhead Press, Bent-Over Row, Hip Thrust, Toes to Bar,
Dragon Flag, Hollow Body Hold, Wall HSPU, Australian Pull-Up, Farmer Carry,
KB Swing. Six of its entries (`Chin-up`, `Inverted Row`, `Bodyweight Squat`,
`Muscle-Up`, `Nordic Curl`, `L-Sit`) match no row in the CSV at all.

### D4 — the fields the generator needs to be safe are absent

Confirmed absent across all 307: contraindication tags, movement demands,
substitution links, loading type, per-rep time, explosive-variant links,
plyo flag, CNS cost, format exclusions.

The consequences are concrete. Ozzy has a bad arm, knee and ankle. There is no
field that lets the generator route around any of them — no way to ask "which
movements load the knee hard", so the only options are ban a whole pattern or
ignore the injury. Similarly Rule 14 (Death-By eligibility) needs seconds-per-rep,
Rules 23/37 (EMOM rep ceiling) need it too, and Rules 27/42 need
`Push-Up → Clap Push-Up` links. None of that data is in the file.

`laterality` is the exception that proves the point — the field exists at 100%
coverage and is **wrong on 15 entries**, all tagged `bilateral` while being
plainly one-sided:

```
archer_push_up · one_arm_push_up · half_one_arm_push_up · bulgarian_dip
single_arm_plank · single_arm_leg_plank · single_leg_dragon_flag
single_leg_v_up · one_leg_l_sit · one_leg_v_sit · alternating_single_leg_l_sit
side_plank_hip_dip · side_plank_leg_raise · star_side_plank
copenhagen_plank · windshield_wipers
```

A per-side prescription on any of these comes out half right.

### D5 — one concept, several field names

`family` (155) and `families[]` (73) are the same idea in two shapes.
`measure` (100%) and `workType` (84%) overlap, and `workType` smuggles in
`tut` and `circuit`, which are formats, not measures. `region` (73, core only)
is a partial muscle map that stops at the abs. `rx` (71, core only) is a
hardcoded per-level prescription string — the thing calibration is supposed to
compute.

---

## 3 · The invariant holds, but it is checking a stale list

`build-spine.mjs` fails the build if onboarding asks about a movement the
database lacks. That rule is right and stays. The problem is what it reads.

Onboarding's `LADDER` (`onboarding.html`, from line ~1930) has 12 slots and
**30 rungs**. `DECK_ALIAS` in the build script lists **22 ids**, and they are
the ids of the two *previous* decks — it still carries `mtnclimb` and `wallsit`,
which no rung uses, and it does not carry 13 rungs that exist today:

```
goblet · dbrdl · splitld · dbpress · dips · dbohp · dbrow
tablerow · towelrow · bagcarry · burpee · hkr · legraise
```

Nine of those thirteen do resolve to a movement by luck. **Four do not exist in
the database:**

| Rung | Onboarding asks | Database |
|---|---|---|
| `tablerow` | "Table row — under a sturdy table, chest to the edge" | absent |
| `towelrow` | "Towel door row" | absent |
| `bagcarry` | "Loaded backpack carry" | absent |
| `dbpress` | "Dumbbell press — floor or bench" | absent (only `kb_floor_press`) |

These are exactly the rungs that exist so somebody with no kit can still be
asked the question. They are the bottom of their chains — the answer for the
person with the least equipment — and they are the four with no entry.

**The fix is structural, not another alias.** `build-spine.mjs` should parse the
`LADDER` out of `onboarding.html` and check every rung. Then the table cannot go
stale, because there is no table.

---

## 4 · Coverage — what a generator can actually reach

### By pattern (as currently tagged, defects and all)

```
push 94 · core 75 · pull 71 · mobility 19 · quad 15 · hinge 9 · glute 7
skill 5 · conditioning 4 · hamstring 2 · press 2 · calf 1 · shin 1 · full 1 · carry 1
```

Upper body and core are deep. **Lower body is 35 movements total across every
level and every piece of kit**, of which 2 are hamstring and 1 is a calf raise.
Rule 8 asks for a quad / glute / hamstring trio on every lower block. With 2
hamstring movements in the database, every lower session in the app is going to
show the same hamstring movement.

39 entries have no `level` and no `diff` — and they are almost entirely the
lower body: 9 of 15 quad, 4 of 9 hinge, 4 of 7 glute, both hamstrings, the calf,
the shin, plus all 10 stretches. The lower-body half of the library was never
curated. The header comment in `exercises.js` says so out loud:
*"CORE + PUSH + PULL are curated. LEGS/glute/hamstring provisional."*

### By kit

| Profile | Reachable |
|---|---|
| Bodyweight + mat only | 137 / 307 |
| **Ozzy — kettlebell, bench, mat** | **162 / 307** |
| Dumbbell-tagged | 23 |
| Barbell-tagged | 9 |
| Kettlebell-tagged | 12 |
| Machine / cable-tagged | 13 |

Ozzy's 162 break down as: 65 core, 55 push, 17 mobility, 7 quad, 4 skill,
3 hinge, 3 conditioning, 2 glute — **and zero pulls.**

Not "thin". Zero. He has a bad arm, no bar, and there is not one pulling
movement in the database he can perform. Bodyweight-only is also zero. Even
"home with dumbbells" gets 6, and all six are rear-delt and pullover isolation —
no row, no vertical pull. Every pull-free session he has ever been given was
pull-free because the database had nothing to offer, and nothing in the app
said so.

That is the single worst hole in the file, and it is in front of the only real
client. It is also the reason the invariant needs coverage floors (§6.5): a
profile that can reach zero of a fundamental pattern should fail the build, not
show up months later as a session that felt light.

The known gap "no barbell/dumbbell/machine library" is confirmed and understated:
9 barbell movements is not a barbell library, it is the six lifts the onboarding
deck asks about plus three strays.

### Movements the rules name that the database does not have

Named in `session_design_rules.md` / `creative_generation_principles.md` /
the benchmark CSV, absent from `exercises.js`:

- **Explosive variants** (Rules 27, 42) — Clap Push-Up, Plyo Pike Push-Up, Jump Lunge
- **Death-By eligible** (Rule 14) — Box Jump, Wall Ball, Thruster
- **Level table** (creative principles) — **Pistol Squat**, Step-Up, Shrimp Squat, Cossack Squat
- **Warm-up circuits** (FIX 29) — Reverse Lunge, Donkey Kick
- **Core** — Hollow Body Rocks
- **Onboarding rungs** — Table Row, Towel Door Row, Loaded Backpack Carry, Dumbbell Press

Pistol Squat is the clearest symptom: the benchmark CSV rates it at four levels,
the level-variant table prescribes it as the intermediate lower-body movement,
and it has no entry.

---

## 5 · The proposed schema

One record per movement, six named groups. Written for a generator that takes
kit / days / minutes / level / injuries / goal and composes a whole session.

```js
pike_push_up: {
  /* ── IDENTITY ────────────────────────────────────────── */
  id:        'pike_push_up',        // stable, snake_case, never renamed
  name:      'Pike Push-Up',
  aka:       ['pike press'],        // search + alias resolution

  /* ── MECHANICS — what the body does ──────────────────── */
  patterns:  ['v-push'],            // ORDERED, primary first, closed enum
  muscles:   { primary:   ['front-delt','triceps'],
               secondary: ['upper-chest','traps','abs'] },
  laterality:'bilateral',           // bilateral | unilateral | alternating
  chain:     'upper',               // upper | lower | core | full  (fast filter)

  /* ── PRESCRIPTION — how it is measured and loaded ────── */
  measure:   'reps',                // reps | hold | distance | calories
  dual:      false,                 // prescribable as reps OR hold
  loading:   'bodyweight',          // bodyweight | leverage | added-load
                                    // external-load | banded | assisted
  loadable:  false,                 // prescription shows a weight field
  loadUnit:  null,                  // 'kg' | 'xBW' | null
  secPerRep: 3,                     // EMOM math + Death-By eligibility
  plyo:      false,                 // beginner overlay bans plyo
  tempoOk:   true,                  // eligible for TUT / paused-rep formats
  badFormats:['death_by'],          // formats this movement must never enter

  /* ── PLACEMENT — where in a session it may go ────────── */
  role:      ['working-set'],       // joint-prep | activation | working-set
                                    // skill-strength | skill-practice
                                    // finisher | conditioning
  level:     'int',                 // lowest level this suits
  diff:      4,                     // 1–10, within-catalog
  cns:       'moderate',            // low | moderate | high — hardest-first
  ess:       true,                  // foundational
  unlockOrder: null,                // beginner sequential-unlock position

  /* ── RELATIONS — declared once, links derived ────────── */
  track:     'pike-press',          // progression track id
  rank:      3,                     // position in the track
  families:  ['push-up','handstand-prep'],
  subs:      ['elevated_pike_push_up','db_shoulder_press'],
  explosiveOf: null,                // set on the plyo variant, points at the base

  /* ── CONSTRAINTS — routing around a body and a room ──── */
  equipment: ['bw'],
  space:     'floor',               // floor | wall | bar | bench | outdoor
  demands:   ['overhead-rom','wrist-extension','shoulder-load'],
  contra:    ['shoulder','wrist'],  // joints loaded hard → checked vs pain map

  /* ── CALIBRATION vs BENCHMARK — different quantities ──── */
  calib:     { beg: 5, int: 12, adv: 22, unit: 'reps' },   // working max today
  benchmark: null,                  // rank gates, from the CSV, sex-split

  /* ── TEACHING & MEDIA ────────────────────────────────── */
  cue:       'Hips high, head through the arms at the bottom, press overhead.',
  standard:  'head touches the floor, arms locked at the top',   // what counts
  coaching:  null,                  // { why, cues[], mistakes[] }
  art:       null,
  video:     null,
  noPR:      false,
}
```

### The seven changes that matter

**1 · `pattern` → `patterns[]`, ordered, mechanics only.**
Closed enum, nothing else allowed:

```
upper push   h-push · v-push · straight-arm-push
upper pull   h-pull · v-pull · straight-arm-pull
lower        squat · hinge · lunge · calf · shin
loaded       carry
core         anti-extension · anti-rotation · anti-lateral-flexion
             flexion · extension · compression
whole body   locomotion · jump
```

Array, primary first, because a burpee genuinely is `['squat','h-push','jump']`
and Burpee Pull-Up genuinely is `['v-pull','h-push','squat','jump']`. The subset
matching the engine already wants (FIX 15 / 20 / 36) then works directly against
this field instead of guessing.

`straight-arm-push` / `straight-arm-pull` earn their place: 18 planche entries
and 9 front-lever entries are currently filed as plain push and pull, which is
why straight-arm work keeps landing in bent-arm blocks.

Region (`quad`, `glute`, `core`…) moves to `muscles`. Role (`mobility`,
`skill`, `conditioning`) moves to `role[]`. Both stop being patterns.

**2 · `muscles.primary[]` / `muscles.secondary[]`.**
Closed vocabulary: quad, glute, hamstring, adductor, calf, tibialis, hip-flexor,
lower-back, lat, mid-back, rear-delt, front-delt, side-delt, chest, biceps,
triceps, grip, abs, obliques, serratus.

This one field serves the quad/glute/hamstring trio (Rule 8), the per-muscle
volume cap (TODO 15), and the 48-hour muscle rule (TODO 12) — all three of which
are currently unimplementable.

**3 · `track` + `rank` replace `easier` / `harder`.**
A chain is declared once, per movement, as "which ladder, which rung."
`easier` and `harder` become **derived at build time** and keep being emitted
into `catalog.json` so nothing downstream changes. Asymmetry becomes impossible
to express, and a rank collision or a gap in a track fails the build.

The 7 core tracks in `core_progressions.md` map onto this directly and become
machine-checkable against that file rather than hand-maintained against it.

**4 · `contra[]` + `demands[]` — the injury routing that does not exist today.**
`contra` is the joints the movement loads hard: shoulder, elbow, wrist, neck,
lower-back, hip, knee, ankle. Checked against the PROFILE pain map — and PROFILE
already collects it, the data is being asked for and thrown away.

`demands[]` is what the movement requires of the person: `overhead-rom`,
`deep-knee-flexion`, `wrist-extension`, `grip`, `floor-to-stand`, `impact`,
`hang`, `inversion`. This is what lets a scaled substitution be chosen for a
reason rather than at random — someone who cannot get to the floor and back is a
different constraint from someone whose knee will not bend past 90°.

**5 · `calib` and `benchmark` stay separate, on purpose.**
`calib` = what a person at this level can do in a set right now → the generator
prescribes as a percentage of it (Rules 13/17/19/34/41).
`benchmark` = the rank gates from the CSV, sex-split → the Warrior-rank surface.
Merging them would break both. `calib` is the one field that unblocks the most
rules at once, and it is the one field nobody but you can supply.

**6 · `role[]` decides placement; `level` scales the exercise.**
Rule 9 — level changes the exercise, not the format. Rule 18 — a joint-prep
movement may never be a working set. Both are enforceable the moment `role` is
populated on all 307 rather than inferred from `pattern: 'mobility'`.

**7 · `subs[]`, `secPerRep`, `plyo`, `loadable`, `badFormats`.**
The small fields that close named rules: substitution when kit or a joint rules a
movement out; per-rep time for EMOM ceilings and Death-By eligibility; the plyo
flag for the beginner overlay; `loadable` for the weight-entry field; and
`badFormats` so "never put this in a Death-By" is data, not a special case in
code.

### Required-field tiers

`build-spine.mjs` enforces by tier, so the schema can land before the data does.

| Tier | Fields | Build behaviour |
|---|---|---|
| **T0 · identity** | id, name, patterns, muscles.primary, measure, laterality, equipment, level, diff, role | **fail** on any gap |
| **T1 · generator** | loading, loadable, cns, contra, demands, secPerRep (reps only), track+rank *or* explicit `track:null` | warn now, fail once filled |
| **T2 · quality** | calib, subs, standard, cue, coaching, art | report a count, never fail |

Closed enums (patterns, muscles, role, loading, contra, demands, space) fail the
build on an unknown value. That is what stops a fourteenth spelling of "push"
appearing next month.

---

## 6 · What `build-spine.mjs` should enforce after this

Keeping the two existing invariants exactly as they are, and adding:

1. **Parse the onboarding `LADDER`** instead of `DECK_ALIAS`. Every rung must
   resolve. Delete the hand table — it is the thing that went stale.
2. **Every alias in `BENCH_ALIAS` matches a real CSV row**, and every CSV row
   reaching a real movement. Both directions, both fail loudly. 20 rows are
   currently dropped in silence.
3. **Progression tracks are well-formed** — no rank collisions, no gaps, no
   single-movement tracks, `easier`/`harder` derived not authored.
4. **Closed enums hold**, T0 complete on every entry.
5. **Coverage floors per profile** — for each of a small set of test profiles
   (Ozzy's kit; bodyweight-only; full gym) × each level, the build reports the
   pool size per pattern and **fails below a floor**. A profile that can reach
   one pull movement is a build failure, not something to notice later in a
   generated session.

Point 5 is the one that would have caught Ozzy's single pull months ago.

---

## 7 · Fill order once the schema is agreed

Sequenced so each step unblocks the next, and so the things only you can answer
are batched.

| # | Work | Who | Size |
|---|---|---|---|
| 1 | Migrate all 307 entries to the new field names — mechanical, scripted, `pattern`→`patterns[]` + `muscles` + `role` by rule with a review pass | me | 1 pass |
| 2 | Fix the 15 wrong `laterality` tags, 4 dangling links, `family`/`families` merge | me | small |
| 3 | Rebuild progressions as tracks; core from `core_progressions.md`, push/pull from the existing chains | me | medium |
| 4 | Harden `build-spine.mjs` — LADDER parsing, enum checks, tier checks, coverage floors | me | medium |
| 5 | Add the 4 missing onboarding rungs + the ~14 movements the rules name | me, then you verify | small |
| 6 | **Lower-body curation** — level, diff, muscles, tracks for the 35 lower entries, and expand hamstring / glute / unilateral | you + me | **the big one** |
| 7 | **Pull without a bar** — the Ozzy hole. Table row, towel row, backpack row, ring/strap rows, banded pulls | you + me | **urgent** |
| 8 | Barbell / dumbbell / machine library — a real one, not 9 entries | me, you verify | large |
| 9 | `contra` + `demands` on all 307 | me, you spot-check | 1 pass |
| 10 | **`calib` per level** — batched by family, ~25 at a time | **you** | ongoing |

Steps 1–4 are structure and need nothing from you but a yes to the schema.
Steps 6, 7 and 10 need your judgement and are where the quality actually comes
from.

---

## 8 · Open questions

1. **Does `calib` split by sex?** `benchmark` does, from the CSV. Simpler if
   `calib` does not — but push-up and pull-up expectations differ enough that
   one number may misprescribe for half the users.
2. **Are `level` and `diff` both needed?** `level` is the lowest level a movement
   suits, `diff` is a 1–10 within-catalog rank. They mostly agree. Keeping both
   is cheap and `diff` drives matched-difficulty (Rule 1), so I lean yes.
3. **Where does the ~1200-entry expansion live?** At 300 entries a JS module is
   fine. At 1200 with this many fields, authoring wants a CSV or a small editor,
   with `exercises.js` generated. Worth deciding before, not after.
4. **`gymOnly` — keep or derive?** 36 entries carry it, and it looks derivable
   from `equipment` + `space`. Derived is one less thing to keep true.
