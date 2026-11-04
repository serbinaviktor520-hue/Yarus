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

  const WHAT = ['House', 'Renovation', 'Retreat', 'Other'];
  // plain words, a native radio group (arrow keys move between them)
  const opts = (name, list) => list.map((t) => '<label class="m-opt"><input type="radio" name="' + name + '" value="' + t + '"><span>' + t + '</span></label>').join('');

  const dlg = document.createElement('dialog');
  dlg.className = 'm' + (PLAIN ? ' m-plain' : ''); dlg.id = 'start';
  dlg.setAttribute('aria-labelledby', 'm-title');
  dlg.innerHTML = ''
    + '<div class="m-veil" data-m-close></div>'
    + '<div class="m-panel">'
    + '<span class="m-handle" aria-hidden="true"></span>'
    + '<div class="m-side">'
    + (PLAIN ? '' : '<div class="m-photo" data-m-photo></div>')
    + '<div class="m-side-cap label"><span class="m-big num-xl" aria-hidden="true"><span data-m-big>68</span></span><span>' + (PLAIN ? 'The room, as you step in' : 'Lake shore, blue hour') + '<br><span class="tone-2">Measured inside: <span data-m-db2>68</span> dB</span></span></div>'
    + '</div>'
    + '<div class="m-body">'
    + '<div class="m-top" data-m-grab><span id="m-title" class="m-title">Start a project</span><span class="m-count"><button type="button" class="m-hback" data-back hidden aria-label="Back to step 1">←</button><span aria-hidden="true"><span data-m-n>01</span> / 03</span></span><button type="button" class="t-pill m-close" data-m-close data-noscramble>Close</button></div>'
    + '<div class="m-prog" aria-hidden="true"><i data-m-prog></i></div>'
    + '<div class="m-scroll" data-m-scroll>'
    + '<form class="m-form" data-m-form novalidate>'
    // step 1: where
    + '<section class="m-step" data-step="1" aria-labelledby="m-h1">'
    + '<h2 id="m-h1" class="m-h serif m-in" tabindex="-1">Where would you like it quiet?</h2>'
    + '<div class="m-field m-in"><label class="m-lab" for="m-where">City, region or plot</label><input class="m-input m-input-l" id="m-where" name="where" type="text" autocomplete="address-level2" placeholder="e.g. near Lviv, a pine slope by a lake" aria-describedby="m-where-h" required><span class="m-hint" id="m-where-h"></span></div>'
    + '<fieldset class="m-field m-kind m-in"><legend class="sr-only">Kind of project, optional</legend><div class="m-opts">' + opts('what', WHAT) + '</div></fieldset>'
    + '<div class="m-step-foot m-in"><button type="button" class="m-send" data-next data-cursor="Next">Next</button></div>'
    + '</section>'
    // step 2: how quiet
    + '<section class="m-step" data-step="2" aria-labelledby="m-h2" hidden>'
    + '<h2 id="m-h2" class="m-h serif" tabindex="-1">How quiet should it be?</h2>'
    + '<p class="m-q-read" aria-hidden="true"><span class="serif m-q-num"><span data-q-num>25</span> dB</span><span class="m-q-says" data-q-says>A bedroom at night</span></p>'
    + '<div class="m-q-track" data-q role="slider" tabindex="0" aria-labelledby="m-h2" aria-valuemin="20" aria-valuemax="45" aria-valuenow="25" aria-valuetext="25 dB, a bedroom at night"><i class="m-q-line"></i><i class="m-q-fill"></i><b class="m-q-thumb"></b></div>'
    + '<div class="m-q-scale" aria-hidden="true"><span>20 dB · quieter</span><span>45 dB · louder</span></div>'
    + '<div class="m-step-foot"><button type="button" class="m-send" data-next data-cursor="Next">Next</button></div>'
    + '</section>'
    // step 3: who
    + '<section class="m-step" data-step="3" aria-labelledby="m-h3" hidden>'
    + '<h2 id="m-h3" class="m-h serif" tabindex="-1">How do we reach you?</h2>'
    + '<div class="m-pair">'
    + '<div class="m-field"><label class="m-lab" for="m-name">Name</label><input class="m-input m-input-l" id="m-name" name="name" type="text" autocomplete="name" placeholder="Your name" aria-describedby="m-name-h" required><span class="m-hint" id="m-name-h"></span></div>'
    + '<div class="m-field"><label class="m-lab" for="m-email">Email or phone</label><input class="m-input m-input-l" id="m-email" name="email" type="text" autocomplete="email" placeholder="name@mail.com or +48 …" aria-describedby="m-email-h" required><span class="m-hint" id="m-email-h"></span></div>'
    + '</div>'
    + '<div class="m-field"><label class="m-lab" for="m-msg">Anything else <span class="m-opt-tag">(optional)</span></label><input class="m-input" id="m-msg" name="message" type="text" autocomplete="off" placeholder="The road you hear, the view you keep"></div>'
    + '<div class="m-step-foot m-step-foot-send"><div class="m-send-row"><button type="submit" class="m-send" data-m-send data-cursor="Send"><span data-m-send-t>Send</span><i class="m-send-bar" aria-hidden="true"></i></button></div>'
    + '<p class="m-consent">By sending, you agree to our <a class="u" href="' + BASE + 'privacy/">privacy notice</a>. We reply within two working days.</p>'
    + '<p class="m-fail" data-m-fail role="alert" hidden>The line is noisy: your request didn’t reach us. Nothing is lost. Try again, or write to <a class="u" href="mailto:hello@tysha.studio">hello@tysha.studio</a>.</p></div>'
    + '</section>'
    + '<p class="sr-only" role="status" aria-live="polite" data-m-status></p>'
    + '</form>'
    + '<div class="m-done" data-m-done hidden tabindex="-1">'
    + '<span class="label tone-2" data-m-id>Request TY-0000 · Received</span>'
    + '<p class="m-done-h serif">It’s quiet now.</p>'
    + '<p class="m-sub" data-m-reply>Thank you. We’ll reply within two working days, from hello@tysha.studio.</p>'
    + '<dl class="m-sum" data-m-sum></dl>'
    + '<button type="button" class="t-pill m-done-close" data-m-close>Close</button>'
    + '</div>'
    + '</div></div></div>';
  document.body.appendChild(dlg);

  const panel = q('.m-panel', dlg), form = q('[data-m-form]', dlg), done = q('[data-m-done]', dlg), scroller = q('[data-m-scroll]', dlg);
  const dbEls = qa('[data-m-db], [data-m-db2], [data-m-big]', dlg);
  const head = q('#m-h1', dlg);
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
  const track = q('[data-q]', dlg), qNum = q('[data-q-num]', dlg), qSays = q('[data-q-says]', dlg);
  let quiet = 25;
  const setQuiet = (db, user) => {
    db = Math.max(QUIET, Math.min(LOUD, Math.round(db)));
    if (db === quiet && !user) return;
    quiet = db;
    track.style.setProperty('--p', ((db - QUIET) / (LOUD - QUIET)).toFixed(4));   // 0 = quietest (left), 1 = loudest (right)
    qNum.textContent = db; qSays.textContent = SAYS(db);
    track.setAttribute('aria-valuenow', String(db));   // the dB shown; Right / Up = more dB, as the scale reads
    track.setAttribute('aria-valuetext', db + ' dB, ' + SAYS(db).toLowerCase());
  };
  setQuiet(25, true);
  const fromX = (x) => { const r = track.getBoundingClientRect(); return QUIET + Math.max(0, Math.min(1, (x - r.left) / r.width)) * (LOUD - QUIET); };
  track.addEventListener('pointerdown', (e) => {
    track.setPointerCapture(e.pointerId); track.classList.add('drag'); setQuiet(fromX(e.clientX), true);
    const mv = (ev) => setQuiet(fromX(ev.clientX), true);
    const up = () => { track.classList.remove('drag'); track.removeEventListener('pointermove', mv); track.removeEventListener('pointerup', up); track.removeEventListener('pointercancel', up); };
    track.addEventListener('pointermove', mv); track.addEventListener('pointerup', up); track.addEventListener('pointercancel', up);
  });
  // one direction everywhere: 20 dB on the left, 45 dB on the right; Right / Up = more dB, Home = 20, End = 45
  track.addEventListener('keydown', (e) => {
    const k = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 5, PageDown: -5 }[e.key];
    if (k) { e.preventDefault(); setQuiet(quiet + k, true); }
    else if (e.key === 'Home') { e.preventDefault(); setQuiet(QUIET, true); }
    else if (e.key === 'End') { e.preventDefault(); setQuiet(LOUD, true); }
  });

  /* ---------- the message grows with its text ---------- */
  // the fade above the Send bar goes once the form is read to the end
  const atEnd = () => dlg.classList.toggle('m-at-end', scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 8);
  scroller.addEventListener('scroll', atEnd, { passive: true }); window.addEventListener('resize', atEnd);


  /* ---------- calm validation: a short mono hint under the field, after the first try ---------- */
  const F = (n) => form.elements[n];
  const HINT = { where: 'Roughly where: a town, a region or a plot.', name: 'We’d like to know who to answer.', email: 'An email or a phone number, so we can answer.', emailBad: 'That doesn’t look like an email or a phone number yet.' };
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
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && !/^\+?[\d\s().-]{7,}$/.test(e)) { hint('email', HINT.emailBad); bad.push(F('email')); }
    else hint('email', '');
    return bad;
  };
  ['name', 'email'].forEach((n) => { F(n).addEventListener('input', () => { if (tried) check(); }); F(n).addEventListener('blur', () => { if (tried) check(); }); });
  let triedWhere = false;
  const checkWhere = () => { const ok = !!F('where').value.trim(); hint('where', ok ? '' : HINT.where); return ok; };
  F('where').addEventListener('input', () => { if (triedWhere) checkWhere(); });

  /* ---------- the steps: one question per screen; the photo column stays, only the content moves ---------- */
  const steps = qa('.m-step', dlg), nEl = q('[data-m-n]', dlg), prog = q('[data-m-prog]', dlg);
  let step = 1;
  const first = (n) => (n === 2 ? q('[data-q]', dlg) : n === 3 ? F('name') : F('where'));
  function go(n, o = {}) {
    const dir = n >= step ? 1 : -1; step = n;
    steps.forEach((el) => { const on = +el.dataset.step === n; el.hidden = !on; el.classList.remove('m-enter'); el.style.setProperty('--dir', dir); });
    const hb = q('.m-hback', dlg); hb.hidden = n === 1; hb.setAttribute('aria-label', 'Back to step ' + (n - 1));
    nEl.textContent = '0' + n; prog.style.transform = 'scaleX(' + (n / 3).toFixed(3) + ')';
    if (o.quiet) return;
    const cur = steps[n - 1];
    if (!RM.matches) { void cur.offsetWidth; cur.classList.add('m-enter'); }
    q('[data-m-status]', dlg).textContent = 'Step ' + n + ' of 3: ' + q('.m-h', cur).textContent;
    scroller.scrollTop = 0;
    // phones: the headline (no keyboard jumps up); keyboards and mice: straight into the field
    (WIDE.matches ? first(n) : q('.m-h', cur)).focus({ preventScroll: true });
    if (T.cursor && T.cursor.refresh) T.cursor.refresh();
  }
  function advance() {
    if (step === 1) { triedWhere = true; if (!checkWhere()) { F('where').focus(); return; } go(2); }
    else if (step === 2) go(3);
    else form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true }));
  }
  qa('[data-next]', dlg).forEach((b) => b.addEventListener('click', advance));
  qa('[data-back]', dlg).forEach((b) => b.addEventListener('click', () => go(step - 1)));
  // Enter moves on from any field, the options and the slider (and sends on the last step)
  form.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.isComposing || e.target.closest('button, a')) return;
    e.preventDefault(); advance();
  });
  go(1, { quiet: true });

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
    requestAnimationFrame(atEnd);
    if (T.sound && T.sound.duck) T.sound.duck(true);
    if (opts.push !== false && location.hash !== '#start') { history.pushState({ tyshaStart: 1 }, '', '#start'); pushed = true; }
    // every visit starts at the first question; its heading takes focus (read first; no keyboard pops up on phones)
    if (done.hidden) go(1, { quiet: true });
    head.focus({ preventScroll: true });
    if (opts.topic && !F('message').value) F('message').value = opts.topic;
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
      if (T.cursor && T.cursor.refresh) T.cursor.refresh();
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
    if (e.shiftKey && (document.activeElement === first || document.activeElement.matches('.m-h'))) { e.preventDefault(); last.focus(); }
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
    if (step < 3) { advance(); return; }
    tried = true; fail.hidden = true;
    const bad = check();
    if (bad.length) { status.textContent = bad.length === 1 ? 'One field needs a word.' : 'Two fields need a word.'; bad[0].focus(); return; }
    const data = {
      name: F('name').value.trim(), email: F('email').value.trim(), where: F('where').value.trim(),
      what: (q('input[name="what"]:checked', form) || {}).value || '',
      quiet: quiet + ' dB', message: F('message').value.trim(),
    };
    busy = true; form.setAttribute('aria-busy', 'true'); dlg.classList.add('m-sending'); status.textContent = 'Sending.';
    let db = 68; btnT.textContent = 'Sending · 68 dB';
    const iv = setInterval(() => { db = Math.max(25, db - 3); btnT.textContent = 'Sending · ' + db + ' dB'; }, 70);
    send(data).then(() => {
      clearInterval(iv); busy = false; form.removeAttribute('aria-busy'); dlg.classList.remove('m-sending'); status.textContent = '';
      q('[data-m-id]', dlg).textContent = 'Request TY-' + (1000 + Math.floor(Math.random() * 9000)) + ' · Received · 25 dB';
      const rows = [['Name', data.name], [/@/.test(data.email) ? 'Email' : 'Phone', data.email], ['Where', data.where], ['What', data.what], ['Quiet', data.quiet + ' · ' + SAYS(quiet).toLowerCase()], ['Note', data.message]].filter((r) => r[1]);
      q('[data-m-reply]', dlg).textContent = /@/.test(data.email) ? 'Thank you. We’ll reply within two working days, from hello@tysha.studio.' : 'Thank you. We’ll text you within two working days, and call only if you ask.';
      const sum = q('[data-m-sum]', dlg); sum.textContent = '';
      rows.forEach(([k, v]) => { const dt = document.createElement('dt'); dt.className = 'm-lab'; dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v; sum.append(dt, dd); });
      form.hidden = true; done.hidden = false; scroller.scrollTop = 0; dlg.classList.add('m-is-done');
      requestAnimationFrame(() => done.classList.add('in'));
      showDb(25); done.focus({ preventScroll: true }); if (T.cursor && T.cursor.refresh) T.cursor.refresh();
    }, () => {
      clearInterval(iv); busy = false; form.removeAttribute('aria-busy'); dlg.classList.remove('m-sending'); status.textContent = '';
      btnT.textContent = 'Try again'; fail.hidden = false;
    });
  });
  function reset() {
    form.reset(); tried = false; ['name', 'email'].forEach((n) => hint(n, '')); setQuiet(25, true);
    btnT.textContent = 'Send'; fail.hidden = true; form.hidden = false; done.hidden = true; dlg.classList.remove('m-is-done'); done.classList.remove('in'); go(1, { quiet: true });
  }

  T.contact = { open, close };
})();
