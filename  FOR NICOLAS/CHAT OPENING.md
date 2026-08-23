# The chat opening — v2

Still nothing built. This is the script.

Niko's bubbles land on the left, one at a time. Your answers land on the right.
**TYPE** = keyboard · **TAP** = one tap, no Continue · **DIAL** = the scroller
from the exercise cards, inside the thread.

---

### 1 · Hello
> What's up — I'm Coach Niko.
>
> Welcome to your Fitness Journey. This is your app now, not mine.
>
> What should I call you?

**TYPE** → `name`

---

### 2 · Age
> Good to meet you, {name}. How old are you?

**TYPE** (number pad) → `age`

---

### 3 · Gender
> Man or woman? Strength standards differ — this keeps your numbers honest.

**TAP** — Man · Woman · Rather not say → `sex`

---

### 4 · Height and weight
> Two quick ones. How tall are you?

**DIAL** → `heightCm` — swaps **ft/in ↔ cm**

> And roughly what do you weigh?

**DIAL** → `weightKg` — swaps **lb ↔ kg**

---

### 5 · Why now
> So — what made you open this today?

**TAP one** → `driver`

- I've let it slide. Time to get back
- I train already — I need a real program
- I want to lose weight
- I want to get stronger

*Under the options, small:* **or say it your own way** → text box

---

### 6 · How long
> How long have you been at it, on and off?

**TAP** → `trained`

- Just starting
- Under a year
- A few years
- Ten years or more

---

### 7 · What their training looks like
> And when you train, what does it look like?

**TAP** → `style` *(new — nothing like it exists today)*

- Weights, sets and reps
- Classes or HIIT
- CrossFit
- Calisthenics
- Functional, mixed
- Running or cycling

---

### 8 · Days a week
> How many days a week can you actually give me? Realistic beats ambitious.

**TAP** → `days` — 2 · 3 · 4 · 5+

---

### 9 · Anything hurt
> Last one. Anything hurt? Bad knee, cranky shoulder, anything.

**TAP one** → `painNote`

- Nothing right now
- Yeah — let me tell you → text box

*Not the medical form. That comes later. This is the honest version.*

---

### 10 · Into the next part
> That's you. Now let's see what you've got to work with.

**Continue** → the visual section: body shape, where you train, your kit.

---

## What changed from v1

- Cut "Two minutes of questions and then we get to the good part"
- Gender question cut to one line
- **Cut "how active are you right now" entirely** — see the warning below
- Why-now trimmed to 4 answers, and now covers the two you named:
  someone who already trains and needs a real program, and someone
  getting back on track
- Everything shortened and loosened
- Hand-off is one line

## Spelling

"programme" was British. Fixed in the 5 places a client reads it, plus
"metres" → "meters". Code comments left alone — nobody reads those.

## ⚠ One consequence of cutting "how active"

`activity` is the **only** thing that currently sets how far the sliders reach
on the exercise cards — how good an answer someone is allowed to claim. Cut it
and something has to take over. That is fine, and arguably better: **how long
they've trained** (Q6) plus what the deck actually measures is a truer read
than a self-rating. But it has to be rewired, not just deleted.

## Still open

1. Six training styles in Q7 — right list?
2. "Rather not say" on gender — keep? It costs fair benchmarks.
