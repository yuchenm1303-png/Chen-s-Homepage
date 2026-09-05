(() => {
  'use strict';

  const catalog = window.__SMIREL_STELLAR_CATALOG__;
  if (!Array.isArray(catalog) || catalog.__smirelFieldLayouts) return;

  // The bright field is deterministic (seed 0xA57A2D31), so these are authored
  // identities rather than runtime search hints. About is authored screen-first:
  // its four companion stars are selected from the user's intended local viewport
  // territory, then pinned by stable bright-field index. Blog is authored the same
  // way: compose the screen first, then pin the real stars that occupy that space.
  const FIXED_INDICES = Object.freeze({
    about: 8430,
    'about-identity': 2782,
    'about-work': 5342,
    'about-study': 3717,
    'about-place': 4139,

    blog: 5596,
    'building-homepage': 518,
    'opengl-liquid-glass': 11314,
    'computer-use-design': 3436,
    'gan-hemt-stability': 13212,
    'ai-ledger-real-streaming': 13802,
    'app-performance-optimization': 380,
    'compose-parent-bubble-rendering': 12462,
    'ai-listing-research': 13539,

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
      // Screen-first composition measured from the user's latest marked capture.
      // On the neutral 2040x1115 canvas viewport all four companions stay inside
      // the requested local About territory around the existing primary star.
      centre: [-0.0820, -0.7906],
      offsets: {
        'about-identity': [-0.0078, 0.3921],
        'about-work': [0.1951, 0.4043],
        'about-study': [0.1112, 0.1861],
        'about-place': [-0.0845, 0.1639],
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
      // Screen-first composition measured from the user's 1683x1402 reference
      // capture. Every companion sits inside the requested x=263..1004,
      // y=478..1269 visual territory, with the primary low in the composition
      // and two open branches rising through the available space.
      centre: [-0.3393, -0.4351],
      offsets: {
        'building-homepage': [-0.1925, 0.2154],
        'opengl-liquid-glass': [-0.2602, 0.5221],
        'computer-use-design': [-0.0143, 0.6305],
        'gan-hemt-stability': [0.1604, 0.6091],
        'ai-ledger-real-streaming': [0.2187, 0.4850],
        'app-performance-optimization': [0.1830, 0.3081],
        'compose-parent-bubble-rendering': [0.0487, 0.1740],
        'ai-listing-research': [-0.0796, 0.1498],
      },
      edges: [
        ['blog', 'ai-listing-research'],
        ['ai-listing-research', 'building-homepage'],
        ['building-homepage', 'opengl-liquid-glass'],
        ['opengl-liquid-glass', 'computer-use-design'],
        ['computer-use-design', 'gan-hemt-stability'],
        ['blog', 'compose-parent-bubble-rendering'],
        ['compose-parent-bubble-rendering', 'app-performance-optimization'],
        ['app-performance-optimization', 'ai-ledger-real-streaming'],
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
    /* Labels point into free screen space rather than mechanically following
       graph direction. This is part of the authored screen composition. */
    .smirel-companion-star[data-parent-field="about"][data-companion-id="about-identity"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="about"][data-companion-id="about-work"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="computer-use-design"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="ai-ledger-real-streaming"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="app-performance-optimization"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-github"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-phone"] .smirel-companion-label {
      left: auto;
      right: 36px;
      align-items: flex-end;
      text-align: right;
    }

    .smirel-companion-star[data-parent-field="about"][data-companion-id="about-identity"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="about"][data-companion-id="about-work"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="opengl-liquid-glass"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="computer-use-design"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="gan-hemt-stability"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-github"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-email"] .smirel-companion-label {
      top: -15px;
    }

    .smirel-companion-star[data-parent-field="about"][data-companion-id="about-study"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="about"][data-companion-id="about-place"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="building-homepage"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="app-performance-optimization"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="compose-parent-bubble-rendering"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="ai-listing-research"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-phone"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-qq"] .smirel-companion-label {
      top: 19px;
    }
  `;
  document.head.appendChild(style);
})();
