# AUDIT — Fitness Journey, as it actually is

Phase 0 deliverable. **No behaviour was changed to produce this document.**

Audited at commit `6265160` (2026-08-07), the current tip of `origin/main`.

Everything below is a statement of fact about the code as it stands, with file
and line references. Where something is a judgement rather than a fact, it says
so. Nothing here is a proposal — proposals belong to Phase 1.

---

## 0. Summary for the reader who has five minutes

The codebase is in better shape than the migration brief assumed in one
respect and worse in another.

**Better:** `store.js` really is a clean boundary. Ninety-nine call sites across
thirteen files go through it, and not one screen reaches around it to touch
storage. That discipline is the reason Phase 2 is a mechanical job rather than a
rewrite.

**Worse:** the survey and the app are not merely poorly connected. **They are
not connected at all.** `onboarding.html` writes two localStorage keys and
builds a link to `profile.html`. Nothing in `js/` reads any of it — there is no
import, no key reference, no dead branch waiting to be switched on. The
integration described in Phase 3 is not a matter of wiring up something
half-built; it does not exist yet.

Four numbers that frame the work:

| | |
|---|---|
| Storage calls outside `store.js` | **28**, in 4 files |
| Store call sites to convert to `await` | **99**, in 13 files |
| Lines of dead code still shipped and precached | **~1,250** |
| Survey fields the app can currently consume | **0 of 26** |

And one thing that is not in the brief but should be: **`build-sw.mjs` is
dangerous to run.** See §7.

---

## 1. Every place state is read or written

### 1.1 The storage key map — the real shape of what's on a device

| Key | Written by | Holds |
|---|---|---|
| `fj.user` | `js/users.js` | id of the active user (`nico` \| `partner`) |
| `fj.name.<uid>` | `js/users.js` | that person's display name, set from `?name=` |
| `fj.migrated.v2` | `js/users.js` | ISO timestamp — marks the one-time key migration as done |
| `fj.v1.<uid>` | `js/store.js` | **everything the person did** — see §3.1 |
| `fj.run.<uid>` | `js/runner/runstate.js` | the live workout — see §3.3 |
| `fj.voiceName` | `js/timer.js` | chosen speech-synthesis voice |
| `fj.v1`, `fj.run` | *(legacy)* | pre-multi-user data, deliberately left in place as a safety copy |
| `fj_profiles` | `onboarding.html` | array of every completed survey on this device |
| `fj_current` | `onboarding.html` | the most recent completed survey |

Two things to notice.

The app uses **dots** (`fj.v1.nico`). The survey uses **underscores**
(`fj_profiles`). Two naming conventions for one product, which is a symptom of
the two halves having been built without reference to each other.

More importantly: **the survey's keys are not namespaced by user.** `fj.v1.nico`
and `fj.v1.partner` cannot collide. `fj_current` is a single global slot. Two
people filling in the survey on the same device overwrite each other. This is
fine today, because the survey is a one-shot link, and it is exactly the kind of
thing that stops being fine the moment a trainer demos the survey on their own
phone.

### 1.2 The 28 references outside `store.js` — the Phase 2 work order

This is the list the brief asked for. Every one of these has to end up behind
the adapter.

**`js/users.js` — 14 live references** *(17 matches; lines 4, 37 are prose in comments)*

| Line | Operation |
|---|---|
| 59 | `getItem(ACTIVE_KEY)` — in `isClaimed()` |
| 67 | `setItem(ACTIVE_KEY, id)` — in `claimDevice()` |
| 85 | `setItem(ACTIVE_KEY, q)` — `?user=` in the URL claims the device |
| 91 | `getItem(ACTIVE_KEY)` — in `activeUserId()` |
| 102 | `setItem(NAME_KEY(uid))` — in `setDisplayName()` |
| 106 | `getItem(NAME_KEY(uid))` — in `displayName()` |
| 124 | `setItem(ACTIVE_KEY, id)` — in `switchUser()` |
| 137 | `getItem(MIGRATED_KEY)` — migration guard |
| 138 | `getItem('fj.v1')` — legacy read |
| 139 | `getItem(storeKey('nico'))` — collision check |
| 140 | `setItem(storeKey('nico'))` — legacy copy |
| 142 | `getItem('fj.run')` — legacy read |
| 143 | `getItem(runKey('nico'))` — collision check |
| 144 | `setItem(runKey('nico'))` — legacy copy |
| 146 | `setItem(MIGRATED_KEY)` — mark done |

