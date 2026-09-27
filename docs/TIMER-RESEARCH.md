# Timer apps: what's out there, and what we add

Research for Work Mode + Quick Timer, 27 Sep 2026. Sources: App Store
listings, product sites, review roundups. Reddit was not reachable, so
sentiment comes from App Store reviews.

## Who we looked at

| App | Known for | Price |
|---|---|---|
| SmartWOD Timer | CrossFit formats (AMRAP, EMOM, For Time, Tabata, Mix), round splits, log, Watch, Chromecast. 4.9, 54K ratings | Free + ads, $18/yr |
| Seconds Pro | Chained timers, a color per interval filling the screen, "next up", speaks interval names, music per interval | $8 once |
| Timer Plus | HIIT / Tabata / circuit / EMOM, screen flash, voice | Freemium |
| Interval Timer | Custom work / rest / sets, **Live Activity + Dynamic Island** | Subscription |
| Intervals Pro | Time, distance or open-ended intervals, heart-rate targets | $20/yr |
| GymBoss | The classic: unlimited intervals, music dims under the alarm, colored backgrounds | Nearly free |
| WODProof | Films you with the timer burned in, shareable proof | $55/yr |
| BTWB Tempus | **Timer pre-built from the programmed workout**, rest counts up if not prescribed, splits + loads | Part of BTWB |
| Hevy / Strong | Strength logging; **Hevy's Live Activity lets you finish a set, ±15s rest, skip from the lock screen** | Free tier |
| Boxing timers | Round / rest / prep, bell in the last 10s | Cheap |
| gettimer.app (new) | Drag-and-drop card builder, short share links, Apple TV display, heat grid | One-time |

## What users care about most (ranked by review mentions)

1. Cues heard **over music and with the phone locked** (the number 1 complaint)
2. Never losing the workout (freezes, pause / resume)
3. Big display readable from across the room, a color per phase
4. Easy to build **and edit** saved timers
5. Apple Watch
6. Voice cues, including the move name
7. CrossFit formats built in
8. No subscription
9. Round counter, splits, a log that saves itself
10. Lock-screen visibility (Live Activity)

**The gap nobody fills:** program + timer + log in one place. People juggle
a program app, a timer app and a logging app. BTWB is the closest and it is
a CrossFit-gym product.

## Where we stand

**Already ahead of most timer apps**
- The timer is built from the coach's program day (only BTWB does this)
- Reps and weight logged inside the timed flow, PRs, benchmarks
- Mixed sessions in 1 run: straight sets, Yates, supersets, circuits, holds, skill, EMOM, AMRAP, Tabata
- Demo video and exercise swap mid-workout
- Resume after a lock or reload, exact to the second (the top reliability complaint)
- Nothing to install from a store; the Quick Timer can sit on the home screen as its own icon

**Missing, compared with the market**
- Whole-screen color per phase, glanceable numbers (everyone has it)
- Last-10-second warning, screen flash option
- Round splits for AMRAP / For Time, notes on a result
- Edit / duplicate saved timers, ladders, pyramids, Death By, E2MOM presets
- Share a timer by link or QR
- Lock-screen presence (Live Activity is native-only; a web app can partly fake it)
- Landscape / TV mode
- Apple Watch, Apple Health (native-only)

## Proposal

Ranked by value for effort. **A** = do next, **B** = after, **C** = needs a
native app, park it.

| # | Option | Why | Effort | Tier |
|---|---|---|---|---|
| 1 | **Glance mode**: full-screen phase color (work green, rest blue, get ready amber), huge numbers, "next up" line, big round counter | The most common feature in the market, and our screens are busy for timed work | M | A |
| 2 | **Last-10-second warning + screen flash** | Boxing apps' best idea; flash helps in loud gyms | S | A |
| 3 | **Round splits**: tap per round in AMRAP / For Time, see each round's time after | SmartWOD's core loop, cheap for us | S | A |
| 4 | **Whole-session pause + settings** (kg/lb, voice on/off in the workout, cue style) | Already on our list (W9, W10, W11) | S | A |
| 5 | **Share a timer by link** (the setup encoded in the URL; tap and it loads) | Native to the web, almost free; great for a coach sending a finisher | S | A |
| 6 | **Edit saved timers + more formats**: E2MOM / E3MOM presets, Death By (add 1 rep each minute), ladder, pyramid | Rigid editing is a top complaint elsewhere | M | B |
| 7 | **Lock-screen card** via the media "now playing" controls: phase + time, pause / skip | The closest a web app gets to a Live Activity | M, needs iPhone testing | B |
| 8 | **Rest counts up when the coach didn't set one**, plus open "tap when done" steps | BTWB's idea; fits strength days | S | B |
| 9 | **Landscape / TV mode** (cast the tab) | Garage and group use | S | B |
| 10 | **Pick Quick Timer moves from the library** (video, cue, PRs) | Joins the timer to our biggest edge | M | B |
| 11 | Apple Watch, Apple Health, true Live Activity | Users want them, but a web app can't do them | L | C |

**Recommended next batch:** 1 to 5. Together they close the gap on the
features every timer app has, while keeping what nobody else has.
