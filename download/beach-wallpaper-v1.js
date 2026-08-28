(() => {
  const ASSET_VERSION = "20260825-1540";
  const STYLE_ID = "beach-wallpaper-v1-style";
  const STYLE_URL = `./beach-wallpaper-v1.css?v=${ASSET_VERSION}`;
  const pageWallpaperSrc = document.documentElement.dataset.wallpaperSrc || "";
  const pageWallpaperId = document.documentElement.dataset.wallpaperId || "page-wallpaper";
  const pageWallpaperParts = pageWallpaperId === "beach-blue"
    ? [
        "./wallpaper-beach-blue-v1.part1.b64?v=20260828-0915",
        "./wallpaper-beach-blue-v1.part2.b64?v=20260828-0915",
        "./wallpaper-beach-blue-v1.part3.b64?v=20260828-0915"
      ]
    : [];
  const WALLPAPER = pageWallpaperSrc || pageWallpaperParts.length
    ? {
        id: pageWallpaperId,
        src: pageWallpaperSrc,
        parts: pageWallpaperParts,
        positionX: "54%",
        mobilePositionX: "57%",
        veilTop: ".17",
        veilBottom: ".28"
      }
    : {
        id: "rain-anime",
        src: `./wallpaper-rain-anime-v1.png?v=${ASSET_VERSION}`,
        parts: [],
        positionX: "54%",
        mobilePositionX: "57%",
        veilTop: ".17",
        veilBottom: ".28"
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

  async function resolveWallpaperSource() {
    if (!WALLPAPER.parts.length) return WALLPAPER.src;

    const chunks = await Promise.all(
      WALLPAPER.parts.map(async (url) => {
        const response = await fetch(url, { cache: "force-cache" });
        if (!response.ok) throw new Error(`wallpaper source ${response.status}`);
        return (await response.text()).trim();
      })
    );

    const binary = atob(chunks.join(""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: "image/webp" }));
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

    let wallpaperSrc;
    try {
      wallpaperSrc = await resolveWallpaperSource();
      await preloadImage(wallpaperSrc);
    } catch (error) {
      console.warn(`[wallpaper] failed to load ${WALLPAPER.id}`, error);
      return;
    }

    const layer = document.createElement("div");
    layer.className = "beach-wallpaper";
    layer.dataset.wallpaper = WALLPAPER.id;
    layer.style.setProperty("--beach-image", `url("${wallpaperSrc}")`);
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
