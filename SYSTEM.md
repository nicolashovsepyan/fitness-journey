# SYSTEM — how the pieces fit together

The organigramme. Companion to `ARCHITECTURE.md` (how the app is built),
`docs/AUDIT.md` (what the code actually is) and `docs/BACKEND.md` (the store
decision). Written 2026-08-11.

Visual version: the "system map" artifact.

---

## The shape in one paragraph

**One spine, four surfaces, five records.** The spine is shared and read-only —
every surface reads it and none of them keeps a private copy. The surfaces are
the four things a person actually touches. The records are the only things that
cross a boundary between surfaces; nothing else does.

```
        ┌──────────────────────────────────────────────────────────┐
        │  THE SPINE — shared, read-only, one copy                  │
        │  catalog.json · art.manifest · benchmarks · theme · schema│
        └────┬──────────────┬──────────────┬──────────────┬─────────┘
             │ reads        │ reads        │ reads        │ reads
        ┌────▼────┐   ┌─────▼──────┐   ┌───▼──────┐   ┌───▼──────┐
        │Onboardng│   │Coach Consle│   │Dashboard │   │Work Mode │
        │ CLIENT  │   │ YOU+CLAUDE │   │ CLIENT   │   │ CLIENT   │
        │ built   │   │ built      │   │ built    │   │ NOT BUILT│
        └────┬────┘   └──┬──────▲──┘   └──┬────▲──┘   └───┬──────┘
   writes    │   writes  │      │ reads   │    │ reads    │ writes
   PROFILE   │  PROGRAM  │      │ PROFILE │    │ PROGRAM  │ LOG
             │  RELEASE  │      │ LOG     │    │ (gated   │
             │           │      │  writes │    │  by      │
             │           │      │  LOG    │    │ RELEASE) │
        ┌────▼───────────▼──────┴─────────▼────┴──────────▼──────┐
        │  THE STORE — per person, written, private               │
        │  PROFILE · PROGRAM · RELEASE · LOG · THREAD             │
        │  today: localStorage (one browser)                      │
        │  decided: Supabase + row-level security                 │
        └─────────────────────────────────────────────────────────┘
```

---

## The surfaces

| Surface | Who | File | State |
|---|---|---|---|
| **Onboarding** | Client | `onboarding.html` | Built |
| **Coach Console** | You + Claude | `coach.html` | Built |
| **Dashboard** | Client | `dashboard.html` | Built |
| **Work Mode** | Client | — | **Not built** |

Supporting, not surfaces in their own right:

| | Who | File | Note |
|---|---|---|---|
| **Exercise Library** | Both | `library.html`, Learn tab | A *view* of `catalog.json`, not its own data |
| **Client Profile** | You | `profile.html` | Printable read of a PROFILE; superseded by the console's rail |

Also in the repo and outside this map: `js/` (the older module app — see Break 4),
`feed.html`, `hero.html`, `preview.html`, `mark-compare.html` (marketing/dev).

---

## The five records

Everything that crosses a boundary is one of these. If a feature needs a sixth,
stop and design it — don't quietly widen one of these.

| Record | Written by | Read by | Notes |
|---|---|---|---|
| `PROFILE` | Onboarding | Everyone | Immutable once taken. Edits create a version, never overwrite. Contains PAR-Q + pain map = **health data**. |
| `PROGRAM` | Coach Console | Dashboard, Work Mode | Sessions, blocks, prescriptions, the arc, and the reasoning per layer. |
| `RELEASE` | Coach Console | Dashboard | Which pieces are visible. **Its own record on purpose** — unlocking must never mean rewriting the program. |
| `LOG` | Dashboard, Work Mode | Coach Console | Append-only. The app promises the user on screen that nothing is deleted. |
| `THREAD` | Both | Both | Coach ↔ client messages. **Does not exist yet.** |

### Current storage keys (prototype)

| Record | Key |
|---|---|
| `PROGRAM`, `RELEASE` | `fj.v1.<userId>.coach` |
| `LOG`, client state | `fj.v1.<userId>.dash` |
| `PROFILE` | *not stored yet* — still inline in the page |

Keys are user-scoped as of 2026-08-12, so swapping `USER` swaps the whole app to
a different person with no other change. The store behind them is still
localStorage; Supabase replaces the backend, not the key shape.

---

## The breaks that exist today

**Break 1 — the console and the dashboard only talk on one browser.**
`RELEASE` is in `localStorage`. Both pages read the same key, so the unlock works
on one machine and not at all across two. The coach→client unlock is currently a
demo, not a feature.

**Break 2 — onboarding is connected to nothing.**
Per `docs/AUDIT.md`: the survey writes two keys and builds a link; nothing in the
app reads any of it. Ozzy's answers reached his dashboard because they were
pasted in by hand.

**Break 3 — CLOSED 2026-08-12 for the dashboard; onboarding still open.**
`js/data/exercises.js` is now the single source; `spine/catalog.json` is generated
from it, and `dashboard.html`'s `EX` block is generated from the spine
(`tools/build-app-data.mjs`) rather than hand-written. The build fails if the app
uses a movement the spine does not have.

Still to do: **onboarding's `deckart` island is the last hand-kept copy.** It
should be generated from the catalog the same way.

**Break 4 — RESOLVED 2026-08-12: one app, many users.** See below.
`index.html` + `js/` and the standalone `dashboard.html` currently share no code.
They get merged into one shell rather than one being thrown away.

---

## The invariants

Rules the build enforces, so they cannot drift back. `node tools/build-spine.mjs`
exits non-zero if either is broken.

