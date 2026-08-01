(() => {
  'use strict';

  const BaseRenderer = window.BlogGlassRenderer;
  const LegacyEngine = window.BlogLegacyGlassEngine;
  if (!BaseRenderer || !LegacyEngine) return;

  class IntegratedBlogGlassRenderer extends BaseRenderer {
    constructor(canvas) {
      super(canvas);
      this.legacyEngine = new LegacyEngine();
      this.legacyReady = false;
    }

    initialise() {
      const shellReady = super.initialise();
      if (!shellReady) return false;
      this.legacyReady = this.legacyEngine.initialise();
      return true;
    }

    bind(mainElement, controlElements) {
      super.bind(mainElement, controlElements);
      if (this.legacyReady) {
        this.legacyEngine.bind(controlElements, () => this.requestRender());
      }
    }

    stop() {
      if (this.legacyReady) this.legacyEngine.detach();
      super.stop();
    }

    tick(time) {
      this.frame = 0;
      if (!this.running || document.hidden) return;
      const delta = Math.min(0.05, Math.max(0.001, (time - this.lastFrameTime) / 1000));
      this.lastFrameTime = time;
      const shellActive = this.updateStateAnimations(this.shellState, time, delta);
      const legacyActive = this.legacyReady ? this.legacyEngine.update(time, delta) : false;
      this.applyShellTransform();
      const active = shellActive || legacyActive;
      if (this.dirty || active) {
        this.dirty = false;
        this.renderAll();
      }
      if (active || this.dirty) this.frame = requestAnimationFrame(this.boundTick);
    }

    rebuildBackdrop() {
      super.rebuildBackdrop();
      if (this.legacyReady) this.legacyEngine.textureSource = null;
    }

    renderAll() {
      super.renderAll();
      if (this.legacyReady) {
        this.legacyEngine.render(
          this.output,
          this.dpr,
          this.rootWidth,
          this.rootHeight,
          this.mediumCanvas,
        );
      }
    }
  }

  window.BlogGlassRenderer = IntegratedBlogGlassRenderer;
})();
