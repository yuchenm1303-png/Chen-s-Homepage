(() => {
  'use strict';

  const Renderer = window.BlogGlassRenderer;
  if (typeof Renderer !== 'function' || Renderer.prototype.__gaussianBackdropInstalled) return;
  Renderer.prototype.__gaussianBackdropInstalled = true;

  const DOWNSAMPLE = 2;
  const BLUR_RADIUS_CSS_PX = 3.2;
  const NOISE_ALPHA = 0.006;

  const sizeCanvas = (canvas, width, height) => {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
  };

  const resetContext = (context) => {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.imageSmoothingEnabled = true;
    try { context.imageSmoothingQuality = 'high'; } catch (_) {}
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
    context.filter = 'none';
  };

  const rgba = (red, green, blue, alpha) => `rgba(${red},${green},${blue},${alpha})`;

  const createNoiseTile = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 96;
    const context = canvas.getContext('2d');
    if (!context) return null;

    const image = context.createImageData(canvas.width, canvas.height);
    let seed = 0x9e3779b9;
    const random = () => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return (seed >>> 0) / 4294967296;
    };

    for (let index = 0; index < image.data.length; index += 4) {
      const value = Math.round(112 + random() * 32);
      image.data[index] = value;
      image.data[index + 1] = value;
      image.data[index + 2] = value;
      image.data[index + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    return canvas;
  };

  const noiseTile = createNoiseTile();

  const drawBackdrop = (context, width, height, pixelRatio) => {
    resetContext(context);
    context.clearRect(0, 0, width, height);

    const vertical = context.createLinearGradient(0, 0, 0, height);
    vertical.addColorStop(0, '#10061e');
    vertical.addColorStop(0.16, '#24102f');
    vertical.addColorStop(0.32, '#47214e');
    vertical.addColorStop(0.48, '#373052');
    vertical.addColorStop(0.64, '#26345f');
    vertical.addColorStop(0.82, '#142447');
    vertical.addColorStop(1, '#08142f');
    context.fillStyle = vertical;
    context.fillRect(0, 0, width, height);

    const glow = (x, y, radius, red, green, blue, alpha) => {
      const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, rgba(red, green, blue, alpha));
      gradient.addColorStop(0.28, rgba(red, green, blue, alpha * 0.82));
      gradient.addColorStop(0.58, rgba(red, green, blue, alpha * 0.42));
      gradient.addColorStop(0.82, rgba(red, green, blue, alpha * 0.13));
      gradient.addColorStop(1, rgba(red, green, blue, 0));
      context.fillStyle = gradient;
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    };

    glow(width * 0.20, height * 0.20, width * 0.48, 235, 82, 175, 0.29);
    glow(width * 0.82, height * 0.25, width * 0.47, 65, 190, 238, 0.24);
    glow(width * 0.52, height * 0.56, width * 0.43, 142, 87, 216, 0.18);

    let state = 20260801;
    const random = () => {
      state += 0x6D2B79F5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
    const palette = ['#ff81c6', '#78eaff', '#b891ff', '#ffd36a', '#8ef1c8'];

    for (let index = 0; index < 82; index += 1) {
      const x = random() * width;
      const y = random() * height;
      const radius = (0.55 + random() * 1.18) * pixelRatio;
      const colour = palette[Math.floor(random() * palette.length)];
      context.globalAlpha = 0.30 + random() * 0.56;
      context.fillStyle = colour;
      context.shadowColor = colour;
      context.shadowBlur = 3.5 * pixelRatio;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }

    context.shadowBlur = 0;
    context.globalAlpha = 1;
  };

  Renderer.prototype.rebuildBackdrop = function rebuildGaussianBackdrop() {
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.rootWidth = Math.max(1, Math.round(this.reader.clientWidth * this.pixelRatio));
    this.rootHeight = Math.max(1, Math.round(this.reader.clientHeight * this.pixelRatio));

    sizeCanvas(this.backgroundCanvas, this.rootWidth, this.rootHeight);
    sizeCanvas(this.sourceCanvas, this.rootWidth, this.rootHeight);
    sizeCanvas(this.colorCanvas, this.rootWidth, this.rootHeight);
    sizeCanvas(this.blurCanvas, this.rootWidth, this.rootHeight);

    const smallWidth = Math.max(1, Math.ceil(this.rootWidth / DOWNSAMPLE));
    const smallHeight = Math.max(1, Math.ceil(this.rootHeight / DOWNSAMPLE));
    sizeCanvas(this.blurA, smallWidth, smallHeight);
    sizeCanvas(this.blurB, smallWidth, smallHeight);

    this.backgroundCanvas.style.width = `${this.reader.clientWidth}px`;
    this.backgroundCanvas.style.height = `${this.reader.clientHeight}px`;

    drawBackdrop(this.backgroundContext, this.rootWidth, this.rootHeight, this.pixelRatio);
    drawBackdrop(this.sourceContext, this.rootWidth, this.rootHeight, this.pixelRatio);

    resetContext(this.colorContext);
    this.colorContext.clearRect(0, 0, this.rootWidth, this.rootHeight);
    this.colorContext.save();
    this.colorContext.filter = 'brightness(1.1424) contrast(1.0242) saturate(1.112)';
    this.colorContext.drawImage(this.sourceCanvas, 0, 0, this.rootWidth, this.rootHeight);
    this.colorContext.restore();

    /* One high-quality reduction replaces the old repeated 8-bit lighter blend. */
    resetContext(this.blurAContext);
    this.blurAContext.clearRect(0, 0, smallWidth, smallHeight);
    this.blurAContext.drawImage(
      this.colorCanvas,
      0,
      0,
      this.rootWidth,
      this.rootHeight,
      0,
      0,
      smallWidth,
      smallHeight,
    );

    /* A light Gaussian pass retains the original scene clarity. */
    resetContext(this.blurBContext);
    this.blurBContext.clearRect(0, 0, smallWidth, smallHeight);
    this.blurBContext.drawImage(this.blurA, 0, 0, smallWidth, smallHeight);
    const reducedBlurRadius = Math.max(
      1,
      (BLUR_RADIUS_CSS_PX * this.pixelRatio) / DOWNSAMPLE,
    );
    this.blurBContext.save();
    this.blurBContext.filter = `blur(${reducedBlurRadius}px)`;
    this.blurBContext.drawImage(this.blurA, 0, 0, smallWidth, smallHeight);
    this.blurBContext.restore();

    /* A single high-quality enlargement produces the texture used by gb and gl. */
    resetContext(this.blurContext);
    this.blurContext.clearRect(0, 0, this.rootWidth, this.rootHeight);
    this.blurContext.drawImage(
      this.blurB,
      0,
      0,
      smallWidth,
      smallHeight,
      0,
      0,
      this.rootWidth,
      this.rootHeight,
    );

    /* Subtle neutral dither breaks residual 8-bit gradient bands without grain. */
    if (noiseTile) {
      const pattern = this.blurContext.createPattern(noiseTile, 'repeat');
      if (pattern) {
        this.blurContext.save();
        this.blurContext.globalCompositeOperation = 'soft-light';
        this.blurContext.globalAlpha = NOISE_ALPHA;
        this.blurContext.fillStyle = pattern;
        this.blurContext.fillRect(0, 0, this.rootWidth, this.rootHeight);
        this.blurContext.restore();
      }
    }

    this.backdropRevision += 1;
  };
})();
