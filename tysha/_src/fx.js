/* TYSHA — experimental effects, loaded by site.js only with ?fx=depth (kept for the tab in sessionStorage).
   1. Quiet depth: sections tilt a few degrees as they enter and leave the viewport, like heavy monograph pages;
      whatever is at the middle of the screen is flat. Transform only, geometry cached, rAF only while scrolling.
   2. Linen: a photo under the pointer bends like a sheet of linen (a soft bulge, faint wrinkles that follow the
      pointer, light on the folds) and settles slowly when the pointer leaves. ONE WebGL canvas, lent to the photo
      under the pointer; nothing runs while no photo is hovered.
   Desktop / tablet with a fine pointer only; prefers-reduced-motion turns both off. */
(() => {
  'use strict';

  /* ---------- tuning knobs ---------- */
  const DEPTH = {
    maxTilt: 4,          // deg, at the very edge of the screen
    minScale: 0.97,      // scale at the very edge
    perspective: 1800,   // px
    zone: 0.5,           // share of the viewport height over which a section tilts (from the centre line to the edge)
  };
  const LINEN = {
    bulge: 7,            // px: how far the photo swells under the pointer (UV push of the bulge)
    radius: 0.28,        // bulge radius, share of the photo's shorter side
    wrinkle: 2.0,        // px: wrinkle displacement at full pointer speed
    wrinkleFreq: 0.075,  // wrinkles per px (about 13 px apart)
    light: 0.14,         // how much the folds catch light (0 = no shading)
    springIn: 9,         // stiffness while hovering (higher = snappier)
    settle: 1.2,         // s: the sheet settles after the pointer leaves
    minSize: 180,        // px: smaller photos stay plain
    sharpen: 0.45,       // matches the canvas to the crisper <img> it stands in for
  };

  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ON = matchMedia('(min-width: 761px) and (pointer: fine)').matches;
  if (RM || !ON) return;
  const clamp = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const ease = (x) => x * x * (3 - 2 * x);

  /* ---------- 1. quiet depth ---------- */
  // pinned scenes (sticky inside) and anything holding a fixed child would break under a transform: left out
  const secs = Array.from(document.querySelectorAll('main > section')).filter((s) => !s.matches('[data-pin]') && !s.querySelector('[data-pin-inner]'));
  const geo = new Map();
  const docTop = (el) => { let y = 0; for (let e = el; e; e = e.offsetParent) y += e.offsetTop; return y; };   // unaffected by transforms
  const measure = () => { secs.forEach((s) => geo.set(s, { top: docTop(s), h: s.offsetHeight })); };
  let raf = 0, idle = 0;
  const apply = () => {
    raf = 0;
    const y = window.scrollY, H = window.innerHeight, Z = H * DEPTH.zone, mid = H / 2;
    let moving = false;
    for (const s of secs) {
      const g = geo.get(s); if (!g) continue;
      const top = g.top - y, bot = top + g.h;
      const pin = clamp((top - mid) / Z);   // its top is below the centre line: coming in, the far (bottom) side recedes
      const pout = clamp((mid - bot) / Z);  // its bottom is above the centre line: going out, the top recedes
      if (bot < -40 || top > H + 40 || (!pin && !pout)) {
        if (s.style.transform) { s.style.transform = ''; s.style.transformOrigin = ''; s.style.willChange = ''; }
        continue;
      }
      const k = pin ? ease(pin) : ease(pout);
      const deg = (pin ? -1 : 1) * DEPTH.maxTilt * k;
      const sc = 1 - (1 - DEPTH.minScale) * k;
      s.style.willChange = 'transform';
      s.style.transformOrigin = pin ? '50% 0' : '50% 100%';
      s.style.transform = 'perspective(' + DEPTH.perspective + 'px) rotateX(' + deg.toFixed(3) + 'deg) scale(' + sc.toFixed(4) + ')';
      moving = true;
    }
    return moving;
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(apply); };
  measure(); apply();
  addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', () => { measure(); kick(); });
  addEventListener('load', () => { measure(); kick(); });
  if (window.ResizeObserver) new ResizeObserver(() => { clearTimeout(idle); idle = setTimeout(() => { measure(); kick(); }, 120); }).observe(document.body);
  // a page transition captures flat pages: the shared photo and title morph from where they really are
  addEventListener('pageswap', () => { secs.forEach((s) => { s.style.transform = ''; s.style.willChange = ''; }); });

  /* ---------- 2. linen photos ---------- */
  const cv = document.createElement('canvas');
  cv.className = 'fx-linen'; cv.setAttribute('aria-hidden', 'true');
  const gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, powerPreference: 'low-power' });
  if (!gl) return;   // no WebGL: plain photos
  // like live.js: a software rasteriser (every frame on the CPU) keeps the photos plain; ?live=force tests anyway
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const rend = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
  if (/swiftshader|llvmpipe|softpipe|software rasterizer|microsoft basic render/i.test(rend) && !/[?&]live=force\b/.test(location.search)) return;
  const VS = 'attribute vec2 a;varying vec2 v;void main(){v=vec2(a.x*.5+.5,.5-a.y*.5);gl_Position=vec4(a,0,1);}';
  // S: size px; P: pointer px; C: cover crop (offset, scale); K: x bulge strength 0-1, y wrinkle amount 0-1, z time,
  // w radius px; D: wrinkle direction; L: x bulge px, y wrinkle px, z wrinkles per px, w light
  const FS = 'precision highp float;uniform sampler2D I;uniform vec2 S,P,D,X;uniform vec4 C,K,L;varying vec2 v;'
    + 'void main(){vec2 q=v*S,d=q-P;float s=K.w,r2=dot(d,d),g=exp(-r2/(s*s)),en=exp(-r2/(s*s*.55));'
    + 'float ph=dot(d,D)*L.z*6.2832+K.z*1.3;'
    // displacement in px: the bulge pushes the picture outwards from the pointer, wrinkles shift it along the motion
    + 'vec2 o=-d/s*g*K.x*L.x*1.65+D*sin(ph)*en*K.y*L.y;'
    + 'vec2 u=C.xy+clamp((q+o)/S,0.,1.)*C.zw;vec3 c=texture2D(I,u).rgb;'
    // a touch of sharpening: the browser's own image scaler is a little crisper than a texture lookup
    + 'vec3 bl=(texture2D(I,u+vec2(X.x,0.))+texture2D(I,u-vec2(X.x,0.))+texture2D(I,u+vec2(0.,X.y))+texture2D(I,u-vec2(0.,X.y))).rgb*.25;c+=(c-bl)*' + LINEN.sharpen.toFixed(2) + ';'
    // light on the folds: slope of the surface -> normal -> a soft key light from the top left
    + 'vec2 sl=-.5*d/s*g*K.x+D*cos(ph)*en*K.y*.35;'
    + 'vec3 n=normalize(vec3(-sl,1.)),Ln=normalize(vec3(-.45,-.6,1.));'
    + 'c*=1.+L.w*(dot(n,Ln)-Ln.z)*4.;gl_FragColor=vec4(c,1.);}';
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
  gl.useProgram(pr);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const al = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(al); gl.vertexAttribPointer(al, 2, gl.FLOAT, false, 0, 0);
  const U = {}; ['I', 'S', 'P', 'D', 'C', 'K', 'L', 'X'].forEach((k) => { U[k] = gl.getUniformLocation(pr, k); });
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]].forEach(([k, v]) => gl.texParameteri(gl.TEXTURE_2D, k, v));
  gl.uniform1i(U.I, 0);

  // photos that take part: cards, the projects index, case galleries; never the hero, the day frames, the
  // statement, the contact photo or the modal
  const SKIP = '[data-hero], [data-pin], #contact, dialog, .st-layer, .foot-wm';
  const imgs = Array.from(document.querySelectorAll('main img')).filter((im) => !im.closest(SKIP));
  let cur = null;   // the photo that holds the canvas
  const st = { x: 0, y: 0, tx: 0, ty: 0, k: 0, kt: 0, w: 0, dx: 1, dy: 0, t: 0, last: 0 };
  let loop = 0;

  // the texture is the visible crop of the photo at exactly the canvas's pixel size, scaled by the browser's own
  // high-quality resampler: at rest the canvas matches the <img> pixel for pixel, so taking over shows no seam
  const crop = (im, cw, ch) => {
    const w = im.offsetWidth, h = im.offsetHeight, nw = im.naturalWidth, nh = im.naturalHeight;
    const s = Math.max(w / nw, h / nh), sw = w / s;
    const op = getComputedStyle(im).objectPosition.split(' ').map((x) => (/%$/.test(x) ? parseFloat(x) / 100 : 0.5));
    // step 1: the whole photo at the drawn scale (a source rectangle on a srcset <img> is not reliable across
    // browsers); step 2: cut the visible part out of that
    const k = cw / sw, full = document.createElement('canvas');
    full.width = Math.round(nw * k); full.height = Math.round(nh * k);
    const f = full.getContext('2d'); f.imageSmoothingQuality = 'high'; f.drawImage(im, 0, 0, full.width, full.height);
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    c.getContext('2d').drawImage(full, -Math.round((full.width - cw) * op[0]), -Math.round((full.height - ch) * (op[1] === undefined ? 0.5 : op[1])));
    return c;
  };
  const place = () => {
    const im = cur, w = im.offsetWidth, h = im.offsetHeight, d = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(w * d); cv.height = Math.round(h * d);
    Object.assign(cv.style, { left: im.offsetLeft + 'px', top: im.offsetTop + 'px', width: w + 'px', height: h + 'px' });
    gl.viewport(0, 0, cv.width, cv.height);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, crop(im, cv.width, cv.height));
    gl.uniform4f(U.C, 0, 0, 1, 1); gl.uniform2f(U.X, 1 / cv.width, 1 / cv.height);
    gl.uniform2f(U.S, w, h);
    gl.uniform4f(U.L, LINEN.bulge, LINEN.wrinkle, LINEN.wrinkleFreq, LINEN.light);
    st.r = LINEN.radius * Math.min(w, h);
  };
  const attach = (im) => {
    if (cur === im) return;
    detach();
    if (!im.complete || !im.naturalWidth || im.offsetWidth < LINEN.minSize) return;
    cur = im;
    (im.parentElement.tagName === 'PICTURE' ? im.parentElement : im).after(cv);
    try { place(); } catch (e) { cv.remove(); cur = null; return; }
    im.classList.add('fx-linen-src');
  };
  const detach = () => { if (!cur) return; cur.classList.remove('fx-linen-src'); cv.remove(); cur = null; st.k = st.kt = st.w = 0; };

  const frame = (now) => {
    loop = 0;
    if (!cur) return;
    const dt = Math.min(0.05, st.last ? (now - st.last) / 1000 : 0.016); st.last = now; st.t += dt;
    // springs: towards the pointer quickly while it is there, back to flat over LINEN.settle after it leaves
    const rate = st.kt > 0 ? LINEN.springIn : 4.6 / LINEN.settle;
    st.k += (st.kt - st.k) * (1 - Math.exp(-rate * dt));
    st.x += (st.tx - st.x) * (1 - Math.exp(-LINEN.springIn * dt));
    st.y += (st.ty - st.y) * (1 - Math.exp(-LINEN.springIn * dt));
    st.w *= Math.exp(-2.2 * dt);   // wrinkles fade when the pointer stops
    cv.style.transform = cur.style.transform;
    gl.uniform2f(U.P, st.x, st.y); gl.uniform2f(U.D, st.dx, st.dy);
    gl.uniform4f(U.K, st.k, Math.min(1, st.w) * st.k, st.t, st.r);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (st.kt === 0 && st.k < 0.004) { detach(); return; }
    loop = requestAnimationFrame(frame);
  };
  const wake = () => { if (!loop) { st.last = 0; loop = requestAnimationFrame(frame); } };

  imgs.forEach((im) => {
    // the pointer usually lands on a card's label or the canvas, not the <img>: track the photo's own box
    const box = im.closest('a, article, figure, li') || im.parentElement;
    let lx = 0, ly = 0;
    const move = (e) => {
      const r = im.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      const inside = x >= 0 && y >= 0 && x <= r.width && y <= r.height;
      if (!inside) { if (cur === im) st.kt = 0; wake(); return; }
      if (cur !== im) { attach(im); if (cur !== im) return; st.x = x; st.y = y; }
      const sx = r.width / im.offsetWidth || 1;   // scroll zoom / parallax may scale the box
      st.tx = x / sx; st.ty = y / sx; st.kt = 1;
      const vx = e.clientX - lx, vy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
      const sp = Math.hypot(vx, vy);
      if (sp > 0.5) { st.dx = vx / sp; st.dy = vy / sp; st.w = Math.min(1.2, st.w + sp / 60); }
      wake();
    };
    box.addEventListener('pointermove', move, { passive: true });
    box.addEventListener('pointerleave', () => { if (cur === im) { st.kt = 0; wake(); } });
  });
  addEventListener('resize', () => { if (cur) place(); });
  addEventListener('pageswap', detach);
})();
