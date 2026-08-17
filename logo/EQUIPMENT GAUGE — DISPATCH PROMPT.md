# Dispatch prompt — equipment gauges on exercise cards

Copy everything below the rule into the other session.

---

Wire the three equipment weight-gauges into every exercise card, so each card shows the
right piece of equipment for its exercise, loaded to the weight the user selected.

Read the whole brief before starting. The single most important part is the
PROPAGATION RULE — the gauges must behave like the logo does, where one source file
feeds every place it appears and a build script proves they agree.

=====================================================================
1. WHAT ALREADY EXISTS — READ FIRST, DO NOT REBUILD
=====================================================================

logo/DUMBBELL.html contains a finished, signed-off 3D equipment renderer. It draws a
dumbbell, an Olympic barbell and a dip-belt load, in one-point perspective on the
dashboard's sunset floor. The visual design is LOCKED AND APPROVED — extract and wire
it, do not restyle it.

Four entry points, each returning a complete <svg> string:

  sceneSVG(weightPerHand, opts)     // dumbbell — one or a mirrored pair
  barbellSceneSVG(total, opts)      // olympic barbell, total incl. the 45lb bar
  beltSceneSVG(total, opts)         // plates hanging from a dip belt on a chain
  kettlebellSceneSVG(weight, opts)  // one bell — see the asset note below

Shared opts: { W, H, sc, yaw, depth, floor, C } where C is the palette.
Dumbbell also takes count:'pair'|'one' and gap.
Barbell and belt also take numbers, numSize, plateScale.
Belt also takes spread, fade, trim.
Kettlebell takes no yaw — it is a fixed render, not geometry.

THE KETTLEBELL SHIPS AN IMAGE AND THAT IS DELIBERATE.
It draws images/equipment/kettlebell.png (358x512 grey+alpha, 95 KB) rather
than paths. Four drawn kettlebells were built and all four were rejected — the
shape is a sphere fused to a bent handle and the eye catches the join at card
size. Do not try to "finish" it in code.

IT WAS BRIEFLY TWO IMAGES AND IS DELIBERATELY BACK TO ONE. A real rack changes
its balls enormously between 4 kg and 40 kg while its handles barely change, so
the artwork was split and scaled on separate laws. It worked and it was not
worth it: at card size the difference was very hard to see, and a light bell's
oversized handle could run out of ball to hide its legs in. One picture scaled
whole is the version with nothing to go wrong. The split is recoverable from
git if that is ever revisited — look for kettlebell-ball.png and
kettlebell-handle.png.

Two things follow that you must not get wrong:

  · THE PNG MUST BE DEPLOYED. A missing image does not throw — SVG just draws
    nothing — so a page that cannot reach images/equipment/ loses its
    kettlebell SILENTLY. Check it renders; do not check only that it compiles.

  · `src` IS RELATIVE TO THE PAGE, NOT TO THE MODULE. The default suits pages
    at the site root. A page at another depth passes its own path through
    gaugeOpts' `src` — the lab does exactly this, with '../images/…'. Do NOT
    change it to a root-relative '/images/…': the site is served from a
    subpath and that 404s there.

THE PAIR IS MIRRORED, AND THE MIRROR IS ON THE PICTURE ONLY. Flipping the whole
group would reverse the digits — the same reflected-frame problem the plates
have — and would leave the number at the original fraction, which on a flipped
bell is the ball's blank side rather than the medallion. So the image is
mirrored, the text is not, and the text's position mirrors with it: the
fraction across becomes 1 - numX and the tilt negates. `mirror: false` draws
two straight copies instead. `gap` is FLOOR between them, not centre to centre,
so it holds as the bells grow.

`wide` and `tall` are separate multipliers on the drawn box, both 1 at the
artwork's own proportion, and they are the owner's to set. The shadow and the
number are derived from the drawn size, so stretching the bell does not leave
it standing on the wrong shadow or slide the weight off its medallion.

The weight is LIVE TEXT drawn onto a blank medallion in the artwork, so it is
correct at every step of the range. An earlier asset had "20" baked into it,
which is right for exactly one of the twenty steps. If the artwork is ever
re-exported, it must come back with that medallion still empty.

=====================================================================
2. THE PROPAGATION RULE — THIS IS THE POINT OF THE TASK
=====================================================================

