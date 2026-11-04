// Ghost Media Works website: the owner's motion picks (2026-10-28), ported from
// dev/design/site-redesign/motion-ideas-2026-10-28. No libraries, nothing from other sites.
//   S4  depth: elements with data-depth (the Ghost Writer hero's ghost) drift a little slower than the page
//   B2  faint voice-wave lines behind the Ghost Writer hero, swelling near the pointer
//   M1  cards tilt slightly toward the pointer with a soft light (mouse only)
// Rules: head.js sets html.motion before the page paints, only when motion is welcome (no reduced motion), so
// the layouts never jump; without it every section shows its full content, still. Every loop runs only while
// its part of the page is on screen and the tab is showing; only transform/opacity/canvas change per frame.
(function () {
  "use strict";
  var root = document.documentElement;
  if (!root.classList.contains("motion")) return;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)");
  var finePointer = matchMedia("(hover: hover) and (pointer: fine)");

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function isLight() {
    return root.getAttribute("data-theme") === "light";  // dark unless chosen (head.js); no device-following theme
  }

  // One frame loop for everything; parts register a tick and say whether they're on screen.
  var parts = [], raf = 0, last = 0;
  function frame(now) {
    raf = 0;
    var dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
    last = now;
    var busy = false;
    for (var i = 0; i < parts.length; i++) if (parts[i].visible) { parts[i].tick(dt); busy = true; }
    if (busy && !document.hidden) raf = requestAnimationFrame(frame); else last = 0;
  }
  function wake() { if (!raf && !document.hidden) raf = requestAnimationFrame(frame); }
  var seen = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { e.target.motionPart.visible = e.isIntersecting; });
    wake();
  }, { rootMargin: "80px 0px" });
  function part(el, tick) {
    var p = { tick: tick, visible: false };
    el.motionPart = p;
    parts.push(p);
    seen.observe(el);
  }
  document.addEventListener("visibilitychange", wake);
  addEventListener("scroll", wake, { passive: true });

  // ---- S4: depth. The element's --depth-y follows its distance from the screen's middle (max 40 px) ----
  document.querySelectorAll("[data-depth]").forEach(function (el) {
    var k = parseFloat(el.getAttribute("data-depth")) || 0.1, max = parseFloat(el.getAttribute("data-depth-max")) || 40, lastY = null;
    part(el, function () {
      // Lags behind the scroll by k, measured from where it sits as designed: centred on the screen, or at
      // the top of the page for things near the top (so nothing moves on load).
      var r = el.getBoundingClientRect(), centre = r.top + scrollY + r.height / 2;
      var y = clamp((scrollY - Math.max(0, centre - innerHeight / 2)) * k, -max, max);
      y = Math.round(y * 10) / 10;
      if (y !== lastY) { el.style.setProperty("--depth-y", y + "px"); lastY = y; }
    });
  });

  // ---- B2: voice-wave field (lines under 0.25 opacity). A fixed layer over the whole page, above the stars and
  //      under the words (owner, 2026-11-03: the lines run the whole way down, not only the hero); the page's own
  //      canvas is moved out of its section so no ancestor can pin it. ----
  document.querySelectorAll("canvas.wave-field").forEach(function (canvas) {
    var ctx = canvas.getContext("2d"), dpr = 1, w = 0, h = 0;
    var px = -1, lift = 0, t = Math.random() * 10;
    document.body.appendChild(canvas);
    function size() {
      dpr = Math.min(2, devicePixelRatio || 1);
      w = Math.round(innerWidth * dpr); h = Math.round(innerHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    }
    size();
    addEventListener("resize", size);
    if (finePointer.matches) {
      document.addEventListener("pointermove", function (e) { px = e.clientX / innerWidth; }, { passive: true });
      document.addEventListener("pointerleave", function () { px = -1; });
    }
    var LINES = 6;
    var skip = false, light = !finePointer.matches;  // phones: 30 drawings a second, easier on the battery
    part(canvas, function (dt) {
      t += dt;
      if (light && (skip = !skip)) return;
      lift += ((px < 0 ? 0 : 1) - lift) * Math.min(1, dt * 3);
      ctx.clearRect(0, 0, w, h);
      var rgb = isLight() ? "79,82,224" : "143,145,255";
      var step = Math.max(3, Math.round(4 * dpr)), amp = Math.min(h * 0.05, 26 * dpr);
      ctx.lineWidth = 1.3 * dpr;
      for (var k = 0; k < LINES; k++) {
        var base = h * (0.22 + k * 0.11);
        ctx.beginPath();
        for (var x = 0; x <= w + step; x += step) {
          var u = x / w, near = px < 0 ? 0 : Math.exp(-Math.pow((u - px) * 5, 2)) * lift;
          var y = base + Math.sin(u * (5 + k) + t * (0.45 + k * 0.09) + k) * amp * (0.45 + k * 0.1) * (1 + near * 2.2);
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = "rgba(" + rgb + "," + (0.07 + k * 0.022).toFixed(3) + ")";  // 0.07 .. 0.18
        ctx.stroke();
      }
    });
  });

  // ---- M1: cards that respond (mouse only; never cards with a form in them) ----
  if (finePointer.matches) {
    var active = null, pending = null;
    document.querySelectorAll(".card").forEach(function (card) {
      if (!card.querySelector("input, select, textarea, form, video, canvas")) card.classList.add("tilt");
    });
    function apply() {
      var e = pending; pending = null;
      if (!e || !active) return;
      var r = active.getBoundingClientRect(), x = clamp((e.clientX - r.left) / r.width, 0, 1), y = clamp((e.clientY - r.top) / r.height, 0, 1);
      var big = r.width > 520 ? 0.5 : 1;  // wide cards tilt less
      active.style.transform = "perspective(900px) rotateX(" + ((0.5 - y) * 6 * big).toFixed(2) + "deg) rotateY(" + ((x - 0.5) * 7 * big).toFixed(2) + "deg)";
      active.style.setProperty("--mx", (x * 100).toFixed(1) + "%");
      active.style.setProperty("--my", (y * 100).toFixed(1) + "%");
    }
    document.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse") return;
      var card = e.target.closest ? e.target.closest(".card.tilt") : null;
      if (card !== active) {
        if (active) { active.style.transform = ""; active.classList.remove("lit"); }
        active = card;
        if (active) active.classList.add("lit");
      }
      if (active) { if (!pending) requestAnimationFrame(apply); pending = e; }
    }, { passive: true });
    document.addEventListener("pointerleave", function () { if (active) { active.style.transform = ""; active.classList.remove("lit"); active = null; } });
  }

  // Someone turns reduced motion on while here: stop everything and show the still page.
  reduce.addEventListener("change", function (m) { if (m.matches) { root.classList.remove("motion"); parts.length = 0; } });
})();
