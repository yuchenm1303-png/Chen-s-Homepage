(() => {
  const root = document.documentElement;
  const src = root.dataset.wallpaperSrc;
  const layer = document.querySelector(".beach-wallpaper");
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
    window.requestAnimationFrame(revealContent);
  };

  if (!src || !layer) {
    revealContent();
    return;
  }

  const image = new Image();
  image.decoding = "async";
  image.fetchPriority = "high";

  const decodeAndReveal = async () => {
    if (decodeStarted) return;
    decodeStarted = true;
    try {
      if (typeof image.decode === "function") await image.decode();
    } catch (_) {
      // A completed image can still be safely shown when decode() rejects.
    }
    if (image.naturalWidth > 0) revealWallpaper();
    else revealContent();
  };

  image.addEventListener("load", () => void decodeAndReveal(), { once: true });
  image.addEventListener("error", revealContent, { once: true });
  image.src = src;

  if (image.complete && image.naturalWidth > 0) void decodeAndReveal();

  window.setTimeout(revealContent, 8000);
})();
