(() => {
  'use strict';

  const Renderer = window.BlogGlassRenderer;
  if (typeof Renderer !== 'function' || Renderer.prototype.__antiBandingBlurInstalled) return;
  Renderer.prototype.__antiBandingBlurInstalled = true;

  const noiseTile = document.createElement('canvas');
  noiseTile.width = 64;
  noiseTile.height = 64;
  const noiseContext = noiseTile.getContext('2d');
  const noiseImage = noiseContext.createImageData(noiseTile.width, noiseTile.height);

  let seed = 0x6d2b79f5;
  const random = () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };

  for (let index = 0; index < noiseImage.data.length; index += 4) {
    const value = random() < 0.5 ? 72 : 184;
    noiseImage.data[index] = value;
    noiseImage.data[index + 1] = value;
    noiseImage.data[index + 2] = value;
    noiseImage.data[index + 3] = 255;
  }
  noiseContext.putImageData(noiseImage, 0, 0);

  const originalRebuildBackdrop = Renderer.prototype.rebuildBackdrop;
  Renderer.prototype.rebuildBackdrop = function rebuildBackdropWithAntiBanding() {
    originalRebuildBackdrop.call(this);

    const width = this.rootWidth;
    const height = this.rootHeight;
    if (!width || !height || !this.blurA || !this.blurAContext || !this.blurCanvas || !this.blurContext) {
      return;
    }

    /*
     * The existing shift-average blur is retained for visual compatibility,
     * then followed by one real Gaussian-style browser blur pass. This removes
     * the small plateaus produced by repeated 8-bit offset accumulation.
     */
    const finishingRadius = Math.max(0.7, Math.min(1.7, 0.72 * (this.pixelRatio || 1)));

    this.blurAContext.setTransform(1, 0, 0, 1, 0, 0);
    this.blurAContext.clearRect(0, 0, width, height);
    this.blurAContext.imageSmoothingEnabled = true;
    try { this.blurAContext.imageSmoothingQuality = 'high'; } catch (_) {}
    this.blurAContext.filter = `blur(${finishingRadius}px)`;
    this.blurAContext.drawImage(this.blurCanvas, 0, 0, width, height);
    this.blurAContext.filter = 'none';

    this.blurContext.setTransform(1, 0, 0, 1, 0, 0);
    this.blurContext.clearRect(0, 0, width, height);
    this.blurContext.imageSmoothingEnabled = true;
    try { this.blurContext.imageSmoothingQuality = 'high'; } catch (_) {}
    this.blurContext.drawImage(this.blurA, 0, 0, width, height);

    /*
     * A nearly invisible neutral texture is applied before WebGL sampling.
     * It prevents broad dark gradients from collapsing into identical 8-bit
     * values. The shader adds a second sub-LSB dither at final output.
     */
    const pattern = this.blurContext.createPattern(noiseTile, 'repeat');
    if (pattern) {
      this.blurContext.save();
      this.blurContext.globalCompositeOperation = 'soft-light';
      this.blurContext.globalAlpha = 0.012;
      this.blurContext.fillStyle = pattern;
      this.blurContext.fillRect(0, 0, width, height);
      this.blurContext.restore();
    }

    this.backdropRevision += 1;
  };
})();
