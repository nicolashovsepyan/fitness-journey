# Backend decision

**Decided: Supabase.** Agreed by the owner, 2026-08-07 (Phase 1b).

**Nothing has been signed up for, no project created, no schema applied, no key
committed.** This document records the decision and the conditions attached to
it. Acting on it is Phase 2 work at the earliest.

---

## The decision

Managed Postgres with authentication, row-level security, file storage and
realtime, reachable from a static page with a JS client.

**Why it fits this product specifically:**

- **The site stays as it is.** Static, on GitHub Pages, no server to run, deploy
  or pay for. Nothing about the current publishing model changes.
- **No password for a fitness client to forget**, and none for us to store —
  which matters given we are handling their health data. See the correction
  below: magic links are how somebody *returns*, not how they arrive.
- **Row-level security is enforced by the database, not by front-end code.** A
  client can read their own rows and nothing else, and that stays true even if a
  screen has a bug.
- **Realtime is already there** for when messaging arrives, so that feature does
  not force a re-architecture.
- **Free tier covers one trainer and their clients** comfortably at this scale.

**Alternatives, briefly:** Firebase is equivalent and would work — Supabase wins
only because SQL keeps a program's structure legible, and a program is a
structure the owner needs to read and reason about. A custom server is the wrong
trade: hosting, deployment and security work for no capability gain here.

---

## Correction, 2026-09-11: how somebody actually arrives

This document originally said magic-link auth *is* the survey flow — the
client gets a link, clicks it, is signed in. Building it showed that is the
wrong way round, and the reason is worth writing down because it is the
hardest bug in the feature and it is avoidable rather than fixable.

A person fills in the survey **before** they have an account. That is the
whole point of the survey. But every row needs an owner that row-level
security recognises, so the intake cannot be written as nobody.

Magic-link-first means: hold the answers somewhere, send an email, wait for a
click, then write them. That is a wait in the middle of the one flow that must
not have one, it fails entirely if the mail lands in spam, and it means the
answers exist under a temporary identity before they exist under a real one.

**So the survey signs in anonymously at the moment it submits.** Supabase
issues a real `auth.uid()` with no email and no password. The intake is
written by its actual owner, immediately, and the person appears in the coach
console the second they press Finish — which is the thing that was asked for.

The decisive part is not the convenience. It is that **there is never a second
id.** Any scheme where identity starts local and becomes real later has to
reconcile everything written in between — the intake, the program assigned to
them, every log — and every one of those references is a chance to point at
the wrong person. Anonymous-first has no reconciliation step because there is
nothing to reconcile.

Magic links keep their job, which is **returning**: `linkEmail()` attaches an
email to an identity that already exists, and **the id does not change**. So a
person can come back on a new phone, or replace a lost one, and everything
they have done is still theirs. That is what magic links are good at, and it
is a different question from how they arrive.

Cost: anonymous sign-in has to be enabled in the project, one toggle,
`supabase/SETUP.md` step 3. An identity with no email is unrecoverable if the
device is lost before an email is attached — which is exactly why attaching
one is offered, and why nothing irreplaceable lives only on the server.

---

## The condition, and it is not a formality

**Row-level security must be verified ON before the anon key goes anywhere near
this repository.**

This is not boilerplate caution. The audit established what the intake actually
collects (`docs/AUDIT.md` §6.1):

- `answers.parq` — a PAR-Q medical screening: heart condition, chest pain,
  fainting, chronic diagnoses, prescribed medication, bone and joint problems,
  supervision requirements, pregnancy.
- `answers.pain` — a body map of current injuries across 16 regions, front and
  back, with free-text detail.

That is health data about real, identifiable people, and this repository is
public. A Supabase anon key is publishable *only* because RLS makes it useless
without a session. With RLS off, publishing it in a public repo exposes every
row in the database to anyone who reads the source.

**Sequence, in order, no steps merged:**

1. Create the project and the tables.
2. Turn RLS on for **every** table. Default-deny.
3. Write and test the policies — including a negative test: sign in as client A
   and confirm a read of client B's rows returns nothing.
4. Only then does the anon key enter the repo.

Anything else stays in environment/config and is never committed.

---

## How it sits behind the app

Supabase is the **sync target behind `LocalAdapter`, never in front of it.**

```
screens ──▶ storage contract ──▶ LocalAdapter ──▶ localStorage   (always)
                                       │
                                       └──────▶ Supabase        (when there is a connection)
```

The app reads and writes locally and always succeeds. Sync happens behind that.
A workout in a basement with no signal behaves exactly as it does today — which
is the whole reason `js/core/storage.js` defines a contract rather than just
importing a Supabase client.

**Never synced, by design:**

- **Run state** (`fj.run.<uid>`). A workout in progress belongs to the phone in
  your hand. If two devices could resume the same session, whichever finished
  last would overwrite the other. See the note in `js/core/storage.js`.
- **Device preferences** (`fj.voiceName`). The voice available on an iPhone is
  not the one on a laptop.

---

## Table sketch

One table per record in `js/core/schema.js`. Not applied — a sketch to check the
schema against, per the brief's instruction that a Phase 4 feature which does not
fit is a Phase 1 bug.

