/* The ground of the site film: a starfield that flows behind every page (owner's pick, 2026-11-03, the Starfield of
   dev/design/site-film/background-options-2.html, tuned in starfield-example.html).
   - Dark theme only (html.stars is set while it runs; site.css makes the body see-through and the windows glass).
   - Drawn at the screen's pixel density, up to 3x (2x on screens over 1600 px wide), so every star is sharp.
   - Cheap per frame (site-film audit fixes, 2026-11-03): stars are batched into one path per colour and brightness
     step (no per-star style strings), the dust is drawn small and redrawn four times a second, and the field is drawn
     at most 30 times a second (the fastest star moves 11 px a second, so it still flows).
   - Steps down when frames run long (10 gaps over 28 ms; over 40 ms count twice): density 3 -> 2 -> 1.5 -> 1, then fewer stars (60%, 35%),
     then 15 draws a second, and last the field holds still while the page scrolls (it flows on when the scrolling
     stops). PCs with 2 cores or fewer start at 1.5x and 60% of the stars. The step shows as data-q on the canvas
     (0 = full) for the frame checks in dev/launch-audits/site-film.md.
   - Easy on the eyes: no star above 70% brightness, cool whites, slow twinkle, no flashes, faint dust.
   - Sleeps when the tab is hidden; with reduced motion it draws one still frame and stops.
   Per frame: canvas only (CONTRACT.md rule 6). No libraries. */
