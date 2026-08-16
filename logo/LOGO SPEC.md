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

An inverted neon triangle with a dumbbell centred in it. **No words are part
of it.** Drawn from the 80s album-cover reference: *Metropolis 83'*.

| Part | What it is |
|---|---|
| **The outline** | Open polyline, not a closed triangle. Vertical pink gradient. |
| **The break** | A 40-unit gap in the top-left, like a dead segment in a real neon tube. |
| **The glare** | A separate blurred overlay — light coming *off* the dumbbell onto the tube. |
| **The light** | One short bright dash chasing the perimeter. The only thing that moves on the outline. |
| **The mark** | The dumbbell, drawn stroke by stroke, then breathing on a 4400ms rep. |

**The wordmark is a separate thing.** "Fitness Journey" set over a line is a
*second* logo, used where the mark alone would not identify anything. The
opening screen's copy lives at `onboarding.html:1513`, not in `hero.js`.

---

## The numbers, and why each one is what it is

### Geometry

| | Value | Why |
|---|---|---|
| viewBox | `0 0 300 268` | |
| Path | `M100 16 H286 L150 252 L14 16 H60` | Starts right of the break, runs round, stops left of it. |
| Perimeter | **777** | 186 + 272.4 + 272.4 + 46. Hard-coded as `TRI_LEN` — this is the **outline's** length, used by the draw-in only. |
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

### Timing

Everything hangs off the dumbbell's rep: **4400ms**.

### The one coincidence

| | Value |
|---|---|
| `--beat` | `4400ms` — the rep animation's period |
| `--lap-phase` | **`-1650ms`** |
| `dbGlow` | 4400ms, starts 0.55s after `alive`, peaks at its own 50% |

The glow behind the dumbbell peaks 2750ms into every cycle (0.55 + 2.2). A
−1650ms shift puts lap-position 0 at t=2750, so the light begins its run
along the top edge at the instant the mark is at its brightest.

> **If you change the beat, this moves with it: `phase = beat − 2750`.**

### There is no heartbeat, and that was deliberate

The outline used to carry a lub-dub. Then it carried a full PQRST complex —
the light ran a path with an ECG built into the top edge and deflected into a
heartbeat once a lap, with the outline's strike, the white glare and the
dumbbell's glow all landing on the same 50ms frame at t=2750.

**All of it is gone.** It was built, tuned, synchronised, and then cut,
because it made the mark busy: a neon sign is simply *on*, and every flash
argued with that. The tube is lit, the light travels, the mark breathes.

> Anything that reinstates a beat has to earn it against how quiet this
> reads. The removed version is in git if it is ever wanted back —
> `logo/hero.css` at the commit before this one carries `triBeat`,
> `triGlare`, and `ECG_D` in `hero.js`.

The glare is a **static** `opacity:.9` once lit. It is a reflection off the
dumbbell, and a reflection does not flash.

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
- **The line under the wordmark.** `sub:'starts here'` is still in place at
  `onboarding.html:1513` and is the weakest thing here. Four candidates are
  set in type in the preview; one has to be chosen. The lettering itself is
  still untouched system font at `min(7.9vw, 31px)`.
- **`dashboard.html` and `coach.html` carry no mark at all**, only a favicon.
  The stamps now exist for exactly this.

---

## Files

| File | What |
|---|---|
| `logo/LOGO PREVIEW.html` | The mark in motion, its two halves, stamp sizes, icon, deploy map. |
| `logo/LOGO LAB.html` | The older playground, with the geometry sliders. |
| `logo/hero.css` | The **moving** mark's styles. Source of truth. |
| `logo/hero.js` | The **moving** mark's engine. Source of truth. |
| `logo/mark.mjs` | The **still** mark: geometry, palette, icon and stamp exports. |
| `tools/build-logo.mjs` | One command, five destinations. `--check` compares, `--png` rasterises. |
| `onboarding.html` | Generated copy between `LOGO:CSS` / `LOGO:JS` markers. **Do not edit inside them.** |
| `icon.svg`, `icon-maskable.svg` | Generated. The whole mark, with a neon glow. |
| `images/stamp-*.svg` | Generated. Each half alone, in `currentColor`. |

### The two sources, and why there are two

`hero.js` keeps its geometry inline because the survey has to ship as one
file; `mark.mjs` holds the same numbers for everything rasterised. That is a
duplication, so the build **compares them numerically** — plate positions,
widths, both paths — and refuses to write anything if they disagree. It also
refuses if the icon's plates come within 8px of the neon.

```bash
node tools/build-logo.mjs --check
```
