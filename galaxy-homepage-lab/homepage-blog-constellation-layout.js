(() => {
  'use strict';

  const catalog = window.__SMIREL_STELLAR_CATALOG__;
  if (!Array.isArray(catalog) || catalog.__smirelBlogLayout) return;

  const BLOG_DEPTH = Object.freeze([25, 29]);
  const blogTargets = Object.freeze({
    blog: Object.freeze([0.00, -0.12]),
    'ai-ledger-real-streaming': Object.freeze([-0.46, -0.08]),
    'building-homepage': Object.freeze([-0.30, 0.04]),
    'opengl-liquid-glass': Object.freeze([-0.14, -0.12]),
    'computer-use-design': Object.freeze([0.04, -0.02]),
    'app-performance-optimization': Object.freeze([0.20, -0.16]),
    'compose-parent-bubble-rendering': Object.freeze([0.38, -0.04]),
    'gan-hemt-stability': Object.freeze([0.02, 0.18]),
    'ai-listing-research': Object.freeze([0.22, 0.28]),
  });

  const blogEdges = Object.freeze([
    Object.freeze(['ai-ledger-real-streaming', 'building-homepage']),
    Object.freeze(['building-homepage', 'opengl-liquid-glass']),
    Object.freeze(['opengl-liquid-glass', 'computer-use-design']),
    Object.freeze(['computer-use-design', 'app-performance-optimization']),
    Object.freeze(['app-performance-optimization', 'compose-parent-bubble-rendering']),
    Object.freeze(['computer-use-design', 'gan-hemt-stability']),
    Object.freeze(['gan-hemt-stability', 'ai-listing-research']),
  ]);

  const enriched = catalog.map((item) => {
    if (item.id !== 'blog' && item.parentField !== 'blog') return item;

    const target = blogTargets[item.id];
    const star = target && item.star
      ? Object.freeze({ ...item.star, target, depth: BLOG_DEPTH })
      : item.star;

    if (item.id === 'blog') {
      const constellation = Object.freeze({
        ...item.constellation,
        edges: blogEdges,
      });
      return Object.freeze({ ...item, star, constellation });
    }

    return Object.freeze({ ...item, star });
  });

  Object.defineProperty(enriched, '__smirelBlogLayout', {
    value: true,
    enumerable: false,
  });
  window.__SMIREL_STELLAR_CATALOG__ = Object.freeze(enriched);

  const style = document.createElement('style');
  style.dataset.smirelBlogConstellationLayout = 'true';
  style.textContent = `
    body[data-star-field="blog"] .smirel-companion-star[data-companion-id="opengl-liquid-glass"] .smirel-companion-label,
    body[data-star-field="blog"] .smirel-companion-star[data-companion-id="app-performance-optimization"] .smirel-companion-label,
    body[data-star-field="blog"] .smirel-companion-star[data-companion-id="compose-parent-bubble-rendering"] .smirel-companion-label,
    body[data-star-field="blog"] .smirel-companion-star[data-companion-id="ai-listing-research"] .smirel-companion-label {
      left: auto;
      right: 36px;
      align-items: flex-end;
      text-align: right;
    }

    body[data-star-field="blog"] .smirel-companion-star[data-companion-id="computer-use-design"] .smirel-companion-label,
    body[data-star-field="blog"] .smirel-companion-star[data-companion-id="gan-hemt-stability"] .smirel-companion-label {
      top: -11px;
    }

    body[data-star-field="blog"] .smirel-companion-star[data-companion-id="building-homepage"] .smirel-companion-label,
    body[data-star-field="blog"] .smirel-companion-star[data-companion-id="app-performance-optimization"] .smirel-companion-label {
      top: 20px;
    }
  `;
  document.head.appendChild(style);
})();