**`js/runner/runstate.js` — 3 live references** *(line 4 is prose)*

| Line | Operation |
|---|---|
| 32 | `getItem(KEY())` — `load()` |
| 34 | `setItem(KEY())` — `save()` |
| 35 | `removeItem(KEY())` — `clear()` |

These three are the whole file's persistence surface, which is good news: the
run state is the most safety-critical data in the product (§3.3) and it is
touched in exactly three places.

**`js/timer.js` — 2 references**

| Line | Operation |
|---|---|
| 18 | `getItem('fj.voiceName')` — read at module load, synchronously, into a top-level `let` |
| 36 | `setItem('fj.voiceName')` — in `setVoiceName()` |

Line 18 is the single most awkward conversion in Phase 2 and is called out
separately in §2.3.

**`onboarding.html` — 3 references**

| Line | Operation |
|---|---|
| 2425 | `getItem('fj_profiles')` — in `saveLocal()` |
| 2427 | `setItem('fj_profiles')` |
| 2428 | `setItem('fj_current')` |

**`js/app.js` (lines 38, 105)** contain the word `localStorage` in explanatory
comments only. No operations. **`sw.js`, `build-sw.mjs`, `README.md`** likewise.

**`js/store.js` — 3 references (lines 37, 48, 406).** These are the ones that are
*supposed* to be there, and after Phase 2 they should be the only ones left in
the entire codebase.

---

## 2. Every synchronous assumption about the store

### 2.1 The shape of the problem

`store.all` is a **getter** (`js/store.js:63`) that calls `read()`, which calls
`localStorage.getItem` and `JSON.parse` synchronously and returns a fully
materialised object. Every one of the store's ~45 methods calls `read()` or
`write()` the same way. Not one returns a Promise.

**99 call sites** across 13 files depend on this. They break the moment the API
returns a Promise — not with an error, but by silently rendering `[object
Promise]` or `undefined`, which is worse.

### 2.2 Call sites by file

| File | Calls |
|---|---|
| `js/screens/day.js` | 18 |
| `js/runner/workmode.js` | 16 |
| `js/screens/b-home.js` | 15 |
| `js/screens/b-day.js` | 13 |
| `js/coach.js` | 12 |
| `js/beginner.js` | 9 |
| `js/screens/history.js` | 6 |
| `js/screens/b-summary.js` | 6 |
| `js/screens/b-history.js` | 5 |
| `js/screens/week.js` | 4 |
| `js/users.js` | 1 |

### 2.3 The six that need thought, not mechanics

Most of the 99 are `store.getX()` inside a render function — add `await`, make
the function `async`, done. These six are not:

1. **`js/beginner.js:73`** and **`:82`** — `store.all.sessions.filter(...)` and
   `.some(...)` inside functions that are called from render paths. The chain
   `store.all.sessions.filter` has to become
   `(await storage.getState()).sessions.filter`, and every caller up the chain
   becomes async with it.

2. **`js/screens/week.js:28`** — same pattern, inside a `.some()` callback used
   to decide whether a day is marked done. Callbacks passed to `Array.some`
   cannot be async and still work: `some` does not await, so an async predicate
   returns a Promise, which is always truthy, and **every day would render as
   completed**. This one will produce a wrong answer rather than a crash. It
   must be restructured, not annotated.

3. **`js/runner/workmode.js:1001`** — `try { all = store.all.sessions } catch {}`
   inside the live workout. The `try/catch` currently protects against a parse
   failure; once async, a rejected Promise will not be caught by that block at
   all.

4. **`js/screens/history.js:41`** and **`js/screens/b-history.js:42`** —
   `const all = store.all` at the top of a render function. The two easiest of
   the six.

5. **`js/timer.js:18`** — a top-level IIFE reading storage at *module load*:
   ```js
   let savedVoiceName = (() => { try { return localStorage.getItem('fj.voiceName') || ''; } ... })();
   ```
   ES modules cannot block on a Promise at evaluation time. This becomes either
   a lazy read on first use or an explicit `init()` the app awaits at boot.
   It is small, but it is the one place where "just add await" is not available.

