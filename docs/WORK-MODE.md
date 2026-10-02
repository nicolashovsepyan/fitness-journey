# WORK MODE — the live timer

**Owner:** the dedicated "Work Mode" chat. Every change to the live workout
timer is designed, built and logged from that chat.

**Files it owns:** `js/runner/workmode.js`, `js/runner/runstate.js`,
`js/timer.js`, `js/data/formats.js`, `js/runner/quick.js`, `js/runner/ring.js`, `ring-lab.html`.
Other chats: do not edit these. If your work needs a Work Mode change, write
it under "Requests from other chats" at the bottom and leave it.

**Ship rule:** a Work Mode change is not done until `whatsnew.json` is bumped, and it is committed, pushed
and live at https://nicolashovsepyan.github.io/fitness-journey/ , and a line
is added to the Changelog below. Users get it on their next app open.

Two jobs, one engine:

1. **Program mode.** Runs a day from the user's released program
   (`dashboard.html` → `index.html?run=<dayId>` → `startWorkout(plan)`).
2. **Quick Timer (free mode).** A standalone interval timer, like GymBoss or
   SmartWOD: pick a format, set minutes / rounds / exercises, go. **v1 live
   27 Sep:** `index.html?quick`, entry in the dashboard's Workouts tab.
   Plan: a small setup screen builds a RunPlan and hands it to the SAME
   runner, so every timer fix lands in both modes at once.

---

## Audit, 27 Sep 2026

### Done and solid

| Area | Notes |
|---|---|
| Timestamp clocks | Session clock and step countdown are computed from wall-clock time, so they are correct after the screen locks. `runstate.js` |
| Persisted run | Every change is saved; app reopen drops you straight back into the workout, never the home screen. `app.js` `bootIntoActiveRun` |
| Session clock | Total elapsed, top right, on every screen. |
| Formats that run | Straight, tempo (shows tempo text), Yates (warm-up ramp + all-out set), isometric holds, skill (practice timer / holds / reps), superset (A1→A2, rest after pair, weight per round), circuit (rounds, set-up buffer before holds, log during round rest), AMRAP (multi-move rounds counter or single-move max reps), Tabata and EMOM (work/rest cycling through moves), benchmark / max test. |
| Audio | Beeps built to cut through music (compressor, 1 to 3 kHz tones), 3-2-1 ticks, end triple-beep, "halfway" on work of 1 min+, spoken block names. Works with the ring switch on silent (silent loop trick). Audio re-unlocks on return to app. |
| Screen | Wake lock, re-requested every time you come back to the app. |
| Rest controls | −20s / +20s / skip. Tap the ring to pause just that countdown. |
| Between blocks | 60s transition rest with "up next" card, % done, blocks-left list. |
| Get ready | 10s countdown before each block, skippable. |
| Logging | Reps + weight, left/right per side, tap-to-type numbers, last time's sets, "beat your best" target, editable log card at the end of each block, PRs on finish. |
| Mid-workout tools | Watch the move, cue always on screen, swap exercise (saved for next week), notes + knee flag (coach-mode plans), "how did it feel" rating at the end. |
| Finish screen | PRs, pace vs your previous runs of the same session, block times saved to history. |
| Config wiring | Console settings (Tabata off, AMRAP cap, EMOM interval + length, circuit rest) reach the runner. Tested: `test/block-formats.test.mjs`. |

### Weak or broken (fix first)

