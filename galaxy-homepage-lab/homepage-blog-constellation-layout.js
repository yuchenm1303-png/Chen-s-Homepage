(() => {
  'use strict';

  const catalog = window.__SMIREL_STELLAR_CATALOG__;
  if (!Array.isArray(catalog) || catalog.__smirelFieldLayouts) return;

  // Production Blog stars are authored once against the deterministic bright field.
  // This set was selected from the real 14,800-star field against a 5x5 pointer-camera
  // grid and desktop aspect ratios from 16:10 through 2.0. Every fixed star keeps a
  // viewport-safe projection envelope, and companion stars stay clear of the other
  // three primary-field target regions. Runtime never re-picks these identities.
  const FIXED_INDICES = Object.freeze({
    blog: 4887,
    'building-homepage': 12211,
    'opengl-liquid-glass': 663,
    'computer-use-design': 11720,
    'gan-hemt-stability': 836,
    'ai-ledger-real-streaming': 8312,
    'app-performance-optimization': 10767,
    'compose-parent-bubble-rendering': 7845,
    'ai-listing-research': 5118,
  });

  const LOCAL_DEPTH = Object.freeze([18, 32]);
  const COMPANION_MIN_BRIGHTNESS = 0.82;

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
      // Fallback targets mirror the centre-camera projection of the fixed stars.
      // BLOG stays low; an upper branch climbs through the left/middle sky and a
      // second branch opens to the right. The graph is deliberately open, never a ring.
      centre: [-0.5293, -0.5704],
      offsets: {
        'building-homepage': [-0.0439, 0.2462],
        'opengl-liquid-glass': [-0.0507, 0.6893],
        'computer-use-design': [0.0047, 0.9518],
        'gan-hemt-stability': [0.1918, 0.8480],
        'ai-ledger-real-streaming': [0.5271, 0.6922],
        'app-performance-optimization': [0.5332, 0.4085],
        'compose-parent-bubble-rendering': [0.2248, 0.1905],
        'ai-listing-research': [0.2649, -0.0353],
      },
      edges: [
        ['blog', 'building-homepage'],
        ['building-homepage', 'opengl-liquid-glass'],
        ['opengl-liquid-glass', 'computer-use-design'],
        ['computer-use-design', 'gan-hemt-stability'],
        ['gan-hemt-stability', 'ai-ledger-real-streaming'],
        ['blog', 'compose-parent-bubble-rendering'],
        ['compose-parent-bubble-rendering', 'app-performance-optimization'],
        ['compose-parent-bubble-rendering', 'ai-listing-research'],
      ],
    }),

    // Keep the production Contact composition exactly as it was in the pinned release.
    contact: makeFieldLayout({
      centre: [0.54, 0.46],
      offsets: {
        'contact-github': [-0.18, 0.12],
        'contact-email': [0.18, 0.12],
        'contact-phone': [-0.12, -0.16],
        'contact-qq': [0.16, -0.16],
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
    const isPrimary = item.kind === 'field';
    const star = target && item.star
      ? Object.freeze({
          ...item.star,
          target,
          depth: LOCAL_DEPTH,
          minBrightness: isPrimary
            ? Math.min(item.star.minBrightness ?? 1.8, 1.30)
            : COMPANION_MIN_BRIGHTNESS,
          ...(hasFixedIndex ? { fixedIndex } : {}),
        })
      : item.star;

    if (isPrimary && layout) {
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
    /* Label direction follows free screen space around the fixed projection envelope. */
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="opengl-liquid-glass"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="gan-hemt-stability"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="ai-ledger-real-streaming"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="app-performance-optimization"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="ai-listing-research"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-github"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-phone"] .smirel-companion-label {
      left: auto;
      right: 36px;
      align-items: flex-end;
      text-align: right;
    }

    .smirel-companion-star[data-parent-field="blog"][data-companion-id="opengl-liquid-glass"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="ai-ledger-real-streaming"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-github"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-email"] .smirel-companion-label {
      top: -15px;
    }

    .smirel-companion-star[data-parent-field="blog"][data-companion-id="building-homepage"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="gan-hemt-stability"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="app-performance-optimization"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="compose-parent-bubble-rendering"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-phone"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-qq"] .smirel-companion-label {
      top: 19px;
    }

    .smirel-companion-star[data-parent-field="blog"][data-companion-id="computer-use-design"] .smirel-companion-label {
      top: -25px;
    }

    .smirel-companion-star[data-parent-field="blog"][data-companion-id="ai-listing-research"] .smirel-companion-label {
      top: 27px;
    }
  `;
  document.head.appendChild(style);
})();
