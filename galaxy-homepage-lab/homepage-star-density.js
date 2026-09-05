(() => {
  'use strict';

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function' || baseInstall.__smirelDensityBoosted) return;

  function replaceCount(source, from, to, expectedMatches, label) {
    const marker = `count: ${from}`;
    const matches = source.split(marker).length - 1;
    if (matches !== expectedMatches) {
      throw new Error(
        `[homepage-star-density] ${label} expected ${expectedMatches} count marker(s), found ${matches}; refusing to patch an unknown revision.`,
      );
    }
    return source.split(marker).join(`count: ${to}`);
  }

  function replaceUnique(source, marker, replacement, label) {
    const first = source.indexOf(marker);
    if (first < 0) {
      throw new Error(`[homepage-star-density] ${label} marker not found; refusing to patch an unknown revision.`);
    }
    if (source.indexOf(marker, first + marker.length) >= 0) {
      throw new Error(`[homepage-star-density] ${label} marker is ambiguous; refusing to patch.`);
    }
    return source.slice(0, first) + replacement + source.slice(first + marker.length);
  }

  let source = baseInstall.toString();

  // The two-million-star experiment proved that raw point count was no longer
  // translating into visible detail: most of the extra points were sub-pixel
  // and simply increased transparent overdraw. Keep the home-visible emphasis,
  // but bring the generated population back to a practical performance tier.
  //
  // Broad/deep generated population: 196k -> 400k.
  // Focused visible population: +280k.
  // Total generated deep-space population: about 680k stars.
  source = replaceCount(source, 12000, 30000, 2, 'bright continuation layers');
  source = replaceCount(source, 36000, 80000, 1, 'micro coherent continuation layer');
  source = replaceCount(source, 40000, 90000, 1, 'micro peripheral continuation layer');
  source = replaceCount(source, 16000, 30000, 1, 'bright ambient volume layer');
  source = replaceCount(source, 80000, 140000, 1, 'micro ambient volume layer');

  const flightMarker = '    const FLIGHT_DURATION_MS = reducedMotion ? 1100 : 4200;';
  const focusedVisibleVolume = `    // Retain a focused home-visible near/mid field, but at a density that does\n    // not overwhelm the GPU with largely redundant sub-pixel transparent points.\n    buildAmbientVolumeLayer(brightField, {\n      count: 40000,\n      seed: 0x484F4D45,\n      near: 55,\n      far: 420,\n      depthExponent: 1.30,\n      angularHalfX: 0.86,\n      angularHalfY: 0.58,\n      maxSourceBrightness: 2.0,\n      maxSourceScale: 1.45,\n      brightness: 0.42,\n      opacity: 0.30,\n      scale: 0.50,\n    });\n    if (microField) {\n      buildAmbientVolumeLayer(microField, {\n        count: 240000,\n        seed: 0x484F4D4D,\n        near: 48,\n        far: 480,\n        depthExponent: 1.38,\n        angularHalfX: 0.90,\n        angularHalfY: 0.62,\n        maxSourceBrightness: 1.18,\n        maxSourceScale: 0.26,\n        brightness: 0.50,\n        opacity: 0.46,\n        scale: 0.72,\n      });\n    }\n\n`;

  source = replaceUnique(
    source,
    flightMarker,
    focusedVisibleVolume + flightMarker,
    'Focused visible density insertion',
  );

  let denseInstall;
  try {
    denseInstall = Function(`"use strict"; return (${source});`)();
  } catch (error) {
    console.error('[homepage-star-density] failed to compile density-boosted star-flight installer', error);
    return;
  }

  denseInstall.__smirelDensityBoosted = true;
  window[INSTALL_KEY] = denseInstall;
})();
