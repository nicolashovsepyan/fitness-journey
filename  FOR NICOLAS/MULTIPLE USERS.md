# Multiple users: what it takes, and where we are

## What you have today

Every person's answers and workouts live **only on their own phone**. Nothing
is on a server. That is why you have been passing links around: it is the only
way anything moves between you and a client.

It works. It does not go past a handful of people.

## What you are asking for

- A client fills in the survey and **their answers arrive with you**, no link
- You open one list and **see everyone**
- You write a program, press release, and **it lands on their phone**
- They train, and **what they did comes back to you**

## What that needs

A database, and one account each. You already chose it on 7 August: **Supabase**.
It is written down in `docs/BACKEND.md` with the reasons.

## The one rule attached to it

Your app holds **medical answers**: the PAR-Q, and a map of where people hurt.
The code is public on the internet, and the key that connects the app to the
database is inside that public code. Anyone can read it.

That is safe, and **only** safe, if the database refuses to hand out anything to
someone who is not signed in as the right person. Turning that on is called
row level security.

**With it off, publishing that key shows every client's medical answers to
anyone who looks at the page source.**

So the order is not negotiable, and it is your own order from August:

1. Make the database and the tables
2. Lock every table so nothing is readable at all
3. Open exactly the right doors, and **prove it with a test**
4. Only then does the key go anywhere near the code

## What I have done, without touching your account

Three files in the `supabase` folder, ready to run:

| File | What it does |
|---|---|
| `01-schema.sql` | Creates the tables. One per thing the app already saves. |
| `02-rls.sql` | Locks every table, then opens 24 specific doors. |
| `03-verify-rls.sql` | **The proof.** 8 tests, prints PASS or FAIL. |

The doors, in words:

- You see **your own** clients, nobody else's
- A client sees **their own** everything, and nothing of anyone else's
- A client's intake **cannot be edited or deleted, ever**, not even by them.
  A correction is a new one. What somebody actually said has to stay true.
- The key on its own, with nobody signed in, **reads nothing at all**

The test is the important file. It makes a fake Client A, Client B and a
trainer, then tries to steal Client B's PAR-Q as each of them. If any line
prints FAIL, the key does not go in the code. It cleans up after itself.

## What only you can do

I cannot make accounts, and I will not put a key in the code until I have seen
the test pass.

1. **Create a Supabase project.** Free tier is plenty.
2. **Run the three files in order** in their SQL editor. Paste, run, next.
3. **Send me the output of the third one.** If it is 8 PASSes, we go on.

## What I do next, once that passes

The app was built for this. There is one contract for saving things
(`js/core/storage.js`) and one line that chooses where saving goes
(`js/app.js`, line 185). Today it says local. I write a second one that says
Supabase, and change that line.

**Supabase goes behind the phone, never in front of it.** The app keeps saving
to the phone first and always succeeds. Syncing happens behind that. A workout
in a basement with no signal behaves exactly as it does today. That is the
whole reason the contract exists.

Two things stay on the phone forever, on purpose: a workout **in progress**,
and settings like which voice reads your timer. If two phones could resume the
same session, whichever finished last would erase the other.

## Honest about size

This is the biggest piece of work in the project so far. It is not one evening.
The three files above are the foundation and the safety gate, which is the part
that must be right before anything else is built.

## In the meantime

Use `https://nicolashovsepyan.github.io/fitness-journey/`. It is the complete
one. None of the link passing you are doing now gets thrown away: the same
records, in the same shapes, are what the database will hold.
