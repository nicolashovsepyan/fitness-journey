# For Nicolas

**This folder is yours.** Everything in here is something you fill in, correct
or decide. Nothing else in the project needs you to open it.

Everywhere else — `js/`, `tools/`, `docs/`, `test/` — is the app itself and my
working notes. You never have to go in there.

When you change a file here, tell me and I pull it into the app. It is one
command each time; you never run anything.

---

## What is in here

### `BENCHMARKS - Male.csv` · `BENCHMARKS - Female.csv`

The level thresholds for every exercise: Beginner, Intermediate, Advanced,
Elite. **These decide what the sliders in the survey say about someone.**

The last 16 rows of each file are marked `DRAFT` — those are the ones I added
and you have not checked yet. Adjust any number you disagree with, then change
`DRAFT` to `APPROVED`.

Three kinds of measurement, in the `Mech` column:

| Mech | Unit | Means |
|---|---|---|
| `REPS` | reps | how many in one set |
| `HOLD` | secs | how long |
| `WEIGHT` | `xBW` | **a multiple of their bodyweight** — `1.5` means 1.5× what they weigh |

`xBW` is how strength standards work; it is the only way one number fits a
60 kg person and a 100 kg person. The survey converts it to real kilos using
the weight they gave.

Backups of the originals are in the old `_system` folder, untouched.

### `IMAGES TO MAKE.md`

Every exercise still waiting on artwork, most useful first, with the exact
filename to save each one as. Drop finished images in `EXERCISE LIBRARY/`.

### `EXERCISE DECKS.md`

The twelve movements the survey asks about, for each kind of setup —
bodyweight, home kit, full gym. Change anything you disagree with.

---

## How to change something

1. Open the file and edit it. They are plain text and spreadsheets.
2. Tell me what you changed.
3. I pull it in and tell you when it is live.

If a file here ever looks wrong or out of date, say so — it means I generated
it and did not tell you.
