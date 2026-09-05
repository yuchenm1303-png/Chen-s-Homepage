(() => {
  'use strict';

  const catalog = window.__SMIREL_STELLAR_CATALOG__;
  if (!Array.isArray(catalog) || catalog.__smirelFieldLayouts) return;

  // The bright field is deterministic (seed 0xA57A2D31), so these are authored
  // identities rather than runtime search hints. About and Blog are composed in
  // screen space first, then pinned by stable bright-field index.
  const FIXED_INDICES = Object.freeze({
    about: 8430,
    'about-identity': 2782,
    'about-work': 5342,
    'about-study': 8421,
    'about-place': 4139,

    blog: 5596,
    'building-homepage': 2630,
    'opengl-liquid-glass': 11667,
    'computer-use-design': 1420,
    'gan-hemt-stability': 13739,
    'ai-ledger-real-streaming': 3699,
    'app-performance-optimization': 11690,
    'compose-parent-bubble-rendering': 9499,
    'ai-listing-research': 7482,

    contact: 11408,
    'contact-github': 9953,
    'contact-email': 2930,
    'contact-phone': 4389,
    'contact-qq': 5849,
  });

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
      // The study node is intentionally the lower-right corner of the local
      // silhouette; the other authored stars remain unchanged.
      centre: [-0.0820, -0.7906],
      offsets: {
        'about-identity': [-0.0078, 0.3921],
        'about-work': [0.1951, 0.4043],
        'about-study': [0.4986, 0.1406],
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
      // Screen-first composition on the 1664x918 reference viewport. Blog stays
      // low in the field while every companion is reached directly from the
      // primary star. The radial topology keeps the hierarchy obvious and avoids
      // ring / chain silhouettes without changing the approved star positions.
      centre: [-0.5868, -0.4530],
      offsets: {
        'building-homepage': [-0.1709, 0.1828],
        'opengl-liquid-glass': [-0.1234, 0.3448],
        'computer-use-design': [-0.1673, 0.7774],
        'gan-hemt-stability': [0.1081, 0.8141],
        'ai-ledger-real-streaming': [0.3978, 0.7458],
        'app-performance-optimization': [0.1890, 0.3788],
        'compose-parent-bubble-rendering': [0.3111, 0.2099],
        'ai-listing-research': [0.3874, -0.0592],
      },
      edges: [
        ['blog', 'building-homepage'],
        ['blog', 'opengl-liquid-glass'],
        ['blog', 'computer-use-design'],
        ['blog', 'gan-hemt-stability'],
        ['blog', 'ai-ledger-real-streaming'],
        ['blog', 'app-performance-optimization'],
        ['blog', 'compose-parent-bubble-rendering'],
        ['blog', 'ai-listing-research'],
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
    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-github"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-phone"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="ai-ledger-real-streaming"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="compose-parent-bubble-rendering"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="ai-listing-research"] .smirel-companion-label {
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
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="ai-ledger-real-streaming"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="ai-listing-research"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-github"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-email"] .smirel-companion-label {
      top: -15px;
    }

    .smirel-companion-star[data-parent-field="about"][data-companion-id="about-study"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="about"][data-companion-id="about-place"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="building-homepage"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="app-performance-optimization"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="compose-parent-bubble-rendering"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-phone"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-qq"] .smirel-companion-label {
      top: 19px;
    }
  `;
  document.head.appendChild(style);
})();