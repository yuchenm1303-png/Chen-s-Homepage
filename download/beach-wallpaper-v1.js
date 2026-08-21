(() => {
  const ASSET_VERSION = "20260821-1245";
  const STYLE_ID = "beach-wallpaper-v1-style";
  const STYLE_URL = `./beach-wallpaper-v1.css?v=${ASSET_VERSION}`;

  const WALLPAPERS = [
    {
      id: "day",
      src: `./wallpaper-day-hq-v2.webp?v=${ASSET_VERSION}`,
      positionX: "54%",
      mobilePositionX: "54%",
      veilTop: ".30",
      veilBottom: ".47"
    },
    {
      id: "dusk",
      src: `./wallpaper-dusk-hq-v2.webp?v=${ASSET_VERSION}`,
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
    if (existing) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const link = document.createElement("link");
      link.id = STYLE_ID;
      link.rel = "stylesheet";
      link.href = STYLE_URL;
      link.onload = resolve;
      link.onerror = reject;
      document.head.appendChild(link);
    });
  }

  function preloadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.fetchPriority = "high";
      image.onload = () => resolve(src);
      image.onerror = reject;
      image.src = src;
    });
  }

  async function mountWallpaper() {
    const cosmos = document.querySelector(".cosmos");
    if (!cosmos || cosmos.querySelector(".beach-wallpaper")) return;

    try {
      await ensureStylesheet();
    } catch (error) {
      console.warn("[wallpaper] stylesheet failed to load", error);
      return;
    }

    const start = randomIndex(WALLPAPERS.length);
    const choices = [WALLPAPERS[start], WALLPAPERS[(start + 1) % WALLPAPERS.length]];
    let selected = null;

    for (const item of choices) {
      try {
        await preloadImage(item.src);
        selected = item;
        break;
      } catch (error) {
        console.warn(`[wallpaper] failed to load ${item.id}`, error);
      }
    }

    if (!selected) return;

    const layer = document.createElement("div");
    layer.className = "beach-wallpaper";
    layer.dataset.wallpaper = selected.id;
    layer.style.setProperty("--beach-image", `url("${selected.src}")`);
    layer.style.setProperty("--beach-position-x", selected.positionX);
    layer.style.setProperty("--beach-position-mobile-x", selected.mobilePositionX);
    layer.style.setProperty("--beach-veil-top", selected.veilTop);
    layer.style.setProperty("--beach-veil-bottom", selected.veilBottom);
    cosmos.prepend(layer);

    let frame = 0;
    const update = () => {
      frame = 0;
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const progress = Math.min(1, Math.max(0, window.scrollY / maxScroll));
      layer.style.setProperty("--beach-pan-y", `${(progress * 100).toFixed(3)}%`);
    };

    const scheduleUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate, { passive: true });
    update();

    window.requestAnimationFrame(() => {
      document.body.classList.add("beach-wallpaper-active");
      cosmos.classList.add("beach-wallpaper-active");
      layer.classList.add("is-ready");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void mountWallpaper(), { once: true });
  } else {
    void mountWallpaper();
  }
})();
