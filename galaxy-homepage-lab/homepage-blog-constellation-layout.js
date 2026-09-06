(() => {
  'use strict';

  const catalog = window.__SMIREL_STELLAR_CATALOG__;
  if (!Array.isArray(catalog) || catalog.__smirelFieldLayouts) return;

  // Production Blog stars are authored once against the deterministic bright field.
  // This set was selected from the real 14,800-star field against 25 pointer-camera
  // positions across desktop aspect ratios from 16:10 through 2.0. The hard filters
  // include the complete label boxes as well as the star centres, so neither the star
  // nor its copy can leave the viewport or collide with another Blog label. Runtime
  // never re-picks these identities.
  const FIXED_INDICES = Object.freeze({
    blog: 1363,
    'building-homepage': 14646,
    'opengl-liquid-glass': 6737,
    'computer-use-design': 3645,
    'gan-hemt-stability': 14687,
    'ai-ledger-real-streaming': 4657,
    'app-performance-optimization': 10767,
    'compose-parent-bubble-rendering': 3646,
    'ai-listing-research': 8,
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
      // The composition uses the broad left/middle screen field: BLOG sits low while
      // two irregular open branches rise through separate pockets of free sky.
      centre: [-0.2248, -0.5473],
      offsets: {
        'building-homepage': [-0.3499, 0.8066],
        'opengl-liquid-glass': [-0.3470, 0.5484],
        'computer-use-design': [0.2226, 0.7689],
        'gan-hemt-stability': [0.0294, 0.8854],
        'ai-ledger-real-streaming': [0.0216, 0.5923],
        'app-performance-optimization': [0.2287, 0.4064],
        'compose-parent-bubble-rendering': [-0.2879, 0.2116],
        'ai-listing-research': [0.1066, 0.1186],
      },
      edges: [
        ['blog', 'compose-parent-bubble-rendering'],
        ['compose-parent-bubble-rendering', 'opengl-liquid-glass'],
        ['opengl-liquid-glass', 'building-homepage'],
        ['blog', 'ai-listing-research'],
        ['ai-listing-research', 'app-performance-optimization'],
        ['app-performance-optimization', 'ai-ledger-real-streaming'],
        ['ai-ledger-real-streaming', 'gan-hemt-stability'],
        ['gan-hemt-stability', 'computer-use-design'],
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
    /* Label direction is part of the authored projection-safe composition. */
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="computer-use-design"] .smirel-companion-label,
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
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="gan-hemt-stability"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="ai-ledger-real-streaming"] .smirel-companion-label,
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

    .smirel-companion-star[data-parent-field="blog"][data-companion-id="ai-listing-research"] .smirel-companion-label {
      top: 27px;
    }
  `;
  document.head.appendChild(style);
})();
