(() => {
  'use strict';

  const Renderer = window.BlogGlassRenderer;
  if (!Renderer?.prototype) return;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function cubicBezier(x1, y1, x2, y2) {
    const cx = 3 * x1;
    const bx = 3 * (x2 - x1) - cx;
    const ax = 1 - cx - bx;
    const cy = 3 * y1;
    const by = 3 * (y2 - y1) - cy;
    const ay = 1 - cy - by;

    const sampleX = (t) => ((ax * t + bx) * t + cx) * t;
    const sampleY = (t) => ((ay * t + by) * t + cy) * t;
    const sampleDerivativeX = (t) => (3 * ax * t + 2 * bx) * t + cx;

    return (progress) => {
      const x = clamp(progress, 0, 1);
      let t = x;
      for (let index = 0; index < 8; index += 1) {
        const derivative = sampleDerivativeX(t);
        if (Math.abs(derivative) < 1e-7) break;
        t = clamp(t - (sampleX(t) - x) / derivative, 0, 1);
      }
      return sampleY(t);
    };
  }

  const fastOutSlowIn = cubicBezier(0.40, 0.00, 0.20, 1.00);

  Renderer.prototype.fastEase = function exactFastOutSlowIn() {
    return fastOutSlowIn;
  };

  Renderer.prototype.rebuildBackdrop = function rebuildExactV295Backdrop() {
    const blurConfig = {
      radius: 0.230414746543779,
      iterations: 12,
      brightness: 1.14239631336406,
      contrast: 1.0241935483871,
      saturation: 1.112,
    };

    this.dpr = this.chooseDpr();
    this.rootWidth = Math.max(1, Math.round(innerWidth * this.dpr));
    this.rootHeight = Math.max(1, Math.round(innerHeight * this.dpr));

    [
      this.canvas,
      this.clearCanvas,
      this.v295Color,
      this.v295BlurA,
      this.v295BlurB,
      this.v295Blur,
    ].forEach((canvas) => this.setCanvasSize(canvas, this.rootWidth, this.rootHeight));

    this.canvas.style.width = `${innerWidth}px`;
    this.canvas.style.height = `${innerHeight}px`;

    this.drawBackdrop(this.clearContext, this.rootWidth, this.rootHeight);

    this.prepareContext(this.v295ColorCtx);
    this.v295ColorCtx.clearRect(0, 0, this.rootWidth, this.rootHeight);
    this.v295ColorCtx.save();
    this.v295ColorCtx.filter = `brightness(${blurConfig.brightness}) contrast(${blurConfig.contrast}) saturate(${blurConfig.saturation})`;
    this.v295ColorCtx.drawImage(this.clearCanvas, 0, 0);
    this.v295ColorCtx.restore();

    const effectiveRadius = Math.max(
      0,
      blurConfig.radius * this.dpr * Math.pow(Math.max(1, blurConfig.iterations), 0.55),
    );
    const passes = Math.max(1, Math.min(3, Math.ceil(blurConfig.iterations / 4)));
    const step = Math.max(0.25, effectiveRadius / Math.sqrt(2 * passes));

    let current = this.v295Color;
    for (let index = 0; index < passes; index += 1) {
      this.shiftBlur(this.v295BlurACtx, current, step, true);
      this.shiftBlur(this.v295BlurBCtx, this.v295BlurA, step, false);
      current = this.v295BlurB;
    }

    this.prepareContext(this.v295BlurCtx);
    this.v295BlurCtx.clearRect(0, 0, this.rootWidth, this.rootHeight);
    this.v295BlurCtx.drawImage(current, 0, 0);

    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.v295Texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      this.v295Blur,
    );
    gl.flush();
    this.backdropDirty = false;
  };

  const originalBind = Renderer.prototype.bind;
  Renderer.prototype.bind = function bindWithAppRimFlow(mainElement, controlElements) {
    originalBind.call(this, mainElement, controlElements);

    const state = this.shellState;
    if (!state || !mainElement) return;

    state.rimFlowSeed = 0.50;
    state.rimFlowDirection = 1;
    state.rimFlowBand = 0;
    state.rimFlowStrength = 1;

    const updateRimFlow = (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      state.rimFlowSeed = Math.random();
      state.rimFlowDirection = Math.random() >= 0.5 ? 1 : -1;
      state.rimFlowBand = Math.floor(Math.random() * 4);
      state.rimFlowStrength = 0.86 + Math.random() * 0.52;
      this.requestRender();
    };

    mainElement.addEventListener('pointerdown', updateRimFlow, { passive: true });
    this.cleanup.push(() => mainElement.removeEventListener('pointerdown', updateRimFlow));
  };
})();
