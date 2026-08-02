(() => {
  'use strict';

  const BaseRenderer = window.BlogGlassRenderer;
  if (typeof BaseRenderer !== 'function') return;

  const mobileViewport = matchMedia('(max-width: 820px)');
  const MOBILE_CARD_HOST_BUDGET = 3;
  const DESKTOP_CARD_HOST_BUDGET = 5;
  const MOBILE_OVERSCAN_FACTOR = 0.85;
  const DESKTOP_OVERSCAN_FACTOR = 1.10;
  const RETAIN_MULTIPLIER = 1.45;

  const sameElementSet = (left, right) => {
    if (!left || !right || left.size !== right.size) return false;
    for (const element of left) {
      if (!right.has(element)) return false;
    }
    return true;
  };

  class ScrollSceneBlogGlassRenderer extends BaseRenderer {
    constructor(...args) {
      super(...args);
      this.lastMainElement = null;
      this.lastControlElements = [];
      this.activeElements = null;
      this.scrollElement = null;
      this.hostRefreshFrame = 0;

      this.boundSceneScroll = () => this.scheduleHostRefresh();
      this.boundHostsChanged = () => this.scheduleHostRefresh(true);
      this.boundViewportModeChanged = () => this.scheduleHostRefresh(true);
    }

    backdropSizeChanged() {
      if (this.needsBackdrop) return true;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(this.reader.clientWidth * pixelRatio));
      const height = Math.max(1, Math.round(this.reader.clientHeight * pixelRatio));
      return width !== this.rootWidth
        || height !== this.rootHeight
        || pixelRatio !== this.pixelRatio;
    }

    schedule(rebuildBackdrop = false) {
      const shouldRebuild = Boolean(rebuildBackdrop && this.backdropSizeChanged());
      super.schedule(shouldRebuild);
    }

    rebuildBackdrop() {
      super.rebuildBackdrop();

      /*
       * These canvases are only scratch buffers used while rebuilding the final
       * background texture. Keep the visible background and final blur canvas,
       * then release the large intermediate bitmaps until the next real resize.
       */
      [this.sourceCanvas, this.colorCanvas, this.blurA, this.blurB].forEach((canvas) => {
        if (!canvas || (canvas.width <= 1 && canvas.height <= 1)) return;
        canvas.width = 1;
        canvas.height = 1;
      });
    }

    scheduleHostRefresh(force = false) {
      if (force) this.activeElements = null;
      if (this.hostRefreshFrame) return;

      this.hostRefreshFrame = requestAnimationFrame(() => {
        this.hostRefreshFrame = 0;
        if (!this.lastMainElement || this.reader?.hidden) return;
        this.bind(this.lastMainElement, this.lastControlElements);
      });
    }

    collectActiveCards(cards) {
      if (!cards.length) return [];

      const readerRect = this.reader.getBoundingClientRect();
      const viewportHeight = Math.max(1, readerRect.height);
      const isMobile = mobileViewport.matches;
      const budget = isMobile ? MOBILE_CARD_HOST_BUDGET : DESKTOP_CARD_HOST_BUDGET;
      const overscanFactor = isMobile ? MOBILE_OVERSCAN_FACTOR : DESKTOP_OVERSCAN_FACTOR;
      const acquireDistance = Math.max(isMobile ? 240 : 320, viewportHeight * overscanFactor);
      const retainDistance = acquireDistance * RETAIN_MULTIPLIER;
      const currentCards = new Set(
        [...(this.activeElements || [])].filter((element) => element.matches?.('.article-glass-card')),
      );

      const entries = cards.map((element, index) => {
        const rect = element.getBoundingClientRect();
        let distance = 0;
        if (rect.bottom < readerRect.top) distance = readerRect.top - rect.bottom;
        else if (rect.top > readerRect.bottom) distance = rect.top - readerRect.bottom;

        const active = currentCards.has(element);
        const eligible = distance <= acquireDistance || (active && distance <= retainDistance);
        const stabilityBonus = active ? viewportHeight * 0.22 : 0;
        return {
          element,
          index,
          eligible,
          score: distance - stabilityBonus,
        };
      });

      return entries
        .filter((entry) => entry.eligible)
        .sort((left, right) => left.score - right.score || left.index - right.index)
        .slice(0, budget)
        .sort((left, right) => left.index - right.index)
        .map((entry) => entry.element);
    }

    collectSceneTargets(mainElement, controlElements) {
      const sceneHosts = [...this.reader.querySelectorAll('[data-blog-glass-host]')]
        .filter((element) => element.isConnected);

      if (!sceneHosts.length) {
        return {
          mainElement,
          controlElements: [...controlElements],
        };
      }

      const toolbar = this.reader.querySelector('.article-control-bar');
      const cards = sceneHosts.filter((element) => element.matches('.article-glass-card'));
      const activeCards = this.collectActiveCards(cards);

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

    releaseHost(element, host, loseContext = true) {
      if (loseContext) host.__intentionalContextLoss = true;

      try {
        host.gl?.deleteTexture?.(host.blurTexture);
        host.gl?.deleteBuffer?.(host.buffer);
        host.gl?.deleteProgram?.(host.program);
        if (loseContext) host.gl?.getExtension?.('WEBGL_lose_context')?.loseContext();
      } catch (_) {}

      host.backdropCanvas?.remove();
      host.glCanvas?.remove();
      element.classList.remove('v295-standard-host');
      this.hostMap?.delete(element);
      this.hosts = this.hosts?.filter((candidate) => candidate !== host) || [];
    }

    releaseInactiveHosts(activeElements) {
      if (!this.hostMap) return;
      for (const [element, host] of this.hostMap.entries()) {
        if (activeElements.has(element)) continue;
        this.releaseHost(element, host);
        element.classList.remove('v295-standard-fallback');
      }
    }

    guardContextLoss() {
      this.hosts?.forEach((host) => {
        if (host.__scrollContextGuarded || !host.glCanvas) return;
        host.__scrollContextGuarded = true;

        host.glCanvas.addEventListener('webglcontextlost', (event) => {
          event.preventDefault();
          if (host.__intentionalContextLoss) return;

          const element = host.element;
          element?.classList.add('v295-standard-fallback');
          this.releaseHost(element, host, false);
          this.activeElements = null;
          setTimeout(() => this.scheduleHostRefresh(true), 80);
        }, { once: true });
      });
    }

    optimiseVisibleHosts() {
      this.hosts?.forEach((host) => {
        if (host.__scrollVisibilityPatched) return;
        host.__scrollVisibilityPatched = true;
        const originalRender = host.render.bind(host);

        host.render = (state) => {
          const rect = host.element.getBoundingClientRect();
          const margin = mobileViewport.matches ? 140 : 200;
          const outsideViewport = (
            rect.bottom < state.readerRect.top - margin
            || rect.top > state.readerRect.bottom + margin
            || rect.right < state.readerRect.left - margin
            || rect.left > state.readerRect.right + margin
          );
          if (outsideViewport) return false;
          return originalRender(state);
        };
      });
    }

    bind(mainElement, controlElements) {
      this.lastMainElement = mainElement;
      this.lastControlElements = [...controlElements];

      const targets = this.collectSceneTargets(mainElement, controlElements);
      const toc = this.reader.querySelector('#articleToc');
      const activeElements = new Set([
        targets.mainElement,
        toc,
        ...targets.controlElements,
      ].filter(Boolean));

      if (sameElementSet(this.activeElements, activeElements)) {
        this.attachScrollElement();
        this.schedule(false);
        return;
      }

      this.activeElements = activeElements;
      this.releaseInactiveHosts(activeElements);
      super.bind(targets.mainElement, targets.controlElements);
      this.optimiseVisibleHosts();
      this.guardContextLoss();
      this.attachScrollElement();
    }

    attachScrollElement() {
      const next = this.reader?.querySelector('#articleScroll') || null;
      if (next === this.scrollElement) return;

      this.scrollElement?.removeEventListener('scroll', this.boundSceneScroll);
      this.scrollElement = next;

      if (this.running) {
        this.scrollElement?.addEventListener('scroll', this.boundSceneScroll, { passive: true });
      }
    }

    start() {
      if (this.running) return;
      super.start();
      this.attachScrollElement();
      this.reader?.addEventListener('blog:glass-hosts-changed', this.boundHostsChanged);
      if (typeof mobileViewport.addEventListener === 'function') {
        mobileViewport.addEventListener('change', this.boundViewportModeChanged);
      } else {
        mobileViewport.addListener?.(this.boundViewportModeChanged);
      }
    }

    stop() {
      cancelAnimationFrame(this.hostRefreshFrame);
      this.hostRefreshFrame = 0;
      this.activeElements = null;
      this.scrollElement?.removeEventListener('scroll', this.boundSceneScroll);
      this.reader?.removeEventListener('blog:glass-hosts-changed', this.boundHostsChanged);
      if (typeof mobileViewport.removeEventListener === 'function') {
        mobileViewport.removeEventListener('change', this.boundViewportModeChanged);
      } else {
        mobileViewport.removeListener?.(this.boundViewportModeChanged);
      }
      super.stop();
    }
  }

  window.BlogGlassRenderer = ScrollSceneBlogGlassRenderer;
})();
