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
const SRC = process.argv[2] || join(ROOT, 'EXERCISE LIBRARY');
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
};

/* Deliberately not used. Kept here so it is a recorded decision rather
   than a file someone assumes was missed. */
const SKIP = {
  'bulgarian-split-squat-50lb-dumbbells-anime.png':   'variant of bulgarian_split, one image per exercise',
  'bulgarian-split-squat-quad-focused-anime.png':     'variant of bulgarian_split',
  'pike-push-up-anime-transparent-v2 (1).png':        'duplicate download',
  'flat-barbell-bench-press-anime.png':               'superseded by the 185lb render',
  'single-leg-rdl-left-hand-contralateral-corrected.png': 'other side of single_leg_rdl',
  'banded-wall-sit-anime.png':                        'no wall sit in the database yet',
};

const sh = (c, a) => execFileSync(c, a, { maxBuffer: 1 << 30 });

/* ---- read the exercise database ---- */
const grab = f => [...readFileSync(join(ROOT, f), 'utf8')
  .matchAll(/^\s{2}([a-z0-9_]+):\s*\{[^\n]*?name:\s*'([^']+)'/gm)].map(m => ({ id: m[1], name: m[2] }));
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

for (const [file, id] of Object.entries(MAP)) {
  const src = join(SRC, file);
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

writeFileSync(join(ROOT, 'FOR NICOLAS', 'IMAGES TO MAKE.md'), [
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