6. **`js/users.js:151`** — `migrate()` is **called at module load**, at the very
   bottom of the file, and it performs seven storage operations. Anything that
   imports `users.js` currently gets migration-already-done as a guarantee. Once
   async, that guarantee disappears, and `store.js` — which imports `storeKey`
   from `users.js` — could read a key before migration has moved the legacy data
   into it. **This is the sequencing risk in Phase 2 and the one most likely to
   silently lose data.** It needs an explicit awaited boot step.

### 2.4 A structural note

`activeUserId()` (`js/users.js:73`) is synchronous and is called by
`storeKey()`, which is called by `KEY()` in both `store.js` and `runstate.js` on
**every single read and write**. Making identity async makes key resolution
async, which makes everything downstream async. This is not an argument against
doing it — it is an argument for resolving the active user **once** at boot into
a module-level value, so key resolution stays synchronous even when the data
behind it is not.

---

## 3. The real data model, as it exists

### 3.1 `fj.v1.<uid>` — the store (`js/store.js:13–33`)

| Field | Type | Meaning |
|---|---|---|
| `goals` | `null \| object` | overrides the default goal focus |
| `sessions` | `array` | **completed session logs — the irreplaceable data** |
| `prs` | `{ exId: { value, unit, date, weight?, l?, r? } }` | personal records |
| `lastValues` | `{ exId: { reps, weight, hold } }` | pre-fill for the next session |
| `swaps` | `{ sessionId: { fromExId: toExId } }` | per-session exercise swaps |
| `removed` | `{ sessionId: [exId] }` | exercises removed from a session |
| `order` | `{ sessionId: { blocks:[name], items:{name:[exId]} } }` | manual reordering |
| `added` | `{ sessionId: { blockName: [{ex, ...prescription}] } }` | exercises added |
| `fillerSwaps` | `{ sessionId: { blockName: exId } }` | rest-superset filler swap |
| `startDate` | `'YYYY-MM-DD'` | first app open — drives "which week am I in" |
| `settings` | `{ schedule, lastCoachSend }` | |
| `habits` | `{ 'YYYY-MM-DD': { walk, no8pm, protein, sport } }` | beginner daily habits |
| `checks` | `{ 'date\|sessionId\|exId': [bool] }` | per-set checkboxes |
| `notes` | `[{ date, sessionId, exId, name, text }]` | |
| `flags` | `[{ date, sessionId, exId, name, text }]` | pain / "KNEE" flags |
| `blockSkips` | `{ sessionId: { blockName: bool } }` | explicit do-it/skip |
| `feedback` | `[{ date, sessionId, name, rating, text }]` | `rating: 'easy'\|'right'\|'hard'` |

A logged session (pushed to `sessions` by `saveSession`, `js/store.js:200`):

```
{ date, name, blocks: [ { entries: [ {
    exId, name, measure, unit, load, rounds?, noPR?,
    sets: [ { value, side?, weight? } ]
} ] } ] }
```

**Every key except `sessions` and `prs` is derived, cosmetic, or
reconstructible.** `sessions` and `prs` are the only data that cannot be
regenerated if lost. Any migration, sync or merge design should treat those two
as the protected core and everything else as cache. `importJSON`
(`js/store.js:375`) already reflects this instinct — it merges `sessions` by
`date|name` and keeps the better of two PRs — and that instinct should carry
into the Phase 1 schema.

**Note for Phase 1:** the `{ sessionId: ... }` maps assume `sessionId` is unique
and stable forever. Once programs are authored per client rather than compiled
in, that is no longer automatic. Session ids will need to be real ids.

### 3.2 `js/users.js` — identity

`USERS` (`js/users.js:23–45`) is a **compile-time constant with exactly two
entries**, `nico` and `partner`. Each carries `id`, `name`, `short`, `ui`
(`'pro' \| 'beginner'`), `programId`, `profile`, `accent`.

Per-device, per-user, in storage: the active id and a display name.

The rest — which UI you get, which program you are on, your training profile —
is **source code**. Onboarding a real client today means editing this file and
redeploying. This is the blocker the brief names, and the audit confirms it
exactly as described.

The comment at lines 35–37 is worth preserving as a rule: no real name lives in
the source, because the repo is public. The name arrives once via `?name=` and
stays on that person's device.

