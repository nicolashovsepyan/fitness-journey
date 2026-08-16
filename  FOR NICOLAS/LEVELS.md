# Levels — what they read today, and what they should

You asked for levels to consider every aspect and to sit only on curated
exercises. Half of that is now true, and I want to be exact about which half.

---

## What happens today

A level appears on a card **only when that movement has a benchmark row in
your CSVs**. That is already the curated set — ten of the deck's thirty rungs
have no row and correctly show no verdict.

**So "only on curated exercises" is done.** Nothing invents a level.

---

## What is wrong with the level itself

**It reads the weight and nothing else.**

```
225 lb for 1 rep      ->  same tier
225 lb for 8 reps     ->  same tier
```

Those are not the same athlete. One is a max, the other is roughly a 275
max. The tier we print is the same for both, and that is not a rounding
error — it is most of the signal thrown away.

The same hole exists on the other measures: 60 seconds of plank at
bodyweight and 60 seconds with a 20 kg vest read identically.

---

## What a level should read

Three inputs, not one:

| | |
|---|---|
| **Load** | what was lifted |
| **Volume** | for how many reps, or how long |
| **Bodyweight** | already handled — the CSVs store xBW, which is right |

The standard way to fold reps into load is an estimated one-rep max. Epley
and Brzycki are the two everyone uses, they agree closely under about 10
reps, and they diverge badly above it — which matters, because "12+" is one
of our own options.

**This needs deciding rather than guessing**, and it is a coaching decision
more than a coding one:

1. **Which formula**, and what we do above 10 reps where they stop agreeing.
2. **Do holds convert at all?** A 90-second plank and a 40 kg farmer carry
   are both "level" evidence but there is no accepted arithmetic between them.
3. **Do the CSV thresholds stay as 1RM equivalents**, or do they gain a rep
   column? The first is less work; the second is more honest.
4. **Does an unconverted card still count** toward the overall tier, or only
   toward its own?

---

## What I would do

Convert to an estimated 1RM with Epley, cap the conversion at 10 reps, and
compare that against the existing thresholds. Above 10 reps, stop converting
and treat the answer as muscular endurance rather than strength — because
that is what it is, and a formula that pretends otherwise will flatter
someone into a tier they cannot hold.

Holds and carries keep their own scale and do not convert.

**Say yes, or tell me where you disagree, and it is one pass.** It is not
built yet, and the comment in the code says so where the next person will
read it.

---

## Also outstanding, and it blocks the honest version

**Ten of the deck's rungs still have no benchmark row**, so ten movements can
never show a level however good the maths gets:

goblet squat · dumbbell RDL · dumbbell press · dumbbell overhead press ·
single-arm row · table row · towel door row · backpack carry · hanging knee
raise · lying leg raise

They are all home-kit or bare-floor rungs. Say go and I will draft them as
`DRAFT` for you to correct, the same way as the last batch.
