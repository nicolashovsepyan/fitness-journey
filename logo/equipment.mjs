/* ============================================================
   EQUIPMENT — the single source of truth for the three weight gauges.

   Extracted from logo/DUMBBELL.html, where the design was tuned and signed
   off. That file is still the lab, and it now reads its renderer from HERE
   through a generated block, so the place the design is tuned cannot be the
   one copy that drifts.

   Three scenes, each returning a complete <svg> string:
     sceneSVG(weightPerHand, opts)   dumbbell, one or a mirrored pair
     barbellSceneSVG(total, opts)    olympic bar, total INCLUDING the 45lb bar
     beltSceneSVG(total, opts)       plates on a dip belt

   NOTHING THAT CONSUMES THIS MAY HARD-CODE A COLOUR, AN ANGLE OR A SCALE.
   Call sites pass W/H/sc — size is theirs. Everything else comes from
   SETTINGS and PALETTE below, so one edit here reaches every screen.

   The pages that draw these load no external scripts; they are single-file
   builds. So this module is INJECTED into each of them as generated source
   by tools/build-equipment.mjs. Run that after any change here, then
   node build-sw.mjs.
   ============================================================ */

/* ==========================================================================
   THE PROJECTION

   One-point, matching the dashboard's sunset ground: the vanishing point is
   straight ahead, height shows almost in full, depth is foreshortened.

     screenX = wx
     screenY = -up * wy  -  depth * wz          (wz away from the viewer)

   The dumbbell lies in the floor plane (wy = 0 along its axis) and is yawed
   by an angle around the vertical. THAT is the rotation that matters: it is
   what gives the plate discs a depth component and turns them from strokes
   into ellipses. Rotating the finished artwork on screen — what the first
   pass did — only tips it like a see-saw and never puts it on anything.
   ========================================================================== */
var UP = 0.87;                 /* how much of a unit of height you see */

function basis(yawDeg, depth){
  var y = yawDeg * Math.PI / 180, c = Math.cos(y), s = Math.sin(y);
  return {
    /* along the bar, running away from the viewer */
    d:    { x:  c, y: -depth * s },
    /* horizontal, square to the bar */
    perp: { x: -s, y: -depth * c },
    /* world up */
    up:   { x:  0, y: -UP },
    depth: depth, sin: s
  };
}
var add = function(p,q){ return { x:p.x+q.x, y:p.y+q.y }; };
var mul = function(p,k){ return { x:p.x*k,  y:p.y*k  }; };
var cross = function(p,q){ return p.x*q.y - p.y*q.x; };
var f2 = function(n){ return n.toFixed(2); };

/* A circle drawn in an arbitrary pair of semi-axis vectors. Four cubic
   quarters — an SVG <ellipse> cannot be sheared like this, and the arc
   command would need the ellipse decomposed into radii and a rotation. */
function ellipsePath(C, a, b){
  var K = 0.5522847498;
  var P = function(t){ return { x: C.x + a.x*Math.cos(t) + b.x*Math.sin(t),
                                y: C.y + a.y*Math.cos(t) + b.y*Math.sin(t) }; };
  var D = function(t){ return { x: -a.x*Math.sin(t) + b.x*Math.cos(t),
                                y: -a.y*Math.sin(t) + b.y*Math.cos(t) }; };
  var s = P(0), out = 'M' + f2(s.x) + ' ' + f2(s.y);
  for(var i = 0; i < 4; i++){
    var t1 = i*Math.PI/2, t2 = t1 + Math.PI/2;
    var p1 = P(t1), p2 = P(t2), d1 = D(t1), d2 = D(t2);
    out += 'C' + f2(p1.x + K*d1.x) + ' ' + f2(p1.y + K*d1.y) + ' ' +
                 f2(p2.x - K*d2.x) + ' ' + f2(p2.y - K*d2.y) + ' ' +
                 f2(p2.x) + ' ' + f2(p2.y);
  }
  return out + 'Z';
}

/* The two points where the disc's edge turns away from the viewer, i.e.
   where its tangent runs parallel to the bar. Solving
   cross(tangent, axis) = 0 gives tan t = cross(b,axis) / cross(a,axis). */
function silhouette(a, b, u){ return Math.atan2(cross(b,u), cross(a,u)); }

/* ==========================================================================
   THE PLATES

   Sized so VOLUME tracks weight — r squared times thickness — which is why a
   20 is not four times the diameter of a 5 but 1.67 times, and barely a third
   thicker. Same reason a real 45 is wide rather than fat.
   ========================================================================== */
/* ==========================================================================
   COLOUR

   One base per denomination, and every surface of that plate is derived from
   it — face, rim, far side — so a single swatch controls a whole plate and
   the shading relationship can never drift between them.

   The ladder runs DARK = HEAVY. A 20 is nearly black, a 10 sits a couple of
   tones up, a 5 a couple above that. That means the denominations are told
   apart by VALUE rather than by size alone, which is what makes a stack
   readable at card size where the diameter difference is only a few pixels.
   ========================================================================== */
