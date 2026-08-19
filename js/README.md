# js/ — the app's code

**Not for you.** This is the machinery behind `index.html` — the installed
app on a phone. Nothing in here is a page you open or a file you edit.

Every file loads every other file by its exact path, so nothing in this
folder can be renamed or moved without breaking the app.

| | |
|---|---|
| `app.js` | The way in. Works out who you are, then draws the right screen. |
| `intake.js` | Reads the survey link the first time someone opens the app. |
| `users.js` · `store.js` | Who is who, and what gets saved. |
| `runner.js` · `runner/` · `timer.js` | The live workout — sets, holds, rest. |
| `screens/` | One file per screen. |
| `core/` | The rules everything shares. |
| `data/` | The movement database, as code. Rebuilt by `tools/`, not typed by hand. |
| `coach.js` · `release.js` · `program-adapter.js` | The program, and letting a client have it. |
| `adapters/` | Where saved data goes. Today: this phone. Later: a real server. |