Requirement: when the owner changes the gauge — geometry, colour, camera, plate sizes —
that change must appear EVERYWHERE the gauge is drawn, without anyone editing a second
copy by hand.

CRITICAL CONSTRAINT, CHECK IT YOURSELF BEFORE DESIGNING ANYTHING:
The app's pages load NO external scripts. onboarding.html, dashboard.html and coach.html
are self-contained single-file builds with every script inlined — grep them for
`<script src=` and you will get nothing. So a runtime `import` of a shared module is
NOT possible. The renderer has to be INJECTED into each page as generated source,
between markers. This is exactly why the logo works the way it does.

Copy the logo's architecture. Read tools/build-logo.mjs first — it is the reference
implementation and it is well commented.

  a) SINGLE SOURCE OF TRUTH: logo/equipment.mjs
     Extract the renderer from logo/DUMBBELL.html — everything from the "THE PROJECTION"
     banner down to the end of sceneSVG(). It exports the three scene functions, the
     loaders (decompose, barLoad, beltLoad), AND the locked settings and palette (see
     section 3). Settings live in the module so that changing them propagates too — a
     colour hard-coded in a card is the same bug as a duplicated function.

  b) GENERATED BLOCKS IN EVERY CONSUMER
     Each consuming page carries a generated copy between markers, in the same style
     the logo uses:

       /* ===== EQUIP:JS — generated from logo/equipment.mjs, do not edit here ===== */
       ...generated...
       /* ===== /EQUIP:JS ===== */

     The module is ESM; the pages need plain script. Have the build strip the
     `export` keywords when it injects — do not maintain two hand-written dialects.

  c) THE BUILD: tools/build-equipment.mjs
     Pushes the source into every consumer. Modelled on tools/build-logo.mjs, including
     its refusal behaviour:
       - Refuses if a marker is missing.
       - Refuses if the write would change a file's size by more than a third. Silently
         half-applying to a ~1 MB single-file app is worse than not running.
       - Rewrites a file only when the content would actually change, so running twice
         is a no-op and `git status` stays honest.

  d) DRIFT DETECTION: --check
     `node tools/build-equipment.mjs --check` reports whether the source and every
     consumer agree, writes nothing, and exits non-zero if they have drifted. Run it
     BEFORE starting gauge work: if it fails, someone hand-edited a generated block and
     that has to be reconciled first.

  e) FIND THE CONSUMERS, DO NOT ASSUME THEM
     Grep for every page that renders an exercise card. Likely onboarding.html,
     dashboard.html, coach.html, plus the lab logo/DUMBBELL.html itself. Every one of
     them gets a marked block. The lab must keep working from the same source — it is
     where the owner tunes the design, so it cannot be the one copy that drifts.

  f) AFTER BUILDING: re-run `node build-sw.mjs` before deploying, as the logo build
     instructs, so the service worker picks up the changed files.

WHY THIS MATTERS, FROM THIS PROJECT'S OWN HISTORY: the mark and the app icon were once
maintained separately. The icon quietly became a different logo — no pink in it at all —
and nobody noticed for months. Later, a hand-kept second copy of the animation CSS meant
a change was applied in one file and not the other, and a whole feature silently did
nothing while looking fine. Both were fixed by exactly the pipeline above. Do not
reintroduce the pattern.

=====================================================================
3. THE LOCKED SETTINGS — PUT THESE IN THE MODULE, PASS THEM AT CALL SITES
=====================================================================

  DUMBBELL = { yaw: 9,   depth: 0.36, gap: 50, grip: 23, count: 'pair' }
  BARBELL  = { yaw: 1,   depth: 0.19, shaftHalf: 130, sleeveLen: 72,
               shaftR: 3.40, sleeveR: 6.07, plateScale: 1.00,
               numSize: 0.44, numbers: true }
  BELT     = { yaw: -18, depth: 0.56, spread: 0, plateScale: 0.92,
               numSize: 0.44, fade: 0.78, trim: 0.61, numbers: true }
  KETTLEBELL = { src: 'images/equipment/kettlebell.png', size: 165,
                 growth: 1/3, wide: 1, tall: 1,
                 count: 'one', gap: 40, mirror: true,
                 tint: true, dark: '#20242a', light: '#95A1AE',
                 stretch: 2.96, black: 0.128, numbers: true,
                 numX: 0.7963, numY: 0.7031, numSize: 0.115,
                 squash: 0.724, tilt: -12, numFill: '#DDE3EA',
                 numOpacity: 0.92 }

