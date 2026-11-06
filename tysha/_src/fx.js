/* TYSHA — effects, loaded by site.js once the page is idle (desktop / tablet, fine pointer; ?fx=off turns them off).
   1. Quiet depth: the boundary between two sections is a soft hinge. As it travels up the screen the incoming
      section's far edge and the outgoing section's far edge lean back a few degrees, eased over the whole viewport
      (a sine), symmetric for entering and leaving. Transform only, geometry cached, rAF only while scrolling.
   2. Curtain (hover only): at rest a photo is the plain <img>. Under the pointer it becomes silk hanging from its top
      edge in a breeze that blows from the pointer's side: long diagonal folds travel across and down the cloth, the
      print rides on them, the far edge billows out past the box and the near edge pulls in. A subdivided mesh in
      perspective, lit from the folds' analytic normals. On leave it relaxes flat and hands back to the <img>.
      ONE WebGL context; each active card has its own canvas (fixed, over the page, so the billow is not clipped).
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
    angle: 26,           // deg: how far the folds lean from vertical (they lean away from the pointer, like cloth in a draft)
    waves: 1.9,          // broad folds across the photo (the main one; two softer ones ride on it)
    amp: 0.04,           // depth of the folds, share of the photo's width (0.04 of 683 px = 27 px)
    edgeBillow: 0.1,     // how far the far side edge sweeps out at the hem, share of the width (the near edge pulls in)
    speed: 1,            // overall tempo of the breeze (1 = slow and heavy)
    light: 0.3,          // soft fold light (0.3 gives about -10% / +6% at the default depth)
    sheen: 0.06,         // silky highlight on the ridges
    overscan: 0.12,      // share of the size painted beyond the box, so the billowing edge never clips
    hoverIn: 0.8,        // s: the breeze picks up after the pointer arrives
    settle: 1.6,         // s: the cloth relaxes to flat after the pointer leaves, then the plain <img> takes over
    lag: 2.2,            // spring rate of the wind following the pointer, 1/s (lower = lazier)
    grid: 72,            // mesh subdivisions per side
    minSize: 180,        // px: smaller photos stay plain
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

  /* ---------- 2. curtain photos (hover only) ---------- */
  // one GL context renders off screen; each active card copies its frame into its own 2D canvas, so cards are
  // independent: the one being left settles on its own while the next starts on the very first pointer event
  const glc = document.createElement('canvas');
  const gl = glc.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true, depth: false, powerPreference: 'low-power' });
  if (!gl) return;   // no WebGL: plain photos
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const rend = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
  if (/swiftshader|llvmpipe|softpipe|software rasterizer|microsoft basic render/i.test(rend) && !/[?&]live=force\b/.test(location.search)) return;

  // S: photo w,h px; O: overscan px; T: x time, y strength 0-1, z wind side -1..1 (where the pointer is), w gust
  // F: x angle rad, y folds, z amp px, w billow px; Q: x light, y sheen
  const VS = 'precision highp float;attribute vec2 a;uniform vec2 S;uniform float O;uniform vec4 T,F;uniform vec3 P;varying vec2 vu;varying vec3 vn;varying float vz;'
    + 'void main(){float w=S.x,h=S.y,t=T.x,K=T.y,cx=T.z,g=1.+T.w*.5;'
    + 'vec2 p=vec2((a.x-.5)*w,a.y*h);'
    + 'float r=a.y*(2.-a.y);'                                                         // pinned at the top row, folds reach up high
    + 'float th=F.x;vec2 f=vec2(-cx*sin(th),cos(th)),n=vec2(f.y,-f.x);'               // fold lines lean away from the wind
    + 'float k=6.2832*F.y/w,X=dot(p,n),Y=dot(p,f);'
    + 'vec3 A=vec3(1.,.3,.35),Kn=vec3(k,k*1.28,k*.55),Kf=vec3(k*.14,k*.2,k*.08);'
    + 'vec3 ph=Kn*X+Kf*Y+P;'                                                            // phases accumulate in JS: never jump
    + 'vec3 sn=sin(ph),cs=cos(ph);'
    + 'float amp=F.z*K*g*r;'
    + 'float z=amp*dot(A,sn);'
    + 'vec2 dz=amp*(dot(A*cs,Kn)*n+dot(A*cs,Kf)*f)*.6;'                               // slope of the cloth (softened for the light)
    // the print rides on the folds: it gathers on the crests and stretches in the valleys (Gerstner-like)
    + 'float ce=.35+.65*pow(abs(a.x-.5)*2.,1.2);vec2 d=-n*amp*.55*ce*dot(A,cs);'          // calmer in the middle, where the architecture is
    // the silhouette: the far edge swings out, the near edge pulls in; the hem lifts and falls
    + 'float sx=sign(a.x-.5),e=pow(abs(a.x-.5)*2.,1.6),away=-cx*sx;'
    + 'd.x+=sx*F.w*K*g*e*(a.y*(.275+.575*away)+r*.3*sin(t*.62-a.y*2.4+sx*1.3));'
    + 'd.y+=-F.w*.35*K*g*a.y*a.y*(.5+.5*sin(t*.5+a.x*3.1*-cx));'
    + 'd.x+=-cx*F.w*.3*K*g*r*(.6+.4*sin(t*.37));'
    // perspective: depth changes the outline too (camera on the photo's centre line)
    + 'float D=2.4*max(w,h),sc=D/(D-z*(.45+.55*ce));vec2 q=vec2((p.x+d.x)*sc,h*.5+(p.y+d.y-h*.5)*sc);'
    + 'gl_Position=vec4(q.x/(w*.5+O),1.-2.*(q.y+O)/(h+2.*O),0.,1.);'
    + 'vu=a;vn=normalize(vec3(-dz,1.));vz=z/max(F.z,1.);}';
  const FS = 'precision highp float;uniform sampler2D I;uniform vec4 Q;varying vec2 vu;varying vec3 vn;varying float vz;'
    + 'void main(){vec3 c=texture2D(I,vu).rgb,n=normalize(vn);'
    + 'vec3 L=normalize(vec3(-.35,-.45,.82));float hl=dot(n,L)*.5+.5,h0=L.z*.5+.5,d=hl*hl-h0*h0;'   // half-Lambert, relative to flat
    + 'vec3 H=normalize(L+vec3(0.,0.,1.));float s=pow(max(dot(n,H),0.),6.)-pow(H.z,6.);'     // a wide, soft sheen
    + 'float l=Q.x*d*2.2+Q.y*s*1.6;l=l<0.?-.1*(1.-exp(l*10.)):.07*(1.-exp(-l*14.));'           // soft knee, no clipping lines
    + 'gl_FragColor=vec4(c*(1.+l),1.);}';
  const sh = (t, src) => { const o = gl.createShader(t); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) console.warn('[fx]', gl.getShaderInfoLog(o)); return o; };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
  gl.useProgram(pr);
  // the mesh: (grid+1)^2 vertices in photo uv, indexed triangles
  const N = CURTAIN.grid, vtx = new Float32Array((N + 1) * (N + 1) * 2), idx = new Uint16Array(N * N * 6);
  for (let y = 0, o = 0; y <= N; y++) for (let x = 0; x <= N; x++) { vtx[o++] = x / N; vtx[o++] = y / N; }
  for (let y = 0, o = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * (N + 1) + x; idx[o++] = i; idx[o++] = i + 1; idx[o++] = i + N + 1; idx[o++] = i + 1; idx[o++] = i + N + 2; idx[o++] = i + N + 1;
  }
  const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, vtx, gl.STATIC_DRAW);
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  const al = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(al); gl.vertexAttribPointer(al, 2, gl.FLOAT, false, 0, 0);
  const U = {}; ['I', 'S', 'O', 'T', 'F', 'Q', 'P'].forEach((k2) => { U[k2] = gl.getUniformLocation(pr, k2); });
  gl.uniform1i(U.I, 0); gl.clearColor(0, 0, 0, 0);

  // the visible crop of a photo at exactly the texture size, scaled by the browser's own resampler
  const crop = (im, cw, ch) => {
    const w = im.offsetWidth, nw = im.naturalWidth, nh = im.naturalHeight;
    const sc = Math.max(w / nw, im.offsetHeight / nh), sw = w / sc;
    const op = getComputedStyle(im).objectPosition.split(' ').map((x) => (/%$/.test(x) ? parseFloat(x) / 100 : 0.5));
    const k2 = cw / sw, full = document.createElement('canvas');
    full.width = Math.round(nw * k2); full.height = Math.round(nh * k2);
    const f = full.getContext('2d'); f.imageSmoothingQuality = 'high'; f.drawImage(im, 0, 0, full.width, full.height);
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    c.getContext('2d').drawImage(full, -Math.round((full.width - cw) * op[0]), -Math.round((full.height - ch) * (op[1] === undefined ? 0.5 : op[1])));
    return c;
  };

  const SKIP = '[data-hero], [data-pin], #contact, dialog, .st-layer, .foot-wm';
  // only the project cards on the home page and the projects index: the architecture in the cases stays straight
  const imgs = document.querySelector('.case-hero') ? [] : Array.from(document.querySelectorAll('main .card-media img')).filter((im) => !im.closest(SKIP));
  if (!imgs.length) return;
  document.documentElement.classList.add('fx-curtain-on');

  const ready = (im) => im.complete && im.naturalWidth && im.offsetWidth >= CURTAIN.minSize && (!im.classList.contains('rv-img') || im.classList.contains('in'));
  // per card: texture (uploaded ahead of time), output canvas and its own wind state
  const inst = new Map();
  const prepare = (im) => {
    let c = inst.get(im);
    const w = im.offsetWidth, h = im.offsetHeight;
    if (c && c.w === w && c.h === h) return c;
    if (!ready(im)) return null;
    const d = Math.min(2, devicePixelRatio || 1), o = Math.round(Math.max(w, h) * CURTAIN.overscan);
    if (!c) {
      c = { im, tex: gl.createTexture(), cv: document.createElement('canvas'), k: 0, kt: 0, cx: 0, vx: 0, tcx: 0, g: 0, gt: 0, gv: 0, t: Math.random() * 20, ph: [Math.random() * 6, 1.9, 4.1], lx: null, on: false };
      c.cv.className = 'fx-curtain'; c.cv.setAttribute('aria-hidden', 'true'); c.ctx = c.cv.getContext('2d');
      inst.set(im, c);
    }
    Object.assign(c, { w, h, o, d, cw: Math.round((w + 2 * o) * d), ch: Math.round((h + 2 * o) * d) });
    c.cv.width = c.cw; c.cv.height = c.ch;
    Object.assign(c.cv.style, { width: (w + 2 * o) + 'px', height: (h + 2 * o) + 'px' });
    gl.bindTexture(gl.TEXTURE_2D, c.tex);
    [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]].forEach(([k2, v]) => gl.texParameteri(gl.TEXTURE_2D, k2, v));
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, crop(im, Math.round(w * d), Math.round(h * d))); } catch (e) { inst.delete(im); return null; }
    // the render target is shared and only ever grows (re-allocating it on a hover would cost a frame); one tiny
    // draw with this texture makes the driver finish the upload now
    if (glc.width < c.cw || glc.height < c.ch) { glc.width = Math.max(glc.width, c.cw); glc.height = Math.max(glc.height, c.ch); }
    gl.viewport(0, 0, 1, 1); gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    return c;
  };
  // textures for the cards on screen are uploaded when the browser is idle, so a first hover never waits
  const onIdle = window.requestIdleCallback || ((f) => setTimeout(f, 200));
  const seen = new Set();
  const warm = (im) => onIdle(() => { if (!seen.has(im)) return; if (!prepare(im)) setTimeout(() => warm(im), 400); }, { timeout: 1500 });   // not revealed yet: try again
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { seen.add(e.target); warm(e.target); } else seen.delete(e.target);
  }), { rootMargin: '200px 0px' });
  // the driver compiles a program on its first draw: do that once now, not on the first hover
  glc.width = glc.height = 2; gl.viewport(0, 0, 2, 2); gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
  imgs.forEach((im) => { io.observe(im); im.addEventListener('load', () => { if (inst.has(im)) { inst.get(im).w = 0; } }); });

  const draw = (c, dt) => {
    c.k += (c.kt - c.k) * (1 - Math.exp(-dt * 4.6 / (c.kt > 0 ? CURTAIN.hoverIn : CURTAIN.settle)));
    // critically damped springs: no overshoot, no jumps, whatever the pointer does
    const sp = (x, v, to, w) => { const a = w * w * (to - x) - 2 * w * v; v += a * dt; return [x + v * dt, v]; };
    [c.cx, c.vx] = sp(c.cx, c.vx, c.tcx, CURTAIN.lag);
    c.gt *= Math.exp(-dt * 1.2);
    [c.g, c.gv] = sp(c.g, c.gv, c.gt, 3);
    const g = Math.max(0, c.g), tempo = CURTAIN.speed * (1 + g * 0.6);
    c.t += dt * tempo;
    // folds travel away from the wind's side (and slowly down); the rate changes, the phase never jumps
    [0.55, 0.83, 0.37].forEach((w, i) => { c.ph[i] += dt * tempo * w * (c.cx * 1.4 - 0.6); });
    if (glc.width < c.cw || glc.height < c.ch) { glc.width = Math.max(glc.width, c.cw); glc.height = Math.max(glc.height, c.ch); }
    gl.viewport(0, 0, c.cw, c.ch); gl.enable(gl.SCISSOR_TEST); gl.scissor(0, 0, c.cw, c.ch); gl.clear(gl.COLOR_BUFFER_BIT); gl.disable(gl.SCISSOR_TEST);
    gl.bindTexture(gl.TEXTURE_2D, c.tex);
    gl.uniform2f(U.S, c.w, c.h); gl.uniform1f(U.O, c.o);
    gl.uniform4f(U.F, CURTAIN.angle * Math.PI / 180, CURTAIN.waves, CURTAIN.amp * c.w, CURTAIN.edgeBillow * c.w);
    gl.uniform4f(U.Q, CURTAIN.light, CURTAIN.sheen, 0, 0);
    gl.uniform4f(U.T, c.t, c.k, c.cx, g); gl.uniform3f(U.P, c.ph[0], c.ph[1], c.ph[2]);
    gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
    // the frame sits in the bottom-left corner of the shared target; copied in the same task as the draw
    c.ctx.clearRect(0, 0, c.cw, c.ch); c.ctx.drawImage(glc, 0, glc.height - c.ch, c.cw, c.ch, 0, 0, c.cw, c.ch);
    // the canvas follows the photo on screen (scroll, parallax, the depth tilt)
    const r = c.im.getBoundingClientRect(), s2 = r.width / c.w || 1;
    c.cv.style.transform = 'translate(' + (r.left - c.o * s2).toFixed(1) + 'px,' + (r.top - c.o * s2).toFixed(1) + 'px) scale(' + s2.toFixed(4) + ')';
    if (!c.on) { c.on = true; document.body.appendChild(c.cv); c.im.classList.add('fx-linen-src'); }   // swap in the same frame
  };
  const stop = (c) => { c.on = false; c.cv.remove(); c.im.classList.remove('fx-linen-src'); c.k = c.kt = 0; c.g = c.gt = c.gv = c.vx = 0; };
  let loop = 0, last = 0;
  const frame = (now) => {
    loop = 0;
    if (document.hidden) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
    let any = false;
    inst.forEach((c) => {
      if (!c.on && c.kt === 0) return;
      draw(c, dt);
      if (c.kt === 0 && c.k < 0.003) stop(c); else any = true;
    });
    if (any) loop = requestAnimationFrame(frame); else last = 0;
  };
  const wake = () => { if (!loop) loop = requestAnimationFrame(frame); };

  // one listener for the page: the photo under the pointer (by its box on screen) gets the breeze
  const side = (e, r) => Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width * 2 - 1) * 1.6));
  let curIm = null;
  const onMove = (e) => {
    let hit = null, hr = null;
    for (const im of imgs) {
      const r = im.getBoundingClientRect();
      if (r.width && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) { hit = im; hr = r; }
    }
    if (curIm && curIm !== hit) { const o = inst.get(curIm); if (o) { o.kt = 0; o.lx = null; } wake(); }   // the one left settles on its own
    curIm = hit;
    if (!hit) return;
    const c = prepare(hit);
    if (!c) return;
    c.tcx = side(e, hr);   // the wind blows from the pointer's side; moving the pointer stirs it
    if (c.lx !== null) c.gt = Math.min(1, c.gt + Math.abs(e.clientX - c.lx) / 400);
    c.lx = e.clientX;
    if (c.kt === 0) {
      if (!c.on) { c.cx = c.tcx; c.vx = 0; }
      c.kt = 1;
      draw(c, 1 / 60);   // the first displaced frame right now, in the pointer event, not one frame later
    }
    wake();
  };
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    onMove(e);
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { if (curIm) { const o = inst.get(curIm); if (o) o.kt = 0; curIm = null; wake(); } });
  const reset = () => inst.forEach((c) => { if (c.on) stop(c); c.w = 0; });   // sizes change: textures are re-made on next use
  addEventListener('resize', reset);
  addEventListener('pageswap', () => inst.forEach((c) => { if (c.on) stop(c); }));
})();
