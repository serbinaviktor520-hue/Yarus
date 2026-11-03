/* TYSHA — "Start a project": the contact form as a modal, on every page.
   The room goes quiet: the page behind darkens and blurs, the level counts down to 25 dB, the sound (if on) is muffled.
   Every link to #contact (nav, hero, case, method) opens it; #start deep-links it, Back closes it. Without JavaScript
   the links still lead to the form on the home page.
   Desktop (>= 1024 px): a panel on the site grid, the photo column ending on the axis (5/12), opened like the
   preloader's shutters, from a slit on the axis. Phones and tablets: a full-height sheet from below.
   ?modal=plain shows the variant without the photo. */
(() => {
  'use strict';
  const T = window.TYSHA = window.TYSHA || {};
  const BASE = new URL('../', document.currentScript.src).href;
  const q = (s, r = document) => r.querySelector(s);
  const qa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const RM = window.matchMedia('(prefers-reduced-motion: reduce)');
  const WIDE = window.matchMedia('(min-width: 1024px)');
  const de = document.documentElement;
  const PLAIN = /[?&]modal=plain\b/.test(location.search);

  // Where the request goes. The site is a concept without a backend, so sending is simulated (as on the home page
  // form). To go live, set ENDPOINT to a form service or your own API: it receives the fields as JSON (POST).
  const ENDPOINT = '';
  const send = (data) => {
    if (ENDPOINT) {
      return fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data) })
        .then((r) => { if (!r.ok) throw new Error(r.status); });
    }
    // simulated: offline, or "fail" in the place field, shows the error state
    return new Promise((ok, no) => setTimeout(() => (navigator.onLine === false || /fail/i.test(data.where) ? no(new Error('offline')) : ok()), 1600));
  };

  // the quiet scale: 45 dB (left) to 20 dB (right), what each level sounds like
  const LOUD = 45, QUIET = 20;
  const SAYS = (db) => (db >= 41 ? 'A quiet living room' : db >= 36 ? 'A city flat at night, windows shut' : db >= 31 ? 'A library reading room'
    : db >= 27 ? 'A whisper across the room' : db >= 24 ? 'A bedroom at night' : db >= 22 ? 'Snow falling outside' : 'Leaves, far away');

  const WHAT = ['House', 'Renovation', 'Retreat', 'Something else'];
  const BUDGET = ['Under €500k', '€500k–1M', '€1–2M', '€2M+', 'Not sure yet'];
  const pills = (name, list, req) => list.map((t, i) => '<label class="m-pill"><input type="radio" name="' + name + '" value="' + t + '"' + (req && i === 0 ? ' required' : '') + '><span>' + t + '</span></label>').join('');
  const bars = Array.from({ length: LOUD - QUIET + 1 }, (_, i) => '<i style="--h:' + (0.22 + 0.78 * (LOUD - QUIET - i) / (LOUD - QUIET)).toFixed(3) + '"></i>').join('');

  const dlg = document.createElement('dialog');
  dlg.className = 'm' + (PLAIN ? ' m-plain' : ''); dlg.id = 'start';
  dlg.setAttribute('aria-labelledby', 'm-h'); dlg.setAttribute('aria-describedby', 'm-sub');
  dlg.innerHTML = ''
    + '<div class="m-veil" data-m-close></div>'
    + '<div class="m-panel">'
    + '<span class="m-handle" aria-hidden="true"></span>'
    + '<div class="m-side">'
    + (PLAIN ? '' : '<div class="m-photo" data-m-photo></div>')
    + '<div class="m-side-cap label"><span class="m-big num-xl" aria-hidden="true"><span data-m-big>68</span></span><span>' + (PLAIN ? 'The room, as you step in' : 'Lake shore, blue hour') + '<br><span class="tone-2">Measured inside: <span data-m-db2>68</span> dB</span></span></div>'
    + '</div>'
    + '<div class="m-body">'
    + '<div class="m-top label" data-m-grab><span>Start a project</span><span class="m-db" aria-hidden="true"><span data-m-db>68</span> dB</span><button type="button" class="t-pill m-close" data-m-close data-noscramble>Close</button></div>'
    + '<div class="m-scroll" data-m-scroll>'
    + '<form class="m-form" data-m-form novalidate>'
    + '<h2 id="m-h" class="m-h serif m-in" tabindex="-1">Tell us where it’s loud.</h2>'
    + '<p id="m-sub" class="m-sub m-in">We reply within two working days. In quiet, of course.</p>'
    + '<div class="m-grid">'
    + '<div class="m-field m-in" data-m-field="name"><label class="label" for="m-name">Name</label><input class="m-input" id="m-name" name="name" type="text" autocomplete="name" placeholder="Your name" aria-describedby="m-name-h" required><span class="m-hint" id="m-name-h"></span></div>'
    + '<div class="m-field m-in" data-m-field="email"><label class="label" for="m-email">Email</label><input class="m-input" id="m-email" name="email" type="email" inputmode="email" autocomplete="email" placeholder="name@mail.com" aria-describedby="m-email-h" required><span class="m-hint" id="m-email-h"></span></div>'
    + '<div class="m-field m-wide m-in"><label class="label" for="m-where">Where <span class="tone-dim">· city or plot</span></label><input class="m-input" id="m-where" name="where" type="text" autocomplete="address-level2" placeholder="Near Lviv, a pine slope by a lake"></div>'
    + '<fieldset class="m-field m-wide m-in"><legend class="label">What</legend><div class="m-pills">' + pills('what', WHAT) + '</div></fieldset>'
    + '<fieldset class="m-field m-wide m-in"><legend class="label">Budget <span class="tone-dim">· optional</span></legend><div class="m-pills">' + pills('budget', BUDGET) + '</div></fieldset>'
    + '<div class="m-field m-wide m-q m-in"><div class="m-q-head"><span class="label" id="m-q-l">How quiet should it be?</span><span class="m-q-val" aria-hidden="true"><span class="serif" data-q-num>25</span><span class="label">dB</span></span></div>'
    + '<div class="m-q-track" data-q role="slider" tabindex="0" aria-labelledby="m-q-l" aria-valuemin="0" aria-valuemax="' + (LOUD - QUIET) + '" aria-valuenow="20" aria-valuetext="25 dB, a bedroom at night">' + bars + '</div>'
    + '<div class="m-q-scale label" aria-hidden="true"><span>45 dB</span><span data-q-says>A bedroom at night</span><span>20 dB</span></div></div>'
    + '<div class="m-field m-wide m-in"><label class="label" for="m-msg">Anything else <span class="tone-dim">· optional</span></label><textarea class="m-input m-msg" id="m-msg" name="message" rows="1" placeholder="The road you can hear, the view you want to keep"></textarea></div>'
    + '</div>'
    + '<div class="m-foot m-in"><button type="submit" class="m-send" data-m-send data-cursor="Send"><span data-m-send-t>Send</span><i class="m-send-bar" aria-hidden="true"></i></button>'
    + '<p class="m-consent label">By sending, you agree to our <a class="u" href="' + BASE + 'privacy/">privacy notice</a>.</p></div>'
    + '<p class="m-fail" data-m-fail role="alert" hidden>The line is noisy: your request didn’t reach us. Nothing is lost. Try again, or write to <a class="u" href="mailto:hello@tysha.studio">hello@tysha.studio</a>.</p>'
    + '<p class="sr-only" role="status" data-m-status></p>'
    + '</form>'
    + '<div class="m-done" data-m-done hidden tabindex="-1">'
    + '<span class="label tone-2" data-m-id>Request TY-0000 · Received</span>'
    + '<p class="m-done-h serif">It’s quiet now.</p>'
    + '<p class="m-sub">Thank you. We’ll reply within two working days, from hello@tysha.studio.</p>'
    + '<dl class="m-sum" data-m-sum></dl>'
    + '<button type="button" class="t-pill m-done-close" data-m-close>Close</button>'
    + '</div>'
    + '</div></div></div>';
  document.body.appendChild(dlg);

  const panel = q('.m-panel', dlg), form = q('[data-m-form]', dlg), done = q('[data-m-done]', dlg), scroller = q('[data-m-scroll]', dlg);
  const dbEls = qa('[data-m-db], [data-m-db2], [data-m-big]', dlg);
  const head = q('#m-h', dlg);
  // entrance order: the top bar and the caption first, then the form, row by row
  [q('.m-top', dlg), q('.m-side-cap', dlg), ...qa('.m-in', dlg)].forEach((el, i) => el.style.setProperty('--i', i));

  /* ---------- the photo: the blue-hour house (g09), from the page template; loaded ahead, at low priority ---------- */
  let photoIn = false;
  const putPhoto = () => {
    if (photoIn || PLAIN) return; photoIn = true;
    const t = q('#t-start-photo'); const box = q('[data-m-photo]', dlg); if (!t || !box) return;
    box.appendChild(t.content.cloneNode(true));
    const im = q('img', box);
    if (im) { im.loading = 'eager'; im.fetchPriority = 'low'; if (im.dataset.tone) box.style.backgroundColor = im.dataset.tone; }
  };
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 2500));
  idle(putPhoto, { timeout: 5000 });

  /* ---------- the quiet slider ---------- */
  const track = q('[data-q]', dlg), qNum = q('[data-q-num]', dlg), qSays = q('[data-q-says]', dlg), qBars = qa('i', track);
  let quiet = 25;
  const setQuiet = (db, user) => {
    db = Math.max(QUIET, Math.min(LOUD, Math.round(db)));
    if (db === quiet && !user) return;
    quiet = db;
    const k = LOUD - db;
    qBars.forEach((b, i) => { b.classList.toggle('off', i < k); b.classList.toggle('on', i === k); });
    qNum.textContent = db; qSays.textContent = SAYS(db);
    track.setAttribute('aria-valuenow', String(k));
    track.setAttribute('aria-valuetext', db + ' dB, ' + SAYS(db).toLowerCase());
  };
  setQuiet(25, true);
  const fromX = (x) => { const r = track.getBoundingClientRect(); return LOUD - ((x - r.left) / r.width) * (LOUD - QUIET + 1) + 0.5; };
  track.addEventListener('pointerdown', (e) => {
    track.setPointerCapture(e.pointerId); track.classList.add('drag'); setQuiet(fromX(e.clientX), true);
    const mv = (ev) => setQuiet(fromX(ev.clientX), true);
    const up = () => { track.classList.remove('drag'); track.removeEventListener('pointermove', mv); track.removeEventListener('pointerup', up); track.removeEventListener('pointercancel', up); };
    track.addEventListener('pointermove', mv); track.addEventListener('pointerup', up); track.addEventListener('pointercancel', up);
  });
  // value = how much quieter than 45 dB: Right / Up = quieter
  track.addEventListener('keydown', (e) => {
    const k = { ArrowRight: -1, ArrowUp: -1, ArrowLeft: 1, ArrowDown: 1, PageUp: -5, PageDown: 5 }[e.key];
    if (k) { e.preventDefault(); setQuiet(quiet + k, true); }
    else if (e.key === 'Home') { e.preventDefault(); setQuiet(LOUD, true); }
    else if (e.key === 'End') { e.preventDefault(); setQuiet(QUIET, true); }
  });

  /* ---------- the message grows with its text ---------- */
  const msg = q('#m-msg', dlg);
  const grow = () => { msg.style.height = 'auto'; msg.style.height = Math.min(msg.scrollHeight, 220) + 'px'; };
  msg.addEventListener('input', grow);

  /* ---------- calm validation: a short mono hint under the field, after the first try ---------- */
  const F = (n) => form.elements[n];
  const HINT = { name: 'We’d like to know who to answer.', email: 'An email, so we can write back.', emailBad: 'That doesn’t look like an email yet.' };
  let tried = false;
  const hint = (n, m) => {
    const i = F(n), h = q('#m-' + n + '-h', dlg);
    if (m) i.setAttribute('aria-invalid', 'true'); else i.removeAttribute('aria-invalid');
    h.textContent = m || ''; i.closest('.m-field').classList.toggle('bad', !!m);
  };
  const check = () => {
    const bad = [];
    if (!F('name').value.trim()) { hint('name', HINT.name); bad.push(F('name')); } else hint('name', '');
    const e = F('email').value.trim();
    if (!e) { hint('email', HINT.email); bad.push(F('email')); }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) { hint('email', HINT.emailBad); bad.push(F('email')); }
    else hint('email', '');
    return bad;
  };
  ['name', 'email'].forEach((n) => { F(n).addEventListener('input', () => { if (tried) check(); }); F(n).addEventListener('blur', () => { if (tried) check(); }); });

  /* ---------- the level: counts from the page's dB down to 25 ---------- */
  let dbRaf = 0;
  const showDb = (v) => dbEls.forEach((el) => { el.textContent = v; });
  const countDown = () => {
    cancelAnimationFrame(dbRaf);
    T.quiet = null;
    const from = T.pageDb ? T.pageDb() : 68, to = 25;
    if (RM.matches || from <= to) { T.quiet = to; showDb(to); return; }
    const t0 = performance.now(), dur = 1200;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      const v = Math.round(from + (to - from) * e); T.quiet = v; showDb(v);
      if (k < 1) dbRaf = requestAnimationFrame(step);
    };
    showDb(from); T.quiet = from; dbRaf = requestAnimationFrame(step);
  };

  /* ---------- open / close ---------- */
  let opener = null, pushed = false, closing = 0;
  const visible = (el) => el && el.isConnected && el.getClientRects().length;
  // the cursor, ripples and toasts live in <body>; while the dialog is in the top layer they move into it
  const OVERLAYS = '.t-cursor, .t-ripples, .t-toast';
  const lift = (inDlg) => qa(OVERLAYS).forEach((el) => { (inDlg ? dlg : document.body).appendChild(el); });

  function open(trigger, opts = {}) {
    if (dlg.open && !closing) return;
    clearTimeout(closing); closing = 0; dlg.classList.remove('is-closing');
    opener = trigger || document.activeElement;
    putPhoto();
    if (!dlg.open) dlg.showModal();
    de.style.overflow = 'hidden'; de.classList.add('m-on');
    lift(true);
    panel.style.transform = '';
    requestAnimationFrame(() => requestAnimationFrame(() => dlg.classList.add('is-open')));
    countDown();
    if (T.sound && T.sound.duck) T.sound.duck(true);
    if (opts.push !== false && location.hash !== '#start') { history.pushState({ tyshaStart: 1 }, '', '#start'); pushed = true; }
    // the heading takes focus (read first by screen readers); no keyboard pops up on phones
    head.focus({ preventScroll: true });
    if (opts.topic && !F('message').value) { F('message').value = opts.topic; grow(); }
  }
  function hide() {
    if (!dlg.open || closing) return;
    dlg.classList.remove('is-open'); dlg.classList.add('is-closing');
    cancelAnimationFrame(dbRaf); T.quiet = null;
    if (T.sound && T.sound.duck) T.sound.duck(false);
    closing = setTimeout(() => {
      closing = 0; dlg.classList.remove('is-closing'); dlg.close();
      de.style.overflow = ''; de.classList.remove('m-on'); lift(false);
      panel.style.transform = '';
      if (done.hidden === false) reset();
      const back = visible(opener) ? opener : q('#main');
      if (back) back.focus({ preventScroll: true });
    }, RM.matches ? 220 : 480);
  }
  // closing by the button, Esc, the veil or Back: the address loses #start the same way it got it
  function close() {
    if (pushed && history.state && history.state.tyshaStart) { pushed = false; history.back(); return; }
    pushed = false;
    if (location.hash === '#start') history.replaceState(history.state, '', location.pathname + location.search);
    hide();
  }
  window.addEventListener('popstate', () => {
    if (location.hash === '#start') { if (!dlg.open) open(null, { push: false }); }
    else if (dlg.open) { pushed = false; hide(); }
  });
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  // Tab stays inside: from the last control back to the first, and the other way round
  dlg.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = qa('button, a[href], input, textarea, [tabindex="0"]', panel).filter((el) => !el.disabled && el.getClientRects().length && !el.closest('[hidden]'));
    // a radio group is one stop
    const stops = f.filter((el) => !(el.type === 'radio' && !el.checked && f.some((o) => o !== el && o.type === 'radio' && o.name === el.name && (o.checked || f.indexOf(o) < f.indexOf(el)))));
    const first = stops[0], last = stops[stops.length - 1];
    if (!first) return;
    if (e.shiftKey && (document.activeElement === first || document.activeElement === head)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  dlg.addEventListener('click', (e) => { if (e.target.closest('[data-m-close]')) close(); });

  // every link to the contact form opens the modal instead (new tabs and modified clicks keep the link)
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href$="#contact"], a[href$="#start"], [data-start]');
    if (!a || dlg.contains(a) || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    const topic = /audit/i.test(a.textContent) ? 'A silence audit of my plot, please.' : '';
    // after the click has finished (the mobile menu closes itself on the same click)
    setTimeout(() => open(a, { topic }), 0);
  });
  if (location.hash === '#start') {
    const go = () => open(null, { push: false });
    if (document.body.hasAttribute('data-preloader') && !T.started) document.addEventListener('tysha:ready', go, { once: true }); else go();
  }
  // a hover or focus on a trigger: fetch the photo now
  document.addEventListener('pointerover', (e) => { if (e.target.closest && e.target.closest('a[href$="#contact"], [data-start]')) putPhoto(); }, { passive: true });

  /* ---------- phones: drag the sheet down to close; the keyboard never covers the field or the button ---------- */
  // the photo band and the top bar are the handle
  const grab = panel;
  grab.addEventListener('pointerdown', (e) => {
    if (WIDE.matches || RM.matches || e.target.closest('button, a') || !e.target.closest('.m-side, [data-m-grab]')) return;
    const y0 = e.clientY, t0 = performance.now(); let dy = 0;
    grab.setPointerCapture(e.pointerId); panel.classList.add('dragging');
    const mv = (ev) => { dy = Math.max(0, ev.clientY - y0); panel.style.transform = 'translate3d(0,' + dy + 'px,0)'; };
    const up = () => {
      panel.classList.remove('dragging'); grab.removeEventListener('pointermove', mv); grab.removeEventListener('pointerup', up); grab.removeEventListener('pointercancel', up);
      const fast = dy / Math.max(1, performance.now() - t0) > 0.6;
      if (dy > 120 || (fast && dy > 40)) close(); else panel.style.transform = '';
    };
    grab.addEventListener('pointermove', mv); grab.addEventListener('pointerup', up); grab.addEventListener('pointercancel', up);
  });
  const vv = window.visualViewport;
  if (vv) {
    const fitVV = () => {
      if (!dlg.open) return;
      dlg.style.setProperty('--vvh', vv.height + 'px'); dlg.style.setProperty('--vvt', vv.offsetTop + 'px');
      dlg.classList.toggle('m-kb', !WIDE.matches && vv.height < window.innerHeight * 0.78);
    };
    vv.addEventListener('resize', fitVV); vv.addEventListener('scroll', fitVV);
    dlg.addEventListener('focusin', (e) => {
      fitVV();
      if (!WIDE.matches && e.target.matches('input, textarea')) setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: RM.matches ? 'auto' : 'smooth' }), 250);
    });
  }

  /* ---------- sending ---------- */
  const btn = q('[data-m-send]', dlg), btnT = q('[data-m-send-t]', dlg), fail = q('[data-m-fail]', dlg), status = q('[data-m-status]', dlg);
  let busy = false;
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (busy) return;
    tried = true; fail.hidden = true;
    const bad = check();
    if (bad.length) { status.textContent = bad.length === 1 ? 'One field needs a word.' : bad.length + ' fields need a word.'; bad[0].focus(); return; }
    const data = {
      name: F('name').value.trim(), email: F('email').value.trim(), where: F('where').value.trim(),
      what: (q('input[name="what"]:checked', form) || {}).value || '', budget: (q('input[name="budget"]:checked', form) || {}).value || '',
      quiet: quiet + ' dB', message: F('message').value.trim(),
    };
    busy = true; form.setAttribute('aria-busy', 'true'); dlg.classList.add('m-sending'); status.textContent = 'Sending.';
    let db = 68; btnT.textContent = 'Sending · 68 dB';
    const iv = setInterval(() => { db = Math.max(25, db - 3); btnT.textContent = 'Sending · ' + db + ' dB'; }, 70);
    send(data).then(() => {
      clearInterval(iv); busy = false; form.removeAttribute('aria-busy'); dlg.classList.remove('m-sending'); status.textContent = '';
      q('[data-m-id]', dlg).textContent = 'Request TY-' + (1000 + Math.floor(Math.random() * 9000)) + ' · Received · 25 dB';
      const rows = [['Name', data.name], ['Email', data.email], ['Where', data.where], ['What', data.what], ['Budget', data.budget], ['Quiet', data.quiet + ' · ' + SAYS(quiet).toLowerCase()], ['Note', data.message]].filter((r) => r[1]);
      const sum = q('[data-m-sum]', dlg); sum.textContent = '';
      rows.forEach(([k, v]) => { const dt = document.createElement('dt'); dt.className = 'label'; dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v; sum.append(dt, dd); });
      form.hidden = true; done.hidden = false; scroller.scrollTop = 0;
      requestAnimationFrame(() => done.classList.add('in'));
      showDb(25); done.focus({ preventScroll: true });
    }, () => {
      clearInterval(iv); busy = false; form.removeAttribute('aria-busy'); dlg.classList.remove('m-sending'); status.textContent = '';
      btnT.textContent = 'Try again'; fail.hidden = false;
    });
  });
  function reset() {
    form.reset(); tried = false; ['name', 'email'].forEach((n) => hint(n, '')); setQuiet(25, true);
    btnT.textContent = 'Send'; fail.hidden = true; form.hidden = false; done.hidden = true; done.classList.remove('in'); msg.style.height = '';
  }

  T.contact = { open, close };
})();
