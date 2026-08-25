# EXERCISE DATABASE

Everything about movements lives in this one folder. Nothing about movements
lives anywhere else.

---

## If you read nothing else

**Open `workbook/EXERCISES.xlsx` and look at the first tab: `DO THIS NEXT`.**

That tab is your queue — every job waiting on you, shortest first, with where
to do it and how long it takes. The other six tabs are reference and I keep
them current. You never have to go hunting.

The visual version of the same thing is `DASHBOARD.html` — double-click it.

---

## The walkthrough

**1. Open the workbook.** `workbook/EXERCISES.xlsx`. Seven tabs, in the order
you use them.

**2. Start on `DO THIS NEXT`.** Top section is the queue. Below it is a
"where everything is" table — which tab is what, and whether it needs you.

**3. The first three jobs take twelve minutes.** They are the ones that
change decisions downstream, so they are worth doing before the long ones:
three calibration numbers that are wrong, three fundamentals questions, and
one decision about the headline number.

**4. When you are working in a tab, use the filters, do not scroll.** Every
sheet has a filter on the header row. To find only the things waiting on you:

| Tab | Filter |
|---|---|
| CALIBRATION | `Source` = `proposed` (mine, needs your eye) or blank |
| FUNDAMENTALS | `Your call` is not empty |
| MOVEMENTS | `Status` = `REVIEW` |

**5. Colour means the same thing everywhere.**

| | |
|---|---|
| 🟡 yellow | you decide, or I guessed and want your eye |
| 🟢 green | your own answer, or derived and fine |
| 🔴 red | required and still empty |

**6. Never keep a second copy of the workbook.** If Excel makes you an
`EXERCISES_after_crash.xlsx` or similar, tell me — the build now refuses to
run when it sees one, because a stray copy is how a whole session of your
answers went invisible on 18 August.

---

## The seven tabs

| Tab | What it is | Needs you? |
|---|---|---|
| **DO THIS NEXT** | Your queue, and the map | **Yes — start here** |
| **FUNDAMENTALS** | The 27 ladders — bodyweight lane, gym lane beneath. Protocols and kettlebell complexes at the bottom | **Yes — walk them once** |
| **CALIBRATION** | Entry / Solid / Strong per movement. Weights in **lbs** | **Yes — the numbers** |
| **MOVEMENTS** | All 461 movements, every field. The database itself | Only the yellow rows |
| **TRACKS** | Progression chains, easiest to hardest | No |
| **GYM LIBRARY** | Your 102 yes / 7 no on the classic gym list | No — finished |

**One workbook, always.** `KETTLEBELL.xlsx` was merged into `EXERCISES.xlsx` on
20 August and archived to `_archive/`. Its 67 movements were already in
MOVEMENTS, its 11 tracks already in TRACKS; the 9 complexes and your 4 video
links now sit at the bottom of FUNDAMENTALS. The extractor refuses to run if a
second workbook ever appears in `workbook/`.
| **LISTS** | The allowed values behind every dropdown | No |

---

## What calibration means now

You spotted that "beginner" was doing two jobs — a person who never trained,
and someone who just unlocked the muscle-up. So the columns changed:

| Column | Means |
|---|---|
| **Entry** | the day you first own the movement |
| **Solid** | you train it comfortably |
| **Strong** | you have mastered it |

These describe the **movement**, not the person. A muscle-up legitimately
starts at 1–2 reps without that meaning "gym beginner". Who ever *sees* a
muscle-up is the separate `level` field on the movement.

Person levels are now four: **just starting → beginner → intermediate →
advanced**. The fourth one was your call and the data backs it — the average
*untrained* man does 13–29 push-ups, so "beginner = 20" was never a true
novice.

---

## The fundamentals

The **15 / 30 / 50** from `FOR NICOLAS/FUNDAMENTALS.md`, restructured on
19 August with your approval:

- **Added rotation** (half-kneeling rotation, kettlebell windmill) — rotation
  is one of the seven primal movement patterns and the list had none.
- **Added frontal plane** (side plank, cossack squat) — the list was entirely
  sagittal.
- **Split 5 slots** that held two movements each. They could not share a
  calibration row because the units differed.
- **Moved 5 protocols out** — Zone 2, VO2 intervals, long ruck, sprint and the
  CARs circuit are prescriptions, not exercises. This is why 13 fundamentals
  used to read as "missing from the database": most of them were never
  movements.

**All 53 now exist in the database**, up from 37 of 50.

Real counts are **16 / 33 / 52**, not 15 / 30 / 50. Your call in the morning:
accept the real numbers, trim three, or rename the tiers.

---

## Modality and functional — two questions, not one

| Modality | Count | Functional |
|---|---|---|
| **Bodyweight** | 244 | and the only world that holds **skills** |
| **Kettlebell** | 72 | 70 |
| **Barbell** | 43 | 34 |
| **Dumbbell** | 41 | 26 |
| **Machine** | 32 | **0** — never functional, never the default |
| **Cable** | 12 | **0** |
| **Band** | 12 | 9 |

"Calisthenics" is not a field: it is `modality: bodyweight`, mostly
functional, with the skill subset on top.

**66 bridges** link a gym movement to the fundamental we mean to reach —
bench press → push-up, lat pulldown → pull-up, leg press → bodyweight squat.
That is the mechanism behind your rule: honour their pick in programme 1,
introduce the fundamental in programme 2 or 3.

---

## Rebuilding

Close Excel first, then from the repo root:

```bash
python3 " EXERCISE DATABASE/tools/extract-decisions.py" && node " EXERCISE DATABASE/tools/derive.mjs" && python3 " EXERCISE DATABASE/tools/build-workbook.py" && python3 " EXERCISE DATABASE/tools/build-dashboard.py"
```

Your answers are safe: `extract-decisions.py` pulls everything you typed into
`_decisions.json`, which the generator reads and never writes, and the rebuild
puts your answers back. It also refuses to run if a second workbook exists.

---

## Files

```
 EXERCISE DATABASE/
   README.md                    this
   DASHBOARD.html               the visual view
   SCHEMA-AND-AUDIT.md          the original audit + schema
   workbook/
     EXERCISES.xlsx             THE DATABASE — where you work
     _decisions.json            your answers, safe from rebuilds
     _derived.json              intermediate, ignore
   tools/                       the generators
   EXERCISE PHOTO LIBRARY/      artwork
```

---

## Open questions

1. **Headline number** — 16 / 33 / 52 or trim to 15 / 30 / 50?
2. **Ring Dip** — keep at tier 3? It needs rings, unlike everything else.
3. **Jefferson Curl** — keep as optional-advanced? Loaded spinal flexion is contested.
4. **Nordic Curl at two tiers** — same movement, two masteries. Keep that convention?
