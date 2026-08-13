# The exercise decks

**You changed the model and you were right.** This file is rewritten around
your note. Read the two decisions at the bottom and mark them — that is all I
need.

---

## What you said, and why it kills the old version

> *each equipment should unlock a set of exercises. we need to decide of our
> Foundational movements*

The old version had four fixed decks — bodyweight-with-a-bar,
bodyweight-with-nothing, home kit, full gym — and picked one. That is wrong
for the obvious reason: **almost nobody is one of those four people.** Someone
with a pull-up bar and two dumbbells and nothing else got handed the home-kit
deck and asked about a bench press they cannot do, or the bodyweight deck and
never asked about the dumbbells they own.

Your model fixes it. But it needs one thing added or it breaks: if equipment
only ever *unlocks*, then a full gym unlocks twenty movements and we still
only have twelve cards — and someone with a bare floor unlocks nothing and has
holes. So:

**Twelve slots, fixed. Each slot has a ladder. Equipment decides how high up
the ladder you are asked.**

The slots never change — those are your foundational movements, the twelve
things a person should own for life. The ladder is only how we meet them where
they actually are.

Nobody ever gets a hole. Nobody ever gets asked about a bar they do not own.

---

## The twelve foundational slots

These are the answer to *"we need to decide of our Foundational movements."*
Twelve patterns, not twelve exercises — the exercise is whatever their kit
allows.

| # | Slot | Why it earns a place |
|---|---|---|
| 1 | **Squat** | Knee-dominant. The one everybody needs and most do badly. |
| 2 | **Hinge** | Where back health and every athletic movement comes from. |
| 3 | **Single leg** | Everything in life is one leg at a time. Also finds imbalance. |
| 4 | **Horizontal push** | Chest and triceps. |
| 5 | **Vertical push** | Overhead. The shoulder health test hiding as a strength test. |
| 6 | **Horizontal pull** | The counterweight to a desk. |
| 7 | **Vertical pull** | The hardest one to fake, and the best single upper-body number. |
| 8 | **Explosive** | Power. First thing lost with age, and Galpin's biggest flag. |
| 9 | **Carry / grip** | Grip strength predicts more than any other single number. |
| 10 | **Full body** | Conditioning under fatigue. |
| 11 | **Core, dynamic** | Moving through the trunk. |
| 12 | **Core, static** | Holding a position. Different quality, different test. |

Balance: three lower, two push, two pull, one explosive, one carry, one full
body, two core.

---

## The ladders

Read each row left to right. **We ask the first one they have the kit for.**
Bold is what a full gym gets; the last column is what someone with a bare
floor gets, and there is always something there.

| Slot | Barbell + rack | Dumbbell / kettlebell | Bar, rings or dip bars | Nothing but a floor |
|---|---|---|---|---|
| Squat | **Back squat** | Goblet squat | — | Bodyweight squat |
| Hinge | **Deadlift** | Dumbbell RDL | — | Single-leg RDL |
| Single leg | — | **Split squat, loaded** | — | Bulgarian split squat |
| Horizontal push | **Bench press** | Dumbbell floor press | Dips | Push-up |
| Vertical push | **Overhead press** | Dumbbell overhead press | — | Pike push-up |
| Horizontal pull | **Bent-over row** | Single-arm row | Inverted row | Table row |
| Vertical pull | — | — | **Pull-up** | Towel door row |
| Explosive | — | **Kettlebell swing** | — | Jump squat |
| Carry / grip | — | **Farmer carry** | Dead hang | Loaded backpack carry |
| Full body | — | — | — | **Burpee** |
| Core, dynamic | — | — | **Hanging knee raise** | Lying leg raise |
| Core, static | — | — | — | **Plank** |

Worked examples:

- **Bare floor.** Bodyweight squat, single-leg RDL, Bulgarian split squat,
  push-up, pike push-up, table row, towel door row, jump squat, backpack
  carry, burpee, lying leg raise, plank. Twelve. No holes, nothing they cannot
  do, and not one question that reads as *you are weak* when it means *you
  have no bar*.
