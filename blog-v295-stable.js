(() => {
  'use strict';

  const BaseRenderer = window.BlogGlassRenderer;

  if (typeof BaseRenderer !== 'function') {
    console.error('[Blog glass] Base renderer did not load; CSS fallback will be used.');
    window.BlogGlassRenderer = class BlogGlassFallbackRenderer {
      constructor(canvas) {
        this.reader = canvas?.parentElement || null;
      }
      initialise() {
        this.reader?.classList.add('glass-fallback');
        return false;
      }
      bind() {}
      start() {}
      stop() {}
    };
    return;
  }

  class StableBlogGlassRenderer extends BaseRenderer {
    constructor(...args) {
      super(...args);
      this.initialised = false;
      this.failed = false;
      this.lastFailure = null;
      this.boundContextLost = (event) => {
        event.preventDefault();
        this.activateFallback(new Error('WebGL context lost'));
      };
    }

    initialise() {
      if (this.initialised && !this.failed) return true;
      if (this.failed) return false;

      try {
        const ok = super.initialise();
        if (!ok) {
          this.activateFallback(new Error('WebGL or shader initialisation unavailable'));
          return false;
        }

        this.initialised = true;
        this.glCanvas?.addEventListener('webglcontextlost', this.boundContextLost, false);
        return true;
      } catch (error) {
        this.activateFallback(error);
        return false;
      }
    }

    ensureOpticalCanvasAttached() {
      if (!this.opticalCanvas || !this.reader) return false;
      if (!this.opticalCanvas.isConnected) {
        const stage = this.reader.querySelector('.article-reader-stage');
        this.reader.insertBefore(this.opticalCanvas, stage || null);
      }
      return true;
    }

    bind(mainElement, controlElements) {
      if (!this.initialised || this.failed) return;
      try {
        this.ensureOpticalCanvasAttached();
        super.bind(mainElement, controlElements);
      } catch (error) {
        this.activateFallback(error);
      }
    }

    start() {
      if (!this.initialised || this.failed) return;
      try {
        this.ensureOpticalCanvasAttached();
        super.start();
      } catch (error) {
        this.activateFallback(error);
      }
    }

    /*
     * The original renderer removes opticalCanvas on every close. The same
     * renderer instance is reused by blog.js, so later article opens had no
     * visible compositor. Stop the observers and clear the canvas, but keep
     * the compositor mounted for the next open.
     */
    stop() {
      this.running = false;
      cancelAnimationFrame(this.frame);
      this.frame = 0;
      removeEventListener('resize', this.boundSchedule);
      this.resizeObserver?.disconnect();
      this.classObserver?.disconnect();

      this.targets?.forEach((element) => {
        element.classList.remove('v295-exact-host');
        element.style.background = '';
      });
      this.targets = [];

      if (this.opticalContext && this.opticalCanvas) {
        this.opticalContext.setTransform(1, 0, 0, 1, 0, 0);
        this.opticalContext.clearRect(0, 0, this.opticalCanvas.width, this.opticalCanvas.height);
      }

      this.reader?.classList.remove('v295-ready');
      this.needsBackdrop = true;
    }

    schedule(rebuildBackdrop) {
      if (this.failed) return;
      if (!this.running && !rebuildBackdrop) return;
      if (rebuildBackdrop) this.needsBackdrop = true;

      cancelAnimationFrame(this.frame);
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        if (document.hidden || this.reader?.hidden || this.failed) return;

        try {
          this.ensureOpticalCanvasAttached();
          if (this.needsBackdrop) {
            super.rebuildBackdrop();
            this.needsBackdrop = false;
          }
          super.renderAll();
          this.reader?.classList.add('v295-ready');
          this.reader?.classList.remove('glass-fallback');
        } catch (error) {
          this.activateFallback(error);
        }
      });
    }

    activateFallback(error) {
      if (this.failed) return;
      this.failed = true;
      this.lastFailure = error;
      this.running = false;
      cancelAnimationFrame(this.frame);
      this.frame = 0;
      removeEventListener('resize', this.boundSchedule);
      this.resizeObserver?.disconnect();
      this.classObserver?.disconnect();

      this.targets?.forEach((element) => {
        element.classList.remove('v295-exact-host');
        element.style.background = '';
      });
      this.targets = [];

      if (this.opticalContext && this.opticalCanvas) {
        this.opticalContext.setTransform(1, 0, 0, 1, 0, 0);
        this.opticalContext.clearRect(0, 0, this.opticalCanvas.width, this.opticalCanvas.height);
      }

      this.reader?.classList.remove('v295-ready');
      this.reader?.classList.add('glass-fallback');
      console.error('[Blog glass] Switched to stable CSS fallback.', error);
    }
  }

  window.BlogGlassRenderer = StableBlogGlassRenderer;
})();
