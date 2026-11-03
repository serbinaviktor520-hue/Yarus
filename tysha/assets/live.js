/* TYSHA — living photos: one subtle element of a still comes alive while on screen (plain WebGL).
   Masks img/<name>-live.png (_tools/live_masks.py): R water, G drift, B glow. Without WebGL, under
   reduced motion or Save-Data the <picture> simply stays still. */
(() => {
  'use strict';
  const T = window.TYSHA || {};
  const n = navigator.connection;
  // ?live=debug logs every decision to the console; ?live=force also runs on a software rasteriser (testing only)
  const DEBUG = /[?&]live=(debug|force)\b/.test(location.search);
  const log = (...a) => { if (DEBUG) console.info('[live]', ...a); };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { log('off: prefers-reduced-motion'); return; }
  if (n && n.saveData) { log('off: Save-Data'); return; }
  const BASE = new URL('../', document.currentScript.src).href;
  const FORCE = /[?&]live=force\b/.test(location.search);   // testing: run even on a software rasteriser, no watchdog
  // [ripple px, shimmer, drift px, glow, drift freq, drift speed]
  const FX = {
    h08: [1.6, 0.06, 0, 0, 0, 0], h08m: [1.6, 0.06, 0, 0, 0, 0],
    g15: [0, 0, 10, 0, 5, 0.2], // 06:10 mist over the lake
    h03: [0, 0, 4, 0, 16, 0.42], // 09:00 caustics on the ceiling
    h06: [0.8, 0.05, 0, 0, 0, 0], // 19:00 the evening lake in the window
    h09: [1.1, 0.16, 0, 0, 0, 0], // 23:40 the moon on the water
    g09: [0.9, 0.03, 3, 0, 30, 0.9], // blue hour: mist on the water (R), chimney smoke (G)
  };
  const VS = 'attribute vec2 a;varying vec2 v;void main(){v=vec2(a.x*.5+.5,.5-a.y*.5);gl_Position=vec4(a,0,1);}';
  const FS = 'precision mediump float;uniform sampler2D I,M;uniform float t;uniform vec2 R,Q;uniform vec4 C,P;varying vec2 v;'
    + 'void main(){vec2 u=C.xy+v*C.zw,p=1./R;vec3 m=texture2D(M,u).rgb;'
    + 'float w=sin(u.y*R.y*.11+t*1.1+sin(u.x*7.+t*.3)*2.)+.5*sin(u.y*R.y*.037-t*.8+u.x*4.);'
    + 'vec2 o=vec2(w*P.x*p.x,sin(u.x*R.x*.013+t*.6)*P.x*.3*p.y)*m.r;'
    + 'float d=sin(u.y*Q.x+t*Q.y+sin(u.x*Q.x*.5-t*Q.y*.6))+.5*sin(u.x*Q.x*.7-t*Q.y*.8);'
    + 'o+=vec2(d,.3*cos(u.x*Q.x*.8+t*Q.y*.9))*P.z*p*m.g;'
    + 'vec3 c=texture2D(I,u+o).rgb;float l=dot(c,vec3(.3,.6,.1));'
    + 'c*=1.+P.y*m.r*smoothstep(.3,.85,l)*sin(u.x*R.x*.3+u.y*R.y*.8-t*2.4)*sin(u.y*R.y*.19+t*1.5);'
    + 'c*=1.+P.w*m.b*(.55+.45*sin(t*.85))*(.75+.25*sin(t*.31));gl_FragColor=vec4(c,1);}';

  // only a definitive software rasteriser (every frame drawn on the CPU) keeps the photos still; an unknown or
  // masked renderer string counts as a GPU
  const renderer = (gl) => {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '(masked)';
  };
  const software = (r) => /swiftshader|llvmpipe|softpipe|software rasterizer|microsoft basic render/i.test(r);
  // WebGL 1 has no mipmaps for these sizes: a photo much larger than its canvas would alias (shimmering branches).
  // Upload a copy the browser has scaled down with high quality, about the size it is drawn at; the crop maths only
  // uses the aspect ratio, so the framing is unchanged
  const fit = (im) => {
    const want = Math.max(im.clientWidth, im.clientHeight * im.naturalWidth / im.naturalHeight) * Math.min(2, window.devicePixelRatio || 1) * 1.25;
    if (im.naturalWidth <= want * 1.5) return im;
    const c = document.createElement('canvas'); c.width = Math.round(want); c.height = Math.round(want * im.naturalHeight / im.naturalWidth);
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, c.width, c.height);
    return c;
  };
  const slotOf = (im) => { const m = (im.currentSrc || im.src).match(/img\/(\w+?)-\d+\./); return m && m[1]; };
  const loadImg = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });

  function Live(after, imgs) {
    const cv = document.createElement('canvas');
    cv.className = 'fill live-c'; cv.setAttribute('aria-hidden', 'true');
    after.after(cv);   // above the photo, under shade and text
    const gl = cv.getContext('webgl', { alpha: false, antialias: false, depth: false, powerPreference: 'low-power' });
    if (!gl) { log('off: no WebGL'); cv.remove(); return null; }
    const rn = renderer(gl);
    if (software(rn) && !FORCE) { log('off: software renderer', rn); cv.remove(); return null; }
    log('on:', rn);
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { cv.remove(); return null; }
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const U = {}; ['I', 'M', 't', 'R', 'Q', 'C', 'P'].forEach((k) => { U[k] = gl.getUniformLocation(pr, k); });
    const tex = (unit) => { const x = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, x); [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach((p) => gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE)); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); return x; };
    const tI = tex(0), tM = tex(1);
    gl.uniform1i(U.I, 0); gl.uniform1i(U.M, 1);
    const L = { cv, imgs, img: null, on: false, ready: false, t0: performance.now() };
    let token = 0;
    L.use = async (im) => {
      const k = ++token; const slot = im && slotOf(im); const fx = slot && FX[slot];
      L.ready = false; cv.classList.remove('on');
      if (!fx) { L.img = null; return; }
      try {
        if (!im.complete || im.naturalWidth < 3) await new Promise((ok) => im.addEventListener('load', ok, { once: true }));
        if (im.decode) await im.decode();
        // the mask changes with its photo: reuse the photo's ?v= so a new photo never gets a cached old mask
        const v = ((im.currentSrc || im.src).match(/\?v=(\w+)/) || [])[1];
        const mask = await loadImg(BASE + 'img/' + slot + '-live.png' + (v ? '?v=' + v : ''));
        if (k !== token) return;
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tI); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, fit(im));
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tM); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, mask);
        L.img = im; L.fx = fx; L.nw = im.naturalWidth; L.nh = im.naturalHeight; L.size();
        L.ready = true; L.draw(performance.now()); wake();
        requestAnimationFrame(() => { if (k === token) cv.classList.add('on'); });
      } catch (e) { /* stay a still photo */ }
    };
    L.size = () => {
      const im = L.img; if (!im) return;
      const w = im.clientWidth, h = im.clientHeight; if (!w || !h) return;
      const d = Math.min(2, window.devicePixelRatio || 1) * quality;
      cv.width = Math.round(w * d); cv.height = Math.round(h * d);
      Object.assign(cv.style, { top: im.offsetTop + 'px', left: im.offsetLeft + 'px', width: w + 'px', height: h + 'px', right: 'auto', bottom: 'auto', transformOrigin: getComputedStyle(im).transformOrigin });
      gl.viewport(0, 0, cv.width, cv.height);
      const s = Math.max(w / L.nw, h / L.nh), zw = w / s / L.nw, zh = h / s / L.nh;
      const op = getComputedStyle(im).objectPosition.split(' ').map((x) => (/%$/.test(x) ? parseFloat(x) / 100 : 0.5));
      gl.uniform4f(U.C, op[0] * (1 - zw), (op[1] === undefined ? 0.5 : op[1]) * (1 - zh), zw, zh);
      gl.uniform2f(U.R, 2560, 2560 * L.nh / L.nw);   // sizes in px of a 2560 px frame
    };
    L.draw = (now) => {
      if (!L.ready) return;
      const f = L.fx;
      cv.style.transform = L.img.style.transform;
      gl.uniform1f(U.t, (now - L.t0) / 1000);
      gl.uniform4f(U.P, f[0], f[1], f[2], f[3]); gl.uniform2f(U.Q, f[4], f[5]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    cv.addEventListener('webglcontextlost', () => { L.ready = false; cv.remove(); L.dead = true; });
    return L;
  }

  const lives = [];
  let raf = 0, last = 0;
  // Frame-rate check, only while the page is calm: it starts 2.5 s after the effect does (the preloader, fonts and
  // decodes are over by then), skips anything near a scroll, resize or hidden tab, and judges 2 s windows. A slow
  // window first halves the canvas resolution; only a second slow window at half resolution stops the effect.
  let quality = 1, prev = 0, wStart = 0, wFrames = 0, calmAfter = 0, strikes = 0;
  const unsettle = () => { calmAfter = performance.now() + 400; wStart = 0; };
  ['scroll', 'wheel', 'resize', 'touchmove'].forEach((e) => window.addEventListener(e, unsettle, { passive: true }));
  const judge = (now) => {
    if (FORCE || document.hidden || now < calmAfter) { wStart = 0; return; }
    if (!wStart) { wStart = now; wFrames = 0; return; }
    wFrames++;
    if (now - wStart < 2000) return;
    const fps = wFrames * 1000 / (now - wStart); wStart = 0;
    if (fps >= 20) { log('fps ' + fps.toFixed(0) + ', resolution x' + quality); return; }
    strikes++;
    if (quality > 0.5) { quality = 0.5; lives.forEach((L) => { L.size(); }); log('fps ' + fps.toFixed(0) + ': half resolution'); }
    else if (strikes >= 2) { log('fps ' + fps.toFixed(0) + ' at half resolution: stopped'); lives.forEach((L) => { L.dead = true; L.cv.remove(); }); }
  };
  const loop = (now) => {
    raf = 0;
    const act = lives.filter((L) => L.on && L.ready && !L.dead);
    if (!act.length) { prev = 0; return; }
    if (prev) judge(now);
    prev = now;
    if (now - last > 30) { last = now; act.forEach((L) => L.draw(now)); }
    raf = requestAnimationFrame(loop);
  };
  const wake = () => { if (!raf) { prev = 0; wStart = 0; raf = requestAnimationFrame(loop); } };

  function add(host, after, imgs, pick) {
    const L = Live(after, imgs); if (!L) return null;
    lives.push(L);
    new IntersectionObserver((es) => { L.on = es[es.length - 1].isIntersecting; if (L.on) { if (!L.img && !L.tried) { L.tried = true; L.use(pick()); } wake(); } }).observe(host);
    if (window.ResizeObserver) new ResizeObserver(() => { L.size(); L.draw(performance.now()); }).observe(imgs[0]);
    return L;
  }

  function init() {
    calmAfter = performance.now() + 2500;
    log('init');
    const hero = document.querySelector('[data-hero-img]');
    if (hero && FX[slotOf(hero) || '']) add(hero.closest('[data-hero]'), hero.parentElement, [hero], () => hero);
    const contact = document.querySelector('#contact [data-zoom]');
    if (contact) add(contact.closest('section'), contact.parentElement, [contact], () => contact);
    const dayImgs = Array.from(document.querySelectorAll('[data-day-img]'));
    if (dayImgs.length) {
      const pick = () => dayImgs.find((im) => im.classList.contains('on'));
      const L = add(dayImgs[0].closest('.fill'), dayImgs[dayImgs.length - 1].parentElement, dayImgs, pick);
      // new hour: hide now, show again after the cross-fade
      let tm = 0;
      if (L) document.addEventListener('tysha:day', () => { L.ready = false; L.cv.classList.remove('on'); clearTimeout(tm); tm = setTimeout(() => L.use(pick()), 900); });
    }
  }
  const go = () => (window.requestIdleCallback ? requestIdleCallback(init, { timeout: 2500 }) : setTimeout(init, 300));
  if (T.started) go(); else document.addEventListener('tysha:ready', go, { once: true });
})();
