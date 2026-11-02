// Ghost Media Works website: the Request access dialog (audit 2026-11-01, pick 6A), on every page.
// Any link to /ghost-writer/#request opens the form over the current page in two short steps (name, email,
// US tick; then two optional questions with "Skip and send"). There is one form on every page: on Ghost
// Writer's page it is the form in the #request section, moved into the dialog while it is open and back
// after; elsewhere the dialog holds its own copy (build_site). Sending stays in site.js (one submit, the same
// fields); this file only shows "You're on the list" when site.js reports success. Without this script (or
// without <dialog>) the links simply go to /ghost-writer/#request, where the whole form shows at once.
(function () {
  "use strict";
  var dialog = document.getElementById("request-dialog");
  if (!dialog || typeof dialog.showModal !== "function") return;
  var root = document.documentElement;
  var slot = dialog.querySelector(".rq-slot"), box = document.querySelector(".rq-box");
  if (!box) return;
  var home = box.parentNode, marker = document.createComment("request form");  // where the form lives on the page
  var form = box.querySelector("form"), result = box.querySelector(".result"), done = box.querySelector(".rq-done");
  var stepNo = dialog.querySelector(".rq-stepno"), opener = null, sentTo = "";

  function setStep(n) {
    dialog.setAttribute("data-step", String(n));
    if (stepNo) stepNo.textContent = n === 1 ? "Step 1 of 2." : "Step 2 of 2.";
  }
  // Asked from Ghost Media Hub's page or one of its links: tick Media Hub instead of Ghost Writer.
  function pickApps(from) {
    var href = (from && from.getAttribute("href")) || "";
    if (!/media-hub/.test(href) && !/^\/media-hub\//.test(location.pathname)) return;
    form.querySelectorAll("input[name=apps]").forEach(function (box) { box.checked = box.value === "mh"; });
  }
  pickApps(null);  // the form sitting in Media Hub's own #request section
  function open(from) {
    opener = from || null;
    if (done.hidden) pickApps(from);
    if (box.parentNode !== slot) { home.insertBefore(marker, box); slot.appendChild(box); }
    dialog.classList.toggle("is-done", !done.hidden);
    setStep(1);
    root.classList.add("rq-open");
    dialog.showModal();
    var first = done.hidden ? form.querySelector("input[name=name]") : done;
    if (first) first.focus();
  }
  function closed() {  // runs once per close: from our own buttons, Escape ("cancel") or the close event
    if (!root.classList.contains("rq-open")) return;
    root.classList.remove("rq-open");
    dialog.removeAttribute("data-step");
    if (marker.parentNode) { marker.parentNode.insertBefore(box, marker); marker.remove(); }
    if (opener && document.contains(opener)) opener.focus();
    opener = null;
  }
  function shut() { dialog.close(); closed(); }  // the close event can come late (background tabs), so don't wait for it
  dialog.addEventListener("close", closed);
  dialog.addEventListener("cancel", function () { setTimeout(closed, 0); });  // Escape
  dialog.querySelector(".rq-close").addEventListener("click", shut);
  dialog.addEventListener("click", function (event) { if (event.target === dialog) shut(); });  // a click outside

  // Links that ask for the form. A deep link (arriving at /ghost-writer/#request) keeps the form in the page.
  document.addEventListener("click", function (event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var link = event.target.closest && event.target.closest("a[href]");
    if (!link || dialog.contains(link)) return;
    var href = link.getAttribute("href");
    if (href !== "#request" && !/^\/(ghost-writer|media-hub)\/#request$/.test(href)) return;
    event.preventDefault();
    open(link);
  });

  // Step 1 -> 2: the same checks site.js makes when sending (it checks again on submit).
  function stepOneOk() {
    var name = form.name.value.trim(), mail = form.contact.value.trim(), us = form.us_resident.checked;
    var nameOk = !!name, mailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail);
    form.name.setAttribute("aria-invalid", String(!nameOk));
    form.contact.setAttribute("aria-invalid", String(!mailOk));
    form.us_resident.setAttribute("aria-invalid", String(!us));
    if (nameOk && mailOk && us) { result.className = "result"; result.textContent = ""; return true; }
    result.className = "result bad";
    result.textContent = !nameOk ? "Please give your name." : !mailOk ? "Please give a working email address: your key is sent there."
      : "Please tick the box to confirm you're in the United States: the beta is open to people in the US, for now.";
    (!nameOk ? form.name : !mailOk ? form.contact : form.us_resident).focus();
    return false;
  }
  box.querySelector(".rq-next").addEventListener("click", function () {
    if (!stepOneOk()) return;
    setStep(2);
    form.reason.focus();
  });
  box.querySelector(".rq-skip").addEventListener("click", function () {
    form.reason.value = ""; form.heard.value = "";
    if (form.requestSubmit) form.requestSubmit(); else form.querySelector("button[type=submit]").click();
  });
  // Enter in a step-1 field moves on instead of sending half the form.
  form.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && dialog.open && dialog.getAttribute("data-step") === "1" && event.target.tagName === "INPUT") {
      event.preventDefault();
      box.querySelector(".rq-next").click();
    }
  });
  form.addEventListener("submit", function () { sentTo = form.contact.value.trim(); });

  // site.js writes the outcome into the result line; "good" means the key server took the request.
  new MutationObserver(function () {
    if (!/\bgood\b/.test(result.className) || !done.hidden) return;
    var forLine = done.querySelector(".rq-done-for");
    if (forLine) forLine.textContent = sentTo ? "Request received for " + sentTo + "." : "Request received.";
    form.hidden = true;
    done.hidden = false;
    dialog.classList.add("is-done");
    box.classList.add("rq-arrive");
    done.focus();
  }).observe(result, { attributes: true, attributeFilter: ["class"], childList: true });
})();
