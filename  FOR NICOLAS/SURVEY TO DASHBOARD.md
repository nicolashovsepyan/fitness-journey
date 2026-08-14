# Connecting the survey to the dashboard

You asked how this gets done. Short answer: **most of the plumbing is already
built** — it was Phase 1 and 2 of the migration — and the survey is the one
piece still standing outside it.

---

## Where it stands today

The survey finishes, and then it does two things:

```js
localStorage.setItem('fj_profiles', …)   // a list of raw survey answers
localStorage.setItem('fj_current',  …)   // the latest one
location.href = 'mailto:nicolashovsepyan@gmail.com…'
```

The app reads **completely different keys**, in a different shape:

```js
'fj.users'     // User records
'fj.intakes'   // Intake records
'fj.programs'  // Program records
```

**They are the same browser, the same origin, and they have never spoken.**
Someone can finish the whole survey and the app will still open on "who are
you?" — which is the disconnection the Phase 0 audit flagged and the only part
of it still outstanding.

---

## What already exists on the app's side

This is why the job is small.

| Piece | Where | State |
|---|---|---|
| `User` / `Intake` shape and factories | `js/core/schema.js` | Built, with validators |
| `DECK_TO_CANONICAL` — survey ids → app exercise ids | `js/core/schema.js` | Built |
| Storage adapter (the only file touching localStorage) | `js/adapters/local.js` | Built |
| `addUser()`, identity resolved once at boot | `js/users.js` | Built |
| Serialised write queue, no lost writes | `js/core/persist.js` | Built |

**Nothing new has to be designed.** The survey just has to write into it.

---

## How it gets done

### 1 · The survey writes a User and an Intake

At the end — the same moment it currently writes `fj_current` — it builds the
two records using the factories that already exist, and saves them under the
keys the app already reads. Same origin, so `localStorage` is shared and no
network is involved.

That alone makes the survey the front door: finish it, open the app, and your
name, your week, your levels and your movements are already there.

### 2 · The app boots into the right state

`loadUsers()` already resolves identity at boot. It gains one branch: if there
is an intake with no program yet, open on **"your program is being built"**
rather than the claim screen or an empty dashboard.

### 3 · The handoff to you stays exactly as it is

The mailto stays. Nothing about your review changes — the difference is that
the person is not staring at an empty app while they wait for it.

---

## The one real decision

**Does the survey import the app's modules, or duplicate the shapes?**

`onboarding.html` is deliberately a single self-contained file. It is shared as
a cold link on mobile data and has to work with no build step. Importing
`js/core/schema.js` breaks that: it becomes a page that needs its sibling files
to exist and to have loaded.

Two ways:

**A — the survey imports the schema.** One definition, no drift. But the
survey stops being a file you can send someone, and a slow module load now sits
in front of the first screen.

**B — the survey writes the shape, a test enforces it.** The survey stays one
file. A test in `test/` builds a record the survey's way and validates it with
the app's own validator, so a drift breaks the build rather than a user.

**I would do B**, and I want to be plain about why: the cost of A is paid by
every single person who opens the link, and the cost of B is paid once, by us,
if we change the shape. The test makes the risk visible, which is the part that
actually matters.

---

## Before this is worth doing

Two things should land first, or the handoff carries bad data into the app:

1. **The ladder's level axis** — the deck still asks a bare-floor advanced
   athlete about a pike push-up. That answer becomes their starting level in
   the app, so it is worth getting right before it is written anywhere
   permanent. Waiting on your classifier pass.
2. **The twelve missing benchmark rows** — without them, twelve of the deck's
   sliders have no thresholds, so `A.tier` is computed from a partial set.

Neither blocks the plumbing. They block trusting what goes through it.

---

## What I need from you

1. **A or B** on the schema question. I recommend **B**.
2. **When.** This is roughly a day's work and it is the thing that turns two
   projects into one product. It can happen before or after the classifier
   pass — say which you would rather have first.
