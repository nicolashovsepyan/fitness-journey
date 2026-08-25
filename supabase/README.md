# The database files, and the order to run them

Paste each into the Supabase **SQL Editor**, press Run, clear the box, next one.

| Order | File | What it is | Expect |
|---|---|---|---|
| 0 | `00-check.sql` | one line, proves the editor works | one row: "the editor works" |
| 1 | `01a-users.sql` | the people table | Success. No rows returned |
| 2 | `01b-tables.sql` | the other six tables | Success. No rows returned |
| 3 | `01c-links-and-indexes.sql` | the links between them | Success. No rows returned |
| 4 | `01d-stamps.sql` | keeps "last updated" true | Success. No rows returned |
| 5 | `02-rls.sql` | locks every table, opens 24 doors | Success. No rows returned |
| 6 | `03-verify-rls.sql` | **the proof** | 8 rows, each PASS or FAIL |

## Why it is split up

The first version was one big file and it returned "Backend error! Retry your
query" twice. That message says nothing about which line failed, and there is
no Postgres on the machine these were written on to test against.

So it is in small pieces now. Whichever one errors names the problem exactly,
in one round instead of five.

## The thing that kept failing, and it was not the schema

Three files came back "Backend error! Retry your query" and that message names
no line. The cause was a word like `Supabase's` **inside a comment**.

The Supabase SQL editor cuts a script into statements in the browser, before
the database ever sees it, and its cutter does not skip comments. So an
apostrophe in a comment opens a piece of text that never closes, and every
statement after it is read as nonsense. Postgres would have been perfectly
happy with all three files.

The evidence was sitting there: `00-check.sql` has no apostrophe in any
comment and it passed. Every file that failed had one.

`node tools/check-sql.mjs` now refuses to let a file leave with an apostrophe
or a dollar pair in a comment. Run it before handing any of these over.

## If one of them errors

Send the message and which file. Do not retry it.

**This already happened.** `01a` pointed at `auth.users`, Supabase's own login
table, and this project will not let the SQL editor reach across to it. That
was the "Backend error", twice. The link is gone from `01a`, and out of the
test in `03` which was writing to the same table.

It costs nothing in security. Every lock in `02` compares against the
signed-in session itself, never against that link. What it costs is two bits
of housekeeping the database used to do free: sweeping up a person's row when
their login is deleted, and refusing a row whose id has no login. Both belong
to the app now.

## The gate

`03-verify-rls.sql` prints 8 lines. **Every one must say PASS.** If any says
FAIL, no key goes near the code until it is fixed. The repo is public and this
database holds PAR-Q answers and injury maps.
