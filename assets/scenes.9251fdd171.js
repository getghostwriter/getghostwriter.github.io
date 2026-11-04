// Ghost Media Works site film: the scene kit (look in scenes.css; manual: dev/design/site-film/README.md).
// Kit pieces: the playhead (--t on .scene[data-loop] / [data-play], .seen), .type, .keys, .pill, .menu/.toast/.confirm/
// .dialog/.cue (data-at), .dial, .switch, .meter, .count, .calendar, .curve, .tilt, .build, .wipe, .glow washes,
// .light-pass, .chooser/.chip/.ways.
// Rules: everything is complete before this runs (--t is 1); chips, the dial, the switch and the curve work with reduced
// motion too, only the motion is gated (html.motion, set by head.js). One shared requestAnimationFrame loop that sleeps
// when nothing on screen needs a frame; per frame only transforms, opacity and canvases change. Pages write no script.
(function () {
  "use strict";
  var root = document.documentElement;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)");
  var wide = matchMedia("(min-width: 721px)");
  var CSS_SCROLL = !!(window.CSS && CSS.supports && CSS.supports("animation-timeline: scroll()"));
  var PSEUDO_ANIM = typeof KeyframeEffect !== "undefined" && "pseudoElement" in KeyframeEffect.prototype;
  var CONTROLS = ".chip, .dial button, .curve > *";

  function motion() { return root.classList.contains("motion"); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function each(list, fn) { Array.prototype.forEach.call(list, fn); }
  function attrNum(el, name, dflt) { var v = parseFloat(el.getAttribute(name)); return isFinite(v) ? v : dflt; }
  function isLight() {
    return root.getAttribute("data-theme") === "light";  // dark unless chosen (head.js); no device-following theme
  }
  function token(name, dflt) { // a timing token from scenes.css, in milliseconds
    var v = getComputedStyle(root).getPropertyValue(name).trim(), n = parseFloat(v);
    return !isFinite(n) ? dflt : /ms$/.test(v) ? n : n * 1000;
  }
  function tell(scene, detail) { if (scene) scene.dispatchEvent(new CustomEvent("kit:change", { bubbles: true, detail: detail })); }

  // ---- the shared loop: parts read (layout) first, then write; the loop runs while something asks for frames ----
  var parts = [], raf = 0, last = 0, lastY = scrollY, speed = 0;
  function frame(now) {
    raf = 0;
    var dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60, i, more = false;
    last = now;
    var y = scrollY;
    speed = Math.max(speed * Math.pow(0.02, dt), Math.min(1, Math.abs(y - lastY) / 18));  // scroll speed, 0..1 (the pills ripple with it)
    lastY = y;
    for (i = 0; i < parts.length; i++) if (parts[i].on && parts[i].read) parts[i].read();
    for (i = 0; i < parts.length; i++) if (parts[i].on && parts[i].tick(dt)) more = true;
    if (more && !document.hidden) raf = requestAnimationFrame(frame); else last = 0;
  }
  function wake() { if (!raf && !document.hidden) raf = requestAnimationFrame(frame); }
  var onScreen = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { e.target.kitParts.forEach(function (p) { p.on = e.isIntersecting; }); });
    wake();
  }, { rootMargin: "120px 0px" });
  function part(el, p) {
    p.on = false;
    parts.push(p);
    if (!el.kitParts) { el.kitParts = []; onScreen.observe(el); }
    el.kitParts.push(p);
    return p;
  }
  // Once, when an element comes up the screen (its top past 80% of the height).
  var arrive = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { arrive.unobserve(e.target); e.target.kitArrive(); } });
  }, { rootMargin: "0px 0px -20% 0px" });
  function onArrive(el, fn) { el.kitArrive = fn; arrive.observe(el); }
  addEventListener("scroll", wake, { passive: true });
  addEventListener("resize", wake, { passive: true });
  document.addEventListener("visibilitychange", wake);


  // A looping scene (data-loop) runs on the kit's clock while motion is on; its playhead is scene.kitT.
  function looping(scene) { return !!scene && !!scene.kitSeek && motion(); }

  // ---- washes: the glow's colour; the old colour fades out over --wash ----
  function wash(stage, name) {
    if (!stage || !name) return;
    var old = stage.getAttribute("data-wash") || "indigo";
    if (old === name) return;
    stage.setAttribute("data-wash", name);
    var glow = stage.querySelector(".glow");
    if (glow && motion() && PSEUDO_ANIM) {
      glow.setAttribute("data-was", old);
      glow.animate([{ opacity: 1 }, { opacity: 0 }], { duration: token("--wash", 500), easing: "ease", pseudoElement: "::after" });
    }
  }
  // the glow's holder: the nearest [data-wash] or .stage around the scene's .glow (the frame's .hero-object too)
  function stageOf(el) {
    var s = el.closest(".scene"), g = s && s.querySelector(".glow");
    return s && ((g && g.parentElement.closest("[data-wash], .stage")) || s.querySelector(".stage"));
  }

  // ---- ways: the chooser's chips (and a dial, switch or curve) set data-way; matching content shows ----
  function setWay(scene, way, replayIt) {
    if (!scene || !way) return;
    var changed = scene.getAttribute("data-way") !== way;
    scene.setAttribute("data-way", way);
    each(scene.querySelectorAll(".chip[data-way]"), function (c) { c.setAttribute("aria-pressed", c.getAttribute("data-way") === way ? "true" : "false"); });
    each(scene.querySelectorAll("[data-way]"), function (el) {
      if (el === scene || el.matches(CONTROLS)) return;
      var on = el.getAttribute("data-way") === way;
      // A way that isn't showing is skipped (.way-gone) once its crossfade is over, and never before it has been laid
      // out once, so it keeps its size and the stack never changes height.
      clearTimeout(el.kitGone);
      if (on) el.classList.remove("way-gone");
      else if (!el.classList.contains("way-gone")) {
        requestAnimationFrame(function () {
          el.kitGone = setTimeout(function () { if (el.classList.contains("way-off")) el.classList.add("way-gone"); }, token("--xfade", 300));
        });
      }
      el.classList.toggle("way-on", on);
      el.classList.toggle("way-off", !on);
      if (on) el.removeAttribute("inert"); else el.setAttribute("inert", "");
    });
    if (replayIt) replay(scene);
    if (changed) tell(scene, { way: way });
  }
  // The same scene again, from the start (played and looping scenes, and live typing).
  function replay(scene) {
    if (!motion()) return;
    if (scene.kitSeek) scene.kitSeek(0);
    if (scene.hasAttribute("data-play") && scene.classList.contains("played")) {
      scene.classList.remove("played");
      getComputedStyle(scene).getPropertyValue("--t");  // settle the start frame, then play
      scene.classList.add("played");
      wake();
    }
    each(scene.querySelectorAll(".type[data-live].typed"), function (el) {
      if (el.closest(".way-gone")) return;  // skipped ways restart when they show again
      el.classList.remove("typed");
      getComputedStyle(el).opacity;
      el.classList.add("typed");
    });
  }

  function chooser(scene) {
    var chips = scene.querySelectorAll(".chip[data-way]");
    if (!chips.length) return;
    var start = scene.getAttribute("data-way"), pressed = scene.querySelector('.chip[aria-pressed="true"]');
    if (!start) start = (pressed || chips[0]).getAttribute("data-way");
    setWay(scene, start, false);
    var startChip = scene.querySelector('.chip[data-way="' + start + '"]');
    if (startChip && startChip.hasAttribute("data-wash")) wash(stageOf(startChip), startChip.getAttribute("data-wash"));
    each(chips, function (chip) {
      chip.addEventListener("click", function () {
        setWay(scene, chip.getAttribute("data-way"), true);
        if (chip.hasAttribute("data-wash")) wash(stageOf(chip), chip.getAttribute("data-wash"));
        if (chip.scrollIntoView && !wide.matches) chip.scrollIntoView({ block: "nearest", inline: "nearest", behavior: motion() ? "smooth" : "auto" });
      });
    });
  }

  // ---- data-at / data-until / data-ramp / data-from / data-to -> --k-at ... (no t at rest may hide a finished frame) ----
  function cueVars(scene) {
    each(scene.querySelectorAll("[data-at], [data-until], [data-ramp], [data-from], [data-to]"), function (el) {
      if (el.matches(".count")) return;
      var ramp = attrNum(el, "data-ramp", 0.04);
      if (el.hasAttribute("data-ramp")) el.style.setProperty("--k-ramp", ramp);
      if (el.hasAttribute("data-at")) el.style.setProperty("--k-at", Math.min(attrNum(el, "data-at", 0), 1 - ramp));
      if (el.hasAttribute("data-until")) el.style.setProperty("--k-until", attrNum(el, "data-until", 9));
      if (el.hasAttribute("data-from")) el.style.setProperty("--k-from", attrNum(el, "data-from", 0));
      if (el.hasAttribute("data-to")) el.style.setProperty("--k-to", attrNum(el, "data-to", 1));
    });
  }

  // ---- .type: each word in a span (punctuation in its own, a beat later), timed at speaking pace ----
  var STOP_RE = /[.!?…]["”’)]*$/, PAUSE_RE = /[,;:]["”’)]*$/, PUNCT_RE = /^(.*?[^.,!?;:…"”’)])([.,!?;:…]+["”’)]*)$/;
  function typeWords(el) {
    var pieces = [], walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), nodes = [];
    while (walk.nextNode()) nodes.push(walk.currentNode);
    nodes.forEach(function (node) {
      var frag = document.createDocumentFragment();
      node.data.split(/(\s+)/).forEach(function (bit) {
        if (!bit) return;
        if (/^\s+$/.test(bit)) { frag.appendChild(document.createTextNode(bit)); return; }
        var m = PUNCT_RE.exec(bit), word = m ? m[1] : bit, w = document.createElement("span"), pu = null;
        w.className = "w";
        w.textContent = word;
        frag.appendChild(w);
        if (m) {
          pu = document.createElement("span");
          pu.className = "pu";
          pu.textContent = m[2];
          frag.appendChild(pu);
        }
        pieces.push({ w: w, pu: pu, text: bit });
      });
      node.parentNode.replaceChild(frag, node);
    });
    return pieces;
  }
  function type(el) {
    var pieces = typeWords(el);
    if (!pieces.length) return;
    var word = token("--word", 160), stop = token("--stop", 700), beat = 120, at = [], acc = 0;
    pieces.forEach(function (p, i) {
      at.push(acc);
      acc += word;
      if (i < pieces.length - 1) acc += STOP_RE.test(p.text) ? stop : PAUSE_RE.test(p.text) ? 250 : 0;
    });
    if (el.hasAttribute("data-live")) {
      pieces.forEach(function (p, i) {
        p.w.style.setProperty("--k-ms", at[i] + "ms");
        if (p.pu) p.pu.style.setProperty("--k-ms", at[i] + beat + "ms");
      });
      onArrive(el, function () { if (motion()) el.classList.add("typed"); });
      return;
    }
    // On the playhead: the same rhythm squeezed into data-from..data-to (default 0..0.85) of it. Once a
    // frame the playhead is read and only the words that cross it change class (.on shown, .lit the accent flash).
    var from = attrNum(el, "data-from", 0), to = attrNum(el, "data-to", 0.85), span = Math.max(0.01, to - from);
    var lit = span * word / acc * 4, scene = el.closest(".scene"), way = el.closest("[data-way]");
    var marks = [];  // { el, at, on, lit }
    pieces.forEach(function (p, i) {
      var a = from + span * at[i] / acc;
      marks.push({ el: p.w, at: a, on: false, lit: false, word: true });
      if (p.pu) marks.push({ el: p.pu, at: a + span * beat / acc, on: false, lit: false });
    });
    var t = 1, playing = false;
    part(el, {
      read: function () {
        playing = false;
        if (!motion()) { t = 1; return; }
        if (looping(scene)) { t = scene.kitT; playing = true; return; }
        t = parseFloat(getComputedStyle(scene).getPropertyValue("--t"));
        if (!isFinite(t)) t = 1;
        playing = t < 1 && scene.classList.contains("played");
      },
      tick: function () {
        if (way && way.classList.contains("way-gone")) return false;
        for (var i = 0; i < marks.length; i++) {
          var m = marks[i], on = t >= m.at, l = m.word && on && t < m.at + lit && t < 0.999;
          if (on !== m.on) { m.on = on; m.el.classList.toggle("on", on); }
          if (l !== m.lit) { m.lit = l; m.el.classList.toggle("lit", l); }
        }
        return playing;
      }
    });
  }

  // ---- .build: SVG shapes draw their outline (pathLength 1); other .build elements assemble their children ----
  function build(el) {
    if (el instanceof SVGElement) {
      each(el.querySelectorAll("path, line, polyline, polygon, circle, ellipse, rect"), function (s) { s.setAttribute("pathLength", "1"); });
      return;
    }
    var kids = el.children, n = kids.length, from = attrNum(el, "data-from", 0), to = attrNum(el, "data-to", 1), ramp = 0.04;
    each(kids, function (k, i) {
      if (k.hasAttribute("data-at")) return;
      k.style.setProperty("--k-at", Math.min(from + (to - from - ramp) * (n > 1 ? i / (n - 1) : 0), 1 - ramp).toFixed(4));
    });
  }

  // ---- .pill: the app's listening pill on a canvas; it ripples with the scrolling (or a pretend voice) ----
  function pill(el) {
    var G = window.GhostPill;
    if (!G || !motion()) return;
    var canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
    canvas.setAttribute("aria-hidden", "true");
    el.appendChild(canvas);
    el.classList.add("live");
    var voice = el.getAttribute("data-voice") === "pretend" ? new G.PretendVoice(7) : null;
    var cssW = 0, dpr = 1, level = 0, history = [], carry = 0, clock = 0;
    function size() {
      cssW = canvas.clientWidth;
      dpr = Math.min(2, devicePixelRatio || 1);
      var w = Math.round(cssW * dpr), h = Math.round(cssW * G.SIZE[1] / G.SIZE[0] * dpr);
      if (w && (canvas.width !== w || canvas.height !== h)) { canvas.width = w; canvas.height = h; }
    }
    if (window.ResizeObserver) new ResizeObserver(size).observe(canvas);
    part(el, { tick: function (dt) {
      if (!motion()) { el.classList.remove("live"); canvas.remove(); this.on = false; return false; }
      carry += dt;
      clock += dt;
      while (carry >= 1 / 60) {  // the voice line moves on a 60-a-second clock, like the app
        carry -= 1 / 60;
        var peak = voice ? voice.peakAt(1 / 60) : 0.003 + speed * 0.22 * (0.75 + 0.25 * Math.sin(clock * 23));
        level = G.voiceAmount(peak, level, 1 / 60);
        history.push(level);
        if (history.length > G.HISTORY) history.shift();
      }
      if (!cssW) size();
      if (!cssW) return true;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      G.draw(ctx, { state: el.getAttribute("data-state") || "listening", t: clock, history: history, level: level,
                    theme: isLight() ? "light" : "dark", scale: cssW / G.SIZE[0], dpr: dpr, glow: 1, alpha: G.OPACITY });
      return true;
    } });
  }

  // ---- .meter: a line that stays flat on purpose, with a faint live noise floor ----
  function meter(el) {
    if (!motion()) return;
    var canvas = document.createElement("canvas"), ctx = canvas.getContext("2d"), w = 0, h = 0, dpr = 1, clock = 0, color = "", age = 1;
    canvas.setAttribute("aria-hidden", "true");
    el.insertBefore(canvas, el.firstChild);
    el.classList.add("live");
    function size() {
      w = canvas.clientWidth; h = canvas.clientHeight; dpr = Math.min(2, devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    if (window.ResizeObserver) new ResizeObserver(size).observe(canvas);
    part(el, { tick: function (dt) {
      if (!motion()) { el.classList.remove("live"); canvas.remove(); this.on = false; return false; }
      clock += dt;
      if (!w) size();
      if (!w) return true;
      age += dt;
      if (age > 0.5) { color = getComputedStyle(el).getPropertyValue("--accent").trim() || "#8f91ff"; age = 0; }
      var y = 44, x;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = color;
      ctx.globalAlpha = 1;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      ctx.globalAlpha = 0.3;  // a 2 px noise floor, so the meter is clearly live
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (x = 0; x <= w; x += 6) {
        var v = Math.sin(x * 0.09 + clock * 5.1) * Math.sin(x * 0.023 - clock * 2.3) + 0.5 * Math.sin(x * 0.31 + clock * 9.7);
        if (x === 0) ctx.moveTo(x, y - 1 + v * 1.3); else ctx.lineTo(x, y - 1 + v * 1.3);
      }
      ctx.stroke();
      return true;
    } });
  }

  // ---- .count: one number (with any words around it) counts up from data-count-from when it arrives ----
  function count(el) {
    var final = el.textContent, m = /^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/.exec(final);
    if (!m || !motion()) return;
    var target = parseFloat(m[2].replace(/,/g, "")), dec = (m[2].split(".")[1] || "").length, commas = m[2].indexOf(",") >= 0;
    var from = attrNum(el, "data-count-from", 0), dur = token("--assemble", 1200), start = 0;
    function show(v) {
      var s = commas ? v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }) : v.toFixed(dec);
      el.textContent = m[1] + s + m[3];
    }
    el.style.setProperty("--k-w", el.getBoundingClientRect().width + "px");  // the final width holds, so nothing shifts
    el.setAttribute("aria-label", final.trim());
    show(from);
    var p = part(el, { tick: function () {
      if (!start) return false;
      var k = clamp((performance.now() - start) / Math.max(1, dur), 0, 1);
      show(from + (target - from) * (1 - Math.pow(1 - k, 3)));
      if (k >= 1 || !motion()) { el.textContent = final; start = 0; return false; }
      return true;
    } });
    onArrive(el, function () { start = performance.now(); p.on = true; wake(); });
  }

  // ---- .calendar: its .on cells fill in order when it arrives ----
  function calendar(el) {
    var on = el.querySelectorAll(".on");
    each(on, function (c, i) { c.style.setProperty("--k-i", i); });
    el.style.setProperty("--k-stagger", Math.min(40, token("--assemble", 1200) / Math.max(1, on.length)).toFixed(1) + "ms");
    onArrive(el, function () { el.classList.add("filled"); });
  }

  // ---- .dial: five stops; click, arrow keys, or swipe along it ----
  function dial(el) {
    var btns = el.querySelectorAll("button"), n = btns.length, scene = el.closest(".scene"), current = -1;
    if (!n) return;
    el.setAttribute("role", "radiogroup");
    var checked = el.querySelector('[aria-checked="true"]');
    function set(i, user) {
      i = clamp(i, 0, n - 1);
      if (i === current) return;
      current = i;
      el.setAttribute("data-stop", i);
      each(btns, function (b, k) { b.setAttribute("aria-checked", k === i ? "true" : "false"); b.tabIndex = k === i ? 0 : -1; });
      var b = btns[i];
      if (scene) scene.setAttribute("data-stop", i);
      if (b.hasAttribute("data-wash")) wash(stageOf(el), b.getAttribute("data-wash"));
      if (b.hasAttribute("data-way")) setWay(scene, b.getAttribute("data-way"), user);
      tell(scene, { stop: i });
    }
    each(btns, function (b, k) {
      b.setAttribute("role", "radio");
      b.type = "button";
      b.addEventListener("click", function () { if (!dragged) set(k, true); });
    });
    set(attrNum(el, "data-stop", checked ? Array.prototype.indexOf.call(btns, checked) : 2), false);
    el.addEventListener("keydown", function (e) {
      var i = { ArrowRight: current + 1, ArrowDown: current + 1, ArrowLeft: current - 1, ArrowUp: current - 1, Home: 0, End: n - 1 }[e.key];
      if (i === undefined) return;
      e.preventDefault();
      set(i, true);
      btns[current].focus();
    });
    // Swipe: the stop under the finger follows it (vertical drags stay the page's: touch-action pan-y).
    var down = null, dragged = false;
    el.addEventListener("pointerdown", function (e) { down = { x: e.clientX, id: e.pointerId }; dragged = false; });
    el.addEventListener("pointermove", function (e) {
      if (!down || e.pointerId !== down.id) return;
      if (!dragged && Math.abs(e.clientX - down.x) < 8) return;
      if (!dragged) { dragged = true; try { el.setPointerCapture(e.pointerId); } catch (err) { /* the pointer already left */ } }
      var r = el.getBoundingClientRect();
      set(Math.floor(clamp((e.clientX - r.left) / r.width, 0, 0.999) * n), true);
    });
    function up() { down = null; setTimeout(function () { dragged = false; }, 0); }
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  }

  // ---- .switch: two states (Standard / Advanced, Wi-Fi on / off) ----
  function switcher(el) {
    var scene = el.closest(".scene");
    el.setAttribute("role", "switch");
    function apply(on, user) {
      el.setAttribute("aria-checked", on ? "true" : "false");
      el.setAttribute("data-on", on ? "true" : "false");
      if (scene) scene.setAttribute("data-on", on ? "true" : "false");
      var w = el.getAttribute(on ? "data-wash-on" : "data-wash-off"), way = el.getAttribute(on ? "data-way-on" : "data-way-off");
      if (w) wash(stageOf(el), w);
      if (way) setWay(scene, way, user);
      if (user) tell(scene, { on: on });
    }
    apply(el.getAttribute("aria-checked") === "true", false);
    el.addEventListener("click", function () { apply(el.getAttribute("aria-checked") !== "true", true); });
  }

  // ---- .curve: cards along an arc, the middle one largest; drag, wheel, keys; in a looping scene the playhead moves
  //      it and each card rests a moment (a drag, click or key jumps the playhead); under 721 px a swipe strip (CSS) ----
  function curve(el) {
    var cards = Array.prototype.slice.call(el.children), n = cards.length, scene = el.closest(".scene");
    if (!n) return;
    if (!el.hasAttribute("tabindex")) el.tabIndex = 0;
    var pos = clamp(attrNum(el, "data-index", 0), 0, n - 1), target = pos, placed = NaN, index = -1;
    var drag = null, wheelAcc = 0, wheelTimer = 0, lastDragged = 0;
    function driven() { return wide.matches && looping(scene); }
    function show(i) {
      if (i === index) return;
      index = i;
      el.setAttribute("data-index", i);
      if (scene) scene.setAttribute("data-index", i);
      cards.forEach(function (c, k) { c.classList.toggle("on", k === i); if (k === i) c.setAttribute("aria-current", "true"); else c.removeAttribute("aria-current"); });
      if (cards[i].hasAttribute("data-way")) setWay(scene, cards[i].getAttribute("data-way"), false);
      tell(scene, { index: i });
    }
    function place() {
      placed = pos;
      cards.forEach(function (c, k) {
        var d = k - pos, ad = Math.abs(d);
        c.style.setProperty("--k-d", d.toFixed(3));
        c.style.setProperty("--k-ad", ad.toFixed(3));
        c.classList.toggle("far", ad > 3.5);
      });
    }
    // The playhead where card i rests in a looping scene.
    function tFor(i) { return clamp(i, 0, n - 1) / Math.max(1, n - 1); }
    function go(i, smooth) {
      i = clamp(i, 0, n - 1);
      if (!wide.matches) {
        var c = cards[i];
        el.scrollTo({ left: c.offsetLeft - (el.clientWidth - c.offsetWidth) / 2, behavior: smooth && motion() ? "smooth" : "auto" });
      } else if (driven()) {
        scene.kitSeek(tFor(i));
      } else {
        target = i;
        if (!motion()) pos = i;
        wake();
      }
    }
    part(el, {
      tick: function (dt) {
        if (!wide.matches) return false;
        var onClock = driven();
        if (onClock) {
          var u = scene.kitT * (n - 1), i0 = Math.min(Math.floor(u), n - 1), f = u - i0, e = clamp((f - 0.2) / 0.6, 0, 1);
          pos = Math.min(i0 + e * e * (3 - 2 * e), n - 1);
        } else if (!drag && pos !== target) {
          pos += (target - pos) * (1 - Math.pow(0.0005, dt));
          if (Math.abs(target - pos) < 0.002) pos = target;
        }
        if (pos !== placed) place();
        show(Math.round(clamp(pos, 0, n - 1)));
        return onClock || (!drag && pos !== target);
      }
    });
    // Phones: the strip scrolls itself; the card nearest the middle is the current one.
    var stripRaf = 0;
    el.addEventListener("scroll", function () {
      if (wide.matches || stripRaf) return;
      stripRaf = requestAnimationFrame(function () {
        stripRaf = 0;
        var mid = el.scrollLeft + el.clientWidth / 2, best = 0, bestD = Infinity;
        cards.forEach(function (c, k) { var d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid); if (d < bestD) { bestD = d; best = k; } });
        show(best);
      });
    }, { passive: true });
    // Drag (mouse, pen or finger on wide screens).
    el.addEventListener("pointerdown", function (e) {
      if (!wide.matches || e.button !== 0) return;
      drag = { x: e.clientX, last: e.clientX, time: performance.now(), v: 0, moved: false, spacing: Math.max(1, cards[0].offsetWidth * 0.78), id: e.pointerId };
    });
    el.addEventListener("pointermove", function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.moved && Math.abs(e.clientX - drag.x) < 6) return;
      if (!drag.moved) { drag.moved = true; el.classList.add("dragging"); try { el.setPointerCapture(e.pointerId); } catch (err) { /* gone */ } }
      var dx = e.clientX - drag.last, now = performance.now();
      drag.v = -dx / drag.spacing / Math.max(0.001, (now - drag.time) / 1000);
      drag.last = e.clientX;
      drag.time = now;
      if (driven()) {
        scene.kitSeek(scene.kitT - dx / drag.spacing / Math.max(1, n - 1));
      } else {
        pos = clamp(pos - dx / drag.spacing, -0.4, n - 0.6);
        target = pos;
        wake();
      }
    });
    function release() {
      if (!drag) return;
      var d = drag;
      drag = null;
      el.classList.remove("dragging");
      if (!d.moved) return;
      lastDragged = performance.now();
      var i = Math.round(clamp(pos + clamp(d.v * 0.12, -1, 1), 0, n - 1));
      go(i, true);
    }
    el.addEventListener("pointerup", release);
    el.addEventListener("pointercancel", release);
    // A click on a side card brings it to the middle (not after a drag).
    el.addEventListener("click", function (e) {
      if (!wide.matches || performance.now() - lastDragged < 300) return;
      var card = e.target.closest ? e.target.closest(".curve > *") : null, k = cards.indexOf(card);
      if (k >= 0 && k !== index) { e.preventDefault(); go(k, true); }
    });
    // Sideways wheel or trackpad: one card per notch-worth (up and down stay the page's).
    el.addEventListener("wheel", function (e) {
      if (!wide.matches || driven() || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      wheelAcc += e.deltaX;
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(function () { wheelAcc = 0; }, 160);
      if (Math.abs(wheelAcc) >= 40) { go(Math.round(target) + (wheelAcc > 0 ? 1 : -1), true); wheelAcc = 0; }
    }, { passive: false });
    el.addEventListener("keydown", function (e) {
      var i = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: n - 1 }[e.key];
      if (i === undefined) return;
      e.preventDefault();
      go(i, true);
    });
    wide.addEventListener("change", function () { placed = NaN; wake(); });
    if (!wide.matches && pos) go(pos, false);
    show(Math.round(pos));
  }

  // ---- .tilt fallback (CSS scroll timelines do it where they exist): flat after 300 px of scrolling ----
  function tilt(el) {
    if (CSS_SCROLL) return;
    var shown = -1;
    part(el, { tick: function () {
      if (!motion() || !wide.matches) { if (shown !== -1) { el.style.removeProperty("--kit-tilt"); shown = -1; } return false; }
      var e = Math.round((1 - Math.pow(1 - clamp(scrollY / 300, 0, 1), 3)) * 1000) / 1000;
      if (e !== shown) { el.style.setProperty("--kit-tilt", e); shown = e; }
      return false;
    } });
  }

  // ---- looping scenes (data-loop="ms"; owner, 2026-11-03: the scenes play by themselves, never held by the scroll,
  //      and loop). Once the scene has arrived, --t runs 0 -> 1 over data-loop ms, the last frame holds for data-hold
  //      ms (default LOOP_HOLD), the stage fades out over the hold's last LOOP_FADE ms (html .k-rewind), and it plays
  //      again. Off screen the clock stops (the part is off); back on screen, or after the tab was hidden, it starts
  //      from 0. Reduced motion: --t is 1 (scenes.css) and the clock sleeps. ----
  var LOOP_HOLD = 2600, LOOP_FADE = 450, loops = [];
  // "Away" is told, never guessed from a gap between frames: a slow PC can go 500 ms between frames and must still play.
  var leave = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (!e.isIntersecting) e.target.kitAway = true; });
  });
  document.addEventListener("visibilitychange", function () { if (document.hidden) loops.forEach(function (sc) { sc.kitAway = true; }); });
  function clock(scene) {
    var run = Math.max(500, attrNum(scene, "data-loop", 7000)), hold = attrNum(scene, "data-hold", LOOP_HOLD);
    var at = 0, shown = -1, fading = false;
    scene.kitT = 0;
    scene.kitSeek = function (t) { at = clamp(t, 0, 1) * run; scene.kitAway = false; wake(); };
    loops.push(scene);
    leave.observe(scene);
    function fade(on) { if (on !== fading) { fading = on; scene.classList.toggle("k-rewind", on); } }
    part(scene, { tick: function (dt) {
      if (!motion()) { scene.kitT = 1; fade(false); if (shown !== -1) { scene.style.removeProperty("--t"); shown = -1; } return false; }
      if (!scene.classList.contains("seen")) return false;  // waits at 0 until it comes up the screen
      if (scene.kitAway) { scene.kitAway = false; at = 0; } else at += dt * 1000;  // back from off screen or a hidden tab
      if (at >= run + hold) at = 0;
      fade(at > run + hold - LOOP_FADE);
      var t = Math.round(Math.min(1, at / run) * 10000) / 10000;
      scene.kitT = t;
      if (t !== shown) { scene.style.setProperty("--t", t); shown = t; }
      return true;
    } });
  }

  // ---- set up every scene ----
  each(document.querySelectorAll(".scene"), function (scene) {
    var play = parseFloat(scene.getAttribute("data-play"));
    if (isFinite(play)) scene.style.setProperty("--k-play", play + "ms");
    cueVars(scene);
    each(scene.querySelectorAll(".type"), type);
    each(scene.querySelectorAll(".build"), build);
    each(scene.querySelectorAll(".pill"), pill);
    each(scene.querySelectorAll(".meter"), meter);
    each(scene.querySelectorAll(".count"), count);
    each(scene.querySelectorAll(".calendar"), calendar);
    each(scene.querySelectorAll(".dial"), dial);
    each(scene.querySelectorAll(".switch"), switcher);
    each(scene.querySelectorAll(".curve"), curve);
    each(scene.querySelectorAll(".stage.tilt"), tilt);
    chooser(scene);
    if (scene.hasAttribute("data-loop")) clock(scene);
    onArrive(scene, function () {
      scene.classList.add("seen");
      wake();
      if (scene.hasAttribute("data-play") && motion()) { scene.classList.add("played"); wake(); }
    });
  });
  each(document.querySelectorAll(".light-pass"), function (el) {
    onArrive(el, function () { if (motion()) el.classList.add("passed"); });
  });
  root.classList.add("kit");
  wake();

  // Reduced motion switched on while the page is open: every scene goes to its last frame and stays there.
  reduce.addEventListener("change", function (m) {
    if (!m.matches) return;
    root.classList.remove("motion");
    wake();
  });

  // The start-up logo covers the first screen (html.intro, head.js); the hero plays under it, so it is played again
  // once the logo has handed over (site.js drops the class). Page-only extras (Ghost Writer's typing) stay in gw.js.
  var introHero = document.querySelector('.hero-film[data-play]');  // Home's hero is the "umbrella" scene
  if (introHero && root.classList.contains("intro") && window.MutationObserver) {
    var handOver = new MutationObserver(function () {
      if (root.classList.contains("intro")) return;
      handOver.disconnect();
      replay(introHero);
    });
    handOver.observe(root, { attributes: true, attributeFilter: ["class"] });
  }

  // Page scripts read a looping scene's playhead (t) and jump it (seek), e.g. Home's chips.
  window.Scenes = { wash: wash, way: setWay, replay: replay,
    t: function (scene) { return scene && scene.kitSeek ? scene.kitT : 1; },
    seek: function (scene, t) { if (looping(scene)) scene.kitSeek(t); } };
})();