### 3.3 `fj.run.<uid>` — the live workout (`js/runner/runstate.js:16–29`)

```
plan, startedAt,
bi, ii, si, ci, round, sub          // block/item/set/circuit/round/phase cursor
amrapRounds, iv, ivPhase
stepStartedAt, stepDur, stepPausedAt
pausedAccum, pausedAt
blockStart, blockTimes
captured, done
```

Every clock is derived from wall-clock timestamps rather than counted, which is
precisely why a frozen or discarded tab resumes correctly. **This is the most
carefully built thing in the codebase and the easiest to break by accident.**
Phase 2's verification step — start a workout, background it, reload
mid-session, confirm it resumes — is the right test, and it is testing this file.

One consequence worth stating plainly: `plan` is a **fully resolved workout
embedded in the run state**. A run in progress does not depend on the program
data that produced it. That is a genuinely good property and it should survive
the move to a server: a client mid-workout on a train with no signal must not
need anything fetched.

### 3.4 `onboarding.html` — the survey's model

`payload()` (`onboarding.html:2410`) produces:

```js
{ v: 6, at: <ISO timestamp>, a: A }
```

`A` is a flat answer bag, keyed by the `key` field of each step in `FLOW`
(`onboarding.html:918`). Twenty-six fields; see §6.1.

There is **no user id, no account, no status, no `createdAt`/`updatedAt` pair,
and no stable identifier of any kind.** The only identity in the payload is
whatever the person typed into `name` and `email`. For Phase 1 this is the
single most important gap to close, because a record with no id cannot be
updated, assigned to, or linked from anything.

---

## 4. Duplication

### 4.1 Two exercise libraries, live

| | `js/data.js` | `js/data/exercises.js` |
|---|---|---|
| Entries | 17 exercises (+ 9 config blocks) | **252** |
| Schema | `name, measure, load, laterality, pattern, repSec` | `name, pattern, family, region, equipment[], measure, workType, load, laterality, level, diff, dual, main, ess, noPR, grip, methods[], easier, harder, rx, demoUrl, cues` |
| Status | reachable only from `js/composer.js`, which is itself orphaned (§5) | live |

**Eight ids exist in both files with different schemas:** `dip`, `pushup`,
`shoulder_tap`, `hollow_hold`, `planche_lean`, `chest_stretch`, `thoracic_open`,
`shoulder_stretch`.

This is currently harmless, because everything that reads `data.js` is dead. It
becomes a real bug the moment someone revives `composer.js` — and given that the
session composer is a named future feature, someone will.

### 4.2 Three vocabularies for the same movements

This is the most consequential duplication in the repo, because it is what the
exercise-card work runs into.

| The movement | Survey deck id | App exercise id |
|---|---|---|
| Push-up | `pushup` | `pushup` ✓ |
| Bulgarian split squat | `lunge` **and** `split` | `bulgarian_split` |
| Single-leg RDL | `slrdl` | `single_leg_rdl` |
| Deadlift | `dead` | `deadlift` |
| Romanian deadlift | `rdl` | `romanian_deadlift` |
| Hip thrust | `thrust` | `hip_thrust` |
| Kettlebell swing | `kbswing` | `db_swing` *(dumbbell variant only)* |
| Jump squat | `jumpsquat` | `jump_squat` |
| Pike push-up | `pike` | `pike_pushup` *(in the dead `data.js`)* |

The survey uses short mnemonic ids. The app uses `snake_case` full names. They
agree on exactly one id out of twenty-two, and in one case (`lunge` / `split`)
**the survey uses two different ids for the same exercise** in its two decks.

The build sheet specifies image filenames keyed to the ids in
`js/data/exercises.js` (`bulgarian_split.png`). The survey cannot use those
files without a mapping table. **Phase 1's schema is where this gets settled
once**, and the card work in §6.3 depends on it.

### 4.3 Duplicated icon files

`icon-180.png`, `icon-192.png`, `icon-512.png`, `icon-512-maskable.png` exist
**both at the repo root and in `images/`**. `index.html:14–15`,
`manifest.webmanifest:13–15` and `onboarding.html:18` all reference the **root**
copies. The `images/` copies are unreferenced but are still precached by the
service worker. ~33 KB of the offline shell is a duplicate.

---

## 5. Dead code

Nothing has been deleted. This is the list, with evidence.

