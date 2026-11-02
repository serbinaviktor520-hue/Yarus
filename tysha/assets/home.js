/* TYSHA — home only: the 'day at Lull House' switcher and the preloader */
const DAYS = [["06:10", "Birds in the beech trees", 31, "g15", "The living room at blue dawn, forest outside the long window"], ["09:00", "Coffee, nothing else", 34, "h03", "A woman sitting on the window ledge in warm morning light"], ["14:30", "Wind in the pines", 28, "g14", "The empty living room in soft daylight"], ["19:00", "Rain on the roof", 33, "h06", "Rain on the window at dusk, one warm lamp on"], ["23:40", "Nothing at all", 21, "h09", "The living room at night, moonlight on the floor"]];
T.day = 0;
function setSel(i) {
  T.day = i;
  document.querySelectorAll('[data-day-img]').forEach((im) => { const on = +im.getAttribute('data-day-img') === i; im.style.opacity = on ? '1' : '0'; im.style.transform = 'scale(' + (on ? 1 : 1.08) + ')'; im.alt = on ? DAYS[i][4] : ''; });
  document.querySelectorAll('[data-day-btn]').forEach((bt) => { const on = +bt.getAttribute('data-day-btn') === i; bt.setAttribute('aria-pressed', on ? 'true' : 'false'); bt.style.borderTopColor = on ? '#EAE6DE' : 'rgba(234,230,222,0.3)'; bt.style.color = on ? '#EAE6DE' : 'rgba(234,230,222,0.6)'; });
  document.getElementById('day-db').textContent = DAYS[i][2];
  document.getElementById('day-time').textContent = DAYS[i][0];
}
document.querySelectorAll('[data-day-btn]').forEach((bt) => bt.addEventListener('click', () => setSel(+bt.getAttribute('data-day-btn'))));
T.setDay = setSel;
function computeP(t) {
const c = (x) => Math.max(0, Math.min(1, x));
const e = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const r = (x) => Math.round(x * 100) / 100;
const P = {};
for (let i = 0; i < 5; i++) { const s = e(c((t - 300 - i * 220) / 500)); P['s' + i + 'o'] = r(s); P['s' + i + 'y'] = r((1 - s) * 40); }
const k = e(c((t - 1700) / 1200));
P.tH = r(152 * k); P.tY = r(240 - 148 * k);
P.yV = r(314 - 35 * k) + ',-4 ' + r(314 + 35 * k) + ',-4 314,' + r(118 * k);
P.yH = r(94 * k); P.yY = r(240 - 90 * k);
P.sW = r(144 * k); P.sW2 = r(148 * k); P.sX = r(628 - 144 * k);
P.hH = r(96 * k); P.hH2 = r(100 * k); P.hY = r(240 - 96 * k);
P.aD = r(956 - 31 * k) + ',244 ' + r(956 + 31 * k) + ',244 ' + r(956 + 10 * k) + ',' + r(240 - 70 * k) + ' ' + r(956 - 10 * k) + ',' + r(240 - 70 * k);
P.aWh = r(44 * k); P.aWy = r(106 - 22 * k);
P.ph = r(100 * e(c((t - 3200) / 600)));
P.pw = r(100 * e(c((t - 3800) / 900)));
const m = e(c((t - 4700) / 1000));
const w0 = (typeof window !== 'undefined' && window.innerWidth <= 760) ? 80 : 38.9;
const VW = (typeof window !== 'undefined') ? window.innerWidth : 1440, VH = (typeof window !== 'undefined') ? window.innerHeight : 900;
const sw = VW * w0 / 100, sh = sw * 240 / 1056, sx = (VW - sw) / 2, sy = VH / 2 - sh / 2;
let ex = 20, ew = VW - 40, ey = VH - 20 - (VW - 40) * 240 / 1056;
if (typeof document !== 'undefined') { const hw = document.querySelector('[data-hero-wm]'); if (hw) { const hr = hw.getBoundingClientRect(); if (hr.width > 0) { ex = hr.left; ew = hr.width; ey = hr.top; } } }
const ww = sw + (ew - sw) * m;
P.ww = r(ww); P.wh = r(ww * 240 / 1056); P.wx = r(sx + (ex - sx) * m); P.wy = r(sy + (ey - sy) * m);
P.capO = r(c(t / 400) * (1 - c((t - 4500) / 400)));
P.db = Math.round(68 - 43 * c((t - 300) / 3000));
P.pct = String(Math.round(100 * c((t - 300) / 3000))).padStart(3, '0');
P.globalO = r(1 - c((t - 6200) / 650));
 return P; }
