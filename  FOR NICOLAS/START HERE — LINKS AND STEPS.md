# START HERE — the links, and what to do with them

Everything below is live at **`nicolashovsepyan.github.io/fitness-journey`**.
That is the only address that matters. Anything else is a local copy.

---

## THE FOUR LINKS

| What | Page | Who opens it |
|---|---|---|
| **The survey** | `onboarding.html` | **Your clients.** This is the one you send out. |
| **The console** | `coach.html` | **You.** Build and release programs. |
| **The app** | `index.html` | Your clients, after the survey. |
| **The dashboard** | `dashboard.html` | Your clients. Their week, log, library. |

Full addresses:

```
https://nicolashovsepyan.github.io/fitness-journey/onboarding.html
https://nicolashovsepyan.github.io/fitness-journey/coach.html
https://nicolashovsepyan.github.io/fitness-journey/index.html
https://nicolashovsepyan.github.io/fitness-journey/dashboard.html
```

**Send clients `onboarding.html`. Nothing else.** The survey hands them on
to the app itself at the end.

---

## HOW A SURVEY REACHES YOUR CONSOLE

Two paths, both already built. Which one happens depends on whether they
filled it in on *your* device or *theirs*.

### They filled it in on your phone or laptop — automatic

The survey writes straight into the same browser storage the console
reads. Open `coach.html` on that device and they are already in the client
picker. Nothing to paste.

### They filled it in on their own phone — one paste

The survey's last screen gives them two buttons:

- **Send to Nico** — opens their mail app, already addressed to
  `nicolashovsepyan@gmail.com`, with the link in the body.
- **Copy link** — puts the same link on their clipboard.

That link *is* their whole record. When you get it:

**Open the link.** That is the entire step. It points at your console, and
opening it imports them, selects them, and clears the address bar. If they
already have a program, that comes with them.

If you would rather paste it: `coach.html` → client rail →
**Add a client from their survey** → paste → **Add them**.

---

## STEP BY STEP — start your own profile from scratch

1. On your phone, open
   `https://nicolashovsepyan.github.io/fitness-journey/onboarding.html`
2. Fill it in properly. Roughly four minutes.
3. At the end, tap **Add it to my home screen**. Your icon is the
   triangle-and-dumbbell now, not an "F" — if you still have the old one,
   **delete it and add it again**. iOS does not update an icon in place.
4. Then tap **Copy link** on that same last screen and mail it to yourself.
5. On your laptop, open that link. You land in the console, as you.
6. Check the line under your name in the client rail. It should read
   **`survey v6`** and today's date. If it says **`v5 — OUT OF DATE`** in
   amber, an old record got in — tell me.
7. Your old profile: client rail → **Remove Nicolas**. That clears the
   console's copy. It does not touch your training log.

---

## STEP BY STEP — get Sevan into your console

His record is already in this folder, but **it is not on the website and
it must not be.** This repository is public, and that file contains his
PAR-Q answers, his pain map and his program. See the note at the bottom.

1. Open **`spine/programs/link.sevan.txt`** in this folder.
2. Select all of it and copy. It is one long line.
3. `coach.html` → client rail → **Add a client from their survey**.
4. Paste, then **Add them**.

He arrives complete: his answers, his three 45-minute days, and the days
already released. Do this once per device you use the console on.

---

## STEP BY STEP — build and save a program

1. `coach.html` → **The program**.
2. **Open a program** — pick from the dropdown. It loads underneath
   straight away.
   - **Templates** are the six on the shelf. They open as a *copy*.
     Editing one never changes the shelf.
   - **Yours** are programs you saved. They open for real.
3. Edit. Name the program in the box at the top.
4. The chip beside the name tells you where you stand:
   - `NOT SAVED YET` — a copy of a template, nothing kept yet
   - `UNSAVED CHANGES` — you have moved away from what is saved
   - `SAVED` — what is on screen is what is stored
5. **Save** writes back into the program that is open.
   **Save as new** makes a second one and leaves the first alone.
6. **Give it to *name*** is the separate step that releases it to their
   phone. Building and handing over are two different decisions.

**Locking a block** folds it to one line so you can see the next one. The
chevron opens its exercise list; the padlock unlocks it to edit again.

Each block banner reads: role, **which block of how many**, the minutes it
runs between, its name, and **how hard it is** — Easy through Relentless,
measured as how much of the block is work rather than rest. Cut the rest
and watch it climb. Where set counts are not written down it shows nothing
rather than guessing.

---

## THE FILES THAT MATTER

| File | What it is |
|---|---|
| **`coach.html`** | The console. The whole thing, one file. |
| **`onboarding.html`** | The survey. |
| **`dashboard.html`** | The client's app. |
| **`spine/programs/*.json`** | The six templates. Edit here, then run `node tools/build-coach-library.mjs`. |
| **`spine/programs/link.sevan.txt`** | Sevan's record. **Never commit this.** |
| **`tools/check-surveys.mjs`** | Run after touching the survey. |
| **` FOR NICOLAS/`** | This folder. Notes for you, not code. |

**Do not edit** `spine/catalog.json`, `sw.js`, `dist/`, or the `LIBRARY`
block inside `coach.html`. All four are generated and get overwritten.

---

## WHY SEVAN'S LINK IS NOT ON THE WEBSITE

Everything committed to this repository is published to the open web — the
site is served from it, and the repository is public. A handoff link is not
a name and an email. It is a PAR-Q, a body map, an email address and a
training history, in one string anybody could decode.

`.gitignore` has excluded `link.*.txt` from the beginning, deliberately.
That is why Sevan takes one paste per device instead of being built in, and
it is the right trade. If you want clients seeded automatically, the
repository has to be private first.