### 5.1 Orphaned JavaScript — ~1,250 lines, all precached

| File | Lines | Evidence |
|---|---|---|
| `js/runner.js` | 488 | no import anywhere; superseded by `js/runner/workmode.js` |
| `js/screens/program.js` | 259 | no file imports `screens/program.js` |
| `js/screens/library.js` | 228 | imported **only** by `js/screens/program.js:15` — transitively dead |
| `js/composer.js` | 181 | no import anywhere |
| `js/data.js` | 92 | imported **only** by `js/composer.js:8` — transitively dead |

All five appear in the `sw.js` precache list (`sw.js:38, 40, 49, 59, 60`), so
every user downloads and caches all of it on install.

`js/screens/library.js` is dead, but `library.html` is a separate live page that
imports `js/data/exercises.js` directly. Do not conflate the two when the time
comes to delete.

### 5.2 Files the brief asked about

| File | Verdict |
|---|---|
| `onboarding.v5.bak` (72 KB) | **dead.** A backup of a superseded survey. Not served, not linked. |
| `hero-torso.png` (831 KB) + `hero-torso.webp` (150 KB) | **dead — and expensive.** Referenced by *no* file in the repo, including `hero.html`. **981 KB of a 1.4 MB offline shell.** The single biggest easy win in the repo. |
| `preview.html` (219 lines) | **standalone, unlinked.** A design preview. Harmless but not part of the product. |
| `feed.html` (720 lines) | **standalone, unlinked.** The exercise-deck feed prototype. |
| `mark-compare.html` (221 lines) | **standalone, unlinked.** A wordmark comparison page. |
| `hero.html` (342 lines) | **standalone, unlinked.** |

**No page in the repo contains an `<a href>` to any other page.** All navigation
between `index.html`, `onboarding.html`, `profile.html` and `library.html`
happens by typed or shared URL. That is not itself a bug, but it means "is this
page reachable?" cannot be answered from the code — only from what has been
shared with whom.

### 5.3 Not dead, but idle

`onboarding.html:2407` — `const ENDPOINT = '';`. The survey has a fully written
`postEndpoint()` that POSTs the payload as JSON to a configured URL, and it is
switched off by an empty string. Worth knowing in Phase 3: a transport already
exists in outline.

---

## 6. What the survey collects vs. what the app can consume

### 6.1 What the survey collects — 26 fields

| Chapter | Key | Type | Value |
|---|---|---|---|
| 1 · You | `name` | text | first name |
| | `age`, `sex`, `heightCm`, `heightUnit`, `weightKg`, `unit` | vitals | the basis for every benchmark and starting load |
| 2 · Going | `horizon` | multi (≤3) | long-range aims |
| | `focus` | ranked (2) | `strong`/`lean`/`muscle`/`pain`/`energy`/`wind` |
| 3 · Now | `tracker` | single | Apple / Whoop / Oura / Garmin / other / none |
| | `metric` | ranked | which numbers they watch *(skipped if no tracker)* |
| | `shape` | silhouette | body shape now + desired |
| | `weightTend` | single | loses / gains / stable |
| | `where` | multi | gym / home+kit / home / outdoor / hotel |
| | `kit` | equipment | what they own *(skipped if no home kit)* |
| 4 · Training | `deck` | per-card | **for each of 12 movements: can they do it, and at what band** |
| | `feelings` | multi | what they enjoy |
| 5 · Week | `when` | single | when training actually happens |
| | `days` | stepper 1–6 | days they can protect |
| | `length` | single | session length |
| 6 · Why | `driver` | single | the real motivation |
| | `blockers` | multi | what stopped them before |
| 7 · Health | `parq` | multi | **PAR-Q screening — 8 medical conditions** |
| | `pain` | body map | 16 regions, front and back, with free text |
| 8 · Plan | `checkin` | single | weekly check-in day |
| | `email` | text | where to send the program |

Derived by the survey itself (`deriveLevels()`, `onboarding.html:~1272`):
`levels` (`{gym, body}` each `New`/`Some`/`Confident`), `patterns` (movement
patterns they can already do), `patternsTotal`, `calibrate`, `cardsNow`,
`intensity`, `ready`, `trainDays`.

