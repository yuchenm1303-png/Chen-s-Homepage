(() => {
  'use strict';

  const catalog = window.__SMIREL_STELLAR_CATALOG__;
  if (!Array.isArray(catalog) || catalog.__smirelFieldLayouts) return;

  // The bright field is deterministic (seed 0xA57A2D31), so constellation design
  // should also be deterministic. These indices were selected once from the real
  // bright-field geometry and are now part of the visual identity of each field.
  // Runtime code must not re-score or replace them.
  const FIXED_INDICES = Object.freeze({
    blog: 5596,
    'ai-ledger-real-streaming': 2630,
    'building-homepage': 204,
    'opengl-liquid-glass': 5451,
    'computer-use-design': 5173,
    'app-performance-optimization': 4538,
    'compose-parent-bubble-rendering': 6740,
    'gan-hemt-stability': 8132,
    'ai-listing-research': 2462,

    contact: 3913,
    'contact-github': 7173,
    'contact-email': 1483,
    'contact-phone': 4389,
    'contact-qq': 12626,
  });

  // Targets remain as design documentation / graceful fallback if the renderer's
  // deterministic star field is intentionally replaced in a future revision.
  const LOCAL_DEPTH = Object.freeze([18, 34]);

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
      centre: [-0.46, -0.45],
      offsets: {
        'ai-ledger-real-streaming': [-0.14, 0.18],
        'building-homepage': [0.04, 0.22],
        'opengl-liquid-glass': [0.19, 0.15],
        'computer-use-design': [0.25, -0.01],
        'app-performance-optimization': [0.17, -0.17],
        'compose-parent-bubble-rendering': [0.00, -0.23],
        'gan-hemt-stability': [-0.19, -0.16],
        'ai-listing-research': [-0.23, 0.00],
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
      centre: [0.51, 0.50],
      offsets: {
        'contact-github': [-0.18, 0.09],
        'contact-email': [0.18, 0.10],
        'contact-phone': [-0.11, -0.17],
        'contact-qq': [0.09, -0.16],
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