const PRE_TPL = "\n<div aria-hidden=\"true\" style=\"position: fixed; inset: 0; z-index: 1000; background: #0B0B0A; color: #EAE6DE; overflow: hidden; opacity: {{P.globalO}}\">\n<div style=\"position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: {{P.pw}}vw; height: {{P.ph}}vh; overflow: hidden; background: #1C1B19\">\n<img src=\"img/h08.jpg\" alt=\"\" style=\"position: absolute; left: 50%; top: 50%; width: 100vw; height: 100vh; transform: translate(-50%, -50%); object-fit: cover; object-position: center 30%; display: block\">\n<div style=\"position: absolute; left: 50%; top: 50%; width: 100vw; height: 100vh; transform: translate(-50%, -50%); background: linear-gradient(180deg, rgba(17,17,16,0.55) 0%, rgba(17,17,16,0.05) 35%, rgba(17,17,16,0.1) 60%, rgba(17,17,16,0.75) 100%)\"></div>\n</div>\n<svg viewBox=\"0 0 1056 240\" style=\"position: absolute; left: 0; top: 0; width: {{P.ww}}px; height: {{P.wh}}px; transform: translate3d({{P.wx}}px, {{P.wy}}px, 0); overflow: visible; will-change: transform\">\n<defs>\n<mask id=\"pm-pre\" maskUnits=\"userSpaceOnUse\" x=\"0\" y=\"-40\" width=\"1056\" height=\"320\">\n<rect x=\"0\" y=\"-40\" width=\"1056\" height=\"320\" fill=\"black\"></rect>\n<g transform=\"translate(0 {{P.s0y}})\" opacity=\"{{P.s0o}}\"><rect x=\"0\" y=\"0\" width=\"200\" height=\"240\" rx=\"12\" fill=\"white\"></rect></g>\n<g transform=\"translate(0 {{P.s1y}})\" opacity=\"{{P.s1o}}\"><rect x=\"214\" y=\"0\" width=\"200\" height=\"240\" rx=\"12\" fill=\"white\"></rect></g>\n<g transform=\"translate(0 {{P.s2y}})\" opacity=\"{{P.s2o}}\"><rect x=\"428\" y=\"0\" width=\"200\" height=\"240\" rx=\"40\" fill=\"white\"></rect></g>\n<g transform=\"translate(0 {{P.s3y}})\" opacity=\"{{P.s3o}}\"><rect x=\"642\" y=\"0\" width=\"200\" height=\"240\" rx=\"12\" fill=\"white\"></rect></g>\n<g transform=\"translate(0 {{P.s4y}})\" opacity=\"{{P.s4o}}\"><path d=\"M856 240 V70 Q856 0 926 0 H986 Q1056 0 1056 70 V240 Z\" fill=\"white\"></path></g>\n<rect x=\"-4\" y=\"{{P.tY}}\" width=\"60\" height=\"{{P.tH}}\" fill=\"black\"></rect>\n<rect x=\"144\" y=\"{{P.tY}}\" width=\"60\" height=\"{{P.tH}}\" fill=\"black\"></rect>\n<polygon points=\"{{P.yV}}\" fill=\"black\"></polygon>\n<rect x=\"210\" y=\"{{P.yY}}\" width=\"60\" height=\"{{P.yH}}\" fill=\"black\"></rect>\n<rect x=\"358\" y=\"{{P.yY}}\" width=\"60\" height=\"{{P.yH}}\" fill=\"black\"></rect>\n<rect x=\"{{P.sX}}\" y=\"74\" width=\"{{P.sW2}}\" height=\"12\" fill=\"black\"></rect>\n<rect x=\"424\" y=\"154\" width=\"{{P.sW2}}\" height=\"12\" fill=\"black\"></rect>\n<rect x=\"732\" y=\"-4\" width=\"20\" height=\"{{P.hH2}}\" fill=\"black\"></rect>\n<rect x=\"732\" y=\"{{P.hY}}\" width=\"20\" height=\"{{P.hH2}}\" fill=\"black\"></rect>\n<polygon points=\"{{P.aD}}\" fill=\"black\"></polygon>\n<rect x=\"948\" y=\"{{P.aWy}}\" width=\"16\" height=\"{{P.aWh}}\" fill=\"black\"></rect>\n</mask>\n</defs>\n<rect x=\"0\" y=\"-40\" width=\"1056\" height=\"320\" fill=\"#EAE6DE\" mask=\"url(#pm-pre)\"></rect>\n</svg>\n<div data-pre-cap style=\"position: absolute; left: 20px; right: 20px; top: 20px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); column-gap: 20px; line-height: 1.45; opacity: {{P.capO}}; font-family: 'Geist Mono', monospace; font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase\">\n<span>Tysha Architecture<br><span style=\"color: #7F7A73\">Lviv \u2014 Warsaw</span></span>\n<span>Architecture of silence<br><span style=\"color: #7F7A73\">Est. 2014</span></span>\n<span>Private houses<br><span style=\"color: #7F7A73\">2 \u2014 8 homes, 6 a year</span></span>\n<span style=\"text-align: right; font-variant-numeric: tabular-nums\">Now: {{P.db}} dB<br><span style=\"color: #7F7A73\">Turning the city down</span></span>\n</div>\n<div data-pre-cap style=\"position: absolute; left: 20px; right: 20px; bottom: 20px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); column-gap: 20px; align-items: end; line-height: 1.45; opacity: {{P.capO}}; font-family: 'Geist Mono', monospace; font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase\">\n<span>We design homes where<br>the loudest thing is the rain.</span>\n<span style=\"color: #7F7A73\">49.8397\u00b0 N<br>24.0297\u00b0 E</span>\n<span style=\"display: flex; gap: 16px; flex-wrap: wrap; text-transform: none\"><span style=\"text-decoration: underline\">LULL_HOUSE.JPG</span><span style=\"text-decoration: underline\">PINE_COURT.JPG</span><span style=\"text-decoration: underline\">HOLLOW.JPG</span></span>\n<span style=\"text-align: right; font-variant-numeric: tabular-nums\">Loading quiet<br>{{P.pct}} / 100</span>\n</div>\n</div>\n";
(function () {
  try { history.scrollRestoration = 'manual'; } catch (e) {}
  window.scrollTo(0, 0);
  T.prep();
  const host = document.getElementById('pre-host');
  const de = document.documentElement;
  de.style.overflow = 'hidden';
  const t0 = performance.now(); let started = false;
  const loop = () => {
    const t = performance.now() - t0;
    const P = computeP(t);
    host.innerHTML = PRE_TPL.replace(/\{\{P\.(\w+)\}\}/g, (m, k) => P[k]);
    if (t >= 6200 && !started) { started = true; de.style.overflow = ''; T.startEngine(); }
    if (t >= 6900) { host.remove(); return; }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
})();
