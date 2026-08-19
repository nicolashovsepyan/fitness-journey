# tools/ — the scripts that build things

**Not for you.** You never run any of these. They are how I turn something
you changed into something the app can use.

The pattern throughout: **you edit a source, I run a tool, the tool rewrites
part of a page.** That is why you can change one CSV and the survey's sliders
change, without either of us hand-editing a 1 MB file.

| Script | Takes | And rewrites |
|---|---|---|
| `build-spine.mjs` | the movement database | `spine/*.json` — the shared description everything reads |
| `build-app-data.mjs` | `spine/catalog.json` | the movement block inside `dashboard.html` |
| `build-benchmarks.mjs` | your `BENCHMARKS - *.csv` | the level thresholds inside `onboarding.html` |
| `build-avatars.mjs` | your body-shape artwork | the body pictures inside `onboarding.html` |
| `build-deck-art.mjs` | your exercise artwork | the exercise cards inside `onboarding.html` |
| `build-exercise-images.mjs` | your exercise artwork | `images/exercises/` **and** `FOR NICOLAS/IMAGES TO MAKE.md` |
| `build-logo.mjs` | `logo/mark.mjs` | the logo everywhere — the survey, the icons, the stamps |
| `build-equipment.mjs` | `logo/equipment.mjs` | the weight gauge in every page that draws one |
| `build-classifier.mjs` | the database | `FOR NICOLAS/EXERCISE CLASSIFIER.html` |
| `export-program.mjs` | `dashboard.html` | `spine/program.default.json` |

`audit-*.mjs` and `fix-progression-links.mjs` check for problems rather than
build anything. They print; they change nothing unless told to.

`build-logo.mjs` and `build-equipment.mjs` take `--check`: they report whether
everything still agrees, and change nothing. That is the first thing to run
if anything ever looks wrong.
