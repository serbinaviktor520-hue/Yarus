/* TYSHA — experimental effects, loaded by site.js only with ?fx=depth (kept for the tab in sessionStorage).
   1. Quiet depth: the boundary between two sections is a soft hinge. As it travels up the screen the incoming
      section's far edge and the outgoing section's far edge lean back a few degrees, eased over the whole viewport
      (a sine), symmetric for entering and leaving. Transform only, geometry cached, rAF only while scrolling.
   2. Curtain (hover only): at rest a photo is the plain <img>. Under the pointer it becomes silk hanging from its top
      edge in a breeze that blows from the pointer's side: long diagonal folds travel across and down the cloth, the
      print rides on them, the far edge billows out past the box and the near edge pulls in. A subdivided mesh in
      perspective, lit from the folds' analytic normals. On leave it relaxes flat and hands back to the <img>.
      ONE WebGL canvas (fixed, over the page, so the billow is not clipped), lent to the hovered photo.
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
  const cv = document.createElement('canvas');
  cv.className = 'fx-curtain'; cv.setAttribute('aria-hidden', 'true');
  const gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true, depth: false, powerPreference: 'low-power' });
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
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]].forEach(([k2, v]) => gl.texParameteri(gl.TEXTURE_2D, k2, v));

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
  let cur = null, loop = 0, last = 0;
  // wind: a critically damped spring on its side (cx) and strength; the folds' phases accumulate over time
  const st = { k: 0, kt: 0, cx: 0, vx: 0, tcx: 0, g: 0, gt: 0, gv: 0, t: 0, ph: [0, 1.9, 4.1], w: 0, h: 0, o: 0, d: 1 };
  const attach = (im) => {
    if (cur === im) return true;
    detach();
    if (!im.complete || !im.naturalWidth || im.offsetWidth < CURTAIN.minSize || (im.classList.contains('rv-img') && !im.classList.contains('in'))) return false;
    const w = im.offsetWidth, h = im.offsetHeight, d = Math.min(2, devicePixelRatio || 1), o = Math.round(Math.max(w, h) * CURTAIN.overscan);
    cv.width = Math.round((w + 2 * o) * d); cv.height = Math.round((h + 2 * o) * d);
    Object.assign(cv.style, { width: (w + 2 * o) + 'px', height: (h + 2 * o) + 'px' });
    gl.viewport(0, 0, cv.width, cv.height);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, crop(im, Math.round(w * d), Math.round(h * d))); } catch (e) { return false; }
    gl.uniform2f(U.S, w, h); gl.uniform1f(U.O, o);
    gl.uniform4f(U.F, CURTAIN.angle * Math.PI / 180, CURTAIN.waves, CURTAIN.amp * w, CURTAIN.edgeBillow * w);
    gl.uniform4f(U.Q, CURTAIN.light, CURTAIN.sheen, 0, 0);
    document.body.appendChild(cv);
    cur = im; Object.assign(st, { w, h, o, d, k: 0, g: 0, gt: 0, gv: 0, vx: 0 });
    return true;
  };
  const detach = () => { if (!cur) return; cur.classList.remove('fx-linen-src'); cv.remove(); cur = null; st.k = st.kt = 0; };

  const frame = (now) => {
    loop = 0;
    if (!cur || document.hidden) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
    st.k += (st.kt - st.k) * (1 - Math.exp(-dt * 4.6 / (st.kt > 0 ? CURTAIN.hoverIn : CURTAIN.settle)));
    // critically damped springs: no overshoot, no jumps, whatever the pointer does
    const sp = (x, v, to, w) => { const a = w * w * (to - x) - 2 * w * v; v += a * dt; return [x + v * dt, v]; };
    [st.cx, st.vx] = sp(st.cx, st.vx, st.tcx, CURTAIN.lag);
    st.gt *= Math.exp(-dt * 1.2);
    [st.g, st.gv] = sp(st.g, st.gv, st.gt, 3);
    const g = Math.max(0, st.g), tempo = CURTAIN.speed * (1 + g * 0.6);
    st.t += dt * tempo;
    // folds travel away from the wind's side (and slowly down); the rate changes, the phase never jumps
    [0.55, 0.83, 0.37].forEach((w, i) => { st.ph[i] += dt * tempo * w * (st.cx * 1.4 - 0.6); });
    // the canvas follows the photo on screen (scroll, parallax, the depth tilt)
    const r = cur.getBoundingClientRect(), s = r.width / st.w || 1;
    cv.style.transform = 'translate(' + (r.left - st.o * s).toFixed(1) + 'px,' + (r.top - st.o * s).toFixed(1) + 'px) scale(' + s.toFixed(4) + ')';
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform4f(U.T, st.t, st.k * st.k * (3 - 2 * st.k), st.cx, Math.max(0, st.g)); gl.uniform3f(U.P, st.ph[0], st.ph[1], st.ph[2]);
    gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
    if (!cur.classList.contains('fx-linen-src')) cur.classList.add('fx-linen-src');   // swap once a frame is drawn
    if (st.kt === 0 && st.k < 0.003) { detach(); if (lastE) onMove(lastE); return; }   // the pointer may already be on the next photo
    loop = requestAnimationFrame(frame);
  };
  const wake = () => { if (!loop) { last = 0; loop = requestAnimationFrame(frame); } };

  // one listener for the page: the photo under the pointer (by its box on screen) gets the curtain
  const imgs = Array.from(document.querySelectorAll('main img')).filter((im) => !im.closest(SKIP));
  let lx = null;
  const side = (e, r) => Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width * 2 - 1) * 1.6));
  let lastE = null;
  const onMove = (e) => {
    let hit = null, hr = null;
    for (const im of imgs) {
      const r = im.getBoundingClientRect();
      if (r.width && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom && r.width >= CURTAIN.minSize) { hit = im; hr = r; }
    }
    if (!hit) { lx = null; if (cur) { st.kt = 0; wake(); } return; }
    // one canvas: a photo still settling finishes first (never a pop), then the next one starts
    if (cur && cur !== hit) { st.kt = 0; lx = null; wake(); return; }
    if (cur !== hit) { if (!attach(hit)) return; st.cx = st.tcx = side(e, hr); st.vx = 0; }
    st.tcx = side(e, hr);   // the wind blows from the pointer's side; moving the pointer stirs it
    if (lx !== null) st.gt = Math.min(1, st.gt + Math.abs(e.clientX - lx) / 400);   // pointer speed -> gust (smoothed by its spring)
    lx = e.clientX; st.kt = 1; wake();
  };
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    lastE = { clientX: e.clientX, clientY: e.clientY }; onMove(lastE);
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { lx = null; lastE = null; if (cur) { st.kt = 0; wake(); } });
  addEventListener('resize', detach);
  addEventListener('pageswap', detach);
})();
