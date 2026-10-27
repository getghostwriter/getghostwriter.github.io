// Ghost Media Works website: the few things that need a script. Every page works without it.
(function () {
  "use strict";

  // Theme: follows the device (auto), or a choice remembered in this browser only (never sent anywhere).
  var root = document.documentElement, button = document.getElementById("theme");
  var order = ["auto", "dark", "light"], choice = "auto";
  try { choice = localStorage.getItem("gw-theme") || "auto"; } catch (e) {}
  var asked = (location.search.match(/theme=(auto|dark|light)/) || [])[1];
  if (asked) choice = asked;  // a link can ask for a theme (?theme=light)
  function applyTheme() {
    if (choice === "auto") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", choice);
    if (button) {
      var label = { auto: "Theme: follows your device", dark: "Theme: dark", light: "Theme: light" }[choice];
      button.setAttribute("aria-label", label + ". Click to change.");
      button.title = label;
      button.dataset.choice = choice;
    }
  }
  if (button) button.addEventListener("click", function () {
    choice = order[(order.indexOf(choice) + 1) % order.length];
    try { localStorage.setItem("gw-theme", choice); } catch (e) {}
    applyTheme();
  });
  applyTheme();

  // Download links ask first: Ghost Writer needs an access key. Without scripts the links just work.
  var ask = document.getElementById("ask");
  if (ask && typeof ask.showModal === "function") {
    var go = document.getElementById("ask-go");
    document.querySelectorAll("a[data-download]").forEach(function (link) {
      if (link === go) return;
      link.addEventListener("click", function (event) {
        event.preventDefault();
        ask.showModal();
        go.focus();
      });
    });
    document.getElementById("ask-later").addEventListener("click", function () { ask.close(); });
    document.getElementById("ask-request").addEventListener("click", function () { ask.close(); });
    go.addEventListener("click", function () { setTimeout(function () { ask.close(); }, 300); });
    ask.addEventListener("click", function (event) { if (event.target === ask) ask.close(); });  // a click outside
  }

  // The Request access form posts to the key server (dev/access-server), which only the owner can read.
  // Same fields as always: name, contact, reason, and the empty "website" trap for spam robots.
  var form = document.getElementById("request-form"), result = document.getElementById("request-result");
  if (form) {
    var server = form.getAttribute("data-server");
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var data = { name: form.name.value.trim(), contact: form.contact.value.trim(), reason: form.reason.value.trim(), website: form.website.value };
      var nameOk = !!data.name, mailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.contact);
      form.name.setAttribute("aria-invalid", String(!nameOk));
      form.contact.setAttribute("aria-invalid", String(!mailOk));
      if (!nameOk || !mailOk) {
        result.className = "result bad";
        result.textContent = !nameOk ? "Please give your name." : "Please give a working email address: your key is sent there.";
        (nameOk ? form.contact : form.name).focus();
        return;
      }
      var submit = form.querySelector("button[type=submit]"), label = submit.textContent;
      submit.disabled = true; submit.textContent = "Sending...";
      fetch(server + "/v1/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
        .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); })
        .then(function (r) {
          if (r.body && r.body.ok) {
            form.reset();
            result.className = "result good";
            result.textContent = "Thanks! Your request is in. Your key will arrive by email once it's approved.";
          } else if (r.status === 429) {
            result.className = "result bad"; result.textContent = "Too many requests from here today. Please try again tomorrow.";
          } else {
            result.className = "result bad"; result.textContent = "That didn't go through. Please check your details and try again.";
          }
        })
        .catch(function () { result.className = "result bad"; result.textContent = "That didn't go through. Check your internet connection and try again."; })
        .then(function () { submit.disabled = false; submit.textContent = label; });
    });
  }

  // The opening intro: the app's start-up logo, once per visit (the page head set html.intro), on an
  // all-dark screen whatever the theme. Its frames are separate see-through pictures (assets/intro/,
  // timing in frames.json) drawn here on a canvas, so no background square shows and phones that don't
  // auto-play animated images still play it. It plays the 3 s reveal, holds a moment and fades into the
  // page; a click or any key skips it. If the frames can't load quickly, the page simply shows.
  if (root.classList.contains("intro")) {
    try { sessionStorage.setItem("gw-intro", "1"); } catch (e) {}
    var cover = document.createElement("div");
    cover.className = "intro-cover";
    cover.setAttribute("aria-hidden", "true");
    var canvas = document.createElement("canvas");
    cover.appendChild(canvas);
    document.body.appendChild(cover);
    var done = false, slow = setTimeout(finish, 2500);  // still loading after 2.5 s: don't keep the visitor waiting
    function finish() {
      if (done) return;
      done = true;
      clearTimeout(slow);
      cover.classList.add("out");
      root.classList.remove("intro");
      setTimeout(function () { cover.remove(); }, 650);
    }
    function play(frames, ms, size) {
      clearTimeout(slow);
      var scale = window.devicePixelRatio || 1, pen = canvas.getContext("2d");
      canvas.width = canvas.height = Math.round(size * scale);
      var ends = [], total = 0;
      ms.forEach(function (d) { total += d || 33; ends.push(total); });
      // A timer, not requestAnimationFrame: that one pauses in a background tab and would leave the dark
      // screen up; a timer still runs there (slowly), so the intro always ends.
      var start = performance.now(), shown = -1;
      function tick() {
        if (done) return;
        var t = performance.now() - start, i = 0;
        while (i < ends.length - 1 && t >= ends[i]) i++;
        if (i !== shown) {
          pen.clearRect(0, 0, canvas.width, canvas.height);
          pen.drawImage(frames[i], 0, 0, canvas.width, canvas.height);
          shown = i;
        }
        if (t < total + 300) setTimeout(tick, 15); else finish();
      }
      tick();
    }
    fetch("/assets/intro/frames.json").then(function (r) { return r.json(); }).then(function (info) {
      var left = info.ms.length, frames = [];
      info.ms.forEach(function (_, i) {
        var frame = new Image();
        frame.onload = function () { if (--left === 0 && !done) play(frames, info.ms, info.size); };
        frame.onerror = finish;
        frame.src = "/assets/intro/" + (i < 10 ? "0" : "") + i + ".webp";
        frames.push(frame);
      });
    }).catch(finish);
    cover.addEventListener("click", finish);
    document.addEventListener("keydown", finish, { once: true });
  }
})();