1. **If onboarding asks a person about a movement, the database holds it.**
   Not a judgement call. A question we ask and then cannot name is precisely what
   put stick figures in front of Ozzy. Fix the database — never remove the question.
2. **If a program prescribes a movement, the database holds it.** Same rule, other
   direction.

Added 2026-08-12 after the deck was found asking about four movements — back
squat, bench press, overhead press, bodyweight squat — that the library had no
entry for.

---

## One app, many users — the structure that scales

The question is not "one app or several". It is **what varies per person, and
what varies per role.** Get those two axes right and this scales from Ozzy to a
thousand people without a second codebase.

### One codebase. One deployment. Two roles.

```
                       ┌───────────────┐
                       │   sign in     │   magic link (Supabase auth)
                       └───────┬───────┘
                               │ role, read off the user row
                 ┌─────────────┴─────────────┐
            role = client                role = coach
                 │                            │
        ┌────────▼────────┐         ┌─────────▼─────────┐
        │ Today · Log     │         │ Client list       │
        │ Learn · Me      │         │   └ Coach Console │
        │ Work Mode       │         │      per client   │
        └─────────────────┘         └───────────────────┘
                 └──────── same spine, same store ───────┘
```

**The Coach Console is not a second product.** It is the coach's view of the same
system, in the same codebase, behind the same login. Two roles, not two apps.

### What varies, and where it is allowed to live

| Varies by | Lives in | Example |
|---|---|---|
| Nothing — universal | **the spine** | 301 movements, benchmarks, the palette options |
| The person | **the store**, one row per user per record | Ozzy's PROFILE, PROGRAM, LOG |
| The role | **routing**, one flag on the user row | client sees Today; coach sees a client list |
| The person's taste | **the store** (`neon` on PROFILE) | Ozzy picks Violet; nobody else changes |

### The one rule that makes it scale

**Nothing is ever keyed by a person's name.** Storage is
`fj.v1.<userId>.<record>`, routes are `/coach/client/<userId>`, and the console
loads whichever client it is pointed at.

The moment a client id is hard-coded into a file, that file is a one-off — and
one-off-per-client is exactly the trap this is one step from today: `A = { name:
'Ozzy', … }` is still inline in `dashboard.html`, and the console's ten layers
are still written about one person. **That is the next thing to fix after the
store lands.**

### What happens to the two existing apps

- **Keep `js/`.** Its `store.js` boundary, the runner and the format renderers are
  the Work Mode foundation; there is no reason to rewrite them.
- **Keep the dashboard's screens.** They are the newer, better surface.
- **Merge into one shell** — `js/` supplies the engine, the dashboard supplies the
  surface, the spine supplies the data, one `index.html` routes by role.
- Do the merge **before** Work Mode. Work Mode is the largest consumer of the
  runner, and building it twice is the one genuinely wasteful outcome available.

### What does not scale and should be retired

- A separate HTML file per client.
- Client data inlined in a page (`const A = {…}`).
- `profile.html` as a second reader of the payload — the console's rail does it
  better already.

---

## The spine, specified

```
spine/
  catalog.json       every movement, one id, one truth
                     { id, name, pattern, family, kit[], measure,
                       load, laterality, level, diff, cues[],
                       mistakes[], easier, harder, art, video,
                       benchmark, noPR }
  art.manifest.json  id → { file, status: drawn|source|missing, note }
  benchmarks.json    id → ranks by sex (from FOR NICOLAS/*.csv)
  theme.json         palettes, incl. the 3–4 selectable neon colours
  schema.json        the PROFILE payload contract (v6, v7…)
```

Generated by `tools/` from the authoring sources; consumed read-only by every
surface. No surface may hold its own copy of a movement.

---

## Design-layer rules (glitch resistance)

These exist so the theme and motion work can't rot the system.

1. **No component ever names a colour.** Every hex lives in `theme.json` /
   `:root`. A theme switch that needs a component edit is a broken theme system.
2. **Animate only `transform`, `opacity`, `stroke-dashoffset`.** Those run on the
   compositor. `box-shadow` and `filter` animations repaint every frame.
3. **One animation owner per element.** Two keyframes on one node is the single
   most common source of flicker.
4. **`prefers-reduced-motion` honoured once, globally** — not per component.
5. **Nothing animates off-screen.** One `IntersectionObserver`, applied everywhere.
6. **Glow is budgeted.** Structure and the one focused element. Never the tenth
   card in a list — it is paint-heavy on a phone held in bed.

---

## Build order

1. ~~**The spine**~~ — DONE 2026-08-12. `catalog.json` (305 movements) + `theme.json`
   (4 switchable neons). Dashboard data is generated from it.
2. **The store** — Supabase, RLS verified on before any key is committed
   (sequence in `docs/BACKEND.md`; it is not a formality — this is health data in
   a public repo). Ends Break 1 and Break 2.
3. **Merge the two apps into one shell** (Break 4 is decided: one app, many users) —
   `js/` engine + dashboard surface + spine data, routed by role.
4. ~~**The coach message bubble**~~ — DONE 2026-08-12 (unread pill, neon-yellow
   bubble, tick to clear). The THREAD record behind it still needs the store.
5. **The visual pass** — first cut DONE 2026-08-12: punch-word header, ECG
   heartbeat, travelling outline, four switchable neons. Remaining: heavier neon
   depth once the store lands.
6. **Work Mode.**

**Do not build the visual layer before the spine.** A colour system retro-fitted
across ten screens is a week of work that should have been an afternoon.
