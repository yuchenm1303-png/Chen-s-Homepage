(() => {
  'use strict';

  const STYLE_ID = 'smirel-constellation-line-animation-style';
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .smirel-constellation-edge.smirel-edge-seed {
        stroke-dashoffset: 1 !important;
        transition: none !important;
      }
      .smirel-constellation-edge.smirel-edge-drawing {
        stroke-dashoffset: 0 !important;
        transition:
          stroke-dashoffset 560ms cubic-bezier(.22,.61,.36,1) var(--edge-draw-delay, 0ms) !important,
          opacity 160ms ease var(--edge-draw-delay, 0ms) !important;
      }
      .smirel-constellation-edge.smirel-edge-retracting {
        stroke-dashoffset: 1 !important;
        transition: stroke-dashoffset 240ms cubic-bezier(.4,0,.6,1) !important;
      }
    `;
    document.head.appendChild(style);
  }

  const tokens = new WeakMap();
  const cleanupTimers = new WeakMap();

  function nextToken(line) {
    const token = (tokens.get(line) || 0) + 1;
    tokens.set(line, token);
    const timer = cleanupTimers.get(line);
    if (timer) {
      clearTimeout(timer);
      cleanupTimers.delete(line);
    }
    return token;
  }

  function edgeOrder(line) {
    const fieldId = line.dataset.parentField;
    if (!fieldId) return 0;
    const siblings = Array.from(document.querySelectorAll(`.smirel-constellation-edge[data-parent-field="${CSS.escape(fieldId)}"]`));
    return Math.max(0, siblings.indexOf(line));
  }

  function edgeHasGeometry(line) {
    const x1 = Number(line.getAttribute('x1'));
    const y1 = Number(line.getAttribute('y1'));
    const x2 = Number(line.getAttribute('x2'));
    const y2 = Number(line.getAttribute('y2'));
    if (![x1, y1, x2, y2].every(Number.isFinite)) return false;
    return Math.hypot(x2 - x1, y2 - y1) > 1.5;
  }

  function waitForProjectedGeometry(line, token, attempts = 0) {
    if (tokens.get(line) !== token || !line.classList.contains('is-open')) return;

    if (!edgeHasGeometry(line)) {
      if (attempts < 10) {
        requestAnimationFrame(() => waitForProjectedGeometry(line, token, attempts + 1));
      }
      return;
    }

    const delay = Math.min(edgeOrder(line) * 48, 300);
    line.style.setProperty('--edge-draw-delay', `${delay}ms`);
    line.classList.remove('smirel-edge-drawing', 'smirel-edge-retracting');
    line.classList.add('smirel-edge-seed');

    // Commit the hidden dash state only after the projected endpoints are real.
    // The following frame therefore has an actual line length to animate over.
    void line.getTotalLength();
    void getComputedStyle(line).strokeDashoffset;

    requestAnimationFrame(() => {
      if (tokens.get(line) !== token || !line.classList.contains('is-open')) return;
      line.classList.remove('smirel-edge-seed');
      line.classList.add('smirel-edge-drawing');

      const timer = setTimeout(() => {
        if (tokens.get(line) !== token) return;
        line.classList.remove('smirel-edge-drawing');
        line.style.removeProperty('--edge-draw-delay');
        cleanupTimers.delete(line);
      }, delay + 640);
      cleanupTimers.set(line, timer);
    });
  }

  function startDrawing(line) {
    const token = nextToken(line);
    line.classList.remove('smirel-edge-drawing', 'smirel-edge-retracting');
    line.classList.add('smirel-edge-seed');
    waitForProjectedGeometry(line, token);
  }

  function startRetracting(line) {
    const token = nextToken(line);
    line.classList.remove('smirel-edge-seed', 'smirel-edge-drawing');
    void getComputedStyle(line).strokeDashoffset;
    line.classList.add('smirel-edge-retracting');

    const timer = setTimeout(() => {
      if (tokens.get(line) !== token) return;
      line.classList.remove('smirel-edge-retracting');
      line.style.removeProperty('--edge-draw-delay');
      cleanupTimers.delete(line);
    }, 280);
    cleanupTimers.set(line, timer);
  }

  function classValueHasOpen(value) {
    return String(value || '').split(/\s+/).includes('is-open');
  }

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      const line = record.target;
      if (!(line instanceof SVGLineElement)) continue;
      if (!line.classList.contains('smirel-constellation-edge')) continue;

      const wasOpen = classValueHasOpen(record.oldValue);
      const isOpen = line.classList.contains('is-open');
      if (wasOpen === isOpen) continue;

      if (isOpen) startDrawing(line);
      else startRetracting(line);
    }
  });

  observer.observe(document.documentElement, {
    subtree: true,
    attributes: true,
    attributeOldValue: true,
    attributeFilter: ['class'],
  });
})();
