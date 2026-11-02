/* TYSHA — shared behaviour
   1. scroll engine: reveals (IntersectionObserver), text scramble, count-ups, scroll-linked scenes
   2. dB badge and axis gaps
   3. contact form, footer clocks, mobile menu, privacy note
   Scroll-linked work reads geometry once (cached on resize / layout change) and only writes
   transform and opacity per frame. prefers-reduced-motion turns every movement into plain fades. */
(() => {
  'use strict';
  const BASE = new URL('../', document.currentScript.src).href;
  const T = window.TYSHA = window.TYSHA || {};
  const root = document.querySelector('[data-t-root]');
  const RM = window.matchMedia('(prefers-reduced-motion: reduce)');
  const q = (s, r = document) => r.querySelector(s);
  const qa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const GL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/·—';
  T.reduced = () => RM.matches;

  /* ---------- 1. scroll engine ---------- */
  function start() {
    if (T.started) return; T.started = true;
    const reduced = RM.matches;

    // reveal: headings and [data-rise] rows rise in; pending state lives in .rv
    const reveals = qa('h1, h2, h3, blockquote, [data-rise]', root).filter((el) => !el.closest('[data-st-layer]') && !el.classList.contains('sr-only'));
    reveals.forEach((el) => {
      const rise = el.hasAttribute('data-rise');
      const i = rise ? Array.from(el.parentElement.children).filter((c) => c.hasAttribute('data-rise')).indexOf(el) : 0;
      el._d = Math.max(0, i) * 0.09;
      if (el._d) el.style.setProperty('--d', el._d + 's');
      el.classList.add('rv'); if (!rise && !reduced) el.classList.add('rv-blur');
    });
    const imgs = qa('img', root).filter((im) => !im.closest('[data-noreveal]'));
    imgs.forEach((im) => im.classList.add('rv-img'));
    const scr = qa('.mono, .label, [data-scramble]', root).filter((el) => {
      const par = el.parentElement && el.parentElement.closest('.mono, .label, [data-scramble]');
      return !par && !el.closest('[data-noscramble]') && !el.hasAttribute('data-noscramble');
    });
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
      el._scr = { type: 's', el, parts, rev, dur: 650 + Math.min(900, len * 16) };
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
    const revealImg = (im) => {
      if (im._rv) return; im._rv = true;
      im.classList.add('in');
      setTimeout(() => im.classList.remove('rv-img', 'in'), 2000);
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
    watch([...byHolder.keys()], '0px 0px -8% 0px', (h) => byHolder.get(h).forEach(revealImg));
    watch(scr, '0px 0px -4% 0px', scramble);
    watch(counts, '0px 0px -12% 0px', countUp);

    // keyboard users: whatever receives focus is shown at once, never left at opacity 0 or scrambled
    document.addEventListener('focusin', (e) => {
      for (let el = e.target; el && el !== root; el = el.parentElement) {
        if (el.classList.contains('rv')) reveal(el);
        if (el._tn) { scramble(el); finishScramble(el); }
      }
      qa('img.rv-img', e.target).forEach(revealImg);
      const st = e.target.closest && e.target.closest('[data-st-fade]');
      if (st && G.st) window.scrollTo({ top: G.st.top, behavior: 'instant' });
    });

    // ---- scroll-linked scenes ----
    const hero = q('[data-hero]', root), heroImg = q('[data-hero-img]', root), heroFade = qa('[data-hero-fade]', root), heroWm = q('[data-hero-wm]', root);
    const st = q('[data-pin="320"]', root);
    const stInner = st && q('[data-pin-inner]', st), stPill = q('[data-st-pill]', root), stLayer = q('[data-st-layer]', root), stLayerImg = q('[data-st-layer-img]', root), stOver = q('[data-st-over]', root), stFade = qa('[data-st-fade]', root);
    const day = q('[data-pin="460"]', root), dayBar = q('[data-day-bar]', root);
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
        zoom: zoom && box(zoom.parentElement),
        floats: floats.map((el) => { const b = box(el); b.top -= el._ty || 0; return b; }),
      };
      if (st && stInner && stPill) {
        const ir = stInner.getBoundingClientRect(), pr = stPill.getBoundingClientRect();
        const s = box(st);
        s.t = pr.top - ir.top; s.l = pr.left - ir.left; s.r = ir.right - pr.right; s.b = ir.bottom - pr.bottom;
        s.pw = pr.width; s.ph = pr.height; s.W = ir.width; s.H = ir.height;
        // start the expanding layer from exactly the crop the pill shows (both are object-fit: cover)
        const nw = stLayerImg.naturalWidth || stPill.naturalWidth, nh = stLayerImg.naturalHeight || stPill.naturalHeight;
        if (nw && nh) {
          const sP = Math.max(s.pw / nw, s.ph / nh), sL = Math.max(s.W / nw, s.H / nh);
          s.k0 = sP / sL; s.cx = s.l + s.pw / 2 - s.W / 2; s.cy = s.t + s.ph / 2 - s.H / 2;
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
        const p = clamp(-top / (s.h - ih)); const e = clamp((ih - top) / ih);
        const fade = 1 - clamp((p - 0.2) / 0.18);
        stFade.forEach((el) => { el.style.opacity = String(Math.min(e, fade)); });
        const a = ease(clamp((p - 0.14) / 0.42));
        if (a <= 0.001) { stLayer.style.visibility = 'hidden'; stPill.style.opacity = '1'; }
        else if (still) { stLayer.style.visibility = 'visible'; stLayer.style.clipPath = ''; stLayer.style.opacity = String(a); stPill.style.opacity = '1'; }
        else {
          const k = 1 - a;
          stLayer.style.visibility = 'visible'; stLayer.style.opacity = ''; stPill.style.opacity = '0';
          stLayer.style.clipPath = 'inset(' + (s.t * k) + 'px ' + (s.r * k) + 'px ' + (s.b * k) + 'px ' + (s.l * k) + 'px round ' + (s.ph / 2 * k) + 'px)';
          stLayerImg.style.transform = 'translate3d(' + (s.cx * k) + 'px,' + (s.cy * k) + 'px,0) scale(' + (s.k0 + (1 - s.k0) * a) + ')';
        }
        const o = clamp((p - 0.6) / 0.2);
        stOver.style.opacity = String(o); stOver.style.transform = still ? '' : 'translate3d(0,' + ((1 - o) * 60) + 'px,0)';
      }
      if (G.day) {
        const top = G.day.top - y; const p = clamp(-top / (G.day.h - ih));
        if (dayBar) dayBar.style.transform = 'scaleX(' + p + ')';
        if (top < ih && top + G.day.h > 0 && T.setDay) { const idx = Math.min(4, Math.floor(p * 5)); if (idx !== T.day) T.setDay(idx); }
      }
      if (!still) {
        const f = vw <= 760 ? 0.35 : 1;
        floats.forEach((el, i) => {
          const b = G.floats[i]; const qq = clamp((ih - (b.top - y)) / (ih + b.h));
          el._ty = (0.5 - qq) * parseFloat(el.getAttribute('data-float')) * f;
          el.style.transform = 'translate3d(0,' + el._ty + 'px,0)';
        });
        if (G.pano) { const qq = clamp((ih - (G.pano.top - y)) / (ih * 0.85)); const x = 24 * (1 - ease(qq)); pano.style.clipPath = 'inset(0 ' + x + '% 0 ' + x + '%)'; if (panoImg) panoImg.style.transform = 'scale(' + (1.3 - 0.3 * qq) + ')'; }
        if (G.marq) { const qq = clamp((ih - (G.marq.top - y)) / (ih + G.marq.h)); marq.style.transform = 'translate3d(' + (-qq * 38) + '%,0,0)'; }
        if (G.zoom) { const qq = clamp((ih - (G.zoom.top - y)) / (ih + G.zoom.h)); zoom.style.transform = 'scale(' + (1.25 - 0.25 * qq) + ')'; }
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
    RM.addEventListener && RM.addEventListener('change', () => { qa('[data-float], [data-marquee], [data-zoom], [data-hero-img], [data-hero-wm], [data-pano-img]', root).forEach((el) => { el.style.transform = ''; }); if (pano) pano.style.clipPath = ''; remeasure(); });
    sy = window.scrollY; measure(); frame();
    badge();
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
      if (!spans.length) { ax.style.maskImage = ax.style.webkitMaskImage = ''; return; }
      spans.sort((a, b) => a[0] - b[0]);
      const merged = [];
      spans.forEach((s) => { const m = merged[merged.length - 1]; if (m && s[0] <= m[1]) m[1] = Math.max(m[1], s[1]); else merged.push(s.slice()); });
      const stops = ['#000 0px'];
      merged.forEach(([a, b]) => { stops.push('#000 ' + Math.round(a) + 'px', 'transparent ' + Math.round(a) + 'px', 'transparent ' + Math.round(b) + 'px', '#000 ' + Math.round(b) + 'px'); });
      const g = 'linear-gradient(to bottom,' + stops.join(',') + ')';
      ax.style.maskImage = g; ax.style.webkitMaskImage = g;
    });
  }

  /* ---------- 2b. dB badge: shows the label value of the section at the viewport centre ---------- */
  function badge() {
    const el = q('[data-db-badge]'); if (!el) return;
    const secs = qa('section', root).map((s) => {
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
  }

  if (!document.body.hasAttribute('data-preloader')) start();

  /* ---------- 3a. contact form (simulated: no backend in this concept) ---------- */
  const form = q('[data-form]');
  if (form) {
    const sent = q('[data-sent]'), fail = q('[data-fail]', form), btn = q('[data-send]', form), status = q('[data-form-status]', form);
    const F = (n) => q('[name="' + n + '"]', form);
    const MSG = { name: 'Tell us your name, so we know who to answer.', empty: 'We need a phone or an email to reply.', bad: "That doesn't look like a phone or an email." };
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
        q('[data-sent-msg]', sent).textContent = 'Thank you, ' + name + ". We'll reply within two working days from hello@tysha.studio. " + (find ? "We'll start by looking for a quiet plot together." : "First we'll ask for the plot's address, to plan the audit.");
        form.style.display = 'none'; sent.style.display = 'flex'; sent.setAttribute('tabindex', '-1'); sent.focus({ preventScroll: true });
      }, 1600);
    });
    const again = q('[data-again]');
    if (again) again.addEventListener('click', () => { form.reset(); ['name', 'contact'].forEach((n) => setErr(n, '')); btn.textContent = 'Send'; sent.style.display = 'none'; form.style.display = 'flex'; F('name').focus(); });
  }

  /* ---------- 3b. live clocks in the footer ---------- */
  const clocks = qa('[data-clock]');
  const tickClock = () => clocks.forEach((c) => { try { c.textContent = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: c.getAttribute('data-clock') }).format(new Date()); } catch (e) { /* keep the static time */ } });
  if (clocks.length) { tickClock(); setInterval(tickClock, 20000); }

  /* ---------- 3c. mobile menu (up to 1024px): dialog with focus trap, Esc, focus return ---------- */
  const header = q('.site-head'), nav = header && q('nav[aria-label="Main"]', header);
  if (nav) {
    const DB = { Projects: '40 dB', Method: '33 dB', Studio: '27 dB', Contact: '25 dB' };
    const b = document.createElement('button');
    b.type = 'button'; b.className = 't-pill t-menu-btn'; b.textContent = 'Menu';
    b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-controls', 't-menu');
    header.appendChild(b);
    const ov = document.createElement('div');
    ov.id = 't-menu'; ov.className = 't-menu'; ov.hidden = true;
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Menu');
    ov.innerHTML = '<div class="t-menu-axis"></div><div class="t-menu-top"><span>Tysha<br><span class="t-mute">Architecture</span></span><button type="button" class="t-pill" data-close>Close</button></div>'
      + '<nav class="t-menu-list" aria-label="Menu">' + qa('a', nav).map((a, i) => '<a href="' + a.getAttribute('href') + '"' + (a.hasAttribute('aria-current') ? ' aria-current="page"' : '') + '><span class="n">0' + (i + 1) + '</span><span class="t">' + a.textContent + '</span><span class="d">' + (DB[a.textContent] || '') + '</span></a>').join('') + '</nav>'
      + '<div class="t-menu-foot"><a href="mailto:hello@tysha.studio" class="case-none">hello@tysha.studio</a><span>+48 22 000 00 00</span><span class="t-mute">Lviv — Warsaw · Now: 25 dB</span></div>';
    document.body.appendChild(ov);
    const de = document.documentElement;
    const others = () => [root, q('.skip-link'), q('.t-note')].filter(Boolean);
    const open = () => {
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
      if (refocus) b.focus();
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

  /* ---------- 3d. privacy note: a small corner toast, remembered in this browser only ---------- */
  let seen = false;
  try { seen = !!localStorage.getItem('tysha-quiet'); } catch (e) { /* storage blocked: show the note */ }
  if (!seen && !document.body.hasAttribute('data-no-note')) {
    const n = document.createElement('div');
    n.className = 't-note'; n.setAttribute('role', 'region'); n.setAttribute('aria-label', 'Privacy note');
    n.innerHTML = '<p><span class="k">No trackers.</span> No cookies, no analytics. <a href="' + BASE + 'privacy/">Privacy</a></p><button type="button" class="t-pill">Good</button>';
    const show = () => { document.body.appendChild(n); requestAnimationFrame(() => n.classList.add('on')); };
    if (T.started || !document.body.hasAttribute('data-preloader')) setTimeout(show, 1500);
    else document.addEventListener('tysha:ready', () => setTimeout(show, 1200), { once: true });
    q('button', n).addEventListener('click', () => { try { localStorage.setItem('tysha-quiet', '1'); } catch (e) { /* not remembered */ } n.classList.remove('on'); setTimeout(() => n.remove(), 600); });
  }
})();
