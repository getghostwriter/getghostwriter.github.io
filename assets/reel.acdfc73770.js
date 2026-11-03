// Ghost Media Works site film: the Features reel's own script (pages/ghost-writer/features/, "assets: reel").
// Kit pieces used: the scene kit's .curve in the hero (scenes.js moves it: drag, sideways wheel, arrow keys, a click
// on a side card). This file adds only the curve's link handling, since each card is a link to its chapter:
// a drag never follows a link, Enter (or Space) on the curve opens the middle card's chapter, and tabbing to a side
// card's link brings that card to the middle first. No loop, no scroll listener: the kit owns those.
(function () {
  "use strict";
  var curve = document.querySelector(".hero-film .curve");
  if (!curve) return;
  var wide = matchMedia("(min-width: 721px)");
  var down = null, moved = false;

  curve.addEventListener("pointerdown", function (e) { down = e.clientX; moved = false; }, true);
  curve.addEventListener("pointermove", function (e) { if (down !== null && Math.abs(e.clientX - down) > 6) moved = true; }, true);
  curve.addEventListener("pointerup", function () { down = null; }, true);
  // After a drag on wide screens the release is not a choice: keep the link from opening.
  curve.addEventListener("click", function (e) {
    if (moved && wide.matches) { e.preventDefault(); e.stopPropagation(); }
    moved = false;
  }, true);

  curve.addEventListener("keydown", function (e) {
    if (e.target !== curve || (e.key !== "Enter" && e.key !== " ")) return;
    var on = curve.querySelector('[aria-current="true"]');
    if (!on) return;
    e.preventDefault();
    on.click();  // the middle card: the kit lets its link open
  });

  curve.addEventListener("focusin", function (e) {
    var card = e.target.closest ? e.target.closest(".curve > *") : null;
    if (!card || !wide.matches || card.hasAttribute("aria-current") || !card.matches(":focus-visible")) return;
    card.click();  // a side card: the kit brings it to the middle instead of following the link
  });
})();
