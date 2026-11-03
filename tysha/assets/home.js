/* TYSHA — home only: the "day at Lull House" switcher and the preloader */
(() => {
  'use strict';
  const T = window.TYSHA;
  const q = (s, r = document) => r.querySelector(s);
  const qa = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------- day switcher ---------- */
  const DAYS = [['06:10', 31, 'The living room at blue dawn, mist over the lake beyond the long window'], ['09:00', 34, 'A woman in slippers on the bench by the window with a cup of coffee, morning sun on the lake'], ['14:30', 28, 'The empty living room in soft daylight, slippers left on the rug'], ['19:00', 33, 'Dusk after the rain, one warm lamp on, slippers by the sofa, the lake mirroring the sky'], ['23:40', 21, 'The living room at night, a lamp on, the moon over the lake, slippers on the rug']];
  const dayImgs = qa('[data-day-img]'), dayBtns = qa('[data-day-btn]');
  // the four hidden photos load only when the section comes near
  const loadDays = () => dayImgs.forEach((im) => {
    const pic = im.parentElement.tagName === 'PICTURE' ? im.parentElement : null;
    [im, ...(pic ? qa('source', pic) : [])].forEach((el) => {
      if (el.dataset.srcset) { el.srcset = el.dataset.srcset; el.removeAttribute('data-srcset'); }
      if (el.dataset.src) { el.src = el.dataset.src; el.removeAttribute('data-src'); }
    });
  });
  const daySec = q('[data-pin="400"]');
  if (daySec && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); loadDays(); } }, { rootMargin: '150% 0px' });
    io.observe(daySec);
  } else loadDays();
  T.day = 0; T.dayDb = DAYS[0][1];
  // the big dB number counts to its new value instead of jumping
  const dayDb = q("#day-db"); let dbNow = DAYS[0][1], dbRaf = 0;
  const countTo = (to) => {
    cancelAnimationFrame(dbRaf);
    if (T.reduced()) { dbNow = to; dayDb.textContent = to; return; }
    const from = dbNow, t0 = performance.now(), dur = 700;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      dbNow = Math.round(from + (to - from) * e); dayDb.textContent = dbNow;
      if (k < 1) dbRaf = requestAnimationFrame(step);
    };
    dbRaf = requestAnimationFrame(step);
  };
  T.setDay = (i) => {
    T.day = i; T.dayDb = DAYS[i][1];
    dayImgs.forEach((im) => { const on = +im.dataset.dayImg === i; im.classList.toggle('on', on); im.alt = on ? DAYS[i][2] : ''; });
    dayBtns.forEach((bt) => bt.setAttribute('aria-pressed', String(+bt.dataset.dayBtn === i)));
    countTo(DAYS[i][1]);
    q('#day-time').textContent = DAYS[i][0];
    document.dispatchEvent(new CustomEvent('tysha:day', { detail: i }));
  };
  dayBtns.forEach((bt) => bt.addEventListener('click', () => { loadDays(); T.setDay(+bt.dataset.dayBtn); }));

  /* ---------- preloader ----------
     Storyboard: five slabs rise, the letters are carved into TYSHA, a slit opens onto the hero photo
     and the wordmark settles into its place in the hero. Full version (~2.5 s) once per session,
     a short one (~1.1 s) after that; click, key, wheel or touch skips; none at all with reduced motion. */
  const root = q('[data-t-root]');
  const de = document.documentElement;
  const ready = () => document.dispatchEvent(new Event('tysha:ready'));
  let seen = false;
  try { seen = sessionStorage.getItem('tysha-pre') === '1'; } catch (e) { /* no storage: treat as first visit */ }
  // once per session only: internal navigation back home (or a reload) goes straight to the page
  if (seen || T.reduced() || !('animate' in Element.prototype)) { T.start(); ready(); return; }
  try { sessionStorage.setItem('tysha-pre', '1'); } catch (e) { /* fine */ }
  try { history.scrollRestoration = 'manual'; } catch (e) { /* fine */ }
  window.scrollTo(0, 0);

  const heroImg = q('[data-hero-img]'), heroWm = q('[data-hero-wm]');
  const full = !seen;
  const EZ = 'cubic-bezier(.45,0,.55,1)', EZ3 = 'cubic-bezier(.65,0,.35,1)';
  const SLABS = ['<rect width="200" height="240" rx="12"/>', '<rect x="214" width="200" height="240" rx="12"/>', '<rect x="428" width="200" height="240" rx="40"/>', '<rect x="642" width="200" height="240" rx="12"/>', '<path d="M856 240 V70 Q856 0 926 0 H986 Q1056 0 1056 70 V240 Z"/>'];
  // cut-outs at their final size, each grown from the origin the letter is carved from
  const CUTS = [
    ['<rect x="-4" y="92" width="60" height="152"/>', '0 244px', 'scaleY'], ['<rect x="144" y="92" width="60" height="152"/>', '0 244px', 'scaleY'],
    ['<polygon points="279,-4 349,-4 314,118"/>', '314px -4px', 'scale'],
    ['<rect x="210" y="150" width="60" height="94"/>', '0 244px', 'scaleY'], ['<rect x="358" y="150" width="60" height="94"/>', '0 244px', 'scaleY'],
    ['<rect x="484" y="74" width="148" height="12"/>', '632px 0', 'scaleX'], ['<rect x="424" y="154" width="148" height="12"/>', '424px 0', 'scaleX'],
    ['<rect x="732" y="-4" width="20" height="100"/>', '0 -4px', 'scaleY'], ['<rect x="732" y="144" width="20" height="100"/>', '0 244px', 'scaleY'],
    ['<polygon points="925,244 987,244 966,170 946,170"/>', '956px 244px', 'scale'],
    ['<rect x="948" y="84" width="16" height="44"/>', '0 106px', 'scaleY'],
  ];
  const pre = document.createElement('div');
  pre.id = 'pre'; pre.className = 'pre'; pre.setAttribute('aria-hidden', 'true');
  pre.innerHTML = '<div class="pre-photo"><img alt="" src="' + (heroImg.currentSrc || heroImg.src) + '"><i></i></div>'
    + '<div class="pre-shut pre-shut-l"></div><div class="pre-shut pre-shut-r"></div>'
    + '<svg class="pre-wm" viewBox="0 0 1056 240" overflow="visible"><g class="pre-build">'
    + SLABS.map((s) => '<g class="pre-slab">' + s + '</g>').join('')
    + '<g class="pre-cuts">' + CUTS.map(([s, o]) => s.replace('/>', ' style="transform-origin:' + o + '"/>')).join('') + '</g></g>'
    + '<use class="pre-final" href="#l-wm"/></svg>'
    + '<div class="pre-cap pre-cap-t label"><span>Tysha Architecture<br><span class="tone-5">Lviv — Warsaw</span></span><span>Architecture of silence<br><span class="tone-5">Est. 2014</span></span><span>Private houses<br><span class="tone-5">38 built, 6 a year</span></span><span class="ta-r">Now: <span data-pre-db>68</span> dB<br><span class="tone-5">Turning the city down</span></span></div>'
    + '<div class="pre-cap pre-cap-b label"><span>We design homes where<br>the loudest thing is the rain.</span><span class="tone-5">49.9312° N<br>23.6187° E</span><span class="case-none"><span class="f">LULL_HOUSE.JPG</span> <span class="f">PINE_COURT.JPG</span> <span class="f">HOLLOW.JPG</span></span><span class="ta-r">Loading quiet<br><span data-pre-pct>000</span> / 100</span></div>';
  document.body.appendChild(pre);
  root.inert = true; de.style.overflow = 'hidden';
  // one frame for the photo: the preloader's copy takes the hero image's exact box, crop and scrim (the hero photo can
  // reach below the fold and is bottom-aligned), so when the shutters open and the layer fades, nothing under it moves
  const pImg = q('.pre-photo img', pre), pShade = q('.pre-photo i', pre), shade = q('.shade-hero');
  const place = (el, r) => Object.assign(el.style, { inset: 'auto', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  place(pImg, heroImg.getBoundingClientRect()); pImg.style.objectPosition = getComputedStyle(heroImg).objectPosition;
  if (shade) { place(pShade, shade.getBoundingClientRect()); pShade.style.background = getComputedStyle(shade).backgroundImage; }

  // geometry, read once: from a centred wordmark to the hero wordmark
  const VW = window.innerWidth, VH = window.innerHeight;
  const er = heroWm.getBoundingClientRect();
  const wm = q('.pre-wm', pre);
  Object.assign(wm.style, { left: er.left + 'px', top: er.top + 'px', width: er.width + 'px', height: er.height + 'px' });
  const sw = VW * (VW <= 760 ? 0.8 : 0.389), sh = sw * 240 / 1056;
  const from = 'translate3d(' + ((VW - sw) / 2 - er.left) + 'px,' + (VH / 2 - sh / 2 - er.top) + 'px,0) scale(' + (sw / er.width) + ')';
  wm.style.transform = from;

  // real loading: hero photo decoded + fonts ready
  let loaded = 0; const need = 2; let loadedAt = 0;
  const done = () => { loaded++; if (loaded >= need) loadedAt = performance.now(); };
  (heroImg.decode ? heroImg.decode() : Promise.resolve()).then(done, done);
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(done, done);

  const anims = [];
  const A = (el, kf, o) => { const a = el.animate(kf, Object.assign({ fill: 'both', easing: EZ }, o)); anims.push(a); return a; };
  const caps = qa('.pre-cap', pre), final = q('.pre-final', pre), build = q('.pre-build', pre);
  const dbEl = q('[data-pre-db]', pre), pctEl = q('[data-pre-pct]', pre);
  const t0 = performance.now();
  const BUILD = full ? 1150 : 0;
  let opened = false, finished = false;

  if (full) {
    caps.forEach((c) => A(c, [{ opacity: 0 }, { opacity: 1 }], { duration: 250 }));
    qa('.pre-slab', pre).forEach((s, i) => A(s, [{ transform: 'translateY(40px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 320, delay: 100 + i * 90 }));
    qa('.pre-cuts > *', pre).forEach((c, i) => A(c, [{ transform: CUTS[i][2] + '(0)' }, { transform: CUTS[i][2] + '(1)' }], { duration: 500, delay: 650 }));
    final.style.opacity = '0';
  } else { build.style.opacity = '0'; caps.forEach((c) => { c.style.opacity = '0'; }); }

  // the counter follows the slower of time and real loading
  const count = () => {
    if (finished) return;
    const t = performance.now() - t0;
    const k = Math.min(full ? Math.min(1, t / BUILD) : 1, (loaded / need) * 0.9 + (loaded >= need ? 0.1 : 0));
    dbEl.textContent = String(Math.round(68 - 43 * k));
    pctEl.textContent = String(Math.round(100 * k)).padStart(3, '0');
    if (!opened && t >= BUILD && (loaded >= need || t > 4000)) open();
    requestAnimationFrame(count);
  };
  requestAnimationFrame(count);

  function open() {
    opened = true;
    final.style.opacity = '1'; build.style.opacity = '0';
    const s = full ? 0 : -100;
    A(q('.pre-shut-l', pre), [{ transform: 'none' }, { transform: 'translateX(-100%)' }], { duration: 550, delay: 0 });
    A(q('.pre-shut-r', pre), [{ transform: 'none' }, { transform: 'translateX(100%)' }], { duration: 550, delay: 0 });
    if (full) caps.forEach((c) => A(c, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, delay: 350 }));
    A(wm, [{ transform: from }, { transform: 'none' }], { duration: full ? 600 : 500, delay: 450 + s, easing: EZ3 });
    A(pre, [{ opacity: 1 }, { opacity: 0 }], { duration: 300, delay: 1050 + s * 2 }).finished.then(end, end);
    setTimeout(begin, 1050 + s * 2);
  }
  let begun = false;
  function begin() { if (begun) return; begun = true; root.inert = false; de.style.overflow = ''; T.start(); }
  function end() { if (finished) return; finished = true; begin(); pre.remove(); off(); ready(); }
  function skip() {
    if (finished) return;
    anims.forEach((a) => a.cancel());
    wm.style.transform = 'none'; final.style.opacity = '1'; build.style.opacity = '0';
    begin();
    pre.animate([{ opacity: getComputedStyle(pre).opacity }, { opacity: 0 }], { duration: 200, fill: 'both' }).finished.then(end, end);
  }
  const EV = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
  const off = () => EV.forEach((e) => window.removeEventListener(e, skip, true));
  EV.forEach((e) => window.addEventListener(e, skip, { capture: true, passive: true }));
})();
