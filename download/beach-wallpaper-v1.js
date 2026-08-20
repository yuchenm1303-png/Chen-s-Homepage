(() => {
  const STYLE_ID = "beach-wallpaper-v1-style";
  const STYLE_URL = "./beach-wallpaper-v1.css?v=20260820-1816";

  const WALLPAPERS = [
    {
      id: "day",
      parts: ["./wallpaper-day-v1.part-a", "./wallpaper-day-v1.part-b"],
      positionX: "54%",
      mobilePositionX: "54%",
      veilTop: ".30",
      veilBottom: ".47"
    },
    {
      id: "dusk",
      src: "./wallpaper-dusk-v1.webp",
      positionX: "58%",
      mobilePositionX: "58%",
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
    layer.style.setProperty("--beach-position-x", selected.positionX);
    layer.style.setProperty("--beach-position-mobile-x", selected.mobilePositionX);
    layer.style.setProperty("--beach-veil-top", selected.veilTop);
    layer.style.setProperty("--beach-veil-bottom", selected.veilBottom);
    cosmos.prepend(layer);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const root = document.documentElement;
    let frame = 0;

    const renderParallax = () => {
      frame = 0;
      if (reducedMotion.matches) {
        layer.style.setProperty("--beach-pan-y", "0%");
        return;
      }

      const maxScroll = Math.max(1, root.scrollHeight - window.innerHeight);
      const progress = Math.min(1, Math.max(0, window.scrollY / maxScroll));
      layer.style.setProperty("--beach-pan-y", `${(progress * 100).toFixed(3)}%`);
    };

    const scheduleParallax = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(renderParallax);
    };

    window.addEventListener("scroll", scheduleParallax, { passive: true });
    window.addEventListener("resize", scheduleParallax, { passive: true });
    reducedMotion.addEventListener?.("change", scheduleParallax);

    const resizeObserver = "ResizeObserver" in window
      ? new ResizeObserver(scheduleParallax)
      : null;
    resizeObserver?.observe(document.body);

    renderParallax();

    window.requestAnimationFrame(() => {
      cosmos.classList.add("beach-wallpaper-active");
      layer.classList.add("is-ready");
    });

    window.addEventListener("pagehide", () => {
      resizeObserver?.disconnect();
      if (resolved.revoke) URL.revokeObjectURL(resolved.src);
    }, { once: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void mountWallpaper(), { once: true });
  } else {
    void mountWallpaper();
  }
})();
