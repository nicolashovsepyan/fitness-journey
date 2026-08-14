# The deck — audit

> *"I filled up that I have a home gym but I removed barbell from equipment
> and I got option of squat with barbell."*

**Reproduced exactly, and it is worse than one wrong card.**

---

## The root cause, in one line

**The deck never reads the equipment answer. At all.**

```js
function deckSet(){ return hasLoad() ? GYM_DECK : BODY_DECK; }
function hasLoad(){ const w = A.where || [];
  return w.includes('gym') || w.includes('homekit') || w.includes('hotel'); }
```

That is the whole decision. Tick **"Home, some equipment"** and you get the
full barbell deck — back squat, deadlift, bench press, overhead press, hip
thrust — no matter what you actually own. The fifteen-item equipment screen
you fill in on the previous page is collected, stored, and never looked at.

I ran your exact case: home kit, dumbbells + kettlebell + pull-up bar + bench,
**no barbell**. The deck returned:

> Back squat · Deadlift · Romanian deadlift · Bench press · Overhead press ·
> Row · Pull-up · Split squat · Hip thrust · Farmer carry · Plank · Kettlebell swing

**Five of twelve need a barbell you told us you do not have.** Your dumbbells
were never asked about.

---

## Why the stick figures are still there

Separate problem, same screen. The card falls back to a drawn figure when
there is no artwork for that deck id. Two of the twelve gym movements had none
— deadlift and hip thrust — and both now do, as of this week's image pass.

**Still missing: Romanian deadlift.** The conventional deadlift render is a
different movement and using it would be teaching the wrong thing, so that one
card stays a drawn figure until the artwork exists.

Anything on the bodyweight deck that had no picture is now covered.

---

## What the fix is

**It is the ladder.** Not a patch — the thing already written up in
`EXERCISE DECKS.md` and confirmed by you ("12 slots are pretty good").

Twelve fixed slots. Each slot has a chain of movements ordered by signal
quality. We ask **the highest rung the person actually has the kit for**, and
your case resolves to:

> Goblet squat · Dumbbell RDL · Loaded split squat · Dumbbell floor press ·
> Pike push-up · Single-arm row · **Pull-up** · Kettlebell swing ·
> Farmer carry · Burpee · **Hanging knee raise** · Plank

Every piece of kit used. Nothing asked about that they do not own.

Your later note adds a second axis — **level as well as equipment**, so a
bare-floor advanced athlete is asked about a handstand push-up rather than a
pike push-up. That is right and it is the same mechanism, one dimension wider.

---

## What is still missing before it can be wired

Being straight with you, because you asked.

### 1. The database cannot serve the ladder yet

| Slot | Problem |
|---|---|
| **Single leg** | **4 movements in the whole database.** No pistol squat, no shrimp squat, no step-up, no reverse lunge. Your own archive puts pistol squat and lunges in S-tier. |
| Squat | 13 movements — thin for the most-used pattern there is. |
| Explosive | 7. No sprint, which your archive calls the #1 bodyweight leg exercise. |
| Carry / grip | 9, mostly holds. |
| Aerobic | 10, and none of them is a structured Zone 2 or interval prescription. |

Against 64 horizontal push and 38 vertical pull. **The upper body is curated;
the legs and the conditioning are not.** No amount of classifying fixes this —
those movements have to be added.

### 2. Twelve movements have no benchmark row

Without one, that card's slider has nothing to tell the person, which is the
entire point of the slider:

goblet squat · dumbbell RDL · dumbbell floor press · dumbbell overhead press ·
single-arm row · dips · table row · towel door row · burpee · hanging knee
raise · lying leg raise · backpack carry

### 3. Six movements have no artwork

table row · towel door row · lying leg raise · backpack carry · goblet squat ·
the four dumbbell movements

**All six are the bare-floor and dumbbell rungs** — so the people with the
least kit get the plainest cards, which is exactly the wrong way round.

### 4. Power clean and clean-to-press are drawn but unusable

You asked for both in the full-body ladder. **The artwork exists**, sitting in
the library. There is no such exercise in the database, so nothing can
reference it. One line each to add — say the word.

---

## The order I would do it in

1. **You finish a pass in the classifier** — mainly the families and levels.
   That is what tells the ladder which movement is which rung.
2. **I add the missing lower-body and conditioning movements** — pistol,
   shrimp, step-up, reverse lunge, sprint, Zone 2, intervals, power clean,
   clean-to-press. Maybe 20 entries, built from your archive's own tier lists.
3. **I wire the ladder** on both axes and the deck stops lying.
4. **We draft the twelve benchmark rows** together — I research, you correct.
5. **Artwork last**, because the deck works without it and only looks plainer.

**Steps 1 and 2 can run at the same time.** Say go and I will start on 2 while
you work through the classifier.
