# Fitness Journey

A premium, phone-first training app built for an experienced athlete. Trusted
session fundamentals → multi-week program → near-zero-friction logging → data
that keeps you accountable and rebalances toward your goals.

## Architecture (4 hard-separated layers — the anti-bug foundation)

| Layer | File(s) | Job |
|-------|---------|-----|
| 1. Data | `js/data.js`, `js/store.js` | Pure content + persistence. No logic. |
| 2. Engine | `buildSession()` in `js/app.js` | Composes a session from fundamental + duration. Pure. |
| 3. Runner | `js/runner.js`, `js/timer.js` | The live Working Mode state machine. |
| 4. UI shell | `styles.css`, views in `js/app.js` | Premium dark skin. Swappable. |

**Core principle:** every difference between exercises (reps vs hold, BW vs
weighted, unilateral vs bilateral) and every block format (straight / circuit /
benchmark) is **DATA (a flag)**, not code. ONE runner reads the flags and renders
itself. Adding an exercise or format = a data row, never new fragile logic.
This is the structural fix for "it bugged over time."

## What's in v0.1 (built + verified)

- Dashboard: today's session, stats, PRs, goal portfolio (High/Med/Low), coach callout, export/reset.
- Build Day → Full Day → Working Mode flow.
- Push Day fundamental; duration (20/30/45/60) RESTRUCTURES the session (not just shrinks).
- Data-driven runner: auto reps-counter vs hold-timer; rest timers; circuit with
  round dots, transition buffer, auto TUT timer-within-the-timer; per-round + end-of-block log cards.
- Max-rep benchmark block (writes a PR).
- Coach voice (phone TTS): "halfway… 10 seconds… 3-2-1… done."
- PR detection, local-first save (localStorage), JSON export, PWA install.

## Roadmap

- v0.1 ✅ Runner + Push Day + data-driven engine (DONE)
- v0.2 — All 6 fundamentals (Pull / Push&Pull / Lower / Lower&Core / Full-body) + duration scaling
- v0.3 — Multi-week program + "today" view
- v0.4 — Goal portfolio drives the Composer (auto-vary sessions)
- v0.5 — Trends + coach call-outs + weakness rebalancing
- v0.6 — Video-list protocols woven into the week
- v0.7 — Benchmark / exercise-expertise onboarding (optional layer)
- Polish — premium look throughout

## Feedback loop

Record screen + voice while training (iOS Control Center → Screen Recording, mic ON),
drop the video in `feedback/`. Each video = one feedback pass.

## Run locally

`python3 -m http.server 8765` in this folder, open `http://localhost:8765`.
