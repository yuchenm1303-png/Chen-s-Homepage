(() => {
  'use strict';

  const Renderer = window.BlogGlassRenderer;
  if (typeof Renderer !== 'function' || Renderer.prototype.__clarityBlendInstalled) return;
  Renderer.prototype.__clarityBlendInstalled = true;

  const CLEAR_SCENE_MIX = 0.82;

  const originalRebuildBackdrop = Renderer.prototype.rebuildBackdrop;
  Renderer.prototype.rebuildBackdrop = function rebuildSharperBackdrop() {
    originalRebuildBackdrop.call(this);

    if (!this.blurContext || !this.blurCanvas || !this.colorCanvas) return;

    /*
     * Keep a small amount of the Gaussian result to prevent hard banding,
     * then blend most of the full-resolution scene back into the texture used
     * by both gb and gl. This restores stars and colour detail without touching
     * the V29.5 refraction or shoulder material.
     */
    this.blurContext.save();
    this.blurContext.setTransform(1, 0, 0, 1, 0, 0);
    this.blurContext.globalCompositeOperation = 'source-over';
    this.blurContext.globalAlpha = CLEAR_SCENE_MIX;
    this.blurContext.imageSmoothingEnabled = true;
    try { this.blurContext.imageSmoothingQuality = 'high'; } catch (_) {}
    this.blurContext.filter = 'none';
    this.blurContext.drawImage(
      this.colorCanvas,
      0,
      0,
      this.rootWidth,
      this.rootHeight,
    );
    this.blurContext.restore();

    this.backdropRevision += 1;
  };
})();
