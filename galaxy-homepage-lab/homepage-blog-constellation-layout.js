(() => {
  'use strict';

  const catalog = window.__SMIREL_STELLAR_CATALOG__;
  if (!Array.isArray(catalog) || catalog.__smirelFieldLayouts) return;

  // Local fields should read as compact constellations, not as unrelated bright
  // stars scattered across the page. A narrow depth slab preserves the silhouette
  // when the local-field camera moves in, while low companion brightness thresholds
  // let spatial proximity win over an arbitrarily bright but distant candidate.
  const LOCAL_DEPTH = Object.freeze([25, 29]);

  const blogTargets = Object.freeze({
    blog: Object.freeze([-0.55, -0.56]),
    'ai-ledger-real-streaming': Object.freeze([-0.70, -0.36]),
    'building-homepage': Object.freeze([-0.48, -0.30]),
    'opengl-liquid-glass': Object.freeze([-0.26, -0.40]),
    'computer-use-design': Object.freeze([-0.04, -0.30]),
    'app-performance-optimization': Object.freeze([0.18, -0.40]),
    'compose-parent-bubble-rendering': Object.freeze([0.14, -0.64]),
    'gan-hemt-stability': Object.freeze([-0.30, -0.62]),
    'ai-listing-research': Object.freeze([-0.08, -0.68]),
  });

  const blogEdges = Object.freeze([
    Object.freeze(['blog', 'ai-ledger-real-streaming']),
    Object.freeze(['blog', 'gan-hemt-stability']),
    Object.freeze(['ai-ledger-real-streaming', 'building-homepage']),
    Object.freeze(['building-homepage', 'opengl-liquid-glass']),
    Object.freeze(['opengl-liquid-glass', 'computer-use-design']),
    Object.freeze(['computer-use-design', 'app-performance-optimization']),
    Object.freeze(['opengl-liquid-glass', 'gan-hemt-stability']),
    Object.freeze(['gan-hemt-stability', 'ai-listing-research']),
    Object.freeze(['ai-listing-research', 'compose-parent-bubble-rendering']),
    Object.freeze(['app-performance-optimization', 'compose-parent-bubble-rendering']),
  ]);

  const contactTargets = Object.freeze({
    contact: Object.freeze([0.62, 0.56]),
    'contact-github': Object.freeze([0.42, 0.70]),
    'contact-email': Object.freeze([0.80, 0.68]),
    'contact-phone': Object.freeze([0.58, 0.34]),
    'contact-qq': Object.freeze([0.80, 0.38]),
  });

  const contactEdges = Object.freeze([
    Object.freeze(['contact-github', 'contact']),
    Object.freeze(['contact', 'contact-email']),
    Object.freeze(['contact', 'contact-phone']),
    Object.freeze(['contact-phone', 'contact-qq']),
  ]);

  const layouts = Object.freeze({
    blog: Object.freeze({ targets: blogTargets, edges: blogEdges }),
    contact: Object.freeze({ targets: contactTargets, edges: contactEdges }),
  });

  const enriched = catalog.map((item) => {
    const fieldId = item.kind === 'field' ? item.id : item.parentField;
    const layout = layouts[fieldId];
    if (!layout) return item;

    const target = layout.targets[item.id];
    const isPrimary = item.kind === 'field';
    const star = target && item.star
      ? Object.freeze({
          ...item.star,
          target,
          depth: LOCAL_DEPTH,
          minBrightness: isPrimary ? Math.min(item.star.minBrightness ?? 1.8, 1.42) : 1.05,
        })
      : item.star;

    if (isPrimary) {
      const constellation = Object.freeze({
        ...item.constellation,
        edges: layout.edges,
      });
      return Object.freeze({ ...item, star, constellation });
    }

    return Object.freeze({ ...item, star });
  });

  Object.defineProperty(enriched, '__smirelFieldLayouts', {
    value: true,
    enumerable: false,
  });
  window.__SMIREL_STELLAR_CATALOG__ = Object.freeze(enriched);

  const style = document.createElement('style');
  style.dataset.smirelFieldConstellationLayout = 'true';
  style.textContent = `
    /* Labels face away from the silhouette. These selectors intentionally do not
       depend on body[data-star-field], so homepage hover previews and local fields
       share exactly the same typographic geometry. */
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="ai-ledger-real-streaming"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="building-homepage"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="gan-hemt-stability"] .smirel-companion-label {
      left: auto;
      right: 36px;
      align-items: flex-end;
      text-align: right;
    }

    .smirel-companion-star[data-parent-field="blog"][data-companion-id="ai-ledger-real-streaming"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="building-homepage"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="computer-use-design"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="app-performance-optimization"] .smirel-companion-label {
      top: -15px;
    }

    .smirel-companion-star[data-parent-field="blog"][data-companion-id="gan-hemt-stability"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="ai-listing-research"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="compose-parent-bubble-rendering"] .smirel-companion-label {
      top: 20px;
    }

    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-github"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-phone"] .smirel-companion-label {
      left: auto;
      right: 36px;
      align-items: flex-end;
      text-align: right;
    }

    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-github"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-email"] .smirel-companion-label {
      top: -12px;
    }

    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-phone"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-qq"] .smirel-companion-label {
      top: 19px;
    }
  `;
  document.head.appendChild(style);
})();
