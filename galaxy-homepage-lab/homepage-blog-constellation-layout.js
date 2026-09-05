(() => {
  'use strict';

  const catalog = window.__SMIREL_STELLAR_CATALOG__;
  if (!Array.isArray(catalog) || catalog.__smirelFieldLayouts) return;

  // The bright field is deterministic (seed 0xA57A2D31), so these are authored
  // identities rather than runtime search hints. The indices below were selected
  // once from the real 14,800-star geometry and verified as compact silhouettes
  // around their own field primaries on the desktop reference viewport.
  const FIXED_INDICES = Object.freeze({
    blog: 5596,
    'ai-ledger-real-streaming': 6518,
    'building-homepage': 204,
    'opengl-liquid-glass': 3066,
    'computer-use-design': 14552,
    'app-performance-optimization': 8268,
    'compose-parent-bubble-rendering': 8605,
    'gan-hemt-stability': 4398,
    'ai-listing-research': 13626,

    contact: 11408,
    'contact-github': 9953,
    'contact-email': 2930,
    'contact-phone': 4389,
    'contact-qq': 5849,
  });

  // Targets document the authored silhouette and remain a fallback only if the
  // underlying deterministic bright-field generator is intentionally replaced.
  const LOCAL_DEPTH = Object.freeze([18, 32]);

  function freezePair(pair) {
    return Object.freeze([pair[0], pair[1]]);
  }

  function makeFieldLayout({ centre, offsets, edges }) {
    const frozenCentre = freezePair(centre);
    const frozenOffsets = Object.freeze(Object.fromEntries(
      Object.entries(offsets).map(([id, offset]) => [id, freezePair(offset)]),
    ));
    return Object.freeze({
      centre: frozenCentre,
      offsets: frozenOffsets,
      edges: Object.freeze(edges.map((edge) => Object.freeze([...edge]))),
    });
  }

  const layouts = Object.freeze({
    blog: makeFieldLayout({
      centre: [-0.70, -0.45],
      offsets: {
        'ai-ledger-real-streaming': [-0.14, 0.18],
        'building-homepage': [0.04, 0.22],
        'opengl-liquid-glass': [0.22, 0.15],
        'computer-use-design': [0.27, -0.01],
        'app-performance-optimization': [0.21, -0.19],
        'compose-parent-bubble-rendering': [0.03, -0.24],
        'gan-hemt-stability': [-0.12, -0.20],
        'ai-listing-research': [-0.15, -0.03],
      },
      edges: [
        ['blog', 'ai-ledger-real-streaming'],
        ['ai-ledger-real-streaming', 'building-homepage'],
        ['building-homepage', 'opengl-liquid-glass'],
        ['opengl-liquid-glass', 'computer-use-design'],
        ['computer-use-design', 'app-performance-optimization'],
        ['app-performance-optimization', 'compose-parent-bubble-rendering'],
        ['compose-parent-bubble-rendering', 'gan-hemt-stability'],
        ['gan-hemt-stability', 'ai-listing-research'],
        ['ai-listing-research', 'blog'],
      ],
    }),

    contact: makeFieldLayout({
      centre: [0.74, 0.45],
      offsets: {
        'contact-github': [-0.15, 0.16],
        'contact-email': [0.12, 0.16],
        'contact-phone': [-0.12, -0.12],
        'contact-qq': [0.10, -0.08],
      },
      edges: [
        ['contact-github', 'contact'],
        ['contact', 'contact-email'],
        ['contact', 'contact-phone'],
        ['contact-phone', 'contact-qq'],
      ],
    }),
  });

  function absoluteTarget(layout, item) {
    if (item.kind === 'field') return layout.centre;
    const offset = layout.offsets[item.id];
    if (!offset) return item.star?.target || null;
    return freezePair([
      layout.centre[0] + offset[0],
      layout.centre[1] + offset[1],
    ]);
  }

  const enriched = catalog.map((item) => {
    const fieldId = item.kind === 'field' ? item.id : item.parentField;
    const layout = layouts[fieldId];
    if (!layout) return item;

    const target = absoluteTarget(layout, item);
    const fixedIndex = FIXED_INDICES[item.id];
    const star = target && item.star
      ? Object.freeze({
          ...item.star,
          target,
          depth: LOCAL_DEPTH,
          fixedIndex: Number.isInteger(fixedIndex) ? fixedIndex : undefined,
        })
      : item.star;

    if (item.kind === 'field') {
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
    /* Labels point away from each constellation's centre so the silhouette and
       connector lines remain readable in both hover preview and local-field view. */
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="ai-ledger-real-streaming"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="gan-hemt-stability"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="ai-listing-research"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-github"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-phone"] .smirel-companion-label {
      left: auto;
      right: 36px;
      align-items: flex-end;
      text-align: right;
    }

    .smirel-companion-star[data-parent-field="blog"][data-companion-id="ai-ledger-real-streaming"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="building-homepage"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="opengl-liquid-glass"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-github"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-email"] .smirel-companion-label {
      top: -15px;
    }

    .smirel-companion-star[data-parent-field="blog"][data-companion-id="app-performance-optimization"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="compose-parent-bubble-rendering"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="gan-hemt-stability"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-phone"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-qq"] .smirel-companion-label {
      top: 19px;
    }
  `;
  document.head.appendChild(style);
})();
