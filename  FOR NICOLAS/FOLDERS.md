# The folders, explained

You said the folders were confusing and the titles did not help. You were
right. This is what everything is, what I changed, and the two things still
waiting on you.

---

## 1. There were three folders called "Fitness Journey". Only one is real.

| Folder | What it actually is |
|---|---|
| **`COWORK/Fitness Journey - 2.0`** | **THE APP.** This is the real one. Everything you use is in here, and it is what publishes to your web address. |
| `COWORK/Fitness Journey` | Your **original** project from spring — the WOD editor, the big Excel system, the benchmark spreadsheets, 240 saved prompts. Finished with, but 360 of its 372 files exist nowhere else, so it is not going anywhere. |
| `Dropbox (2026-04-04 10:30)/…/Fitness Journey` | An **old copy of the app**, from a backup version of your whole Dropbox. Only 5 files in it are unique. **This is the one your Claude sessions have been opening into** — which is why you kept opening "Fitness Journey" and not finding the app. |

**What I am doing:** renaming the two old ones so this can never happen again.

- `Fitness Journey` → `Fitness Journey (OLD - v1 spring 2026)`
- the backup one → `Fitness Journey (OLD - backup copy, do not use)`

Nothing is deleted. Nothing moves. Both folders keep every file they have.

The five things that exist ONLY in the backup copy, in case you want them:
`VIDEO-TODO.md`, `Yates_HIT_Hybrid_Protocol.md`, `MEMORY.md`, `devserver.py`,
and `images/ART-SOURCING-BRIEF.md`. Say the word and I pull any of them across.

---

## 2. "The console" is `coach.html`

You said you did not know what I meant by the console or where it was. It is a
file called `coach.html`, sitting in the app folder. Double-click it, or open
your web address and add `/coach.html` on the end.

There are four pages a human ever opens, and now they are the only four things
at the top of the folder that look like pages:

| Double-click this | and you get |
|---|---|
| `onboarding.html` | **the survey** — what a new client fills in |
| `index.html` | **the app** — what a client installs on their phone |
| `dashboard.html` | **the client's app** — their week and their sessions |
| `coach.html` | **the console** — where you write and release programmes |

Two more you open directly when you need them:

- `profile.html` — when a client emails you their finished survey, the link
  they send opens this page. It shows you their answers.
- `library.html` — browse every exercise with its picture.

---

## 3. The top level used to mix four unrelated things. Now it doesn't.

It was one flat list containing: pages you open, notes you read, files a
script had spat out, the app's own machinery, and half a dozen dead
experiments. Nothing said which was which.

**What I moved.** Seven things that nothing in the app links to, nothing
loads, and nothing would miss, are now in a folder called `ARCHIVE/`, with a
page in there saying what each one was:

`feed.html` · `hero.html` · `preview.html` · `mark-compare.html` ·
`onboarding.v5.bak` · `hero-torso.png` · `hero-torso.webp`

They were prototypes and comparisons — "the feed, as a test", "the opening
screen drawn four ways so you could pick one", "these two dumbbells, which is
better". Real work, finished with. Nothing is deleted; if you want one back it
is one command.

**What I did not move.** Everything else. Every page, every image, every file
the app reads by name, is exactly where it was. That was the rule you set and
I have not broken it.

**What I added.** A README inside every single folder. One page, plain
English, first line says whether the folder is yours or mine. Open any folder
you are unsure about and the answer is sitting right there.

---

## 4. The distinction you asked for: **written** vs **generated**

This is the one that was genuinely missing. Some files are *written* — by you
or by me. Others are *output*: a script produced them from something else. If
you edit an output file by hand, your change works until the next time that
script runs, and then it silently disappears. That is a horrible way to lose
an afternoon.

**Yours. Written by you. Nothing overwrites these.**

- `FOR NICOLAS/` — the benchmarks CSVs, the classifier, the fundamentals
- `EXERCISE LIBRARY/` — your artwork, dropped in at full size
- `EXERCISE DATABASE/` — the spreadsheet you work in

**Output. Do not edit by hand.** Each one now says so at the top of its folder:

| This | comes from | via |
|---|---|---|
| the app icons, the stamps, the logo in the survey | `logo/mark.mjs` | `build-logo.mjs` |
| the weight gauge on every page | `logo/equipment.mjs` | `build-equipment.mjs` |
| `images/exercises/`, `images/avatars/` | your artwork | `build-exercise-images.mjs`, `build-avatars.mjs` |
| everything in `spine/` | the movement database | `build-spine.mjs` |
| the survey's level thresholds | your benchmark CSVs | `build-benchmarks.mjs` |
| `FOR NICOLAS/IMAGES TO MAKE.md` | your artwork folder | `build-exercise-images.mjs` |

So: **you change a source, you tell me, I run one command.** You never run
anything. That has not changed — it is just written down now.

---

## 5. One thing that was quietly costing your clients

The app downloads a set of files onto a client's phone the first time they open
it, so a workout survives a gym with no signal. That list was built from
"everything in the project", so it included the dead experiments — and 111
stale copies of files that already existed, sitting in the `site/` folder.

**217 files before. 102 now.** Same app, less than half the download. Nothing
was removed that the app actually uses; I checked every page, the code folder,
the spine and the logo are all still in the list.

---

## 6. Still waiting on you

### `site/` — do you use the Netlify address?

There is a second copy of the app in a folder called `site/`. It was set up to
publish to **Netlify** — a different hosting service from the one your real
app uses. It has not been updated since 17 August, it is missing large parts of
the app, and it very likely does not work any more.

I have left it completely alone.

- **If you never use that address:** say so, and the whole folder goes to
  `ARCHIVE/`.
- **If you do use it:** say so, and I will bring it back in step and set it up
  so it stays that way.

### `images/` — the big old artwork

At the top of `images/` there are about fifteen full-size pictures from the
early days — `day-strength.png`, `conditioning.png`, `dips.png` and so on, two
to three megabytes each. Nothing in the app uses them any more; it uses the
shrunk versions in `images/exercises/`.

I have not touched them. Say the word and they go to `ARCHIVE/`.

---

## What you need to do

Two answers, whenever you get to them:

1. **Do you use the Netlify address?** (yes / no / no idea)
2. **Can the big old pictures at the top of `images/` be archived?** (yes / no)

That is all. Nothing else needs you, and nothing is waiting on you to work.
