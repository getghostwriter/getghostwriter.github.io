// Ghost Media Works website: the shared frame's motion (owner's picks 2026-11-01, audit-2026-11-01 10A, 11A, 4A).
//   - .band and .closing get .seen once when they come into view: the band's light sweeps across once, the
//     closing ghost rises and its glow brightens once (site.css frame block).
//   - [data-montage] (Media Hub, 10A): the still grid of pictures becomes one wide screen that crossfades through
//     them, each slowly pushing in, with a progress line per picture; pauses off screen, in a hidden tab, on hover
//     or keyboard focus, and with its own pause button; arrows step through by hand.
// Only with motion (head.js sets html.motion when reduced motion is off). Without it, or without this script,
// every part shows its finished, still state. Only transform and opacity change; nothing loads from other sites.
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

  // ---- arrivals: .band / .closing get .seen once ----
  var arrivals = document.querySelectorAll(".band, .closing");
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

  // ---- 10A montage ----
  var ICONS = {
    prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
    play: '<svg class="i-pause" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6.5" y="5" width="3.6" height="14" rx="1"/><rect x="13.9" y="5" width="3.6" height="14" rx="1"/></svg>' +
          '<svg class="i-play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>'
  };

  function montage(box) {
    var shots = Array.prototype.slice.call(box.children).filter(function (n) { return n.tagName === "FIGURE"; });
    if (shots.length < 2) return;
    var now = 0, reasons = {}, segs = [];

    var bar = document.createElement("div");
    bar.className = "montage-segs";
    bar.setAttribute("aria-hidden", "true");
    shots.forEach(function () {
      var seg = document.createElement("i");
      seg.appendChild(document.createElement("b"));
      bar.appendChild(seg);
      segs.push(seg);
    });
    var ctl = document.createElement("div");
    ctl.className = "montage-ctl";
    ctl.innerHTML = '<button type="button" data-prev aria-label="Previous picture">' + ICONS.prev + "</button>" +
      '<button type="button" data-play aria-pressed="false" aria-label="Pause the pictures">' + ICONS.play + "</button>" +
      '<button type="button" data-next aria-label="Next picture">' + ICONS.next + "</button>";
    box.appendChild(bar);
    box.appendChild(ctl);
    box.classList.add("is-live");
    box.setAttribute("aria-roledescription", "carousel");
    shots.forEach(function (f, i) {
      f.setAttribute("aria-roledescription", "slide");
      f.setAttribute("aria-label", (i + 1) + " of " + shots.length);
    });

    function show(i) {
      now = (i + shots.length) % shots.length;
      shots.forEach(function (f, k) {
        var on = k === now;
        f.classList.toggle("on", on);
        if (on) f.removeAttribute("aria-hidden"); else f.setAttribute("aria-hidden", "true");
      });
      segs.forEach(function (s, k) {
        s.classList.remove("now");
        s.classList.toggle("done", k < now);
      });
      void segs[now].offsetWidth;  // restart the progress line even when it is the same picture again
      segs[now].classList.add("now");
      var img = shots[now].querySelector("img");
      if (img) { img.style.animation = "none"; void img.offsetWidth; img.style.animation = ""; }  // restart the push-in
    }
    // the progress line's end moves on to the next picture, so pausing the line pauses the timer too
    bar.addEventListener("animationend", function (e) {
      if (e.animationName === "montage-seg" && e.target.parentNode === segs[now]) show(now + 1);
    });

    function pause(reason, on) {
      if (on) reasons[reason] = true; else delete reasons[reason];
      box.classList.toggle("paused", Object.keys(reasons).length > 0);
    }
    var playBtn = ctl.querySelector("[data-play]");
    playBtn.addEventListener("click", function () {
      var stop = !reasons.user;
      pause("user", stop);
      box.classList.toggle("paused-user", stop);
      playBtn.setAttribute("aria-pressed", String(stop));
      playBtn.setAttribute("aria-label", stop ? "Play the pictures" : "Pause the pictures");
    });
    function step(by) {
      box.setAttribute("aria-live", "polite");  // stepping by hand announces the new caption
      show(now + by);
    }
    ctl.querySelector("[data-prev]").addEventListener("click", function () { step(-1); });
    ctl.querySelector("[data-next]").addEventListener("click", function () { step(1); });
    box.addEventListener("mouseenter", function () { pause("hover", true); });
    box.addEventListener("mouseleave", function () { pause("hover", false); });
    box.addEventListener("focusin", function () { pause("focus", true); });
    box.addEventListener("focusout", function (e) { if (!box.contains(e.relatedTarget)) pause("focus", false); });
    document.addEventListener("visibilitychange", function () { pause("hidden", document.hidden); });
    if ("IntersectionObserver" in window) {
      pause("away", true);
      new IntersectionObserver(function (entries) { pause("away", !entries[0].isIntersecting); }).observe(box);
    }
    show(0);
  }
  Array.prototype.forEach.call(document.querySelectorAll("[data-montage]"), montage);
})();
