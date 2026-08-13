/* ============================================================
   BUILD EXERCISE IMAGES

   Run:  node tools/build-exercise-images.mjs

   Takes the rendered artwork in "EXERCISE LIBRARY", resizes it, and
   writes it into images/exercises/<exercise id>.png — named by the id
   the app already uses, so nothing needs a lookup table at runtime.

   It also writes js/data/exercise-images.js: the list of exercises
   that actually have art. The app checks that list before showing a
   picture, so a missing image is a card without a photo rather than a
   broken-image icon.

   THE MAPPING BELOW IS BY HAND, ON PURPOSE.
   Matching filenames to exercise names automatically was tried and is
   not safe: it paired "banded wall sit" with Sit-Up and "push-up" with
   Wall Push-Up. With 252 exercises, a near-miss puts the wrong picture
   on the wrong movement, which is worse than no picture at all.

   Unmapped files and un-imaged exercises are both reported at the end,
   so nothing goes quietly missing in either direction.
   ============================================================ */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/* Find a folder by name, tolerating a leading/trailing space or different
   case. Both "EXERCISE LIBRARY" and "FOR NICOLAS" turned up one day renamed
   to " EXERCISE LIBRARY" and " FOR NICOLAS" — a space in front sorts them to
   the top of Finder, which is a perfectly reasonable thing to want and used
   to break every script here with ENOENT. */
function resolveDir(parent, wanted) {
  const want = wanted.trim().toLowerCase();
  const exact = join(parent, wanted);
  try { if (statSync(exact).isDirectory()) return exact; } catch {}
  for (const name of readdirSync(parent)) {
    if (name.trim().toLowerCase() !== want) continue;
    const full = join(parent, name);
    try { if (statSync(full).isDirectory()) return full; } catch {}
  }
  return exact;   // let the caller fail with a clear path
}
const SRC = process.argv[2] || resolveDir(ROOT, 'EXERCISE LIBRARY');

/* Extra source folders, scanned after SRC. Set 2 arrived already named by
   exercise id, so it needs no hand mapping at all — the filename IS the id.
   Anything here that does not match a database entry is reported, not
   guessed at. */
const EXTRA_DIRS = [
  join(SRC, 'Exercise_Illustration_Collection', 'FitnessJourney_Exercise_Illustrations_Set_2')
];
const OUT = join(ROOT, 'images', 'exercises');
const WIDTH = 460;          // roughly 2x the biggest the card ever renders
const PALETTE = 128;

