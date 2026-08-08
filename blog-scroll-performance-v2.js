(() => {
  'use strict';

  const BaseRenderer = window.BlogGlassRenderer;
  if (typeof BaseRenderer !== 'function') return;

  const mobileViewport = matchMedia('(max-width: 820px)');
  const HOST_RESELECT_INTERVAL_MS = 72;

  class OptimizedScrollRenderer extends BaseRenderer {
    constructor(...args) {
      super(...args);
      this.__perfHostFrame = 0;
      this.__perfForceReselect = false;
      this.__perfLastReselectAt = 0;
      this.__perfSceneHosts = null;
      this.__perfCards = null;
      this.__perfToolbar = null;
    }

    __perfInvalidateSceneCache() {
      this.__perfSceneHosts = null;
      this.__perfCards = null;
      this.__perfToolbar = null;
    }

    __perfRefreshSceneCache() {
      if (this.__perfSceneHosts) return;
      this.__perfSceneHosts = [...this.reader.querySelectorAll('[data-blog-glass-host]')]
        .filter((element) => element.isConnected);
      this.__perfCards = this.__perfSceneHosts.filter((element) => element.matches('.article-glass-card'));
      this.__perfToolbar = this.reader.querySelector('.article-control-bar');
    }

    collectSceneTargets(mainElement, controlElements) {
      this.__perfRefreshSceneCache();
      const sceneHosts = this.__perfSceneHosts || [];
      if (!sceneHosts.length) {
        return { mainElement, controlElements: [...controlElements] };
      }

      const activeCards = this.collectActiveCards(this.__perfCards || []);
      const toolbar = this.__perfToolbar;

      if (mobileViewport.matches) {
        toolbar?.classList.add('mobile-stable-toolbar');
        return {
          mainElement: activeCards[0] || mainElement,
          controlElements: activeCards.slice(1),
        };
      }

      toolbar?.classList.remove('mobile-stable-toolbar');
      const desktopMain = toolbar || activeCards[0] || mainElement;
      return {
        mainElement: desktopMain,
        controlElements: activeCards.filter((element) => element !== desktopMain),
      };
    }

    // Active hosts are already selected with generous overscan. The previous
    // visibility wrapper performed an extra getBoundingClientRect() for every
    // active host before StandardGlassHost.render() immediately measured it
    // again. Removing that duplicate read cuts layout work without changing the
    // rendered host budget or the optical pipeline.
    optimiseVisibleHosts() {}

    scheduleHostRefresh(force = false) {
      if (force) {
        this.__perfForceReselect = true;
        this.__perfLastReselectAt = 0;
        this.activeElements = null;
        this.__perfInvalidateSceneCache();
      }
      if (this.__perfHostFrame) return;

      this.__perfHostFrame = requestAnimationFrame((now) => {
        this.__perfHostFrame = 0;
        if (!this.lastMainElement || this.reader?.hidden) return;

        const shouldReselect = this.__perfForceReselect
          || !this.activeElements
          || now - this.__perfLastReselectAt >= HOST_RESELECT_INTERVAL_MS;

        if (shouldReselect) {
          this.__perfForceReselect = false;
          this.__perfLastReselectAt = now;
          this.bind(this.lastMainElement, this.lastControlElements);
        } else {
          // Preserve smooth moving glass every animation frame while avoiding
          // the full all-card host-selection scan on every scroll event.
          this.schedule(false);
        }
      });
    }

    stop() {
      cancelAnimationFrame(this.__perfHostFrame);
      this.__perfHostFrame = 0;
      this.__perfForceReselect = false;
      this.__perfLastReselectAt = 0;
      this.__perfInvalidateSceneCache();
      super.stop();
    }
  }

  window.BlogGlassRenderer = OptimizedScrollRenderer;
})();
