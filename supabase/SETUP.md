# Turning the backend on

Everything on the code side is built and tested. What is left is the part
that needs your account, and it is about twenty minutes.

Do it in this order. Do not skip step 5 — it is the one that decides whether
a key is safe to publish, and this repository is public.

---

## 1. Make the project

[supabase.com](https://supabase.com) → **New project**.

- **Name**: `fitness-journey`
- **Region**: pick the one closest to you. It is the only thing here that
  affects how fast the app feels.
- **Database password**: let it generate one, save it in your password
  manager. You will almost never need it — it is not how the app connects.

Wait for it to finish provisioning, about two minutes.

---

## 2. Run the SQL

**SQL Editor** in the left sidebar. Paste each file, press Run, clear the box,
next one. The order is not optional.

| # | File | Expect |
|---|---|---|
| 0 | `00-check.sql` | one row: "the editor works" |
| 1 | `01a-users.sql` | Success. No rows returned |
| 2 | `01b-tables.sql` | Success. No rows returned |
| 3 | `01c-links-and-indexes.sql` | Success. No rows returned |
| 4 | `01d-stamps.sql` | Success. No rows returned |
| 5 | `02-rls.sql` | Success. No rows returned |

If one errors, stop and send me the message and which file. Do not retry it —
these files have hit two errors before that had nothing to do with the SQL,
and `README.md` in this folder explains both.

---

## 3. Turn on anonymous sign-in

**Authentication → Sign In / Providers → Anonymous Sign-Ins → enable.**

This is what makes "fill in the survey and appear in the console" work.

A person filling in the survey does not have an account yet, and asking them
to make one first is how you lose them. But row level security means every
row needs a real signed-in owner. So the survey signs in anonymously the
moment it submits, and the id it gets is a real one from that second on.

That is not a shortcut, it is the thing that removes the hardest bug in this
whole feature. The alternative is a temporary id now and a real one later,
with every intake, program and log written in between pointing at whichever
one was current. There is no reconciliation step here because there is never
a second id. Adding an email later keeps the same id.

---

## 4. Set the site URL

**Authentication → URL Configuration.**

- **Site URL**: `https://nicolashovsepyan.github.io/fitness-journey/`
- **Redirect URLs**: add the same, and add `http://localhost:8000/` if you
  ever open the app from a local server.

This is where a sign-in link is allowed to come back to. A link that returns
anywhere else is refused, which is the behaviour you want.

---

## 5. The gate

Back to the **SQL Editor**. Paste `03-verify-rls.sql` and run it.

**It prints 11 lines. Every single one must say PASS.**

If any line says FAIL, stop. Send me the output. No key goes near the code
until all 11 pass, and that is not caution for its own sake — this database
holds PAR-Q answers (heart conditions, medication, pregnancy) and injury maps
for real people, and this repository is public. The key is publishable only
because the locks make it useless without a session. If a lock is open, the
key hands all of it to anyone who reads the page source.

The test writes three fake people, checks what each can and cannot see, and
rolls back. It leaves nothing behind.

---

## 6. Send me two things

**Settings → API.**

- **Project URL** — looks like `https://abcdefghijkl.supabase.co`
- **anon / public key** — the long one labelled `anon`

Both are safe to send and safe to publish, *once step 5 has passed*.

**Not** the `service_role` key. That one bypasses every lock in step 2. It
never goes in a message, a file, or this repository. The only thing that ever
wants one is the test in `test/supabase-adapter.test.mjs`, which reads it from
the environment of whatever machine is running it.

---

## What happens then

I put those two values in `js/config.js` — the only file in the app that ever
names a backend — and the app starts syncing. Until they are there, both
fields are `null` and everything runs exactly as it does today, on the device.

---

## What is already done, so you know what you are switching on

- **The schema** — eight tables, every record the app holds, each field
  mapped by hand against `js/core/schema.js` rather than by a rule. That pass
  is what found that logs had no column for their name, so every workout
  would have synced up untitled, and that PRs had nowhere to put a per-side
  record, so a pistol squat would have synced as a record of nothing.
- **The locks** — 26 policies, default-deny, and an 11-line negative test
  that proves a client cannot read another client, and that a coach cannot
  read a client who is not theirs.
- **The adapter** — the same storage contract the app already talks to, so
  no screen changes.
- **The proof** — `node tools/check-all.mjs` runs every test in the
  repository, including the whole storage contract against the Supabase
  adapter over a fake database, with no keys and no network. It is green.