| # | Problem | Where | Impact |
|---|---|---|---|
| W1 | **FIXED 27 Sep.** ~~Resume restarts the timer.~~ `enterBlock` always calls `clearStep`, then each screen calls `beginStep` fresh. Reopen mid-hold, mid-rest, mid-Tabata or mid-AMRAP and that countdown starts over from full. The session clock is fine; the step clock is not. | `workmode.js` `enterBlock`, every `render*` | The core promise ("resumes exactly where it was") is only half true. |
| W2 | **FIXED 27 Sep.** ~~Interval formats drift and don't catch up.~~ Each EMOM minute / Tabata interval starts when the screen renders, not on a fixed schedule. Lock the phone for 2 min during a Tabata and on return it advances ONE interval and starts a fresh 20s. | `renderInterval`, `nextInterval` | EMOM / Tabata / AMRAP are not real wall-clock timers. Biggest gap vs a GymBoss. |
| W3 | **No sound while the phone is locked.** JS timers freeze in the background on iOS, so beeps fire late (when you reopen) or not at all. | `timer.js`, `tick()` | You can't lock the phone and train by ear. |
| W4 | **FIXED 27 Sep.** ~~"End workout" throws the workout away.~~ The confirm says "Progress is saved as far as you got", but `quit()` clears the run and saves nothing to history. | `workmode.js` `quit`, `confirmExit` | Lost sets, and the message is false. |
| W5 | **Joint Prep is skipped.** Blocks with format `jointprep` have no items, fall into `renderSets`, and complete instantly. The v1 free-flow interval timer (switch every 10/20/30/60s) never made it into the new runner. | `renderActive`, `composer.js` | A programmed block silently disappears. |
| W6 | **EMOM has no rep target or logging.** The screen shows the move name only, not "8 reps". History stores the round count as each move's "value". There is no "done, rest the remainder" tap; Skip jumps to the next minute and breaks the clock. | `renderInterval`, `captureRounds` | EMOM feels like a bare clock, and its log is misleading. |
| W7 | **FIXED 27 Sep.** ~~Circuit / superset mid-round values are lost on resume.~~ `roundBuf` lives in memory only. | `workmode.js` top | Reps typed this round vanish on reopen. |
| W8 | **Rest-pause runs as plain straight sets.** No cluster mini-rests. | `renderActive` | Format name promises something the timer doesn't do. |
| W9 | **No whole-session pause.** `R.pause/resume` exist but no button uses them. Tap-the-ring pauses only the current countdown. | `runstate.js` | Phone call or interruption keeps the session clock running. |
| W10 | **Fixed numbers.** Get-ready is always 10s, between-block rest always 60s, weight always lb. | `renderGetReady`, `sectionNext`, `WUNIT` | Should be user or coach settings. |
| W11 | **Voice on/off resets every launch** and lives on the week screen, not inside the workout. No "10 seconds left" cue in the new engine. | `timer.js`, `screens/week.js` | Small, but felt every session. |
| W12 | **Dead code.** `js/runner.js` (old v1 runner) is imported by nothing but still downloaded by the service worker. | `sw.js` | Confusing, extra download. |
| W13 | **Navigation is block-only.** Back goes to the previous block and wipes its log; no previous exercise / set, no skip exercise in straight sets, no skip block. | `backBlock` | Mis-tap recovery is heavy. |

### Pending (not built yet)

**Quick Timer, the standalone mode** (v1 shipped 27 Sep)
- DONE: entry in the dashboard (Workouts tab), setup screen, 7 formats: EMOM (any interval, alternating moves with reps), AMRAP (moves or just count rounds), For Time (optional cap, rounds), Tabata, Intervals (work / rest × rounds, sets with rest between), Stopwatch, Countdown. Countdown before start (none, 3, 5, 10s). Saved timers. Remembers your last setup. Result card on finish, saved to history.
- Next for Quick Timer:
  - **Death By** (ladder EMOM), **Ladder / pyramid** reps, **Chipper**
  - Stopwatch laps
  - Pick moves from the exercise library (typed-in moves have no video, no PRs)
  - "Do it again" on the finish screen
  - Big glance layout (see below)

Market research and the ranked proposal of what to add: **`docs/TIMER-RESEARCH.md`**.

