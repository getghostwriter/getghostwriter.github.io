// Ghost Media Works website: the few things that need a script. Every page works without it.
(function () {
  "use strict";

  // Theme: dark, or light if chosen; remembered in this browser only (never sent anywhere). No device-following
  // theme (owner, 2026-11-03).
  var root = document.documentElement, buttons = document.querySelectorAll("[data-theme-button]");
  var order = ["dark", "light"], choice = "dark";
  try { if (localStorage.getItem("gw-theme") === "light") choice = "light"; } catch (e) {}
  var asked = (location.search.match(/theme=(dark|light)/) || [])[1];
  if (asked) choice = asked;  // a link can ask for a theme (?theme=light)
  function applyTheme() {
    root.setAttribute("data-theme", choice);
    // Theme pictures (<picture> with a light source): follow the theme picked here.
    var media = { light: "all", dark: "not all" }[choice];
    document.querySelectorAll("source[data-theme-source]").forEach(function (source) { if (source.media !== media) source.media = media; });
    var label = { dark: "Theme: dark", light: "Theme: light" }[choice];
    buttons.forEach(function (button) {
      button.setAttribute("aria-label", label + ". Click to change.");
      button.title = label;
      button.dataset.choice = choice;
    });
    if (chapters) chapters.repaint();  // the pill's progress ring takes the theme's colours
  }
  var chapters = null;  // set below, once the chapter pill exists
  buttons.forEach(function (button) {
    button.addEventListener("click", function () {
      choice = order[(order.indexOf(choice) + 1) % order.length];
      try { localStorage.setItem("gw-theme", choice); } catch (e) {}
      applyTheme();
    });
  });
  applyTheme();

  // The site film's frame (PLAN.html chapter 06). The header slides away as the visitor scrolls down and
  // returns on the first scroll up (never within the first 80 px, never while it holds keyboard focus or the intro
  // plays; it stays as it was while the chapter list is open). The page's chapters (every main section[id] with
  // an h2, or data-chapter="Name") drive two remotes: on phones the chapter pill at the bottom (current chapter, a progress
  // ring, a list that fans upward with the chapters, "Top", then the site's links and Get access); on wider
  // screens the chapter rail on the right edge (3 or more chapters). One passive scroll listener, at most one
  // update per frame; only classes change, and the ring is a tiny canvas. Without this script the header's own
  // links show on phones too (site.css, html:not(.js)).
  // Its own scope: the rest of this file reuses short names (go, ask, stage), and one shared scope once broke the rail.
  (function () {
    var header = document.querySelector(".site-header"), main = document.getElementById("main");
    var reduce = matchMedia("(prefers-reduced-motion: reduce)"), phone = matchMedia("(max-width: 720px)");
    var lastY = scrollY, away = false, fanOpen = false;
    function setAway(on) {
      if (on === away || !header) return;
      away = on;
      header.classList.toggle("bar-away", on);
    }
    function headerTick(y) {
      if (fanOpen) return;  // the list is open over a scrim: the bar stays as it was
      if (y < 80 || root.classList.contains("intro") || (header && header.querySelector(":focus-visible"))) {
        setAway(false); lastY = y; return;
      }
      if (Math.abs(y - lastY) < 6) return;  // ignore jitter; small moves add up until they count
      setAway(y > lastY);
      lastY = y;
    }
    if (header) header.addEventListener("focusin", function () { setAway(false); });

    function el(tag, cls, text) {
      var node = document.createElement(tag);
      if (cls) node.className = cls;
      if (text) node.textContent = text;
      return node;
    }
    var chapterList = [];
    if (main) {
      Array.prototype.forEach.call(main.querySelectorAll("section[id]"), function (section) {
        if (chapterList.some(function (c) { return c.el.contains(section); })) return;  // a part of a chapter stays in it
        var head = section.querySelector("h2");
        var name = section.getAttribute("data-chapter") || (head && head.textContent.replace(/\s+/g, " ").trim());
        if (name) chapterList.push({ el: section, id: section.id, name: name, head: head });
      });
    }
    function goTo(chapter) {
      var how = reduce.matches ? "auto" : "smooth";
      if (!chapter) { scrollTo({ top: 0, behavior: how }); if (main) main.focus({ preventScroll: true }); return; }
      chapter.el.scrollIntoView({ behavior: how, block: "start" });
      var target = chapter.head || chapter.el;
      if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    }

    if (main) {
      // ---- the chapter pill (phones) ----
      var cp = el("nav", "cp"), scrim = el("div", "cp-scrim"), fan = el("ul", "cp-list"), pill = el("button", "cp-pill");
      cp.setAttribute("aria-label", "Chapters");
      scrim.setAttribute("aria-hidden", "true");
      fan.id = "cp-list";
      pill.type = "button";
      pill.setAttribute("aria-expanded", "false");
      pill.setAttribute("aria-controls", "cp-list");
      var ring = el("canvas", "cp-ring"), pillName = el("span", "cp-name");
      ring.setAttribute("aria-hidden", "true");
      pill.appendChild(ring);
      pill.appendChild(el("span", "visually-hidden", "Chapters, now: "));
      pill.appendChild(pillName);
      pill.insertAdjacentHTML("beforeend", '<svg class="cp-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>');
      var rows = [];
      chapterList.forEach(function (c) {
        var li = el("li"), a = el("a", "cp-row", c.name);
        a.href = "#" + c.id;
        a.addEventListener("click", function (event) { event.preventDefault(); setOpen(false); goTo(c); });
        li.appendChild(a);
        fan.appendChild(li);
        rows.push(a);
      });
      var topLi = el("li"), topRow = el("button", "cp-row", "Top");
      topRow.type = "button";
      topRow.addEventListener("click", function () { setOpen(false); goTo(null); });
      topLi.appendChild(topRow);
      fan.appendChild(topLi);
      [["/ghost-writer/", "Ghost Writer"], ["/media-hub/", "Media Hub"], ["/about/", "About"], ["/ghost-writer/#request", "Get access"]]
        .forEach(function (link, i, all) {
          var li = el("li", i === 0 ? "cp-site" : ""), a = el("a", "cp-row" + (i === all.length - 1 ? " cp-cta ring" : ""), link[1]);
          a.href = link[0];
          a.addEventListener("click", function () { setOpen(false); });  // request.js opens its form for Get access
          li.appendChild(a);
          fan.appendChild(li);
        });
      cp.appendChild(scrim);
      cp.appendChild(fan);
      cp.appendChild(pill);
      document.body.appendChild(cp);

      var setOpen = function (open, refocus) {
        if (open === fanOpen) return;
        fanOpen = open;
        cp.classList.toggle("open", open);
        pill.setAttribute("aria-expanded", String(open));
        if (open) {
          var first = fan.querySelector("[aria-current]") || fan.querySelector(".cp-row");
          first.focus({ preventScroll: true });
          first.scrollIntoView({ block: "nearest" });
        } else if (refocus) pill.focus();
      };
      pill.addEventListener("click", function () { setOpen(!fanOpen, true); });
      scrim.addEventListener("click", function () { setOpen(false, true); });
      document.addEventListener("keydown", function (event) { if (event.key === "Escape" && fanOpen) setOpen(false, true); });
      cp.addEventListener("focusout", function (event) {
        if (fanOpen && event.relatedTarget && !cp.contains(event.relatedTarget)) setOpen(false);
      });
      phone.addEventListener("change", function () { setOpen(false); });

      // ---- the chapter rail (wider screens, 3 or more chapters) ----
      var dots = [];
      if (chapterList.length >= 3) {
        var rail = el("nav", "rail on");
        rail.setAttribute("aria-label", "Chapters");
        chapterList.forEach(function (c) {
          var a = el("a", "rail-dot");
          a.href = "#" + c.id;
          a.appendChild(el("span", "rail-name", c.name));
          a.addEventListener("click", function (event) { event.preventDefault(); goTo(c); });
          rail.appendChild(a);
          dots.push(a);
        });
        document.body.appendChild(rail);
      }

      // ---- what is current, and the progress ring ----
      var now = -2, drawn = -1, colours = null;
      var mark = function (list, i) {
        list.forEach(function (node, k) { if (k === i) node.setAttribute("aria-current", "location"); else node.removeAttribute("aria-current"); });
      };
      var drawRing = function (p) {
        if (!colours) {
          var style = getComputedStyle(pill);
          colours = [style.getPropertyValue("--border").trim(), style.getPropertyValue("--accent").trim()];
        }
        var dpr = Math.min(devicePixelRatio || 1, 3), size = Math.round(28 * dpr);
        if (ring.width !== size) { ring.width = size; ring.height = size; }
        var g = ring.getContext("2d"), c = size / 2, r = size / 2 - 3 * dpr;
        g.clearRect(0, 0, size, size);
        g.lineWidth = 2.5 * dpr;
        g.lineCap = "round";
        g.strokeStyle = colours[0];
        g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.stroke();
        if (p > 0.005) {
          g.strokeStyle = colours[1];
          g.beginPath(); g.arc(c, c, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p); g.stroke();
        }
        drawn = p;
      };
      var chapterTick = function () {
        var line = innerHeight * 0.4, i = -1;
        for (var k = 0; k < chapterList.length; k++) {
          if (chapterList[k].el.getBoundingClientRect().top <= line) i = k; else break;
        }
        if (i !== now) {
          now = i;
          pillName.textContent = i >= 0 ? chapterList[i].name : chapterList.length ? "Chapters" : "Menu";
          mark(rows, i);
          mark(dots, i);
        }
        if (phone.matches) {
          var room = document.documentElement.scrollHeight - innerHeight, p = room > 0 ? Math.min(1, Math.max(0, scrollY / room)) : 0;
          if (Math.abs(p - drawn) > 0.002) drawRing(p);
        }
      };
      chapters = { tick: chapterTick, repaint: function () { colours = null; drawn = -1; chapterTick(); } };
      phone.addEventListener("change", chapters.repaint);
    }

    var ticking = false;
    function frameTick() {
      ticking = false;
      headerTick(scrollY);
      if (chapters) chapters.tick();
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frameTick); } }
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    if (chapters) chapters.repaint();
  })();

  // Download links ask first: each app needs an access key. data-download="mh" is Ghost Media Hub's link (the
  // dialog shows its words and downloads what the link points at). Without scripts the links just work.
  var ask = document.getElementById("ask");
  if (ask && typeof ask.showModal === "function") {
    var go = document.getElementById("ask-go");
    document.querySelectorAll("a[data-download]").forEach(function (link) {
      if (link === go) return;
      link.addEventListener("click", function (event) {
        event.preventDefault();
        var app = link.getAttribute("data-download") === "mh" ? "mh" : "gw";
        ask.querySelectorAll("[data-app]").forEach(function (part) { part.hidden = part.getAttribute("data-app") !== app; });
        go.href = link.href;
        ask.showModal();
        go.focus();
      });
    });
    document.getElementById("ask-later").addEventListener("click", function () { ask.close(); });
    ask.querySelectorAll(".ask-request").forEach(function (a) { a.addEventListener("click", function () { ask.close(); }); });
    go.addEventListener("click", function () { setTimeout(function () { ask.close(); }, 300); });
    ask.addEventListener("click", function (event) { if (event.target === ask) ask.close(); });  // a click outside
  }

  // The Request access form posts to the key server (dev/access-server), which only the owner can read.
  // Fields: name, contact, reason, heard (optional: where they heard of it), us_resident ("yes": the beta is
  // US-only, required), apps (which apps the key should open: "gw", "mh"; none ticked = Ghost Writer) and the
  // empty "website" trap for spam robots.
  var form = document.getElementById("request-form"), result = document.getElementById("request-result");
  if (form) {
    var server = form.getAttribute("data-server");
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var apps = [].slice.call(form.querySelectorAll("input[name=apps]:checked")).map(function (box) { return box.value; });
      var data = { name: form.name.value.trim(), contact: form.contact.value.trim(), reason: form.reason.value.trim(),
        heard: form.heard.value, us_resident: form.us_resident.checked ? "yes" : "", website: form.website.value, apps: apps };
      var nameOk = !!data.name, mailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.contact), usOk = !!data.us_resident;
      form.name.setAttribute("aria-invalid", String(!nameOk));
      form.contact.setAttribute("aria-invalid", String(!mailOk));
      form.us_resident.setAttribute("aria-invalid", String(!usOk));
      if (!nameOk || !mailOk || !usOk) {
        result.className = "result bad";
        result.textContent = !nameOk ? "Please give your name." : !mailOk ? "Please give a working email address: your key is sent there."
          : "Please tick the box to confirm you're in the United States: the beta is open to people in the US, for now.";
        (!nameOk ? form.name : !mailOk ? form.contact : form.us_resident).focus();
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
            // True whether or not the confirmation email is switched on yet.
            result.textContent = "Request received. Your key usually arrives by email within a few days; check your spam folder.";
          } else if (r.body && r.body.reason === "us-only") {
            result.className = "result bad"; result.textContent = "Ghost Writer's beta is open to people in the United States for now.";
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

  // The opening intro: the app's start-up logo, every Home visit and once per visit elsewhere (the page head set html.intro), on an
  // all-dark screen whatever the theme. It is the animation itself (assets/intro/index.html, built from
  // the app's boot-splash project), played live in a see-through frame, so the browser draws it at the
  // screen's own sharpness and there is no square around it. It plays its 3 s reveal, holds a moment and
  // fades into the page; a click or any key skips it. If it can't start quickly, or the tab is in the
  // background (where browsers pause animations), the page simply shows.
  if (root.classList.contains("intro")) {
    try { sessionStorage.setItem("gw-intro", "1"); } catch (e) {}
    var cover = document.createElement("div");
    cover.className = "intro-cover";
    cover.setAttribute("aria-hidden", "true");
    var stage = document.createElement("iframe");
    stage.title = "";
    stage.tabIndex = -1;
    stage.setAttribute("aria-hidden", "true");
    cover.appendChild(stage);
    document.body.appendChild(cover);
    var done = false, slow = setTimeout(finish, 2500);  // not playing after 2.5 s: don't keep the visitor waiting
    function finish() {
      if (done) return;
      done = true;
      clearTimeout(slow);
      cover.classList.add("out");
      root.classList.remove("intro");
      setTimeout(function () { cover.remove(); }, 650);
    }
    if (document.hidden) finish();
    document.addEventListener("visibilitychange", function () { if (document.hidden) finish(); });
    stage.onload = function () {
      try {
        // The frame's load event already means its pictures are in; wait for the lettering's font too.
        var view = stage.contentWindow;
        Promise.resolve(view.document.fonts ? view.document.fonts.ready : null).then(function () {
          var reveal = view.__timelines && view.__timelines.main;
          if (!reveal || done) return finish();
          clearTimeout(slow);
          reveal.eventCallback("onComplete", function () { setTimeout(finish, 300); });
          reveal.play(0);
          // Safety nets: a browser that isn't drawing (a covered window) never moves the animation;
          // show the page instead of a dark screen. And never longer than 6 s in all.
          setTimeout(function () { if (reveal.time() === 0) finish(); }, 1200);
          setTimeout(finish, 6000);
        }, finish);
      } catch (e) { finish(); }
    };
    stage.src = "/assets/intro/index.html";
    cover.addEventListener("click", finish);
    document.addEventListener("keydown", finish, { once: true });
  }

  // Loops run only on screen (CONTRACT.md rule 6): the button rings, the pressed chips' rings and the closing ghost's
  // float pause while off screen (site.css .loop-off). A chip pressed later is a chip already watched.
  if (root.classList.contains("motion") && "IntersectionObserver" in window) {
    var loops = new IntersectionObserver(function (seen) {
      seen.forEach(function (e) { e.target.classList.toggle("loop-off", !e.isIntersecting); });
    });
    document.querySelectorAll(".button, .btn, .ring, .scene .chip, .ghost-art").forEach(function (el) { el.classList.add("loop-off"); loops.observe(el); });
  }
})();
