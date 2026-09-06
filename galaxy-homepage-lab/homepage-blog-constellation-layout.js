(() => {
  'use strict';

  const catalog = window.__SMIREL_STELLAR_CATALOG__;
  if (!Array.isArray(catalog) || catalog.__smirelFieldLayouts) return;

  // Production Blog stars are authored once against the deterministic bright field.
  // Their indices are stable identities; runtime resolvers must not re-pick them.
  const FIXED_INDICES = Object.freeze({
    blog: 5596,
    'building-homepage': 2630,
    'opengl-liquid-glass': 2091,
    'computer-use-design': 12368,
    'gan-hemt-stability': 13739,
    'ai-ledger-real-streaming': 3699,
    'app-performance-optimization': 11690,
    'compose-parent-bubble-rendering': 9499,
    'ai-listing-research': 7482,
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
      // Screen composition is intentionally open and asymmetric: BLOG remains the
      // visual hub while four direct spokes establish hierarchy and the remaining
      // articles continue through short natural branches. There is no closed loop.
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
        ['blog', 'app-performance-optimization'],
        ['blog', 'compose-parent-bubble-rendering'],
        ['opengl-liquid-glass', 'computer-use-design'],
        ['computer-use-design', 'gan-hemt-stability'],
        ['gan-hemt-stability', 'ai-ledger-real-streaming'],
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
    /* Labels point into free screen space rather than all expanding toward the
       same side. This keeps the authored fixed-star silhouette readable. */
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="opengl-liquid-glass"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="ai-ledger-real-streaming"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="compose-parent-bubble-rendering"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="ai-listing-research"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-github"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-phone"] .smirel-companion-label {
      left: auto;
      right: 36px;
      align-items: flex-end;
      text-align: right;
    }

    .smirel-companion-star[data-parent-field="blog"][data-companion-id="opengl-liquid-glass"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="computer-use-design"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="gan-hemt-stability"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="ai-ledger-real-streaming"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="ai-listing-research"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-github"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-email"] .smirel-companion-label {
      top: -15px;
    }

    .smirel-companion-star[data-parent-field="blog"][data-companion-id="building-homepage"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="app-performance-optimization"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="compose-parent-bubble-rendering"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-phone"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-qq"] .smirel-companion-label {
      top: 19px;
    }

    .smirel-companion-star[data-parent-field="blog"][data-companion-id="computer-use-design"] .smirel-companion-label {
      top: -25px;
    }
  `;
  document.head.appendChild(style);
})();
