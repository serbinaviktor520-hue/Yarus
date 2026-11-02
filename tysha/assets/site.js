/* TYSHA — shared behaviour: scroll engine, form, clocks, mobile menu, privacy note */
const SITE_BASE = new URL('../', document.currentScript.src).href;
const T = window.TYSHA = window.TYSHA || {};
const ROOT = document.querySelector('[data-t-root]');
document.querySelectorAll('a[href="#"]').forEach((a) => a.addEventListener('click', (e) => e.preventDefault()));
function prep() {
const root = ROOT;
root.style.overflow = 'visible'; root.style.overflowX = 'clip';
const hero = root.querySelector('[data-hero]');
const VH = (window.CSS && CSS.supports && CSS.supports('height', '100svh')) ? '100svh' : '100vh';
if (hero) { hero.style.height = VH; if (window.innerWidth > 760) hero.style.minHeight = '720px'; }
const hp = root.querySelector('[data-hero-pill]'); if (hp) hp.style.display = 'none';
root.querySelectorAll('[data-pin]').forEach((sec) => {
sec.style.height = sec.getAttribute('data-pin') + 'vh';
const inner = sec.querySelector('[data-pin-inner]');
if (inner) { inner.style.position = 'sticky'; inner.style.top = '0'; inner.style.height = VH; inner.style.overflow = 'hidden'; }
});
const f = root.querySelector('[data-dbfix]'); if (f) f.style.display = 'block';
const l = root.querySelector('[data-dbline]'); if (l) l.style.display = 'block';
}