This is a genuinely rich intake. `parq` and `pain` are **health data about a
real person** and should be treated as the most sensitive thing the product
holds — relevant to the row-level-security decision in Phase 1.

### 6.2 What the app can consume — nothing

Verified by search: **no file under `js/` references `fj_current`, `fj_profiles`,
`profile.html`, or `onboarding` in any form.**

The survey's two outputs both terminate:

- `saveLocal()` writes `fj_profiles` and `fj_current` — read by nothing.
- `profileLink()` base64-encodes the payload into `profile.html#…` —
  `profile.html:199` decodes it and renders the coach dossier. That page is a
  **read-only view**. It writes nothing and hands off to nothing.

So the survey → app gap is total. Mapping the 26 collected fields onto what the
app needs to build a program — `programId`, `ui` mode, profile, benchmark
levels — **is the Phase 3 work**, and none of it is started.

The one genuine piece of luck: `deck` and `levels` are already close in spirit
to what a program assignment needs. A person who can do 9+ of the 12 movements
is `Confident`; the app already branches on `ui: 'pro' | 'beginner'`. The
bridge is short. It just is not built.

### 6.3 The exercise cards — the gap, precisely

The survey shows a 12-card deck. Which deck depends on the answers: `GYM_DECK`
if they have loads available, `BODY_DECK` otherwise (`deckSet()`,
`onboarding.html:~1265`). Twenty-two distinct movements across the two.

Artwork lives in `<script type="application/json" id="deckart">` at
`onboarding.html:2730` — **10 WebP images, 27–54 KB each, 538 KB of the 685 KB
file.** Movements without artwork fall back to the `POSE` stick-figure SVGs
(`onboarding.html:~1150`).

**Current coverage: 10 of 22.**

| Deck id | Movement | Card art today | Image in `EXERCISE LIBRARY/` |
|---|---|---|---|
| `pushup` | Push-up | ✅ | `push-up-anime.png` |
| `bwsquat` | Bodyweight squat | ✅ | `bodyweight-squat-anime.png` |
| `pullup` | Pull-up | ✅ | `pull-up-anime-male.png` |
| `hang` | Dead hang | ✅ | `dead-hang-anime.png` |
| `kbswing` | Kettlebell swing | ✅ | `kettlebell-swing-anime.png` |
| `jumpsquat` | Jump squat | ✅ | `jump-squat-anime.png` |
| `mtnclimb` | Mountain climber | ✅ | `mountain-climber-anime.png` |
| `wallsit` | Wall sit | ✅ | `wall-sit-anime.png` |
| `lunge` | Bulgarian split squat | ✅ | `bulgarian-split-squat-anime.png` |
| `split` | Split squat *(gym deck)* | ✅ | *(same image, second id)* |
| `slrdl` | Single-leg RDL | ❌ stick figure | ✅ **`single-leg-rdl-*-contralateral-corrected.png`** |
| `invrow` | Inverted row | ❌ stick figure | ✅ **`inverted-row-squat-rack-barbell-lower-v2.png`** |
| `pike` | Pike push-up | ❌ stick figure | ✅ **`pike-push-up-anime-transparent-v2.png`** |
| `bench` | Bench press | ❌ stick figure | ✅ **`flat-barbell-bench-press-anime.png`** |
| `thrust` | Hip thrust | ❌ stick figure | ~ `banded-glute-bridge-anime.png` / `45-degree-hip-extension-anime-male.png` — **neither is a hip thrust** |
| `squat` | Back squat | ❌ stick figure | ❌ *(`deep-squat-anime.png` is a mobility squat, not barbell)* |
| `dead` | Deadlift | ❌ stick figure | ❌ |
| `rdl` | Romanian deadlift | ❌ stick figure | ❌ |
| `ohp` | Overhead press | ❌ stick figure | ❌ |
| `row` | Row | ❌ stick figure | ❌ |
| `carry` | Farmer carry | ❌ stick figure | ❌ |
| `plank` | Plank *(in both decks)* | ❌ stick figure | ❌ |

**Four movements can be filled from art that already exists** — `slrdl`,
`invrow`, `pike`, `bench`. **Seven have no usable image yet**, and they are
almost all barbell movements, which is the gym deck. `thrust` is a judgement
call: the two nearest images are different exercises and using one would be
teaching the wrong movement.

