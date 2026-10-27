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

  // The opening intro: the app's start-up logo, once per visit (the page head set html.intro). It plays
  // its 3 s reveal, holds a moment and fades into the page; a click or any key skips it. If the
  // animation can't load quickly, the page simply shows.
  if (root.classList.contains("intro")) {
    try { sessionStorage.setItem("gw-intro", "1"); } catch (e) {}
    var dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    var cover = document.createElement("div");
    cover.className = "intro-cover" + (dark ? " dark" : " light");
    cover.setAttribute("aria-hidden", "true");
    var logo = new Image();
    logo.alt = "";
    cover.appendChild(logo);
    document.body.appendChild(cover);
    var done = false, slow;
    var finish = function () {
      if (done) return;
      done = true;
      clearTimeout(slow);
      cover.classList.add("out");
      root.classList.remove("intro");
      setTimeout(function () { cover.remove(); }, 450);
    };
    logo.onload = function () { clearTimeout(slow); setTimeout(finish, 3000 + 300); };
    logo.onerror = finish;
    slow = setTimeout(finish, 2000);  // still loading after 2 s: don't keep the visitor waiting
    logo.src = "/assets/intro-" + (dark ? "dark" : "light") + ".webp";
    cover.addEventListener("click", finish);
    document.addEventListener("keydown", finish, { once: true });
  }
})();
