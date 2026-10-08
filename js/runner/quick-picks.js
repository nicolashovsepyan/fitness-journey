/* ============================================================
   QUICK PICKS: ready-made workouts for each timer type, easy to hard.
   Tap one and the setup fills in (numbers and moves); everything stays
   editable after. Sources in docs/WORK-MODE.md ("Quick picks"): named
   workouts keep their original rep schemes (CrossFit benchmarks, Pavel,
   Athlean-X); the rest are classics or scaled versions of them.

   lvl: 1 easy, 2 medium, 3 hard. cfg: the setup fields it sets.
   m: the moves, [exId or custom name, reps] (Ladder and Death By:
   [exId, start, step]).
   ============================================================ */
export const PICKS = {
  emom: [
    { id: 'js10', lvl: 1, name: 'Jump Squat 10', sub: '10 min · 10 a minute · 100 total', cfg: { mins: 10, every: 60 }, m: [['jump_squat', 10]] },
    { id: 'pu45', lvl: 1, name: 'Pull-up 45', sub: '15 min · 3 a minute · 45 total', cfg: { mins: 15, every: 60 }, m: [['pullup', 3]] },
    { id: 'mchel', lvl: 1, name: 'Mini Chelsea', sub: '20 min · 2 pull-ups, 4 push-ups, 6 squats a minute', cfg: { mins: 20, every: 60, emomStyle: 'all' }, m: [['pullup', 2], ['pushup', 4], ['bodyweight_squat', 6]] },
    { id: 'js15', lvl: 2, name: 'Jump Squat 15', sub: '15 min · 12 a minute · 180 total', cfg: { mins: 15, every: 60 }, m: [['jump_squat', 12]] },
    { id: 'pu150', lvl: 2, name: 'Pull-up 150', sub: '30 min · 5 a minute · 150 total', cfg: { mins: 30, every: 60 }, m: [['pullup', 5]] },
    { id: 'bur10', lvl: 2, name: 'Burpee 10', sub: '10 min · 12 a minute · Athlean-X', cfg: { mins: 10, every: 60 }, m: [['burpee', 12]] },
    { id: 'swpu', lvl: 2, name: 'Swing + Push', sub: '10 min · 10 swings, 10 push-ups a minute', cfg: { mins: 10, every: 60, emomStyle: 'all' }, m: [['kb_swing', 10], ['pushup', 10]] },
    { id: 'hchel', lvl: 2, name: 'Half Chelsea', sub: '30 min · 3 pull-ups, 6 push-ups, 9 squats a minute', cfg: { mins: 30, every: 60, emomStyle: 'all' }, m: [['pullup', 3], ['pushup', 6], ['bodyweight_squat', 9]] },
    { id: 'pu300', lvl: 3, name: 'Pull-up 300', sub: '60 min · 5 a minute · 300 total', cfg: { mins: 60, every: 60 }, m: [['pullup', 5]] },
    { id: 'chel', lvl: 3, name: 'Chelsea', sub: '30 min · 5 pull-ups, 10 push-ups, 15 squats a minute · CrossFit', cfg: { mins: 30, every: 60, emomStyle: 'all' }, m: [['pullup', 5], ['pushup', 10], ['bodyweight_squat', 15]] },
  ],
  amrap: [
    { id: 'hcin', lvl: 1, name: 'Half Cindy', sub: '10 min · 5 pull-ups, 10 push-ups, 15 squats', cfg: { cap: 10 }, m: [['pullup', 5], ['pushup', 10], ['bodyweight_squat', 15]] },
    { id: 'rcin', lvl: 1, name: 'Ring Row Cindy', sub: '20 min · 5 ring rows, 10 push-ups, 15 squats', cfg: { cap: 20 }, m: [['ring_row', 5], ['pushup', 10], ['bodyweight_squat', 15]] },
    { id: 'kbh', lvl: 2, name: 'Kettlebell 15', sub: '15 min · 15 swings, 5 goblet squats, 5 push-ups', cfg: { cap: 15 }, m: [['kb_swing', 15], ['goblet_squat', 5], ['pushup', 5]] },
    { id: 'cin', lvl: 2, name: 'Cindy', sub: '20 min · 5 pull-ups, 10 push-ups, 15 squats · CrossFit', cfg: { cap: 20 }, m: [['pullup', 5], ['pushup', 10], ['bodyweight_squat', 15]] },
    { id: 'bcin', lvl: 3, name: 'Burpee Cindy', sub: '20 min · 5 pull-ups, 10 burpees, 15 jump squats', cfg: { cap: 20 }, m: [['pullup', 5], ['burpee', 10], ['jump_squat', 15]] },
  ],
  fortime: [
    { id: 'p100', lvl: 1, name: '100 Push-ups', sub: 'Any way you can, as fast as you can', cfg: { ftRounds: 1, ftCap: 0 }, m: [['pushup', 100]] },
    { id: 's100', lvl: 1, name: '100 Squats', sub: 'Any way you can, as fast as you can', cfg: { ftRounds: 1, ftCap: 0 }, m: [['bodyweight_squat', 100]] },
    { id: 'opm', lvl: 2, name: 'One Punch Man', sub: '100 push-ups, 100 sit-ups, 100 squats', cfg: { ftRounds: 1, ftCap: 0 }, m: [['pushup', 100], ['sit_up', 100], ['bodyweight_squat', 100]] },
    { id: 'hmurph', lvl: 2, name: 'Half Murph', sub: '800 m run, 50 pull-ups, 100 push-ups, 150 squats, 800 m run', cfg: { ftRounds: 1, ftCap: 0 }, m: [['Run 800 m', ''], ['pullup', 50], ['pushup', 100], ['bodyweight_squat', 150], ['Run 800 m', '']] },
    { id: 'angie', lvl: 3, name: 'Angie', sub: '100 pull-ups, 100 push-ups, 100 sit-ups, 100 squats · CrossFit', cfg: { ftRounds: 1, ftCap: 0 }, m: [['pullup', 100], ['pushup', 100], ['sit_up', 100], ['bodyweight_squat', 100]] },
    { id: 'murph', lvl: 3, name: 'Murph', sub: '1 mile run, 100 pull-ups, 200 push-ups, 300 squats, 1 mile run · CrossFit', cfg: { ftRounds: 1, ftCap: 0 }, m: [['Run 1 mile', ''], ['pullup', 100], ['pushup', 200], ['bodyweight_squat', 300], ['Run 1 mile', '']] },
  ],
  tabata: [
    { id: 'tsq', lvl: 1, name: 'Squat Tabata', sub: '8 rounds · 20 s on, 10 s off', cfg: { work: 20, rest: 10, rounds: 8, tbN: null, tbTotal: null }, m: [['bodyweight_squat', '']] },
    { id: 'tcore', lvl: 1, name: 'Core Tabata', sub: 'Mountain climbers and hollow hold, 8 each', cfg: { work: 20, rest: 10, rounds: 8, tbN: null, tbTotal: null }, m: [['mountain_climber', ''], ['hollow_hold', '']] },
    { id: 'tps', lvl: 2, name: 'Push + Jump', sub: 'Push-ups and jump squats, 8 each', cfg: { work: 20, rest: 10, rounds: 8, tbN: null, tbTotal: null }, m: [['pushup', ''], ['jump_squat', '']] },
    { id: 'tbur', lvl: 3, name: 'Burpee Tabata', sub: '8 rounds of burpees, all out', cfg: { work: 20, rest: 10, rounds: 8, tbN: null, tbTotal: null }, m: [['burpee', '']] },
    { id: 'tfour', lvl: 3, name: 'Tabata 4 Moves', sub: 'Pull-ups, push-ups, sit-ups, squats, 8 each · 16 min', cfg: { work: 20, rest: 10, rounds: 8, tbN: null, tbTotal: null }, m: [['pullup', ''], ['pushup', ''], ['sit_up', ''], ['bodyweight_squat', '']] },
  ],
  timer: [
    { id: 'bc15', lvl: 1, name: 'Body Coach 15', sub: '30 s on, 30 s off · 5 moves × 3 · 15 min', cfg: { tWork: 30, tRest: 30, tRounds: 3, sets: 1 }, m: [['burpee', ''], ['mountain_climber', ''], ['jump_squat', ''], ['pushup', ''], ['glute_bridge', '']] },
    { id: 'hang1', lvl: 1, name: 'Dead Hang 3 × 1 min', sub: '1 min hang, 2 min rest, × 3', cfg: { tWork: 60, tRest: 120, tRounds: 3, sets: 1 }, m: [['dead_hang', '']] },
    { id: 'plank', lvl: 2, name: 'Plank 5 × 1 min', sub: '1 min plank, 30 s rest, × 5', cfg: { tWork: 60, tRest: 30, tRounds: 5, sets: 1 }, m: [['forearm_plank', '']] },
    { id: 'hang2', lvl: 3, name: 'Dead Hang 2:00', sub: '2 min hang, 2 min rest, × 3 · the longevity target', cfg: { tWork: 120, tRest: 120, tRounds: 3, sets: 1 }, m: [['dead_hang', '']] },
  ],
  ladder: [
    { id: 'pl10', lvl: 1, name: 'Push-up 1 to 10', sub: '1, 2, 3 … 10 · 55 push-ups', cfg: { ldRungs: 10, ldShape: 'one', ldCap: 0 }, m: [['pushup', 1, 1]] },
    { id: 'pp5', lvl: 2, name: 'Pull-up Pyramid 5', sub: '1 → 5 → 1 · 25 pull-ups', cfg: { ldRungs: 5, ldShape: 'mirror', ldCap: 0 }, m: [['pullup', 1, 1]] },
    { id: 'b21', lvl: 2, name: '21-15-9 Burpees', sub: '45 burpees, 3 rungs', cfg: { ldRungs: 3, ldShape: 'one', ldCap: 0 }, m: [['burpee', 21, -6]] },
    { id: 'pp10', lvl: 3, name: 'Pull-up Pyramid 10', sub: '1 → 10 → 1 · 100 pull-ups', cfg: { ldRungs: 10, ldShape: 'mirror', ldCap: 0 }, m: [['pullup', 1, 1]] },
    { id: 'humane', lvl: 3, name: 'Humane Burpee', sub: '15 swings + 10 → 1 goblet squats and push-ups · Dan John', cfg: { ldRungs: 10, ldShape: 'one', ldCap: 0 }, m: [['kb_swing', 15, 0], ['goblet_squat', 10, -1], ['pushup', 10, -1]] },
  ],
  deathby: [
    { id: 'dsq', lvl: 1, name: 'Death by Squats', sub: '+1 squat every minute until you can\'t', cfg: { dbEvery: 60, dbMax: 30 }, m: [['bodyweight_squat', 1, 1]] },
    { id: 'dpu', lvl: 2, name: 'Death by Push-ups', sub: '+1 push-up every minute', cfg: { dbEvery: 60, dbMax: 30 }, m: [['pushup', 1, 1]] },
    { id: 'dbu', lvl: 2, name: 'Death by Burpees', sub: '+1 burpee every minute', cfg: { dbEvery: 60, dbMax: 30 }, m: [['burpee', 1, 1]] },
    { id: 'dpl', lvl: 3, name: 'Death by Pull-ups', sub: '+1 pull-up every minute', cfg: { dbEvery: 60, dbMax: 30 }, m: [['pullup', 1, 1]] },
  ],
  pushup: [
    { id: 'pt15', lvl: 1, name: 'Easy Pace', sub: '15 a minute, 1 every 4 seconds', cfg: { pace: 15 }, m: [] },
    { id: 'pt20', lvl: 2, name: 'Standard Test', sub: '20 a minute, 1 every 3 seconds', cfg: { pace: 20 }, m: [] },
    { id: 'pt25', lvl: 3, name: 'NHL Test', sub: '25 a minute, the hockey combine pace', cfg: { pace: 25 }, m: [] },
  ],
};
export const LEVEL = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };
