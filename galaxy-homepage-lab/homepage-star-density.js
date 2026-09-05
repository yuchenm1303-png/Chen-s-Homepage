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

  let source = baseInstall.toString();

  // Density-only experiment: keep every approved spatial, brightness, opacity,
  // size, colour and flight parameter intact, and multiply only the generated
  // deep-space populations. The existing six continuation/ambient layers grow
  // from 196k generated stars to 490k generated stars.
  source = replaceCount(source, 12000, 30000, 2, 'bright continuation layers');
  source = replaceCount(source, 36000, 90000, 1, 'micro coherent continuation layer');
  source = replaceCount(source, 40000, 100000, 1, 'micro peripheral continuation layer');
  source = replaceCount(source, 16000, 40000, 1, 'bright ambient volume layer');
  source = replaceCount(source, 80000, 200000, 1, 'micro ambient volume layer');

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
