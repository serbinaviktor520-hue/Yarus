/* TYSHA — experimental effects, loaded by site.js only with ?fx=depth (kept for the tab in sessionStorage).
   1. Quiet depth: the boundary between two sections is a soft hinge. As it travels up the screen the incoming
      section's far edge and the outgoing section's far edge lean back a few degrees, eased over the whole viewport
      (a sine), symmetric for entering and leaving. Transform only, geometry cached, rAF only while scrolling.
   2. Curtain (hover only): at rest a photo is the plain <img>. Under the pointer it becomes a linen curtain hanging
      from its top edge: one soft billow that follows the pointer sideways with a lag and breathes slowly; on leave
      it settles and hands back to the <img>. ONE WebGL canvas, lent to the hovered photo; nothing runs otherwise.
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
    folds: 1,            // folds across the photo while hovered (1 = one soft billow; a faint second rides at 15%)
    sway: 9,             // px of depth of the billow at the hem (the top edge never moves)
    swayX: 2,            // px of sideways drift at the hem
    period: 9,           // s: one slow breath of the billow while hovered
    hoverIn: 0.6,        // s: the billow grows in after the pointer arrives
    settle: 1.4,         // s: it settles after the pointer leaves, then the plain <img> takes over again
    lag: 2.2,            // how quickly the billow follows the pointer sideways (lower = lazier)
    light: 0.015,        // max brightness change on the fold (0.015 = +-1.5%)
    hem: 1.5,            // px: the bottom edge's silhouette waves by this much (0 = a straight cut)
    weave: 0,            // linen weave in the light (0 = off)
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

  /* ---------- 2. curtain photos (hover only) ---------- */
  const cv = document.createElement('canvas');
  cv.className = 'fx-linen'; cv.setAttribute('aria-hidden', 'true');
  const gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, powerPreference: 'low-power' });
  if (!gl) return;   // no WebGL: plain photos
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const rend = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
  if (/swiftshader|llvmpipe|softpipe|software rasterizer|microsoft basic render/i.test(rend) && !/[?&]live=force\b/.test(location.search)) return;

  const VS = 'attribute vec2 a;varying vec2 v;void main(){v=vec2(a.x*.5+.5,.5-a.y*.5);gl_Position=vec4(a,0,1);}';
  // S size px; X texel; T: x time, y strength 0-1, z billow centre px; A: sway px, swayX px, folds, period; L: light, hem px, weave
  const FS = 'precision highp float;uniform sampler2D I;uniform vec2 S,X;uniform vec3 T,L;uniform vec4 A;varying vec2 v;'
    + 'const float PI=3.14159;'
    + 'float zf(vec2 q){float yn=q.y/S.y,an=pow(yn,1.4),x=q.x/S.x,t=T.x*2.*PI/A.w,w=.9/max(A.z,1.);'
    + 'float b=exp(-pow((q.x-T.z)/(S.x*w*.5),2.))*(.78+.22*sin(t));'               // the billow around the pointer
    + 'float f=.15*sin(x*(A.z+1.)*2.*PI-t*.7+yn);'                                  // a very faint second fold
    + 'return an*T.y*A.x*(b+f);}'
    + 'void main(){vec2 q=v*S;float e=3.,z=zf(q);'
    + 'float zx=(zf(q+vec2(e,0.))-zf(q-vec2(e,0.)))/(2.*e),zy=(zf(q+vec2(0.,e))-zf(q-vec2(0.,e)))/(2.*e);'
    + 'float yn=q.y/S.y;vec2 o=vec2(A.y*T.y*pow(yn,1.4)*sin(T.x*2.*PI/A.w*.6)+z*.22,0.);'
    + 'vec2 u=clamp((q-o)/S,0.,1.);vec3 c=texture2D(I,u).rgb;'
    + 'vec3 bl=(texture2D(I,u+vec2(X.x,0.))+texture2D(I,u-vec2(X.x,0.))+texture2D(I,u+vec2(0.,X.y))+texture2D(I,u-vec2(0.,X.y))).rgb*.25;c+=(c-bl)*SHARP;'
    // soft window light: slope towards the light brightens, away darkens; capped at +-L.x, no creases
    + 'float sl=clamp((-zx*.8-zy*.4)*6./max(A.x,1.)*S.x*.05,-1.,1.);'
    + 'float wv=(sin(q.x*2.3)*sin(q.y*2.3))*L.z;'
    + 'c*=1.+L.x*sl+wv;'
    + 'float hy=S.y-L.y*T.y*(.6+.4*sin(q.x/S.x*2.*PI+T.x*2.*PI/A.w));'
    + 'float al=clamp(hy-q.y+.5,0.,1.);gl_FragColor=vec4(c*al,al);}';
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS.replace('SHARP', CURTAIN.sharpen.toFixed(2))));
  gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
  gl.useProgram(pr);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const al = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(al); gl.vertexAttribPointer(al, 2, gl.FLOAT, false, 0, 0);
  const U = {}; ['I', 'S', 'X', 'T', 'A', 'L'].forEach((k) => { U[k] = gl.getUniformLocation(pr, k); });
  gl.uniform1i(U.I, 0); gl.clearColor(0, 0, 0, 0);
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]].forEach(([k, v]) => gl.texParameteri(gl.TEXTURE_2D, k, v));

  // the visible crop of a photo at exactly the canvas size, scaled by the browser's own resampler (no seam)
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

  const SKIP = '[data-hero], [data-pin], #contact, dialog, .st-layer, .foot-wm';
  let cur = null, loop = 0, last = 0;
  const st = { k: 0, kt: 0, x: 0, tx: 0, t: 0, w: 0, h: 0 };
  const attach = (im) => {
    if (cur === im) return true;
    detach();
    if (!im.complete || !im.naturalWidth || im.offsetWidth < CURTAIN.minSize || (im.classList.contains('rv-img') && !im.classList.contains('in'))) return false;
    const w = im.offsetWidth, h = im.offsetHeight, d = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(w * d); cv.height = Math.round(h * d);
    Object.assign(cv.style, { left: im.offsetLeft + 'px', top: im.offsetTop + 'px', width: w + 'px', height: h + 'px' });
    gl.viewport(0, 0, cv.width, cv.height);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, crop(im, cv.width, cv.height)); } catch (e) { return false; }
    gl.uniform2f(U.S, w, h); gl.uniform2f(U.X, 1 / cv.width, 1 / cv.height);
    gl.uniform4f(U.A, CURTAIN.sway, CURTAIN.swayX, CURTAIN.folds, CURTAIN.period);
    gl.uniform3f(U.L, CURTAIN.light, CURTAIN.hem, CURTAIN.weave);
    (im.parentElement.tagName === 'PICTURE' ? im.parentElement : im).after(cv);
    cur = im; st.w = w; st.h = h; st.k = 0; st.t = 0;
    return true;
  };
  const detach = () => { if (!cur) return; cur.classList.remove('fx-linen-src'); cv.remove(); cur = null; st.k = st.kt = 0; };

  const frame = (now) => {
    loop = 0;
    if (!cur || document.hidden) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now; st.t += dt;
    st.k += (st.kt - st.k) * (1 - Math.exp(-dt * 4.6 / (st.kt > 0 ? CURTAIN.hoverIn : CURTAIN.settle)));
    st.x += (st.tx - st.x) * (1 - Math.exp(-dt * CURTAIN.lag));
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform3f(U.T, st.t, st.k, st.x);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    cv.style.transform = cur.style.transform;
    if (!cur.classList.contains('fx-linen-src')) cur.classList.add('fx-linen-src');   // swap only once a frame is drawn
    if (st.kt === 0 && st.k < 0.003) { detach(); return; }
    loop = requestAnimationFrame(frame);
  };
  const wake = () => { if (!loop) { last = 0; loop = requestAnimationFrame(frame); } };

  Array.from(document.querySelectorAll('main img')).filter((im) => !im.closest(SKIP)).forEach((im) => {
    const box = im.closest('a, article, figure, li') || im.parentElement;
    box.addEventListener('pointermove', (e) => {
      const r = im.getBoundingClientRect(), k = r.width / im.offsetWidth || 1;
      const x = (e.clientX - r.left) / k, y = (e.clientY - r.top) / k;
      const inside = x >= 0 && y >= 0 && x <= im.offsetWidth && y <= im.offsetHeight;
      if (!inside) { if (cur === im) { st.kt = 0; wake(); } return; }
      if (cur !== im) { if (!attach(im)) return; st.x = x; }
      st.tx = x; st.kt = 1; wake();
    }, { passive: true });
    box.addEventListener('pointerleave', () => { if (cur === im) { st.kt = 0; wake(); } });
  });
  addEventListener('resize', detach);
  addEventListener('pageswap', detach);
})();
