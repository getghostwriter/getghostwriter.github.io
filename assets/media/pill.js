/* Ghost Writer's speech pill, for the web (Ghost Media Works site v2).
 *
 * A canvas copy of the app's floating pill: the waveform ribbon with its indigo aura
 * (src/ghostwriter/ui_art.py bubble_image / _bubble_base / _bubble_aura, win_tray.py _voice_amount,
 * PILL_* constants). Same geometry (a 210 x 40 capsule in an 18 px shadow margin), colours, three-line
 * ribbon, taper, history (the middle is now, the ends ~0.8 s ago), decibel mapping and attack/release.
 *
 * Markup:  <div class="gw-pill" data-gw-pill></div>  (+ <script src=".../pill.js" defer></script>)
 * Options (data- attributes on that element):
 *   data-state="listening|hands_free|transcribing|warming"   (default listening)
 *   data-theme="auto|dark|light"   auto follows the site (html[data-theme], else the system setting)
 *   data-mic="off"                 no "Try it with your voice" button
 *   data-glow="0|1|2"              Off / Soft (default, like the app) / Strong
 * The microphone is used only for its loudness, inside the browser: nothing is recorded, kept or sent.
 * No libraries, no outside requests.
 */
(function () {
  "use strict";

  // ---- The app's numbers -------------------------------------------------------------------------
  var CAP_W = 210, CAP_H = 40, MARGIN = 18;                  // ui_art BUBBLE_W/H, BUBBLE_MARGIN
  var FULL_W = CAP_W + 2 * MARGIN, FULL_H = CAP_H + 2 * MARGIN; // 246 x 76
  var GLOW_PEAK = [0, 0.6, 0.95];                             // PILL_GLOW_PEAK
  var OPACITY = 0.82;                                         // PILL_OPACITY (the window's see-through)
  var FADE_SECONDS = 0.25, RISE = 14;                         // PILL_FADE_SECONDS, PILL_RISE
  var HISTORY = 48;                                           // PILL_HISTORY (frames at 60 a second)
  var DB_FLOOR = -50, DB_TOP = -12, GATE = 0.06;              // PILL_DB_FLOOR/TOP, PILL_GATE
  var ATTACK = 0.55, RELEASE = 0.14;                          // per 60th of a second
  var LAYERS = [[1.0, 6.0, 2.2, 1.0], [115 / 255, 4.3, 3.1, 0.68], [60 / 255, 8.2, 1.6, 0.5]]; // alpha, speed, freq, part
  var SEGMENTS = 72;

  // ui_art._bubble_colors() for each theme (from the app, colors-*.json).
  var THEMES = {
    dark: { surface: [23, 26, 33], accent: [143, 145, 255], accent2: [180, 182, 255], quiet: [99, 106, 118],
            track: [53, 58, 67], shadow: [0, 0, 0], shadowAlpha: 150 / 255, sheen: true },
    light: { surface: [255, 255, 255], accent: [79, 82, 224], accent2: [132, 135, 238], quiet: [158, 165, 174],
             track: [216, 219, 222], shadow: [16, 24, 40], shadowAlpha: 70 / 255, sheen: false }
  };

  function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + (a === undefined ? 1 : a) + ")"; }
  function mix(a, b, f) { return [0, 1, 2].map(function (i) { return Math.round(a[i] + (b[i] - a[i]) * f); }); }

  function capsule(ctx, x0, y0, x1, y1) {
    var r = (y1 - y0) / 2;
    ctx.beginPath();
    ctx.moveTo(x0 + r, y0);
    ctx.lineTo(x1 - r, y0);
    ctx.arc(x1 - r, y0 + r, r, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(x0 + r, y1);
    ctx.arc(x0 + r, y0 + r, r, Math.PI / 2, Math.PI * 1.5);
    ctx.closePath();
  }

  // ---- The icons (ui_icons.ICONS "mic" and "wave", 24-unit grid, stroke 1.75) -------------------
  function drawIcon(ctx, name, cx, cy, size, color) {
    var u = size / 24, w = 1.75 * u;
    ctx.save();
    ctx.translate(cx - size / 2, cy - size / 2);
    ctx.strokeStyle = rgba(color);
    ctx.lineWidth = w;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (name === "mic") {
      // rrect (9,3)-(15,14) r3, drawn inside its box like PIL
      var h = w / 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(9 * u + h, 3 * u + h, 6 * u - w, 11 * u - w, 3 * u - h);
      else ctx.rect(9 * u + h, 3 * u + h, 6 * u - w, 11 * u - w);
      ctx.stroke();
      // arc (5,4)-(19,18) 0..180 (the bottom half)
      ctx.beginPath();
      ctx.ellipse(12 * u, 11 * u, 7 * u - h, 7 * u - h, 0, 0, Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(12 * u, 18 * u); ctx.lineTo(12 * u, 21 * u);
      ctx.moveTo(9 * u, 21 * u); ctx.lineTo(15 * u, 21 * u);
      ctx.stroke();
    } else if (name === "wave") {
      var bars = [[3, 11, 13], [7, 8, 16], [11, 5, 19], [15, 9, 15], [19, 7, 17], [23, 11, 13]];
      ctx.beginPath();
      bars.forEach(function (b) { ctx.moveTo(b[0] * u, b[1] * u); ctx.lineTo(b[0] * u, b[2] * u); });
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---- One frame (pure: the same inputs always draw the same picture) ---------------------------
  // opts: { state, t (seconds), history (0..1, oldest first), level, theme ("dark"/"light"),
  //         scale (CSS px per app px), dpr, glow (0..2), alpha (0..1, default 1) }
  // Draws the whole 246 x 76 image (capsule + shadow margin) at (0,0) in CSS px * scale.
  function draw(ctx, o) {
    var s = o.scale || 1, dpr = o.dpr || 1, c = THEMES[o.theme] || THEMES.dark;
    var state = o.state || "listening", t = o.t || 0;
    var glow = o.glow === undefined ? 1 : o.glow;
    var W = FULL_W * s, H = FULL_H * s, m = MARGIN * s;
    var x0 = m, y0 = m, x1 = W - m, y1 = H - m, ch = y1 - y0, cy = H / 2;
    var far = 10000; // shapes are drawn far off and only their shadow is moved back in

    ctx.save();
    ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;

    // The soft shadow (a capsule 4 px lower, blurred 7 px; PIL radius = sigma, canvas blur = 2 sigma).
    ctx.save();
    ctx.shadowColor = rgba(c.shadow, c.shadowAlpha);
    ctx.shadowBlur = 14 * s * dpr;
    ctx.shadowOffsetX = far * dpr;
    ctx.shadowOffsetY = 4 * s * dpr;
    capsule(ctx, x0 - far, y0, x1 - far, y1);
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.restore();

    // The aura: the capsule grown by int(2*scale) px, blurred 6 px, indigo at the glow's peak.
    var peak = GLOW_PEAK[Math.max(0, Math.min(2, glow | 0))];
    if (peak > 0) {
      var g = Math.max(1, Math.floor(2 * s));
      ctx.save();
      ctx.shadowColor = rgba(c.accent, peak);
      ctx.shadowBlur = 12 * s * dpr;
      ctx.shadowOffsetX = far * dpr;
      capsule(ctx, x0 - g - far, y0 - g, x1 + g - far, y1 + g);
      ctx.fillStyle = "#000";
      ctx.fill();
      ctx.restore();
    }

    // The capsule, no outline; a faint light along the top in the dark look (glass, not a sticker).
    capsule(ctx, x0, y0, x1, y1);
    ctx.fillStyle = rgba(c.surface);
    ctx.fill();
    if (c.sheen) {
      ctx.save();
      capsule(ctx, x0, y0, x1, y1);
      ctx.clip();
      var grad = ctx.createLinearGradient(0, y0, 0, y0 + ch / 2);
      for (var k = 0; k <= 8; k++) {
        var f = k / 8;
        grad.addColorStop(f, "rgba(255,255,255," + (0.06 * Math.pow(1 - f, 2)).toFixed(4) + ")");
      }
      ctx.fillStyle = grad;
      ctx.fillRect(x0, y0, x1 - x0, ch / 2);
      ctx.restore();
    }

    // The mode's mark where the icon sits.
    var iconCx = x0 + 22 * s;
    if (state === "listening" || state === "hands_free" || state === "command") {
      var size = Math.max(8, Math.round(16 * s));
      drawIcon(ctx, state === "hands_free" ? "wave" : "mic", iconCx, cy, size,
               state === "hands_free" ? c.accent2 : c.accent);
    } else if (state === "transcribing") {
      var r = 6.5 * s, lw = Math.max(1, 1.8 * s);
      ctx.save();
      ctx.lineWidth = lw;
      ctx.strokeStyle = rgba(c.track);
      ctx.beginPath(); ctx.arc(iconCx, cy, r - lw / 2, 0, Math.PI * 2); ctx.stroke();
      var start = ((t * 320) % 360) * Math.PI / 180;
      ctx.strokeStyle = rgba(c.accent);
      ctx.beginPath(); ctx.arc(iconCx, cy, r - lw / 2, start, start + 100 * Math.PI / 180); ctx.stroke();
      ctx.restore();
    } else if (state === "warming") {
      ctx.fillStyle = rgba(c.quiet);
      ctx.beginPath(); ctx.arc(iconCx, cy, 4 * s, 0, Math.PI * 2); ctx.fill();
    }

    // The ribbon.
    var wx0 = x0 + 40 * s, wx1 = x1 - 16 * s, width = wx1 - wx0;
    var levels, color;
    if (state === "listening" || state === "hands_free" || state === "command") {
      levels = o.history && o.history.length ? o.history : [o.level || 0];
      color = state === "hands_free" ? c.accent2 : c.accent;
    } else if (state === "transcribing") {
      levels = [0.30]; color = c.accent;
    } else {
      levels = [0.03]; color = c.quiet;
    }
    var count = levels.length;
    function amount(x) {
      if (count === 1) return levels[0];
      var back = Math.abs(x - 0.5) * 2 * (count - 1), i = Math.floor(back), frac = back - i;
      var a = levels[count - 1 - Math.min(i, count - 1)], b = levels[count - 1 - Math.min(i + 1, count - 1)];
      return a + (b - a) * frac;
    }
    var ampMax = ch * 0.36;
    var sweep = (t * 0.9) % 1.4 - 0.2;
    // The lines go on their own layer first: in the app each fainter line REPLACES what is under it
    // (Pillow draws without blending on a transparent layer), which is what gives the ribbon its
    // light, braided look where the lines cross. Then that layer goes onto the pill.
    var rc = ribbonLayer(ctx.canvas.width, ctx.canvas.height), r2 = rc.getContext("2d");
    r2.setTransform(1, 0, 0, 1, 0, 0);
    r2.clearRect(0, 0, rc.width, rc.height);
    r2.setTransform(ctx.getTransform());
    r2.lineJoin = "round";
    r2.lineCap = "round";
    for (var L = 0; L < LAYERS.length; L++) {
      var lay = LAYERS[L];
      r2.beginPath();
      for (var p = 0; p <= SEGMENTS; p++) {
        var x = p / SEGMENTS;
        var taper = Math.pow(Math.sin(Math.PI * x), 1.3);
        var y = Math.sin(x * Math.PI * 2 * lay[2] + t * lay[1] + L * 1.9) * taper * amount(x) * lay[3] * ampMax;
        if (p === 0) r2.moveTo(wx0 + x * width, cy + y); else r2.lineTo(wx0 + x * width, cy + y);
      }
      var lc = color;
      if (state === "transcribing") lc = mix(color, [255, 255, 255], 0.35 * Math.max(0, 1 - Math.abs(0.5 - sweep) * 2.5));
      // The app draws at 3x and rounds the width down there: int(1.8 * scale * 3 * k) / 3.
      r2.lineWidth = Math.max(1 / dpr, Math.max(1, Math.floor(1.8 * s * 3 * (L === 0 ? 1 : 0.7))) / 3);
      if (L > 0) { r2.globalCompositeOperation = "destination-out"; r2.strokeStyle = "#000"; r2.stroke(); }
      r2.globalCompositeOperation = "source-over";
      r2.strokeStyle = rgba(lc, lay[0]);
      r2.stroke();
    }
    if (state === "transcribing") { // a light sweeping along the line (only where the line is)
      var gx = wx0 + sweep * width;
      var shine = r2.createRadialGradient(gx, cy, 0, gx, cy, ch * 0.6);
      shine.addColorStop(0, "rgba(255,255,255,0.22)");
      shine.addColorStop(1, "rgba(255,255,255,0)");
      r2.globalCompositeOperation = "source-atop";
      r2.fillStyle = shine;
      r2.fillRect(wx0, y0, width, ch);
      r2.globalCompositeOperation = "source-over";
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(rc, 0, 0);
    ctx.restore();
    ctx.restore();
  }

  var ribbonCanvas = null;
  function ribbonLayer(w, h) {
    if (!ribbonCanvas) ribbonCanvas = document.createElement("canvas");
    if (ribbonCanvas.width !== w || ribbonCanvas.height !== h) { ribbonCanvas.width = w; ribbonCanvas.height = h; }
    return ribbonCanvas;
  }

  // ---- The voice: loudness in, ribbon height out (win_tray._voice_amount) -----------------------
  function voiceAmount(peak, previous, dt) {
    var db = 20 * Math.log10(Math.max(1e-5, peak));
    var target = Math.max(0, Math.min(1, (db - DB_FLOOR) / (DB_TOP - DB_FLOOR)));
    if (target < GATE) target = 0;
    var frames = Math.max(0, Math.min(6, dt * 60));
    var rate = target > previous ? ATTACK : RELEASE;
    return previous + (target - previous) * (1 - Math.pow(1 - rate, frames));
  }

  // A believable pretend voice: syllables at ~4-6 a second grouped in words and phrases, short
  // breaths between words, longer pauses between phrases, quiet room noise under it all.
  // Seeded, so the same seed always "says" the same thing (the demo video uses this too).
  function PretendVoice(seed) {
    var state = (seed >>> 0) || 1;
    function rand() { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; }
    var seg = null, clock = 0, wordsLeft = 0, sylsLeft = 0;
    function next() {
      if (sylsLeft > 0) {
        sylsLeft--;
        return { kind: "syl", dur: 0.11 + rand() * 0.15, peak: -30 + rand() * 13 };
      }
      if (wordsLeft > 0) {
        wordsLeft--;
        sylsLeft = 1 + Math.floor(rand() * 3);
        return { kind: "gap", dur: 0.03 + rand() * 0.09 };
      }
      wordsLeft = 3 + Math.floor(rand() * 8);
      return { kind: "pause", dur: 0.35 + rand() * 0.75 };
    }
    this.peakAt = function (dt) { // advance dt seconds, return a microphone peak (0..1)
      clock += dt;
      while (!seg || clock >= seg.start + seg.dur) {
        var start = seg ? seg.start + seg.dur : 0;
        seg = next();
        seg.start = start;
      }
      var p = (clock - seg.start) / seg.dur, db;
      if (seg.kind === "syl") db = -44 + (seg.peak + 44) * Math.pow(Math.sin(Math.PI * p), 0.7) + (rand() - 0.5) * 3;
      else if (seg.kind === "gap") db = -42 + (rand() - 0.5) * 4;
      else db = -60 + rand() * 4;
      return Math.pow(10, db / 20);
    };
  }

  // A whole run of levels at 60 a second (for a video: frame-exact and repeatable).
  function pretendLevels(seed, seconds) {
    var v = new PretendVoice(seed), out = [], level = 0, n = Math.ceil(seconds * 60);
    for (var i = 0; i < n; i++) { level = voiceAmount(v.peakAt(1 / 60), level, 1 / 60); out.push(level); }
    return out;
  }

  // ---- The live component ------------------------------------------------------------------------
  var reduceQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  var lightQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;

  function siteTheme() {
    var forced = document.documentElement.getAttribute("data-theme");
    if (forced === "dark" || forced === "light") return forced;
    return lightQuery && lightQuery.matches ? "light" : "dark";
  }

  // A pleasant still moment for reduced motion (mid-sentence).
  var STILL = (function () {
    var h = [];
    for (var i = 0; i < HISTORY; i++) h.push(Math.max(0, Math.min(1, 0.55 + 0.35 * Math.sin(i * 0.45) * Math.sin(i * 0.13 + 1))));
    return h;
  })();

  function Pill(root) {
    var self = this;
    root.classList.add("gw-pill");
    var stage = document.createElement("div");
    stage.className = "gw-pill-stage";
    var canvas = document.createElement("canvas");
    canvas.className = "gw-pill-canvas";
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "Ghost Writer's listening pill: a wavy line that moves with your voice");
    stage.appendChild(canvas);
    // Replace any no-script picture inside, keep nothing else.
    while (root.firstChild) root.removeChild(root.firstChild);
    root.appendChild(stage);
    var ctx = canvas.getContext("2d");

    var micButton = null, note = null;
    if (root.getAttribute("data-mic") !== "off" && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      var controls = document.createElement("div");
      controls.className = "gw-pill-controls";
      micButton = document.createElement("button");
      micButton.type = "button";
      micButton.className = "gw-pill-mic";
      micButton.setAttribute("aria-pressed", "false");
      setMicLabel("Try it with your voice");
      note = document.createElement("p");
      note.className = "gw-pill-note";
      note.textContent = "Uses only how loud your microphone is, here in your browser. Nothing is recorded, stored or sent.";
      controls.appendChild(micButton);
      controls.appendChild(note);
      root.appendChild(controls);
      micButton.addEventListener("click", function () { if (mic) stopMic(); else startMic(); });
    }

    function setMicLabel(text) { // the app's mic icon (ui_icons "mic") + the words
      while (micButton.firstChild) micButton.removeChild(micButton.firstChild);
      var ns = "http://www.w3.org/2000/svg", svg = document.createElementNS(ns, "svg");
      svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true"); svg.setAttribute("width", "18"); svg.setAttribute("height", "18");
      svg.setAttribute("fill", "none"); svg.setAttribute("stroke", "currentColor"); svg.setAttribute("stroke-width", "1.9");
      svg.setAttribute("stroke-linecap", "round"); svg.setAttribute("stroke-linejoin", "round");
      ["M9 6a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0z", "M5.5 11a6.5 6.5 0 0 0 13 0", "M12 18v3", "M9 21h6"].forEach(function (d) {
        var path = document.createElementNS(ns, "path"); path.setAttribute("d", d); svg.appendChild(path);
      });
      micButton.appendChild(svg);
      micButton.appendChild(document.createTextNode(text));
    }

    var state = root.getAttribute("data-state") || "listening";
    var glow = root.hasAttribute("data-glow") ? parseInt(root.getAttribute("data-glow"), 10) : 1;
    var themeWanted = root.getAttribute("data-theme") || "auto";
    var voice = new PretendVoice(7);
    var level = 0, history = [], clock = 0, last = null, carry = 0, shownFor = 0;
    var visible = false, running = false, raf = 0, cssW = 0, dpr = 1;
    var mic = null; // { stream, ctx, analyser, buf }

    function theme() { return themeWanted === "dark" || themeWanted === "light" ? themeWanted : siteTheme(); }
    function reduced() { return !!(reduceQuery && reduceQuery.matches) && !mic; }

    function size() {
      var w = stage.clientWidth || FULL_W;
      dpr = Math.min(3, window.devicePixelRatio || 1);
      cssW = w;
      var h = w * FULL_H / FULL_W;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      var pw = Math.round(w * dpr), ph = Math.round(h * dpr);
      if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
    }

    function paint(alpha, rise) {
      var s = cssW / FULL_W;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, rise * s * dpr);
      if (reduced()) {
        draw(ctx, { state: state, t: 1.3, history: STILL, theme: theme(), scale: s, dpr: dpr, glow: glow, alpha: OPACITY });
      } else {
        draw(ctx, { state: state, t: clock, history: history, level: level, theme: theme(), scale: s, dpr: dpr,
                    glow: glow, alpha: OPACITY * alpha });
      }
    }

    function micPeak() {
      mic.analyser.getFloatTimeDomainData(mic.buf);
      var peak = 0;
      for (var i = 0; i < mic.buf.length; i++) { var v = Math.abs(mic.buf[i]); if (v > peak) peak = v; }
      return peak;
    }

    function frame(now) {
      raf = 0;
      if (!running) return;
      var dt = last === null ? 1 / 60 : Math.max(0, Math.min(0.25, (now - last) / 1000));
      last = now;
      clock += dt;
      shownFor += dt;
      // The voice line moves on a 60-a-second clock whatever the screen's refresh rate (like the app).
      carry += dt;
      var steps = 0;
      while (carry >= 1 / 60 && steps < 15) {
        carry -= 1 / 60; steps++;
        var peak = mic ? micPeak() : voice.peakAt(1 / 60);
        level = voiceAmount(peak, level, 1 / 60);
        history.push(level);
        if (history.length > HISTORY) history.shift();
      }
      if (steps === 15) carry = 0;
      // Rises in and fades in when it first comes into view (eased: quick at first, gentle at the end).
      var shown = Math.min(1, shownFor / FADE_SECONDS);
      paint(shown, RISE * Math.pow(1 - shown, 3));
      raf = requestAnimationFrame(frame);
    }

    function update() {
      var want = visible && !document.hidden && !reduced();
      if (want && !running) {
        running = true; last = null;
        raf = requestAnimationFrame(frame);
      } else if (!want && running) {
        running = false;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      }
      if (!running) { size(); paint(1, 0); }
    }

    function setNote(text) { if (note) note.textContent = text; }

    function startMic() {
      micButton.disabled = true;
      navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false } })
        .then(function (stream) {
          var AC = window.AudioContext || window.webkitAudioContext;
          var ac = new AC();
          var src = ac.createMediaStreamSource(stream);
          var analyser = ac.createAnalyser();
          analyser.fftSize = 1024;
          src.connect(analyser); // never to the speakers, never recorded
          mic = { stream: stream, ctx: ac, analyser: analyser, buf: new Float32Array(analyser.fftSize) };
          if (ac.state === "suspended" && ac.resume) ac.resume();
          micButton.disabled = false;
          setMicLabel("Stop using my microphone");
          micButton.setAttribute("aria-pressed", "true");
          root.classList.add("gw-pill-live");
          setNote("Listening to your loudness only, in this browser. Nothing is recorded, stored or sent.");
          state = "listening";
          update();
        })
        .catch(function () {
          micButton.disabled = false;
          setNote("The microphone isn't available or wasn't allowed, so the pill keeps its pretend voice.");
        });
    }

    function stopMic() {
      if (!mic) return;
      mic.stream.getTracks().forEach(function (tr) { tr.stop(); });
      try { mic.ctx.close(); } catch (e) { /* already closed */ }
      mic = null;
      level = 0;
      if (micButton) {
        setMicLabel("Try it with your voice");
        micButton.setAttribute("aria-pressed", "false");
      }
      root.classList.remove("gw-pill-live");
      setNote("Microphone off. Uses only how loud your microphone is, here in your browser. Nothing is recorded, stored or sent.");
      state = root.getAttribute("data-state") || "listening";
      update();
    }

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        var was = visible;
        visible = entries[entries.length - 1].isIntersecting;
        if (visible && !was) shownFor = 0; // rises in each time it comes into view
        update();
      }, { threshold: 0.05 }).observe(root);
    } else {
      visible = true;
    }
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stopMic(); // the microphone never stays on in a tab you can't see
      update();
    });
    window.addEventListener("pagehide", stopMic);
    if ("ResizeObserver" in window) new ResizeObserver(function () { size(); if (!running) paint(1, 0); }).observe(stage);
    else window.addEventListener("resize", function () { size(); if (!running) paint(1, 0); });
    if (reduceQuery && reduceQuery.addEventListener) reduceQuery.addEventListener("change", update);
    if (lightQuery && lightQuery.addEventListener) lightQuery.addEventListener("change", function () { if (!running) paint(1, 0); });
    new MutationObserver(function () { if (!running) paint(1, 0); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    size();
    update();

    self.setState = function (s) { state = s; if (!running) paint(1, 0); };
    self.stopMic = stopMic;
  }

  function mountAll() {
    var nodes = document.querySelectorAll("[data-gw-pill]");
    for (var i = 0; i < nodes.length; i++) if (!nodes[i].gwPill) nodes[i].gwPill = new Pill(nodes[i]);
  }

  window.GhostPill = { draw: draw, voiceAmount: voiceAmount, PretendVoice: PretendVoice, pretendLevels: pretendLevels,
                       mount: function (el) { return el.gwPill || (el.gwPill = new Pill(el)); },
                       mountAll: mountAll, SIZE: [FULL_W, FULL_H], HISTORY: HISTORY, OPACITY: OPACITY };
  if (!window.GHOST_PILL_MANUAL) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountAll);
    else mountAll();
  }
})();
