(() => {
  'use strict';

  const BaseRenderer = window.BlogGlassRenderer;
  if (typeof BaseRenderer !== 'function') return;

  class ScrollSceneBlogGlassRenderer extends BaseRenderer {
    constructor(...args) {
      super(...args);
      this.lastMainElement = null;
      this.lastControlElements = [];
      this.scrollElement = null;
      this.boundSceneScroll = () => this.schedule(false);
      this.boundHostsChanged = () => {
        cancelAnimationFrame(this.hostRefreshFrame);
        this.hostRefreshFrame = requestAnimationFrame(() => {
          this.hostRefreshFrame = 0;
          if (!this.lastMainElement || this.reader?.hidden) return;
          this.bind(this.lastMainElement, this.lastControlElements);
        });
      };
      this.hostRefreshFrame = 0;
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

      return {
        mainElement: sceneHosts[0],
        controlElements: sceneHosts.slice(1),
      };
    }

    releaseInactiveHosts(activeElements) {
      if (!this.hostMap) return;
      for (const [element, host] of this.hostMap.entries()) {
        if (activeElements.has(element)) continue;

        try {
          host.gl?.deleteTexture?.(host.blurTexture);
          host.gl?.deleteBuffer?.(host.buffer);
          host.gl?.deleteProgram?.(host.program);
          host.gl?.getExtension?.('WEBGL_lose_context')?.loseContext();
        } catch (_) {}

        host.backdropCanvas?.remove();
        host.glCanvas?.remove();
        element.classList.remove('v295-standard-host', 'v295-standard-fallback');
        this.hostMap.delete(element);
      }
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

      this.releaseInactiveHosts(activeElements);
      super.bind(targets.mainElement, targets.controlElements);
      this.optimiseVisibleHosts();
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
    }

    stop() {
      cancelAnimationFrame(this.hostRefreshFrame);
      this.hostRefreshFrame = 0;
      this.scrollElement?.removeEventListener('scroll', this.boundSceneScroll);
      this.reader?.removeEventListener('blog:glass-hosts-changed', this.boundHostsChanged);
      super.stop();
    }
  }

  window.BlogGlassRenderer = ScrollSceneBlogGlassRenderer;
})();