/* image file  ->  exercise id in js/data/exercises.js */
const MAP = {
  'banded-glute-bridge-anime.png':                          'banded_glute_bridge',
  'banded-pull-apart-shoulder-level-grey-anime.png':        'banded_pullapart',
  'bent-over-barbell-row-135lb-Supinated.png':              'bent_over_row',
  'bulgarian-split-squat-anime.png':                        'bulgarian_split',
  'chest-to-bar-pull-up-anime.png':                         'chest_to_bar',
  'dead-hang-anime.png':                                    'dead_hang',
  'deep-squat-anime.png':                                   'deep_squat_rock',
  'hollow-hold-full-extension-anime-transparent.png':       'hollow_hold',
  'inverted-row-squat-rack-barbell-lower-v2.png':           'wide_inverted_row',
  'jump-squat-anime.png':                                   'jump_squat',
  'l-sit-pull-up-anime.png':                                'l_sit_pullup',
  'mountain-climber-anime.png':                             'mountain_climber',
  'muscle-up-three-position-anime.png':                     'muscle_up_bar',
  'pike-push-up-anime-transparent-v2.png':                  'pike_push_up',
  'planche-lean-push-up-pronounced-v2.png':                 'pseudo_planche_push_up',
  'plank-forearms-and-straight-arms-stacked-transparent.png':'forearm_plank',
  'pull-up-anime-male.png':                                 'pullup',
  'push-up-anime.png':                                      'pushup',
  'single-leg-rdl-right-hand-contralateral-corrected.png':  'single_leg_rdl',

  /* Added 2026-08-12. These were drawn all along; they had no exercise to
     attach to until back squat, bench press, overhead press and bodyweight
     squat were added to the database, and until the spine surfaced the
     other five as orphans. */
  'bodyweight-squat-anime.png':                             'bodyweight_squat',
  'back-squat-135lb-anime-transparent.png':                 'back_squat',
  'flat-barbell-bench-press-185lb-anime-transparent.png':   'bench_press',
  'standing-barbell-overhead-press-90lb-anime-transparent.png': 'overhead_press',
  'wall-sit-anime.png':                                     'wall_sit',
  'farmers-carry-anime-transparent.png':                    'farmers_carry',
  'kettlebell-swing-anime.png':                             'kb_swing',
  'hanging-knee-raises-transparent-v3.png':                 'hanging_knee_raise',
  'turkish-get-up-right-hand-position-4-reference-match-transparent.png': 'turkish_getup',
  /* Added 2026-08-13. Set 2 and the sorted Exercise_Illustration_Collection.
     Keys carry a sub-path because the new artwork arrived filed into folders
     rather than loose at the top level; join() handles it and the mapping
     stays hand-written for the reason at the top of this file. */
  'Exercise_Illustration_Collection/FitnessJourney_Exercise_Illustrations_Set_2/dip.png':                  'dip',
  'Exercise_Illustration_Collection/FitnessJourney_Exercise_Illustrations_Set_2/straight_bar_dip.png':     'straight_bar_dip',
  'Exercise_Illustration_Collection/FitnessJourney_Exercise_Illustrations_Set_2/ring_dip.png':             'ring_dip',
  'Exercise_Illustration_Collection/FitnessJourney_Exercise_Illustrations_Set_2/dip_support_hold.png':     'dip_support_hold',
  'Exercise_Illustration_Collection/FitnessJourney_Exercise_Illustrations_Set_2/ring_dip_support_hold.png':'ring_dip_support_hold',
  'Exercise_Illustration_Collection/FitnessJourney_Exercise_Illustrations_Set_2/deadstop_pushup.png':      'deadstop_pushup',
  'Exercise_Illustration_Collection/FitnessJourney_Exercise_Illustrations_Set_2/deep_pike_pushup.png':     'deep_pike_pushup',
  'Exercise_Illustration_Collection/FitnessJourney_Exercise_Illustrations_Set_2/explosive_chinup.png':     'explosive_chinup',
  'Exercise_Illustration_Collection/FitnessJourney_Exercise_Illustrations_Set_2/handstand.png':            'handstand',
  'Exercise_Illustration_Collection/FitnessJourney_Exercise_Illustrations_Set_2/hollow_rocks.png':         'hollow_rocks',
  'Exercise_Illustration_Collection/FitnessJourney_Exercise_Illustrations_Set_2/dead_bug.png':             'dead_bug',
  'Exercise_Illustration_Collection/FitnessJourney_Exercise_Illustrations_Set_2/db_swing.png':             'db_swing',
  'Exercise_Illustration_Collection/FitnessJourney_Exercise_Illustrations_Set_2/hip_thrust.png':           'hip_thrust',
  'Exercise_Illustration_Collection/FitnessJourney_Exercise_Illustrations_Set_2/hip_cars.png':             'hip_cars',
  'Exercise_Illustration_Collection/01_Pulling_Back_Hanging/006_active_hang.png':                          'active_hang',
  'Exercise_Illustration_Collection/01_Pulling_Back_Hanging/005_chin_up_supinated_grip.png':               'chin_up',
  'Exercise_Illustration_Collection/02_Pushing_Chest_Shoulders/014_straight_bar_push_up.png':              'straight_bar_push_up',
  'Exercise_Illustration_Collection/03_Lower_Body_Glutes_Posterior_Chain/033_conventional_deadlift_135lb.png': 'deadlift',
  'Exercise_Illustration_Collection/03_Lower_Body_Glutes_Posterior_Chain/035_isometric_horse_stance.png':  'horse_stance',
  'Exercise_Illustration_Collection/03_Lower_Body_Glutes_Posterior_Chain/034_banded_lateral_walk_ankle_band.png': 'banded_sidewalk',
  'Exercise_Illustration_Collection/03_Lower_Body_Glutes_Posterior_Chain/030_45_degree_hip_extension_glute_focused.png': 'back_extension_45',
  'Exercise_Illustration_Collection/04_Core_Trunk_Stability/042_bird_dog.png':                             'bird_dog',
  'Exercise_Illustration_Collection/04_Core_Trunk_Stability/043_bird_dog_crunch.png':                      'bird_dog_crunch',
  'Exercise_Illustration_Collection/04_Core_Trunk_Stability/045_dragon_flag_raises.png':                   'dragon_flag',
  'Exercise_Illustration_Collection/06_Mobility_Movement_Control/053_cat_cow.png':                         'cat_cow',
  'Exercise_Illustration_Collection/06_Mobility_Movement_Control/052_downward_dog_to_upward_dog.png':      'down_dog_up_dog',
  'man-maker-six-stage-transparent.png':                    'man_maker',
  'burpee-five-stage-transparent.png':                      'full_burpee',
  'navy-seal-burpee-nine-stage-mobile-transparent.png':      'navy_seal_burpee',
};