- **Pull-up bar and two dumbbells** — the setup the old version handled worst.
  Goblet squat, dumbbell RDL, loaded split squat, dumbbell floor press, pike
  push-up (no bench-press-grade option, so vertical push stays bodyweight),
  single-arm row, **pull-up**, kettlebell swing or jump squat, farmer carry,
  burpee, **hanging knee raise**, plank. Every piece of kit they own is used.
- **Full gym.** Back squat, deadlift, loaded split squat, bench press,
  overhead press, bent-over row, pull-up, kettlebell swing, farmer carry,
  burpee, hanging knee raise, plank.

The recommendation for someone with nothing still appears, once, at the end of
the chapter — as a note, not a barrier:

> Two things would open up most of what is missing from your setup: **a
> doorway pull-up bar** and **something solid to dip between** — parallettes,
> or the corner of a kitchen counter. Neither is expensive. Nothing in your
> programme will depend on them until you have them.

---

## What I dropped, and why

**Mountain climber** and **wall sit** were in the bodyweight deck. Both are
gone. Neither tells us anything the other eleven do not, and both were there
to fill a slot rather than answer a question.

**Power clean** is not in the explosive ladder even for a full gym. It is the
best answer on paper and the wrong one here — most people asked will have
never done one, so the card measures coaching history, not power. Kettlebell
swing and jump squat measure the same quality and everyone can attempt them.

**Dead hang** dropped from a slot of its own to the second rung of carry/grip.
Same quality as farmer carry, and now it only appears for someone who has a
bar but no weight — which is exactly who it is the right question for.

---

## Two decisions I need from you

**1 — Are the twelve slots right?**
That list is your foundational movements. If you would swap one, swap it now:
everything downstream — the ladders, the artwork, the benchmarks and the
programme's own vocabulary — hangs off it.

**2 — Are the ladders right?**
Especially: is a **goblet squat** the right stand-in for a back squat, and is
a **towel door row** honest enough to ask about, or would you rather vertical
pull just be blank for someone with nothing?

---

## Stop before you finish the benchmark file

**This changes which rows matter, so finishing the CSVs first would waste your
time.** Thirteen movements in the ladders have no benchmark row yet:

goblet squat · dumbbell RDL · dumbbell floor press · dumbbell overhead press ·
single-arm row · dips · table row · towel door row · burpee · hanging knee
raise · lying leg raise · backpack carry · loaded split squat

And these have rows that the new model no longer asks about: mountain
climber, wall sit, hip thrust, power clean.

Mark the two decisions above and I will (a) wire the ladders, and (b) draft
all thirteen rows the same way as the last sixteen — researched, marked
`DRAFT`, for you to correct. Then the CSV is one pass instead of two.

---

## Artwork this needs

Unchanged from before except for the drops. Fourteen pictures:

| Movement | Save as |
|---|---|
| Dips | `dips.png` |
| Burpee | `burpee.png` |
| Hanging knee raise | `hanging-knee-raise.png` |
| Table row | `table-row.png` |
| Towel door row | `towel-row.png` |
| Lying leg raise | `lying-leg-raise.png` |
| Loaded backpack carry | `backpack-carry.png` |
| Goblet squat | `goblet-squat.png` |
| Dumbbell RDL | `dumbbell-rdl.png` |
| Dumbbell floor press | `dumbbell-floor-press.png` |
| Dumbbell overhead press | `dumbbell-overhead-press.png` |
| Single-arm dumbbell row | `single-arm-dumbbell-row.png` |
| Deadlift | `deadlift.png` |
| Hip thrust | ~~not needed any more~~ |

**Six of these are the bare-floor rungs** (table row, towel row, lying leg
raise, backpack carry, burpee, dips). If you would rather not draw them yet,
say so — those cards fall back to the drawn stick figure. It still works, it
just looks plainer, and it only looks plainer for the people with no kit,
which is the wrong way round. Worth drawing when you get a chance.