(function () {
  "use strict";
  var root = document.documentElement;
  var canvas = document.createElement("canvas");
  canvas.className = "stars";
  canvas.setAttribute("aria-hidden", "true");
  var ctx = canvas.getContext("2d", { alpha: false });
  var dust = document.createElement("canvas"), dctx = dust.getContext("2d", { alpha: false });
  if (!ctx || !dctx) return;
  var TAU = Math.PI * 2, MAX_A = .7, LV = 12, HLV = 4, DUST_SCALE = .25, MAX_STARS = 6000;
  var IND = "143,145,255", VIO = "122,92,255", PALE = "214,216,240", WARM = "236,224,210";
  var INKS = [PALE, IND, WARM], COLS = [0, 0, 0, 1, 2];   // star colours (indexes into INKS), PALE three times as often
  var FILL = [], HALO = [], ci, lv;                      // fill styles per colour and brightness step, made once
  for (ci = 0; ci < INKS.length; ci++) {
    for (lv = 0; lv < LV; lv++) FILL.push("rgba(" + INKS[ci] + "," + ((lv + .5) / LV * MAX_A).toFixed(3) + ")");
    for (lv = 0; lv < HLV; lv++) HALO.push("rgba(" + INKS[ci] + "," + ((lv + .5) / HLV * MAX_A * .18).toFixed(3) + ")");
  }
  var reduced = matchMedia("(prefers-reduced-motion: reduce)");
  var weak = (navigator.hardwareConcurrency || 4) <= 2;
  var S = null, all = null, w = 0, h = 0, dpr = 1, dens = 1, gap = 33, still = false, scrolled = -1e9, id = 0, last = 0, drawn = 0,
    slow = 0, on = false;

  function dark() { return root.getAttribute("data-theme") !== "light"; }  // dark is the default; the header button picks light
  function rnd(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function cap() { // the starting density for this screen
    var c = Math.min(window.devicePixelRatio || 1, 3);
    if (window.innerWidth > 1600) c = Math.min(c, 2);
    if (weak) c = Math.min(c, 1.5);
    return c;
  }
  function blob(x, y, r, c, a, sx, rot) {
    dctx.save(); dctx.translate(x, y); dctx.rotate(rot); dctx.scale(sx, 1);
    var g = dctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, "rgba(" + c + "," + a + ")"); g.addColorStop(.5, "rgba(" + c + "," + a * .35 + ")"); g.addColorStop(1, "rgba(0,0,0,0)");
    dctx.fillStyle = g; dctx.fillRect(-r, -r, r * 2, r * 2); dctx.restore();
  }
  function scene() { // the same seed as the approved look; fewer stars = the first ones of the same list
    var r = rnd(23), s = [], d = [], n = Math.min(MAX_STARS, Math.round(w * h / 520)), i, z;
    for (i = 0; i < n; i++) { z = Math.pow(r(), 2.4); s.push({ x: r() * w, y: r() * h, z: z, size: .5 + z * 2.4 + (r() < .015 ? 1.2 : 0), c: COLS[(r() * COLS.length) | 0], ph: r() * TAU, tw: .15 + r() * .9 }); }
    for (i = 0; i < 7; i++) d.push({ x: r() * w, y: r() * h, rr: 160 + r() * 300, c: i % 2 ? VIO : IND, ph: r() * TAU, sp: .5 + r() });
    all = s;
    return { t: S ? S.t : 0, dustT: -1, s: s.slice(0, Math.round(n * dens)), dust: d };
  }
  function drawDust(t) { // small canvas, scaled up: the dust is soft and moves a few pixels a second
    var i, d;
    dctx.setTransform(DUST_SCALE, 0, 0, DUST_SCALE, 0, 0);
    dctx.globalCompositeOperation = "source-over"; dctx.fillStyle = "#040508"; dctx.fillRect(0, 0, w, h);
    dctx.globalCompositeOperation = "lighter";
    for (i = 0; i < S.dust.length; i++) { d = S.dust[i]; blob(d.x + Math.sin(t * .05 * d.sp + d.ph) * 80, d.y + Math.cos(t * .04 * d.sp + d.ph) * 40, d.rr, d.c, .055, 1.6, d.ph); }
    S.dustT = t;
  }
  function draw(dt) {
    S.t += dt; var t = S.t, i, s, a, x, r, k, p, paths = [], halos = [];
    if (S.dustT < 0 || t - S.dustT > .25) drawDust(t);
    ctx.globalCompositeOperation = "source-over"; ctx.drawImage(dust, 0, 0, w, h);
    for (i = 0; i < S.s.length; i++) {
      s = S.s[i];
      a = Math.min((.55 + .45 * Math.sin(t * s.tw + s.ph)) * (.22 + s.z * .5), MAX_A);
      x = ((s.x + t * (2 + s.z * 9)) % (w + 20)) - 10;
      k = s.c * LV + Math.min(LV - 1, (a / MAX_A * LV) | 0);
      p = paths[k] || (paths[k] = new Path2D());
      if (s.size < 1.2) { p.rect(x, s.y, s.size, s.size); continue; }
      r = s.size * .5; p.moveTo(x + r, s.y); p.arc(x, s.y, r, 0, TAU);
      if (s.size > 2.2) {
        k = s.c * HLV + Math.min(HLV - 1, (a / MAX_A * HLV) | 0); r = s.size * 1.5;
        p = halos[k] || (halos[k] = new Path2D()); p.moveTo(x + r, s.y); p.arc(x, s.y, r, 0, TAU);
      }
    }
    ctx.globalCompositeOperation = "lighter";
    for (k = 0; k < paths.length; k++) if (paths[k]) { ctx.fillStyle = FILL[k]; ctx.fill(paths[k]); }
    for (k = 0; k < halos.length; k++) if (halos[k]) { ctx.fillStyle = HALO[k]; ctx.fill(halos[k]); }
  }
  function size() {
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dust.width = Math.max(1, Math.ceil(w * DUST_SCALE)); dust.height = Math.max(1, Math.ceil(h * DUST_SCALE));
    S = scene(); slow = 0;
  }
  function stepDown() { // one step cheaper, until there is nothing left to give
    if (dpr > 1) { dpr = dpr > 2 ? 2 : dpr > 1.5 ? 1.5 : 1; size(); }
    else if (dens > .35) { dens = dens > .6 ? .6 : .35; S.s = all.slice(0, Math.round(all.length * dens)); }
    else if (gap < 66) gap = 66;
    else if (!still) still = true;
    else return;
    canvas.setAttribute("data-q", String(+canvas.getAttribute("data-q") + 1));
  }
  function frame(now) {
    id = requestAnimationFrame(frame);
    var g = now - last; last = now;
    if (g > 28) { slow += g > 40 ? 2 : 1; if (slow > 10) { slow = 0; stepDown(); } } else if (slow > 0) slow--;  // very long gaps count twice
    if (now - drawn < gap - 4 || (still && now - scrolled < 250)) return;
    draw(Math.min(.1, (now - drawn) / 1000)); drawn = now;
  }
  function start() {
    if (on) return; on = true; root.classList.add("stars");
    if (!canvas.parentNode) document.body.prepend(canvas);
    dpr = cap(); dens = weak ? .6 : 1; gap = 33; still = false; S = null; canvas.setAttribute("data-q", "0"); size();
    draw(0);
    if (reduced.matches) return;
    last = drawn = performance.now(); id = requestAnimationFrame(frame);
  }
  function stop() {
    if (!on) return; on = false; root.classList.remove("stars");
    cancelAnimationFrame(id); id = 0;
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }
  function sync() { if (dark() && !document.hidden) start(); else stop(); }
  var resizeTimer = 0;
  window.addEventListener("resize", function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(function () { if (on) { dpr = Math.min(dpr, cap()); size(); draw(0); } }, 150); });
  window.addEventListener("scroll", function () { scrolled = performance.now(); }, { passive: true });
  document.addEventListener("visibilitychange", sync);
  reduced.addEventListener("change", function () { stop(); sync(); });
  new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  sync();
})();