function hex2hsl(h){
  h = h.replace('#','');
  if(h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  var r = parseInt(h.substr(0,2),16)/255,
      g = parseInt(h.substr(2,2),16)/255,
      b = parseInt(h.substr(4,2),16)/255;
  var mx = Math.max(r,g,b), mn = Math.min(r,g,b), d = mx-mn;
  var l = (mx+mn)/2, s = d === 0 ? 0 : d/(1-Math.abs(2*l-1)), hh = 0;
  if(d){
    if(mx === r) hh = ((g-b)/d) % 6;
    else if(mx === g) hh = (b-r)/d + 2;
    else hh = (r-g)/d + 4;
    hh *= 60; if(hh < 0) hh += 360;
  }
  return [hh, s*100, l*100];
}
function hsl2hex(h,s,l){
  s/=100; l/=100;
  var c = (1-Math.abs(2*l-1))*s, x = c*(1-Math.abs(((h/60)%2)-1)), m = l-c/2;
  var r,g,b;
  if(h<60){r=c;g=x;b=0;} else if(h<120){r=x;g=c;b=0;} else if(h<180){r=0;g=c;b=x;}
  else if(h<240){r=0;g=x;b=c;} else if(h<300){r=x;g=0;b=c;} else {r=c;g=0;b=x;}
  var t = function(v){ return ('0'+Math.round((v+m)*255).toString(16)).slice(-2); };
  return '#'+t(r)+t(g)+t(b);
}
/* shift lightness by dL points, optionally nudging saturation */
function sh(hex, dL, dS){
  var a = hex2hsl(hex);
  return hsl2hex(a[0], Math.max(0, Math.min(100, a[1] + (dS||0))),
                       Math.max(0, Math.min(100, a[2] + dL)));
}

var PLATE = { 5:{r:15,t:4.5}, 10:{r:19,t:5.6}, 20:{r:25,t:6.5} };
var GAPP = 1.2;                /* air between neighbouring plates */
var GRIP = 22;                 /* half the exposed handle — the one live dial */
var COLLAR = 6;                /* bar left proud of the outermost plate */

/* ==========================================================================
   LOCKED. Settled by eye and fixed here so nothing downstream can drift.
   ========================================================================== */
export var LOCK = {
  yaw:   17,      /* degrees on the floor. Mirrored to 180-17 on the right. */
  depth: 0.50,    /* eye height — how much of a unit of depth you see */
  gap:   120,     /* floor between the two, about a foot */
  pair:  true,
  floor: true
};
var BAR_R = 3.4;
export var MAXW = 100;
export var STEP = 5;

/* Greedy, largest first — the way you load a collar, and the reason the
   silhouette stays stable: big discs sit against the handle and never move,
   small ones appear outboard. */
function decompose(w){
  var out = [], rem = w;
  [20,10,5].forEach(function(d){ while(rem >= d){ out.push(d); rem -= d; } });
  return out;
}

/* (gx, gy) is the point on the FLOOR the dumbbell stands on, not its centre.
   Positioning by the centre was what left it hovering: the object has to be
   lifted by exactly the radius of the plates it is resting on, because that
   is what a dumbbell does — it sits on its rims and the handle never touches
   the ground. */
function drawDumbbell(weight, B, sc, gx, gy, opt){
  opt = opt || {};
  var id = opt.id || 'd0';
  var C = opt.C || PALETTE;
  var plates = decompose(Math.min(weight, MAXW));
  var stack = plates.reduce(function(s,d){ return s + PLATE[d].t; }, 0)
            + Math.max(0, plates.length-1) * GAPP;
  var half = GRIP + stack + COLLAR;
  var REST = PLATE[plates[0]].r;          /* the biggest plate carries it */
  var cx = gx, cy = gy - REST * UP * sc;

  /* Every piece gets an axial span. Positive runs away from the viewer. */
  var items = [];
  [1,-1].forEach(function(sgn){
    var at = GRIP;
    plates.forEach(function(dn){
      var p = PLATE[dn];
      items.push({ s1: sgn*at, s2: sgn*(at + p.t), r: p.r, dn: dn });
      at += p.t + GAPP;
    });
  });

  /* CTR, not C — C is the palette. The two collided when colour was added
     and the later declaration won, so every neon test in here silently read
     undefined off a point and the whole toggle did nothing while its filter
     sat defined and unused in the defs. */
  var CTR = { x: cx, y: cy };
  var ax = mul(B.d, sc);
  var pt = function(s){ return add(CTR, mul(ax, s)); };

  /* Painter's algorithm. Depth along the bar is s * sin(yaw), so sorting by
     s descending draws the far end first.

     THE BAR GOES DOWN FIRST, before every plate. It runs through the middle
     of both stacks, so any attempt to slot it into the depth order leaves it
     painted across the plates at one end — which is what it was doing. Drawn
     first, the plates cover the parts of it that are inside them and the
     only bar you see is the grip between the stacks. Which is the truth. */
  /* ZS is which way "away" runs along the bar. Depth is s * sin(yaw), so
     once the yaw goes NEGATIVE the far end becomes the -s end and every
     assumption below inverts: the stack would be painted front-to-back and
     each plate would show the face pointing away from you. */
  var zs = B.sin >= 0 ? 1 : -1;
  var order = items.slice().sort(function(p,q){
    return zs*((q.s1+q.s2)/2) - zs*((p.s1+p.s2)/2);
  });

  var out = '';
  function plateSVG(p){
    var r = p.r * sc;
    var a = mul(B.perp, r), b = mul(B.up, r);
    /* the face you see is the one nearer the viewer, which flips with the
       sign of the yaw — see ZS above. B, not x.B: this one is closed over
       drawDumbbell's own basis. */
    var sN = (zs*p.s1 < zs*p.s2) ? p.s1 : p.s2;
    var sF = (zs*p.s1 < zs*p.s2) ? p.s2 : p.s1;
    var Cn = pt(sN), Cf = pt(sF);
    var phi = silhouette(a, b, ax);
    var P = function(Cc, t){ return { x: Cc.x + a.x*Math.cos(t) + b.x*Math.sin(t),
                                      y: Cc.y + a.y*Math.cos(t) + b.y*Math.sin(t) }; };
    var n1 = P(Cn, phi), n2 = P(Cn, phi+Math.PI);
    var f1 = P(Cf, phi), f2p = P(Cf, phi+Math.PI);
    /* far disc, then the rim between the two silhouette points, then the
       face. The rim's end edges are chords, and both are covered by a disc. */
    /* far disc, the rim between the two silhouette points, then the face.
       The face carries a dark outline so each disc cuts cleanly out of the
       one behind it, and a bright inner ring for the machined lip. */
    var lip = mul(a, 0.80), lipB = mul(b, 0.80);
    var dn = p.dn;
    var edge = C.neonOn ? C.neon : '#05070A';
    var edgeO = C.neonOn ? '.55' : '.85';
    return '<path d="' + ellipsePath(Cf, a, b) + '" fill="url(#far' + dn + id + ')"/>' +
           '<path d="M' + f2(n1.x) + ' ' + f2(n1.y) + 'L' + f2(f1.x) + ' ' + f2(f1.y) +
             'L' + f2(f2p.x) + ' ' + f2(f2p.y) + 'L' + f2(n2.x) + ' ' + f2(n2.y) +
             'Z" fill="url(#rim' + dn + id + ')"/>' +
           '<path d="' + ellipsePath(Cn, a, b) + '" fill="url(#face' + dn + id + ')" ' +
             'stroke="' + edge + '" stroke-opacity="' + edgeO +
             '" stroke-width="' + f2(0.7*sc) + '"/>' +
           '<path d="' + ellipsePath(Cn, lip, lipB) + '" fill="none" ' +
             'stroke="' + (C.neonOn ? C.neon : '#FFFFFF') + '" stroke-opacity="' +
             (C.neonOn ? '.34' : '.14') + '" stroke-width="' + f2(0.6*sc) + '"/>';
  }

  out += barSVG();
  for(var i = 0; i < order.length; i++) out += plateSVG(order[i]);
  if(C.neonOn) out = '<g filter="url(#neon' + id + ')">' + out + '</g>';

  function barSVG(){
    var A = pt(-half), Bp = pt(half);
    return '<path d="M' + f2(A.x) + ' ' + f2(A.y) + 'L' + f2(Bp.x) + ' ' + f2(Bp.y) +
      '" stroke="url(#bar' + id + ')" stroke-width="' + f2(BAR_R*2*sc) +
      '" stroke-linecap="round" fill="none"/>';
  }

  /* The shadow is what actually lands it on the floor — without one it hovers
     no matter how correct the projection is. It is a real footprint: an
     ellipse lying IN the ground plane, elongated along the bar and squashed
     by the same depth factor as everything else, so it turns with the yaw
     instead of staying a horizontal smudge. */
  /* Two shadows, because one cannot do both jobs. The wide soft one is
     ambient occlusion — it says something is above the floor here. The tight
     dark one is the contact patch, and it is the one that actually plants
     the object: without it the dumbbell reads as hovering over its own
     shadow rather than resting on it. */
  var G = { x: gx, y: gy };
  var shadow =
    '<path d="' + ellipsePath(G, mul(B.d, half*0.98*sc), mul(B.perp, REST*0.78*sc)) +
      '" fill="#000" opacity=".46" filter="url(#blur' + id + ')"/>' +
    '<path d="' + ellipsePath(G, mul(B.d, half*0.88*sc), mul(B.perp, REST*0.30*sc)) +
      '" fill="#000" opacity=".62" filter="url(#blurT' + id + ')"/>';

  return { markup: shadow + out, half: half*sc, plates: plates, rest: REST*sc };
}

/* ---- the floor --------------------------------------------------------- */
/* Lifted from the dashboard's sunset ground: rays to a vanishing point at
   top centre, and horizontals at y = H*t*t — the quadratic IS the
   foreshortening, and it is what makes the grid read as receding. */
function floorSVG(W, H, horizon){
  var vpX = W/2, depth = H - horizon, out = '';
  for(var j = 0; j <= 16; j++){
    var xEnd = vpX + (j - 8) * (W * 0.30);
    out += '<line x1="' + vpX + '" y1="' + horizon + '" x2="' + f2(xEnd) +
           '" y2="' + H + '"/>';
  }
  [0.20,0.36,0.52,0.68,0.84,1].forEach(function(t){
    var y = horizon + depth * t * t;
    out += '<line x1="0" y1="' + f2(y) + '" x2="' + W + '" y2="' + f2(y) + '"/>';
  });
  return '<g class="gnd" stroke="#E8EDF2" stroke-width="1" opacity=".13" ' +
         'vector-effect="non-scaling-stroke">' + out + '</g>' +
    '<linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#0C0F12"/>' +
      '<stop offset="42%" stop-color="#0C0F12" stop-opacity="0"/></linearGradient>' +
    '<rect x="0" y="' + horizon + '" width="' + W + '" height="' + depth +
      '" fill="url(#fade)"/>';
}

/* The rim is deliberately MUCH darker than the face. That contrast is the
   only thing separating one plate from the next in a stack of five — with a
   gentle ramp the discs melt into one rubbery lump, which is exactly what
   the first attempt looked like. A plate is machined steel; the groove
   between two of them is nearly black.

   Every shade below is derived from the one swatch for that denomination, so
   the relationship between face, rim and far side survives any recolouring.
   Only the four base colours are yours to choose. */
function grad(id, x1,y1,x2,y2, stops){
  return '<linearGradient id="' + id + '" x1="' + x1 + '" y1="' + y1 +
    '" x2="' + x2 + '" y2="' + y2 + '">' +
    stops.map(function(s){ return '<stop offset="' + s[0] + '%" stop-color="' + s[1] + '"/>'; }).join('') +
    '</linearGradient>';
}
function defs(id, C, neon, list, colOf){
  var out = '';
  list = list || [20,10,5];
  colOf = colOf || function(dn){ return C['p' + dn]; };
  list.forEach(function(dn){
    var b = colOf(dn);
    /* The lit face. The top stop runs well above the base so a dark plate
       still catches an edge — without it the 20s read as holes. */
    out += grad('face' + dn + id, 0.15,0, 0.8,1, [
      [0, sh(b, +30)], [22, sh(b, +16)], [64, sh(b, -2)], [100, sh(b, -13)] ]);
    /* the rim, turned away from the light */
    out += grad('rim' + dn + id, 0,0, 0,1, [
      [0, sh(b, -6)], [46, sh(b, -15)], [100, sh(b, -24)] ]);
    /* the far side, seen only around the silhouette */
    out += grad('far' + dn + id, 0,0, 0,1, [
      [0, sh(b, -19)], [100, sh(b, -27)] ]);
  });
  /* the handle. Grey with a shine — the bright stop is narrow and high, which
     is what reads as a turned metal bar rather than a painted tube. */
  var hd = C.handle;
  out += grad('bar' + id, 0,0, 0,1, [
    [0, sh(hd, +20)], [16, sh(hd, +30)], [34, hd], [72, sh(hd, -18)], [100, sh(hd, -32)] ]);
  out += '<filter id="blur' + id + '" x="-45%" y="-160%" width="190%" height="420%">' +
      '<feGaussianBlur stdDeviation="4"/></filter>' +
    '<filter id="blurT' + id + '" x="-45%" y="-160%" width="190%" height="420%">' +
      '<feGaussianBlur stdDeviation="1.6"/></filter>';
  if(neon){
    /* Neon is a rim light, not a tint: the plates keep their own colour and
       pick up an edge from the room. Tinting the faces instead just turns
       the whole stack one colour and loses the denominations. */
    /* Intensity scales the SPREAD as well as the opacity. Fading the colour
       alone just leaves the same wide halo going grey; pulling the radii in
       with it is what makes a low setting read as a tight edge light rather
       than a weak flood. */
    var g = C.glow == null ? 0.30 : C.glow;
    var sd = function(base){ return (base * (0.45 + 0.55*g)).toFixed(2); };
    out += '<filter id="neon' + id + '" x="-55%" y="-55%" width="210%" height="210%">' +
      '<feDropShadow dx="0" dy="0" stdDeviation="' + sd(1.8) + '" flood-color="' + C.neon +
        '" flood-opacity="' + (0.95*g).toFixed(3) + '"/>' +
      '<feDropShadow dx="0" dy="0" stdDeviation="' + sd(6) + '" flood-color="' + C.neon +
        '" flood-opacity="' + (0.72*g).toFixed(3) + '"/>' +
      '<feDropShadow dx="0" dy="0" stdDeviation="' + sd(16) + '" flood-color="' + C.neon +
        '" flood-opacity="' + (0.44*g).toFixed(3) + '"/></filter>';
  }
  return out;
}

function plusGlyph(x, y, r){
  return '<g stroke="#FF5FA2" stroke-width="' + f2(r*0.40) +
    '" stroke-linecap="round" fill="none">' +
    '<path d="M' + (x-r) + ' ' + y + 'H' + (x+r) + '"/>' +
    '<path d="M' + x + ' ' + (y-r) + 'V' + (y+r) + '"/></g>';
}

/* ---- the scene --------------------------------------------------------- */
/* ==========================================================================
   THE BARBELL

   Same projection, same shading, same value ladder — but it loads by its own
   rules and its bar is a different object, so none of the dumbbell's numbers
   carry over.

   THE BAR IS NOT A TUBE. An Olympic bar has a 28mm shaft and 50mm sleeves,
   so the ends the plates sit on are 1.79x the thickness of the part you grip.
   Drawing one constant-width bar is the single thing that stops a barbell
   reading as a barbell, so the shaft and the sleeves are drawn separately at
   their real ratio.

   Every figure below is a real bar scaled by 3.4 units = 14mm (the shaft's
   radius), which is where 159 and 101 come from rather than taste.
   ========================================================================== */
export var BAR = {
  shaftR:    3.40,   /* 28mm across the grip */
  sleeveR:   6.07,   /* 50mm across the sleeve — 1.79x */
  shaftHalf: 159,    /* centre to collar: half of 1310mm */
  sleeveLen: 101,    /* 415mm of loadable sleeve */
  self:      45      /* the bar weighs 45 on its own */
};
/* REAL SPEC DIMENSIONS, both diameter and thickness, at 0.243 units per mm:
   450/36, 400/32, 280/32, 230/25, 200/22 — the sizes actually cast on iron
   Olympic plates.

   These replace a set where thickness had been SOLVED so that r squared
   times t tracked weight. That law is tidy and it was wrong: it forced the
   25 out to 378mm when a real one is 280, leaving it all but the same size
   as a 35. Real plates are not solid discs — they carry a raised hub, a
   tapered face and a 50mm bore — so volume does not track weight, and
   chasing that made the one plate everybody recognises unrecognisable.

   Diameter is what a lifter reads across a room. It wins. */
export var BARPLATE = {
  45:{r:55,t:11.0}, 35:{r:46,t:10.0}, 25:{r:36,t:10.0},
  10:{r:30,t: 7.1},  5:{r:21,t: 6.0}
};
export var BARDENOM = [45,35,25,10,5];
export var BARMAX = 405;
export var BARSTEP = 10;

/* The dumbbell's ladder only names three plates, so the barbell's five are
   interpolated across the same two ends of it — heaviest takes the 20's
   colour, lightest takes the 5's. One palette, two pieces of equipment. */
function barPlateColour(dn, C){
  var i = BARDENOM.indexOf(dn), t = i / (BARDENOM.length - 1);
  var a = hex2hsl(C.p20), b = hex2hsl(C.p5);
  return hsl2hex(a[0] + (b[0]-a[0])*t, a[1] + (b[1]-a[1])*t, a[2] + (b[2]-a[2])*t);
}
/* Plates go on in pairs, so a bar only ever moves in steps of twice the
   smallest plate. Per side is what actually gets loaded. */
function barLoad(total){
  var per = Math.max(0, (Math.min(total, BARMAX) - BAR.self) / 2);
  var out = [], rem = per;
  BARDENOM.forEach(function(d){ while(rem >= d - 0.001){ out.push(d); rem -= d; } });
  return { per: per, plates: out };
}

/* The default palette. Dark equals heavy: a 20 is nearly black, and each
   step down the denominations comes up a couple of tones. */
/* These sit a little above true black on purpose. Taken all the way down —
   the 20 at #1C2024 — the plates lost their silhouette against a #0C0F12
   floor and the stack became one dark smear. The LADDER is what carries the
   meaning, not the absolute level, so the whole set is lifted just far
   enough to hold an edge on a dark ground. Drag any of them lower and the
   relationship still holds; it just stops being legible. */
/* LOCKED. The three plate tones are DELIBERATELY IDENTICAL — a
   lighter-per-denomination ladder was tried and rejected, because one tone
   reads as a set of weights rather than three grades of them. Do not "fix" it.

   This object had drifted: it still held the rejected ladder (#4E5862,
   #78848F) while the lab's own DEFAULTS held the locked one-tone, so the lab
   looked right and anything reading PALETTE directly did not. Exactly the
   class of bug this module exists to end. */
export var PALETTE = {
  handle: '#A8B2BC',
  p20:    '#2B3138',
  p10:    '#2B3138',
  p5:     '#2B3138',
  neon:   '#EFF1EF',
  neonOn: true,
  glow:   0.32
};

function drawBarbell(total, B, sc, gx, gy, opt){
  opt = opt || {};
  var id = opt.id || 'bb', C = opt.C || PALETTE;
  var L = barLoad(total);
  var plates = L.plates;
  var ps = opt.plateScale == null ? 1 : opt.plateScale;
  var half = BAR.shaftHalf + BAR.sleeveLen;
  /* it rests on whatever is widest — the plates, or the bare sleeve */
  var REST = plates.length ? BARPLATE[plates[0]].r * ps : BAR.sleeveR;
  var cx = gx, cy = gy - REST * UP * sc;
  var CTR = { x: cx, y: cy };
  var ax  = mul(B.d, sc);
  var pt  = function(s){ return add(CTR, mul(ax, s)); };

  var items = [];
  [1,-1].forEach(function(sgn){
    var at = BAR.shaftHalf;                 /* plates start at the collar */
    plates.forEach(function(dn){
      var p = BARPLATE[dn];
      items.push({ s1: sgn*at, s2: sgn*(at + p.t), r: p.r * ps, dn: dn });
      at += p.t + 0.9;
    });
  });
  /* ZS is which way "away" runs along the bar. Depth is s * sin(yaw), so
     once the yaw goes NEGATIVE the far end becomes the -s end and every
     assumption below inverts: the stack would be painted front-to-back and
     each plate would show the face pointing away from you. */
  var zs = B.sin >= 0 ? 1 : -1;
  var order = items.slice().sort(function(p,q){
    return zs*((q.s1+q.s2)/2) - zs*((p.s1+p.s2)/2);
  });

  function tube(s1, s2, r, stroke){
    var A = pt(s1), Z = pt(s2);
    return '<path d="M' + f2(A.x) + ' ' + f2(A.y) + 'L' + f2(Z.x) + ' ' + f2(Z.y) +
      '" stroke="' + stroke + '" stroke-width="' + f2(r*2*sc) +
      '" stroke-linecap="butt" fill="none"/>';
  }
  /* sleeves first, then the shaft over them — the step between the two is
     the whole point, so it must not be smoothed by a round cap */
  /* THE SHOULDER. The sleeve really is 1.79x the shaft at every load — that
     was measured, not assumed — but on a BARE bar the step was invisible:
     both parts carry the same bright ramp and the glow bleeds straight over
     the junction, so a 45 read as one thin rod end to end. Loaded, the plates
     sit against that junction and their dark mass gives the eye the edge for
     free, which is why it only ever looked wrong empty.

     A real bar has a shoulder there — the collar face the plates rest
     against. Drawing it restores the step on the bare bar and costs nothing
     when loaded, because the plates cover it. */
  function shoulder(sgn){
    var C0 = pt(sgn * BAR.shaftHalf);
    var a = mul(B.perp, BAR.sleeveR * sc), b = mul(B.up, BAR.sleeveR * sc);
    return '<path d="' + ellipsePath(C0, a, b) + '" fill="' + sh(C.handle, -34) +
      '" stroke="' + sh(C.handle, -46) + '" stroke-width="' + f2(0.5*sc) + '"/>';
  }
  var barMk =
    tube(-half, -BAR.shaftHalf, BAR.sleeveR, 'url(#slv' + id + ')') +
    tube( BAR.shaftHalf, half,  BAR.sleeveR, 'url(#slv' + id + ')') +
    shoulder(-1) + shoulder(1) +
    tube(-BAR.shaftHalf, BAR.shaftHalf, BAR.shaftR, 'url(#bar' + id + ')');

  var out = barMk;
  for(var i = 0; i < order.length; i++){
    out += disc(order[i], { pt:pt, B:B, ax:ax, sc:sc, id:id, C:C,
                            num: opt.numbers !== false,
                            numSize: opt.numSize });
  }
  if(C.neonOn) out = '<g filter="url(#neon' + id + ')">' + out + '</g>';

  var shadow =
    '<path d="' + ellipsePath({x:gx,y:gy}, mul(B.d, half*0.99*sc), mul(B.perp, REST*0.72*sc)) +
      '" fill="#000" opacity=".46" filter="url(#blur' + id + ')"/>' +
    '<path d="' + ellipsePath({x:gx,y:gy}, mul(B.d, half*0.92*sc), mul(B.perp, REST*0.26*sc)) +
      '" fill="#000" opacity=".62" filter="url(#blurT' + id + ')"/>';
  return { markup: shadow + out, half: half*sc, load: L, rest: REST*sc };
}

/* One plate, drawn as a disc: far face, rim between the two silhouette
   points, near face. Shared by both pieces of equipment — the dumbbell had
   this inline and the barbell would have been a second copy of it. */
function disc(p, x){
  var r = p.r * x.sc;
  var a = mul(x.B.perp, r), b = mul(x.B.up, r);
  /* the face you see is the one nearer the viewer, which flips with the
     sign of the yaw — see ZS above */
  var zsd = (x.B.sin >= 0) ? 1 : -1;
  var sN = (zsd*p.s1 < zsd*p.s2) ? p.s1 : p.s2;
  var sF = (zsd*p.s1 < zsd*p.s2) ? p.s2 : p.s1;
  var Cn = x.pt(sN), Cf = x.pt(sF);
  var phi = silhouette(a, b, x.ax);
  var P = function(Cc, t){ return { x: Cc.x + a.x*Math.cos(t) + b.x*Math.sin(t),
                                    y: Cc.y + a.y*Math.cos(t) + b.y*Math.sin(t) }; };
  var n1 = P(Cn, phi), n2 = P(Cn, phi+Math.PI);
  var f1 = P(Cf, phi), f2p = P(Cf, phi+Math.PI);
  var lip = mul(a, 0.80), lipB = mul(b, 0.80);
  var dn = p.dn, C = x.C, id = x.id;
  var edge = C.neonOn ? C.neon : '#05070A';
  var out =
    '<path d="' + ellipsePath(Cf, a, b) +
      (x.hole ? ellipsePath(Cf, mul(a, x.hole), mul(b, x.hole)) : '') +
      '" fill-rule="evenodd" fill="url(#far' + dn + id + ')"/>' +
    /* The rim carries a stroke as well as a fill. Edge on — which is where
       this ends up on a belt — the rim IS the plate, and butted plates with
       no seam between them merge into one slab: three 45s looked exactly
       like one thick one. The seam is what you count. */
    '<path d="M' + f2(n1.x) + ' ' + f2(n1.y) + 'L' + f2(f1.x) + ' ' + f2(f1.y) +
      'L' + f2(f2p.x) + ' ' + f2(f2p.y) + 'L' + f2(n2.x) + ' ' + f2(n2.y) +
      'Z" fill="url(#rim' + dn + id + ')" stroke="' + sh(C.p20, +14) +
      '" stroke-opacity=".55" stroke-width="' + f2(0.5*x.sc) + '"/>' +
    /* With a hole, the face is an annulus: outer ring plus inner ring under
       evenodd, so whatever is behind — the chain — shows through it. */
    '<path d="' + ellipsePath(Cn, a, b) +
      (x.hole ? ellipsePath(Cn, mul(a, x.hole), mul(b, x.hole)) : '') +
      '" fill-rule="evenodd" fill="url(#face' + dn + id + ')" ' +
      'stroke="' + edge + '" stroke-opacity="' + (C.neonOn ? '.55' : '.85') +
      '" stroke-width="' + f2(0.7*x.sc) + '"/>' +
    '<path d="' + ellipsePath(Cn, lip, lipB) + '" fill="none" stroke="' +
      (C.neonOn ? C.neon : '#FFFFFF') + '" stroke-opacity="' +
      (C.neonOn ? '.34' : '.14') + '" stroke-width="' + f2(0.6*x.sc) + '"/>';
  /* the bore's wall — without it the hole is a flat cut and the plate has no
     thickness where it matters most */
  if(x.hole){
    out += '<path d="' + ellipsePath(Cn, mul(a, x.hole), mul(b, x.hole)) +
      '" fill="none" stroke="#05070A" stroke-opacity=".8" stroke-width="' +
      f2(1.1*x.sc) + '"/>';
  }
  /* THE NUMBER, lying ON the disc rather than floating over it: the same
     linear map that turns the circle into this ellipse is handed to the
     text, so it foreshortens with the plate.

     BOTH basis vectors are negated, and the determinant is why. `perp` points
     left-and-up and `up` points up, so using them raw gives a frame with a
     NEGATIVE determinant — a reflection — and the digits come out mirrored
     as well as rotated. Flipping both axes turns the frame the right way
     round (det back to positive) and leaves the text reading left to right
     across the face, which is where a real plate prints it. */
  /* The text frame, and it has to work at BOTH signs of yaw. Swinging the
     yaw negative mirrors the disc's horizontal, which flips the frame's
     handedness — the determinant goes negative, the digits come out
     backwards, and the guard below silently suppressed them entirely. So
     the x axis is chosen by its sign rather than fixed: whichever direction
     leaves a positive determinant is the one the text runs along.

     What the guard is actually for is a yaw near zero or 180, where the disc
     is edge on, the frame collapses to no area at all and the digits would
     be smeared into a line. There is nothing to print on an edge. */
  var mx = -a.x/r, my = -a.y/r, nx = -b.x/r, ny2 = -b.y/r;
  var det = mx*ny2 - my*nx;
  if(det < 0){ mx = -mx; my = -my; det = -det; }
  if(x.num && det > 0.08){
    var m = [mx, my, nx, ny2, Cn.x, Cn.y];
    /* Off centre when there is a bore, because that is where a real plate
       prints it — and because dead centre puts the digits straight over the
       hole, which is what made the chain invisible and the plate read solid.
       The local frame is in units of the radius, so 0.42r sits it neatly
       between the bore and the rim. */
    var ny = x.hole ? r*0.42 : 0;
    out += '<text transform="matrix(' + m.map(f2).join(' ') + ')" x="0" y="' + f2(ny) + '" ' +
      'text-anchor="middle" dominant-baseline="central" ' +
      'font-family="ui-monospace,SFMono-Regular,Menlo,monospace" ' +
      'font-weight="700" font-size="' + f2(r*(x.numSize == null ? 0.44 : x.numSize)) + '" ' +
      'fill="#FFFFFF" fill-opacity="' + (dn >= 25 ? '.62' : '.5') + '">' + dn + '</text>';
  }
  return out;
}

function barbellSceneSVG(total, o){
  o = o || {};
  var W = o.W || 640, H = o.H || 260;
  var B = basis(o.yaw == null ? LOCK.yaw : o.yaw,
                o.depth == null ? LOCK.depth : o.depth);
  var C = o.C || PALETTE, sc = o.sc || 1;
  var over = total > BARMAX;
  var D = drawBarbell(Math.min(total, BARMAX), B, sc, W/2, H*0.80,
                      { id:'bb', C:C, numbers:o.numbers,
                        numSize:o.numSize, plateScale:o.plateScale });
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="barbell ' +
      total + ' pounds"><defs>' +
      defs('bb', C, C.neonOn, BARDENOM, function(dn){ return barPlateColour(dn, C); }) +
      '<linearGradient id="slvbb" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="' + sh(C.handle, +16) + '"/>' +
        '<stop offset="34%" stop-color="' + C.handle + '"/>' +
        '<stop offset="100%" stop-color="' + sh(C.handle, -30) + '"/></linearGradient>' +
    '</defs>' +
    (o.floor === false ? '' : floorSVG(W, H, H*0.24)) +
    D.markup + (over ? plusGlyph(W-30, 32, 14) : '') + '</svg>';
}

/* ==========================================================================
   THE BELT WEIGHT

   Same plates as the barbell, hung off a dip belt instead of loaded on a bar.
   Two things make it its own object rather than a re-dressed barbell:

   1. THE CAMERA IS ALMOST HEAD ON. A plate on a belt hangs with its face
      vertical and its hole axis HORIZONTAL, so looking at the lifter you are
      looking down that axis — the faces are what you see, stacked into the
      picture, each one peeking out a little from behind the last. That is a
      yaw near 90, where the barbell sits near 0.

   2. THE PLATES HAVE HOLES. Everywhere else the bore is hidden by the bar
      through it; here the chain runs through it and you see straight into
      the gap, so the face is drawn as an annulus and the chain behind shows.

   The bore is 50mm on a real plate, which is the same 6.07 units as the
   barbell's sleeve — the hole and the sleeve are the same fit.
   ========================================================================== */
export var BELTMAX = 135;
export var BELTSTEP = 5;
var BORE = 6.07;

function beltLoad(total){
  var out = [], rem = Math.min(total, BELTMAX);
  BARDENOM.forEach(function(d){ while(rem >= d - 0.001){ out.push(d); rem -= d; } });
  return out;
}

/* A chain reads as a chain because consecutive links sit at ninety degrees to
   one another. Drawn flat they are just a row of ovals, so every other link
   is squeezed to a sliver — that alternation is the whole effect.

   It runs between two arbitrary points, not just straight down, because the
   loop has three legs: down from the beam, THROUGH the stack along the bore
   axis, and back up to the beam. That middle leg is at whatever angle the
   yaw puts the stack at. */
function chainRun(p0, p1, w, col){
  var dx = p1.x - p0.x, dy = p1.y - p0.y, len = Math.hypot(dx, dy);
  if(len <= 0.5) return '';
  var ang = Math.atan2(dy, dx) * 180 / Math.PI;
  var n = Math.max(2, Math.round(len / (w * 0.92)));
  var step = len / n;
  /* A solid strand under the links. Where the chain crosses a bore it is only
     a few pixels wide, and open link outlines at that size are mush — the
     strand is what actually reads as metal through the hole. */
  var out = '<path d="M' + f2(p0.x) + ' ' + f2(p0.y) + 'L' + f2(p1.x) + ' ' + f2(p1.y) +
    '" stroke="' + sh(col, -14) + '" stroke-width="' + f2(w*0.30) +
    '" stroke-linecap="round" fill="none"/>';
  for(var i = 0; i < n; i++){
    var t = (i + 0.5) * step / len;
    var cx = p0.x + dx*t, cy = p0.y + dy*t;
    var flat = (i % 2) === 0;
    out += '<ellipse cx="0" cy="0" rx="' + f2(step*0.66) +
      '" ry="' + f2(flat ? w*0.46 : w*0.17) + '" fill="none" stroke="' + col +
      '" stroke-width="' + f2(w*0.23) + '" transform="translate(' + f2(cx) + ' ' +
      f2(cy) + ') rotate(' + f2(ang) + ')"/>';
  }
  return out;
}

function beltSceneSVG(total, o){
  o = o || {};
  var W = o.W || 460, H = o.H || 360;
  var C = o.C || PALETTE, sc = o.sc || 1;
  var B = basis(o.yaw == null ? -18 : o.yaw, o.depth == null ? 0.56 : o.depth);
  var ps = o.plateScale == null ? 1 : o.plateScale;
  var fade = o.fade == null ? 0.44 : o.fade;
  var over = total > BELTMAX;
  var plates = beltLoad(Math.min(total, BELTMAX));
  var id = 'bl';

  /* the stack hangs from the chain: biggest plate nearest the viewer, the
     rest stepping back, which is how they sit when you thread them on */
  var cx = W/2, cy = H*0.62;
  var CTR = { x: cx, y: cy };
  var ax  = mul(B.d, sc);
  var pt  = function(s){ return add(CTR, mul(ax, s)); };

  /* SPREAD. Threaded plates hang tight against one another, so this defaults
     to almost nothing — the count is read off the stacked rims, the way you
     read a roll of coins, not off gaps between them. It is left adjustable
     because a hair of air helps at small sizes. */
  var spread = o.spread == null ? 0 : o.spread;
  var items = [], at = 0;
  plates.forEach(function(dn){
    var p = BARPLATE[dn];
    items.push({ s1: at, s2: at + p.t, r: p.r * ps, dn: dn });
    at += p.t + spread;
  });
  /* ZS is which way "away" runs along the bar. Depth is s * sin(yaw), so
     once the yaw goes NEGATIVE the far end becomes the -s end and every
     assumption below inverts: the stack would be painted front-to-back and
     each plate would show the face pointing away from you. */
  var zs = B.sin >= 0 ? 1 : -1;
  var order = items.slice().sort(function(p,q){
    return zs*((q.s1+q.s2)/2) - zs*((p.s1+p.s2)/2);
  });

  var big = plates.length ? BARPLATE[plates[0]].r * ps : 30;
  var holeRatio = plates.length ? BORE / (BARPLATE[plates[0]].r * ps) : 0.2;
  /* THE CHAIN GOES THROUGH, not down to. Stopping it at the top of the bore
     left the hole reading as a dark speck and the plate as solid — the whole
     point is that you can see the chain inside the hole. It runs on past the
     stack and ends in a link below it, and because the plates are drawn over
     it afterwards the only place it survives is the bore. */
  var chainW = BORE * 1.3 * sc;
  var chainCol = sh(C.handle, -6);

  var belt = '';   /* the beam is gone — the chain fades out instead */

  /* THE LOOP. One chain, three legs: down from the beam, along the bore axis
     THROUGH every plate on the stack, and back up to the beam. The middle leg
     is what "threaded on" actually means — it runs on the same axis the
     plates are stacked on, because that is the axis their bores are lined up
     along, and it comes out the far side.

     It sits at the TOP of the bore, not on the axis, because that is where a
     hanging plate rests against it. */
  var lift = { x: 0, y: -(BORE*0.42) * UP * sc };
  var sMin = 0, sMax = at - spread;
  if(!plates.length){ sMin = -4; sMax = 4; }
  var overhang = BORE * 1.9;
  /* WHICH END IS NEAR DEPENDS ON THE SIGN OF THE YAW. Depth is s * sin(yaw),
     so at a positive yaw the -s end is the one closest to you and at a
     negative yaw it is the +s end. Naming them by their s value instead of
     their depth put the front leg of the chain behind the plates the moment
     the yaw crossed zero — the loop still drew, it was just threaded the
     wrong way round. */
  var sNearEnd = (zs > 0) ? (sMin - overhang) : (sMax + overhang);
  var sFarEnd  = (zs > 0) ? (sMax + overhang) : (sMin - overhang);
  var pNear = add(pt(sNearEnd), lift);
  var pFar  = add(pt(sFarEnd),  lift);

  /* UNDER LOAD THE LEGS CONVERGE. Two parallel verticals is a chain hanging
     slack from a rail; a chain with weight on it is pulled taut toward one
     point above, so the legs lean in and the loop becomes a narrow triangle
     with the through-run as its base. That lean is the tension.

     The apex sits above the frame and directly over the MIDDLE of the
     through-run — a load hangs under its own attachment, so anywhere else
     would look like it is being dragged sideways. It is off-screen and the
     chain fades before reaching it, so what you see is a chain continuing up
     out of view rather than a tidy little V. */
  var apex = { x: (pNear.x + pFar.x)/2, y: -H*0.30 };

  /* TRIM cuts links off the top of both legs — actually shortening the
     chain, where FADE only makes it transparent. Two different jobs: fade
     softens where it leaves the frame, trim decides how much chain there is
     to leave with. A short trimmed chain reads as the plates hanging close
     under the belt; a long one as them swinging well below it. */
  var trim = o.trim == null ? 0 : Math.min(0.92, o.trim);
  var lerp = function(A, Z, t){ return { x: A.x + (Z.x-A.x)*t, y: A.y + (Z.y-A.y)*t }; };
  var topFar  = lerp(apex, pFar,  trim);
  var topNear = lerp(apex, pNear, trim);

  /* the far leg goes up BEHIND the stack, the near leg in front of it —
     which is the whole reason a loop reads as a loop rather than two lines */
  var legFar  = chainRun(topFar, pFar,  chainW, chainCol);
  var through = chainRun(pNear, pFar, chainW, chainCol);
  var legNear = chainRun(topNear, pNear, chainW, chainCol);

  var body = '';
  for(var i = 0; i < order.length; i++){
    body += disc(order[i], { pt:pt, B:B, ax:ax, sc:sc, id:id, C:C,
                             num: o.numbers !== false,
                             numSize: o.numSize, hole: holeRatio });
  }
  /* Only the chain is masked. Running the plates through the same fade would
     dim the top of the stack, and the plates are not what is disappearing. */
  var all = '<g mask="url(#fade' + id + ')">' + legFar + '</g>' +
            '<g mask="url(#fade' + id + ')">' + through + '</g>' +
            body +
            '<g mask="url(#fade' + id + ')">' + legNear + '</g>';
  if(C.neonOn) all = '<g filter="url(#neon' + id + ')">' + all + '</g>';

  /* it is hanging, so the shadow is on the floor well below it and soft —
     a contact patch here would be a lie */
  var shadow = '<ellipse cx="' + f2(cx) + '" cy="' + f2(H*0.93) +
    '" rx="' + f2(big*1.15*sc) + '" ry="' + f2(big*0.26*sc) +
    '" fill="#000" opacity=".40" filter="url(#blur' + id + ')"/>';

  return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="belt ' +
      total + ' pounds"><defs>' +
      defs(id, C, C.neonOn, BARDENOM, function(dn){ return barPlateColour(dn, C); }) +
      /* The chain leaves the top of the frame rather than ending on anything.
         `fade` is how far down the frame it takes to arrive: at 0 it is fully
         drawn to the top edge, and pushed high enough it eats most of the
         links and leaves only the few holding the plates. */
      '<linearGradient id="fadeG' + id + '" gradientUnits="userSpaceOnUse" ' +
        'x1="0" y1="0" x2="0" y2="' + f2(Math.max(1, H*fade)) + '">' +
        '<stop offset="0%" stop-color="#000"/>' +
        '<stop offset="42%" stop-color="#555"/>' +
        '<stop offset="100%" stop-color="#fff"/></linearGradient>' +
      '<mask id="fade' + id + '" maskUnits="userSpaceOnUse" x="0" y="' +
        f2(-H) + '" width="' + W + '" height="' + f2(H*2) + '">' +
        '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#fff"/>' +
        '<rect x="0" y="' + f2(-H) + '" width="' + W + '" height="' +
          f2(H + Math.max(1, H*fade)) + '" fill="url(#fadeG' + id + ')"/></mask>' +
    '</defs>' +
    (o.floor === false ? '' : floorSVG(W, H, H*0.62)) +
    shadow + belt + all +
    (over ? plusGlyph(W-30, 30, 14) : '') + '</svg>';
}

function sceneSVG(weight, o){
  o = o || {};
  var W = o.W || 420, H = o.H || 250;
  var yaw = o.yaw == null ? LOCK.yaw : o.yaw;
  var dep = o.depth == null ? LOCK.depth : o.depth;
  var B = basis(yaw, dep);
  var over = weight > MAXW, wt = Math.min(weight, MAXW);
  var one = o.count === 'one';
  var horizon = H * 0.24;

  var C = o.C || PALETTE;
  var sc = o.sc || 1;
  var body = '', dd = '';
  if(one){
    var A = drawDumbbell(wt, B, sc, W/2, H*0.80, {id:'a', C:C});
    body = A.markup; dd = defs('a', C, C.neonOn);
  } else {
    /* MIRRORED, AND ON ONE LEVEL.

       Both dumbbells stand at the same depth — same y on the floor, same
       size — with a mirror line down the middle. Reflecting about a vertical
       axis sends the bar's direction (dx, dy) to (-dx, dy), and for
       d = (cos t, -depth sin t) that is yaw 180 - t, NOT -t. Minus t would
       mirror it top-to-bottom instead, swinging the far end toward the
       viewer and breaking the symmetry.

       Taking the mirror through the yaw rather than an SVG scale(-1,1) also
       leaves every gradient in screen space, so both dumbbells stay lit from
       the same side — a flipped transform would light the second one from
       the opposite direction, which is the tell that it is a copy. */
    var probe = drawDumbbell(wt, B, sc, 0, 0, {id:'p', C:C});
    var reach = probe.half * Math.abs(B.d.x);           /* screen half-length */
    var gapU  = (o.gap == null ? LOCK.gap : o.gap) * sc; /* floor between them */
    var sep   = reach + gapU/2;
    var Bm = basis(180 - yaw, dep);
    var gy = H * 0.80;
    var L = drawDumbbell(wt, B,  sc, W/2 - sep, gy, {id:'a', C:C});
    var R = drawDumbbell(wt, Bm, sc, W/2 + sep, gy, {id:'b', C:C});
    body = L.markup + R.markup;
    dd = defs('a', C, C.neonOn) + defs('b', C, C.neonOn);
  }
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' +
      weight + ' pound dumbbell"><defs>' + dd + '</defs>' +
    (o.floor === false ? '' : floorSVG(W, H, horizon)) +
    body + (over ? plusGlyph(W-30, 32, 14) : '') + '</svg>';
}

/* ============================================================
   THE KETTLEBELL — A PHOTOGRAPH, NOT A DRAWING

   Every other object on this floor is drawn from geometry. This one is a
   rendered image, and that is a deliberate exception rather than a shortcut.
   Four kettlebells were built from primitives and all four were rejected: the
   shape is a sphere fused to a bent handle through a compound fillet, and at
   card size the eye reads the join instantly. The honest fix was to stop
   drawing it.

   WHAT THE ASSET IS
   images/equipment/kettlebell.png — 358x512, GREY + ALPHA, 95 KB. It came in
   as a 1254px render on a green screen; the green was keyed out with a
   tolerance (it was noisy, #06EE05 give or take 8 levels) and despilled so
   the black edges carry no green fringe.

   IT IS GREYSCALE ON PURPOSE. Measured chroma across the whole object was 9
   levels out of 255 — visually neutral already — and storing it as grey+alpha
   rather than RGBA took it from 244 KB to 95 KB, which is what puts it under
   build-sw.mjs's 150 KB precache cap and therefore into the offline shell.
   Being grey is also what makes the tint below work predictably.

   HOW THE TINT WORKS, AND WHY THE OBVIOUS WAY FAILS
   The source is crushed: the whole object lives between luminance 11 and 97.
   The first attempt at recolouring used the alpha as a mask and filled it with
   a flat colour, which produced a silhouette — every facet gone. Painting the
   shading back over it did nothing, because a near-black image has almost no
   tonal range for a blend to grab.

   So: STRETCH FIRST, THEN MAP. A linear transfer pulls 11..97 out to the full
   range, and only then a 2-stop table maps black->`dark` and white->`light`.
   The facets survive because they are still a gradient when the colour is
   applied. Change the order and you are back to a silhouette. */
var KB_ASPECT = 761 / 1088;      /* measured from the asset's alpha bbox */

function kbDefs(id, o){
  var sl = o.stretch, it = -o.black;
  var hx = function(h){ return [parseInt(h.slice(1,3),16)/255,
                                parseInt(h.slice(3,5),16)/255,
                                parseInt(h.slice(5,7),16)/255]; };
  var d = hx(o.dark), l = hx(o.light);
  var lin = '<feFuncR type="linear" slope="'+sl+'" intercept="'+f2(it)+'"/>' +
            '<feFuncG type="linear" slope="'+sl+'" intercept="'+f2(it)+'"/>' +
            '<feFuncB type="linear" slope="'+sl+'" intercept="'+f2(it)+'"/>';
  var tab = '<feFuncR type="table" tableValues="'+f2(d[0])+' '+f2(l[0])+'"/>' +
            '<feFuncG type="table" tableValues="'+f2(d[1])+' '+f2(l[1])+'"/>' +
            '<feFuncB type="table" tableValues="'+f2(d[2])+' '+f2(l[2])+'"/>';
  /* sRGB, not the linearRGB default — the stops above were picked by eye in
     sRGB and linear interpolation washes them out by roughly a stop. */
  return (o.tint === false ? '' :
      '<filter id="kbt'+id+'" color-interpolation-filters="sRGB">' +
        '<feComponentTransfer>' + lin + '</feComponentTransfer>' +
        '<feComponentTransfer>' + tab + '</feComponentTransfer>' +
      '</filter>') +
    '<filter id="kbb'+id+'" x="-60%" y="-160%" width="220%" height="420%">' +
      '<feGaussianBlur stdDeviation="7"/></filter>' +
    '<filter id="kbbT'+id+'" x="-40%" y="-120%" width="180%" height="340%">' +
      '<feGaussianBlur stdDeviation="2.4"/></filter>';
}

/* MASS -> LENGTH. Same cube-root law as the plates: 20x the weight is 2.71x
   the bell, not 20x. Checked against a real rack — a 5 lb bell is about 14 cm
   tall and a 100 lb about 34.5 cm, a ratio of 2.46, so cube root overshoots
   by roughly a tenth. `growth` is exposed so that can be damped without
   touching this function. */
function kbScale(wt, o){
  return Math.pow(Math.max(wt, 1) / KBMAX, o.growth == null ? 1/3 : o.growth);
}

function kettlebellSceneSVG(weight, o){
  o = o || {};
  for(var k in KETTLEBELL) if(o[k] === undefined) o[k] = KETTLEBELL[k];
  var W = o.W || 420, H = o.H || 250, sc = o.sc || 1;
  var over = weight > KBMAX, wt = Math.min(weight, KBMAX);
  var horizon = H * 0.24, baseY = H * 0.80;

  var ih = o.size * sc * kbScale(wt, o);       /* drawn height */
  var iw = ih * KB_ASPECT;
  var x0 = W/2 - iw/2, y0 = baseY - ih;

  /* Two shadows, same reasoning as the dumbbell: the wide soft one is ambient
     occlusion, the tight one is the contact patch that actually plants it. A
     kettlebell touches the floor on a small pad at the bottom of the sphere,
     so the tight one is much smaller here than under a dumbbell's two ends. */
  var dep = o.depth == null ? 0.36 : o.depth;
  var cxS = W/2, ballW = iw * 0.97;
  var shadow =
    '<ellipse cx="'+f2(cxS)+'" cy="'+f2(baseY)+'" rx="'+f2(ballW*0.50)+
      '" ry="'+f2(ballW*0.50*dep)+'" fill="#000" opacity=".42" filter="url(#kbb'+o.id+')"/>' +
    '<ellipse cx="'+f2(cxS)+'" cy="'+f2(baseY)+'" rx="'+f2(ballW*0.26)+
      '" ry="'+f2(ballW*0.26*dep)+'" fill="#000" opacity=".60" filter="url(#kbbT'+o.id+')"/>';

  var img = '<image href="'+o.src+'" x="'+f2(x0)+'" y="'+f2(y0)+'" width="'+f2(iw)+
            '" height="'+f2(ih)+'" preserveAspectRatio="none"' +
            (o.tint === false ? '' : ' filter="url(#kbt'+o.id+')"') + '/>';

  /* THE NUMBER IS LIVE TEXT ON A BLANK MEDALLION.
     The artwork ships with an empty octagon precisely so the gauge can put the
     real weight there — an earlier asset had "20" baked in, which is right for
     exactly one of the twenty steps in this range.

     The medallion sits low and right on the sphere and is turning away from
     the camera, so it is not a circle on screen. Centre and squash are
     MEASURED off the asset (rim ridge detection: centre 850,845 in the 1254px
     source, extent 226x312, ratio 0.724). The tilt is not measured because an
     octagon curving over a sphere has no unambiguous major axis — depending on
     which extremes you trust it reads anywhere from -9 to -24 degrees — so it
     is a knob with a middling default rather than a false precision. */
  var num = '';
  if(o.numbers !== false){
    var nx = x0 + iw * o.numX, ny = y0 + ih * o.numY;
    num = '<g transform="translate('+f2(nx)+' '+f2(ny)+') rotate('+f2(o.tilt)+
            ') scale('+f2(o.squash)+' 1)">' +
          '<text x="0" y="0" text-anchor="middle" dominant-baseline="central" ' +
            'font-family="ui-sans-serif,system-ui,sans-serif" font-weight="700" ' +
            'font-size="'+f2(ih*o.numSize)+'" fill="'+o.numFill+
            '" opacity="'+o.numOpacity+'">'+wt+'</text></g>';
  }

  return '<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+
      weight+' pound kettlebell"><defs>' + kbDefs(o.id, o) + '</defs>' +
    (o.floor === false ? '' : floorSVG(W, H, horizon)) +
    shadow + img + num + (over ? plusGlyph(W-30, 32, 14) : '') + '</svg>';
}

/* ============================================================
   THE LOCKED SETTINGS

   Signed off in the lab. A card that needs a different size passes W/H/sc;
   it never passes a different yaw or a different palette, because that is
   what would let two screens disagree.
   ============================================================ */
export var DUMBBELL = { yaw: 9,   depth: 0.36, gap: 50, grip: 23, count: 'pair' };
export var BARBELL  = { yaw: 1,   depth: 0.19, shaftHalf: 120, sleeveLen: 72,
                        shaftR: 3.40, sleeveR: 6.07, plateScale: 1.00,
                        numSize: 0.44, numbers: true };
export var BELT     = { yaw: -18, depth: 0.56, spread: 0, plateScale: 0.92,
                        numSize: 0.44, fade: 0.78, trim: 0.61, numbers: true };

/* The kettlebell has no yaw because it is a fixed render, not geometry — it
   cannot be turned. That is the trade for having a kettlebell that survives
   being looked at. Everything else about it IS adjustable.

   `src` is relative, and it is relative TO THE PAGE, not to this module. The
   app's pages sit at the site root so the default is right for them; the lab
   lives in logo/ and passes '../images/equipment/kettlebell.png'. It is not
   a root-relative '/images/...' because the site is served from a subpath and
   that would 404 there. */
export var KETTLEBELL = {
  src: 'images/equipment/kettlebell.png',
  id: 'k',
  size: 165,          /* drawn height in user units at KBMAX */
  growth: 1/3,        /* mass -> length exponent; see kbScale */
  depth: 0.36,        /* shadow foreshortening, matches the dumbbell's floor */
  tint: true,
  dark: '#20242a',    /* what black in the source becomes */
  light: '#95A1AE',   /* what white becomes — the two ends of the facet ramp */
  stretch: 2.96,      /* 255/(97-11): opens the crushed source back up */
  black: 0.128,       /* 11/255 * stretch: where the ramp starts */
  numbers: true,
  numX: 0.7963,       /* medallion centre, fraction of the image box — measured */
  numY: 0.7031,
  numSize: 0.115,     /* digit height as a fraction of bell height */
  squash: 0.724,      /* measured: the medallion is turning away from us */
  tilt: -12,          /* NOT measured — see the note in kettlebellSceneSVG */
  numFill: '#DDE3EA',
  numOpacity: 0.92,
};

export var KBMAX  = 100;
export var KBSTEP = 5;

/* The ranges the steppers move through. Physical, not arbitrary: a barbell
   total moves in TENS because plates go on in pairs, which is why 135 is one
   45 a side and 225 is two — the gym numbers fall out of the arithmetic. */
export var RANGE = {
  dumbbell:   { min: 5,  max: 100, step: 5  },   /* per hand */
  barbell:    { min: 45, max: 405, step: 10 },   /* total, bar is 45 alone */
  belt:       { min: 5,  max: 135, step: 5  },
  kettlebell: { min: 5,  max: 100, step: 5  },
};

/* ============================================================
   WHICH GAUGE FOR WHICH EXERCISE

   Driven off the database's own fields, never off an exercise name. Lives
   here rather than in a card because a rule written inline in a card is a
   rule that gets copied, and then the copies disagree.

   FIRST MATCH WINS.
   ============================================================ */
export function gaugeFor(row){
  if(!row) return { kind:'none', why:'no row' };
  var loadable = String(row.loadable || '').toUpperCase() === 'TRUE';
  if(!loadable) return { kind:'none', why:'not loadable' };

  var eq = String(row.equipment || '').split(',').map(function(s){ return s.trim(); })
             .filter(Boolean);
  var has = function(t){ return eq.indexOf(t) > -1; };
  var loading = String(row.loading || '');

  if(has('bb'))  return { kind:'barbell' };

  /* DUMBBELLS BEAT A VEST WHEN A ROW LISTS BOTH.
     The brief put vest/added-load ahead of db, and that put a dip belt on the
     Bulgarian split squat — which is done holding dumbbells. The belt exists
     for movements where the HANDS ARE OCCUPIED: pull-ups, dips, ring work.
     If a movement can be loaded by holding something, it is held.
     One row in the database has both (Bulgarian Split Squat) and it is the
     one that was wrong. */
  if(has('db'))  return { kind:'dumbbell', count: heldCount(row) };

  if(has('vest') || loading === 'added-load')  return { kind:'belt' };

  /* The kettlebell is an image rather than geometry — see the banner above
     kettlebellSceneSVG. It is never a dumbbell wearing a different name:
     four drawn ones were rejected and substituting the wrong object was
     always the worse answer. */
  if(has('kb'))  return { kind:'kettlebell' };

  return { kind:'none', why:'loadable but no gauge (' + (eq.join('/') || 'no equipment') + ')' };
}

/* ============================================================
   HOW MANY IMPLEMENTS ARE HELD

   THE DATABASE CANNOT ANSWER THIS AND IT IS WORTH SAYING WHY.
   `laterality` describes which LIMB works, not how many things are held, and
   it is wrong in both directions:

     Bulgarian split squat   unilateral (one LEG)   — held with TWO dumbbells
     Goblet squat            bilateral              — held with ONE

   Driving count off laterality put a single dumbbell on the split squat when
   the card's own artwork shows two, which is the mistake that has to not
   happen again.

   So: a principled default, then an explicit table for what the default
   cannot reach. The default reads `patterns` — if the working pattern is an
   ARM pattern then "unilateral" means one arm and therefore one implement;
   if it is a LEG pattern the hands are free and take one each.

   HELD is the exceptions, and every one of them is a fact about the movement
   rather than a preference. tools/build-equipment.mjs prints the resolved
   count for every loadable movement so this table can be checked at a glance
   instead of discovered on a card.

   The real fix is a field in the database — `implements: 1 | 2`. Until that
   exists this is the honest version. */
export var ARM_PATTERNS = ['h-pull','h-push','v-pull','v-push','straight-arm-push','carry'];

export var HELD = {
  /* one bell, both hands on it */
  goblet_squat: 'one',
  /* one dumbbell, opposite hand to the standing leg — which is what our own
     artwork shows */
  single_leg_rdl: 'one',
  /* one leg working, a dumbbell in each hand — the card shows two */
  bulgarian_split: 'pair',
};

export function heldCount(row){
  if(HELD[row.id]) return HELD[row.id];
  if(String(row.laterality||'') !== 'unilateral') return 'pair';
  var pats = String(row.patterns||'').split(',').map(function(x){ return x.trim(); });
  var arm = pats.some(function(p){ return ARM_PATTERNS.indexOf(p) > -1; });
  return arm ? 'one' : 'pair';
}

/* The options a call site passes into the scene function for a given gauge.
   `size` is the only thing a card gets to choose. */
export function gaugeOpts(g, size){
  size = size || {};
  var base = { W:size.W||300, H:size.H||150, sc:size.sc||1,
               floor: size.floor !== false, C: PALETTE };
  var s = g.kind === 'barbell'    ? BARBELL
        : g.kind === 'belt'       ? BELT
        : g.kind === 'kettlebell' ? KETTLEBELL
        : DUMBBELL;
  for(var k in s) base[k] = s[k];
  if(g.kind === 'dumbbell' && g.count) base.count = g.count;
  /* A card may sit at a different directory depth than the app pages, so it
     is allowed to override the one setting that is a PATH rather than a look.
     Nothing else about the kettlebell is a call site's business. */
  if(g.kind === 'kettlebell' && size.src) base.src = size.src;
  return base;
}

/* One entry point, so a card never chooses a scene function by hand. */
export function gaugeSVG(g, weight, size){
  var o = gaugeOpts(g, size);
  if(g.kind === 'barbell')    return barbellSceneSVG(weight, o);
  if(g.kind === 'belt')       return beltSceneSVG(weight, o);
  if(g.kind === 'kettlebell') return kettlebellSceneSVG(weight, o);
  if(g.kind === 'dumbbell')   return sceneSVG(weight, o);
  return '';
}

/* The lab tunes GRIP live. It is a plain var inside this module, so it needs
   a door rather than a global. */
export function setGrip(v){ GRIP = v; }

/* ONE PLATE TABLE, TWO PIECES OF EQUIPMENT. The barbell and the belt load
   from the same iron — they are the same plates in the same gym — so this is
   deliberately a single mutable table rather than a copy each. Change a 25
   here and it changes on the bar AND on the chain, which is the whole point.
   A door rather than a global, because the module is an IIFE once built. */
export function setPlate(dn, r, t){
  if(!BARPLATE[dn]) return false;
  if(r != null) BARPLATE[dn].r = r;
  if(t != null) BARPLATE[dn].t = t;
  return true;
}
export function getPlate(dn){
  return BARPLATE[dn] ? { r: BARPLATE[dn].r, t: BARPLATE[dn].t } : null;
}

export { sceneSVG, barbellSceneSVG, beltSceneSVG, kettlebellSceneSVG,
         decompose, barLoad, beltLoad };