/* Deliberately not used. Kept here so it is a recorded decision rather
   than a file someone assumes was missed. */
const SKIP = {
  'bulgarian-split-squat-50lb-dumbbells-anime.png':   'variant of bulgarian_split, one image per exercise',
  'bulgarian-split-squat-quad-focused-anime.png':     'variant of bulgarian_split',
  'pike-push-up-anime-transparent-v2 (1).png':        'duplicate download',
  'flat-barbell-bench-press-anime.png':               'superseded by the 185lb render',
  'single-leg-rdl-left-hand-contralateral-corrected.png': 'other side of single_leg_rdl',
  'banded-wall-sit-anime.png':                        'banded variant; wall_sit uses the unbanded render',
  'navy-seal-burpee-nine-stage-mobile-transparent (1).png': 'duplicate download',
  'bent-over-barbell-row-135lb-pronated-reference-corrected-transparent.png': 'pronated variant; bent_over_row uses the supinated render',
  'bent-over-row-135lb-matched-bar-length-transparent.png': 'bar-length study of the same movement',
  /* Drawn, but there is no exercise to hang them on yet. Power clean and the
     clean-to-press are Nicolas's own additions to the full-body ladder and
     have to be added to the database before these can be used. */
  'barbell-power-clean-three-phase-anime-transparent.png': 'no power_clean in the database yet',
  'power-clean-to-overhead-press-four-phase-anime-transparent.png': 'no clean-to-press in the database yet',
};

const sh = (c, a) => execFileSync(c, a, { maxBuffer: 1 << 30 });

/* ---- read the exercise database ---- */
/* `[^{}]*?` rather than `[^\n]*?`: exercises-gym.js writes entries across
   several lines, so a same-line-only match silently could not see any of
   them — wall_sit, farmers_carry and kb_swing all read as UNKNOWN ID while
   sitting in the database the whole time. Braces still bound the match, so
   it cannot run past the end of one entry into the next.

   The quote is captured and back-referenced because a name containing an
   apostrophe is written with double quotes -- "Farmer's Carry" was invisible
   to a single-quote-only pattern. */