function startEngine() {
const self = {}; const root = ROOT;
const qa = (sel) => Array.from(root.querySelectorAll(sel));
const q = (sel) => root.querySelector(sel);
const clamp = (x) => Math.max(0, Math.min(1, x));
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const GL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/·—';
const EZ = 'cubic-bezier(.16,.84,.24,1)';

const reveals = qa('h1, h2, h3, blockquote, [data-rise]').filter((el) => !el.closest('[data-st-layer]'));
reveals.forEach((el) => {
let i = 0;
if (el.hasAttribute('data-rise')) i = Array.from(el.parentElement.children).filter((c) => c.hasAttribute('data-rise')).indexOf(el);
el._d = Math.max(0, i) * 0.09;
el._blur = !el.hasAttribute('data-rise');
el.style.transition = 'none'; el.style.opacity = '0'; el.style.transform = 'translateY(56px)'; if (el._blur) el.style.filter = 'blur(12px)';
});
const imgs = qa('img').filter((im) => !im.closest('[data-noreveal]'));
imgs.forEach((im) => { im.style.transition = 'none'; im.style.clipPath = 'inset(100% 0 0 0)'; im.style.transform = 'scale(1.25)'; });
const scr = qa('.mono, .label, [data-scramble]').filter((el) => {
const par = el.parentElement && el.parentElement.closest('.mono, .label, [data-scramble]');
return !par && !el.closest('[data-dbfix]') && !el.closest('[data-noscramble]') && !el.hasAttribute('data-noscramble');
});
scr.forEach((el) => {
const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
const nodes = []; let n;
while ((n = w.nextNode())) { if (n.nodeValue.trim() && !(n.parentElement && n.parentElement.closest('[data-noscramble]'))) nodes.push({ n: n, o: n.nodeValue }); }
el._tn = nodes; el.style.opacity = '0';
});
const counts = qa('[data-count]');
const floats = qa('[data-float]');
root.getBoundingClientRect();
requestAnimationFrame(() => {
reveals.forEach((el) => { el.style.transition = 'opacity 1.1s ' + EZ + ' ' + el._d + 's, transform 1.3s ' + EZ + ' ' + el._d + 's, filter 1.1s ' + EZ + ' ' + el._d + 's'; });
imgs.forEach((im) => { im.style.transition = 'clip-path 1.5s cubic-bezier(.77,0,.18,1), transform 1.9s ' + EZ; });
});

const active = []; let ticking = false;
const tick = () => {
if (self._dead) return;
const now = performance.now();
for (let k = active.length - 1; k >= 0; k--) {
const a = active[k]; const p = (now - a.t0) / a.dur;
if (a.type === 's') {
let gi = 0;
a.el._tn.forEach((t) => {
let out = '';
for (let i = 0; i < t.o.length; i++, gi++) {
const ch = t.o[i];
out += (ch === ' ' || p >= a.rev[gi]) ? ch : GL[(Math.random() * GL.length) | 0];
}
t.n.nodeValue = out;
});
if (p >= 1) { a.el._tn.forEach((t) => { t.n.nodeValue = t.o; }); active.splice(k, 1); }
} else {
const e = 1 - Math.pow(1 - clamp(p), 3);
a.n.nodeValue = String(Math.round(a.from + (a.to - a.from) * e));
if (p >= 1) active.splice(k, 1);
}
}
if (active.length) requestAnimationFrame(tick); else ticking = false;
};
const run = (a) => { a.t0 = performance.now(); active.push(a); if (!ticking) { ticking = true; requestAnimationFrame(tick); } };
const scramble = (el) => {
el._sc = true; el.style.opacity = '1';
const len = el._tn.reduce((s2, t) => s2 + t.o.length, 0) || 1;
const rev = []; for (let i = 0; i < len; i++) rev.push((i / len) * 0.6 + Math.random() * 0.4);
run({ type: 's', el: el, dur: 650 + Math.min(900, len * 16), rev: rev });
};
const countUp = (el) => {
el._ct = true;
let n = null; for (const c of el.childNodes) { if (c.nodeType === 3 && c.nodeValue.trim()) { n = c; break; } }
if (!n) return;
const to = parseFloat(el.getAttribute('data-count')); const from = parseFloat(el.getAttribute('data-from') || '0');
n.nodeValue = String(from);
run({ type: 'c', n: n, to: to, from: from, dur: 1700 });
};
counts.forEach((el) => { for (const c of el.childNodes) { if (c.nodeType === 3 && c.nodeValue.trim()) { c.nodeValue = el.getAttribute('data-from') || '0'; break; } } });

const hero = q('[data-hero]'), heroImg = q('[data-hero-img]'), heroFade = qa('[data-hero-fade]'), heroWm = q('[data-hero-wm]');
const st = q('[data-pin="320"]');
const stInner = st && st.querySelector('[data-pin-inner]'), stPill = q('[data-st-pill]'), stLayer = q('[data-st-layer]'), stLayerImg = q('[data-st-layer-img]'), stOver = q('[data-st-over]'), stFade = qa('[data-st-fade]');
const day = q('[data-pin="460"]'), dayBar = q('[data-day-bar]');
const pano = q('[data-pano]'), panoImg = q('[data-pano-img]');
const marq = q('[data-marquee]'), zoom = q('[data-zoom]');
const dbfix = q('[data-dbfix]'), dbline = q('[data-dbline]');

const frame = () => {
self._raf = 0;
if (self._dead) return;
const ih = window.innerHeight;
reveals.forEach((el) => { if (el._rv) return; const r = el.getBoundingClientRect(); if (r.top < ih * 0.9 && r.bottom > -100) { el._rv = true; el.style.opacity = '1'; el.style.transform = 'none'; if (el._blur) el.style.filter = 'none'; setTimeout(() => { el.style.transition = ''; el.style.transform = ''; el.style.filter = ''; el.style.opacity = ''; }, (el._d + 1.5) * 1000); } });
imgs.forEach((im) => { if (im._done) return; const r = im.getBoundingClientRect(); if (r.top < ih * 0.92 && r.bottom > 0) { im._done = true; im.style.clipPath = 'inset(0% 0 0 0)'; im.style.transform = 'scale(1)'; } });
scr.forEach((el) => { if (el._sc) return; const r = el.getBoundingClientRect(); if (r.top < ih * 0.96 && r.bottom > 0) scramble(el); });
counts.forEach((el) => { if (el._ct) return; const r = el.getBoundingClientRect(); if (r.top < ih * 0.88 && r.bottom > 0) countUp(el); });

if (hero) {
const r = hero.getBoundingClientRect(); const p = clamp(-r.top / r.height);
if (heroImg) heroImg.style.transform = 'translateY(' + (p * 30) + '%) scale(' + (1 + p * 0.18) + ')';
heroFade.forEach((el) => { el.style.opacity = p > 0 ? String(1 - p * 1.6) : ''; el.style.filter = p > 0 ? 'blur(' + (p * 10) + 'px)' : ''; });
if (heroWm) heroWm.style.transform = 'translateY(' + (-p * 120) + 'px)';
}
if (st && stInner) {
const r = st.getBoundingClientRect(); const p = clamp(-r.top / (r.height - ih)); const e = clamp((ih - r.top) / ih);
const fade = 1 - clamp((p - 0.2) / 0.18);
stFade.forEach((el) => { const bl = (1 - e) * 14 + (1 - fade) * 8; el.style.opacity = String(Math.min(e, fade)); el.style.filter = bl > 0.05 ? 'blur(' + bl + 'px)' : ''; });
const a = ease(clamp((p - 0.14) / 0.42));
if (a <= 0.001) { stLayer.style.visibility = 'hidden'; stPill.style.opacity = '1'; }
else {
const ir = stInner.getBoundingClientRect(), pr = stPill.getBoundingClientRect(), k = 1 - a;
stLayer.style.visibility = 'visible'; stPill.style.opacity = '0';
stLayer.style.clipPath = 'inset(' + ((pr.top - ir.top) * k) + 'px ' + ((ir.right - pr.right) * k) + 'px ' + ((ir.bottom - pr.bottom) * k) + 'px ' + ((pr.left - ir.left) * k) + 'px round ' + ((pr.height / 2) * k) + 'px)';
stLayerImg.style.transform = 'scale(' + (1.35 - 0.35 * a) + ')';
}
const o = clamp((p - 0.6) / 0.2);
stOver.style.opacity = String(o); stOver.style.transform = 'translateY(' + ((1 - o) * 60) + 'px)'; stOver.style.filter = o < 0.99 ? 'blur(' + ((1 - o) * 12) + 'px)' : '';
}
if (day) {
const r = day.getBoundingClientRect(); const p = clamp(-r.top / (r.height - ih));
if (dayBar) dayBar.style.transform = 'scaleX(' + p + ')';
if (r.top < ih && r.bottom > 0 && T.setDay) { const idx = Math.min(4, Math.floor(p * 5)); if (idx !== T.day) T.setDay(idx); }
}
floats.forEach((el) => { const r = el.getBoundingClientRect(); const k = parseFloat(el.getAttribute('data-float')) * (window.innerWidth <= 760 ? 0.35 : 1); const qq = clamp((ih - r.top) / (ih + r.height)); el.style.transform = 'translateY(' + ((0.5 - qq) * k) + 'px)'; });
if (pano) { const r = pano.getBoundingClientRect(); const qq = clamp((ih - r.top) / (ih * 0.85)); const x = 24 * (1 - ease(qq)); pano.style.clipPath = 'inset(0 ' + x + '% 0 ' + x + '%)'; if (panoImg) panoImg.style.transform = 'scale(' + (1.3 - 0.3 * qq) + ')'; }
if (marq) { const r = marq.parentElement.getBoundingClientRect(); const qq = clamp((ih - r.top) / (ih + r.height)); marq.style.transform = 'translateX(' + (-qq * 38) + '%)'; }
if (zoom) { const r = zoom.getBoundingClientRect(); const qq = clamp((ih - r.top) / (ih + r.height)); zoom.style.transform = 'scale(' + (1.25 - 0.25 * qq) + ')'; }
const rr = root.getBoundingClientRect(); const fr = clamp(-rr.top / (rr.height - ih));
if (dbfix) dbfix.textContent = Math.round(68 - 43 * fr) + ' dB';
if (dbfix && hero) { const hr = hero.getBoundingClientRect(); dbfix.style.opacity = window.innerWidth <= 760 ? String(clamp((-hr.top / hr.height - 0.35) / 0.25)) : ''; }
if (dbline) dbline.style.height = (fr * 100) + 'vh';
};

const onScroll = () => { if (!self._raf) self._raf = requestAnimationFrame(frame); };
window.addEventListener('scroll', onScroll, true);
window.addEventListener('resize', onScroll);
requestAnimationFrame(() => requestAnimationFrame(frame));
}
T.prep = prep; T.startEngine = startEngine;
if (!document.body.hasAttribute('data-preloader')) { prep(); startEngine(); }
(function () {
  const BASE = SITE_BASE;
  const q = (s, r) => (r || document).querySelector(s);
  // ---------- contact form: validate, send, fail, received ----------
  const form = q('[data-form]');
  if (form) {
    const sent = q('[data-sent]'), fail = q('[data-fail]', form), btn = q('[data-send]', form);
    const F = (n) => q('[name="' + n + '"]', form);
    const MSG = { name: 'Tell us your name, so we know who to answer.', empty: 'We need a phone or an email to reply.', bad: "That doesn't look like a phone or an email." };
    const setErr = (n, m) => { const i = F(n), e = document.getElementById('err-' + n); i.setAttribute('aria-invalid', m ? 'true' : 'false'); if (e) { if (m) e.textContent = m; e.style.display = m ? 'block' : 'none'; } };
    const check = (focus) => {
      let first = null;
      const nm = F('name').value.trim();
      if (!nm) { setErr('name', MSG.name); first = F('name'); } else setErr('name', '');
      const c = F('contact').value.trim();
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c) || /^\+?[\d\s().-]{7,}$/.test(c);
      if (!c) { setErr('contact', MSG.empty); first = first || F('contact'); } else if (!ok) { setErr('contact', MSG.bad); first = first || F('contact'); } else setErr('contact', '');
      if (first && focus) first.focus();
      return !first;
    };
    ['name', 'contact'].forEach((n) => F(n).addEventListener('input', () => { if (F(n).getAttribute('aria-invalid') === 'true') check(false); }));
    let busy = false;
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      if (busy) return;
      fail.style.display = 'none';
      if (!check(true)) return;
      busy = true; form.setAttribute('aria-busy', 'true');
      let db = 68; btn.textContent = 'Sending · 68 dB';
      const iv = setInterval(() => { db = Math.max(25, db - 3); btn.textContent = 'Sending · ' + db + ' dB'; }, 70);
      // no backend in this concept: the request is simulated. Offline (or a region containing "fail") shows the error state.
      setTimeout(() => {
        clearInterval(iv); busy = false; form.removeAttribute('aria-busy');
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
  // ---------- live clocks in the footer ----------
  const clocks = document.querySelectorAll('[data-clock]');
  const tick = () => clocks.forEach((c) => { try { c.textContent = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: c.getAttribute('data-clock') }).format(new Date()); } catch (e) {} });
  if (clocks.length) { tick(); setInterval(tick, 20000); }
  // ---------- mobile menu ----------
  const header = q('header'), nav = header && q('nav[aria-label="Main"]', header);
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
      + '<nav class="t-menu-list" aria-label="Menu">' + [...nav.querySelectorAll('a')].map((a, i) => '<a href="' + a.getAttribute('href') + '"><span class="n">0' + (i + 1) + '</span><span class="t">' + a.textContent + '</span><span class="d">' + (DB[a.textContent] || '') + '</span></a>').join('') + '</nav>'
      + '<div class="t-menu-foot"><a href="mailto:hello@tysha.studio" style="text-transform:none">hello@tysha.studio</a><span>+48 22 000 00 00</span><span class="t-mute">Lviv — Warsaw · Now: 25 dB</span></div>';
    document.body.appendChild(ov);
    const de = document.documentElement;
    const open = () => { ov.hidden = false; requestAnimationFrame(() => ov.classList.add('on')); b.setAttribute('aria-expanded', 'true'); de.style.overflow = 'hidden'; q('[data-close]', ov).focus(); };
    const close = () => { ov.classList.remove('on'); b.setAttribute('aria-expanded', 'false'); de.style.overflow = ''; setTimeout(() => { ov.hidden = true; }, 400); b.focus(); };
    b.addEventListener('click', open);
    q('[data-close]', ov).addEventListener('click', close);
    ov.querySelectorAll('.t-menu-list a').forEach((a) => a.addEventListener('click', close));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !ov.hidden) close(); });
  }
  // ---------- privacy note (no trackers; remembered in this browser only) ----------
  let seen = false;
  try { seen = !!localStorage.getItem('tysha-quiet'); } catch (e) {}
  if (!seen && !document.body.hasAttribute('data-no-note')) {
    const n = document.createElement('div');
    n.className = 't-note'; n.setAttribute('role', 'region'); n.setAttribute('aria-label', 'Privacy note');
    n.innerHTML = '<span class="k">No trackers</span><p>This site keeps no cookies and no analytics. As quiet as our houses.</p><div class="row"><a href="' + BASE + 'privacy/">Privacy notice</a><button type="button" class="t-pill">Good</button></div>';
    setTimeout(() => { document.body.appendChild(n); requestAnimationFrame(() => n.classList.add('on')); }, +(document.body.dataset.noteDelay || 1500));
    q('button', n).addEventListener('click', () => { try { localStorage.setItem('tysha-quiet', '1'); } catch (e) {} n.classList.remove('on'); setTimeout(() => n.remove(), 600); });
  }
})();
