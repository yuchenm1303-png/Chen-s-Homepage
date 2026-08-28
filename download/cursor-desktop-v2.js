(() => {
  const dot = document.getElementById("cursorDot");
  const follow = document.getElementById("cursorFollow");
  if (!dot || !follow) return;

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

  document.addEventListener("mousemove", (event) => {
    moveDot(event.clientX, event.clientY);
    dot.classList.add("cursor-visible");

    if (curr === null) moveFollow(event.clientX - 8, event.clientY - 8);
    curr = { x: event.clientX - 8, y: event.clientY - 8 };
    follow.classList.remove("hidden");
    follow.classList.add("cursor-visible");
    queueRender();
  }, { passive: true });

  document.addEventListener("mouseenter", () => {
    dot.classList.add("cursor-visible");
    follow.classList.remove("hidden");
  });

  document.addEventListener("mouseleave", () => {
    dot.classList.remove("cursor-visible");
    follow.classList.add("hidden");
  });

  document.addEventListener("mousedown", () => follow.classList.add("active"));
  document.addEventListener("mouseup", () => follow.classList.remove("active"));

  window.addEventListener("pagehide", () => {
    if (raf) cancelAnimationFrame(raf);
  }, { once: true });
})();

(() => {
  const ANIME_SRC = "https://cdn.jsdelivr.net/npm/animejs@3.2.1/lib/anime.min.js";

  const loadAnime321 = () => {
    if (window.anime?.version === "3.2.1") return Promise.resolve(window.anime);

    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-listing-studio-anime="3.2.1"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(window.anime), { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = ANIME_SRC;
      script.async = true;
      script.dataset.listingStudioAnime = "3.2.1";
      script.addEventListener("load", () => resolve(window.anime), { once: true });
      script.addEventListener("error", reject, { once: true });
      document.head.appendChild(script);
    });
  };

  const setupOriginalFireworks = (anime) => {
    if (!anime) return;

    const style = document.createElement("style");
    style.id = "original-click-fireworks-style";
    style.textContent = `
      .fireworks {
        position: fixed;
        left: 0;
        top: 0;
        z-index: 999;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);

    const canvas = document.createElement("canvas");
    canvas.className = "fireworks";
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);

    let mouseX = 0;
    let mouseY = 0;
    let onMouseDown;
    let onResize;

    const darkColors = ["252, 146, 174", "202, 180, 190", "207, 198, 255"];
    const config = {
      colors: darkColors,
      numberOfParticles: 20,
      orbitRadius: {
        min: 50,
        max: 100
      },
      circleRadius: {
        min: 10,
        max: 20
      },
      diffuseRadius: {
        min: 50,
        max: 100
      },
      animeDuration: {
        min: 900,
        max: 1500
      }
    };

    const colors = config.colors;
    const context = canvas.getContext("2d");
    if (!context) {
      canvas.remove();
      style.remove();
      return;
    }

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    }

    function randomEndPosition(origin) {
      const angle = anime.random(0, 360) * Math.PI / 180;
      const diffuseRadius = anime.random(config.diffuseRadius.min, config.diffuseRadius.max);
      const signedRadius = [-1, 1][anime.random(0, 1)] * diffuseRadius;
      return {
        x: origin.x + signedRadius * Math.cos(angle),
        y: origin.y + signedRadius * Math.sin(angle)
      };
    }

    function createParticle(x, y) {
      return {
        x,
        y,
        color: `rgba(${colors[anime.random(0, colors.length - 1)]},${anime.random(.2, .8)})`,
        radius: anime.random(config.circleRadius.min, config.circleRadius.max),
        angle: anime.random(0, 360),
        endPos: randomEndPosition({ x, y }),
        draw() {
          context.save();
          context.translate(this.x, this.y);
          context.rotate(this.angle * Math.PI / 180);
          context.beginPath();
          context.moveTo(0, -this.radius);
          context.lineTo(this.radius * Math.sin(Math.PI / 3), this.radius * Math.cos(Math.PI / 3));
          context.lineTo(-this.radius * Math.sin(Math.PI / 3), this.radius * Math.cos(Math.PI / 3));
          context.closePath();
          context.fillStyle = this.color;
          context.fill();
          context.restore();
        }
      };
    }

    function createCircle(x, y) {
      return {
        x,
        y,
        color: "rgb(233, 179, 237)",
        radius: .1,
        alpha: .5,
        lineWidth: 6,
        draw() {
          context.globalAlpha = this.alpha;
          context.beginPath();
          context.arc(this.x, this.y, this.radius, 0, 2 * Math.PI, true);
          context.lineWidth = this.lineWidth;
          context.strokeStyle = this.color;
          context.stroke();
          context.globalAlpha = 1;
        }
      };
    }

    function drawTargets(animation) {
      animation.animatables.forEach(({ target }) => target.draw?.());
    }

    function createFirework(x, y) {
      const circle = createCircle(x, y);
      const particles = Array.from(
        { length: config.numberOfParticles },
        () => createParticle(x, y)
      );

      anime.timeline().add({
        targets: particles,
        x: (particle) => particle.endPos.x,
        y: (particle) => particle.endPos.y,
        radius: 0,
        duration: anime.random(config.animeDuration.min, config.animeDuration.max),
        easing: "easeOutExpo",
        update: drawTargets
      }).add({
        targets: circle,
        radius: anime.random(config.orbitRadius.min, config.orbitRadius.max),
        lineWidth: 0,
        alpha: {
          value: 0,
          easing: "linear",
          duration: anime.random(600, 800)
        },
        duration: anime.random(1200, 1800),
        easing: "easeOutExpo",
        update: drawTargets
      }, 0);
    }

    const clearAnimation = anime({
      duration: Number.POSITIVE_INFINITY,
      update: () => context.clearRect(0, 0, canvas.width, canvas.height)
    });

    onResize = () => resize();
    onMouseDown = (event) => {
      clearAnimation.play();
      mouseX = event.clientX;
      mouseY = event.clientY;
      createFirework(mouseX, mouseY);
    };

    document.addEventListener("mousedown", onMouseDown);
    window.addEventListener("resize", onResize);
    resize();

    window.addEventListener("pagehide", () => {
      document.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("resize", onResize);
      clearAnimation.pause();
    }, { once: true });
  };

  loadAnime321().then(setupOriginalFireworks).catch(() => {});
})();

(() => {
  if (window.matchMedia("(pointer: coarse)").matches) return;

  const MAX_TILT = 8;
  const MAGNET_STRENGTH = 6;
  const LIFT_Z = 22;
  const SHADOW_INTENSITY = 5;
  const PERSPECTIVE = 1000;
  const cards = document.querySelectorAll(
    ".release-card, .account-card, .utility-card, .modal-card"
  );
  if (!cards.length) return;

  const style = document.createElement("style");
  style.id = "advanced-card-tilt-style";
  style.textContent = `
    .advanced-tilt-card {
      --tilt-mx: 50%;
      --tilt-my: 50%;
      --tilt-rx: 0deg;
      --tilt-ry: 0deg;
      --tilt-tx: 0px;
      --tilt-ty: 0px;
      --tilt-tz: 0px;
      --tilt-sx: 0px;
      --tilt-sy: 0px;
      --tilt-scale: 1;
      --tilt-radius: 18px;
      --tilt-perspective: ${PERSPECTIVE}px;
      position: relative;
      min-width: 0;
      box-sizing: border-box;
      transform-style: flat;
      transform: perspective(var(--tilt-perspective)) scale(var(--tilt-scale));
      transition: transform .5s cubic-bezier(.25, .46, .45, .94), box-shadow .5s ease !important;
      will-change: transform;
    }

    .advanced-tilt-card.utility-card { --tilt-radius: 14px; }
    .advanced-tilt-card:hover { --tilt-scale: 1.01; }
    .advanced-tilt-card.utility-card:hover { --tilt-scale: 1.02; }
    .advanced-tilt-card:active { --tilt-scale: .985; }
    .advanced-tilt-card.utility-card:active { --tilt-scale: 1; }

    .advanced-tilt-card.is-tilting {
      transition: transform .12s ease-out, box-shadow .35s ease !important;
      transform:
        perspective(var(--tilt-perspective))
        scale(var(--tilt-scale))
        rotateX(var(--tilt-rx))
        rotateY(var(--tilt-ry))
        translate3d(var(--tilt-tx), var(--tilt-ty), var(--tilt-tz)) !important;
      box-shadow:
        0 25px 60px rgba(0, 0, 0, .24),
        0 0 0 1px rgba(233, 179, 237, .20),
        var(--tilt-sx) var(--tilt-sy) 20px rgba(0, 0, 0, .08) !important;
    }

    .advanced-tilt-card.is-tilting * {
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
    }

    .advanced-tilt-glow,
    .advanced-tilt-border-light {
      position: absolute;
      inset: 0;
      border-radius: var(--tilt-radius);
      pointer-events: none;
      opacity: 0;
      transition: opacity .4s ease;
    }

    .advanced-tilt-glow {
      background: radial-gradient(
        circle 280px at var(--tilt-mx) var(--tilt-my),
        rgba(255, 255, 255, .32) 0%,
        rgba(233, 179, 237, .07) 30%,
        transparent 70%
      );
      z-index: 10;
    }

    .advanced-tilt-border-light {
      padding: 1.5px;
      background: radial-gradient(
        circle 220px at var(--tilt-mx) var(--tilt-my),
        rgba(233, 179, 237, .55) 0%,
        transparent 60%
      );
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      z-index: 11;
    }

    .advanced-tilt-card.is-tilting > .advanced-tilt-glow,
    .advanced-tilt-card.is-tilting > .advanced-tilt-border-light {
      opacity: 1;
      transition: opacity .15s ease;
    }

    @media (max-width: 720px), (pointer: coarse), (prefers-reduced-motion: reduce) {
      .advanced-tilt-card,
      .advanced-tilt-card.is-tilting {
        --tilt-rx: 0deg !important;
        --tilt-ry: 0deg !important;
        --tilt-tx: 0px !important;
        --tilt-ty: 0px !important;
        --tilt-tz: 0px !important;
        transform: scale(var(--tilt-scale)) !important;
        box-shadow: inherit !important;
        will-change: auto;
      }

      .advanced-tilt-glow,
      .advanced-tilt-border-light {
        display: none !important;
      }
    }
  `;
  document.head.appendChild(style);

  const cleanups = [];

  cards.forEach((card) => {
    card.classList.remove("reference-tilt-card");
    card.classList.add("advanced-tilt-card");

    const glow = document.createElement("div");
    glow.className = "advanced-tilt-glow";
    glow.setAttribute("aria-hidden", "true");

    const borderLight = document.createElement("div");
    borderLight.className = "advanced-tilt-border-light";
    borderLight.setAttribute("aria-hidden", "true");

    card.prepend(borderLight);
    card.prepend(glow);

    let frame = 0;
    let pointerX = 0;
    let pointerY = 0;

    const render = () => {
      frame = 0;
      const rect = card.getBoundingClientRect();
      const halfWidth = Math.max(1, rect.width / 2);
      const halfHeight = Math.max(1, rect.height / 2);
      const centerX = rect.left + halfWidth;
      const centerY = rect.top + halfHeight;
      const normalizedX = Math.max(-1, Math.min(1, (pointerX - centerX) / halfWidth));
      const normalizedY = Math.max(-1, Math.min(1, (pointerY - centerY) / halfHeight));

      card.style.setProperty("--tilt-mx", `${pointerX - rect.left}px`);
      card.style.setProperty("--tilt-my", `${pointerY - rect.top}px`);
      card.style.setProperty("--tilt-rx", `${-normalizedY * MAX_TILT}deg`);
      card.style.setProperty("--tilt-ry", `${normalizedX * MAX_TILT}deg`);
      card.style.setProperty("--tilt-tx", `${normalizedX * MAGNET_STRENGTH}px`);
      card.style.setProperty("--tilt-ty", `${normalizedY * MAGNET_STRENGTH}px`);
      card.style.setProperty("--tilt-tz", `${LIFT_Z}px`);
      card.style.setProperty("--tilt-sx", `${-normalizedX * SHADOW_INTENSITY}px`);
      card.style.setProperty("--tilt-sy", `${-normalizedY * SHADOW_INTENSITY}px`);
      card.classList.add("is-tilting");
    };

    const reset = () => {
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      card.classList.remove("is-tilting");
      card.style.setProperty("--tilt-mx", "50%");
      card.style.setProperty("--tilt-my", "50%");
      card.style.setProperty("--tilt-rx", "0deg");
      card.style.setProperty("--tilt-ry", "0deg");
      card.style.setProperty("--tilt-tx", "0px");
      card.style.setProperty("--tilt-ty", "0px");
      card.style.setProperty("--tilt-tz", "0px");
      card.style.setProperty("--tilt-sx", "0px");
      card.style.setProperty("--tilt-sy", "0px");
    };

    const onMove = (event) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (!frame) frame = requestAnimationFrame(render);
    };

    card.addEventListener("mousemove", onMove, { passive: true });
    card.addEventListener("mouseleave", reset, { passive: true });

    cleanups.push(() => {
      if (frame) cancelAnimationFrame(frame);
      card.removeEventListener("mousemove", onMove);
      card.removeEventListener("mouseleave", reset);
      glow.remove();
      borderLight.remove();
    });
  });

  window.addEventListener("pagehide", () => {
    cleanups.forEach((cleanup) => cleanup());
  }, { once: true });
})();
