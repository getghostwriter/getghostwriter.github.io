// Ghost Media Works website: the owner's motion picks (2026-10-28), ported from
// dev/design/site-redesign/motion-ideas-2026-10-28. No libraries, nothing from other sites.
//   S2  Ghost Writer "What it does": the picture stays pinned and crossfades to the feature in view
//   S3  home "Talk. It types.": the email writes itself as you scroll; the app's pill ripples with scroll speed
//   S4  depth: the floating ghost (and its glow) and the Ghost Writer title ghost drift a little slower than the page
//   B2  faint voice-wave lines behind the Ghost Writer hero and the S3 section, swelling near the pointer
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
    var t = root.getAttribute("data-theme");
    return t ? t === "light" : matchMedia("(prefers-color-scheme: light)").matches;
  }

  // One frame loop for everything; parts register a tick and say whether they're on screen.
  var parts = [], raf = 0, last = 0;
  function frame(now) {
    raf = 0;
    var dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
    last = now;
    var busy = false;
    for (var i = 0; i < parts.length; i++) if (parts[i].visible) { parts[i].tick(dt, now / 1000); busy = true; }
    if (busy && !document.hidden) raf = requestAnimationFrame(frame); else last = 0;
  }
  function wake() { if (!raf && !document.hidden) raf = requestAnimationFrame(frame); }
  var seen = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { e.target.motionPart.visible = e.isIntersecting; });
    wake();
  }, { rootMargin: "80px 0px" });
  function part(el, tick) {
    var p = { el: el, tick: tick, visible: false };
    el.motionPart = p;
    parts.push(p);
    seen.observe(el);
    return p;
  }
  document.addEventListener("visibilitychange", wake);
  addEventListener("scroll", wake, { passive: true });

  // ---- S2: the app stays, the story scrolls (Ghost Writer page, wide screens; CSS does the pinning) ----
  document.querySelectorAll("[data-story]").forEach(function (story) {
    var pics = story.querySelectorAll(".story-pic"), steps = story.querySelectorAll(".story-step");
    var current = -1;
    function show(i) {
      if (i === current) return;
      current = i;
      for (var k = 0; k < pics.length; k++) pics[k].classList.toggle("on", k === i);
      for (var k2 = 0; k2 < steps.length; k2++) steps[k2].classList.toggle("on", k2 === i);
    }
    // The step crossing the middle band of the screen is the one shown.
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) show(Array.prototype.indexOf.call(steps, e.target)); });
    }, { rootMargin: "-45% 0px -45% 0px" });
    steps.forEach(function (s) { io.observe(s); });
    show(0);
  });

  // ---- S3: words appear as you scroll, and the pill ripples with the scrolling (home) ----
  document.querySelectorAll("[data-type-scroll]").forEach(function (box) {
    var body = box.querySelector("[data-type-words]"), canvas = box.querySelector("canvas.type-pill");
    var words = [], shown = -1;
    // Each word in its own span; hidden words keep their room, so nothing below moves.
    var text = body.textContent.trim().split(/\s+/);
    body.textContent = "";
    text.forEach(function (w, i) {
      var s = document.createElement("span");
      s.className = "w";
      s.textContent = w;
      body.appendChild(s);
      if (i < text.length - 1) body.appendChild(document.createTextNode(" "));
      words.push(s);
    });
    function reveal(n) {
      if (n === shown) return;
      for (var i = 0; i < words.length; i++) {
        words[i].classList.toggle("on", i < n);
        words[i].classList.toggle("lit", i < n && i >= n - 4 && n < words.length);
      }
      shown = n;
    }
    var pill = window.GhostPill, ctx = canvas && pill ? canvas.getContext("2d") : null;
    var level = 0, history = [], speed = 0, lastY = scrollY, clock = 0, carry = 0, cssW = 0, dpr = 1;
    function size() {
      if (!ctx) return;
      cssW = canvas.clientWidth;
      dpr = Math.min(2, devicePixelRatio || 1);
      var w = Math.round(cssW * dpr), h = Math.round(cssW * pill.SIZE[1] / pill.SIZE[0] * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    }
    // Scrolled past (a jump, a fast fling): the whole sentence, never half of it.
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (!e.isIntersecting && e.boundingClientRect.top < 0) reveal(words.length); });
    }).observe(box);
    if (ctx) {
      box.classList.add("has-pill");
      size();
      new ResizeObserver(size).observe(canvas);
    }
    part(box, function (dt) {
      var r = box.getBoundingClientRect(), vh = innerHeight;
      // Starts as the card comes up the screen; done a little before the card stops being pinned (its sticky
      // top: site.css), so the finished sentence holds for a moment.
      var card = box.firstElementChild, pinTop = parseFloat(getComputedStyle(card).top) || 0;
      var start = vh * 0.5, end = pinTop - (r.height - card.offsetHeight) + vh * 0.2;
      var p = clamp((start - r.top) / Math.max(1, start - end), 0, 1);
      reveal(Math.round(p * words.length));
      speed = Math.max(speed * Math.pow(0.02, dt), Math.min(1, Math.abs(scrollY - lastY) / 18));
      lastY = scrollY;
      if (!ctx) return;
      carry += dt;
      clock += dt;
      while (carry >= 1 / 60) {  // the voice line moves on a 60-a-second clock, like the app
        carry -= 1 / 60;
        var peak = 0.003 + speed * 0.22 * (0.75 + 0.25 * Math.sin(clock * 23));
        level = pill.voiceAmount(peak, level, 1 / 60);
        history.push(level);
        if (history.length > pill.HISTORY) history.shift();
      }
      var s = cssW / pill.SIZE[0];
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      pill.draw(ctx, { state: "listening", t: clock, history: history, level: level, theme: isLight() ? "light" : "dark",
                       scale: s, dpr: dpr, glow: 1, alpha: pill.OPACITY });
    });
  });

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

  // ---- B2: voice-wave field (canvas behind the text; lines stay under 0.25 opacity) ----
  document.querySelectorAll("canvas.wave-field").forEach(function (canvas) {
    var host = canvas.parentElement, ctx = canvas.getContext("2d"), dpr = 1, w = 0, h = 0;
    var px = -1, lift = 0, t = Math.random() * 10;
    function size() {
      dpr = Math.min(2, devicePixelRatio || 1);
      w = Math.round(host.clientWidth * dpr); h = Math.round(host.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    }
    size();
    new ResizeObserver(size).observe(host);
    if (finePointer.matches) {
      host.addEventListener("pointermove", function (e) { var r = host.getBoundingClientRect(); px = (e.clientX - r.left) / r.width; }, { passive: true });
      host.addEventListener("pointerleave", function () { px = -1; });
    }
    var LINES = 6;
    var skip = false, light = !finePointer.matches;  // phones: 30 drawings a second, easier on the battery
    part(host, function (dt) {
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
      if (!card.querySelector("input, select, textarea, form, video, canvas") && !card.closest("[data-story]")) card.classList.add("tilt");
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
