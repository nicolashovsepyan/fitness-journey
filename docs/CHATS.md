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

## Who is working where

Update the state line when you pick something up or put it down. Delete a row
when the area goes quiet — a stale row is worse than no row.

| Area | Files | State |
|---|---|---|
| **Coach console** | `coach.html` | Idle since 12 Sep. Last: the builder went full width, dials on top, movement picker opens in the block that wants one. |
| **Dashboard / Work Mode** | `dashboard.html`, `js/` | Active 13 Sep. Last: week navigation backwards, undo a mis-tap. |
| **Lab** | `lab/`, `dashboard-lab.html`, `tools/build-lab.mjs` | Active 13 Sep. Experiments kept away from clients. |
| **Logo / icons** | `logo/`, `icon*`, `images/logo-mark.svg`, `styles.css` | **IN FLIGHT, UNCOMMITTED.** Leave alone. Untracked: `logo/fj/`, `images/fj-signature.png`. |
| **Survey** | `onboarding.html` | Idle since 12 Sep. |
| **Backend** | `supabase/`, `js/core/backend.js` | Idle since 12 Sep. Schema and edge function live; `coach.html` does not call it yet. |

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

## One thing that is not in git at all

The console's client list — who is in the picker — lives in `localStorage`, so
it belongs to **one browser at one address**. `localhost:8801` and
`nicolashovsepyan.github.io` are different origins and therefore different
lists, and no chat can read the list in Nicolas's own browser.

So when a chat needs to know what is on his screen, it has to ask. Nothing in
the repository can answer it. That changes when the console moves onto the
backend, which is the largest thing still open.
