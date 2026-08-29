(() => {
  const root = document.documentElement;
  const src = root.dataset.wallpaperSrc;
  const layer = document.querySelector(".beach-wallpaper");
  const normalizedPath = window.location.pathname.replace(/\/+$/, "");
  const isDownloadPage = normalizedPath === "/download" || normalizedPath.endsWith("/download/index.html");
  let contentRevealed = false;
  let decodeStarted = false;

  const revealContent = () => {
    if (contentRevealed) return;
    contentRevealed = true;
    root.classList.remove("wallpaper-pending");
    root.classList.add("wallpaper-ready");
  };

  const revealWallpaper = () => {
    if (layer) layer.classList.add("is-ready");
  };

  if (!src || !layer) {
    revealContent();
    return;
  }

  const image = new Image();
  image.decoding = "async";
  image.fetchPriority = "high";

  // The download page must never wait on a multi-megabyte wallpaper before
  // becoming usable. Show the page immediately, then reveal the wallpaper
  // only after the browser reports the image fully loaded. Avoid decode() here:
  // several mobile WebViews can delay or reject it even after the image loaded.
  if (isDownloadPage) {
    revealContent();

    const revealLoadedWallpaper = () => {
      if (image.naturalWidth > 0) revealWallpaper();
    };

    image.addEventListener("load", revealLoadedWallpaper, { once: true });
    image.src = src;
    if (image.complete && image.naturalWidth > 0) revealLoadedWallpaper();
    return;
  }

  const revealWallpaperAndContent = () => {
    revealWallpaper();
    window.requestAnimationFrame(revealContent);
  };

  const decodeAndReveal = async () => {
    if (decodeStarted) return;
    decodeStarted = true;
    try {
      if (typeof image.decode === "function") await image.decode();
    } catch (_) {
      // A completed image can still be safely shown when decode() rejects.
    }
    if (image.naturalWidth > 0) revealWallpaperAndContent();
    else revealContent();
  };

  image.addEventListener("load", () => void decodeAndReveal(), { once: true });
  image.addEventListener("error", revealContent, { once: true });
  image.src = src;

  if (image.complete && image.naturalWidth > 0) void decodeAndReveal();

  window.setTimeout(revealContent, 8000);
})();
