(() => {
  'use strict';

  const catalog = window.__SMIREL_STELLAR_CATALOG__;
  if (!Array.isArray(catalog) || catalog.__smirelFieldLayouts) return;

  // The bright field is deterministic (seed 0xA57A2D31), so these are authored
  // identities rather than runtime search hints. About stays deliberately local
  // to its primary: four nearby nodes form a compact personal-field constellation
  // instead of stretching across the viewport. Blog keeps an open branched silhouette.
  const FIXED_INDICES = Object.freeze({
    about: 8430,
    'about-identity': 13906,
    'about-work': 3010,
    'about-study': 12329,
    'about-place': 5869,

    blog: 5596,
    'building-homepage': 156,
    'opengl-liquid-glass': 1918,
    'computer-use-design': 8450,
    'gan-hemt-stability': 3710,
    'ai-ledger-real-streaming': 2955,
    'app-performance-optimization': 9518,
    'compose-parent-bubble-rendering': 7866,
    'ai-listing-research': 10991,

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
    about: makeFieldLayout({
      centre: [-0.12, -0.79],
      offsets: {
        'about-identity': [-0.11, 0.10],
        'about-work': [0.27, 0.09],
        'about-study': [0.16, 0.03],
        'about-place': [-0.16, -0.03],
      },
      edges: [
        ['about', 'about-identity'],
        ['about', 'about-work'],
        ['about', 'about-study'],
        ['about', 'about-place'],
        ['about-identity', 'about-work'],
      ],
    }),

    blog: makeFieldLayout({
      centre: [-0.70, -0.45],
      offsets: {
        'building-homepage': [0.05, 0.10],
        'opengl-liquid-glass': [0.13, 0.18],
        'computer-use-design': [0.24, 0.14],
        'gan-hemt-stability': [0.32, 0.00],
        'ai-ledger-real-streaming': [0.13, 0.01],
        'app-performance-optimization': [0.22, -0.10],
        'compose-parent-bubble-rendering': [0.08, -0.18],
        'ai-listing-research': [-0.06, -0.13],
      },
      edges: [
        ['blog', 'building-homepage'],
        ['building-homepage', 'opengl-liquid-glass'],
        ['opengl-liquid-glass', 'computer-use-design'],
        ['computer-use-design', 'gan-hemt-stability'],
        ['building-homepage', 'ai-ledger-real-streaming'],
        ['ai-ledger-real-streaming', 'app-performance-optimization'],
        ['ai-ledger-real-streaming', 'compose-parent-bubble-rendering'],
        ['compose-parent-bubble-rendering', 'ai-listing-research'],
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
    const fixedIndex = FIXED_INDICES[item.id];
    const hasFixedIndex = Number.isInteger(fixedIndex);
    if (!layout && !hasFixedIndex) return item;

    const target = layout ? absoluteTarget(layout, item) : item.star?.target;
    const star = item.star
      ? Object.freeze({
          ...item.star,
          ...(layout ? { target, depth: LOCAL_DEPTH } : {}),
          fixedIndex: hasFixedIndex ? fixedIndex : undefined,
        })
      : item.star;

    if (item.kind === 'field' && layout) {
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
    .smirel-companion-star[data-parent-field="about"][data-companion-id="about-identity"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="about"][data-companion-id="about-place"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="gan-hemt-stability"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="ai-listing-research"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-github"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-phone"] .smirel-companion-label {
      left: auto;
      right: 36px;
      align-items: flex-end;
      text-align: right;
    }

    .smirel-companion-star[data-parent-field="about"][data-companion-id="about-identity"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="about"][data-companion-id="about-work"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="building-homepage"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="opengl-liquid-glass"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="computer-use-design"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="ai-ledger-real-streaming"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-github"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-email"] .smirel-companion-label {
      top: -15px;
    }

    .smirel-companion-star[data-parent-field="about"][data-companion-id="about-study"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="about"][data-companion-id="about-place"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="app-performance-optimization"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="compose-parent-bubble-rendering"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="gan-hemt-stability"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="ai-listing-research"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-phone"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-qq"] .smirel-companion-label {
      top: 19px;
    }
  `;
  document.head.appendChild(style);
})();
