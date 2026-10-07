# Training Timer: health checklist

Run it before every ship (part 1) and once a week, or after any big change
(parts 1 to 4). It takes about 10 minutes. Owner: the Work Mode chat.

## 1. Automatic (every ship)

- [ ] `node tools/check-all.mjs` says **All green**. It includes
      `tools/check-timer.mjs`: every js file parses, and no local `t`
      hides the translate function (what emptied the move library on 7 Oct).
- [ ] Open `tools/audit/smoke.html` (local server, or the live site at
      `/tools/audit/smoke.html`) and press **Run all checks**. All 20 pass:
      every timer type in English and French draws its setup, the Start bar
      sits on the bottom edge, the move library lists 300+ moves and search
      finds some, Start opens the workout, the clock moves, no errors.

## 2. Sound (weekly, from the browser pane with the audit harness)

`const A = await import('/tools/audit/timer-audit.js')`, then for each of
tabata, emom, timer, amrap, fortime, deathby, ladder, stopwatch, pushup:
`A.setup(mode)`, reload, `A.arm()`, a real click on Start, `A.run(mode)`,
`A.report()`.

- [ ] No 🤖 robot lines (everything in the recorded voice).
- [ ] Voice never starts on top of a beep.
- [ ] Round calls are right ("Round 4. Halfway.", "Last round.").
- [ ] Get-ready says "Get ready" only, never the format name.

## 3. On a real phone (weekly; iPhone and Android, the installed app)

- [ ] Open the app from the home screen. The update bar offers the new
      version, or Settings shows the latest version number.
- [ ] Setup: scroll to the bottom while tapping + and −. The Start bar
      stays on the bottom edge; nothing shows through the status bar.
- [ ] Pick a move: the list is full, search works, ★ favorites stick.
- [ ] Start a Tabata with music playing: the music keeps going, beeps and
      voice both come out of the Bluetooth speaker.
- [ ] Lock the phone mid-workout for 20 s, unlock: the clock is right.
- [ ] Finish: totals show, Done goes back without a color flash.
- [ ] Switch to French in Timer settings: screens, moves and voice follow.
- [ ] iPhone app (native): still opens (free signing lasts 7 days; the
      reinstall task runs every 6).

## 4. Housekeeping (weekly)

- [ ] `whatsnew.json` version equals the live one
      (`curl -s https://nicolashovsepyan.github.io/fitness-journey/whatsnew.json`).
- [ ] The /timer/ short link opens the timer.
- [ ] Anything that failed: fix it, ship it, add one line to the
      Changelog in `docs/WORK-MODE.md`, then tick the box here again.

## Lessons (why each check exists)

- **7 Oct, empty move library:** a variable named `t` hid `t()`. Caught
  now by `check-timer.mjs`.
- **7 Oct, Start bar floating while scrolling:** each tap redrew the screen
  and replayed a slide-in animation; a moving parent drags its "fixed" bars
  with it. The fade is opacity only now and plays once. Caught by the smoke
  test's "Start bar pinned" line.
- **Sept, robot voice / no sound:** a switch was off and the voice pack
  missing. Caught by part 2.