**Timer engine**
- Absolute schedule for timed blocks: compute every interval boundary from the block start, so resume and background are exact (fixes W1, W2).
- Pre-schedule beeps on the audio timeline so the next cues play even if JS is paused (partial fix for W3; needs real-phone testing).
- Whole-session pause button (W9).
- Big "glance" layout for timed formats: huge numbers readable from 2 m, color by phase (work green, rest blue, get ready amber), full-screen mode.

**Program mode polish**
- EMOM: show reps per minute, "Done" tap that shows rest remaining, reps logged per round (W6).
- Rest-pause clusters (W8), Joint Prep free-flow (W5).
- Save on exit (W4), persist the round buffer (W7).
- Settings: get-ready length, block-transition rest, kg/lb, voice on/off inside the workout, cue style (beeps only / beeps + voice).
- Previous / skip exercise and skip block (W13).
- Tempo metronome (beep per phase of a 3-1-1 rep): nice to have.

---

## Suggested build order

1. **Engine fixes:** W1 + W2 (absolute schedule), W4 (save on exit), W7. Everything after this is built on a timer we trust.
2. ~~**Quick Timer v1:**~~ DONE 27 Sep. setup screen + EMOM, AMRAP, For Time, Tabata, Intervals, Stopwatch. Reuses the runner.
3. **Glance layout + session pause + settings** (W9, W10, W11).
4. **Program format gaps:** EMOM logging (W6), Joint Prep (W5), rest-pause (W8).
5. **Background audio** (W3), tested on a real iPhone.
6. Cleanup: W12, W13.

---

## Changelog

