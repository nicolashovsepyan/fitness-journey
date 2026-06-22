/* ============================================================
   DATA — FORMAT LIBRARY (training methods)
   Each format is named + visible everywhere, and (later) owns ONE
   renderer in Work Mode. Adding a format = one row here + one
   renderer module. Nothing else changes.

   Schema:
     name       display name
     short      compact label shown on the block ("Yates · to failure")
     kind       renderer family the runner will dispatch on
     timed      does it run a clock?
     track      what the log captures per set/round
     blurb      one-line "how you do it" for the Day view
   ============================================================ */

export const FORMATS = {
  straight: {
    name: 'Straight Sets', short: 'Straight sets', kind: 'straight',
    timed: false, track: 'reps+weight', blurb: 'Sets across, full rest between.',
  },
  tempo: {
    name: 'Tempo', short: 'Tempo', kind: 'straight',
    timed: false, track: 'reps+weight', blurb: 'Controlled tempo (e.g. 3-1-1) each rep.',
  },
  yates: {
    name: 'Yates / HIT', short: 'Yates · to failure', kind: 'yates',
    timed: false, track: 'reps+weight (failure set)',
    blurb: 'Warm-up ramp, then ONE all-out set to failure.',
  },
  rest_pause: {
    name: 'Rest-Pause', short: 'Rest-pause', kind: 'rest_pause',
    timed: false, track: 'reps+weight (clusters)',
    blurb: 'One load, short pauses, push to a rep target.',
  },
  isometric: {
    name: 'Isometric Hold', short: 'Isometric', kind: 'isometric',
    timed: true, track: 'hold', blurb: 'Hold for time, sets across.',
  },
  emom: {
    name: 'EMOM', short: 'EMOM', kind: 'emom',
    timed: true, track: 'reps/round', blurb: 'Every minute on the minute, rest the remainder.',
  },
  amrap: {
    name: 'AMRAP', short: 'AMRAP', kind: 'amrap',
    timed: true, track: 'rounds+reps', blurb: 'As many rounds/reps as possible in the window.',
  },
  tabata: {
    name: 'Tabata', short: 'Tabata 20/10', kind: 'tabata',
    timed: true, track: 'reps/interval', blurb: '20s on / 10s off × 8.',
  },
  circuit: {
    name: 'Circuit', short: 'Circuit', kind: 'circuit',
    timed: true, track: 'reps/round', blurb: 'Rounds through the list, log during rest.',
  },
  skill: {
    name: 'Skill Practice', short: 'Skill · fresh', kind: 'skill',
    timed: true, track: 'quality/hold', blurb: 'Practiced fresh, low fatigue, quality reps.',
  },
  volume: {
    name: 'Volume', short: 'Volume · max set', kind: 'volume',
    timed: false, track: 'reps', blurb: 'High-rep set(s), often to a rep goal.',
  },
  max_test: {
    name: 'Max-Rep Test', short: 'Max test', kind: 'max_test',
    timed: false, track: 'reps (benchmark)', blurb: 'One all-out set — sets your benchmark.',
  },
};

export const fmt = (id) => FORMATS[id];
