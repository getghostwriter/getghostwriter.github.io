// Before the page paints: the theme chosen on this device, and old links forwarded (the company page
// used to be Ghost Writer's page, and installed copies open getghostwriter.github.io/#request).
(function () {
  document.documentElement.classList.add("js");  // the phone menu folds away only when a script can open it
  try { var t = localStorage.getItem("gw-theme"); if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t); } catch (e) {}
  // Motion effects (motion.js) only when welcome; set before paint so their layouts never jump.
  try { if (!matchMedia("(prefers-reduced-motion: reduce)").matches) document.documentElement.classList.add("motion"); } catch (e) {}
  // The app's start-up logo opens the first page of a visit (site.js plays it); covered until then.
  try {
    if (!sessionStorage.getItem("gw-intro") && !matchMedia("(prefers-reduced-motion: reduce)").matches)
      document.documentElement.classList.add("intro");
  } catch (e) {}
  if (location.pathname !== "/" && location.pathname !== "/index.html") return;
  var to = {
    "#request": "/ghost-writer/#request", "#download": "/ghost-writer/#download", "#privacy": "/ghost-writer/#privacy",
    "#beta": "/ghost-writer/#request", "#install": "/ghost-writer/help/#install", "#requirements": "/ghost-writer/help/#requirements",
    "#faq": "/ghost-writer/help/#faq", "#new": "/ghost-writer/changelog/", "#features": "/ghost-writer/features/",
    "#everything": "/ghost-writer/features/", "#hey-ghost": "/ghost-writer/features/#hey-ghost", "#modes": "/ghost-writer/features/#modes",
    "#smart": "/ghost-writer/features/#reads-the-room", "#rewrite": "/ghost-writer/features/#rewrite", "#search": "/ghost-writer/features/#search",
    "#learns": "/ghost-writer/features/#learns", "#stats": "/ghost-writer/features/#stats", "#settings-tour": "/ghost-writer/features/#settings"
  }[location.hash];
  if (to) location.replace(to);
})();
