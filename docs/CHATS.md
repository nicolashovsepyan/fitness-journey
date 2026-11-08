# CHATS — several conversations, one repository

Nicolas runs a separate Claude Code chat per area of the app: one on the
console, one on the dashboard, one on the logo. That is a good way to work and
it has exactly one failure mode, which this file exists to prevent: **two chats
editing the same file at the same time, and the second one silently discarding
the first one's work.** It has already happened once, on 24 August.

---

## Git is the source of truth. This file is not.

Do not record here anything git already knows. Where the console left off is
`git log -- coach.html`, and the commit messages in this repository are written
to be read. Duplicating that here just creates a second copy to go stale, which
is the disease this project keeps treating.

This file covers the two things git cannot tell you:

1. **What is uncommitted right now**, and therefore whose desk it is on.
2. **What the next step was**, which lives in somebody's head, not in history.

---

## The rule, in three lines

**Start of every chat:** `git fetch && git status --short && git log --oneline -8`.
Read what landed since last time and what is sitting modified.

**Never touch a file that shows as modified** unless your chat is the one that
modified it. A dirty file is another conversation mid-sentence.

**Commit before you stop.** Work that is only in a working tree is invisible to
every other chat, and to you tomorrow.

---

## Every release: bump whatsnew.json

Users see an "Update ready · Refresh" bar and then "Updated ✓" with the first
line of `whatsnew.json` (js/update-banner.js, on index.html and dashboard.html).
**Any chat that ships something users will notice:** change `version` and put
one short plain line first in `notes`, in the same commit. Without it the bar
still appears, but says nothing about what changed.

---

## French (France) — every user-facing string, every chat

The app is going bilingual, English and French from France (not Québec).
Started 4 Oct 2026 in the Work Mode chat (Training Timer and workout
screens done first).

- **Write strings through `t()`** from `js/i18n.js`: `t('Start')`,
  `t('Round {n}.', { n })`, `t2(n, '{n} move', '{n} moves')`. The English
  text is the key; French lives in `js/i18n-fr.js`. A missing key shows English.
- **Exercise names and cues:** `exName(id, name)` / `exCues(id, cues)`
  (French in `js/data/exercises-fr.js`, all 322 moves).
- **Words and style:** `docs/FRENCH.md` is binding: "tu", France terms, kg,
  decimal comma, no-break space before ! ? : ;.
- **Language** is per device (`fj.lang`), switched in Timer settings; pages
  can listen for the `fj-lang` event to redraw.
- **Not yet in French:** dashboard.html, onboarding.html, coach pages (coach
  pages stay English by design). Their chats: wrap strings with `t()` and add
  the French to js/i18n-fr.js.
- **Release notes:** `whatsnew.json` can carry `notes_fr` next to `notes`;
  the update bar shows the French one to French users.

## Work Mode has its own chat

The live timer (program workouts AND the standalone Quick Timer) is built from
one dedicated chat. Its home is **`docs/WORK-MODE.md`**: what is done, what is
weak, what is pending, and a changelog.

- **Every chat, at start:** read the Changelog in `docs/WORK-MODE.md` so you
  know what changed in the timer since last time.
- **The Work Mode chat:** after every change, commit, push (so it is live for
  users on their next open) and add a Changelog line. Not done until all three.
- **Any other chat** that needs a timer change: add it under "Requests from
  other chats" in that file. Do not edit the Work Mode files yourself.

---

## Who is working where

Update the state line when you pick something up or put it down. Delete a row
when the area goes quiet — a stale row is worse than no row.

