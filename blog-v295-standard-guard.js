(() => {
  'use strict';

  const Renderer = window.BlogGlassRenderer;
  if (typeof Renderer !== 'function') return;

  function ensureHostDom(host) {
    if (!host?.ready || !host.element) return;
    const element = host.element;

    if (element.matches('button')) {
      let label = element.querySelector('.v295-standard-label');
      if (!label) {
        label = document.createElement('span');
        label.className = 'v295-standard-label';
        const contentNodes = [...element.childNodes].filter((node) => (
          node !== host.backdropCanvas && node !== host.glCanvas
        ));
        contentNodes.forEach((node) => label.appendChild(node));
        element.appendChild(label);
      }
    }

    const backdropAttached = host.backdropCanvas?.parentNode === element;
    const glAttached = host.glCanvas?.parentNode === element;
    if (!backdropAttached || !glAttached) {
      element.prepend(host.backdropCanvas, host.glCanvas);
    }
  }

  function guardHost(host) {
    if (!host || host.__standardDomGuarded) return;
    host.__standardDomGuarded = true;
    const originalRender = host.render.bind(host);
    host.render = (state) => {
      ensureHostDom(host);
      return originalRender(state);
    };
  }

  const originalBind = Renderer.prototype.bind;
  Renderer.prototype.bind = function bindWithDomGuard(mainElement, controlElements) {
    originalBind.call(this, mainElement, controlElements);
    this.hosts?.forEach(guardHost);
    this.hosts?.forEach(ensureHostDom);

    this.standardDomObserver?.disconnect();
    this.standardDomObserver = new MutationObserver(() => {
      this.hosts?.forEach(ensureHostDom);
      this.schedule?.(true);
    });

    controlElements.filter(Boolean).forEach((element) => {
      this.standardDomObserver.observe(element, { childList: true });
    });
  };

  const originalStop = Renderer.prototype.stop;
  Renderer.prototype.stop = function stopWithDomGuard() {
    this.standardDomObserver?.disconnect();
    originalStop.call(this);
  };
})();
