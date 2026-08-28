(() => {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(pointer: fine)");

  const setupCursor = () => {
    const dot = document.getElementById("cursorDot");
    const follow = document.getElementById("cursorFollow");
    if (!dot || !follow) return () => {};

    const style = document.createElement("style");
    style.id = "reference-homepage-cursor";
    style.textContent = `
      .cursor-dot {
        position: fixed !important;
        left: 0 !important;
        top: 0 !important;
        width: 10px !important;
        height: 10px !important;
        margin: -5px 0 0 -5px !important;
        border: 0 !important;
        border-radius: 50% !important;
        background: #fff !important;
        box-shadow: none !important;
        opacity: 0 !important;
        transform: none !important;
        pointer-events: none !important;
        z-index: 10087 !important;
      }

      .cursor-dot.cursor-visible { opacity: 1 !important; }

      .cursor-follow {
        position: fixed !important;
        left: 0 !important;
        top: 0 !important;
        width: 18px !important;
        height: 18px !important;
        margin: 0 !important;
        border: 0 !important;
        border-radius: 25px !important;
        background: #fff !important;
        box-shadow: none !important;
        opacity: .25 !important;
        transform: scale(1) !important;
        pointer-events: none !important;
        z-index: 10086 !important;
        transition: .2s ease-in-out !important;
        transition-property: background, opacity, transform !important;
      }

      .cursor-follow.hidden { opacity: 0 !important; }
      .cursor-follow.active {
        opacity: .5 !important;
        transform: scale(.5) !important;
      }

      @media (max-width: 720px), (pointer: coarse) {
        .cursor-dot,
        .cursor-follow { display: none !important; }
      }
    `;
    document.head.appendChild(style);

    dot.classList.remove("cursor-visible");
    follow.classList.remove("cursor-visible", "pressed", "active");
    follow.classList.add("hidden");

    let curr = null;
    let prev = null;
    let raf = 0;

    const moveDot = (x, y) => {
      dot.style.translate = `${x}px ${y}px`;
    };

    const moveFollow = (x, y) => {
      follow.style.translate = `${x}px ${y}px`;
    };

    const render = () => {
      raf = 0;
      if (!curr) return;

      if (prev) {
        prev.x += (curr.x - prev.x) * 0.35;
        prev.y += (curr.y - prev.y) * 0.35;
        moveFollow(prev.x, prev.y);
      } else {
        prev = { ...curr };
        moveFollow(prev.x, prev.y);
      }

      if (Math.abs(curr.x - prev.x) > 0.01 || Math.abs(curr.y - prev.y) > 0.01) {
        raf = requestAnimationFrame(render);
      }
    };

    const queueRender = () => {
      if (!raf) raf = requestAnimationFrame(render);
    };

    const onMouseMove = (event) => {
      moveDot(event.clientX, event.clientY);
      dot.classList.add("cursor-visible");

      if (curr === null) moveFollow(event.clientX - 8, event.clientY - 8);
      curr = { x: event.clientX - 8, y: event.clientY - 8 };
      follow.classList.remove("hidden");
      follow.classList.add("cursor-visible");
      queueRender();
    };

    const onMouseEnter = () => {
      dot.classList.add("cursor-visible");
      follow.classList.remove("hidden");
    };

    const onMouseLeave = () => {
      dot.classList.remove("cursor-visible");
      follow.classList.add("hidden");
    };

    const onMouseDown = () => follow.classList.add("active");
    const onMouseUp = () => follow.classList.remove("active");

    document.addEventListener("mousemove", onMouseMove, { passive: true });
    document.addEventListener("mouseenter", onMouseEnter);
    document.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mouseup", onMouseUp);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseenter", onMouseEnter);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mouseup", onMouseUp);
    };
  };

  const setupClickFireworks = () => {
    if (!finePointer.matches || prefersReducedMotion.matches) return () => {};

    const canvas = document.createElement("canvas");
    canvas.className = "click-fireworks";
    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, {
      position: "fixed",
      inset: "0",
      width: "100vw",
      height: "100vh",
      pointerEvents: "none",
      zIndex: "10085"
    });
    document.body.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      canvas.remove();
      return () => {};
    }

    const lightPalette = [
      [102, 167, 221],
      [62, 131, 225],
      [33, 78, 194]
    ];
    const darkPalette = [
      [252, 146, 174],
      [202, 180, 190],
      [207, 198, 255]
    ];

    const particleCount = 20;
    const bursts = [];
    let width = 0;
    let height = 0;
    let dpr = 1;
    let raf = 0;

    const random = (min, max) => Math.random() * (max - min) + min;
    const randomInt = (min, max) => Math.floor(random(min, max + 1));
    const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
    const clamp01 = (value) => Math.min(1, Math.max(0, value));

    const isDark = () => {
      const root = document.documentElement;
      return root.classList.contains("dark") ||
        root.dataset.theme === "dark" ||
        window.matchMedia("(prefers-color-scheme: dark)").matches;
    };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };

    const clearCanvas = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const createParticle = (x, y, palette, startTime) => {
      const angle = random(0, Math.PI * 2);
      const distance = random(50, 100) * (Math.random() < 0.5 ? -1 : 1);
      const color = palette[randomInt(0, palette.length - 1)];
      return {
        startX: x,
        startY: y,
        endX: x + distance * Math.cos(angle),
        endY: y + distance * Math.sin(angle),
        radius: random(10, 20),
        rotation: random(0, Math.PI * 2),
        alpha: random(0.2, 0.8),
        color,
        startTime,
        duration: random(900, 1500)
      };
    };

    const createBurst = (x, y) => {
      const startTime = performance.now();
      const dark = isDark();
      const palette = dark ? darkPalette : lightPalette;
      const particles = Array.from(
        { length: particleCount },
        () => createParticle(x, y, palette, startTime)
      );

      bursts.push({
        particles,
        ring: {
          x,
          y,
          startTime,
          duration: random(1200, 1800),
          endRadius: random(50, 100),
          color: dark ? [233, 179, 237] : [106, 159, 255]
        }
      });

      if (!raf) raf = requestAnimationFrame(render);
    };

    const drawParticle = (particle, now) => {
      const raw = clamp01((now - particle.startTime) / particle.duration);
      const eased = easeOutExpo(raw);
      const x = particle.startX + (particle.endX - particle.startX) * eased;
      const y = particle.startY + (particle.endY - particle.startY) * eased;
      const radius = particle.radius * (1 - raw);
      const alpha = particle.alpha * (1 - raw);
      if (radius <= 0 || alpha <= 0) return false;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(particle.rotation);
      ctx.beginPath();
      ctx.moveTo(0, -radius);
      ctx.lineTo(radius * Math.sin(Math.PI / 3), radius * Math.cos(Math.PI / 3));
      ctx.lineTo(-radius * Math.sin(Math.PI / 3), radius * Math.cos(Math.PI / 3));
      ctx.closePath();
      ctx.fillStyle = `rgba(${particle.color[0]}, ${particle.color[1]}, ${particle.color[2]}, ${alpha})`;
      ctx.fill();
      ctx.restore();
      return raw < 1;
    };

    const drawRing = (ring, now) => {
      const raw = clamp01((now - ring.startTime) / ring.duration);
      const eased = easeOutExpo(raw);
      const radius = 0.1 + (ring.endRadius - 0.1) * eased;
      const alpha = 0.5 * (1 - raw);
      const lineWidth = 6 * (1 - raw);
      if (alpha <= 0 || lineWidth <= 0) return false;

      ctx.save();
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, radius, 0, Math.PI * 2);
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = `rgba(${ring.color[0]}, ${ring.color[1]}, ${ring.color[2]}, ${alpha})`;
      ctx.stroke();
      ctx.restore();
      return raw < 1;
    };

    const render = (now) => {
      raf = 0;
      clearCanvas();

      for (let burstIndex = bursts.length - 1; burstIndex >= 0; burstIndex -= 1) {
        const burst = bursts[burstIndex];
        let active = drawRing(burst.ring, now);

        for (const particle of burst.particles) {
          active = drawParticle(particle, now) || active;
        }

        if (!active) bursts.splice(burstIndex, 1);
      }

      if (bursts.length) raf = requestAnimationFrame(render);
    };

    const onMouseDown = (event) => {
      if (event.button !== 0) return;
      createBurst(event.clientX, event.clientY);
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("mousedown", onMouseDown, { passive: true });

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("mousedown", onMouseDown);
      canvas.remove();
    };
  };

  const cleanupCursor = setupCursor();
  const cleanupFireworks = setupClickFireworks();

  window.addEventListener("pagehide", () => {
    cleanupCursor();
    cleanupFireworks();
  }, { once: true });
})();