Also present but not in either deck: `chest-to-bar-pull-up`,
`l-sit-pull-up`, `muscle-up-three-position`, `planche-lean-push-up`,
`banded-pull-apart`, `banded-wall-sit`, `deep-squat`,
`45-degree-hip-extension`, `banded-glute-bridge`, plus three
`bulgarian-split-squat` variants — 12 further images, and a `Body Shape/`
folder of 12 male body-type renders which are a **different feature**: the
`shape` question at `onboarding.html:968` currently uses drawn SVG silhouettes
(`silSvg()`), not photographs.

**Three constraints that govern this work:**

1. **The survey must stay self-contained.** No external files. New card images
   must be base64-inlined into the `deckart` island like the existing 10.
2. **Therefore size is the whole problem.** The source PNGs are **306 KB –
   1,297 KB each**. The 10 shipped cards are **27–54 KB WebP**. That is roughly
   a 15× reduction. Adding 12 more at source size would push `onboarding.html`
   past 7 MB and destroy the first-paint work that was just committed. Every new
   card has to go through the same downscale-and-WebP pass. At ~40 KB each,
   twelve more cards costs ~480 KB — taking the file from 685 KB to ~1.2 MB,
   which is a real cost and needs a deliberate yes.
3. **The id mismatch in §4.2 has to be resolved first**, or the images get
   named twice — once for the survey's `slrdl` and once for the app's
   `single_leg_rdl`.

---

## 7. Finding not in the brief: `build-sw.mjs` is unsafe to run

`build-sw.mjs` builds the service worker's precache manifest by **walking the
filesystem** (`walk()`, line 27) and skipping a hardcoded list (`SKIP_DIR`,
line 23: `.git`, `.claude`, `node_modules`, `.DS_Store`, `dist`). It has no
knowledge of what git tracks.

Any folder sitting in the working directory is therefore shipped into the
manifest. Running it during this audit swept in **23 paths** from two untracked
folders (`EXERCISE LIBRARY/`, `fitness-journey-update/`) — files that do not
exist on the live site.

The consequence is not cosmetic. A precache manifest is atomic: if one entry
404s, the whole `install` step rejects, the service worker never activates, and
**offline mode silently stops working** — on a product whose core promise is
that a workout survives anything.

The `sw.js` that was committed in `6265160` was generated from a clean clone and
is correct. But the next person to run `node build-sw.mjs` from this working
directory will publish a broken service worker with no warning that anything
went wrong.

*Judgement, not fact:* the fix is to have `walk()` take its file list from
`git ls-files` instead of the disk. This is small, and it closes the hole
permanently rather than depending on the working directory being tidy.

**Also currently in the precache and not needed:** `hero-torso.png` +
`hero-torso.webp` (981 KB, referenced by nothing), the duplicate `images/icon-*`
set (~33 KB), and the ~1,250 lines of dead JS in §5.1. The offline shell is
1,425 KB; roughly **1 MB of it is waste.**

---

## 8. What this means for Phases 1–3

Stated as findings, not proposals.

**Phase 1 must settle the id vocabulary (§4.2)** before anything else, because
the survey, the app and the image build sheet currently use three different
names for the same movement, and every later phase inherits whichever one is
chosen.

**Phase 1's schema must give the intake a real id (§3.4).** The current payload
has none. A record with no id cannot be assigned a program, updated by a
trainer, or linked to a log — which is the entire Phase 4 list.

**Phase 2's risk is concentrated in six call sites (§2.3), not ninety-nine.**
The rest is mechanical. `js/screens/week.js:28` is the one that will produce a
*wrong answer* rather than a crash, and `js/users.js:151` is the one that could
*lose data*. Both deserve explicit attention rather than a sweep.

**Phase 2 should resolve identity once at boot (§2.4)** so that key resolution
stays synchronous. Otherwise every read and write in the product inherits an
async dependency it does not need.

**Phase 3 starts from zero, not from something half-wired (§6.2).** There is no
partial integration to finish. The upside is that there is also nothing to
unpick.

**`sessions` and `prs` are the only irreplaceable data (§3.1).** Whatever sync
model arrives, those two need to be the most conservative part of it.

---

## Definition of Done

- [x] `docs/AUDIT.md` committed
- [x] No behaviour changed
- [ ] Owner has read the summary — **awaiting Phase 1 gate**