const grab = f => [...readFileSync(join(ROOT, f), 'utf8')
  .matchAll(/^\s{2}([a-z0-9_]+):\s*\{[^{}]*?name:\s*(['"])(.*?)\2/gm)].map(m => ({ id: m[1], name: m[3] }));
const seen = new Set();
const DB = [...grab('js/data/exercises.js'), ...grab('js/data/exercises-gym.js')]
  .filter(e => !seen.has(e.id) && seen.add(e.id));
const byId = new Map(DB.map(e => [e.id, e]));

/* ---- which exercises the programs actually use ---- */
const programText = ['js/data/program.js', 'js/data/sessions.js', 'js/data/sessions-beginner.js']
  .map(f => readFileSync(join(ROOT, f), 'utf8')).join('\n');
const USED = new Set(DB.filter(e => new RegExp(`['"]${e.id}['"]`).test(programText)).map(e => e.id));

/* ---- build ---- */
mkdirSync(OUT, { recursive: true });
const done = [];
let bytes = 0;

/* Every job to run: the hand-mapped files from SRC, plus every file in an
   EXTRA_DIR whose filename already IS an exercise id. */
const JOBS = Object.entries(MAP).map(([file, id]) => [join(SRC, file), id, file]);
for (const dir of EXTRA_DIRS) {
  if (!existsSync(dir)) { console.error(`  MISSING DIR   ${dir}`); continue; }
  for (const f of readdirSync(dir).filter(f => /\.png$/i.test(f))) {
    const id = f.replace(/\.png$/i, '');
    JOBS.push([join(dir, f), id, f]);
  }
}

for (const [src, id, file] of JOBS) {
  if (!existsSync(src)) { console.error(`  MISSING FILE  ${file}`); continue; }
  if (!byId.has(id))    { console.error(`  UNKNOWN ID    ${id} (from ${file})`); continue; }

  const out = join(OUT, `${id}.png`);
  sh('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vf',
    `scale=${WIDTH}:-1:flags=lanczos:force_original_aspect_ratio=decrease,split[a][b];` +
    `[a]palettegen=max_colors=${PALETTE}:reserve_transparent=1[p];[b][p]paletteuse=alpha_threshold=128`,
    out]);
  const sz = statSync(out).size;
  bytes += sz; done.push(id);
  console.log(`  ${id.padEnd(24)} ${(sz / 1024).toFixed(0).padStart(4)} KB   ${byId.get(id).name}`);
}

/* ---- the list the app reads ---- */
writeFileSync(join(ROOT, 'js', 'data', 'exercise-images.js'),
`/* GENERATED by tools/build-exercise-images.mjs — do not edit by hand.

   Exercises that have artwork in images/exercises/. The app checks this
   before rendering a picture, so an exercise without one shows a clean
   card instead of a broken-image icon. */
export const EXERCISE_IMAGES = new Set(${JSON.stringify(done.sort(), null, 2)});

export function exerciseImage(id) {
  return EXERCISE_IMAGES.has(id) ? \`images/exercises/\${id}.png\` : null;
}
`);

/* ---- report both directions ---- */
const mapped = new Set(Object.keys(MAP));
const skipped = new Set(Object.keys(SKIP));
const orphanFiles = readdirSync(SRC)
  .filter(f => /\.png$/i.test(f) && !mapped.has(f) && !skipped.has(f));

const usedNoImage = [...USED].filter(id => !done.includes(id)).sort();

console.log(`\n${done.length} images built, ${(bytes / 1024).toFixed(0)} KB total`);
console.log(`js/data/exercise-images.js written`);

if (orphanFiles.length) {
  console.log(`\nArtwork with no exercise in the database (${orphanFiles.length}):`);
  for (const f of orphanFiles) console.log(`  ${f}`);
}
console.log(`\nExercises the programs use that still have no picture: ${usedNoImage.length} of ${USED.size}`);

writeFileSync(join(resolveDir(ROOT, 'FOR NICOLAS'), 'IMAGES TO MAKE.md'), [
  '# Exercise images — what is still needed',
  '',
  `Generated by \`node tools/build-exercise-images.mjs\`. ${new Date().toISOString().slice(0, 10)}`,
  '',
  `**${done.length}** exercises have artwork. **${usedNoImage.length}** used by the programs still need it.`,
  '',
  '## Priority — used by your programs, no picture yet',
  '',
  '| Exercise | id (name the file this) |',
  '|---|---|',
  ...usedNoImage.map(id => `| ${byId.get(id).name} | \`${id}.png\` |`),
  '',
  '## Artwork you have made that has no exercise in the database',
  '',
  orphanFiles.length
    ? 'These cannot be used until the exercise itself is added.\n\n' + orphanFiles.map(f => `- ${f}`).join('\n')
    : '_None._',
  '',
  '## Already done',
  '',
  done.sort().map(id => `- ${byId.get(id).name} — \`${id}.png\``).join('\n'),
  '',
].join('\n'));
console.log('FOR NICOLAS/IMAGES TO MAKE.md written');
