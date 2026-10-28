(function () {
        "use strict";
        gsap.registerPlugin(MotionPathPlugin);
        var vars = window.__hyperframes && window.__hyperframes.getVariables ? window.__hyperframes.getVariables() : {};
        if (vars.bg) document.documentElement.style.setProperty("--bg", vars.bg);
        if (vars.accent) document.documentElement.style.setProperty("--accent", vars.accent);

        var right = document.getElementById("line-right");
        var left = document.getElementById("line-left");
        var strokes = [right, left, document.getElementById("glow-right"), document.getElementById("glow-left")];
        strokes.forEach(function (p) {
          var len = p.getTotalLength();
          p.style.strokeDasharray = len + " " + len;
          p.style.strokeDashoffset = String(len);
        });

        var tl = gsap.timeline({ paused: true });
        gsap.set("#stage", { transformOrigin: "50% 50%" });
        gsap.set("#ghost", { transformOrigin: "50% 50%" });
        gsap.set("#flash", { transformOrigin: "50% 50%" });

        // 1. The outline draws on from the top of the head, down both sides, two lit tips leading.
        var TRACE = 0.85;
        tl.to(strokes, { strokeDashoffset: 0, duration: TRACE, ease: "power2.inOut" }, 0.02);
        tl.to("#tip-right", { motionPath: { path: right, align: right, alignOrigin: [0.5, 0.5] }, duration: TRACE, ease: "power2.inOut" }, 0.02);
        tl.to("#tip-left", { motionPath: { path: left, align: left, alignOrigin: [0.5, 0.5] }, duration: TRACE, ease: "power2.inOut" }, 0.02);
        tl.to(".tip", { opacity: 1, duration: 0.1, ease: "power2.out" }, 0.02);
        tl.to(".tip", { opacity: 0, duration: 0.12, ease: "power2.in" }, 0.02 + TRACE - 0.04);

        // 2. The sweep: the body arrives huge and blurred from the top left and shrinks into the outline.
        tl.fromTo(
          "#ghost",
          { scale: 4.2, x: -230, y: -300, rotation: -12, opacity: 0 },
          { scale: 1, x: 0, y: 0, rotation: 0, opacity: 1, duration: 0.7, ease: "power3.out" },
          0.72
        );
        tl.fromTo("#ghost", { filter: "blur(22px)" }, { filter: "blur(0px)", duration: 0.75, ease: "power3.out" }, 0.72);

        // 3. The eyes light with a flash, the outline gives way to the body's own rim, the glow blooms.
        tl.to("#eyes", { opacity: 1, duration: 0.12, ease: "power4.out" }, 1.38);
        tl.fromTo("#flash", { opacity: 0, scale: 0.5 }, { opacity: 0.9, scale: 1, duration: 0.08, ease: "power2.out" }, 1.38);
        tl.to("#flash", { opacity: 0, scale: 1.9, duration: 0.42, ease: "power3.out" }, 1.46);
        tl.to(".trace-line, .trace-glow", { opacity: 0, duration: 0.25, ease: "power2.out" }, 1.4);
        tl.to("#halo", { opacity: 1, duration: 0.5, ease: "power2.out" }, 1.42);

        // 4. The name slides out from the middle, letter by letter, the spacing tightening as it lands.
        tl.fromTo(
          ".l",
          { opacity: 0, x: function (i) { return (i - 5.5) * 16; }, filter: "blur(6px)" },
          { opacity: 1, x: 0, filter: "blur(0px)", duration: 0.6, ease: "expo.out", stagger: { each: 0.035, from: "center" } },
          1.55
        );

        // 5. The lockup settles to its final size and holds; the last frame is the app's own logo.
        tl.fromTo("#stage", { scale: 1.06 }, { scale: 1, duration: 0.45, ease: "power2.inOut" }, 2.4);

        window.__timelines["main"] = tl;
        tl.seek(0);
      })();
