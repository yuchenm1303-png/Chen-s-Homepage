(() => {
  'use strict';

  const BaseRenderer = window.BlogGlassRenderer;
  if (typeof BaseRenderer !== 'function') return;

  const mobileViewport = matchMedia('(max-width: 820px)');
  const MOBILE_CARD_HOST_BUDGET = 3;
  const MOBILE_OVERSCAN_FACTOR = 0.65;

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

      this.boundSceneScroll = () => {
        this.schedule(false);
        if (mobileViewport.matches) this.scheduleHostRefresh();
      };
      this.boundHostsChanged = () => this.scheduleHostRefresh(true);
      this.boundViewportModeChanged = () => this.scheduleHostRefresh(true);
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

    collectMobileCards(cards) {
      if (!cards.length) return [];

      const readerRect = this.reader.getBoundingClientRect();
      const overscan = Math.max(180, readerRect.height * MOBILE_OVERSCAN_FACTOR);
      const viewportCenter = (readerRect.top + readerRect.bottom) * 0.5;

      let candidates = cards.filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.bottom >= readerRect.top - overscan
          && rect.top <= readerRect.bottom + overscan;
      });

      if (!candidates.length) {
        candidates = [...cards].sort((left, right) => {
          const leftRect = left.getBoundingClientRect();
          const rightRect = right.getBoundingClientRect();
          const leftCenter = (leftRect.top + leftRect.bottom) * 0.5;
          const rightCenter = (rightRect.top + rightRect.bottom) * 0.5;
          return Math.abs(leftCenter - viewportCenter) - Math.abs(rightCenter - viewportCenter);
        }).slice(0, 1);
      }

      return candidates
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const center = (rect.top + rect.bottom) * 0.5;
          return { element, distance: Math.abs(center - viewportCenter) };
        })
        .sort((left, right) => left.distance - right.distance)
        .slice(0, MOBILE_CARD_HOST_BUDGET)
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

      if (mobileViewport.matches) {
        toolbar?.classList.add('mobile-stable-toolbar');

        const cards = sceneHosts.filter((element) => element.matches('.article-glass-card'));
        const activeCards = this.collectMobileCards(cards);
        const activeMain = activeCards[0] || mainElement;

        return {
          mainElement: activeMain,
          controlElements: activeCards.slice(1),
        };
      }

      toolbar?.classList.remove('mobile-stable-toolbar');
      return {
        mainElement: sceneHosts[0],
        controlElements: sceneHosts.slice(1),
      };
    }

    releaseHost(element, host, loseContext = true) {
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
          const margin = 120;
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

      if (mobileViewport.matches && sameElementSet(this.activeElements, activeElements)) {
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
      super.start();
      this.attachScrollElement();
      this.scrollElement?.addEventListener('scroll', this.boundSceneScroll, { passive: true });
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
