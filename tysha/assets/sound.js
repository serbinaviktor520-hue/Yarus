/* TYSHA — sound (opt-in, loaded only when the visitor turns it on). Everything is synthesised with the
   Web Audio API: filtered noise for traffic, wind, water and room tone, short oscillator figures for birds,
   a cup and drops. No files, no licences. The city (68 dB) fades into the forest and the lake (25 dB) as
   the home page scrolls; the day section plays its own hour; the master level follows the dB figure. */
(() => {
  'use strict';
  const T = window.TYSHA = window.TYSHA || {};
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  let ctx, master, B, timer = 0, on = false, B_an = null, fbuf = null;
  const BANDS = [[40, 220], [220, 700], [700, 1800], [1800, 4500], [4500, 11000]];
  const R = Math.random;
  const home = !!document.querySelector('[data-hero] [data-hero-wm]');
  const day = document.querySelector('[data-pin="400"]');

  function noise(kind, sec = 4) {
    const n = ctx.sampleRate * sec, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = R() * 2 - 1;
      if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return buf;
  }
  const src = (buf) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(0, R() * 3); return s; };
  const filt = (type, f, q = 0.7) => { const x = ctx.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; return x; };
  const gain = (v = 0) => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const chain = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; };
  const to = (param, v, tau = 0.6) => param.setTargetAtTime(v, ctx.currentTime, tau);

  function build() {
    ctx = T.audioCtx || new AC();   // created and unlocked inside the tap by site.js
    master = gain(0);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
    chain(master, comp, ctx.destination);
    // a tap on the output for the cursor's equalizer
    B_an = ctx.createAnalyser(); B_an.fftSize = 512; B_an.smoothingTimeConstant = 0.5; B_an.minDecibels = -92; B_an.maxDecibels = -28;
    comp.connect(B_an); fbuf = new Uint8Array(B_an.frequencyBinCount);
    const white = noise('white'), brown = noise('brown');
    B = {};
    // city: low traffic rumble, cars passing by, a mains hum
    B.traffic = gain(); chain(src(brown), filt('lowpass', 320), B.traffic, master);
    B.carF = filt('bandpass', 520, 0.9); B.cars = gain(); chain(src(white), B.carF, B.cars, master);
    B.carEnv = gain(0); B.cars.disconnect(); chain(B.cars, B.carEnv, master);
    B.hum = gain(); [50, 100, 150].forEach((f, i) => { const o = ctx.createOscillator(); o.frequency.value = f; const g = gain([1, 0.5, 0.2][i]); chain(o, g, B.hum); o.start(); }); B.hum.connect(master);
    // forest: wind in the pines, water lapping, a faint room tone
    B.windF = filt('bandpass', 900, 0.5); B.wind = gain(); B.gust = gain(0.6); chain(src(white), B.windF, filt('lowpass', 2600), B.gust, B.wind, master);
    B.waterF = filt('lowpass', 520, 1.2); B.water = gain(); B.lap = gain(0.2); chain(src(brown), B.waterF, B.lap, B.water, master);
    B.room = gain(); chain(src(brown), filt('lowpass', 140), B.room, master);
    // event bus for birds, the cup, drops and UI clicks, with a little space
    B.ev = gain(1); const dl = ctx.createDelay(1); dl.delayTime.value = 0.13; const fb = gain(0.25);
    chain(B.ev, master); chain(B.ev, dl, fb, master); fb.connect(dl);
    B.rate = { birds: 0, cup: 0, drip: 0 };
  }

  // one-shot figures
  function tone(f0, f1, t, dur, g, pan = 0, type = 'sine') {
    const o = ctx.createOscillator(), e = gain(0), p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(g, t + 0.006); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (p) { p.pan.value = pan; chain(o, e, p, B.ev); } else chain(o, e, B.ev);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function bird() {
    let t = ctx.currentTime + 0.02; const base = 2400 + R() * 2200, pan = R() * 1.6 - 0.8, n = 2 + ((R() * 5) | 0), g = 0.05 + R() * 0.05;
    for (let i = 0; i < n; i++) { const up = R() > 0.4, d = 0.04 + R() * 0.08; tone(base * (up ? 0.85 : 1.2), base * (up ? 1.25 : 0.8), t, d, g, pan); t += d + 0.03 + R() * 0.06; }
  }
  function cup() {
    const t = ctx.currentTime + 0.02, p = R() * 0.6 - 0.3;
    [[1830, 0.07], [3170, 0.04], [4890, 0.025], [6620, 0.012]].forEach(([f, g]) => tone(f, f * 0.995, t, 0.5 + R() * 0.3, g, p));
  }
  function drip() {
    const t = ctx.currentTime + 0.02, f = 900 + R() * 900;
    tone(f * 1.6, f * 0.7, t, 0.07 + R() * 0.05, 0.05 + R() * 0.05, R() * 1.4 - 0.7);
  }
  function click() {
    if (!on) return;
    const t = ctx.currentTime + 0.005;
    tone(2100, 1500, t, 0.03, 0.035); tone(640, 420, t, 0.05, 0.03, 0, 'triangle');
  }

  // what the page should sound like right now: [traffic, cars, hum, wind, water, room, birds/s, cup/s, drip/s], dB
  const CITY = [0.55, 0.6, 0.05, 0, 0, 0, 0, 0, 0], FOREST = [0, 0, 0, 0.3, 0.32, 0, 0.35, 0, 0];
  const HOURS = [
    [[0, 0, 0, 0.08, 0.14, 0, 1.3, 0, 0], 31],        // 06:10 dawn birds over the lake
    [[0, 0, 0, 0.05, 0.08, 0.04, 0.45, 0.14, 0], 34], // 09:00 a cup, a few birds
    [[0, 0, 0, 0.55, 0.06, 0, 0.08, 0, 0], 28],       // 14:30 wind in the pines
    [[0, 0, 0, 0.06, 0.1, 0.03, 0, 0, 1.5], 33],      // 19:00 drops after the rain
    [[0, 0, 0, 0, 0, 0.16, 0, 0, 0.03], 21],          // 23:40 almost nothing: room tone
  ];
  function scene() {
    const ih = innerHeight;
    if (day) { const r = day.getBoundingClientRect(); if (r.top < ih * 0.5 && r.bottom > ih * 0.5) return HOURS[T.day || 0]; }
    const max = document.documentElement.scrollHeight - ih;
    let p = max > 0 ? scrollY / max : 1;
    if (!home) p = 0.75 + 0.25 * p;                    // the other pages are already out of town
    p = Math.min(1, p * 1.25);
    return [CITY.map((c, i) => c + (FOREST[i] - c) * p), 68 - 43 * p];
  }
  function tick() {
    const [L, db] = scene();
    // the whole mix gets quieter as the number falls: 68 dB -> 1.0, 25 dB -> ~0.3
    to(master.gain, on ? Math.pow(10, (db - 68) / 80) : 0, 0.5);
    ['traffic', 'cars', 'hum', 'wind', 'water', 'room'].forEach((k, i) => to(B[k].gain, L[i], 0.8));
    B.rate.birds = L[6]; B.rate.cup = L[7]; B.rate.drip = L[8];
    const dt = 0.1;
    if (R() < B.rate.birds * dt) bird();
    if (R() < B.rate.cup * dt) cup();
    if (R() < B.rate.drip * dt) drip();
    // a car passes now and then; gusts in the pines; small waves on the shore
    if (R() < 0.04) { const t = ctx.currentTime; B.carEnv.gain.cancelScheduledValues(t); B.carEnv.gain.setTargetAtTime(0.9, t, 0.9); B.carEnv.gain.setTargetAtTime(0.05, t + 2.2, 1.2); B.carF.frequency.setTargetAtTime(380 + R() * 260, t, 1.5); }
    if (R() < 0.05) { to(B.gust.gain, 0.35 + R() * 0.8, 1.4); to(B.windF.frequency, 600 + R() * 700, 2); }
    if (R() < 0.07) { const t = ctx.currentTime; B.lap.gain.setTargetAtTime(0.9, t, 0.12); B.lap.gain.setTargetAtTime(0.18, t + 0.3, 0.5); to(B.waterF.frequency, 380 + R() * 300, 0.3); }
  }

  const CTA = '.link-line, .link-line-end, .link-line-dark-end, .card, [data-send], .t-menu-btn';
  let lastHover = null;
  const hover = (e) => { const a = e.target.closest && e.target.closest(CTA); if (a && a !== lastHover) click(); lastHover = a; };
  const press = (e) => { if (e.target.closest && e.target.closest(CTA)) click(); };

  T.sound = {
    on() {
      if (!ctx) build();
      on = true;
      if (ctx.resume) { const r = ctx.resume(); if (r && r.catch) r.catch(() => {}); }
      if (!timer) { timer = setInterval(tick, 100); tick(); }
      document.addEventListener('pointerover', hover, true); document.addEventListener('pointerdown', press, true);
    },
    off() {
      on = false;
      document.removeEventListener('pointerover', hover, true); document.removeEventListener('pointerdown', press, true);
      if (!ctx) return;
      to(master.gain, 0, 0.15);
      setTimeout(() => { if (!on) { clearInterval(timer); timer = 0; ctx.suspend && ctx.suspend(); } }, 700);
    },
    click,
    // five bands of what is playing now, 0..1 (null while silent or suspended)
    bands() {
      if (!on || !B_an || ctx.state !== 'running') return null;
      B_an.getByteFrequencyData(fbuf);
      const hz = ctx.sampleRate / B_an.fftSize;
      return BANDS.map(([a, b]) => { let s = 0, n = 0; for (let k = Math.max(1, Math.floor(a / hz)); k <= Math.min(fbuf.length - 1, Math.ceil(b / hz)); k++) { s += fbuf[k]; n++; } return n ? Math.pow(s / n / 255, 0.8) : 0; });
    },
    level: () => (master ? +master.gain.value.toFixed(3) : 0),   // for testing
    state: () => (ctx ? ctx.state : 'none'),
  };
  document.addEventListener('visibilitychange', () => { if (!ctx || !on) return; if (document.hidden) ctx.suspend(); else { const r = ctx.resume(); if (r && r.catch) r.catch(() => {}); } });
})();
