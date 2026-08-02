(() => {
  'use strict';

  const HOST_SELECTOR = '.article-glass-card, .article-control-bar, #articleToc';
  const ACTIVE_CLASS = 'app-shell-runtime-active';
  const RELEASE_DELAY_MS = 2600;
  const pointerHosts = new Map();
  const touchHosts = new Map();
  const touchCounts = new WeakMap();
  const releaseTimers = new WeakMap();
  let sweepHandle = 0;

  const findHost = (target) => target instanceof Element
    ? target.closest(HOST_SELECTOR)
    : null;

  const findOpticsCanvas = (host) => {
    if (!host) return null;
    for (const child of host.children) {
      if (child.classList?.contains('app-shell-press-optics')) return child;
    }
    return null;
  };

  const shrinkIdleCanvas = (host) => {
    if (!host?.isConnected || host.classList.contains(ACTIVE_CLASS)) return;
    const canvas = findOpticsCanvas(host);
    if (!canvas) return;
    if (canvas.width !== 1) canvas.width = 1;
    if (canvas.height !== 1) canvas.height = 1;
  };

  const activateHost = (host) => {
    if (!host) return;
    const timer = releaseTimers.get(host);
    if (timer) clearTimeout(timer);
    host.classList.add(ACTIVE_CLASS);
  };

  const releaseHost = (host) => {
    if (!host) return;
    const previous = releaseTimers.get(host);
    if (previous) clearTimeout(previous);
    const timer = setTimeout(() => {
      releaseTimers.delete(host);
      host.classList.remove(ACTIVE_CLASS);
      shrinkIdleCanvas(host);
    }, RELEASE_DELAY_MS);
    releaseTimers.set(host, timer);
  };

  const sweepIdleCanvases = () => {
    sweepHandle = 0;
    const reader = document.querySelector('.article-reader');
    if (!reader) return;
    reader.querySelectorAll(HOST_SELECTOR).forEach(shrinkIdleCanvas);
  };

  const scheduleSweep = () => {
    if (sweepHandle) return;
    if ('requestIdleCallback' in window) {
      sweepHandle = requestIdleCallback(sweepIdleCanvases, { timeout: 700 });
    } else {
      sweepHandle = setTimeout(sweepIdleCanvases, 360);
    }
  };

  addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch') return;
    const host = findHost(event.target);
    if (!host) return;
    pointerHosts.set(event.pointerId, host);
    activateHost(host);
  }, true);

  const finishPointer = (event) => {
    const host = pointerHosts.get(event.pointerId);
    if (!host) return;
    pointerHosts.delete(event.pointerId);
    releaseHost(host);
  };

  addEventListener('pointerup', finishPointer, true);
  addEventListener('pointercancel', finishPointer, true);

  addEventListener('touchstart', (event) => {
    const host = findHost(event.target);
    if (!host) return;
    for (let index = 0; index < event.changedTouches.length; index += 1) {
      const touch = event.changedTouches.item(index);
      if (!touch) continue;
      touchHosts.set(touch.identifier, host);
      touchCounts.set(host, (touchCounts.get(host) || 0) + 1);
    }
    activateHost(host);
  }, { capture: true, passive: true });

  const finishTouches = (event) => {
    const affectedHosts = new Set();
    for (let index = 0; index < event.changedTouches.length; index += 1) {
      const touch = event.changedTouches.item(index);
      if (!touch) continue;
      const host = touchHosts.get(touch.identifier);
      touchHosts.delete(touch.identifier);
      if (!host) continue;
      const remaining = Math.max(0, (touchCounts.get(host) || 1) - 1);
      touchCounts.set(host, remaining);
      if (remaining === 0) affectedHosts.add(host);
    }
    affectedHosts.forEach(releaseHost);
  };

  addEventListener('touchend', finishTouches, { capture: true, passive: true });
  addEventListener('touchcancel', finishTouches, { capture: true, passive: true });

  const installObserver = () => {
    const reader = document.querySelector('.article-reader');
    if (!reader) return false;
    const observer = new MutationObserver(scheduleSweep);
    observer.observe(reader, { childList: true, subtree: true });
    scheduleSweep();
    return true;
  };

  if (!installObserver()) {
    const observer = new MutationObserver(() => {
      if (!installObserver()) return;
      observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) scheduleSweep();
  });
})();
