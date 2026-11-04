/* TYSHA — experimental effects, loaded by site.js only with ?fx=depth (kept for the tab in sessionStorage).
   1. Quiet depth: the boundary between two sections is a soft hinge. As it travels up the screen the incoming
      section's far edge and the outgoing section's far edge lean back a few degrees, eased over the whole viewport
      (a sine), symmetric for entering and leaving. Transform only, geometry cached, rAF only while scrolling.
   2. Curtain: photos hang like linen curtains in a quiet room. Anchored along the top edge, they breathe in slow
      vertical folds (depth shown by light, plus a few px of sideways sway at the hem); a scroll is a draft that
      makes the folds ripple and settle; the pointer brushing past sends a travelling wave through the cloth.
      ONE WebGL context renders every visible photo in turn and hands each frame to that photo's own 2D canvas.
   Desktop / tablet with a fine pointer; prefers-reduced-motion and software renderers keep everything still. */
(() => {
  'use strict';

  /* ---------- tuning knobs ---------- */
  const DEPTH = {
    maxTilt: 3.5,        // deg, when a section boundary is at the very edge of the screen
    minScale: 0.99,      // scale at that moment
    perspective: 1800,   // px
    overscan: 160,       // px of the section's own colour painted beside it, so a tilt never shows dark slivers
  };
  const CURTAIN = {
    sway: 7,             // px of depth of the idle folds at the hem (the top edge never moves)
    swayX: 2.5,          // px of sideways drift at the hem
    folds: 2.5,          // folds across the photo's width
    period: 8,           // s: one breath of the idle sway
    gust: 1.6,           // how much a fast scroll multiplies the folds (and adds a quicker ripple)
    settle: 2.5,         // s: a gust or a brush dies away over about this long
    brush: 6,            // px of depth of the wave a pointer sends through the cloth
    light: 0.55,         // strength of the soft window light on the folds
    hem: 2.5,            // px: the bottom edge's silhouette waves by this much (0 = a straight cut)
    weave: 0.018,        // linen weave in the light (keep almost invisible)
    fps: 40,             // cap for the idle sway (pointer and gusts render at the screen's rate)
    res: 1,              // render scale on top of devicePixelRatio (capped at 2)
    minSize: 180,        // px: smaller photos stay plain
    sharpen: 0.45,       // matches the canvas to the crisper <img> it stands in for
  };

  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ON = matchMedia('(min-width: 761px) and (pointer: fine)').matches;
  if (RM || !ON) return;
  const clamp = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const wave = (p) => (1 - Math.cos(Math.PI * clamp(p))) / 2;   // a sine ease over the whole viewport

  /* ---------- 1. quiet depth ---------- */
  // pinned scenes (sticky inside) would break under a transform: they stay flat
  const secs = Array.from(document.querySelectorAll('main > section')).filter((s) => !s.matches('[data-pin]') && !s.querySelector('[data-pin-inner]'));
  const geo = new Map();
  const docTop = (el) => { let y = 0; for (let e = el; e; e = e.offsetParent) y += e.offsetTop; return y; };   // unaffected by transforms
  const bgOf = (el) => {
    for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c; }
    return '#111110';
  };
  const measure = () => { secs.forEach((s) => geo.set(s, { top: docTop(s), h: s.offsetHeight, bg: bgOf(s) })); };
  let raf = 0, idle = 0;
  const flat = (s) => { if (s.style.transform) { s.style.transform = s.style.transformOrigin = s.style.willChange = s.style.boxShadow = ''; } };
  const apply = () => {
    raf = 0;
    const y = window.scrollY, H = window.innerHeight, P = DEPTH.perspective;
    for (const s of secs) {
      const g = geo.get(s); if (!g) continue;
      const top = g.top - y, bot = top + g.h;
      if (bot < 0 || top > H) { flat(s); continue; }
      // the boundary on screen is the hinge: entering, the top edge (k from its height on screen); leaving, the bottom
      const kin = top > 0 ? wave(top / H) : 0;
      const kout = bot < H ? wave(1 - bot / H) : 0;
      if (kin < 0.002 && kout < 0.002) { flat(s); continue; }
      const enter = kin >= kout, k = enter ? kin : kout;
      const deg = (enter ? -1 : 1) * DEPTH.maxTilt * k;
      const sc = 1 - (1 - DEPTH.minScale) * k;
      const o = DEPTH.overscan;
      s.style.willChange = 'transform';
      s.style.transformOrigin = enter ? '50% 0' : '50% 100%';
      s.style.transform = 'perspective(' + P + 'px) rotateX(' + deg.toFixed(3) + 'deg) scale(' + sc.toFixed(4) + ')';
      s.style.boxShadow = -o + 'px 0 0 ' + g.bg + ',' + o + 'px 0 0 ' + g.bg;   // overscan: its own colour at both sides
    }
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(apply); };
  measure(); apply();
  addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', () => { measure(); kick(); });
  addEventListener('load', () => { measure(); kick(); });
  if (window.ResizeObserver) new ResizeObserver(() => { clearTimeout(idle); idle = setTimeout(() => { measure(); kick(); }, 120); }).observe(document.body);
  // a page transition captures flat pages: the shared photo and title morph from where they really are
  addEventListener('pageswap', () => secs.forEach(flat));

  /* ---------- 2. curtain photos ---------- */
  const glc = document.createElement('canvas');
  const gl = glc.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, preserveDrawingBuffer: false, powerPreference: 'low-power' });
  if (!gl) return;   // no WebGL: plain photos
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const rend = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
  if (/swiftshader|llvmpipe|softpipe|software rasterizer|microsoft basic render/i.test(rend) && !/[?&]live=force\b/.test(location.search)) return;

  const VS = 'attribute vec2 a;varying vec2 v;void main(){v=vec2(a.x*.5+.5,.5-a.y*.5);gl_Position=vec4(a,0,1);}';
  // S size px; X texel; T: x time, y gust 0-1, z gust phase; B0..B3 brushes: x px, y px, age s, strength
  // A: sway px, swayX px, folds, period; L: light, hem px, weave, brush px
  const FS = 'precision highp float;uniform sampler2D I;uniform vec2 S,X;uniform vec3 T;uniform vec4 A,L,B0,B1,B2,B3;varying vec2 v;'
    + 'const float PI=3.14159;'
    + 'float br(vec4 b,vec2 q){if(b.w<=0.)return 0.;float r=abs(q.x-b.x),f=b.z*S.x*.55;'        // a fold front travelling outwards
    + 'float ring=exp(-pow((r-f)/(S.x*.09),2.));float vy=exp(-pow((q.y-b.y)/(S.y*.6),2.));'
    + 'return b.w*ring*vy*sin((r-f)/(S.x*.07)*PI)*exp(-b.z*1.1);}'
    // z: depth of the cloth in px at q; anchored at the top (zero) and growing towards the hem
    + 'float zf(vec2 q){float yn=q.y/S.y,an=pow(yn,1.35),x=q.x/S.x,t=T.x*2.*PI/A.w;'
    + 'float s=sin(x*A.z*2.*PI+t+yn*.6)*.6+sin(x*A.z*1.37*2.*PI-t*.73+1.7)*.3+sin(x*A.z*.53*2.*PI+t*.41+.4)*.35;'
    + 'float g=T.y*sin(x*A.z*3.1*2.*PI-T.z*2.4+yn*2.)*.55;'
    + 'float b=br(B0,q)+br(B1,q)+br(B2,q)+br(B3,q);'
    + 'return an*(A.x*(s*(1.+T.y*.8)+g)+L.w*b);}'
    + 'void main(){vec2 q=v*S;float e=2.;'
    + 'float z=zf(q),zx=(zf(q+vec2(e,0.))-zf(q-vec2(e,0.)))/(2.*e),zy=(zf(q+vec2(0.,e))-zf(q-vec2(0.,e)))/(2.*e);'
    // the cloth drifts sideways a little with its folds; the top row stays put
    + 'float yn=q.y/S.y;vec2 o=vec2(A.y*pow(yn,1.35)*sin(T.x*2.*PI/A.w*.63+q.x/S.x*1.3)+z*.18,0.);'
    + 'vec2 u=clamp((q-o)/S,0.,1.);vec3 c=texture2D(I,u).rgb;'
    + 'vec3 bl=(texture2D(I,u+vec2(X.x,0.))+texture2D(I,u-vec2(X.x,0.))+texture2D(I,u+vec2(0.,X.y))+texture2D(I,u-vec2(0.,X.y))).rgb*.25;c+=(c-bl)*SHARP;'
    // fabric light: a soft window up and to the left, wrapped (cloth scatters), a touch of shadow in the troughs
    + 'vec3 n=normalize(vec3(-zx*3.,-zy*3.,1.)),Ld=normalize(vec3(-.55,-.35,.75));'
    + 'float wv=(sin(q.x*2.3)*sin(q.y*2.3)+sin(q.x*1.1+q.y*1.7)*.5)*L.z;'
    + 'float d=(dot(n,Ld)*.5+.5)-(Ld.z*.5+.5);'
    + 'c*=1.+L.x*(d*1.6+wv)-L.x*.025*max(0.,-z)/max(A.x,1.);'
    // hem: the bottom edge's silhouette follows the cloth
    + 'float hy=S.y-L.y*(1.+.5*sin(q.x/S.x*A.z*2.*PI+T.x*2.*PI/A.w+1.)+.35*z/max(A.x,1.));'
    + 'float al=clamp(hy-q.y+.5,0.,1.);gl_FragColor=vec4(c*al,al);}';
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS.replace('SHARP', CURTAIN.sharpen.toFixed(2))));
  gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
  gl.useProgram(pr);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const al = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(al); gl.vertexAttribPointer(al, 2, gl.FLOAT, false, 0, 0);
  const U = {}; ['I', 'S', 'X', 'T', 'A', 'L', 'B0', 'B1', 'B2', 'B3'].forEach((k) => { U[k] = gl.getUniformLocation(pr, k); });
  gl.uniform1i(U.I, 0);
  gl.clearColor(0, 0, 0, 0);

  // the visible crop of a photo at exactly its canvas size, scaled by the browser's own resampler (so the
  // hand-over from <img> to canvas shows no seam)
  const crop = (im, cw, ch) => {
    const w = im.offsetWidth, nw = im.naturalWidth, nh = im.naturalHeight;
    const s = Math.max(w / nw, im.offsetHeight / nh), sw = w / s;
    const op = getComputedStyle(im).objectPosition.split(' ').map((x) => (/%$/.test(x) ? parseFloat(x) / 100 : 0.5));
    const k = cw / sw, full = document.createElement('canvas');
    full.width = Math.round(nw * k); full.height = Math.round(nh * k);
    const f = full.getContext('2d'); f.imageSmoothingQuality = 'high'; f.drawImage(im, 0, 0, full.width, full.height);
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    c.getContext('2d').drawImage(full, -Math.round((full.width - cw) * op[0]), -Math.round((full.height - ch) * (op[1] === undefined ? 0.5 : op[1])));
    return c;
  };

  // photos that take part: cards, the projects index, case galleries; never the hero, the day frames, the
  // statement, the contact photo, the modal or small thumbnails
  const SKIP = '[data-hero], [data-pin], #contact, dialog, .st-layer, .foot-wm';
  const items = [];
  const settled = (im) => im.complete && im.naturalWidth && (!im.classList.contains('rv-img') || im.classList.contains('in'));
  const startT = performance.now();
  let gust = 0, gustPhase = 0, last = 0, lastIdle = 0, loop = 0;

  const sizeOf = (it) => {
    const im = it.im, w = im.offsetWidth, h = im.offsetHeight, d = Math.min(2, (devicePixelRatio || 1) * CURTAIN.res);
    return [w, h, Math.round(w * d), Math.round(h * d)];
  };
  const prepare = (it) => {
    const [w, h, cw, ch] = sizeOf(it);
    if (w < CURTAIN.minSize || !settled(it.im)) return false;
    if (it.tex && it.cw === cw && it.ch === ch) return true;
    if (!it.cv) {
      it.cv = document.createElement('canvas'); it.cv.className = 'fx-linen'; it.cv.setAttribute('aria-hidden', 'true');
      it.ctx = it.cv.getContext('2d');
    }
    it.cv.width = cw; it.cv.height = ch; it.cw = cw; it.ch = ch; it.w = w; it.h = h;
    Object.assign(it.cv.style, { left: it.im.offsetLeft + 'px', top: it.im.offsetTop + 'px', width: w + 'px', height: h + 'px' });
    if (!it.tex) it.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, it.tex);
    [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]].forEach(([k, v]) => gl.texParameteri(gl.TEXTURE_2D, k, v));
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, crop(it.im, cw, ch)); } catch (e) { return false; }
    if (!it.cv.isConnected) (it.im.parentElement.tagName === 'PICTURE' ? it.im.parentElement : it.im).after(it.cv);
    return true;
  };
  const release = (it) => {
    if (it.tex) { gl.deleteTexture(it.tex); it.tex = null; }
    if (it.cv) it.cv.remove();
    it.im.classList.remove('fx-linen-src'); it.shown = false;
  };
  const draw = (it, t) => {
    if (glc.width < it.cw || glc.height < it.ch) { glc.width = Math.max(glc.width, it.cw); glc.height = Math.max(glc.height, it.ch); }
    gl.viewport(0, 0, it.cw, it.ch); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindTexture(gl.TEXTURE_2D, it.tex);
    gl.uniform2f(U.S, it.w, it.h); gl.uniform2f(U.X, 1 / it.cw, 1 / it.ch);
    gl.uniform3f(U.T, t + it.seed, gust, gustPhase);
    gl.uniform4f(U.A, CURTAIN.sway, CURTAIN.swayX, CURTAIN.folds, CURTAIN.period);
    gl.uniform4f(U.L, CURTAIN.light, CURTAIN.hem, CURTAIN.weave, CURTAIN.brush);
    for (let i = 0; i < 4; i++) { const b = it.brushes[i]; gl.uniform4f(U['B' + i], b ? b.x : 0, b ? b.y : 0, b ? t - b.t : 0, b ? b.s : 0); }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    // the GL canvas's bottom-left corner holds this frame
    it.ctx.clearRect(0, 0, it.cw, it.ch);
    it.ctx.drawImage(glc, 0, glc.height - it.ch, it.cw, it.ch, 0, 0, it.cw, it.ch);
    it.cv.style.transform = it.im.style.transform;
    if (!it.shown) { it.shown = true; it.im.classList.add('fx-linen-src'); }
  };

  const frame = (now) => {
    loop = 0;
    if (document.hidden) return;
    const vis = items.filter((it) => it.vis);
    if (!vis.length) return;
    const dt = Math.min(0.1, last ? (now - last) / 1000 : 0.016); last = now;
    gust *= Math.exp(-dt * 4.6 / CURTAIN.settle); gustPhase += dt * (1 + gust * 3);
    const t = (now - startT) / 1000;
    const busy = gust > 0.01 || vis.some((it) => it.brushes.length);
    // idle sway at a gentle frame rate; a gust or a brush at the screen's
    if (busy || now - lastIdle >= 1000 / CURTAIN.fps) {
      lastIdle = now;
      for (const it of vis) {
        it.brushes = it.brushes.filter((b) => t - b.t < CURTAIN.settle * 1.6);
        if (prepare(it)) draw(it, t);
      }
    }
    loop = requestAnimationFrame(frame);
  };
  const wake = () => { if (!loop) { last = 0; loop = requestAnimationFrame(frame); } };

  const io = new IntersectionObserver((es) => {
    es.forEach((e) => { const it = e.target.__fx; if (!it) return; it.vis = e.isIntersecting; if (!e.isIntersecting && it.tex) release(it); });
    wake();
  }, { rootMargin: '60px 0px' });

  Array.from(document.querySelectorAll('main img')).filter((im) => !im.closest(SKIP)).forEach((im, i) => {
    const it = { im, vis: false, brushes: [], seed: i * 3.7, shown: false };
    im.__fx = it; items.push(it); io.observe(im);
    const box = im.closest('a, article, figure, li') || im.parentElement;
    let lx = -1, ly = -1;
    box.addEventListener('pointermove', (e) => {
      if (!it.shown) return;
      const r = im.getBoundingClientRect(), k = r.width / im.offsetWidth || 1;
      const x = (e.clientX - r.left) / k, y = (e.clientY - r.top) / k;
      if (x < 0 || y < 0 || x > it.w || y > it.h) return;
      // a hand brushing past: every ~70 px of travel starts a fold that runs out sideways through the cloth
      const d = lx < 0 ? 999 : Math.hypot(x - lx, y - ly);
      if (d > 70) {
        lx = x; ly = y;
        const s = Math.min(1, 0.45 + Math.abs(e.movementX || 0) / 40);
        it.brushes.push({ x, y, t: (performance.now() - startT) / 1000, s });
        if (it.brushes.length > 4) it.brushes.shift();
        wake();
      }
    }, { passive: true });
    box.addEventListener('pointerleave', () => { lx = ly = -1; });
  });

  // a scroll is a draft through the room: its speed sets the gust, which then settles over CURTAIN.settle
  let sy = scrollY, st = performance.now();
  addEventListener('scroll', () => {
    const now = performance.now(), v = Math.abs(scrollY - sy) / Math.max(8, now - st) * 1000;
    sy = scrollY; st = now;
    gust = Math.max(gust, Math.min(1, v / 2500) * CURTAIN.gust);
    wake();
  }, { passive: true });
  addEventListener('resize', () => { items.forEach((it) => { it.cw = 0; }); wake(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
  addEventListener('pageswap', () => items.forEach(release));
  addEventListener('load', wake);
})();