The kettlebell's `size` is the drawn HEIGHT at the top of the range, and
numX / numY / numSize are fractions of the drawn box — so the number rides
along when `wide` or `tall` stretch the bell.

  PALETTE  = { handle:'#A8B2BC',
               p20:'#2B3138', p10:'#2B3138', p5:'#2B3138',   // ONE tone
               neon:'#EFF1EF', neonOn:true, glow:0.32 }

Export these from logo/equipment.mjs. No call site may hard-code a colour, an angle or
a scale — if a card needs a different size, it passes W/H/sc, never a different yaw or
palette. That is what makes one edit reach every screen.

The three plate colours are DELIBERATELY IDENTICAL. A lighter-per-denomination ladder
was tried and rejected: one tone reads as a set of weights rather than three grades of
them. Do not "fix" this.

=====================================================================
4. WHICH GAUGE FOR WHICH EXERCISE
=====================================================================

Database: EXERCISE DATABASE/workbook/_derived.json (307 rows). Drive the choice off its
own fields — do NOT hard-code exercise names.

  loadable    "FALSE" -> no gauge at all. 246 of 307 rows.
  equipment   comma-separated tokens: bb, db, kb, bw, vest, bench, rings, pullupbar,
              machine, cable, band, dipbars, parallettes, rack, mat, slantboard
  laterality  bilateral / unilateral
  loading     bodyweight, external-load, leverage, added-load, assisted, banded

Resolution order — FIRST MATCH WINS:
  1. loadable !== "TRUE"                                  -> no gauge
  2. loading = "bodyweight"                               -> no gauge
  3. equipment contains "bb"                              -> BARBELL
  4. equipment contains "db"                              -> DUMBBELL
       count comes from heldCount(row), NOT from laterality
  5. equipment contains "vest", or loading = "added-load" -> BELT
  6. equipment contains "kb"                              -> KETTLEBELL
       count is HELD[row.id] || 'one'  — NOT heldCount()
  7. anything else (machine, cable, band)                 -> no gauge, plain number field

A KETTLEBELL DEFAULTS TO ONE WHERE A DUMBBELL DEFAULTS TO A PAIR, AND THAT IS
DELIBERATE. heldCount() reads `laterality`, which is right for a dumbbell —
bilateral means one in each hand. Kettlebells break it constantly: a swing, a
goblet squat and a halo are all bilateral and all held with BOTH HANDS ON ONE
BELL, so running them through heldCount puts two bells on nearly every
kettlebell card. Doubles are real but they are the exception, so they are named
in HELD rather than inferred. Today every one of the 11 kb rows resolves to a
single bell; add an id to HELD with 'pair' to change one.

RULE 2 IS NOT REDUNDANT WITH RULE 1. Three rows list iron, are marked
loadable, and are loaded by BODYWEIGHT — the equipment is a surface rather
than the resistance:

  pushup_on_dumbbells             hands on the handles
  diamond_push_up_on_kettlebell   hands on the bell
  prone_ytw                       marked bodyweight in the database

Without rule 2 each gets a weight stepper, which asks the user to choose how
heavy their push-up is. If one of these should in fact carry a weight, change
its `loading` value in the database — do not add a name-based exception, which
is the thing this resolver exists to avoid.

Put this resolver IN logo/equipment.mjs too, as one exported function
(e.g. gaugeFor(exerciseRow)). If the rule lives in the module it propagates like
everything else; if it is written inline in a card it will be copied and will drift.

Sanity-check against the resolved counts over the 307 rows — if yours differ, something
is wrong before you start:

  barbell 9 · dumbbell 20 · belt 6 · kettlebell 11 · none 261

There is no longer a kettlebell gap. Every loadable row now resolves to a real object.

