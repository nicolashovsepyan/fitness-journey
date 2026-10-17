/* ============================================================
   CARDIO AND BOXING DRILLS, for the timers: shadow boxing (Nico's
   brother's ask), the punches, footwork, and the rope. Kept here, not in
   exercises.js (the exercise database chat's file, rebuilt from its
   workbook): this file adds them to EXERCISES the moment anything imports
   it, and steps aside for any id the library later gets on its own.
   docs/CHATS.md asks that chat to take them over.
   A timed drill is measure 'hold' (seconds, like a plank).
   ============================================================ */
import { EXERCISES } from './exercises.js';
import { EXERCISES_FR } from './exercises-fr.js';

const box = (name, measure, level, diff, cues, extra = {}) => ({ name, pattern: 'conditioning', family: 'boxing', equipment: ['bw'], measure, workType: measure === 'hold' ? 'time' : 'reps', load: 'bw', laterality: 'bilateral', level, diff, demoUrl: null, cues, noPR: true, ...extra });
export const CARDIO = {
  shadow_boxing: box('Shadow Boxing', 'hold', 'beg', 3, 'Hands up, chin down. Snap every punch back to your guard. Stay light on your feet.'),
  jab_cross: box('Jab-Cross', 'reps', 'beg', 2, 'Jab, then turn the back hip into the cross. Hands back to the face.'),
  boxing_hooks: box('Hooks', 'reps', 'beg', 3, 'Elbow up at shoulder height, pivot the front foot, turn the hips.'),
  boxing_uppercuts: box('Uppercuts', 'reps', 'beg', 3, 'Dip a little, drive up from the legs, punch through the chin line.'),
  slip_and_roll: box('Slips and Rolls', 'hold', 'int', 4, 'Slip by bending at the knees, not the waist. Roll under in a U, eyes forward.'),
  speed_punches: box('Speed Punches', 'hold', 'beg', 4, 'Fast straight punches, shoulders relaxed, never lock the elbows.'),
  boxer_shuffle: box('Boxer Shuffle', 'hold', 'beg', 3, 'Light bounce on the balls of the feet, small quick steps, guard up.'),
  jump_rope: box('Jump Rope', 'hold', 'beg', 3, 'Small jumps, wrists turn the rope, elbows close to the body.', { family: 'rope', equipment: ['rope'] }),
  double_under: box('Double-Unders', 'reps', 'int', 6, 'Jump a little higher, whip the wrists fast. The rope passes twice.', { family: 'rope', equipment: ['rope'] }),
  jumping_jack: box('Jumping Jacks', 'reps', 'beg', 1, 'Arms all the way up, land soft, keep a steady rhythm.', { family: 'jumping' }),
  high_knees: box('High Knees', 'hold', 'beg', 3, 'Knees to hip height, pump the arms, stay on the balls of the feet.', { family: 'running' }),
};
for (const [id, e] of Object.entries(CARDIO)) if (!EXERCISES[id]) EXERCISES[id] = e;
/* and in French (docs/FRENCH.md: shadow boxing, jab, uppercut are what French gyms say) */
const FR = {
  shadow_boxing: { name: 'Shadow boxing', cues: 'Garde haute, menton baissé. Ramène chaque coup en garde. Reste léger sur les appuis.' },
  jab_cross: { name: 'Jab-direct', cues: 'Jab, puis tourne la hanche arrière pour le direct. Les mains reviennent au visage.' },
  boxing_hooks: { name: 'Crochets', cues: 'Coude à hauteur d’épaule, pivote le pied avant, tourne les hanches.' },
  boxing_uppercuts: { name: 'Uppercuts', cues: 'Fléchis un peu, pousse avec les jambes, frappe vers le haut.' },
  slip_and_roll: { name: 'Esquives et rotations', cues: 'Esquive en fléchissant les genoux, pas le dos. Passe dessous en U, regard devant.' },
  speed_punches: { name: 'Coups rapides', cues: 'Coups droits rapides, épaules relâchées, ne verrouille jamais les coudes.' },
  boxer_shuffle: { name: 'Pas de boxeur', cues: 'Petits rebonds sur l’avant du pied, pas rapides, garde haute.' },
  jump_rope: { name: 'Corde à sauter', cues: 'Petits sauts, les poignets font tourner la corde, coudes près du corps.' },
  double_under: { name: 'Double-unders', cues: 'Saute un peu plus haut, poignets rapides. La corde passe deux fois.' },
  jumping_jack: { name: 'Jumping jacks', cues: 'Bras tout en haut, réception souple, rythme régulier.' },
  high_knees: { name: 'Montées de genoux', cues: 'Genoux à hauteur de hanche, bras actifs, sur l’avant du pied.' },
};
for (const [id, e] of Object.entries(FR)) if (!EXERCISES_FR[id]) EXERCISES_FR[id] = e;
