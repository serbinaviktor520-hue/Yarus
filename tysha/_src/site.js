/* TYSHA — shared behaviour
   1. scroll engine: reveals (IntersectionObserver), text scramble, count-ups, scroll-linked scenes
   2. dB badge and axis gaps
   3. contact form, footer clocks, mobile menu, privacy note
   Scroll-linked work reads geometry once (cached on resize / layout change) and only writes
   transform and opacity per frame. prefers-reduced-motion turns every movement into plain fades. */
(() => {
  'use strict';
  const BASE = new URL('../', document.currentScript.src).href;
  const AV = (document.currentScript.src.match(/\?v=\w+/) || [''])[0];   // the build's code version, for sound.js
  const T = window.TYSHA = window.TYSHA || {};
  const root = document.querySelector('[data-t-root]');
  const RM = window.matchMedia('(prefers-reduced-motion: reduce)');
  const q = (s, r = document) => r.querySelector(s);
  const qa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const GL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/·—';
  const FINE = window.matchMedia('(pointer: fine)');
  const PHONE = window.matchMedia('(max-width: 760px)');
  // effects (assets/fx.js): the depth scroll and the curtain on project cards. Desktop / tablet with a fine pointer,
  // never under reduced motion; ?fx=off turns them off for this tab (?fx=on back on). Loaded once the page is idle,
  // so they never compete with the first screen
  try {
    const fx = (location.search.match(/[?&]fx=(\w+)/) || [])[1];
    if (fx === 'off') sessionStorage.setItem('tysha-fx', 'off'); else if (fx) sessionStorage.removeItem('tysha-fx');
    if (sessionStorage.getItem('tysha-fx') !== 'off' && !RM.matches && matchMedia('(min-width: 761px) and (pointer: fine)').matches) {
      const go = () => { const s = document.createElement('script'); s.src = BASE + 'assets/fx.js' + AV; s.async = true; document.head.appendChild(s); };
      const later = () => (window.requestIdleCallback ? requestIdleCallback(go, { timeout: 2500 }) : setTimeout(go, 1200));
      if (document.readyState === 'complete') later(); else addEventListener('load', later, { once: true });
    }
  } catch (e) { /* no storage: no effects */ }
  T.reduced = () => RM.matches;

  /* ---------- 1. scroll engine ---------- */
  // a lazy photo: start it now, at low priority, and decode it off the main thread
  const warm = (im) => {
    if (im._warm) return; im._warm = true;
    if (im.loading === 'lazy') { im.fetchPriority = 'low'; im.loading = 'eager'; }
    if (im.decode) im.decode().catch(() => {});
  };
  // placeholder: each photo's own average colour (images.py) fills its box until the photo paints
  qa('img[data-tone]').forEach((im) => { im.style.backgroundColor = im.getAttribute('data-tone'); });

  function start() {
    if (T.started) return; T.started = true;
    const reduced = RM.matches;

    // reveal: headings and [data-rise] rows rise in; pending state lives in .rv
    // subpage heroes are on screen at load and arrive with the page transition: no second entrance (and no late paint)
    const pre = document.body.hasAttribute('data-preloader');
    const reveals = qa('h1, h2, h3, blockquote, [data-rise]', root).filter((el) => !el.closest('[data-st-layer]') && !el.classList.contains('sr-only') && (pre || !el.closest('[data-hero]')));
    reveals.forEach((el) => {
      const rise = el.hasAttribute('data-rise');
      const i = rise ? Array.from(el.parentElement.children).filter((c) => c.hasAttribute('data-rise')).indexOf(el) : 0;
      el._d = Math.max(0, i) * 0.09;
      if (el._d) el.style.setProperty('--d', el._d + 's');
      el.classList.add('rv'); if (!rise && !reduced) el.classList.add('rv-blur');
    });
    const imgs = qa('img', root).filter((im) => !im.closest('[data-noreveal]'));
    imgs.forEach((im) => im.classList.add('rv-img'));
    // the decode effect: only the small section labels (".sec-head" captions), briefly, as they enter; never in a hero,
    // never on project names or figures, never on anything the reader is about to read closely
    const scr = qa('.sec-head > span', root).filter((el) => !el.closest('[data-hero], [data-noscramble], [data-st-layer], .card, .case-next') && !el.hasAttribute('data-noscramble'));
    scr.forEach((el) => {
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); const nodes = []; let n;
      while ((n = w.nextNode())) if (n.nodeValue.trim() && !n.parentElement.closest('[data-noscramble]')) nodes.push({ n, o: n.nodeValue });
      el._tn = nodes; el.classList.add('rv-scr');
    });
    const counts = qa('[data-count]', root);
    const firstText = (el) => Array.from(el.childNodes).find((c) => c.nodeType === 3 && c.nodeValue.trim());
    if (!reduced) counts.forEach((el) => { const t = firstText(el); if (t) t.nodeValue = el.getAttribute('data-from') || '0'; });

    // one rAF loop for text animations (scramble, count-up)
    const active = []; let ticking = false;
    const tick = () => {
      const now = performance.now();
      for (let k = active.length - 1; k >= 0; k--) {
        const a = active[k]; const p = (now - a.t0) / a.dur;
        if (a.type === 's') {
          let gi = 0;
          a.parts.forEach((t) => {
            let out = '';
            for (let i = 0; i < t.o.length; i++, gi++) { const ch = t.o[i]; out += (ch === ' ' || p >= a.rev[gi]) ? ch : GL[(Math.random() * GL.length) | 0]; }
            t.vis.firstChild.nodeValue = out;
          });
          if (p >= 1) { finishScramble(a.el); }
        } else {
          a.n.nodeValue = String(Math.round(a.from + (a.to - a.from) * (1 - Math.pow(1 - clamp(p), 3))));
          if (p >= 1) active.splice(k, 1);
        }
      }
      if (active.length) requestAnimationFrame(tick); else ticking = false;
    };
    const run = (a) => { a.t0 = performance.now(); active.push(a); if (!ticking) { ticking = true; requestAnimationFrame(tick); } };

    // Scramble animates an aria-hidden copy; the real text stays in the DOM (visually hidden),
    // so screen readers and focus never meet the random glyphs.
    const scramble = (el) => {
      if (el._sc) return; el._sc = true;
      el.classList.add('in'); el.classList.remove('rv-scr');
      if (reduced || el.contains(document.activeElement)) return;
      const parts = el._tn.map((t) => {
        if (!t.n.parentNode) return null;
        const real = document.createElement('span'); real.className = 'sr-only'; real.textContent = t.o;
        const vis = document.createElement('span'); vis.setAttribute('aria-hidden', 'true'); vis.textContent = t.o;
        t.n.replaceWith(real, vis); return { o: t.o, n: t.n, real, vis };
      }).filter(Boolean);
      const len = parts.reduce((s, t) => s + t.o.length, 0) || 1;
      const rev = []; for (let i = 0; i < len; i++) rev.push((i / len) * 0.6 + Math.random() * 0.4);
      el._scr = { type: 's', el, parts, rev, dur: Math.min(400, 200 + len * 8) };
      run(el._scr);
    };
    const finishScramble = (el) => {
      const a = el._scr; if (!a) return; el._scr = null;
      a.parts.forEach((t) => { t.n.nodeValue = t.o; t.real.replaceWith(t.n); t.vis.remove(); });
      const k = active.indexOf(a); if (k >= 0) active.splice(k, 1);
    };
    const countUp = (el) => {
      if (el._ct) return; el._ct = true;
      const n = firstText(el); if (!n || reduced) return;
      run({ type: 'c', n, to: parseFloat(el.getAttribute('data-count')), from: parseFloat(el.getAttribute('data-from') || '0'), dur: 1700 });
    };
    const reveal = (el) => {
      if (el._rv) return; el._rv = true;
      el.classList.add('in');
      setTimeout(() => el.classList.remove('rv', 'rv-blur', 'in'), ((el._d || 0) + 1.5) * 1000);
    };
    // the clip opens only on a decoded photo; a photo that is not ready shows its tone instead, never an empty box
    const revealImg = (im) => {
      if (im._rv) return; im._rv = true;
      let went = false;
      const go = () => { if (went) return; went = true; im.classList.add('in'); setTimeout(() => im.classList.remove('rv-img', 'in', 'rv-wait'), 1500); };
      if (im.complete && im.naturalWidth) { go(); return; }
      // not here yet (a jump on a cold cache): open the box at once on the photo's tone, the photo replaces it
      warm(im); im.classList.add('rv-wait');
      im.addEventListener('load', () => (im.decode ? im.decode() : Promise.resolve()).then(go, go), { once: true });
      im.addEventListener('error', go, { once: true });
    };
    const watch = (els, margin, fn) => {
      const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); fn(e.target); } }), { rootMargin: margin });
      els.forEach((el) => io.observe(el));
    };
    // same trigger lines as before: 90% / 92% / 96% / 88% of the viewport height
    watch(reveals, '100px 0px -10% 0px', reveal);
    // an image hidden by its own clip-path never "intersects", so watch the box that holds it
    const holder = (im) => { const p = im.parentElement; return p.tagName === 'PICTURE' ? p.parentElement : p; };
    const byHolder = new Map(); imgs.forEach((im) => { const h = holder(im); byHolder.set(h, (byHolder.get(h) || []).concat(im)); });
    watch([...byHolder.keys()], '0px 0px 15% 0px', (h) => byHolder.get(h).forEach(revealImg));
    // Fetch and decode photos ~1.8 viewports before they arrive. Needed because a lazy <img> under the reveal's
    // clip-path: inset(100%) has no visible area, so the browser's own lazy loader would only start it on screen.
    const ahead = new Map();
    qa('img[loading="lazy"]', root).forEach((im) => { const h = holder(im); ahead.set(h, (ahead.get(h) || []).concat(im)); });
    watch([...ahead.keys()], '180% 0px 180% 0px', (h) => ahead.get(h).forEach(warm));
    watch(scr, '0px 0px -4% 0px', scramble);
    watch(counts, '0px 0px -12% 0px', countUp);

    // keyboard users: whatever receives focus is shown at once, never left at opacity 0 or scrambled
    document.addEventListener('focusin', (e) => {
      for (let el = e.target; el && el !== root; el = el.parentElement) {
        if (el.classList.contains('rv')) { el.classList.add('rv-now'); reveal(el); }
        if (el._tn) { scramble(el); finishScramble(el); }
      }
      qa('img.rv-img', e.target).forEach((im) => { im.classList.add('rv-now'); revealImg(im); });
      const st = e.target.closest && e.target.closest('[data-st-fade]');
      if (st && G.st) window.scrollTo({ top: G.st.top, behavior: 'instant' });
    });

    // ---- scroll-linked scenes ----
    const hero = q('[data-hero]', root), heroImg = q('[data-hero-img]', root), heroFade = qa('[data-hero-fade]', root), heroWm = q('[data-hero-wm]', root);
    const st = q('[data-pin="320"]', root);
    const stInner = st && q('[data-pin-inner]', st), stPill = q('[data-st-pill]', root), stLayer = q('[data-st-layer]', root), stLayerImg = q('[data-st-layer-img]', root), stOver = q('[data-st-over]', root), stFade = qa('[data-st-fade]', root), stBg = stLayer && q('.bg', stLayer);
    const day = q('[data-pin="400"]', root), dayBar = q('[data-day-bar]', root);
    const pano = q('[data-pano]', root), panoImg = q('[data-pano-img]', root);
    const marq = q('[data-marquee]', root), zoom = q('[data-zoom]', root);
    const floats = qa('[data-float]', root);

    let G = {}; let ih = window.innerHeight; let vw = window.innerWidth;
    const box = (el) => { const r = el.getBoundingClientRect(); return { top: r.top + window.scrollY, h: r.height }; };
    // all layout reads happen here, never inside frame()
    const measure = () => {
      ih = window.innerHeight; vw = window.innerWidth;
      G = {
        hero: hero && box(hero),
        day: day && box(day),
        pano: pano && box(pano),
        marq: marq && box(marq.parentElement),
        zoom: zoom && box(zoom.closest("section")),
        floats: floats.map((el) => { const b = box(el); b.top -= el._ty || 0; return b; }),
      };
      if (st && stInner && stPill) {
        const ir = stInner.getBoundingClientRect(), pr = stPill.getBoundingClientRect();
        const s = box(st);
        s.t = pr.top - ir.top; s.l = pr.left - ir.left; s.r = ir.right - pr.right; s.b = ir.bottom - pr.bottom;
        s.pw = pr.width; s.ph = pr.height; s.W = ir.width; s.H = ir.height;
        // start the expanding layer from exactly the crop the pill shows. The layer photo's box is the whole photo at
        // its cover size (not the layer's box): scaled down to pill size, a box-sized img would cut the photo where
        // the layer's cover crops it (the sides of a portrait phone layer) and leave dark bars inside the pill
        const nw = stLayerImg.naturalWidth || stPill.naturalWidth, nh = stLayerImg.naturalHeight || stPill.naturalHeight;
        if (nw && nh) {
          const op = getComputedStyle(stPill).objectPosition.split(' ').map((v) => (/%$/.test(v) ? parseFloat(v) / 100 : 0.5));
          const ox = op[0], oy = op[1] === undefined ? 0.5 : op[1];
          const sP = Math.max(s.pw / nw, s.ph / nh), sL = Math.max(s.W / nw, s.H / nh);
          const iw = nw * sL, ihh = nh * sL, ix = (s.W - iw) * ox, iy = (s.H - ihh) * oy;
          const im = stLayerImg.style;
          im.left = ix.toFixed(1) + 'px'; im.top = iy.toFixed(1) + 'px'; im.right = 'auto'; im.bottom = 'auto';
          im.width = iw.toFixed(1) + 'px'; im.height = ihh.toFixed(1) + 'px';
          // scaled by k0 about its centre, the photo must sit where the pill's cover places it
          s.k0 = sP / sL;
          s.cx = s.l + (s.pw - nw * sP) * ox + nw * sP / 2 - (ix + iw / 2);
          s.cy = s.t + (s.ph - nh * sP) * oy + nh * sP / 2 - (iy + ihh / 2);
        } else { s.k0 = 1; s.cx = 0; s.cy = 0; }
        G.st = s;
      }
      axisGaps();
    };

    const frame = () => {
      T.raf = 0;
      const y = sy; const still = RM.matches;
      if (G.hero) {
        const p = clamp((y - G.hero.top) / G.hero.h);
        if (heroImg && !still) heroImg.style.transform = 'translate3d(0,' + (p * 30) + '%,0) scale(' + (1 + p * 0.18) + ')';
        heroFade.forEach((el) => { el.style.opacity = p > 0 ? String(1 - p * 1.6) : ''; });
        if (heroWm && !still) heroWm.style.transform = 'translate3d(0,' + (-p * 120) + 'px,0)';
      }
      if (G.st) {
        const s = G.st; const top = s.top - y;
        // layers only while the scene is within a screen of the viewport (they cost memory)
        const live = top < ih * 2 && top + s.h > -ih;
        if (live !== st._live) { st._live = live; st.classList.toggle('st-live', live); }
        const p = clamp(-top / (s.h - ih)); const e = clamp((ih - top) / ih);
        // one continuous handoff, never an empty frame: as soon as the scene moves, the expanding layer takes over
        // from the pill at exactly the pill's crop (the pill itself fades with its sentence, so it must not be what
        // carries the photo). Desktop: it starts growing at once and the words fade out around it. Phones: the
        // words leave first while the photo holds at pill size, then it opens (it never covers a word). Once open,
        // it keeps a slow push-in to the end of the pin, so no stretch of the scroll is dead
        const phone = PHONE.matches;
        const f0 = 0.02, f1 = phone ? 0.12 : 0.22;          // the words fade over [f0, f1]
        const g0 = phone ? f1 : 0.03, g1 = phone ? 0.54 : 0.52; // the photo grows over [g0, g1]
        const fade = 1 - clamp((p - f0) / (f1 - f0));
        const set = (el, k, v) => { if (el['_' + k] !== v) { el['_' + k] = v; el.style[k] = v; } };
        stFade.forEach((el) => set(el, 'opacity', String(Math.min(e, fade))));
        // an ease-out (sine): the photo visibly starts growing the moment its range begins, never idling at pill size,
        // and settles softly into full bleed
        const a = Math.sin(clamp((p - g0) / (g1 - g0)) * Math.PI / 2);
        const held = !still && p > 0.012;   // the layer holds the photo (at pill size while a = 0)
        // its dark grade comes in with the growth: at pill size the layer looks exactly like the pill
        if (stBg) set(stBg, 'opacity', still ? '' : a.toFixed(3));
        // before that, the photo layer stays practically invisible rather than hidden, and the sentence above it
        // practically transparent rather than 0: the browser rasterises both ahead, not on the first visible frame
        if (still) {
          // reduced motion: a plain crossfade from the words to the full photo, overlapping (never a blank frame)
          const c = 1 - fade;
          set(stLayer, 'visibility', live || c > 0 ? 'visible' : 'hidden'); set(stLayer, 'clipPath', ''); set(stLayerImg, 'transform', '');
          set(stLayer, 'opacity', String(live ? Math.max(c, 0.002) : c)); set(stPill, 'opacity', '1');
        } else if (!held) { set(stLayer, 'visibility', live ? 'visible' : 'hidden'); set(stLayer, 'opacity', live ? '0.002' : ''); set(stPill, 'opacity', '1'); }
        else {
          const k = 1 - a; const z = 1 + 0.05 * clamp((p - g1) / (1 - g1));
          set(stLayer, 'visibility', 'visible'); set(stLayer, 'opacity', ''); set(stPill, 'opacity', '0');
          // fully open: no clip at all (a rounded clip, even a zero one, keeps a mask on the layer)
          set(stLayer, 'clipPath', k < 0.0005 ? 'none' : 'inset(' + (s.t * k).toFixed(1) + 'px ' + (s.r * k).toFixed(1) + 'px ' + (s.b * k).toFixed(1) + 'px ' + (s.l * k).toFixed(1) + 'px round ' + (s.ph / 2 * k).toFixed(1) + 'px)');
          set(stLayerImg, 'transform', 'translate3d(' + (s.cx * k).toFixed(1) + 'px,' + (s.cy * k).toFixed(1) + 'px,0) scale(' + ((s.k0 + (1 - s.k0) * a) * z).toFixed(4) + ')');
        }
        const o = clamp((p - (g1 - 0.06)) / 0.26);
        set(stOver, 'opacity', (live ? Math.max(o, 0.002) : o).toFixed(3)); set(stOver, 'transform', still ? '' : 'translate3d(0,' + ((1 - o) * 60).toFixed(1) + 'px,0)');
      }
      if (G.day) {
        const top = G.day.top - y; const p = clamp(-top / (G.day.h - ih));
        if (dayBar) dayBar.style.transform = 'scaleX(' + p + ')';
        if (top < ih && top + G.day.h > 0 && T.setDay) {
          const idx = Math.min(4, Math.floor(p * 5));
          // an hour chosen by a click holds until the reader scrolls a third of a step away from where they clicked
          const lk = T.dayLock;
          if (lk && Math.abs(y - lk.y) < (G.day.h - ih) / 15) { /* hold */ } else { T.dayLock = null; if (idx !== T.day) T.setDay(idx); }
        }
      }
      if (!still) {
        // write a style only when it changes: an identical write still invalidates, and offscreen parts sit still
        const put = (el, k, v) => { if (el['_' + k] !== v) { el['_' + k] = v; el.style[k] = v; } };
        const f = vw <= 760 ? 0.35 : vw < 1440 ? 0.5 : 1;
        floats.forEach((el, i) => {
          const b = G.floats[i]; const qq = clamp((ih - (b.top - y)) / (ih + b.h));
          el._ty = Math.round((0.5 - qq) * parseFloat(el.getAttribute('data-float')) * f * 10) / 10;
          put(el, 'transform', 'translate3d(0,' + el._ty + 'px,0)');
        });
        if (G.pano) { const qq = clamp((ih - (G.pano.top - y)) / (ih * 0.85)); const x = (24 * (1 - ease(qq))).toFixed(2); put(pano, 'clipPath', 'inset(0 ' + x + '% 0 ' + x + '%)'); if (panoImg) put(panoImg, 'transform', 'scale(' + (1.3 - 0.3 * qq).toFixed(4) + ')'); }
        if (G.marq) { const qq = clamp((ih - (G.marq.top - y)) / (ih + G.marq.h)); put(marq, 'transform', 'translate3d(' + (-qq * 38).toFixed(2) + '%,0,0)'); }
        if (G.zoom) { const qq = clamp((ih - (G.zoom.top - y)) / (ih + G.zoom.h)); put(zoom, 'transform', 'scale(' + (1.25 - 0.25 * qq).toFixed(4) + ')'); }
      }
    };
    // scrollY is read in the scroll event (layout is clean there), never inside the frame after text writes
    let sy = window.scrollY;
    const schedule = () => { sy = window.scrollY; if (!T.raf) T.raf = requestAnimationFrame(frame); };
    let mq = 0;
    const remeasure = () => { if (mq) return; mq = requestAnimationFrame(() => { mq = 0; sy = window.scrollY; measure(); frame(); }); };
    T.remeasure = remeasure;
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', remeasure);
    window.addEventListener('load', remeasure);
    if (document.fonts) document.fonts.ready.then(remeasure);
    if (window.ResizeObserver) new ResizeObserver(remeasure).observe(root);
    if (stLayerImg && !stLayerImg.complete) stLayerImg.addEventListener('load', remeasure, { once: true });
    qa('img[data-axis-gap]', root).forEach((im) => { if (!im.complete || !im.naturalWidth) im.addEventListener('load', remeasure, { once: true }); });
    RM.addEventListener && RM.addEventListener('change', () => { qa('[data-float], [data-marquee], [data-zoom], [data-hero-img], [data-hero-wm], [data-pano-img]', root).forEach((el) => { el.style.transform = ''; }); if (pano) pano.style.clipPath = ''; remeasure(); });
    sy = window.scrollY; measure(); frame();
    badge();

    // ---- eased wheel scrolling (mouse and trackpad only) ----
    // The page keeps its native scroll position: the wheel only sets a target and every animation frame
    // moves window.scrollY a tenth of the way there, then runs the scene frame in the same tick, so
    // pinned and scrubbed scenes never lag a frame behind. Keys, the scrollbar, anchors, focus and the
    // skip link scroll natively; any such jump simply becomes the new resting point.
    if (FINE.matches && !reduced) {
      let target = window.scrollY, cur = target, set = target, run = 0;
      const stop = () => { if (run) cancelAnimationFrame(run); run = 0; };
      const step = () => {
        run = 0;
        if (Math.abs(window.scrollY - set) > 2) { target = cur = set = window.scrollY; return; }
        cur += (target - cur) * 0.1;
        if (Math.abs(target - cur) < 0.4) cur = target;
        window.scrollTo(0, cur); set = window.scrollY;
        if (T.raf) { cancelAnimationFrame(T.raf); T.raf = 0; }
        sy = set; frame();
        if (cur !== target) run = requestAnimationFrame(step);
      };
      const inner = (el) => {
        for (; el && el.nodeType === 1 && el !== document.body; el = el.parentElement) {
          if (el.scrollHeight > el.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)) return true;
        }
        return false;
      };
      window.addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.defaultPrevented || RM.matches || Math.abs(e.deltaX) > Math.abs(e.deltaY) || document.documentElement.style.overflow === 'hidden' || inner(e.target)) return;
        e.preventDefault();
        if (!run) target = cur = set = window.scrollY;
        const d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
        target = Math.max(0, Math.min(document.documentElement.scrollHeight - window.innerHeight, target + d));
        if (!run) run = requestAnimationFrame(step);
      }, { passive: false });
      window.addEventListener('keydown', stop, true);
      window.addEventListener('pointerdown', stop, true);
    }
  }
  T.start = start;

  /* ---------- 2a. axis gaps: the centre line stops around any text it would cross ---------- */
  function axisGaps() {
    qa('[data-axis]', root).forEach((ax) => {
      const host = ax.parentElement; const ar = ax.getBoundingClientRect();
      if (!ar.height) return;
      const x = ar.left + ar.width / 2; const spans = [];
      qa('p, h1, h2, h3, blockquote, li, figcaption, label, legend, a, button, span, input', host).forEach((el) => {
        if (el.closest('[data-axis], [data-st-layer], .sr-only, [aria-hidden="true"]') || el.offsetParent === null) return;
        const own = el.tagName === 'INPUT' || Array.from(el.childNodes).some((c) => c.nodeType === 3 && c.nodeValue.trim());
        if (!own) return;
        const r = el.getBoundingClientRect();
        if (r.left > x + 2 || r.right < x - 2 || !r.height) return;
        // text inside parallax blocks moves by up to half its data-float distance
        const fl = el.closest('[data-float]'); const slack = fl ? parseFloat(fl.getAttribute('data-float')) / 2 + 8 : 8;
        const ty = fl ? (fl._ty || 0) : 0;
        spans.push([r.top - ty - ar.top - slack, r.bottom - ty - ar.top + slack]);
      });
      // drawn type (the TYSHA wordmarks) and the buildings in full-bleed photos: the line stops there too
      qa('svg[role="img"]', host).forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.height && r.left <= x && r.right >= x) spans.push([r.top - ar.top - 12, r.bottom - ar.top + 12]);
      });
      if (!PHONE.matches) qa('img[data-axis-gap]', host).forEach((im) => {
        // data-axis-gap="top bottom" in image fractions; mapped through object-fit: cover and object-position
        const nw = im.naturalWidth, nh = im.naturalHeight; if (!nw || !nh) return;
        // layout box, not the scroll-transformed one (parallax / zoom)
        const W = im.offsetWidth, H = im.offsetHeight; if (!H || im.offsetParent !== ax.offsetParent) return;
        const top = im.offsetTop - ax.offsetTop;
        const [t, b] = im.getAttribute('data-axis-gap').split(/\s+/).map(parseFloat);
        const k = Math.max(W / nw, H / nh);
        const oy = getComputedStyle(im).objectPosition.split(' ')[1] || '50%';
        const off = (H - nh * k) * (/%$/.test(oy) ? parseFloat(oy) / 100 : 0.5);
        spans.push([top + off + t * nh * k, top + off + b * nh * k]);
      });
      if (!spans.length) { ax.style.maskImage = ax.style.webkitMaskImage = ''; return; }
      spans.sort((a, b) => a[0] - b[0]);
      const merged = [];
      // gaps closer than 48px merge: no short stubs of line between two stops
      spans.forEach((s) => { const m = merged[merged.length - 1]; if (m && s[0] <= m[1] + 48) m[1] = Math.max(m[1], s[1]); else merged.push(s.slice()); });
      const stops = ['#000 0px'];
      merged.forEach(([a, b]) => { stops.push('#000 ' + Math.round(a) + 'px', 'transparent ' + Math.round(a) + 'px', 'transparent ' + Math.round(b) + 'px', '#000 ' + Math.round(b) + 'px'); });
      const g = 'linear-gradient(to bottom,' + stops.join(',') + ')';
      ax.style.maskImage = g; ax.style.webkitMaskImage = g;
    });
  }

  /* ---------- 2b. dB badge: shows the label value of the section at the viewport centre ---------- */
  function badge() {
    const el = q('[data-db-badge]'); if (!el) return;
    const live = q('#day-db');
    const secs = qa('section', root).map((s) => {
      // the day section shows its own live number (the hour on screen), not a fixed label
      if (live && s.contains(live)) return { s, get v() { return (T.dayDb != null ? T.dayDb : live.textContent) + ' dB'; } };
      const head = q('.sec-head', s); if (!head || head.closest('[data-st-layer]')) return null;
      const m = (head.lastElementChild ? head.lastElementChild.textContent : '').match(/(\d+)\s*(?:→\s*\d+\s*)?dB/i);
      return m ? { s, v: m[1] + ' dB' } : null;
    }).filter(Boolean);
    if (!secs.length) return;
    const quiet = qa('[data-hero], #contact, footer', root);
    const state = new Map();
    const update = () => {
      const cur = secs.find((x) => state.get(x.s));
      const hide = quiet.some((x) => state.get(x)) || !cur;
      if (cur) el.textContent = cur.v;
      el.hidden = false; el.classList.toggle('on', !hide);
    };
    const io = new IntersectionObserver((es) => { es.forEach((e) => state.set(e.target, e.isIntersecting)); update(); }, { rootMargin: '-50% 0px -50% 0px' });
    secs.forEach((x) => io.observe(x.s)); quiet.forEach((x) => io.observe(x));
    document.addEventListener('tysha:day', update);
  }

  // the footer wordmark's photo loads as the footer comes near (see images.py)
  const wmImg = q('.foot-wm image[data-href]');
  if (wmImg) {
    const set = () => { wmImg.setAttribute('href', wmImg.getAttribute('data-href')); wmImg.removeAttribute('data-href'); };
    if ('IntersectionObserver' in window) { const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); set(); } }, { rootMargin: '150% 0px' }); io.observe(wmImg.closest('svg')); } else set();
  }

  if (!document.body.hasAttribute('data-preloader')) start();

  // Back to a page: return to where the reader was (the projects grid, not the top). The position is kept per page in
  // this tab and restored after the layout is ready, on a back/forward visit only.
  const POS = 'tysha-pos:' + location.pathname;
  try { history.scrollRestoration = 'manual'; } catch (e) { /* fine */ }
  window.addEventListener('pagehide', () => { try { sessionStorage.setItem(POS, String(Math.round(window.scrollY))); } catch (e) { /* fine */ } });
  const navEntry = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
  if (navEntry && navEntry.type === 'back_forward' && !location.hash) {
    let y = 0; try { y = +sessionStorage.getItem(POS) || 0; } catch (e) { /* fine */ }
    if (y) {
      const go = () => { window.scrollTo(0, y); if (T.remeasure) T.remeasure(); };
      go(); requestAnimationFrame(go); window.addEventListener('load', go, { once: true }); setTimeout(go, 400);
    }
  }

  // page transitions: a case's photo morphs between its card (home or the projects index) and its own hero (Lull House .vt-lull, Pine Court
  // .vt-pine), and only on that pair of pages; to any other page it leaves with the rest of the old page (a named
  // element would otherwise stay on top, unfaded)
  const BP = new URL(BASE).pathname;
  const where = (u) => { try { const p = new URL(u, location.href).pathname.replace(/index\.html$/, ''); return p === BP ? 'home' : p === BP + 'project/' ? 'index' : p === BP + 'project/lull-house/' ? 'lull' : p === BP + 'project/pine-court/' ? 'pine' : 'other'; } catch (e) { return 'other'; } };
  const VT = { lull: '.vt-lull', pine: '.vt-pine' };
  const LIST = (k) => k === 'home' || k === 'index';   // pages with a card for each case
  // keep the morph only for the case that pairs this page with the other one
  const keep = (other) => {
    const here = where(location.href);
    const pick = LIST(here) ? (VT[other] ? other : null) : (LIST(other) ? here : null);
    Object.keys(VT).forEach((k) => qa(VT[k]).forEach((el) => { el.style.viewTransitionName = k === pick ? '' : 'none'; }));
  };
  // a card <-> case morph also lifts the case header, meta and facts into their own layers (html.vt-case, site.css),
  // so they come in after the photo lands instead of popping in when the transition ends
  const caseLayers = (t, a, b) => {
    const de = document.documentElement;
    if (!((LIST(a) && VT[b]) || (VT[a] && LIST(b)))) return;
    de.classList.add('vt-case');
    const off = () => de.classList.remove('vt-case');
    if (t.finished) t.finished.then(off, off);
  };
  const VTK = 'tysha-vt';
  // a transition the browser skips (opt-in off, a hidden tab, a phone in low-power mode) rejects its promises; that is
  // not an error for us, so they are handled here and never reach the console
  const quietVT = (t) => { if (!t) return; ['ready', 'finished', 'updateCallbackDone'].forEach((k) => { if (t[k] && t[k].catch) t[k].catch(() => {}); }); };
  window.addEventListener('pageswap', (e) => {
    quietVT(e.viewTransition);
    if (!e.viewTransition) return;
    const to = e.activation && e.activation.entry ? where(e.activation.entry.url) : 'other';
    keep(to);
    caseLayers(e.viewTransition, where(location.href), to);
    try { sessionStorage.setItem(VTK, where(location.href) + '>' + to); } catch (er) { /* fine */ }
  });
  window.addEventListener('pagereveal', (e) => {
    quietVT(e.viewTransition);
    if (!e.viewTransition) return;
    let from = 'other';
    try { const v = (sessionStorage.getItem(VTK) || '').split('>'); if (v[1] === where(location.href)) from = v[0]; sessionStorage.removeItem(VTK); } catch (er) { /* fine */ }
    if (from === 'other') { const f = window.navigation && navigation.activation && navigation.activation.from; if (f) from = where(f.url); }
    keep(from);
    caseLayers(e.viewTransition, from, where(location.href));
  });

  // skip link: focus <main> directly (a plain #main would follow <base href> on the 404 page)
  const skip = q('.skip-link'), main = q('#main');
  if (skip && main) skip.addEventListener('click', (e) => { e.preventDefault(); main.focus(); main.scrollIntoView(); });

  /* ---------- 3a. contact form (simulated: no backend in this concept) ---------- */
  const form = q('[data-form]');
  if (form) {
    const sent = q('[data-sent]'), fail = q('[data-fail]', form), btn = q('[data-send]', form), status = q('[data-form-status]', form);
    const F = (n) => q('[name="' + n + '"]', form);
    const MSG = { name: 'Tell us your name, so we know who to answer.', empty: 'We need a phone or an email to reply.', bad: "That doesn’t look like a phone or an email." };
    const setErr = (n, m) => {
      const i = F(n), e = document.getElementById('err-' + n);
      if (m) i.setAttribute('aria-invalid', 'true'); else i.removeAttribute('aria-invalid');
      if (e) { e.textContent = m || ''; e.style.display = m ? 'block' : 'none'; }
    };
    const check = (focus) => {
      const errs = [];
      if (!F('name').value.trim()) { setErr('name', MSG.name); errs.push(F('name')); } else setErr('name', '');
      const c = F('contact').value.trim();
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c) || /^\+?[\d\s().-]{7,}$/.test(c);
      if (!c || !ok) { setErr('contact', c ? MSG.bad : MSG.empty); errs.push(F('contact')); } else setErr('contact', '');
      if (focus) {
        status.textContent = errs.length ? (errs.length === 1 ? 'One field needs attention: ' : errs.length + ' fields need attention: ') + errs.map((i) => document.getElementById('err-' + i.name).textContent).join(' ') : '';
        if (errs[0]) errs[0].focus();
      }
      return !errs.length;
    };
    ['name', 'contact'].forEach((n) => F(n).addEventListener('input', () => { if (F(n).getAttribute('aria-invalid') === 'true') check(false); }));
    let busy = false;
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      if (busy) return;
      fail.style.display = 'none';
      if (!check(true)) return;
      busy = true; form.setAttribute('aria-busy', 'true'); status.textContent = 'Sending.';
      let db = 68; btn.textContent = 'Sending · 68 dB';
      const iv = setInterval(() => { db = Math.max(25, db - 3); btn.textContent = 'Sending · ' + db + ' dB'; }, 70);
      // Offline (or a region containing "fail") shows the error state.
      setTimeout(() => {
        clearInterval(iv); busy = false; form.removeAttribute('aria-busy'); status.textContent = '';
        if (navigator.onLine === false || /fail/i.test(F('region').value)) { fail.style.display = 'block'; btn.textContent = 'Try again'; return; }
        const name = F('name').value.trim().split(/\s+/)[0];
        const find = (q('input[name="plot"]:checked', form) || {}).value === 'find';
        q('[data-sent-id]', sent).textContent = 'Request TY-' + (1000 + Math.floor(Math.random() * 9000)) + ' · Received · 25 dB';
        q('[data-sent-msg]', sent).textContent = 'Thank you, ' + name + ". We’ll reply within two working days from hello@tysha.studio. " + (find ? "We’ll start by looking for a quiet plot together." : "First we’ll ask for the plot’s address, to plan the audit.");
        form.style.display = 'none'; sent.style.display = 'flex'; sent.setAttribute('tabindex', '-1'); sent.focus({ preventScroll: true });
      }, 1600);
    });
    const again = q('[data-again]');
    if (again) again.addEventListener('click', () => { form.reset(); ['name', 'contact'].forEach((n) => setErr(n, '')); btn.textContent = 'Send'; sent.style.display = 'none'; form.style.display = 'flex'; F('name').focus(); });
  }

  /* ---------- 3b. live clocks in the footer ---------- */
  const clocks = qa('[data-clock]');
  const fmt = {};
  const tickClock = () => clocks.forEach((c) => { try { const z = c.getAttribute('data-clock'); fmt[z] = fmt[z] || new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: z }); c.textContent = fmt[z].format(new Date()); } catch (e) { /* keep the static time */ } });
  // the time-zone data is slow to load (a long task on a phone); the footer is far below, so start when it comes near
  if (clocks.length) {
    const startClocks = () => { tickClock(); setInterval(tickClock, 20000); };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); startClocks(); } }, { rootMargin: '0px 0px 150% 0px' });
      clocks.forEach((c) => io.observe(c));
    } else setTimeout(startClocks, 4000);
  }

  /* ---------- 3c. mobile menu (up to 1024px): dialog with focus trap, Esc, focus return ---------- */
  const header = q('.site-head'), nav = header && q('nav[aria-label="Main"]', header);
  if (nav) {
    const DB = { Projects: '40 dB', Method: '33 dB', Studio: '27 dB', Contact: '25 dB' };
    const b = document.createElement('button');
    b.type = 'button'; b.className = 't-pill t-menu-btn'; b.textContent = 'Menu'; b.setAttribute('data-noscramble', '');
    b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-controls', 't-menu');
    header.appendChild(b);
    const ov = document.createElement('div');
    ov.id = 't-menu'; ov.className = 't-menu'; ov.hidden = true;
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Menu');
    ov.innerHTML = '<div class="t-menu-axis"></div><div class="t-menu-top"><span>Tysha<br><span class="t-mute">Architecture</span></span><button type="button" class="t-pill" data-close>Close</button></div>'
      + '<nav class="t-menu-list" aria-label="Menu">' + qa('a', nav).map((a, i) => '<a href="' + a.getAttribute('href') + '"' + (a.hasAttribute('aria-current') ? ' aria-current="page"' : '') + '><span class="n">0' + (i + 1) + '</span><span class="t">' + a.textContent + '</span><span class="d">' + (DB[a.textContent] || '') + '</span></a>').join('') + '</nav>'
      + '<div class="t-menu-foot"><a href="mailto:hello@tysha.studio" class="case-none">hello@tysha.studio</a><span>+380 32 245 18 90 · Lviv</span><span>+48 22 628 41 07 · Warsaw</span><span class="t-mute">Now: 25 dB</span></div>';
    document.body.appendChild(ov);
    const de = document.documentElement;
    const others = () => [root, q('.skip-link'), q('.t-note')].filter(Boolean);
    let back = null;
    const open = () => {
      back = document.activeElement;
      ov.hidden = false; requestAnimationFrame(() => ov.classList.add('on'));
      b.setAttribute('aria-expanded', 'true'); de.style.overflow = 'hidden';
      others().forEach((el) => { el.inert = true; });
      q('[data-close]', ov).focus();
    };
    const close = (refocus = true) => {
      if (ov.hidden) return;
      ov.classList.remove('on'); b.setAttribute('aria-expanded', 'false'); de.style.overflow = '';
      others().forEach((el) => { el.inert = false; });
      setTimeout(() => { ov.hidden = true; }, 400);
      if (refocus) (back && back !== document.body && back.isConnected && back.getClientRects().length ? back : b).focus({ preventScroll: true });
    };
    b.addEventListener('click', open);
    q('[data-close]', ov).addEventListener('click', () => close());
    qa('.t-menu-list a, .t-menu-foot a', ov).forEach((a) => a.addEventListener('click', () => close(false)));
    document.addEventListener('keydown', (e) => {
      if (ov.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key === 'Tab') {
        const f = qa('a[href], button', ov); const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    window.matchMedia('(min-width: 1025px)').addEventListener('change', (m) => { if (m.matches) close(false); });
  }

  /* ---------- 3e. sound toggle: off by default, never autoplays; the engine (sound.js) loads on demand ---------- */
  // a small caption toast: polite live region, shown only when the visitor toggles (never when a state is restored)
  let toast = null, toastT = 0;
  T.toast = (msg) => {
    if (!toast) {
      toast = document.createElement('div'); toast.className = 't-toast';
      toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite'); toast.setAttribute('aria-atomic', 'true');
      document.body.appendChild(toast);
    }
    // phones: keep clear of the privacy note in the bottom corner
    const note = q('.t-note.on');
    toast.style.bottom = note && PHONE.matches ? (window.innerHeight - note.getBoundingClientRect().top + 12) + 'px' : '';
    clearTimeout(toastT);
    toast.textContent = msg;
    requestAnimationFrame(() => toast.classList.add('on'));
    toastT = setTimeout(() => { toast.classList.remove('on'); toastT = setTimeout(() => { toast.textContent = ''; }, 500); }, 3000);
  };
  T.soundOn = () => false;
  if (header && (window.AudioContext || window.webkitAudioContext)) {
    const sb = document.createElement('button');
    sb.type = 'button'; sb.className = 't-pill t-sound'; sb.setAttribute('aria-pressed', 'false'); sb.setAttribute('data-noscramble', '');
    sb.innerHTML = 'Sound&nbsp;<span class="t-sound-s">off</span>';
    const sbs = q('.t-sound-s', sb);
    sb.setAttribute('data-cursor', 'Listen');
    header.insertBefore(sb, q('.t-menu-btn', header));
    T.soundOn = () => sb.getAttribute('aria-pressed') === 'true';
    const load = () => (T.sound ? Promise.resolve(T.sound) : new Promise((ok, no) => {
      const s = document.createElement('script'); s.src = BASE + 'assets/sound.js' + AV;
      s.onload = () => (T.sound ? ok(T.sound) : no()); s.onerror = no; document.head.appendChild(s);
    }));
    // Mobile browsers only start audio inside the tap itself (iOS Safari: touchend / click / keydown, synchronously).
    // So the AudioContext is created and resumed here, in the handler, before sound.js has even loaded, with a
    // one-sample buffer to unlock it; sound.js then builds on this context (T.audioCtx).
    const AC = window.AudioContext || window.webkitAudioContext;
    let actx = null, silent = null, want = false;
    const IOSISH = !navigator.audioSession && 'ontouchend' in document;
    const silence = () => {
      // iOS before 16.4 plays Web Audio in the "ambient" session, which the ring/silent switch mutes; a looping silent
      // media element (also started inside the tap) moves the page to the "playback" session
      if (silent) return silent;
      const n = 800, buf = new Uint8Array(44 + n), v = new DataView(buf.buffer);
      const str = (o, t) => { for (let i = 0; i < t.length; i++) buf[o + i] = t.charCodeAt(i); };
      str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); str(36, 'data'); v.setUint32(40, n, true);
      buf.fill(128, 44);
      silent = new Audio(URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })));
      silent.loop = true; silent.setAttribute('playsinline', ''); silent.preload = 'auto';
      return silent;
    };
    const unlock = () => {
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* older Safari */ }
      if (!actx) { actx = T.audioCtx = new AC(); actx.addEventListener('statechange', sync); }
      if (actx.state !== 'running') { const r = actx.resume(); if (r && r.catch) r.catch(() => {}); }
      const b = actx.createBufferSource(); b.buffer = actx.createBuffer(1, 1, 22050); b.connect(actx.destination); b.start(0);
      if (IOSISH) { const pr = silence().play(); if (pr && pr.catch) pr.catch(() => {}); }
    };
    // the label tells the truth: "on" only while the context really runs (iOS suspends it on a call, a lock, Siri)
    const set = (on) => {
      sb.setAttribute('aria-pressed', String(on)); sbs.textContent = on ? 'on' : 'off';
    };
    const remember = (on) => { try { sessionStorage.setItem('tysha-sound', on ? '1' : '0'); } catch (e) { /* not remembered */ } };
    const GESTURE = ['touchend', 'click', 'keydown'];
    let armed = false;
    const rearm = () => {
      if (armed) return; armed = true;
      const go = (e) => {
        GESTURE.forEach((n) => window.removeEventListener(n, go, true)); armed = false;
        if (!want || e.target === sb || sb.contains(e.target)) return;   // the button handles its own tap
        unlock(); load().then((S) => S.on(), () => {});
      };
      GESTURE.forEach((n) => window.addEventListener(n, go, { capture: true, passive: true }));
    };
    function sync() {
      if (!actx) return;
      const running = actx.state === 'running';
      set(want && running);
      // suspended or interrupted while wanted (and the page is visible): the next tap brings it back
      if (want && !running && !document.hidden) rearm();
    }
    sb.addEventListener('click', () => {
      want = sb.getAttribute('aria-pressed') !== 'true';
      remember(want);
      if (want) {
        unlock();
        set(true);
        T.toast('Sound on — the city fades as you scroll');
        load().then((S) => { S.on(); setTimeout(sync, 400); }, () => { want = false; remember(false); set(false); T.toast('Sound is not available here'); });
      } else {
        set(false); T.toast('Sound off');
        if (T.sound) T.sound.off();
        if (silent) silent.pause();
      }
    });
    try { want = sessionStorage.getItem('tysha-sound') === '1'; } catch (e) { /* first visit */ }
    // remembered from the previous page: the label waits for the first tap on this page, which starts the sound
    if (want) rearm();
    const wake = () => { if (want && actx && actx.state !== 'running' && !document.hidden) { const r = actx.resume(); if (r && r.catch) r.catch(() => {}); setTimeout(sync, 300); } };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('pageshow', wake);
    window.addEventListener('focus', wake);
  }

  /* ---------- 3e2. the page's noise level, as the site tells it: 68 dB at the top of the home page, 25 dB at the
     bottom; the day section reads its own hour; the other pages are already out of town ---------- */
  const homePage = !!q('[data-hero] [data-hero-wm]');
  const daySecEl = q('[data-pin="400"]');
  T.pageDb = () => {
    if (T.quiet != null) return T.quiet;   // the contact form is open: the room's own level
    const ih = window.innerHeight;
    if (daySecEl && T.dayDb != null) { const r = daySecEl.getBoundingClientRect(); if (r.top < ih * 0.5 && r.bottom > ih * 0.5) return T.dayDb; }
    const max = document.documentElement.scrollHeight - ih;
    let p = max > 0 ? window.scrollY / max : 1;
    if (!homePage) p = 0.75 + 0.25 * p;
    return Math.round(68 - 43 * Math.min(1, p * 1.25));
  };

  /* ---------- 3f. cursor (mouse only). The native cursor stays; this one is an accent that follows it.
     Default: a five-bar equalizer whose height follows the page's dB (a flat line while the sound is off); over the
     project card it reads "View", over the day section the current dB, over [data-cursor] that word.
     For comparison only, ?cursor= switches this page view to: dot | b (meter ring) | c (dot + click ripples) |
     d (crosshair, viewfinder over photos) | e (equalizer + ripples). Nothing is remembered.
     Transform and opacity only, one rAF loop, pointer-events: none. Reduced motion: no lag, still bars, no ripples. */
  if (FINE.matches && root) {
    const VARS = ['dot', 'a', 'b', 'c', 'd', 'e'];
    // the equalizer for everyone; a choice saved by the old test switcher (stage 3, round 1) is forgotten
    try { localStorage.removeItem('tysha-cursor'); } catch (e) { /* no storage */ }
    let pick = (new URLSearchParams(location.search).get('cursor') || '').toLowerCase();
    if (VARS.indexOf(pick) < 0) pick = 'a';

    const c = document.createElement('div'); c.setAttribute('aria-hidden', 'true');
    c.innerHTML = '<span class="tc-lab"></span><i class="tc-eq"><b></b><b></b><b></b><b></b><b></b></i>'
      + '<svg class="tc-ring" viewBox="0 0 36 36" width="36" height="36"><circle cx="18" cy="18" r="16" class="tc-track"/><circle cx="18" cy="18" r="16" class="tc-arc" pathLength="100"/></svg><em class="tc-num"></em>'
      + '<i class="tc-cross"></i><i class="tc-xy"></i><i class="tc-vf"><b></b><b></b><b></b><b></b></i>';
    document.body.appendChild(c);
    const rip = document.createElement('div'); rip.className = 't-ripples'; rip.setAttribute('aria-hidden', 'true'); document.body.appendChild(rip);
    const lab = q('.tc-lab', c), bars = qa('.tc-eq b', c), arc = q('.tc-arc', c), num = q('.tc-num', c), xy = q('.tc-xy', c), dayDb = q('#day-db');
    let x = 0, y = 0, cx = 0, cy = 0, raf = 0, mode = '', photo = false, seen = false;
    const apply = (v) => {
      pick = v; c.className = 't-cursor tc-' + v + (seen ? ' on' : '') + (mode ? ' pill' : '') + (photo ? ' photo' : '');
      if (!raf) raf = requestAnimationFrame(step);
    };
    const text = () => (mode === 'db' ? (dayDb ? dayDb.textContent : T.pageDb()) + ' dB' : mode);
    const eq = () => pick === 'a' || pick === 'e';
    const still = () => RM.matches;
    let lastDb = -1, lastXY = '', lastEq = 0, lastMove = 0; const eqH = [0.2, 0.2, 0.2, 0.2, 0.2], eqS = [0, 0, 0, 0, 0];
    const step = (now) => {
      now = now || performance.now();
      raf = 0;
      const k = still() ? 1 : 0.2;
      cx += (x - cx) * k; cy += (y - cy) * k;
      c.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)';
      if (mode === 'db' && lab.textContent !== text()) lab.textContent = text();
      let busy = Math.abs(x - cx) + Math.abs(y - cy) > 0.2 || mode === 'db';
      if (seen && (eq() || pick === 'b')) {
        const db = T.pageDb(); const loud = Math.max(0, Math.min(1, (db - 20) / 48));
        if (eq()) {
          // a living equalizer: each bar its own slow organic motion (three incommensurate sines), eased; the page's
          // dB sets how lively (68 dB tall and busy, 25 dB low and calm, never still). With the sound on, the bars
          // follow the real output (sound.js analyser, five bands). Reduced motion: still bars at the dB height.
          const t = (now || performance.now()) / 1000;
          const amp = 0.28 + 0.72 * Math.max(0, Math.min(1, (db - 25) / 43));
          const live = !still() && T.sound && T.sound.bands && T.soundOn() ? T.sound.bands() : null;
          const idle = performance.now() - lastMove > 2000;
          if (!still() && idle && now - lastEq < 50) { busy = true; }             // idle pointer: ~20 fps is plenty
          else {
            const dt = lastEq ? Math.min(0.1, (now - lastEq) / 1000) : 0.016; lastEq = now;
            bars.forEach((bar, i) => {
              let target;
              if (still()) target = 0.18 + 0.82 * amp * [0.5, 0.85, 1, 0.7, 0.45][i];
              else {
                const n = 0.5 + 0.22 * Math.sin(t * (1.7 + i * 0.61) + i * 2.1) + 0.18 * Math.sin(t * (3.9 + i * 1.13) + i * 0.7) + 0.1 * Math.sin(t * (7.3 + i * 0.37) + i * 4.2);
                target = 0.14 + 0.86 * amp * n;
                if (live) {
                  // sound on: the band's energy, its changes against its own slow average (birds, drops, a passing
                  // car jump out), the organic motion riding on top; an empty band still breathes at the floor
                  eqS[i] += (live[i] - eqS[i]) * 0.04;
                  const lev = live[i] * (0.5 + 0.7 * n) + Math.max(0, live[i] - eqS[i]) * 5;
                  target = Math.max(0.12 + 0.88 * Math.min(1, lev), 0.14 + 0.86 * amp * n * 0.55);
                }
              }
              eqH[i] += (target - eqH[i]) * (still() ? 1 : 1 - Math.exp(-dt * (live ? 18 : 9)));
              bar.style.transform = 'scaleY(' + eqH[i].toFixed(3) + ')';
            });
            busy = busy || !still();
          }
        }
        if (pick === 'b' && db !== lastDb) { lastDb = db; num.textContent = db; arc.style.strokeDasharray = (loud * 100).toFixed(1) + ' 100'; }
        if (pick === 'b') busy = true;
      }
      if (pick === 'd') { const s = photo ? T.pageDb() + ' dB' : 'X ' + String(Math.round(x)).padStart(4, '0') + ' · Y ' + String(Math.round(y + window.scrollY)).padStart(5, '0'); if (s !== lastXY) { lastXY = s; xy.textContent = s; } }
      if (busy && seen && !document.hidden) raf = requestAnimationFrame(step);
    };
    const PHOTO = 'picture, img, .card-media, .day-frame, [data-pano], [data-hero], #contact [data-zoom]';
    const move = (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      x = e.clientX; y = e.clientY; lastMove = performance.now();
      if (!seen) { cx = x; cy = y; seen = true; c.classList.add('on'); }
      c.classList.toggle('flip', x > window.innerWidth - 160);   // keep the label inside the window
      const t = e.target.closest ? e.target : document.body;
      const k = t.closest('[data-cursor]');
      const m = k ? k.getAttribute('data-cursor') : t.closest('.card') ? 'View' : (daySecEl && dayDb && daySecEl.contains(t)) ? 'db' : '';
      if (m !== mode) { mode = m; c.classList.toggle('pill', !!m); lab.textContent = text(); }
      c.classList.toggle('hot', !m && !!t.closest('a[href], button, [role="slider"], label'));
      const ph = !m && !!t.closest(PHOTO) && !t.closest('a, button, input, label, .label, h1, h2, p');
      if (ph !== photo) { photo = ph; c.classList.toggle('photo', ph); }
      if (!raf) raf = requestAnimationFrame(step);
    };
    const ripple = (e) => {
      if ((e.pointerType && e.pointerType !== 'mouse') || still() || !(pick === 'c' || pick === 'e')) return;
      [0, 120].forEach((d) => {
        const r = document.createElement('i'); r.style.transform = 'translate3d(' + e.clientX + 'px,' + e.clientY + 'px,0)'; rip.appendChild(r);
        const a = r.animate([{ transform: 'translate3d(' + e.clientX + 'px,' + e.clientY + 'px,0) scale(.2)', opacity: 0.9 }, { transform: 'translate3d(' + e.clientX + 'px,' + e.clientY + 'px,0) scale(1)', opacity: 0 }], { duration: 600, delay: d, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' });
        a.onfinish = () => r.remove();
      });
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerdown', ripple, { passive: true });
    window.addEventListener('scroll', () => { if (seen && !raf) raf = requestAnimationFrame(step); }, { passive: true });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && seen && !raf) raf = requestAnimationFrame(step); });
    document.documentElement.addEventListener('pointerleave', () => { seen = false; c.classList.remove('on'); });
    document.addEventListener('tysha:day', () => { if (seen && !raf) raf = requestAnimationFrame(step); });
    FINE.addEventListener && FINE.addEventListener('change', () => { if (!FINE.matches) { c.remove(); rip.remove(); window.removeEventListener('pointermove', move); } });
    apply(pick);

    // after the page changes under a still pointer (the form's success state, a closed dialog): drop a stale label
    const refresh = () => { mode = ''; c.classList.remove('pill', 'hot'); lab.textContent = ''; };
    T.cursor = { set: apply, get: () => pick, refresh };
  }

  /* ---------- 3g. the compact bar: after the hero, a thin strip with the mark, the menu, Contact and Sound. It hides
     while you read down and comes back as soon as you scroll up. Its buttons drive the header's own (one state). */
  if (header && root) {
    const hero = q('[data-hero]', root);
    const bar = document.createElement('div');
    bar.className = 't-bar';
    const home = q('.brand', header).getAttribute('href');
    const links = nav ? qa('a', nav).map((a) => '<a href="' + a.getAttribute('href') + '"' + (a.hasAttribute('aria-current') ? ' aria-current="page"' : '') + '>' + a.textContent + '</a>').join('') : '';
    bar.innerHTML = '<a class="t-bar-mark" href="' + home + '" aria-label="TYSHA Architecture, home"><svg width="16" height="19" viewBox="0 0 200 240" aria-hidden="true"><use href="#l-arch"></use></svg></a>'
      + '<span class="t-bar-db label" aria-hidden="true"></span>'
      + '<nav class="t-bar-nav label" aria-label="Quick links">' + links + '</nav>'
      + '<span class="t-bar-end"></span>';
    const end = q('.t-bar-end', bar), dbEl = q('.t-bar-db', bar);
    const realSound = q('.t-sound', header), realMenu = q('.t-menu-btn', header);
    if (realSound) {
      const b2 = document.createElement('button'); b2.type = 'button'; b2.className = 't-pill t-bar-sound'; b2.setAttribute('data-cursor', 'Listen');
      const sync = () => { b2.innerHTML = realSound.innerHTML; b2.setAttribute('aria-pressed', realSound.getAttribute('aria-pressed')); };
      sync(); new MutationObserver(sync).observe(realSound, { attributes: true, childList: true, subtree: true, characterData: true });
      b2.addEventListener('click', () => realSound.click()); end.appendChild(b2);
    }
    if (realMenu) {
      const m2 = document.createElement('button'); m2.type = 'button'; m2.className = 't-pill t-bar-menu'; m2.textContent = 'Menu';
      m2.setAttribute('aria-controls', 't-menu'); m2.setAttribute('aria-expanded', 'false');
      m2.addEventListener('click', () => realMenu.click()); end.appendChild(m2);
      new MutationObserver(() => m2.setAttribute('aria-expanded', realMenu.getAttribute('aria-expanded'))).observe(realMenu, { attributes: true, attributeFilter: ['aria-expanded'] });
    }
    document.body.appendChild(bar);
    let lastY = -1, shown = false, raf2 = 0;    // read on the first scroll: a scrollY read here would force the page's first layout inside this script
    const set = (v) => { if (v === shown) return; shown = v; bar.classList.toggle('on', v); bar.inert = !v; };
    bar.inert = true;
    const tick = () => {
      raf2 = 0;
      const y = window.scrollY, past = y > (hero ? hero.offsetTop + hero.offsetHeight - 80 : window.innerHeight * 0.8);
      if (lastY < 0) lastY = y;
      if (!past) set(false);
      else if (y < lastY - 6) set(true);
      else if (y > lastY + 6) set(false);
      if (Math.abs(y - lastY) > 6) lastY = y;
      if (shown && T.pageDb) dbEl.textContent = T.pageDb() + ' dB';
    };
    window.addEventListener('scroll', () => { if (!raf2) raf2 = requestAnimationFrame(tick); }, { passive: true });
    // a keyboard user tabbing into the page with the bar hidden never meets it; when they Shift+Tab upward it shows
    bar.addEventListener('focusin', () => set(true));
  }

  /* ---------- 3d. privacy note: a small corner toast, remembered in this browser only ---------- */
  let seen = false;
  try { seen = !!localStorage.getItem('tysha-quiet'); } catch (e) { /* storage blocked: show the note */ }
  if (!seen && !document.body.hasAttribute('data-no-note')) {
    const n = document.createElement('div');
    n.className = 't-note'; n.setAttribute('role', 'region'); n.setAttribute('aria-label', 'Privacy note');
    n.innerHTML = '<p><span class="k">No trackers</span> · no cookies · <a href="' + BASE + 'privacy/">Privacy</a></p><button type="button" class="t-pill">OK</button>';
    // it appears after the first real scroll, and steps aside while the day timeline or the contact is on screen
    let shown = false;
    const dismiss = () => { try { localStorage.setItem('tysha-quiet', '1'); } catch (e) { /* not remembered */ } n.classList.remove('on'); setTimeout(() => n.remove(), 600); };
    // it leaves by itself after eight seconds (the Privacy link in the footer stays)
    const show = () => { if (shown) return; shown = true; document.body.appendChild(n); requestAnimationFrame(() => n.classList.add('on')); setTimeout(dismiss, 8000); };
    // only once the hero has gone by (it never lands on the first screen's text), read on scroll, not at start-up
    const heroEl = q('[data-hero]');
    const onScroll = () => {
      const past = heroEl ? heroEl.getBoundingClientRect().bottom < window.innerHeight * 0.35 : window.scrollY > window.innerHeight;
      if (past) { window.removeEventListener('scroll', onScroll); setTimeout(show, 600); }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    const busy = qa('[data-pin="400"], #contact, .case-end');
    if (busy.length && 'IntersectionObserver' in window) {
      const on = new Set();
      const io = new IntersectionObserver((es) => { es.forEach((e) => (e.isIntersecting ? on.add(e.target) : on.delete(e.target))); n.classList.toggle('away', on.size > 0); });
      busy.forEach((el) => io.observe(el));
    }
    q('button', n).addEventListener('click', dismiss);
  }
})();
