(() => {
  'use strict';

  const STYLE_ID = 'smirel-star-marker-lifecycle-style';
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* Hard-hide only the DOM companion marker (dot/ring/label). SVG
         constellation edges remain owned by homepage-star-constellation.js so
         their opacity + stroke-dashoffset growth animation stays intact. */
      .smirel-companion-star[hidden] {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  let scheduled = false;

  function activeFieldId() {
    const body = document.body;
    if (!body) return null;

    if (body.classList.contains('star-field-open')
        || body.classList.contains('star-field-transition')) {
      return body.dataset.starField || null;
    }

    const preview = document.querySelector('.smirel-field-star.is-preview');
    return preview?.dataset.fieldId || null;
  }

  function dedupeMarkers() {
    const latestById = new Map();
    const markers = Array.from(document.querySelectorAll('.smirel-companion-star[data-companion-id]'));
    for (let index = markers.length - 1; index >= 0; index -= 1) {
      const marker = markers[index];
      const id = marker.dataset.companionId;
      if (!id) continue;
      if (latestById.has(id)) {
        marker.remove();
        continue;
      }
      latestById.set(id, marker);
    }
  }

  function enforceMarkerLifecycle() {
    scheduled = false;
    const body = document.body;
    if (!body) return;

    dedupeMarkers();

    const fieldId = activeFieldId();
    const suppress = body.classList.contains('star-flight-active')
      || body.classList.contains('star-detail-open');

    for (const marker of document.querySelectorAll('.smirel-companion-star')) {
      const belongsToActiveField = Boolean(fieldId)
        && marker.dataset.parentField === fieldId;
      const shouldExist = !suppress
        && belongsToActiveField
        && marker.classList.contains('is-open');

      marker.hidden = !shouldExist;
      if (!shouldExist) {
        marker.style.opacity = '';
        marker.style.pointerEvents = '';
      }
    }
  }

  function scheduleEnforce() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enforceMarkerLifecycle);
  }

  const observer = new MutationObserver(scheduleEnforce);
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class', 'data-star-field'],
  });

  window.addEventListener('smirel:field-change', scheduleEnforce);
  window.addEventListener('resize', scheduleEnforce, { passive: true });
  document.addEventListener('pointerover', (event) => {
    if (event.target.closest?.('.smirel-field-star, .smirel-companion-star')) scheduleEnforce();
  }, { passive: true });
  document.addEventListener('pointerout', (event) => {
    if (event.target.closest?.('.smirel-field-star, .smirel-companion-star')) scheduleEnforce();
  }, { passive: true });

  scheduleEnforce();
})();
