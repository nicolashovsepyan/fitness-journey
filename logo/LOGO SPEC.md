# The logo — full scope

Everything decided about the mark so far, and how to work on it without
touching the survey.

---

## Start here

1. Open **`logo/LOGO LAB.html`** — double-click it. The mark runs on its own in
   a phone-sized frame, with live controls and live measurements.
2. Edit **`logo/hero.css`** and **`logo/hero.js`**. The lab loads both verbatim,
   so what you see there is exactly what ships.
3. Run **`node tools/build-logo.mjs`** to push it into the survey.

```bash
node tools/build-logo.mjs --check
```

Run that **before** starting. It tells you whether `logo/` and
`onboarding.html` still agree. If they have drifted, someone edited the
survey's copy by hand and that has to be reconciled first.

**The build script replaces two marked blocks in `onboarding.html` and nothing
else.** It refuses to run if a marker is missing, and refuses if the write
would change the file size by more than a third — a bad slice into a 990 KB
single-file app is not something to discover later.

---

## What the mark is

An inverted neon triangle with a dumbbell centred in it, over the wordmark.
Drawn from the 80s album-cover reference: *Metropolis 83'*.

| Part | What it is |
|---|---|
| **The outline** | Open polyline, not a closed triangle. Vertical pink gradient. |
| **The break** | A 40-unit gap in the top-left, like a dead segment in a real neon tube. |
| **The glare** | A separate blurred overlay — light coming *off* the dumbbell onto the tube. |
| **The light** | A short bright dash chasing the perimeter. |
| **The heartbeat** | Lub-dub on the outline, only while the light crosses the top edge. |
| **The mark** | The dumbbell, drawn stroke by stroke, then breathing on a 4400ms rep. |

---

## The numbers, and why each one is what it is

### Geometry

| | Value | Why |
|---|---|---|
| viewBox | `0 0 300 268` | |
| Path | `M100 16 H286 L150 252 L14 16 H60` | Starts right of the break, runs round, stops left of it. |
| Perimeter | **777** | 186 + 272.4 + 272.4 + 46. Hard-coded as `TRI_LEN`; **recompute it if the path changes** or the draw-in and the light both break. |
| Break | 40 units, `x=60` to `x=100` | Both ends at `y=16`. They were stepped to different heights for a version and it read as a mistake. |
| Width | `min(82%, 315px)` | |
| Drop | `translate(-50%, -37.5%)` | Anchored to `.art`, not to the block, so it frames the dumbbell wherever the copy below ends up. A percentage so it holds at every screen width. |
| Stroke | **2.6** | Was 2.4. Past about 10% more the mitre at the apex starts to blob at this size. |
| Bar sits at | **35.8%** down the triangle | Measured. Clearance to the neon is ~10px a side. |

**The tight constraint:** the triangle narrows as it descends, so *where the
dumbbell sits* decides whether it is framed or cut. Move the drop and the
dumbbell width has to move with it. The lab reports `clearanceEachSide` live —
**if it goes negative the plates are crossing the neon.**

### Colour

```
triGrad   vertical, y 0→268
          0%  #FF5FA2   26% #FF8FBE   37% #FFD9E8   50% #FF8FBE   100% #FF5FA2

triGlare  vertical, y 70→132, white with alpha 0 → .55 → 1 → .55 → 0
```

The gradient runs **down** the shape, not across. Across put its bright middle
on the centre of the top edge and on the apex — the two places the dumbbell is
nowhere near.

`y=100` is where the bar crosses the two sides. **Measured, not guessed** — and
it moves if the drop or the widths move.

> `gradientUnits="userSpaceOnUse"`, always. `objectBoundingBox` has bitten this
> file three times: on a straight line the bounding box has zero area and the
> gradient renders nothing at all in iOS Safari.

### Timing — three animations, one event

Everything hangs off the dumbbell's rep: **4400ms**.

| | Value |
|---|---|
| `--beat` | `4400ms` — the rep animation's period |
| `triRun`, `triBeat` delay | **`-1650ms`** |
| `dbGlow` | 4400ms, starts 0.55s after `alive`, peaks at its own 50% |

**Where -1650 comes from.** The glow behind the dumbbell peaks 2750ms into
every cycle (0.55 + 2.2). The light starts its lap at the left end of the top
edge. A −1650ms phase shift puts lap-position 0 at t=2750, so the light enters
the long top line at the exact instant the background swells.

> **If you change the beat, this has to move with it: `offset = beat − 2750`.**
> Get it wrong and the heartbeat fires while the light is somewhere down the
> left side, which is the one thing this whole arrangement exists to avoid.

Verified by driving the timeline directly:

```
T=2800   light enters the top edge     glow 0.86 (peak)
T=3000   blur 34   ← lub
T=3200   blur 10
T=3400   blur 24   ← dub
T=3600   light leaves the top edge
T=3800   blur 7    ← rest
```

The heartbeat occupies the first 21% of the lap; the light is on the top edge
for the first 24%. **One event per lap, in one place.**

### The engine

One `requestAnimationFrame` loop computes every stroke's position from elapsed
time — the **ONE CLOCK**. Every stroke used to be its own CSS transition with
its own delay, fifteen of them. Desktop coped; a phone did not, and they
drifted apart from each other. That is why the mark drew "weird" on the phone
and fine in the browser.

The triangle's draw-in rides the same eased value as the words, so the outline
closes as the name lands.

---

## Things that have already been got wrong

Kept because each one cost time to find.

**Round caps paint dots.** A round-capped stroke renders at full width even
when the visible dash length is zero, so every path showed a dot before it
drew. Fixed with an opacity ramp keyed to drawn-length ÷ stroke-width, squared.

**`stroke-dasharray: L L`, not `L`.** A dash of L followed by an equal gap
means a fully offset path parks inside the gap rather than at the edge of the
dash, so it cannot paint a stray cap.

**The 83px jump.** `placeCopy()` ran from `finishNow()`, so it re-centred the
block at the exact moment the name landed. It runs at setup now.

**The last frame.** `syncFootPad()` set `--footpad` inside a rAF, so the first
frame laid out against the 150px default and the second against the real 118.
On a vertically centred block that is a visible settle. Measured synchronously
now.

**`rAF` does not fire in a hidden tab.** Screenshots of this mark come back
blank if the browser pane is not visible. That is not a bug in the mark. The
lab's scrub control exists partly for this: it steps the animation by hand.

---

## Still open

- **The mark itself is one of two.** `MARK.engine` picks between A (three
  plates a side, drawn as widening passes) and B (two plates, the inner one
  2.25× thicker, wiped into place). Add `?mark=b` to the URL. **B has never
  been chosen or rejected** — worth a decision.
- **Reduced motion** stops the light and leaves the outline lit. Never checked
  on a real device with the setting on.
- **The wordmark** has had no attention at all. It is system font at
  `min(7.9vw, 31px)`. If the mark is going to be a logo rather than a splash
  screen, the lettering is the next thing.
- **Nothing exists outside the survey.** No favicon, no app icon, no share
  image, no static export. The triangle is CSS and SVG inside one HTML file.

---

## Files

| File | What |
|---|---|
| `logo/LOGO LAB.html` | The playground. Generated — rebuild it if hero.css/js change shape. |
| `logo/hero.css` | The mark's styles. **Source of truth.** |
| `logo/hero.js` | The mark's engine. **Source of truth.** |
| `tools/build-logo.mjs` | Pushes both into onboarding.html. `--check` to compare. |
| `onboarding.html` | Carries a generated copy between `LOGO:CSS` / `LOGO:JS` markers. **Do not edit inside them.** |