| Area | Files | State |
|---|---|---|
| **Coach console** | `coach.html` | Idle since 12 Sep. Last: the builder went full width, dials on top, movement picker opens in the block that wants one. |
| **Dashboard** | `dashboard.html`, `js/` (except the Work Mode files) | Active 13 Sep. Last: week navigation backwards, undo a mis-tap. **8 Nov, coach-console chat:** added the arrival bar to `takeCloudProgram` (a released program used to land and reload with no word). Nothing else in this file touched. |
| **Work Mode** | `js/runner/` (incl. `quick.js`, the Quick Timer), `js/timer.js`, `js/data/formats.js`, the "Quick timer" row in `dashboard.html`, `manifest-timer.webmanifest`, `images/timer-icon/` (J5 Sunray from the logo chat's dial set; rebuild with `tools/build-timer-icon.mjs`) | **Own chat since 27 Sep.** Audit, plan and changelog: `docs/WORK-MODE.md`. Other chats read it, never edit these files. |
| **Lab** | `lab/`, `dashboard-lab.html`, `tools/build-lab.mjs` | Active 13 Sep. Experiments kept away from clients. |
| **Logo / icons** | `logo/`, `icon*`, `images/logo-mark.svg`, `styles.css` | **IN FLIGHT, UNCOMMITTED.** Leave alone. Untracked: `logo/fj/`, `images/fj-signature.png`. |
| **Survey** | `onboarding.html` | Idle since 12 Sep. |
| **Backend** | `supabase/`, `js/core/backend.js` | Live since 11 Sep. The console DOES pull clients on open. Broken in one way - see below. |

---

## Known loose ends

Neither is urgent; both are here so they stop being rediscovered.

- **`session-workouts-and-day2-fixes`** is 2 commits ahead of main, from 5
  August, touching `js/data/workouts.js`, `js/runner/workmode.js` and
  `js/store.js`. Work Mode was rebuilt on main afterwards, so this is very
  likely superseded rather than lost — but it is the only code in this
  repository that is not on main. Confirm, then delete the branch.
- **`.claude/worktrees/elegant-sammet-84c450`** is a worktree parked at a
  19 August commit. Its branch is fully merged. Remove it.

---

## Request from Work Mode to the exercise database chat (17 Oct 2026)

11 cardio and boxing drills live in `js/data/exercises-cardio.js` (shadow_boxing, jab_cross, boxing_hooks, boxing_uppercuts, slip_and_roll, speed_punches, boxer_shuffle, jump_rope, double_under, jumping_jack, high_knees), with French names. That file adds them to EXERCISES at import and steps aside for any id the library defines itself. Please take them into the workbook (same ids, so history, voice clips and demo videos keep working); once they are in exercises.js and exercises-fr.js, the cardio file can be emptied.

## The console's client list, and why no chat can see it

Two separate reasons, and the second is a bug.

**localStorage is per origin.** `localhost:8801` and
`nicolashovsepyan.github.io` are different browsers as far as storage is
concerned, and neither is the browser Nicolas actually works in. When a chat
needs to know what is on his screen, it has to ask. Nothing in the repository
can answer it.

**The cloud pull signs in as the wrong person.** The console does call the
backend — `pullClients` in `js/core/backend.js`, on open and on focus. It
works: it returns `ok`. It returns **zero clients**, and here is why.

A finished survey stamps the client with `trainer_id = BACKEND.coachId`,
which is a fixed uuid in `js/config.js`. The console, asking who it is, calls
`ensureSelf` → `cloudSignIn` → **`signInAnonymously`**, which mints a *new*
anonymous identity per browser. Row-level security then returns the clients
whose `trainer_id` equals the signed-in uid. Those two are the same value in
exactly one browser: the one that first opened the console on 11 September,
whose id was copied into `config.js` by hand.

Every other browser — a second laptop, a cleared site, this session — signs in
as somebody new, matches nothing, and shows an empty console. `cloudAttachEmail`
is exported and would fix it by making the identity portable, but nothing in
`coach.html` calls it and there is no UI for it.

So the sync is real, and it currently has an audience of one browser.

---

## Why a released program reaches one phone and not another (8 Nov 2026)

Verified end to end: `publishProgram` then `fetchMyProgram` round-trips a
program, its days and its release flags correctly. The plumbing is not the
problem. **Identity is.**

`publishProgram` writes `assignedTo: <the console's client id>`.
`fetchMyProgram` reads the program assigned to `<the phone's own Supabase
id>`. Those are the same value in exactly one case: **the client completed
the survey on that phone.** The survey signs the device in and publishes
the intake as that identity, so the phone and the console's client are one
person. Fill the survey anywhere else and the phone is a different
anonymous identity that no program is addressed to.

`publishProgram` also refuses any client id that is not a uuid, which is
correct: a hand-added or link-pasted client (`ozzy`, `cnicolas`) has no row
in the database, so there is nothing to assign to. The console now says
which of the two states a client is in, in the Send it panel, before you
build rather than after you release.

**Still open:** a device cannot claim an identity it does not already have.
`cloudAttachEmail` and `cloudSendLink` exist and the console has UI for the
coach's own identity; the client app has none, so a person who fills the
survey on a laptop can never link their phone except by the handoff link.
That is the remaining gap and it belongs to whoever owns the app shell.

## Request from the coach console to the dashboard chat (8 Nov 2026)

A prescribed movement can now carry `kit` — which implement the weight is
in: `bb`, `db`, `kb`, `vest` or `band`. The coach console sets it on the
weight sheet (the same five icons the onboarding uses to ask what kit
somebody has) and shows it on the movement's weight field.

Nothing in the app reads it yet, which is safe — it is an extra field on
an item and the runner ignores what it does not know. But "45 lb" on a
phone is still ambiguous in exactly the way it was on the console, so the
runner would be better for showing it: `45 lb · dumbbells`, or the icon.

The field is optional and absent on every program written before today.
