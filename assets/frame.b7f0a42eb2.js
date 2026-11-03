// Ghost Media Works website: the shared frame's motion (owner's picks 2026-11-01, audit-2026-11-01 11A, 12A).
//   - .closing gets .seen once when it comes into view: the closing ghost rises and its glow brightens once
//     (site.css frame block).
//   - 12A page changes: a view transition the browser skips is kept out of the console.
// Only with motion (head.js sets html.motion when reduced motion is off). Without it, or without this script,
// the closing band shows its finished, still state. Only transform and opacity change; nothing loads from other sites.
(function () {
  "use strict";
  var root = document.documentElement;
  // 12A page changes are CSS only (site.css). A change the browser skips (a hidden tab, a quick second click) rejects
  // its promises; nothing is wrong then, so keep that out of the console.
  function quiet(e) {
    var t = e.viewTransition;
    if (t) [t.ready, t.finished, t.updateCallbackDone].forEach(function (p) { if (p) p.catch(function () {}); });
  }
  addEventListener("pageswap", quiet);
  addEventListener("pagereveal", quiet);
  if (!root.classList.contains("motion") || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  root.classList.add("frame-js");

  // ---- arrivals: .closing gets .seen once ----
  var arrivals = document.querySelectorAll(".closing");
  if ("IntersectionObserver" in window) {
    var arrive = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("seen"); arrive.unobserve(e.target); }
      });
    }, { threshold: 0.3 });
    Array.prototype.forEach.call(arrivals, function (el) { arrive.observe(el); });
  } else {
    Array.prototype.forEach.call(arrivals, function (el) { el.classList.add("seen"); });
  }
})();
