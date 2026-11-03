// Ghost Media Works website: the home page's script (build_site loads it on "/" only, after the scene kit).
// The kit (scenes.js) plays every scene against --t; this adds only what is home's own:
//   H1  the hero's two travelling nodes drop down the page as the hero scrolls away (--h-p on the mark, 0..1)
//   H2  the chips (Dictate, Rewrite, Hey Ghost) jump the playhead, and the pressed chip follows the scrolling
//   H3  the glow takes the film look's colour once the look washes over the preview
// Kit pieces used: window.Scenes.way / .wash, the .chip markup. Rules: runs only with html.motion (no reduced motion);
// without it every scene rests on its finished frame. One requestAnimationFrame per scroll or resize, only while one of
// these scenes is on screen; it reads every box first, then writes, and writes only what changed.
(function () {
  "use strict";
  var root = document.documentElement;
  if (!root.classList.contains("motion") || !window.Scenes) return;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)"), tall = matchMedia("(min-height: 540px)");

  function motion() { return root.classList.contains("motion"); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  // Scenes pin (and scrub) only with motion on a screen at least 540 px tall; the playhead from a pinned box is the
  // kit's formula: 0 when it pins, 1 when it lets go.
  function pinning() { return motion() && tall.matches; }
  function scrubT(r) { return clamp(-r.top / Math.max(1, r.height - innerHeight), 0, 1); }

  // ---- the loop: each part reads its box, then writes ----
  var parts = [], raf = 0;
  function frame() {
    raf = 0;
    var i;
    for (i = 0; i < parts.length; i++) if (parts[i].on) parts[i].rect = parts[i].el.getBoundingClientRect();
    for (i = 0; i < parts.length; i++) if (parts[i].on) parts[i].write(parts[i].rect);
  }
  function wake() { if (!raf && !document.hidden) raf = requestAnimationFrame(frame); }
  var onScreen = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { e.target.homePart.on = e.isIntersecting; });
    wake();
  }, { rootMargin: "120px 0px" });
  function part(el, write) {
    if (!el) return;
    var p = { el: el, write: write, on: false, rect: null };
    el.homePart = p;
    parts.push(p);
    onScreen.observe(el);
  }
  addEventListener("scroll", wake, { passive: true });
  addEventListener("resize", wake, { passive: true });
  document.addEventListener("visibilitychange", wake);
  reduce.addEventListener("change", wake);  // the kit drops html.motion; each part goes back to its resting frame

  // ---- H1: the two nodes leave as the hero scrolls away ----
  var hero = document.querySelector(".h-hero"), mark = hero && hero.querySelector(".h-mark"), heroShown = -1;
  part(hero, function (r) {
    var p = motion() ? Math.round(clamp(-r.top / Math.max(1, r.height * 0.75), 0, 1) * 1000) / 1000 : 0;
    if (p === heroShown) return;
    if (p) mark.style.setProperty("--h-p", p); else mark.style.removeProperty("--h-p");
    heroShown = p;
  });

  // ---- H2: the chips jump the playhead; the pressed chip follows it ----
  var writer = document.querySelector(".h-writer");
  if (writer) (function () {
    var WAYS = ["dictate", "rewrite", "hey"], AT = [0.04, 0.4, 0.66], beat = 0;
    writer.querySelectorAll(".chip[data-way]").forEach(function (chip) {
      var k = WAYS.indexOf(chip.getAttribute("data-way"));
      chip.addEventListener("click", function () {
        if (k < 0 || !pinning()) return;
        var r = writer.getBoundingClientRect(), y = scrollY + r.top + Math.max(1, r.height - innerHeight) * AT[k];
        beat = k;
        // after the kit's own click handling (on phones it scrolls the chip row into view)
        requestAnimationFrame(function () { scrollTo({ top: y, behavior: "smooth" }); });
      });
    });
    part(writer, function (r) {
      if (!pinning()) return;
      var t = scrubT(r), b = t < 0.38 ? 0 : t < 0.64 ? 1 : 2;
      if (b !== beat) { beat = b; window.Scenes.way(writer, WAYS[b], false); }
    });
  })();

  // ---- H3: the glow is indigo until the film look washes over the preview (t .42 to .5) ----
  var hubStage = document.querySelector(".h-hub .stage");
  part(hubStage && hubStage.closest(".scene"), function (r) {
    window.Scenes.wash(hubStage, !pinning() || scrubT(r) >= 0.46 ? "look-film" : "indigo");
  });
})();