Newest first. One line per shipped change: date, what changed, commit.
- 2 Oct 2026 · **Three editable designs; the lab is the coach's.** ring.js now keeps a choice (`fj.ringChoice`, Chrono by default) and per-design edits (`fj.ringOverrides`), so the lab edits Chrono, LED and Laser themselves: every change autosaves into the design being edited, switching never loses work (the bug: tapping Chrono reloaded the stock preset over the edits), a ● marks edited designs, Reset restores one, "Use on timer" chooses it, "Copy all 3" copies the three for baking into PRESETS. The old single `fj.ringDesign` migrates into an edit of its design. Users: Timer settings show only the three (with this device's edits) and their vibe colours; no lab link. Coach: tap Version 5 times in Timer settings to open the lab (inside the installed app, so it edits that app's designs).
- 2 Oct 2026 · **Segments go out whole.** A segmented ring (`arc.style: 'segments'`, e.g. LED) shows only full segments: the time left is rounded up to the next segment (`snapToSegments`, ring.js, used by updateTimer and the lab), the arc has no sliding transition, and ends are forced flat so a round cap never lights a sliver of the next segment. Measured in the lab: 51, 50, 49… lit segments, no partials.
- 2 Oct 2026 · **Soft core.** Ring designs gain `arc.coreSoft` (0 crisp line … 1 white-hot centre melting into the tube) and `arc.coreOpacity`. Soft = the white core blurred (SVG feGaussianBlur, Safari-safe) over a wider tinted halo (ring colour mixed toward white), both scaled by softness; lab controls "Core softness" and "Core brightness". Every core layer moves with the countdown (updateTimer now moves all `.core` arcs).
- 2 Oct 2026 · **Electro colours only, three rings, ticks inside, a real crown.** Presets are Nicolas's three: Chrono (default), LED, Laser. Gold is gone from the timer: get ready is electric royal blue (`--wm-ready` #3D6BFF) for the ring, the glance wash, labels, GO and the setup rows; an old saved "gold" draws as royal blue. Lab colours: your main and glow (vibe), every app palette (spine/theme.json: Jade, Miami, Voltage, Electric, Violet, Acid), electric green #39FF14, royal blue #3D6BFF, plus any colour added with the picker; "Edit colours" removes any of them (`fj.ringPalette`), "Bring all back" restores. Ticks: Outside or Inside the ring. The crown is a stopwatch crown, stem + cap standing on the ring at 12 and as tall as the outside ticks; the 12 o'clock tick gives way to it.
- 2 Oct 2026 · **Timer ring lab.** The countdown ring is drawn from a design object (`js/runner/ring.js`, every property inline so no stylesheet can override it), the same for get ready, work and rest (only the phase colour changes). 7 presets: Neon tube, Chrono (like the app icon), Synthwave (gradient), LED (segments), Laser, Bold, Clean. **`ring-lab.html`** (Timer settings → Design your own ring): live ring in all 3 phases with a running clock; controls for colours per phase (theme colours or any colour), style (solid / gradient / segments), thickness, white core and its colour, glow, glare, ends, segments and gap, the empty part, ticks (count, length, brightness, colour, quarters), sunrays, face, crown, and the digits (font, weight, size, glow, colour); Save (my designs), Copy (to make one the default), Use on timer (`fj.ringDesign` on the device). Timer settings show the 7 presets as live mini rings; a running workout redraws when the design changes. The old ring-tube / led / clean CSS is gone.
- 2 Oct 2026 · **One look for the whole setup screen.** Everything is a section header + a card of rows with a small coloured label: Settings (main numbers, and the Ladder's Shape as a row of equal choices), Moves (each move: its name, then the same small labelled −/+ controls: Reps, or Start + Per rung / Add per round, and one quiet preview line), Customize (same rows: extra numbers, EMOM "How the moves run", Get-ready countdown). Ladder presets moved from a chip strip to a "Presets" sheet beside Settings. "Customize" never turns into "Close": it keeps its name and the arrow flips.
- 2 Oct 2026 · **Updates are checked on every open.** The bar no longer depends on the service worker's one-time "updated" message (a home-screen app can miss it and sit on an old build): every open and every return to the app compares the running `whatsnew.json` with the site's (`?live`, which the service worker now never serves from cache, build-sw.mjs) and shows "Update ready · Refresh" when the site is newer (held back during a workout). Refresh asks the service worker for the new build and waits for it to take over before reloading, so one tap lands on it. Timer settings show the running version and a **Check for updates** button. Tested with the service worker on: .2 installed, .3 published, bar, Refresh, running .3, "Updated ✓".
- 2 Oct 2026 · **Interval Timer name, neon tube ring, updates you can see.** Home-screen name "Interval Timer" (manifest-timer, apple title, page title, header). The countdown ring is drawn like the logo's neon: a colour tube with a white-hot core inside, a halo, a glare near 12, and the empty part as unlit glass; Timer settings → Timer ring offers Neon tube (default), LED (segmented 80s display) or Clean. **Updates:** `js/update-banner.js` (timer page and dashboard): a new version shows "Update ready" + what changed + a Refresh button (never mid-workout; it waits for the end), and after the refresh "Updated ✓" once. What changed comes from `whatsnew.json`: **every release bumps its version and puts the newest line first** (all chats). The dashboard no longer reloads itself silently.
- 2 Oct 2026 · **Uniform setup rows, a stopwatch dial, Customize your vibe, push-up double-beep start.** Every Quick Timer setting is one full-width row: coloured label on top (main colour for work and minutes, glow colour for rest, violet for rounds and sets, gold for caps), then − value + (after the "Interval timer" reference). The countdown ring is a dial after the J5 Sunray icon: 60 minute ticks with longer quarters, faint sunray hairlines, a crown nub at 12, one glowing arc in the phase colour, digits in the phase colour. Timer settings gain **Customize your vibe**: Buttons & rings and Glow & edges (6 palettes each), Glow soft / normal / bold, Surprise me every week; saved in the same record as the dashboard's vibe for a signed-in person (both always match), `fj.timerVibe` for a guest. Push-up test: the first rep is a double beep, the get-ready screen and voice say "Start on the double beep", the first moment shows GO; measured: "3, 2, 1" at 7.1 / 8.1 / 9.1 s, double beep at 10.01 s, next beep 13.01 s.
- 1 Oct 2026 · **Death By per move, Ladder "Up to", one move by default.** Death By: every move has its own Start and Add per round beside it (burpees 1 +1 with squats 2 +2), a preview of the first rounds, and the result lists each move's last round. Runner reads `dbStart` / `dbStep` per item (block-wide `ladder` still reads). Ladder: the main number is the top or bottom ("Up to 10", "Down to 1", with "· and back" for There and back) instead of a rung count; it follows the first move. Moves are now one list per type (`movesBy`), each type starts with one row; the old shared list carried an EMOM's moves into a Ladder. Shared links keep their moves.
- 1 Oct 2026 · **Timer icon J5 Sunray, timer first on the sign-in screen, short type descriptions.** The FJ Timer's home-screen icon is the logo chat's timer face "J5 Sunray" (`images/timer-icon/`, rebuilt by `tools/build-timer-icon.mjs`, full-bleed so iPhone and Android round it cleanly; manifest-timer icons + apple-touch-icon on the timer page). The sign-in screen opens with a big "Just need the timer? Open it. No sign-in needed." card, first. Each type has a few-word line: EMOM "Every minute on the minute", AMRAP "As many rounds as possible", For time "Finish fast, beat the clock", Tabata "20s on, 10s off", Timer "Work, rest, rounds", Death By "+1 rep every minute", Ladder "Reps climb or drop", Stopwatch "Count up, with laps", Push-up test "1 rep every 3 seconds".
- 1 Oct 2026 · **Home-screen timer, for real, every phone + push-up test with a voice.** Root cause of "Let us find you": the per-user manifest is a blob, and relative URLs in it ("./index.html?quick") resolve against blob:, so phones fell back to the main app's start page. Now the timer page uses a real file, `manifest-timer.webmanifest` (start_url ./index.html?quick, id fitness-journey-timer), and the main blob manifest spells out absolute start_url, scope and icon URLs (Android installs were pointing nowhere). An already-installed icon that lands on the claim screen gets **"Just need the timer? Open it"** (js/screens/claim.js): one tap, remembered on the device (`fj.launchTimer`), and that app opens on the timer from then on; the guest timer has "Have a program from Nico? Sign in" to undo it. **Push-up test**: 1 beep per rep (every 3s at 20 a minute), the voice counts each finished rep ("1", "2"…), so the last number heard is the score; the 10s get-ready speaks short instructions and a spoken 3-2-1; the first beep is booked on the audio clock for the exact end of the countdown (measured 10.01s, then 13.01, 16.01, 19.01); no end chime on top of it. Ticker now 100 ms (was 250).
- 29 Sep 2026 · **The home-screen timer opens without "Let us find you".** An iPhone home-screen app has its own empty storage, so the installed "FJ Timer" never knew who installed it and stopped on the claim screen. The Quick Timer needs no identity: with nobody claimed, `?quick` boots as a device-local guest (`timer-guest`), goes before the claim check in render(), and hides the back arrow (there is no dashboard to go back to). Nothing is guessed; claimed devices are unchanged. Manifest omits user= when there is none.
- 28 Sep 2026 · **Ladder rebuilt: reps belong to each move.** Every move has its own Start and Change per rung (pull-ups 1 +1 while push-ups 40 −2), plus a Rungs count and a shape: One way, There and back (pyramid, or valley when it drops), Wave (1, 10, 2, 9…). One-tap presets: 1→10, 10→1, Pyramid, Valley 10→1→10, Seesaw, Wave, 21-15-9. Live preview of each move's reps and total, warns when a move hits 0. Moves sit on the main screen for Ladder. Runner: `rungs[k]` is one number per move; the screen shows each move's reps for the rung and "next: 2 Pull-ups · 38 Push-ups". Old saved ladders convert. Formats from Experience Life and Papayya ladder guides.
- 28 Sep 2026 · **AMRAP round times, share by link, saved-timer editing, Death By, Ladder** (proposal items 3, 5, 6). AMRAP: every + records the round's time ("Last round 1:15 · best 1:02"), the end log and result show each round's time. Share: button on the Quick Timer header; the setup travels in the link (`?quick&t=<base64 JSON>`, only the fields that matter), native share sheet or clipboard; opening it loads the timer and says so. Saved timers: name them; loading one lights the star, which then offers Save changes / Save as new / Delete. **Death By**: reps climb each interval (start and step and interval in the setup), "I can't finish this one" ends it, score = rounds + last reps. **Ladder**: up, down or pyramid rungs for time, "Rung done" per rung with a split each, the last rung finishes it. "1 rep" not "1 reps".
- 28 Sep 2026 · **Glance mode, screen flash, pause, settings** (proposal items 1, 2, 4; W9, W11). The screen wears the phase: a wash of the accent (work), neon (rest) or gold (get ready) from the top, a bigger ring, bigger digits, phase-colored label; single-block timers drop the progress bar and block strip; Quick Timer get-ready drops the stray role chip. Screen flash at the end of every step, softer at the 10-second warning. A pause button in the workout header stops everything (session clock, countdown, push-up beat) and survives a reload; the pause screen has Resume, Settings, End workout. Settings (`js/runner/prefs.js`, device-local): coach voice, beeps, screen flash; also a gear on the Quick Timer. Voice on/off now persists (was reset every launch).
- 28 Sep 2026 · **Search by level.** "easy", "beginner", "novice", "basic", "medium", "hard", "advanced", "difficult", "expert"… filter moves by their level (library level, else catalog, mobility / joint prep = easy). Level words are a strict filter, never a name match. Easy / Medium / Hard chips, and each result shows its level.
- 28 Sep 2026 · **Search by anything, AMRAP rounds, Tabata rounds, total badge, stopwatch laps.** Move search now matches name, aliases, target and secondary muscles (from spine/catalog.json), body parts ("core", "abs", "legs", "back", "shins"), patterns (push, pull, hinge, jump), equipment ("dumbbell", "no equipment") and level; whole words only, ranked name > main muscle > secondary; quick chips (Core, Legs, Push…). AMRAP with named moves ends on an editable per-round log plus extra reps from the unfinished round; result reads "5 rounds + 6 reps" (program AMRAPs too). Tabata and Timer: a round is every move once (8 rounds × 2 moves = 16 intervals), counter says "round 3/8". Total time is a glowing pink badge next to Start. Stopwatch: Lap button, big number = current lap, total underneath, lap list; For time with rounds gets a Round button (splits). The ? for each type now sits inside the type list.
- 28 Sep 2026 · **Push-up test at the standard pace + the timer updates itself.** Default pace is now 20 a minute: 1 push-up every 3 seconds, 1.5s down on the low beep, 1.5s up on the high beep (25 NHL stays as the harder option; saved setups at 25 move to 20 once). Rating at 20 uses the cadence-test healthy zone (men 20 to 40, women 10 to 25, topendsports). index.html now reloads itself onto a new version when no workout is running, like the dashboard, instead of a 12-second "tap to update" bar that phones missed.
- 28 Sep 2026 · **Quick Timer round 3.** Types are now EMOM, AMRAP, For time, Tabata, **Timer** (work / rest / rounds in min:sec, sets in Customize; replaces Intervals and Countdown, old saved setups migrate), Stopwatch, **Push-up test** (beep test: low beep down, high beep up, 20 or 25 a minute, beeps scheduled on the audio clock, score = reps on the beat, NHL rating at 25 for men / women from topendsports). Big **Total** time above Start. "More options" is now **Customize**. A **?** next to the type explains it with an example. Moves are picked from the **library with search** (322 moves, or type your own), so videos and cues work in the timer. **EMOM style**: take turns, or all moves every minute. **New cues**, program days too: "Halfway" on efforts of 90s+, "1 minute left" on 3 min+, a double beep 10s out on 30s+, "Last round" on intervals, circuits and supersets (milestone lines are no longer cut off by the next line). Time fields open a minutes / seconds picker.
- 28 Sep 2026 · **Music on Android (made from the Sevan onboarding chat, logged here per the ship rule).** The silent keep-alive loop now runs on iPhone only: on Android Chrome a playing `<audio>` at volume 0 still takes "may duck" audio focus, so the loop turned Spotify down for the whole workout. Beeps are Web Audio and mix over music without it. And the return-to-app handler now acts only while the workout clock runs (`ticker`), because `S` survives the finish screen and every return to the app after training restarted the loop and the wake lock. `js/timer.js` `initAudio`, `js/runner/workmode.js` visibilitychange. Also verified end to end in the browser: all 3 days of "Come Back Strong" (supersets 3 × 75s, circuits with round rest, holds, per-side planks, farmer's carry) run exactly as written. Open item seen in that walk: warm-up blocks written "no stopping" still get a log screen and a 60s transition rest after them (W10).

- 27 Sep 2026 · **Simpler Quick Timer + app colors.** Setup is now: type (a dropdown sheet), 1 to 3 big number tiles (rounds / minutes, or rounds / work / rest for Intervals), Start with a one-line summary above it. Interval length, sets, moves and the countdown before start sit under "More options". Save is the star in the header. Work Mode and the Quick Timer now use the dashboard's ground and the user's own color slots (`js/runner/theme.js` reads the dashboard's saved choice): work ring = accent, rest ring = neon, get ready = gold, neon for edges and glow only. Theme choice for the timer itself: later, once the modes are complete.
- 27 Sep 2026 · **Work Mode preview + the timer as its own app.** `index.html?quick&demo` adds a "Work Mode preview" list to the Quick Timer: 13 short sample workouts (straight sets, Yates, tempo, per side, hold, superset, circuit, skill, EMOM, AMRAP, Tabata, max test, a whole day) on real library moves; `demo` plans never save to history (`js/runner/demo.js`). "Add to Home Screen" from the Quick Timer now makes a separate "FJ Timer" icon that opens straight on the timer as you (`manifest-user.js`). Market research and proposal: `docs/TIMER-RESEARCH.md`.
- 27 Sep 2026 · **Quick Timer v1.** New "Quick timer" row in the dashboard's Workouts tab opens `index.html?quick` (`js/runner/quick.js`). 7 formats, optional moves with reps, countdown before start, saved timers, last setup remembered. It builds a normal plan and runs it on Work Mode, so it gets every engine fix. Runner additions that program days get too: EMOM / Tabata show the rep target and the next move; no dead rest after the last interval; a block can set its own break after it (`restAfter`) and a plan its own get-ready length (`getReady`); new `fortime` format (count up, optional cap); EMOM / Tabata log as "rounds", not "reps". Em dashes removed from Work Mode's on-screen copy. Commit 685b301.
- 27 Sep 2026 · **Timer engine fixes.** Reopening the app now lands mid-countdown instead of restarting it (every screen: holds, rests, get ready, block transition, AMRAP, EMOM, Tabata). Back-to-back steps run on a fixed wall-clock schedule, so an EMOM no longer drifts and a locked phone catches up silently to the right minute, then beeps once. "End workout" now offers Save what I did / Discard / Keep going; saved runs go to history marked "ended early", PRs count, and they never set a pace to beat. Reps typed mid-round survive a reopen. Also fixed on the way: a second single-move AMRAP started from the first one's rep count; the silent audio loop kept running after a finished workout. Test: `test/runstate.test.mjs`. Commit 3d2df34.
- 27 Sep 2026 · Audit written, this file created. No app change yet.

---

## Requests from other chats

(Empty. Add a line: date, which chat, what you need from Work Mode.)
