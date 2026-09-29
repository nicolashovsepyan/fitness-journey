# WORK MODE — the live timer

**Owner:** the dedicated "Work Mode" chat. Every change to the live workout
timer is designed, built and logged from that chat.

**Files it owns:** `js/runner/workmode.js`, `js/runner/runstate.js`,
`js/timer.js`, `js/data/formats.js`, and (when built) `js/runner/quick.js`.
Other chats: do not edit these. If your work needs a Work Mode change, write
it under "Requests from other chats" at the bottom and leave it.

**Ship rule:** a Work Mode change is not done until it is committed, pushed
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
