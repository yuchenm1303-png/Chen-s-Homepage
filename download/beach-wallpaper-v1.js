(() => {
  const STYLE_ID = "beach-wallpaper-v1-style";
  const STYLE_URL = "./beach-wallpaper-v1.css?v=20260820-1752";
  const PARALLAX_SPEED = 0.14;

  const WALLPAPERS = [
    {
      id: "day",
      parts: ["./wallpaper-day-v1.part-a", "./wallpaper-day-v1.part-b"],
      position: "54% 0%",
      mobilePosition: "54% 0%",
      veilTop: ".30",
      veilBottom: ".47"
    },
    {
      id: "dusk",
      src: "./wallpaper-dusk-v1.webp",
      position: "58% 0%",
      mobilePosition: "58% 0%",
      veilTop: ".19",
      veilBottom: ".34"
    }
  ];

  function randomIndex(length) {
    if (globalThis.crypto?.getRandomValues) {
      const value = new Uint32Array(1);
      globalThis.crypto.getRandomValues(value);
      return Math.floor((value[0] / 0x100000000) * length);
    }
    return Math.floor(Math.random() * length);
  }

  function ensureStylesheet() {
    const existing = document.getElementById(STYLE_ID);
    if (existing) {
      if (existing.dataset.loaded === "true") return Promise.resolve();
      return new Promise((resolve, reject) => {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
      });
    }

    return new Promise((resolve, reject) => {
      const link = document.createElement("link");
      link.id = STYLE_ID;
      link.rel = "stylesheet";
      link.href = STYLE_URL;
      link.addEventListener("load", () => {
        link.dataset.loaded = "true";
        resolve();
      }, { once: true });
      link.addEventListener("error", reject, { once: true });
      document.head.appendChild(link);
    });
  }

  async function resolveSource(choice) {
    if (choice.src) return { src: choice.src, revoke: false };

    const responses = await Promise.all(
      choice.parts.map((url) => fetch(url, { cache: "force-cache" }))
    );
    if (responses.some((response) => !response.ok)) {
      throw new Error(`wallpaper parts unavailable: ${choice.id}`);
    }

    const buffers = await Promise.all(responses.map((response) => response.arrayBuffer()));
    return {
      src: URL.createObjectURL(new Blob(buffers, { type: "image/webp" })),
      revoke: true
    };
  }

  function preloadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = resolve;
      image.onerror = reject;
      image.src = src;
    });
  }

  async function loadChoice(choice) {
    const resolved = await resolveSource(choice);
    try {
      await preloadImage(resolved.src);
      return resolved;
    } catch (error) {
      if (resolved.revoke) URL.revokeObjectURL(resolved.src);
      throw error;
    }
  }

  async function mountWallpaper() {
    const cosmos = document.querySelector(".cosmos");
    if (!cosmos || cosmos.querySelector(".beach-wallpaper")) return;

    try {
      await ensureStylesheet();
    } catch (error) {
      console.warn("[wallpaper] stylesheet unavailable", error);
      return;
    }

    const firstIndex = randomIndex(WALLPAPERS.length);
    const choices = [WALLPAPERS[firstIndex], WALLPAPERS[(firstIndex + 1) % WALLPAPERS.length]];

    let selected = null;
    let resolved = null;
    for (const choice of choices) {
      try {
        resolved = await loadChoice(choice);
        selected = choice;
        break;
      } catch (error) {
        console.warn(`[wallpaper] unable to load ${choice.id}`, error);
      }
    }
    if (!selected || !resolved) return;

    const layer = document.createElement("div");
    layer.className = "beach-wallpaper";
    layer.dataset.wallpaper = selected.id;
    layer.style.setProperty("--beach-image", `url("${resolved.src}")`);
    layer.style.setProperty("--beach-position", selected.position);
    layer.style.setProperty("--beach-position-mobile", selected.mobilePosition);
    layer.style.setProperty("--beach-veil-top", selected.veilTop);
    layer.style.setProperty("--beach-veil-bottom", selected.veilBottom);
    cosmos.prepend(layer);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;

    const renderParallax = () => {
      frame = 0;
      const overscan = Math.max(0, layer.offsetHeight - window.innerHeight);
      const offset = reducedMotion.matches
        ? 0
        : -Math.min(overscan, Math.max(0, window.scrollY) * PARALLAX_SPEED);
      layer.style.setProperty("--beach-parallax-y", `${offset.toFixed(1)}px`);
    };

    const scheduleParallax = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(renderParallax);
    };

    window.addEventListener("scroll", scheduleParallax, { passive: true });
    window.addEventListener("resize", scheduleParallax, { passive: true });
    reducedMotion.addEventListener?.("change", scheduleParallax);
    renderParallax();

    window.requestAnimationFrame(() => {
      cosmos.classList.add("beach-wallpaper-active");
      layer.classList.add("is-ready");
    });

    if (resolved.revoke) {
      window.addEventListener("pagehide", () => URL.revokeObjectURL(resolved.src), { once: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void mountWallpaper(), { once: true });
  } else {
    void mountWallpaper();
  }
})();
