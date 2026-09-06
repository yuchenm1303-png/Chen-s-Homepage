(() => {
  'use strict';

  const catalog = window.__SMIREL_STELLAR_CATALOG__;
  if (!Array.isArray(catalog) || catalog.__smirelFieldLayouts) return;

  // Production Blog stars are authored once against the deterministic bright field.
  // These indices were selected against a multi-view projection envelope: several
  // desktop aspect ratios and the full pointer-driven camera range. Runtime never
  // re-picks them, so the constellation remains the same authored object on every load.
  const FIXED_INDICES = Object.freeze({
    blog: 5596,
    'building-homepage': 518,
    'opengl-liquid-glass': 8004,
    'computer-use-design': 11877,
    'gan-hemt-stability': 2817,
    'ai-ledger-real-streaming': 14386,
    'app-performance-optimization': 10179,
    'compose-parent-bubble-rendering': 7399,
    'ai-listing-research': 350,
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
      // Author the fallback targets from the centre-camera screen projection of the
      // fixed stars. The silhouette deliberately occupies a broad left/middle field:
      // BLOG anchors the lower-left while two open branches rise through the free sky.
      centre: [-0.5673, -0.4530],
      offsets: {
        'building-homepage': [-0.1232, 0.2223],
        'opengl-liquid-glass': [-0.1267, 0.4649],
        'computer-use-design': [0.0321, 0.7020],
        'gan-hemt-stability': [0.4909, 0.8511],
        'ai-ledger-real-streaming': [0.2659, 0.8328],
        'app-performance-optimization': [0.4996, 0.4759],
        'compose-parent-bubble-rendering': [0.2106, 0.2244],
        'ai-listing-research': [0.1786, -0.1517],
      },
      edges: [
        ['blog', 'building-homepage'],
        ['building-homepage', 'opengl-liquid-glass'],
        ['opengl-liquid-glass', 'computer-use-design'],
        ['computer-use-design', 'ai-ledger-real-streaming'],
        ['ai-ledger-real-streaming', 'gan-hemt-stability'],
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
    /* Point long labels into the free side of the authored screen composition.
       Left-edge stars intentionally keep their labels on the right so pointer
       parallax cannot push the copy outside the viewport. */
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="computer-use-design"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="ai-ledger-real-streaming"] .smirel-companion-label,
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
    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-github"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="contact"][data-companion-id="contact-email"] .smirel-companion-label {
      top: -15px;
    }

    .smirel-companion-star[data-parent-field="blog"][data-companion-id="building-homepage"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="app-performance-optimization"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="compose-parent-bubble-rendering"] .smirel-companion-label,
    .smirel-companion-star[data-parent-field="blog"][data-companion-id="ai-listing-research"] .smirel-companion-label,
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
