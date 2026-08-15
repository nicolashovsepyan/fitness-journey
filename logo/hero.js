function hero(s){
  /* Two marks share one engine.

     A — three plates a side, drawn as passes of a widening round-capped line.
         Every pass is a little wider than the last, so the line genuinely
         thickens and the final pass IS the finished shape.

     B — two plates, the inner one 2.25x thicker. A thick round-capped line is
         a pill, not a plate, so B's plates are real rounded rectangles with ONE
         corner radius shared by both, and they wipe into place from opposite
         sides instead of being brushed on. Same idea, different instrument.

     Add ?mark=b to the URL to see B. */
  /* A second off the whole build. GAP and DUR both come down, which keeps the
     overlap between passes roughly where it was — shortening only GAP would
     have left each stroke lingering after the next had started. */
  const N=3, GAP=0.31, DUR=0.46, T0=0.18, WIPE=0.60;
  const BAR = {d:'M86 65 H174', w:7};
  const mirror=x=>260-x;

  /* The light runs the outline itself. There was a version where it ran a
     separate path carrying a PQRST complex in the top edge, so it deflected
     into a heartbeat once a lap — removed. The mark is a neon sign, not a
     monitor. */
  const TRI_D = 'M100 16 H286 L150 252 L14 16 H60';

  const MARKS = {
    a:{ engine:'stroke', passes:[3,2,1],
        plates:[{x:86,   y1:38,    y2:92,    w:12.65},
                {x:66.8, y1:40.70, y2:89.30, w:9.90},
                {x:52.4, y1:47.50, y2:82.50, w:7.13}] },
    b:{ engine:'plate', barW:8, r:2.8,
        plates:[{x:86, w:24.75, y0:32.5, y1:97.5},
                {x:63, w:9.90,  y0:39,   y1:91}] }
  };
  const MARK = (/[?&]mark=b\b/i.test(location.search) ? MARKS.b : MARKS.a);

  const passes=[]; let step=0;
  function lay(ds, w, oppose, n, isBar){
    n = n || N;
    for(let i=0;i<n;i++){
      const delay=T0+step*GAP; step++;
      /* every other pass runs backwards, so each one picks up where the
         previous finished — like a brush going back over itself */
      const rev = (i%2)===1;
      ds.forEach(function(dd,side){
        /* on the plates the two sides run against each other: while the left
           fills downward the right fills upward, and they swap each pass */
        passes.push({d:dd, w:w*(i+1)/n, delay:delay, bar:!!isBar,
                     rev: (oppose && side===1) ? !rev : rev});
      });
    }
  }

  let extraDefs='', shapes='', wipes=[], t3start=0, t3end=0, done=0;
  const plateStart=[];

  lay([BAR.d], MARK.barW||BAR.w, false, N, true);

  if(MARK.engine==='plate'){
    const barDone = T0 + (step-1)*GAP + DUR;
    let last=0;
    MARK.plates.forEach(function(p,k){
      const start = barDone - 0.38 + k*0.42; last=start;
      [p.x, mirror(p.x)].forEach(function(cx,side){
        const id='wp'+k+side;
        const x=cx-p.w/2, y=p.y0, w=p.w, h=p.y1-p.y0, r=Math.min(MARK.r, w/2);
        const down=((k+side)%2)===0;
        extraDefs+='<clipPath id="'+id+'" clipPathUnits="userSpaceOnUse">'+
          '<rect class="wipe" data-w="'+id+'" x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'"'+
          ' style="transform-origin:50% '+(down?'0%':'100%')+'"/></clipPath>';
        const ins=2.5, ir=Math.max(1.1,r-ins);
        shapes+='<g clip-path="url(#'+id+')">'+
          '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+r+'" fill="url(#dbPlate)"/>'+
          (w>14?'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+r+'" fill="url(#dbMill)"/>':'')+
          '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+r+'" fill="url(#dbFace)"/>'+
          (w>14?'<rect x="'+(x+ins)+'" y="'+(y+ins)+'" width="'+(w-ins*2)+'" height="'+(h-ins*2)+'"'+
                ' rx="'+ir+'" fill="none" stroke="#EAFFF8" stroke-opacity=".17" stroke-width=".8"/>':'')+
          '</g>';
        wipes.push({id:id, delay:start});
      });
    });
    t3start=last; t3end=last+WIPE; done=t3end;
  } else {
    MARK.plates.forEach(function(p,k){
      plateStart[k] = T0 + step*GAP;                 /* when this plate's first pass fires */
      lay(['M'+p.x+' '+p.y1+' V'+p.y2,
           'M'+mirror(p.x)+' '+p.y1+' V'+p.y2], p.w, true, MARK.passes[k]);
    });
    done = T0 + (step-1)*GAP + DUR;
    /* The words start arriving the moment the SECOND plate does, and are fully
       there when the mark is. A longer, earlier window than before — the copy
       used to be crammed into the last half second. */
    t3start = plateStart.length>1 ? plateStart[1] : Math.max(0, done-0.9);
    t3end   = done;
  }

  const d=el(`<div class="heroA">
    <div class="lock">
    <div class="art">
    <svg class="tri" viewBox="0 0 300 268" aria-hidden="true">
      <defs>
        <!-- userSpaceOnUse, always. objectBoundingBox has bitten this file
             three times: on a straight line the bounding box has zero area
             and the gradient renders nothing at all in iOS Safari. -->
        <linearGradient id="triGrad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="268">
          <stop offset="0%"   stop-color="#FF5FA2"/>
          <stop offset="26%"  stop-color="#FF8FBE"/>
          <stop offset="37%"  stop-color="#FFD9E8"/>
          <stop offset="50%"  stop-color="#FF8FBE"/>
          <stop offset="100%" stop-color="#FF5FA2"/>
        </linearGradient>
        <!-- The glare. Light coming OFF the dumbbell and landing on the tube,
             so it is its own blurred overlay fading to nothing a little above
             and below the bar line, rather than a white stop inside the pink.
             y=100 is where the bar crosses the two sides — measured. -->
        <linearGradient id="triGlare" gradientUnits="userSpaceOnUse" x1="0" y1="70" x2="0" y2="132">
          <stop offset="0%"   stop-color="#FFFFFF" stop-opacity="0"/>
          <stop offset="34%"  stop-color="#FFFFFF" stop-opacity=".55"/>
          <stop offset="50%"  stop-color="#FFFFFF" stop-opacity="1"/>
          <stop offset="66%"  stop-color="#FFFFFF" stop-opacity=".55"/>
          <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <!-- Not a closed triangle. It starts at x=100 on the top edge, runs
           right, down to the apex, back up the left side and stops at x=60 —
           leaving a 40-unit break in the top-left, the way a neon tube in a
           real sign has a dark segment. Drawn as one open path rather than
           faked with a dash gap, so the draw-in animation still works and
           the light has somewhere to enter and leave.

           Both ends of the break sit at y=16. They were stepped for a
           version and it read as a mistake rather than a choice. -->
      <path class="tri-l" d="${TRI_D}"/>
      <path class="tri-glare" d="${TRI_D}"/>
      <path class="tri-spark" d="${TRI_D}"/>
    </svg>
      <div class="dbglow"></div>
      <svg class="db${MARK.engine==='plate'?' mb':''}" viewBox="0 0 260 130" preserveAspectRatio="xMidYMid meet">
        <defs>
          <!-- Light sits on the inner plates and falls away outward, so the mass
               of the mark is where the two halves face each other. -->
          <linearGradient id="dbGrad" gradientUnits="userSpaceOnUse" x1="52" y1="0" x2="208" y2="0">
            <stop offset="0%"   stop-color="#34B396"/>
            <stop offset="22%"  stop-color="#93EAD7"/>
            <stop offset="50%"  stop-color="#A8F5E1"/>
            <stop offset="78%"  stop-color="#93EAD7"/>
            <stop offset="100%" stop-color="#34B396"/>
          </linearGradient>
          <!-- The bar carries the same colour as everything else, but its middle
               falls away to nothing. Not a cut — the ends hold full weight, then
               dissolve, so the two halves read as one object with air in it.
               Colours are sampled off dbGrad at the same x, so the seam is invisible. -->
          <linearGradient id="dbBar" gradientUnits="userSpaceOnUse" x1="86" y1="0" x2="174" y2="0">
            <stop offset="0%"   stop-color="#93EAD7" stop-opacity="1"/>
            <stop offset="32%"  stop-color="#8FE6D3" stop-opacity="1"/>
            <stop offset="36%"  stop-color="#89DFCC" stop-opacity=".60"/>
            <stop offset="39%"  stop-color="#83D9C6" stop-opacity=".22"/>
            <stop offset="41%"  stop-color="#7FD5C2" stop-opacity="0"/>
            <stop offset="59%"  stop-color="#7FD5C2" stop-opacity="0"/>
            <stop offset="61%"  stop-color="#83D9C6" stop-opacity=".22"/>
            <stop offset="64%"  stop-color="#89DFCC" stop-opacity=".60"/>
            <stop offset="68%"  stop-color="#8FE6D3" stop-opacity="1"/>
            <stop offset="100%" stop-color="#93EAD7" stop-opacity="1"/>
          </linearGradient>
          <!-- B only. A solid plate needs its own ramp: the value that reads as
               light on a 7-unit stroke is just washed out when it fills a slab. -->
          <linearGradient id="dbPlate" gradientUnits="userSpaceOnUse" x1="52" y1="0" x2="208" y2="0">
            <stop offset="0%"   stop-color="#2FA78C"/>
            <stop offset="30%"  stop-color="#6FD9BF"/>
            <stop offset="50%"  stop-color="#93EAD7"/>
            <stop offset="70%"  stop-color="#6FD9BF"/>
            <stop offset="100%" stop-color="#2FA78C"/>
          </linearGradient>
          <!-- Light on a machined face. Tinted, not white-to-black: a white wash
               desaturates the teal and the plate goes chalky. -->
          <linearGradient id="dbFace" gradientUnits="userSpaceOnUse" x1="0" y1="30" x2="0" y2="100">
            <stop offset="0%"   stop-color="#EAFFF8" stop-opacity=".17"/>
            <stop offset="26%"  stop-color="#EAFFF8" stop-opacity=".03"/>
            <stop offset="58%"  stop-color="#06342A" stop-opacity="0"/>
            <stop offset="100%" stop-color="#06342A" stop-opacity=".30"/>
          </linearGradient>
          <!-- Knurling across the rim, deliberately near the threshold of visible.
               Loud enough to read as stripes and it stops being texture. -->
          <pattern id="dbMill" width="4" height="3.4" patternUnits="userSpaceOnUse">
            <line x1="0" y1=".35" x2="4" y2=".35" stroke="#FFFFFF" stroke-opacity=".038" stroke-width=".5"/>
            <line x1="0" y1="2.0" x2="4" y2="2.0" stroke="#03251E" stroke-opacity=".05"  stroke-width=".5"/>
          </pattern>
          ${extraDefs}
        </defs>
        <g class="rep">${passes.map(function(q){
          return '<path class="stroked'+(q.bar?' bar':'')+'" stroke-width="'+q.w.toFixed(2)+'" d="'+q.d+'"/>';
        }).join('')}${shapes}</g>
      </svg>
    </div>
    <div class="hcopy">
      <h1>${s.h}</h1>
      <div class="hsub">${s.sub}</div>
    </div>
    </div>
  </div>`);

  const heroEl=d.querySelector('.heroA');
  const art=d.querySelector('.art');
  /* The triangle is drawn on the SAME clock as the words, so the outline
     closes as the name lands. Two separate timers would drift apart on a
     phone exactly the way the fifteen CSS transitions did. */
  const triL=d.querySelector('.tri-l'), triSpark=d.querySelector('.tri-spark');
  const TRI_LEN=777;                       // 186 + 272.4 + 272.4 + 46, minus the break
  if(triL){
    triL.style.strokeDasharray=TRI_LEN;
    triL.style.strokeDashoffset=TRI_LEN;
    /* MEASURED, not assumed. It resolves to TRI_LEN on today's path, but the
       outline has been redrawn twice and a hard-coded length leaves the light
       jumping at the seam of every lap when it is. */
    const SPARK_LEN = triSpark.getTotalLength() || TRI_LEN;
    /* short bright dash, one long gap — the gap is the rest of the outline */
    const DASH = 54;
    triSpark.style.strokeDasharray = DASH+' '+(SPARK_LEN-DASH);
    triSpark.style.strokeDashoffset = 0;
    heroEl.style.setProperty('--sparklen', SPARK_LEN.toFixed(1)+'px');

    /* THE PHASE. The glow behind the dumbbell peaks 2750ms into every cycle
       (0.55 + 2.2). A -1650ms shift puts lap-position 0 at t=2750, so the
       light starts its run along the top edge at the instant the mark is at
       its brightest. That is the only coincidence left in the mark.

       > If you change the beat, this moves with it: phase = beat - 2750. */
    const beat = 4400;
    /* The dumbbell's clock, not theme.json's — the light is meant to travel
       at the speed of the mark, so it takes the rep animation's period. */
    heroEl.style.setProperty('--beat', beat+'ms');
    heroEl.style.setProperty('--lap-phase', '-'+(beat-2750)+'ms');
  }
  const paths=[].slice.call(d.querySelectorAll('.rep path.stroked'));
  const strokes=paths.map(function(el,k){
    const L=el.getTotalLength()||1;
    el.style.transition='none';
    /* "L L" — a dash of L followed by an equal gap, so a fully offset path
       parks inside the gap rather than at the edge of the dash and cannot
       paint a stray cap. The reveal is unchanged. */
    el.style.strokeDasharray=L+' '+L;
    /* THE DOTS.
       These strokes are round-capped, and a round cap is drawn at full
       stroke width no matter how short the dash it belongs to. So the
       instant a stroke began drawing it appeared as a circle — up to 8.4px
       across on the thickest plate — and because the strokes are staggered
       you saw about four of them hanging in the air before the dumbbell
       resolved. They read as deliberate dots. They were end caps.

       A stroke is only dot-shaped while it is shorter than it is wide, so
       that is exactly the window to hide: hold it transparent until it has
       drawn past about one and a half stroke widths, then fade it up. Self
       tuning — a thick plate needs longer than a thin one, and each path
       gets its own threshold from its own width. */
    const w=parseFloat(getComputedStyle(el).strokeWidth)||2;
    /* +L hides it before the start, -L hides it past the end, so the
       reveal runs from the opposite direction */
    const from = passes[k].rev ? -L : L;
    el.style.strokeDashoffset = from;
    el.style.opacity = 0;
    return {el:el, from:from, delay:passes[k].delay, len:L, fade:Math.max(1, w*2)};
  });
  const wipeEls=wipes.map(function(w){
    const r=d.querySelector('[data-w="'+w.id+'"]');
    if(r){ r.style.transition='none'; r.style.transform='scaleY(0)'; }
    return {el:r, delay:w.delay};
  }).filter(function(w){return w.el;});

  /* The words and the button hold until the mark is finished, then arrive
     together. The footer markup goes in now so the layout is already settled;
     only the reveal waits. The button gets the same slow pulse that sits behind
     the mark, so the two things breathing on this screen breathe together. */
  foot.innerHTML=`<div class="ctawrap"><span class="ctaglow" aria-hidden="true"></span>`+
                 `<button class="cta accent">${s.cta}</button></div>`;
  foot.classList.remove('on');
  syncFootPad();
  foot.querySelector('.cta').onclick=()=>{haptic(18);next();};
  const ctaWrap=foot.querySelector('.ctawrap');
  const cta=foot.querySelector('.cta');
  const hcopy=heroEl.querySelector('.hcopy');
  hcopy.style.opacity='0'; hcopy.style.transform='translateY(12px)';
  cta.style.opacity='0';   cta.style.transform='translateY(8px)';

  function landArt(){
    if(art.classList.contains('alive')) return;
    art.classList.add('alive');
    if(ctaWrap) ctaWrap.classList.add('alive');   /* same instant, same phase */
  }

  /* ---- ONE CLOCK ----------------------------------------------------------
     Every stroke used to be its own CSS transition with its own delay, and the
     browser scheduled all fifteen of them. Desktop copes; a phone does not —
     if the main thread is busy when a delay expires the transition starts late,
     and because each one is independent they drift apart from each other. That
     is why the mark drew "weird" on the phone and fine in the browser: the two
     platforms were running fifteen separate animations, not one.

     Now a single requestAnimationFrame loop computes every stroke's position
     from elapsed time. Drop a frame and the next one lands exactly where the
     clock says it should be, so nothing can desync. Same code, same timeline,
     every platform. The text and the button ride the same clock for the same
     reason. -------------------------------------------------------------- */
  const easeDraw = p => 1-Math.pow(1-p,2.2);       /* matches the old curve's feel */
  const clamp01  = v => v<0?0:(v>1?1:v);
  let raf=0, landedText=false, landedArt=false, t0=0;

  function paint(t){
    for(let k=0;k<strokes.length;k++){
      const st=strokes[k];
      const p=clamp01((t-st.delay)/DUR);
      const e=easeDraw(p);
      st.el.style.strokeDashoffset = (st.from*(1-e)).toFixed(2);
      /* Invisible while it is still just an end cap, then up to full.
         Squared, because a straight ramp still left the thickest plate at
         a third opacity while it was three pixels long and seven wide —
         which is a faint dot, not a stroke. */
      const o=clamp01((st.len*e)/st.fade);
      st.el.style.opacity = (o*o).toFixed(3);
    }
    for(let k=0;k<wipeEls.length;k++){
      const w=wipeEls[k];
      w.el.style.transform='scaleY('+easeDraw(clamp01((t-w.delay)/WIPE)).toFixed(4)+')';
    }
    /* the words rise and fade in across the same window, on the same clock */
    const q=clamp01((t-t3start)/Math.max(.35,t3end-t3start));
    const e=1-Math.pow(1-q,3);
    hcopy.style.opacity=e.toFixed(3);
    hcopy.style.transform='translateY('+(12*(1-e)).toFixed(2)+'px)';
    if(triL) triL.style.strokeDashoffset=(TRI_LEN*(1-e)).toFixed(1);
    cta.style.opacity=e.toFixed(3);
    cta.style.transform='translateY('+(8*(1-e)).toFixed(2)+'px)';
    if(!landedText && t>=t3start){ landedText=true; foot.classList.add('on'); syncFootPad(); }
    if(!landedArt  && t>=done)   { landedArt=true;  landArt(); }
  }
  function tick(now){
    if(!d.isConnected){ raf=0; return; }            /* screen left; stop the clock */
    if(!t0) t0=now;
    const t=(now-t0)/1000;
    paint(t);
    if(t<done+0.05){ raf=requestAnimationFrame(tick); }
    else { raf=0; finishNow(); }
  }
  function finishNow(){
    if(raf){ cancelAnimationFrame(raf); raf=0; }
    paint(done+1);                                   /* land every value exactly */
    /* Hand the strokes back to the stylesheet. The fade-in above is a
       function of drawn length over stroke width, so a path shorter than
       one and a half of its own widths would top out below 1 and stay
       faint for good. None are today; clearing it means none ever can be. */
    for(let k=0;k<strokes.length;k++){ strokes[k].el.style.opacity=''; }
    hcopy.style.opacity=''; hcopy.style.transform='';
    cta.style.opacity='';   cta.style.transform='';
    heroEl.classList.add('ready');
    /* Only now does the light start running. */
    heroEl.classList.add('lit');
    if(triL) triL.style.strokeDashoffset=0;
    if(!landedText){ landedText=true; foot.classList.add('on'); syncFootPad(); }
    landArt();
    /* A no-op unless syncFootPad changed the padding when the button came
       in. Left in so a footer that does resize cannot leave the copy off. */
    placeCopy();
  }

  /* THE WORDS SIT HALFWAY BETWEEN THE POINT OF THE TRIANGLE AND THE BUTTON.
     Both ends move: the triangle scales with the width of the screen and the
     button rides the safe-area inset, so a fixed margin that looks right on
     one phone is wrong on the next. Measured instead.

     It has to iterate. The block is vertically centred, so adding N to the
     gap pushes the words down by only N/2 — and drags the triangle, and with
     it the apex, up by the other half. Each pass halves the error, so three
     or four settle it; the loop exits on half a pixel. */
  function placeCopy(){
    const tri=d.querySelector('.tri'), lock=d.querySelector('.lock'),
          btn=foot.querySelector('.cta');
    if(!tri||!lock||!btn||!d.isConnected) return;
    let gap=parseFloat(getComputedStyle(art).marginBottom)||0;
    for(let i=0;i<10;i++){
      const t=tri.getBoundingClientRect();
      const apex=t.top+t.height*(252/268);          // the point, not the box
      /* The button flies in on translateY(8px), and a rect INCLUDES that
         transform — so measuring it before the landing put it 8px low, and
         the second pass after the landing moved the whole block by about a
         pixel. That was the last of the opening glitch. foot has no
         transform of its own, so its rect plus the button's offsetTop is
         where the button actually lands. */
      const btnTop=foot.getBoundingClientRect().top+btn.offsetTop;
      const mid=(apex+btnTop)/2;
      /* offsetTop, not a rect: hcopy carries a transform on the way in and a
         rect would measure where it is flying from, not where it lands. */
      const at=lock.getBoundingClientRect().top+hcopy.offsetTop;
      const dy=mid-hcopy.offsetHeight/2-at;
      if(Math.abs(dy)<0.5) break;
      const next=Math.min(340,Math.max(16,gap+dy*2));
      if(next===gap) break;                          // clamped; stop rather than spin
      gap=next; art.style.marginBottom=gap+'px';
    }
  }
  window.addEventListener('resize',placeCopy);


  /* Settle the layout before the first frame. */
  placeCopy();
  requestAnimationFrame(placeCopy);        // again once fonts have settled

  if(REDUCED){ finishNow(); }
  else { raf=requestAnimationFrame(tick); }

  /* Nobody should have to wait out an animation, and once it has landed there
     is only one thing to do here — so the whole screen is the button. First
     tap finishes the mark, the next one moves on. Two taps through the opening
     without ever aiming at anything. */
  d.addEventListener('click', function(ev){
    if(ev.target.closest && ev.target.closest('#foot')) return;
    if(!art.classList.contains('alive')){ finishNow(); return; }
    haptic(16); next();
  });
}
