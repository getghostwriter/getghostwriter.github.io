// Ghost Media Works site film: the calm pages' own behaviour (Install and help, What's new; loaded with more.css by
// "assets: more"). Runs after the scene kit (scenes.js). Owner: [Claude-site-film-more].
// - Copy buttons ([data-copy] names the id of the text to copy): the clipboard, else the text is selected for Ctrl+C.
// - The hash check (form.m-hash): the pasted fingerprint is compared on this page with the one shown; nothing is sent.
// - What's new: each stop's bullets arrive as it reaches the middle of the screen; the newest headline gets the kit's
//   light pass once. Every page reads complete without this file (the buttons and the check stay hidden, all bullets show).
(function () {
  "use strict";
  var root = document.documentElement;
  function each(list, fn) { Array.prototype.forEach.call(list, fn); }

  // ---- copy buttons ----
  function select(el) {
    var range = document.createRange(), sel = getSelection();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
  }
  each(document.querySelectorAll("button[data-copy]"), function (btn) {
    var source = document.getElementById(btn.getAttribute("data-copy")), label = btn.textContent, timer = 0;
    if (!source) return;
    function said(text) {
      btn.textContent = text;
      btn.classList.add("done");
      clearTimeout(timer);
      timer = setTimeout(function () { btn.textContent = label; btn.classList.remove("done"); }, 2000);
    }
    function fallback() {
      select(source);
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      said(ok ? "Copied" : "Press Ctrl+C");
    }
    btn.addEventListener("click", function () {
      var text = source.textContent.trim();
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(function () { said("Copied"); }, fallback);
      } else {
        fallback();
      }
    });
    btn.hidden = false;
  });

  // ---- the hash check: 64 letters and digits pulled from whatever was pasted (PowerShell's whole line is fine) ----
  each(document.querySelectorAll("form.m-hash"), function (form) {
    var input = form.querySelector("input"), verdict = form.querySelector(".m-verdict"), say = form.querySelector(".m-hash-say");
    var shown = document.getElementById(form.getAttribute("data-against"));
    if (!input || !verdict || !say || !shown) return;
    var want = shown.textContent.trim().toLowerCase();
    function check() {
      var text = input.value.trim(), bare = text.replace(/\s+/g, "");
      var found = /^[0-9a-f]{64}$/i.test(bare) ? bare : (/(?:^|[^0-9a-f])([0-9a-f]{64})(?![0-9a-f])/i.exec(text) || [])[1];
      verdict.className = "m-verdict";
      if (!text) { say.textContent = ""; return; }
      if (!found) { say.textContent = "That isn't a whole fingerprint yet."; return; }
      var match = found.toLowerCase() === want;
      verdict.classList.add(match ? "yes" : "no");
      say.textContent = match ? "It matches. Your download is the real one." : "It doesn't match. Don't open it; download it again from this page.";
    }
    input.addEventListener("input", check);
    form.addEventListener("submit", function (e) { e.preventDefault(); check(); });
    form.hidden = false;
  });

  // ---- What's new: the rail's stops reveal their bullets near the middle; one light pass on the newest headline ----
  var rails = document.querySelectorAll(".m-log .changes");
  if (rails.length && root.classList.contains("motion") && "IntersectionObserver" in window) {
    // A stop is reached once its top is above 55% of the screen, also when a jump (a link, the chapter pill) skips past
    // it; stops folded under "Earlier updates" have no box, so they simply show when opened.
    var waiting = [], queued = 0;
    function sweep() {
      queued = 0;
      var line = innerHeight * 0.55;
      waiting = waiting.filter(function (stop) {
        if (stop.getBoundingClientRect().top >= line) return true;
        stop.classList.add("reached");
        return false;
      });
      if (!waiting.length) removeEventListener("scroll", onScroll);
    }
    function onScroll() { if (!queued) queued = requestAnimationFrame(sweep); }
    each(rails, function (rail) {
      each(rail.querySelectorAll(".change"), function (stop) {
        each(stop.querySelectorAll("li"), function (li, i) { li.style.setProperty("--m-i", Math.min(i, 9)); });
        waiting.push(stop);
      });
      rail.classList.add("m-rail");
    });
    addEventListener("scroll", onScroll, { passive: true });
    sweep();
    var newest = rails[0].querySelector(".change-head");
    if (newest) {
      newest.classList.add("light-pass");
      var pass = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { pass.disconnect(); newest.classList.add("passed"); }
      }, { rootMargin: "0px 0px -20% 0px" });
      pass.observe(newest);
    }
  }
})();
