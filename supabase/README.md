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

## If one of them errors

Send the message and which file. Do not retry it.

`01a` is the one carrying the risk: it points at `auth.users`, Supabase's own
login table. If that is the one that fails, the fix is to drop that link. The
app works without it. It only means the database stops checking that every
person also has a login, which the app can check instead.

## The gate

`03-verify-rls.sql` prints 8 lines. **Every one must say PASS.** If any says
FAIL, no key goes near the code until it is fixed. The repo is public and this
database holds PAR-Q answers and injury maps.
