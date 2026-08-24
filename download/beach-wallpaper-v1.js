(() => {
  const ASSET_VERSION = "20260824-1650";
  const STYLE_ID = "beach-wallpaper-v1-style";
  const STYLE_URL = `./beach-wallpaper-v1.css?v=${ASSET_VERSION}`;
  const WALLPAPER = {
    id: "soft-blue",
    src: `./wallpaper-soft-blue-v1.webp?v=${ASSET_VERSION}`,
    positionX: "50%",
    mobilePositionX: "58%",
    veilTop: ".05",
    veilBottom: ".12"
  };

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

    try {
      await preloadImage(WALLPAPER.src);
    } catch (error) {
      console.warn(`[wallpaper] failed to load ${WALLPAPER.id}`, error);
      return;
    }

    const layer = document.createElement("div");
    layer.className = "beach-wallpaper";
    layer.dataset.wallpaper = WALLPAPER.id;
    layer.style.setProperty("--beach-image", `url("${WALLPAPER.src}")`);
    layer.style.setProperty("--beach-position-x", WALLPAPER.positionX);
    layer.style.setProperty("--beach-position-mobile-x", WALLPAPER.mobilePositionX);
    layer.style.setProperty("--beach-veil-top", WALLPAPER.veilTop);
    layer.style.setProperty("--beach-veil-bottom", WALLPAPER.veilBottom);
    cosmos.prepend(layer);

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
