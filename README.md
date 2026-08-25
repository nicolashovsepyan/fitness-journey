# Fitness Journey

A phone-first training app. A client fills in a survey, that survey opens the
app as them, and the coach writes their programme from a console in a browser.

Live: **https://nicolashovsepyan.github.io/fitness-journey/**
Published straight from the top level of this folder — which is why nothing at
the top level can be renamed or moved without breaking a link somewhere.

If you are Nicolas and you want the plain-language version of this page, read
**`FOR NICOLAS/FOLDERS.md`**.

---

## The four pages a person opens

| Open this | and you get |
|---|---|
| **`onboarding.html`** | **the survey** — what a new client fills in. Ends by opening the app as them. |
| **`index.html`** | **the app** — what a client installs on their phone. Works out who they are and takes them to their dashboard. |
| **`dashboard.html`** | **the client's app** — their week, their programme, their sessions. |
| **`coach.html`** | **the console** — where Nicolas writes and releases programmes. This is "the console". |

Two more that exist and are opened directly, not linked from anywhere:

| | |
|---|---|
| `profile.html` | The coach's view of a finished survey. The survey mails a link to this page. |
| `library.html` | Browse every exercise with its picture. |

## Nicolas's folders — the only ones he opens

| | |
|---|---|
| `FOR NICOLAS/` | Everything he fills in, corrects or decides. Has its own README. |
| `EXERCISE LIBRARY/` | Where he drops finished artwork. |
| `EXERCISE DATABASE/` | The movement database and the spreadsheet he works in. Has its own README. |

Both of the first two have a space in front of the name on purpose, so they
sort to the top in Finder.

## Everything else

| | |
|---|---|
| `js/` | The app's code. Loaded by exact path — nothing here can move. |
| `spine/` | **Generated.** The one shared description of every movement. Every page fetches it by name. |
| `images/` | Artwork. `exercises/` and `avatars/` are generated. |
| `logo/` | Where the logo and the weight gauge are drawn. The only source for either. |
| `tools/` | The scripts that turn a source into what the app uses. |
| `docs/` | Long technical notes, for me. |
| `test/` | The checks that must pass before anything ships. |
| `ARCHIVE/` | Finished-with experiments. Nothing loads any of it. |
| `SYSTEM.md` | How the pieces fit together. The one document worth reading. |

## Generated, not written

These are output. Editing one by hand works until the next build, then the
change disappears without a word.

| Output | Rebuilt from | By |
|---|---|---|
| `icon.svg` · `icon-maskable.svg` · `icon-180/192/512*.png` | `logo/mark.mjs` | `tools/build-logo.mjs` |
| `images/logo-mark.svg` · `images/stamp-*.svg` | `logo/mark.mjs` | `tools/build-logo.mjs` |
| the marked blocks inside `onboarding.html` | `logo/mark.mjs`, `logo/equipment.mjs` | `build-logo.mjs`, `build-equipment.mjs` |
| `images/exercises/` | `EXERCISE LIBRARY/` | `tools/build-exercise-images.mjs` |
| `images/avatars/` | `EXERCISE LIBRARY/Body Shape/` | `tools/build-avatars.mjs` |
| `spine/*.json` (except `theme.json`) | the movement database | `tools/build-spine.mjs` |
| `spine/program.default.json` | `dashboard.html` | `tools/export-program.mjs` |
| `sw.js` and `dist/` | every committed file | `build-sw.mjs` |
| `FOR NICOLAS/EXERCISE CLASSIFIER.html` | the database | `tools/build-classifier.mjs` |
| `FOR NICOLAS/IMAGES TO MAKE.md` | `EXERCISE LIBRARY/` | `tools/build-exercise-images.mjs` |

## Before shipping anything

```
node tools/build-logo.mjs --check        # the logo still agrees everywhere
node tools/build-equipment.mjs --check   # the gauge still agrees everywhere
node test/local-adapter.test.mjs
node test/schema.test.mjs
node test/store.test.mjs
node test/program-adapter.test.mjs   # every prescription in every program is runnable
node build-sw.mjs                        # rebuild the offline shell
```

Then walk it: `onboarding.html` → fill it in → *Open my app* → lands on the
dashboard → `coach.html` opens the programme editor → release → the dashboard
shows it → start a session.

## Run it locally

```
python3 -m http.server 8765
```

then open `http://localhost:8765/onboarding.html`.
