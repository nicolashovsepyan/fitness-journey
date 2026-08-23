# The chat opening, v3

Still nothing built. This is the script.

Niko's bubbles land on the left, one at a time. Answers land on the right.
**TYPE** is a keyboard. **TAP** is one tap, no Continue. **DIAL** is the
scroller from the exercise cards, inside the thread.

House rules now in force: no long dashes anywhere a client reads, numerals
instead of written numbers, and a "write your own" option is always the same
size as the buttons next to it.

---

### 1. Hello
> What's up, I'm Coach Niko.
>
> Welcome to your Fitness Journey. This is your app now, not mine.
>
> What should I call you?

**TYPE** to `name`

---

### 2. Age
> Good to meet you, {name}. How old are you?

**TYPE**, number pad, to `age`

---

### 3. Gender
> Man or woman? Strength standards differ, so this keeps your numbers honest.

**TAP**: Man / Woman, to `sex`

---

### 4. Height and weight
> 2 quick ones. How tall are you?

**DIAL** to `heightCm`, swaps ft/in and cm

> And roughly what do you weigh?

**DIAL** to `weightKg`, swaps lb and kg

---

### 5. Why now
> So, what made you open this today?

**TAP one**, to `driver`

1. I've let it slide. Time to get back on track
2. I'm active, but stuck. I need help past this plateau
3. I want to lose weight
4. I want to get stronger

Then, full width and the same size as the 4 above:

5. **Say it your own way**, which opens a text box

---

### 6. How long
> How long have you been at it, on and off?

**TAP** to `trained`

1. Just starting
2. Under 1 year
3. 1 to 5 years
4. 5 years or more

---

### 7. What their training looks like
> And when you train, what does it look like?

**TAP** to `style`. This is a new answer, nothing like it exists today.

1. Weights, sets and reps
2. Classes or HIIT
3. CrossFit
4. Calisthenics
5. Functional, mixed
6. Running or cycling

---

### 8. Days a week
> How many days a week can you actually give me? Realistic beats ambitious.

**TAP** to `days`: 2 / 3 / 4 / 5+

---

### 9. Anything hurt
> Last one. Anything hurt? Bad knee, cranky shoulder, anything.

**TAP one**, to `painNote`. Both buttons the same size.

1. Nothing right now
2. **Yeah, let me tell you**, which opens a text box

This is not the medical form. That comes later. This is the honest version.

---

### 10. Into the next part
> That's you. Now let's see what you've got to work with.

**Continue** to the visual section: body shape, where you train, your kit.

---

## Changed in v3

1. "Rather not say" removed from gender.
2. Q5 second option reworked. "I train, I need a program" is gone. It now
   reads "I'm active, but stuck. I need help past this plateau", which is the
   person who already trains hard and wants a way through, not a beginner
   looking for structure.
3. Every text option is now full width, the same size as the buttons beside it.
4. No long dashes anywhere in this script.
5. Numerals throughout: "2 quick ones", "Under 1 year", "5 years or more".
6. 6 training styles confirmed.

## The dash cleanup is its own job

The rule is easy. Applying it to what is already written is not:

| File | Long dashes a client reads |
|---|---|
| dashboard.html | about 96 |
| onboarding.html | about 56 |

That is roughly 150 sentences, and each needs a decision: comma, period,
colon, or a rewrite. A blind find and replace produces sentences that limp.
Worth one deliberate pass rather than folding it into a feature.

Code comments are left alone. No client reads them, and rewriting 450 of them
would bury every real change in noise.

## Still true from v2

"How active are you right now" is cut, and that answer is currently the only
thing setting how far the sliders reach on the exercise cards. Something has
to take over: Q6, plus what the deck actually measures. It needs rewiring,
not just deleting.
