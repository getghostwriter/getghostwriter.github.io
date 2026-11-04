// Ghost Media Works website: the home page's script (build_site loads it on "/" only, after the scene kit).
// The kit (scenes.js) plays every scene against --t; this adds only what is home's own:
//   H2  the chips (Dictate, Rewrite, Hey Ghost) jump the playhead, and the pressed chip follows it as the scene loops
//   H3  the glow takes the film look's colour once the look washes over the preview
// Kit pieces used: window.Scenes.way / .wash, the .chip markup. Rules: runs only with html.motion (no reduced motion);
// without it every scene rests on its finished frame. Nothing here follows the scroll: each part follows its looping
// scene's playhead, one requestAnimationFrame a frame only while that scene is on screen.
(function () {
  "use strict";
  var root = document.documentElement;
  if (!root.classList.contains("motion") || !window.Scenes) return;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)");

  function motion() { return root.classList.contains("motion"); }

  // ---- the loop: every part on screen writes once a frame while motion is on ----
  var parts = [], raf = 0;
  function frame() {
    raf = 0;
    var more = false;
    for (var i = 0; i < parts.length; i++) if (parts[i].on) { parts[i].write(); more = true; }
    if (more && motion()) wake();
  }
  function wake() { if (!raf && !document.hidden) raf = requestAnimationFrame(frame); }
  var onScreen = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { e.target.homePart.on = e.isIntersecting; });
    wake();
  }, { rootMargin: "120px 0px" });
  function part(el, write) {
    if (!el) return;
    var p = { el: el, write: write, on: false };
    el.homePart = p;
    parts.push(p);
    onScreen.observe(el);
  }
  document.addEventListener("visibilitychange", wake);
  reduce.addEventListener("change", wake);  // the kit drops html.motion; each part goes back to its resting frame

  // ---- H2: the chips jump the playhead; the pressed chip follows it ----
  var writer = document.querySelector(".h-writer");
  if (writer) (function () {
    var WAYS = ["dictate", "rewrite", "hey"], AT = [0.04, 0.4, 0.66], beat = 0;
    writer.querySelectorAll(".chip[data-way]").forEach(function (chip) {
      var k = WAYS.indexOf(chip.getAttribute("data-way"));
      chip.addEventListener("click", function () {
        if (k < 0 || !motion()) return;
        beat = k;
        // after the kit's own click handling (it replays the scene from 0)
        requestAnimationFrame(function () { window.Scenes.seek(writer, AT[k]); });
      });
    });
    part(writer, function () {
      if (!motion()) return;
      var t = window.Scenes.t(writer), b = t < 0.38 ? 0 : t < 0.64 ? 1 : 2;
      if (b !== beat) { beat = b; window.Scenes.way(writer, WAYS[b], false); }
    });
  })();

  // ---- H3: the glow is indigo until the film look washes over the preview (t .42 to .5) ----
  var hubStage = document.querySelector(".h-hub .stage");
  var hubScene = hubStage && hubStage.closest(".scene");
  part(hubScene, function () {
    window.Scenes.wash(hubStage, !motion() || window.Scenes.t(hubScene) >= 0.46 ? "look-film" : "indigo");
  });
})();
