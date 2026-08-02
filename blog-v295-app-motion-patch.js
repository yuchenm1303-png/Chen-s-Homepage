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
