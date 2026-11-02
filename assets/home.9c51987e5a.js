// Ghost Media Works website: the home page's motion (owner's picks 2026-11-01; looks in home.css).
// build_site loads it on "/" only, after pill.js (the app's listening pill, window.GhostPill).
//   1A  the product stage flattens from a slight tilt over the first 300 px of scrolling (wide screens)
//   2A  the live scene: words typed at speaking pace, a sentence rewritten, then "Hey Ghost, open Spotify";
//       its chapter buttons jump to each part
//   3A  one message in three acts, pinned on wide screens and driven by scrolling
//   4A  one pass of light across the promise band as it comes into view
//   5A  the "nothing leaves" meter: a line being dictated, the meter staying flat, a Wi-Fi switch that changes nothing
// Rules: runs only with html.motion (head.js: no reduced motion); without it every part is a finished, still
// picture. Loops run only while their part is on screen and the tab is showing; per frame only transform,
// opacity and the canvases change.
(function () {
  "use strict";
  var root = document.documentElement;
  if (!root.classList.contains("motion")) return;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)");
  var wide = matchMedia("(min-width: 721px)");

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function isLight() {
    var t = root.getAttribute("data-theme");
    return t ? t === "light" : matchMedia("(prefers-color-scheme: light)").matches;
  }

  // One frame loop; each part says whether it's on screen.
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
    entries.forEach(function (e) { e.target.homePart.visible = e.isIntersecting; });
    wake();
  }, { rootMargin: "80px 0px" });
  function part(el, tick) {
    var p = { tick: tick, visible: false };
    el.homePart = p;
    parts.push(p);
    seen.observe(el);
  }
  document.addEventListener("visibilitychange", wake);
  addEventListener("scroll", wake, { passive: true });

  // Each word of an element in its own span (text inside `skip` stays as it is).
  function splitWords(el, skip) {
    var nodes = [], words = [];
    var walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walk.nextNode()) if (!(skip && walk.currentNode.parentNode.closest(skip))) nodes.push(walk.currentNode);
    nodes.forEach(function (node) {
      var frag = document.createDocumentFragment();
      node.data.split(/(\s+)/).forEach(function (piece) {
        if (!piece) return;
        if (/^\s+$/.test(piece)) { frag.appendChild(document.createTextNode(piece)); return; }
        var s = document.createElement("span");
        s.className = "w";
        s.textContent = piece;
        frag.appendChild(s);
        words.push(s);
      });
      node.parentNode.replaceChild(frag, node);
    });
    return words;
  }
  // Shows the first n words; the newest four are lit while the sentence is still arriving.
  function revealer(words) {
    var shown = -1;
    return function (n) {
      if (n === shown) return;
      for (var i = 0; i < words.length; i++) {
        words[i].classList.toggle("on", i < n);
        words[i].classList.toggle("lit", i < n && i >= n - 4 && n < words.length);
      }
      shown = n;
    };
  }
  // A class that follows a condition, touched only when it changes.
  function classer(el) {
    var now = {};
    return function (name, on) { if (now[name] !== on) { now[name] = on; el.classList.toggle(name, on); } };
  }
  // The app's listening pill on a canvas; draw(dt, peak) moves its voice line on a 60-a-second clock, like the app.
  function livePill(canvas) {
    var pill = window.GhostPill;
    if (!canvas || !pill) return null;
    var ctx = canvas.getContext("2d"), cssW = 0, dpr = 1, level = 0, history = [], carry = 0, clock = 0;
    function size() {
      cssW = canvas.clientWidth;
      dpr = Math.min(2, devicePixelRatio || 1);
      var w = Math.round(cssW * dpr), h = Math.round(cssW * pill.SIZE[1] / pill.SIZE[0] * dpr);
      if (w && (canvas.width !== w || canvas.height !== h)) { canvas.width = w; canvas.height = h; }
    }
    new ResizeObserver(size).observe(canvas);
    return function (dt, peak) {
      carry += dt;
      clock += dt;
      while (carry >= 1 / 60) {
        carry -= 1 / 60;
        level = pill.voiceAmount(peak(), level, 1 / 60);
        history.push(level);
        if (history.length > pill.HISTORY) history.shift();
      }
      if (!cssW) size();
      if (!cssW) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      pill.draw(ctx, { state: "listening", t: clock, history: history, level: level, theme: isLight() ? "light" : "dark",
                       scale: cssW / pill.SIZE[0], dpr: dpr, glow: 1, alpha: pill.OPACITY });
    };
  }

  // ---- 1A + 2A: the stage and its live scene ----
  var scene = document.querySelector("[data-scene]");
  if (scene) (function () {
    var stage = scene.closest("[data-stage]");
    var words = [];
    scene.querySelectorAll("[data-words]").forEach(function (p) { words = words.concat(splitWords(p, ".hw-new")); });
    var reveal = revealer(words);
    // When each word lands: 150 to 250 ms apart, a breath after each sentence; all of it in about 5.8 s.
    var times = [], acc = 0;
    words.forEach(function (w, i) {
      times.push(acc);
      acc += 0.15 + ((i * 37) % 11) / 110 + (/[.!?:]$/.test(w.textContent) ? 0.28 : 0);
    });
    times = times.map(function (t) { return 0.2 + t * 5.8 / acc; });
    // The timeline (seconds): Dictate, Rewrite, Hey Ghost, a short rest, then again.
    var CHAPTERS = [0, 6.2, 10.5], HEY_END = 15, LOOP = 16;
    var set = classer(scene), t = 8;  // starts on the still picture: the menu open on "Make it friendlier"
    var buttons = stage.querySelectorAll("[data-chapter]"), pressed = -1, bars = [];
    buttons.forEach(function (b, i) {
      bars.push(b.querySelector("i"));
      b.disabled = false;
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", function () { t = CHAPTERS[i]; wake(); });
    });
    var voice = window.GhostPill ? new window.GhostPill.PretendVoice(7) : null;
    var drawPill = voice ? livePill(scene.querySelector(".hw-pill canvas")) : null;
    scene.classList.add("live");
    function peak() { return voice.peakAt(1 / 60); }
    part(scene, function (dt) {
      t += dt;
      if (t >= LOOP) t -= LOOP;
      var n = words.length;
      if (t < CHAPTERS[1]) for (n = 0; n < words.length && times[n] <= t; n++) {}
      reveal(n);
      set("is-talk", t < CHAPTERS[1] - 0.2);
      set("is-sel", t >= 6.4 && t < 10.2);
      set("is-menu", t >= 7 && t < 9.2);
      set("is-pick", t >= 7.8 && t < 9.2);
      set("is-new", t >= 9.2 && t < 15.4);
      set("is-dim", t >= 10.6 && t < HEY_END);
      set("is-say", t >= 10.8 && t < HEY_END);
      set("is-done", t >= 12.2 && t < HEY_END);
      set("is-wipe", t >= 15.4);
      var ch = t < CHAPTERS[1] ? 0 : t < CHAPTERS[2] ? 1 : 2;
      if (ch !== pressed) {
        for (var i = 0; i < buttons.length; i++) {
          buttons[i].setAttribute("aria-pressed", i === ch ? "true" : "false");
          if (bars[i]) bars[i].style.setProperty("--p", "0");
        }
        pressed = ch;
      }
      var end = ch < 2 ? CHAPTERS[ch + 1] : HEY_END;
      if (bars[ch]) bars[ch].style.setProperty("--p", clamp((t - CHAPTERS[ch]) / (end - CHAPTERS[ch]), 0, 1).toFixed(3));
      if (drawPill && t < CHAPTERS[1]) drawPill(dt, peak);
    });

    // The stage rises flat over the first 300 px of scrolling (wide screens; phones: flat, home.css).
    var shown = "";
    if (stage) part(stage, function () {
      var e = 1 - Math.pow(1 - clamp(scrollY / 300, 0, 1), 3), tf = "";
      if (wide.matches) tf = "perspective(1400px) rotateX(" + (8 * (1 - e)).toFixed(2) + "deg) scale(" + (0.94 + 0.06 * e).toFixed(4) + ")";
      if (tf !== shown) { scene.style.transform = tf; shown = tf; }
    });
  })();

  // ---- 3A: one message, three acts (pinned on wide screens; phones keep the three still cards) ----
  var acts = document.querySelector("[data-acts]");
  if (acts) (function () {
    var track = acts.querySelector(".acts-track"), items = acts.querySelectorAll("[data-act]"), rail = acts.querySelector(".acts-rail i");
    var words = splitWords(acts.querySelector("[data-type]")), reveal = revealer(words), set = classer(acts);
    var drawPill = livePill(acts.querySelector(".aw-pill canvas"));
    if (drawPill) acts.classList.add("has-pill");
    var current = -1, speed = 0, lastY = scrollY, clock = 0;
    function show(act) {
      if (act === current) return;
      for (var i = 0; i < items.length; i++) items[i].classList.toggle("on", i === act);
      current = act;
    }
    function sync() {
      acts.classList.toggle("live", wide.matches);
      if (!wide.matches) { show(-1); reveal(words.length); ["is-sel", "is-menu", "is-new", "is-say", "is-sent"].forEach(function (c) { set(c, false); }); }
    }
    wide.addEventListener("change", sync);
    sync();
    function peak() { return 0.003 + speed * 0.22 * (0.75 + 0.25 * Math.sin(clock * 23)); }
    part(acts, function (dt) {
      speed = Math.max(speed * Math.pow(0.02, dt), Math.min(1, Math.abs(scrollY - lastY) / 18));
      lastY = scrollY;
      if (!wide.matches) return;
      // 0 to 1 while the scene is pinned (sticky top 12vh, 76vh tall: home.css)
      var r = track.getBoundingClientRect(), vh = innerHeight;
      var p = clamp((vh * 0.12 - r.top) / Math.max(1, r.height - vh * 0.76), 0, 1);
      show(p < 0.45 ? 0 : p < 0.7 ? 1 : 2);
      reveal(Math.round(clamp(p / 0.4, 0, 1) * words.length));  // the reply is complete a moment before act two
      set("is-sel", p >= 0.48);
      set("is-menu", p >= 0.53 && p < 0.64);
      set("is-new", p >= 0.64);
      set("is-say", p >= 0.74);
      set("is-sent", p >= 0.85);
      if (rail) rail.style.setProperty("--p", p.toFixed(4));
      if (drawPill && current === 0) { clock += dt; drawPill(dt, peak); }
    });
  })();

  // ---- 4A: one pass of light across the promise band ----
  var band = document.querySelector("[data-band]");
  if (band) {
    var sweep = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { band.classList.add("swept"); sweep.disconnect(); } });
    }, { threshold: 0.2 });
    sweep.observe(band);
  }

  // ---- 5A: the line keeps typing, the meter stays flat, with Wi-Fi on or off ----
  var proof = document.querySelector("[data-proof]");
  if (proof) (function () {
    var line = proof.querySelector("[data-proof-line]"), canvas = proof.querySelector(".proof-graph canvas");
    var wifi = proof.querySelector(".proof-wifi"), label = proof.querySelector("[data-wifi-label]");
    var LINES = [line.textContent.trim(), "Remind me to renew my passport before the trip in June.",
                 "Message for the landlord: the kitchen tap is still leaking. Could someone come by this week?"];
    var which = 0, words = LINES[0].split(" "), n = words.length, wait = 2.6, clock = 0;
    var text = document.createTextNode(LINES[0]), caret = document.createElement("span");
    caret.className = "proof-caret";
    line.textContent = "";
    line.appendChild(text);
    line.appendChild(caret);
    wifi.disabled = false;
    wifi.setAttribute("aria-pressed", "true");
    label.textContent = "Wi-Fi on";
    wifi.addEventListener("click", function () {
      var on = wifi.getAttribute("aria-pressed") !== "true";
      wifi.setAttribute("aria-pressed", on ? "true" : "false");
      label.textContent = on ? "Wi-Fi on" : "Wi-Fi off: still typing";
    });
    var ctx = canvas.getContext("2d"), cw = 0, chh = 0, dpr = 1, color = "", colorAge = 1;
    function size() {
      cw = canvas.clientWidth; chh = canvas.clientHeight; dpr = Math.min(2, devicePixelRatio || 1);
      canvas.width = Math.round(cw * dpr); canvas.height = Math.round(chh * dpr);
    }
    new ResizeObserver(size).observe(canvas);
    proof.classList.add("live");
    part(proof, function (dt) {
      clock += dt;
      wait -= dt;
      if (wait <= 0) {
        if (n < words.length) {
          n++;
          text.data = words.slice(0, n).join(" ");
          wait = n < words.length ? 0.16 + ((n * 37) % 7) / 50 + (/[.,:?]$/.test(words[n - 1]) ? 0.3 : 0) : 2.6;  // a pause to read it
        } else {
          which = (which + 1) % LINES.length;
          words = LINES[which].split(" ");
          n = 0;
          text.data = "";
          wait = 0.5;
        }
      }
      if (!cw) return;
      colorAge += dt;
      if (colorAge > 0.5) { color = getComputedStyle(proof).getPropertyValue("--accent").trim() || "#8f91ff"; colorAge = 0; }
      var y = chh * 44 / 60, x;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, chh);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke();
      // a faint noise floor, 2 px high, so the meter is clearly live
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (x = 0; x <= cw; x += 6) {
        var v = Math.sin(x * 0.09 + clock * 5.1) * Math.sin(x * 0.023 - clock * 2.3) + 0.5 * Math.sin(x * 0.31 + clock * 9.7);
        if (x === 0) ctx.moveTo(x, y - 1 + v * 1.3); else ctx.lineTo(x, y - 1 + v * 1.3);
      }
      ctx.stroke();
    });
  })();

  // Reduced motion switched on while the page is open: everything stops on its still picture.
  reduce.addEventListener("change", function (m) {
    if (!m.matches) return;
    parts.length = 0;
    document.querySelectorAll(".home-scene.live, .home-acts.live, .home-proof.live").forEach(function (el) { el.classList.remove("live"); });
    if (scene) scene.style.transform = "";
  });
})();