=====================================================================
5. LOADING RULES — PHYSICAL, KEEP EXACT
=====================================================================

  Dumbbell   plates 20/10/5        5–100 PER HAND    step 5
             stack mirrored on both ends
  Barbell    plates 45/35/25/10/5  45–405 TOTAL      step 10
             bar is 45 on its own; per side = (total - 45) / 2
  Belt       plates 45/35/25/10/5  5–135             step 5
             threaded one at a time, max 3 x 45
  Kettlebell no plates              5–100             step 5
             usually ONE bell; a mirrored pair is available for the doubles
             (see the resolver note). A pair reads "2 x 20 lb" with
             "40 lb total" secondary, exactly like the dumbbell.

The kettlebell has no decomposition because it is a single cast object. It grows by
the SAME cube-root law as the plates — 20x the weight is 2.71x the bell, not 20x.

Decomposition is greedy, largest first — how a collar is actually loaded, and it keeps
the silhouette stable as weight climbs. Use the exported decompose / barLoad / beltLoad;
do not write your own.

Barbell totals move in TENS because plates go on in pairs. That is why 135 is one 45 a
side and 225 is two — the gym numbers fall out of the arithmetic. Do not round to 5.

=====================================================================
6. CARD UI
=====================================================================

- Stepper: minus / value / plus.
- Dumbbell pairs read "2 x 25 lb", with "50 lb total" secondary — nobody picks up a 50,
  so the per-hand number is primary.
- Single dumbbell reads plain: "25 lb".
- Above the top of a range, show max plus "+"  (100+, 405+, 135+).
- Persist the user's selection per exercise.

=====================================================================
7. TRAPS ALREADY HIT AND FIXED — DO NOT REINTRODUCE
=====================================================================

- DEPTH ORDERING FLIPS WITH THE SIGN OF THE YAW. Depth is s * sin(yaw). At a negative
  yaw the far end of a stack becomes the +s end. Three things depend on it: the paint
  order, which plate face is visible, and which chain leg is drawn in front. All derive
  direction from sign(sin(yaw)) — never from position along the bar. The belt runs at
  yaw -18, so this is live, not theoretical.
- THE NUMBER-ON-PLATE TRANSFORM MUST HAVE A POSITIVE DETERMINANT or the digits render
  mirrored; and at a near-edge-on yaw the frame collapses and they must be suppressed
  rather than smeared into a line.
- THE DUMBBELL PAIR IS MIRRORED BY YAW 180 - theta, NOT -theta. Minus theta mirrors it
  top-to-bottom instead. Do not replace this with an SVG scale(-1,1): that flips the
  gradients too and lights the second dumbbell from the wrong side.
- PLATE SIZES ARE REAL SPEC DIMENSIONS, not solved from a volume law. A 25 is 280mm,
  noticeably smaller than a 35. An earlier version derived thickness so r^2*t tracked
  weight; it looked tidy and pushed the 25 out to 378mm, almost the size of a 35.
  Diameter is what a lifter recognises. It wins.
- IF YOU ADD localStorage STATE, BUMP THE KEY WHEN YOU CHANGE A DEFAULT. A stored older
  state is merged over new defaults and will silently mask them.

=====================================================================
8. DELIVERABLE
=====================================================================

1. logo/equipment.mjs — renderer, locked settings, palette and gaugeFor() resolver.
2. tools/build-equipment.mjs — injects into every consumer; --check reports drift and
   exits non-zero; refuses rather than guesses.
3. Marked EQUIP:JS blocks in every consuming page, including logo/DUMBBELL.html.
4. Card integration: per-exercise gauge selection and a working stepper.
5. A short note listing every loadable exercise that resolved to NO GAUGE, so the gaps
   are visible rather than silent.
6. Confirmation that images/equipment/kettlebell.png is reachable from every page that
   can draw a kettlebell. A missing image does not throw — it renders nothing — so this
   is the one failure here that testing by reading the code will not catch. Look at a
   rendered card.

PROVE THE PROPAGATION WORKS before you call it done:
  - Run the build twice; the second run must report nothing to do.
  - Change one value in logo/equipment.mjs — the neon colour is easiest to see — run the
    build, and confirm it visibly changed in EVERY consumer. Then revert it and rebuild.
  - Hand-edit one generated block, run --check, and confirm it FAILS. Then rebuild to
    repair it.

Verify by rendering, not by reading: check several real exercises of each type at card
size and confirm the plate counts match the decomposition.
