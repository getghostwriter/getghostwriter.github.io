// The header logo's click (owner's pick 2026-11-01, "Badge + shockwave"). The logo, its sway and the hub's
// quiet pulses are HTML and CSS (site.css, .lg); this only adds the reaction to a click or tap anywhere on
// the header bar: a ring spreads from the spot, the nodes catch it and pass pulses in to the ghost, letters
// glint as it reaches them, the badge presses in and rocks away, and a highlight sweeps across the metal.
// Nothing runs between clicks. Off with reduced motion (no html.motion), like motion.js.
(function () {
  "use strict";
  var root = document.documentElement, header = document.querySelector(".site-header");
  var logo = header && header.querySelector(".lg");
  if (!logo || !root.classList.contains("motion") || !logo.animate) return;

  // The idle sway and pulses stop while the tab is hidden or the header is off screen.
  var hidden = document.hidden, offscreen = false;
  function pause() { root.classList.toggle("lg-paused", hidden || offscreen); }
  document.addEventListener("visibilitychange", function () { hidden = document.hidden; pause(); });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (seen) { offscreen = !seen[seen.length - 1].isIntersecting; pause(); }).observe(header);
  }
  pause();

  var NODES = [[38, 7], [67.5, 28.4], [56.2, 63.1], [19.8, 63.1], [8.5, 28.4]];  // the hub's viewBox is 76 x 76
  var SPEED = .62, RADIUS = 300;  // the ring: px per ms, px
  function all(selector) { return Array.prototype.slice.call(logo.querySelectorAll(selector)); }
  function clamp(v) { return v < -1 ? -1 : v > 1 ? 1 : v; }
  var press = logo.querySelector(".lg-press"), hub = logo.querySelector(".lg-hub"), halo = logo.querySelector(".lg-halo"),
    spec = logo.querySelector(".lg-spec"), sheens = all(".lg-spec .lg-w, .lg-spec .lg-mw"),
    pulses = all(".lg-pis path"), nodes = all(".lg-nds circle"), rings = all(".lg-rgs circle"),
    letters = all(".lg-col > .lg-w .lg-l, .lg-col > .lg-mw > span:not(.lg-sp)");
  var waves = document.createElement("span");
  waves.className = "lg-waves";
  waves.setAttribute("aria-hidden", "true");
  header.insertBefore(waves, header.firstChild);

  function ring(x, y, bar, delay, size, strength) {
    var r = document.createElement("span");
    r.className = "lg-ring";
    r.style.left = (x - bar.left - RADIUS) + "px";
    r.style.top = (y - bar.top - RADIUS) + "px";
    r.style.width = r.style.height = 2 * RADIUS + "px";
    waves.appendChild(r);
    r.animate([{ transform: "scale(.02)", opacity: strength }, { transform: "scale(" + size + ")", opacity: 0 }],
      { duration: RADIUS / SPEED, delay: delay, easing: "cubic-bezier(.2,.6,.4,1)" }).onfinish = function () { r.remove(); };
  }

  // Press and rock: three springs (turn left/right, tilt, press), worked out once per click and played as
  // one animation. State: [turn, its speed, tilt, its speed, press, its speed].
  var STEP = 1 / 60, STEPS = 84, rock = null;
  function settle(s) {
    var out = [];
    for (var i = 0; i <= STEPS; i++) {
      out.push(s.slice());
      s[1] += (-70 * s[0] - 10 * s[1]) * STEP; s[0] += s[1] * STEP;
      s[3] += (-70 * s[2] - 10 * s[3]) * STEP; s[2] += s[3] * STEP;
      s[5] += (-150 * s[4] - 12 * s[5]) * STEP; s[4] += s[5] * STEP;
    }
    return out;
  }
  function pose(s) {
    return { transform: "perspective(560px) rotateY(" + (s[0] * 13).toFixed(2) + "deg) rotateX(" + (-s[2] * 10).toFixed(2) +
      "deg) scale(" + (1 - .045 * s[4]).toFixed(3) + ")" };
  }
  function kick(dx, dy) {
    var s = [0, 0, 0, 0, 0, 0];
    if (rock) {  // clicked again mid-rock: carry on from where it is
      var i = Math.round((performance.now() - rock.start) / 1000 / STEP);
      if (i < STEPS) s = rock.path[i].slice();
      rock.play.cancel();
    }
    s[1] -= dx * 4.2; s[3] += dy * 3.2; s[4] = 1;
    var path = settle(s);
    rock = { start: performance.now(), path: path,
      play: press.animate(path.filter(function (p, i) { return i % 2 === 0; }).map(pose), { duration: STEPS * STEP * 1000 }) };
  }

  function glow(px, color) { return "drop-shadow(0 0 " + px + "px " + color + ")"; }

  header.addEventListener("pointerdown", function (e) {
    if (!e.isPrimary || e.button > 0) return;
    var bar = header.getBoundingClientRect(), x = e.clientX, y = e.clientY;
    if (y > bar.bottom) return;  // the phone menu hangs below the bar
    var style = getComputedStyle(logo), ac = style.getPropertyValue("--accent").trim(), bg = style.getPropertyValue("--bg").trim();
    var k = (parseFloat(style.fontSize) || 10) / 10;  // the logo's size against its 10px design
    function reach(px, py) { return Math.min(Math.hypot(px - x, py - y), RADIUS) / SPEED * .72; }  // when the ring gets there

    ring(x, y, bar, 0, 1, .8);
    ring(x, y, bar, 140, .8, .35);
    var hb = hub.getBoundingClientRect(), u = hb.width / 76, first = 1e9;
    NODES.forEach(function (p, i) {
      var t = reach(hb.left + p[0] * u, hb.top + p[1] * u);
      nodes[i].animate([{ transform: "scale(1)", fill: bg }, { transform: "scale(1.5)", fill: ac, offset: .25 }, { transform: "scale(1)", fill: bg }],
        { duration: 800, delay: t, easing: "ease-out" });
      rings[i].animate([{ opacity: .75, transform: "scale(1)" }, { opacity: 0, transform: "scale(3.2)" }],
        { duration: 850, delay: t, easing: "cubic-bezier(.16,1,.3,1)" });
      pulses[i].animate([{ strokeDashoffset: 16 }, { strokeDashoffset: -84, offset: .86 }, { strokeDashoffset: -100 }],
        { duration: 440, delay: t + 60, easing: "cubic-bezier(.45,0,.75,.6)" });
      first = Math.min(first, t + 480);
    });
    halo.animate([{ opacity: .5, transform: "scale(1)" }, { opacity: 1, transform: "scale(1.2)", offset: .3 }, { opacity: .5, transform: "scale(1)" }],
      { duration: 900, delay: first, easing: "ease-out" });
    letters.forEach(function (l) {
      var b = l.getBoundingClientRect(), lift = (l.classList.contains("lg-l") ? 2.5 : 1.2) * k;
      l.animate([{ filter: glow(0, "transparent"), transform: "translateY(0)" },
        { filter: glow((9 * k).toFixed(1), ac), transform: "translateY(" + (-lift).toFixed(2) + "px)", offset: .28 },
        { filter: glow(0, "transparent"), transform: "translateY(0)" }],
        { duration: 900, delay: reach(b.left + b.width / 2, b.top + b.height / 2), easing: "ease-out" });
    });

    var lb = logo.getBoundingClientRect();
    var dx = clamp((x - (lb.left + lb.width / 2)) / (lb.width / 2)), dy = clamp((y - (lb.top + lb.height / 2)) / (lb.height / 2));
    kick(dx, dy);
    var from = dx < 0 ? "105% 0" : "-5% 0", to = dx < 0 ? "-5% 0" : "105% 0";  // the highlight runs away from the click
    sheens.forEach(function (el) { el.animate([{ backgroundPosition: from }, { backgroundPosition: to }], { duration: 800, easing: "ease-in-out" }); });
    if (spec) spec.animate([{ opacity: .38 }, { opacity: .95, offset: .43 }, { opacity: .38, offset: .87 }, { opacity: .38 }], { duration: 800 });
  }, { passive: true });
})();
