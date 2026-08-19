# logo/ — where the mark is drawn

**Not for you, but worth knowing it exists.** The logo and the weight gauge
are worked on here, alone, so that taking them apart cannot break a survey
screen by accident.

`mark.mjs` and `equipment.mjs` are the ONLY places these two drawings exist.
Everything else — the survey, the app icon, the home-screen icon, the stamps,
the gauge on three different pages — is a copy pushed out from here by
`tools/build-logo.mjs` and `tools/build-equipment.mjs`.

The `.html` files are workbenches: open one in a browser and it draws the mark
so it can be judged. They are not part of the app.

| | |
|---|---|
| `mark.mjs` | the logo, as code. The source. |
| `equipment.mjs` | the weight gauge, as code. The source. |
| `LOGO LAB.html` · `LOGO PREVIEW.html` | look at the mark |
| `DUMBBELL.html` · `WEIGHT GAUGE.html` | look at the gauge |
| `LOGO SPEC.md` | the rules the mark follows |
| `hero.css` · `hero.js` | the opening animation, before it was pushed into the survey |