| Table | Key columns | RLS shape |
|---|---|---|
| `users` | `id`, `role`, `status`, `display_name`, `email`, `ui`, `program_id`, `trainer_id` | read own row; trainer reads rows where `trainer_id = auth.uid()` |
| `intakes` | `id`, `user_id`, `version`, `answers` (jsonb), `derived` (jsonb), `submitted_at` | read own; trainer reads their clients' |
| `programs` | `id`, `owner_id`, `assigned_to`, `name`, `status`, `days` (jsonb), `profile` (jsonb) | client reads where `assigned_to = auth.uid()`; trainer writes where `owner_id = auth.uid()` |
| `sessions` | `id`, `program_id`, `name`, `pattern`, `blocks` (jsonb) | readable via the program that owns it |
| `logs` | `id`, `user_id`, `session_id`, `name`, `date`, `blocks` (jsonb), `duration_sec` | insert + read own; trainer reads their clients' |
| `prs` | `user_id`, `ex_id`, `value`, `unit`, `weight`, `l`, `r`, `date` | as `logs` |
| `messages` | `id`, `from_user_id`, `to_user_id`, `body`, `context_type`, `context_id`, `read_at` | read where you are either party |

Every table also carries `created_at` and `updated_at`, matching the schema rule
that every record is stamped.

| `user_state` | `user_id`, `state` (jsonb) | the person only, not their coach |

Two columns in that table were added after this sketch, by mapping each record
field onto a column **by hand** rather than by a naming rule. `logs` had no
`name`, so every workout would have synced up untitled. `prs` had no `l` and
`r`, so a single-limb record would have synced as a record of nothing. Neither
would have thrown. That is the whole argument for writing the map out one
field at a time: a field with nowhere to go is a missing line you can see.

`user_state` is the per-user document `js/core/storage.js` always said would
be "a single jsonb row, not fifteen tables" on a server. Its policies open it
to the person and to nobody else, coach included — a coach who wants to know
whether somebody is training reads the logs, which is the record of what
happened.

**Deliberately absent:** no table for run state or device preferences. They are
device-local and syncing them would be a bug, not a feature.

Two notes worth carrying forward:

- `blocks`, `answers`, `days` and `profile` are `jsonb`. They are documents, not
  relational data, and the app already treats them that way. Making them
  relational would buy query power nobody needs and cost the ability to store a
  log exactly as it was performed.
- `logs` should be **insert-and-read only** — no update, no delete. A completed
  workout is a fact about the past. The storage contract deliberately offers no
  `updateLog`, and the database should agree.

---

## Checked against Phase 4

The brief asks that each later feature be sketched onto the Phase 1 schema, and
that a feature which does not fit be treated as a schema bug.

| Phase 4 feature | Lands on | Fits |
|---|---|---|
| Trainer view over intakes | `listIntakes()`, `intakes` + `users.trainer_id` | yes |
| Programs authored as data and assigned | `Program` + `savePrograms()`, `users.program_id` | yes |
| Logs syncing to the server | `LogEntry` + `appendLog()`, insert-only `logs` | yes |
| Progression visible to the trainer | `listLogs(clientId, range)` + `getPRs()` | yes |
| Messaging | `Message` + `sendMessage()`, realtime on `messages` | yes |

One gap found and closed during this pass: the original Phase 1 method list had
no run state and no device preferences, which would have made Phase 2's rule —
`localStorage` only inside the adapter — impossible to satisfy, because
`runstate.js` and `timer.js` both write it directly. Both are now in the
contract. That is the kind of thing the brief wanted found here rather than
halfway through the conversion.

---

## What is live, 2026-09-11

Project `dmpxtzjlhccxisuofxhd`. Eight tables, 26 policies, anonymous sign-in
on, the gate green on all twelve lines, and the publishable key in
`js/config.js`.

**The survey publishes and the console reads.** A survey finished on a phone
appears in the console on a laptop, with no link and no tap. That was the
whole point of the exercise, and `test/supabase-live.test.mjs` runs it as two
devices — two clients, two session stores, one publishes and the other pulls.

Three things building it found, all of the same family the audit keeps
turning up: something that looks like it worked and did not.

- **The console called the module bridge before the bridge existed.** Classic
  scripts run at parse time and modules are deferred, so the pull returned
  quietly and the console never asked the database anything. It looked fine.
- **Signing in is not the same as existing.** Supabase issues an auth
  identity; `public.users` is our table and starts empty. A client whose
  `trainer_id` pointed at a coach with no row was rejected outright, at the
  moment somebody had just finished answering a PAR-Q.
- **`removeUser` reported success and changed nothing.** There is no delete
  policy on `public.users`, so the DELETE matched zero rows and PostgREST
  answered 204. The test that "proved" it worked read the row back after
  signing out, which finds nothing whatever the truth is.

That last one also turned out to be the wrong operation. `js/core/storage.js`
says `removeUser` takes the person and not their training; on the server every
foreign key cascades from `users`, so a delete would have taken their intakes,
logs, records and settings. It unassigns now — `04-release-a-client.sql` — and
the client keeps everything.

**Still local:** the app itself. A program released from the console still
travels to the phone by link. That is the next piece.

---

## Still open

- **Which variant is the benchmark** for `row` and `plank`, and confirmation of
  `wide_inverted_row` for `invrow`. Tracked in `DECK_TO_CANONICAL`.
- **Seven exercises to add** to `js/data/exercises.js` before the survey deck can
  use canonical ids: back squat, bench press, overhead press, farmer carry,
  kettlebell swing, bodyweight squat, wall sit.
- **Body-type artwork** — the owner is replacing the current SVG silhouettes and
  will supply new assets.
- **Exercise card artwork** — 4 movements fillable from existing renders, 7 with
  no usable image. Adding 12 cards costs roughly 480 KB inlined and needs an
  explicit yes (`docs/AUDIT.md` §6.3).
