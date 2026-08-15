# The deck — audit, and what I would rebuild

You said this is a big one. It is, and the audit says it is bigger than the
weight input.

---

## The audit — every card, what it asks today

I ran this against the live ladder rather than reading the code, so this is
what a person actually gets.

### Wrong ask

| Card | Asks now | Should ask |
|---|---|---|
| **Farmer carry** | Weight, then reps | **Weight, then distance or time.** Nobody has ever done "8 reps" of a carry. You were right. |
| **Dead hang** | Seconds | Correct — but it is in the carry slot, so it should sit beside the carry's *time*, not its reps |
| **Back squat, deadlift, bench, OHP, row** | A slider, 0 kg → max, **2.5 kg a step** | Plates on a bar. A deadlift slider is **94 drags of a thumb** end to end |
| **Goblet, DB RDL, DB press, DB OHP, single-arm row** | Same 2.5 kg slider | A dumbbell rack. They come in fixed sizes; 17.5 kg is not a dumbbell |
| **Kettlebell swing** | Same 2.5 kg slider | Bells come in 8 / 12 / 16 / 20 / 24 / 28 / 32. Nothing between |
| **Split squat, loaded** | Weight + reps | Right shape, but the weight is a pair of dumbbells — same rack problem |

### No slider at all

**Ten of the thirty rungs fall back to coarse bands** because they have no
benchmark row. The person gets "1–5 / 6–12 / 12+" instead of a number and a
standard:

goblet squat · dumbbell RDL · dumbbell press · dumbbell overhead press ·
single-arm row · table row · towel door row · backpack carry · hanging knee
raise · lying leg raise

**Every one of them is a home-kit or bare-floor rung.** So the person with a
full gym gets the good version of this screen and the person with dumbbells
gets the cheap one — the same wrong-way-round I flagged on the artwork.

### Correct as they stand

Push-up, pull-up, dips, inverted row, pike push-up, bodyweight squat,
single-leg RDL, Bulgarian split squat, jump squat, burpee, plank. Reps or
seconds, sensible ranges, benchmarks behind them.

---

## What I would build for weight

### The barbell — load it

Not a slider. A bar, and you tap plates onto it.

```
        ▓▓▓▓ ▓▓ ▓                 ▓ ▓▓ ▓▓▓▓
   ═════════════════════════════════════════════
                    60 kg
        [ 1.25 ] [ 2.5 ] [ 5 ] [ 10 ] [ 15 ] [ 20 ]     ← tap to add
```

- Starts at **the bar: 20 kg** (45 lb), because that is where everyone starts
- Tap a plate, it appears on **both sides** and the total updates
- Tap a plate on the bar to take it off
- The plates are the real ones: **1.25 / 2.5 / 5 / 10 / 15 / 20 kg**, or
  **2.5 / 5 / 10 / 25 / 35 / 45 lb**

**Why this is better than a slider, beyond looking good:** it is how the
person already thinks. Nobody knows they squat 82.5 kg; they know they put
three plates a side on. The input matches the memory.

**This needs your renderings.** Plate widths and colours by weight would make
it read instantly — the standard colour code is red 25, blue 20, yellow 15,
green 10, white 5. If your renders follow that, the bar becomes readable at a
glance with no numbers at all.

### Dumbbells and kettlebells — a rack, not a scale

A horizontal row you flick through, stopping on real sizes only.

- **Dumbbells:** 2, 4, 6, 8, 10, 12, 14, 16, 20, 22.5, 25, 30, 35, 40, 45, 50
- **Kettlebells:** 8, 12, 16, 20, 24, 28, 32, 40

One question underneath, which the current version never asks: **one or two?**
A 20 kg goblet squat and 2 × 20 kg split squats are different answers.

### Carries — weight, then how far

Weight from the same rack, then a second row: **20 m · 40 m · 100 m · until
my grip goes.** The last one is the honest answer for most people and it is a
real data point.

---

## The harder problem — the one you actually raised

> *"I have the bench and the barbell but I would rather do push-ups, because
> I am more of a calisthenics guy."*

**The ladder is answering the wrong question.** It ranks rungs by signal
quality and assumes the best-equipped answer is the best answer. For you it is
not — you would rather be measured on the movement you actually train.

Three ways to fix it. I have a preference.

### A — ask the preference first, once

Two or three cards before the deck starts:

> **When you train, what does it usually look like?**
> · Barbells and dumbbells · Bodyweight and bars · A bit of both · Machines

That answer re-orders every ladder for the rest of the deck. One question,
twelve cards fixed, and it is a genuinely useful thing to know for programming
anyway — it belongs in the profile whether or not the deck uses it.

### B — offer two per card

> *Which do you know better?* **Bench press** or **Push-up**

Honest and specific, but it is twelve extra decisions on the longest screen in
the survey, and it asks the same underlying question twelve times.

### C — both, cheaply

**A on its own screen, and a small "rather answer about X?" under the card
where it is close.** The preference sets the default; the card lets them
override without turning every card into a fork.

**I would do C.** A is doing the real work — twelve overrides is a worse
survey than one question. But there will always be one card where the default
is wrong, and a quiet swap is much cheaper than a second choice printed on all
twelve.

**Where I would not offer a choice:** pull-up versus table row. That is a
difference in capability, not preference, and letting someone opt down would
corrupt the assessment. The swap only appears where both rungs measure the
same thing.

### On the first three cards setting the level

You suggested it, and I think **half of it is right.** Preference — yes,
before the deck. Level — no: the twelve cards *are* the level assessment, and
asking someone to self-rate before we measure gets the anchoring backwards.
The sliders already place them against a standard. Let the movements answer.

---

## Order I would do it in

1. **The preference question** — one screen, no artwork, fixes the biggest
   complaint. Can ship immediately.
2. **Farmer carry to weight + distance** — small, and it is plainly wrong today.
3. **The dumbbell and kettlebell racks** — no artwork needed, real sizes only.
4. **The plate loader** — the best-looking piece, and the one that wants your
   renderings.
5. **The ten missing benchmark rows** — otherwise a third of the deck keeps
   giving the cheap version to the people with the least kit.

---

## What I need from you

1. **A, B or C on the preference problem.** I recommend **C**.
2. **The plate renderings** — and whether they follow the standard colour code.
3. **kg or lb plate sets** — do you want both, or does the unit they picked in
   Chapter 1 decide it? (I would let the unit decide, and keep the bar at 20 kg
   / 45 lb accordingly.)
4. **The ten benchmark rows.** Say go and I will draft them as `DRAFT` the same
   way as the last batch.

---

## Fixed already, in this pass

- **A card can be gone back to.** Back used to walk out of the whole chapter
  and restart the sequence — twelve cards sit behind one screen and the button
  did not know. It now steps back a card and clears that answer.
