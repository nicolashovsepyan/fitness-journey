# Survey wiring audit — what every answer actually does

You asked whether the answers are connected to what we give back. I traced
every answer the survey writes and every place anything reads it, in code
rather than by eye.

**The short version: they are mostly not connected.** Two questions go
nowhere at all, three only reach your console, and the one thing you would
expect to be driven by everything — the person's level — is driven by a single
answer.

---

## 1 · Two questions are pure dead ends

Written down, never read. Not by the survey, not by the deck, not by your
coach console. **Nobody has ever seen these answers.**

| Question | Screen | Reads |
|---|---|---|
| **"How long have you trained?"** | 11 | **0** |
| **"Could you jog for 20 minutes?"** | 18 | **0** |

Training age is the one you named yourself, and you were right to be
suspicious. It is also the single most useful thing we ask that we do not use:
a person with a 20-rep push-up and six months behind them, and one with the
same 20 reps and ten years, need different programmes and we currently cannot
tell them apart.

The aerobic question was added specifically because Galpin's framework has
nine adaptations and the deck measures none of the two endurance ones. It is
still true that we needed to ask it. We just never plugged it in.

---

## 2 · Three more only reach you, never the app

Read by `coach.html`, read by nothing in the survey itself.

| Question | Screen | Consequence |
|---|---|---|
| **Body shape** | 12 | Does not change a single card, band, or word |
| **Health flags (PAR-Q)** | 29 | Does not gate a single exercise |
| **Sleep** | 31 | Does not cap volume, though that is the whole reason it is asked |

Sleep is the one that matters. It is in there as the stand-in for HRV, and its
stated job is to decide how much hard work a week can hold. **The reactor's
recovery rod does that job now instead**, and the sleep question is a second,
unconnected answer to the same thing. That is a real duplication and one of
them should go — I would keep the rod and drop the question, since the rod is
answered in hours and the question in bands.

**PAR-Q not gating anything is the one I would call risk, not just waste.**
Somebody can tick "a joint problem that could get worse" and still be handed
the same deck and the same programme as everyone else. Today a human catches
it because you read every profile. The moment the app builds anything by
itself, that stops being true.

---

## 3 · Level is decided by one answer

This is the heart of what you are asking about.

```
defaultCap()  →  reads A.activity        and nothing else
deckSet()     →  reads equipment          and nothing else
```

`defaultCap` is the gate that decides how far the sliders reach — how good an
answer we let someone claim. It is driven **solely by "how active are you
right now"**. Not training age. Not what they can already do. Not the aerobic
answer.

And the deck picks its twelve movements **purely on what kit they own**.
Someone advanced on a bare floor is still asked about a pike push-up rather
than a handstand push-up, which I flagged when the ladder went in and which is
still open.

Meanwhile the survey **does** compute a real measured level — `A.tier` and
`A.levels`, averaged from where each slider landed against the benchmarks.
That is the good number. **Nothing in the survey reads it.** `A.levels` has
zero reads. It is computed, stored, and only your console ever sees it.

### What the outputs actually read

| Output | Reads |
|---|---|
| The insight card | age, focus, horizon, name |
| The pattern label ("Quietly Consistent") | blockers, driver |
| The slider ceiling | activity |
| The deck | equipment |
| The loader lines | blockers, days, deck, focus, name |
| The week proposal | rods, other activity, days, length |

**No output reads level, training age, aerobic base, body shape, sleep, or
health flags.** The pattern label — the most personal-feeling thing in the
survey — is built from two multiple-choice answers.

---

## 4 · The question that is missing, and it is the important one

> *"if user is intermediate or advanced, we need to find out what kind of
> trainings they do or like."*

**We never ask.** And it is the answer that would fix the problem you hit
yourself — owning a bench and a barbell but wanting to be measured on
push-ups.

The list, as far as I can find one worth using:

| Style | What it changes |
|---|---|
| **Calisthenics / bodyweight** | Bodyweight rungs win even when a barbell exists. Skills are goals, not accessories. |
| **Traditional strength / bodybuilding** | Barbell rungs win. Volume per muscle matters more than skill. |
| **CrossFit / functional** | Full-body and conditioning rungs weighted up. Olympic lifts become askable. |
| **HIIT / classes** | Conditioning-led. Strength introduced as the thing they are missing. |
| **Running / endurance** | Strength is support. The aerobic answer becomes the primary number. |
| **Sport-first** | Everything serves the sport. Their sport days are the fixed points. |
| **None of these / just starting** | The honest majority. Fundamentals, no vocabulary assumed. |

Two are worth flagging as ones you might be missing: **running/endurance**,
which is a huge population and currently has nowhere to land, and
**sport-first**, which we half-capture with "anything else in your week" but
never treat as an identity.

---

## 5 · What I would wire, in order

### a) Level becomes computed, from four inputs instead of one

```
level  =  measured    (A.tier, from the deck — the strongest signal)
       ·  training age (how long they have trained — currently dead)
       ·  activity     (how often they train now)
       ·  aerobic      (the endurance side — currently dead)
```

Measured leads, because it is the only one that is not self-reported. Training
age breaks the tie: same push-up number, six months versus ten years, different
programme. Activity says whether that level is current or historic. Aerobic
stops us calling someone advanced who cannot jog for twenty minutes.

**This revives both dead questions by giving them a job.**

### b) Style is asked once, before the deck, and routes everything

One screen, seven options, from the table above. It then decides:

- **which rung the ladder picks** when two are close in signal — your
  push-up-over-bench-press problem, solved once rather than twelve times
- **which fundamentals we lead with** out of the fifty
- **the language** of the insight and the pattern label

### c) The deck gains its level axis

Equipment × level, as designed. The classifier pass is what unblocks this —
it is the file that says which movement is which rung.

### d) The three orphans get a job or get cut

- **Sleep** — cut it. The recovery rod already asks it, in better units.
- **Body shape** — either it feeds the 90-day focus, or it is decoration. I
  would keep it: it is one of the few emotionally honest moments in the
  survey, and it belongs in the profile even if it changes nothing.
- **PAR-Q** — must gate exercises before anything is generated automatically.
  Not urgent while you read every profile; urgent the day you stop.

---

## 6 · The order I would do it in

1. **The style question** — one screen, no data work, and it fixes the biggest
   complaint you have raised twice.
2. **Level as a computed value** — revives training age and aerobic, and gives
   the deck's own measurement somewhere to go.
3. **Cut the sleep question** — one screen shorter, no loss.
4. **Deck level axis** — needs your classifier pass first.
5. **PAR-Q gating** — before anything auto-generates.

---

## What I need from you

1. **The style list** — is it right? What am I missing, and would you merge
   any of them? Seven is at the edge of too many for one screen.
2. **Sleep — cut or keep?** I say cut; the rod does it better.
3. **Body shape — keep as profile-only, or should it feed something?**
4. **Level formula** — once I build it, you should see the weights and argue
   with them. I will show it as a table you can edit rather than bury it in
   code.
