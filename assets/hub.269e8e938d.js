// Ghost Media Hub's page (/media-hub/): the few things the scene kit doesn't do. Loaded by "assets: hub" (defer, after
// scenes.js). Kit pieces it talks to: window.Scenes.wash (the glow), the kit:change event (a chip changed a scene's way).
// What is here: the title's letters (M4: each letter gets its moment of --t, like the kit's .type does for words),
// the look buttons (M3: pick Warm, Cool or Film; the glow takes that look, or mono while the colour controls play),
// and the sound toggles (M6: PC sound and Your mic, each on or off). No loop, no timers: everything that moves is CSS
// driven by the kit's --t. Without this script the page shows each scene's finished picture and the default look.
(function () {
  "use strict";
  function each(list, fn) { Array.prototype.forEach.call(list, fn); }
  function wash(scene, name) {
    var stage = scene.querySelector(".stage");
    if (stage && window.Scenes) window.Scenes.wash(stage, name);
  }

  // ---- M4: a title that drops in letter by letter over data-from..data-to of the scene's playhead ----
  each(document.querySelectorAll("[data-mh-letters]"), function (el) {
    var text = el.textContent.trim(), from = parseFloat(el.getAttribute("data-from")) || 0;
    var to = parseFloat(el.getAttribute("data-to")) || 1, letters = text.replace(/\s+/g, "").length, i = 0;
    el.textContent = "";
    text.split(/\s+/).forEach(function (word, k) {
      if (k) el.appendChild(document.createTextNode(" "));
      var w = document.createElement("span");
      w.className = "mh-word";
      Array.prototype.forEach.call(word, function (ch) {
        var l = document.createElement("span");
        l.className = "mh-l";
        l.textContent = ch;
        l.style.setProperty("--k-at", (from + (to - from - 0.05) * (letters > 1 ? i / (letters - 1) : 0)).toFixed(4));
        w.appendChild(l);
        i++;
      });
      el.appendChild(w);
    });
  });

  // ---- M3: the look buttons; the glow follows the chosen look, or goes mono with the colour controls ----
  each(document.querySelectorAll(".mh-m3"), function (scene) {
    var buttons = scene.querySelectorAll("button[data-mh-look]");
    function look() { return scene.getAttribute("data-mh-look") || "film"; }
    each(buttons, function (b) {
      b.addEventListener("click", function () {
        var name = b.getAttribute("data-mh-look");
        scene.setAttribute("data-mh-look", name);
        each(buttons, function (o) { o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
        wash(scene, "look-" + name);
      });
    });
    scene.addEventListener("kit:change", function (e) {
      if (e.detail && e.detail.way) wash(scene, e.detail.way === "controls" ? "look-mono" : "look-" + look());
    });
  });

  // ---- M6: PC sound and Your mic, each switched on or off (both can be on) ----
  each(document.querySelectorAll("[data-mh-toggle]"), function (b) {
    var scene = b.closest(".scene"), key = "data-mh-" + b.getAttribute("data-mh-toggle");
    b.addEventListener("click", function () {
      var on = b.getAttribute("aria-pressed") !== "true";
      b.setAttribute("aria-pressed", on ? "true" : "false");
      if (scene) scene.setAttribute(key, on ? "on" : "off");
    });
  });
})();
