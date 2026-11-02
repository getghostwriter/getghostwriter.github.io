// Ghost Media Works website: Ghost Writer pages' own behaviour (audit 2026-11-01 picks 1A, 5A, 7A, 14A).
// Loaded only on /ghost-writer/ pages (build_site). Every page works without it: the stage is flat, the
// privacy illustration shows its finished line, the screenshots show without their lens.
(function () {
  "use strict";
  var root = document.documentElement;
  var motion = root.classList.contains("motion");  // head.js: set only when reduced motion is off
  var reduce = matchMedia("(prefers-reduced-motion: reduce)");
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function isLight() {
    var t = root.getAttribute("data-theme");
    return t ? t === "light" : matchMedia("(prefers-color-scheme: light)").matches;
  }
  // Run a loop only while its element is on screen and the tab is showing.
  function whileVisible(el, start, stop, threshold) {
    var on = false, seen = false;
    function update() {
      var want = seen && !document.hidden;
      if (want !== on) { on = want; (on ? start : stop)(); }
    }
    new IntersectionObserver(function (entries) { seen = entries[0].isIntersecting; update(); }, { threshold: threshold || 0 }).observe(el);
    document.addEventListener("visibilitychange", update);
  }

  // ---- 1A: the stage rises and flattens over the first 300 px of scroll (wide screens; CSS sets the start) ----
  var stage = document.querySelector("[data-gw-stage]");
  if (stage && motion) {
    var inner = stage.querySelector(".gw-stage-in"), wide = matchMedia("(min-width: 721px)"), ticking = false;
    var tilt = function () {
      ticking = false;
      if (!wide.matches || reduce.matches) { inner.style.transform = ""; return; }
      var p = clamp(scrollY / 300, 0, 1), e = 1 - Math.pow(1 - p, 3);  // ease-out mapped to scroll
      inner.style.transform = "perspective(1400px) rotateX(" + (8 * (1 - e)).toFixed(2) + "deg) scale(" + (0.94 + 0.06 * e).toFixed(4) + ")";
    };
    addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(tilt); } }, { passive: true });
    wide.addEventListener("change", tilt);
    tilt();
  }

  // ---- 14A: the demo loop loads nothing but its poster until a quarter of it is on screen ----
  document.querySelectorAll("video[data-lazy-play]").forEach(function (video) {
    if (reduce.matches) { video.controls = true; return; }  // reduced motion: poster + a play button, never by itself
    whileVisible(video, function () {
      video.preload = "auto";
      var played = video.play();
      if (played && played.catch) played.catch(function () { video.controls = true; });  // e.g. a phone in Low Power Mode
    }, function () { video.pause(); }, 0.25);
  });

  // ---- 5A: the "nothing leaves" illustration ----
  document.querySelectorAll("[data-gw-proof]").forEach(function (proof) {
    var wifi = proof.querySelector(".gw-wifi"), label = proof.querySelector(".gw-wifi-label");
    if (wifi) wifi.addEventListener("click", function () {
      var off = wifi.getAttribute("aria-pressed") !== "true";
      wifi.setAttribute("aria-pressed", String(off));
      label.textContent = off ? "Wi-Fi off: it keeps typing" : "Wi-Fi on";
    });
    if (!motion) return;  // still: the whole line, a flat meter
    var body = proof.querySelector("[data-gw-words]"), canvas = proof.querySelector(".gw-proof-line");
    var text = body.textContent.trim().split(/\s+/), words = [];
    body.setAttribute("aria-label", body.textContent.trim());
    body.textContent = "";
    text.forEach(function (w, i) {
      var s = document.createElement("span");
      s.className = "w on";
      s.setAttribute("aria-hidden", "true");
      s.textContent = w;
      body.appendChild(s);
      if (i < text.length - 1) body.appendChild(document.createTextNode(" "));
      words.push(s);
    });
    function show(n) {
      for (var i = 0; i < words.length; i++) {
        words[i].classList.toggle("on", i < n);
        words[i].classList.toggle("lit", i < n && i >= n - 4 && n < words.length);
      }
    }
    var ctx = canvas.getContext("2d"), timer = 0, raf = 0, n = words.length, t0 = 0;
    function step() {  // a word every 180-260 ms, then the finished line rests 2.4 s and starts again
      n = n >= words.length ? 0 : n + 1;
      show(n);
      timer = setTimeout(step, n >= words.length ? 2400 : 180 + Math.random() * 80);
    }
    function draw(now) {  // the meter: flat at zero, its faint noise floor shows it is live
      raf = requestAnimationFrame(draw);
      var w = canvas.clientWidth, h = canvas.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
      if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      var accent = getComputedStyle(root).getPropertyValue("--accent").trim() || "#8f91ff", y = h - 14, t = (now - t0) / 1000;
      ctx.globalAlpha = 1; ctx.lineWidth = 1; ctx.strokeStyle = isLight() ? "rgba(18,24,38,.15)" : "rgba(238,241,246,.14)";
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      ctx.globalAlpha = 0.3; ctx.lineWidth = 2; ctx.strokeStyle = accent; ctx.beginPath();
      for (var x = 0; x <= w; x += 6) {
        var a = Math.sin(x * 0.09 + t * 3.1) * 0.6 + Math.sin(x * 0.23 - t * 4.7) * 0.4;
        if (x === 0) ctx.moveTo(x, y + a * 2); else ctx.lineTo(x, y + a * 2);
      }
      ctx.stroke();
      ctx.globalAlpha = 1; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    whileVisible(proof, function () {
      if (reduce.matches) return;
      t0 = performance.now(); n = 0; show(0); timer = setTimeout(step, 400); raf = requestAnimationFrame(draw);
    }, function () {
      clearTimeout(timer); cancelAnimationFrame(raf); show(words.length); n = words.length;
    });
  });

  // ---- 7A: each lens gets a copy of its screenshot (the same file, already loaded; theme sources kept) ----
  document.querySelectorAll(".gw-moment .gw-lens").forEach(function (lens) {
    var picture = lens.parentNode.querySelector("picture");
    if (!picture) return;
    var copy = picture.cloneNode(true), img = copy.querySelector("img");
    img.alt = "";
    img.removeAttribute("fetchpriority");
    lens.appendChild(copy);  // site.js's theme button updates every theme <source>, these copies included
  });
})();
