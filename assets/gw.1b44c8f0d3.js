// Ghost Media Works website: Ghost Writer pages' own behaviour. Loaded on every /ghost-writer/ page (build_site), after
// the scene kit (scenes.js). Every page works without it.
//   - The product film (/ghost-writer/): W2's pill shows the hands-free state for the Hands-free way; the hero (a played
//     kit scene) plays again when the start-up logo hands over, so the visitor sees the object build itself.
//   - the film's pictures shrink to fit a short stage (--gw-fit, gw.css).
(function () {
  "use strict";
  var root = document.documentElement;

  // ---- W2: the one pill follows the chosen way (listening while a key is held, hands-free otherwise) ----
  var ways = document.querySelector('[data-scene="ways"]'), wayPill = ways && ways.querySelector(".gw-ways-pill");
  if (wayPill) {
    var follow = function () { wayPill.setAttribute("data-state", ways.getAttribute("data-way") === "free" ? "hands_free" : "listening"); };
    ways.addEventListener("kit:change", follow);
    follow();
  }

  // ---- W1: the hero's sentence types with the build, not when it reaches the kit's 80% line (on phones it sits
  //      lower than that). The replay after the start-up logo is the kit's (scenes.js). ----
  var hero = document.querySelector('[data-scene="hero"]'), heroType = hero && hero.querySelector(".type[data-live]");
  if (heroType && root.classList.contains("motion") && root.classList.contains("kit")) heroType.classList.add("typed");

  // ---- the film's pictures fit their stage: on short phones the stage is what's left under the words, so the
  //      picture shrinks (a transform, measured on resize only, never per frame) instead of spilling onto the chips ----
  if (window.ResizeObserver) {
    var fit = new ResizeObserver(function (entries) {
      entries.forEach(function (e) {
        var stage = e.target.classList.contains("stage") ? e.target : e.target.parentNode, pic = stage.querySelector(":scope > :not(.glow)");
        if (!pic) return;
        var room = stage.clientHeight - 8, need = pic.offsetHeight;
        var k = need > room && room > 0 ? Math.max(0.5, room / need) : 1;
        stage.style.setProperty("--gw-fit", k.toFixed(3));
      });
    });
    document.querySelectorAll(".gw-film .stage").forEach(function (stage) {
      fit.observe(stage);
      var pic = stage.querySelector(":scope > :not(.glow)");
      if (pic) fit.observe(pic);
    });
  }
})();
