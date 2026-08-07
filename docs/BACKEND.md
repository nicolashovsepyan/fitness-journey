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
- **Magic-link auth *is* the survey flow.** The client gets a link, clicks it, is
  signed in. No password for a fitness client to forget, and no password for us
  to store — which matters given we are handling their health data.
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
| `logs` | `id`, `user_id`, `session_id`, `date`, `blocks` (jsonb), `duration_sec` | insert + read own; trainer reads their clients' |
| `prs` | `user_id`, `ex_id`, `value`, `unit`, `weight`, `date` | as `logs` |
| `messages` | `id`, `from_user_id`, `to_user_id`, `body`, `context_type`, `context_id`, `read_at` | read where you are either party |

Every table also carries `created_at` and `updated_at`, matching the schema rule
that every record is stamped.

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
