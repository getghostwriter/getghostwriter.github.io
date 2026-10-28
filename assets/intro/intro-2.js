window.__timelines = {};
      function introFit() {
        var f = [0.9, 0.75, 1.0], s = Math.min(innerWidth * f[0], innerHeight * f[1], 480 * f[2]) / 480;
        var root = document.getElementById("root");
        root.style.zoom = s;
        root.style.left = (innerWidth - 480 * s) / 2 / s + "px";
        root.style.top = (innerHeight - 480 * s) / 2 / s + "px";
      }
      addEventListener("DOMContentLoaded", introFit);
      addEventListener("resize", introFit);
