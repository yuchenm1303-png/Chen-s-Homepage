(() => {
  'use strict';

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function' || baseInstall.__smirelVisibleTwinkle) return;

  function replaceExactlyOnce(source, search, replacement, label) {
    const index = source.indexOf(search);
    if (index < 0) {
      throw new Error(`[homepage-star-visible-twinkle] ${label} marker not found`);
    }
    if (source.indexOf(search, index + search.length) >= 0) {
      throw new Error(`[homepage-star-visible-twinkle] ${label} marker is ambiguous`);
    }
    return source.slice(0, index) + replacement + source.slice(index + search.length);
  }

  function patchVisibleTwinkle(material) {
    if (!material?.vertexShader || material.userData?.smirelVisibleTwinkle) return false;

    const isBright = material.vertexShader.includes('varying float vRayStrength;');
    const isMicro = material.vertexShader.includes('varying float vFluxCompensation;');
    if (!isBright && !isMicro) return false;

    let vertex = material.vertexShader;

    // The shader clock is already live. Make the visible cycle fast enough that
    // a stationary viewer can recognise a change within a couple of seconds.
    vertex = replaceExactlyOnce(
      vertex,
      '  float twinklePrimary = sin(twinklePhase + uTime * uTwinkleSpeed * twinkleRate);',
      `  float twinklePrimary = sin(
    twinklePhase + uTime * uTwinkleSpeed * twinkleRate * ${isBright ? '2.35' : '2.75'}
  );`,
      isBright ? 'bright twinkle clock' : 'micro twinkle clock',
    );

    if (isBright) {
      // Bright points were only modulating HDR emission. ACES compresses that
      // strongly, while alpha and point diameter previously moved by only a few
      // percent. Tie those directly to the same phase so the star core and halo
      // visibly contract, dim, expand and flash without adding extra trig work.
      vertex = replaceExactlyOnce(
        vertex,
        '  vOpacity = starOpacity * (0.92 + twinkle * 0.08);',
        `  float smirelVisibleTwinkle = clamp(
    0.72 + twinklePrimary * 0.23 + twinkleFine * 0.09 + twinkleSpark * 0.28,
    0.42,
    1.0
  );
  vOpacity = starOpacity * smirelVisibleTwinkle;`,
        'bright alpha scintillation',
      );
      vertex = replaceExactlyOnce(
        vertex,
        '    * (0.97 + twinkle * 0.03) * introParticleScale;',
        '    * clamp(0.78 + smirelVisibleTwinkle * 0.38, 0.88, 1.16) * introParticleScale;',
        'bright halo-size scintillation',
      );
    } else {
      // Micro stars had no alpha or size modulation at all, so their changing
      // emission was effectively tone-mapped into a static-looking field.
      vertex = replaceExactlyOnce(
        vertex,
        '  vOpacity = starOpacity * smoothstep(0.0, 0.62, uIntroProgress);',
        `  float smirelVisibleTwinkle = clamp(
    0.84 + twinklePrimary * 0.11 + twinkleFine * 0.05 + twinkleSpark * 0.10,
    0.66,
    1.0
  );
  vOpacity = starOpacity * smoothstep(0.0, 0.62, uIntroProgress) * smirelVisibleTwinkle;`,
        'micro alpha scintillation',
      );
      vertex = replaceExactlyOnce(
        vertex,
        '  float opticalDiameter = uPixelRatio * (0.34 + starScale * 3.0) * depthScale;',
        `  float opticalDiameter = uPixelRatio * (0.34 + starScale * 3.0) * depthScale
    * (0.86 + smirelVisibleTwinkle * 0.14);`,
        'micro size scintillation',
      );
    }

    material.vertexShader = vertex;
    material.userData = material.userData || {};
    material.userData.smirelVisibleTwinkle = true;
    material.needsUpdate = true;
    return true;
  }

  const visibleTwinkleInstall = function installVisibleTwinkle(context) {
    const controller = baseInstall(context);
    const { scene, reducedMotion } = context || {};
    if (!scene?.traverse || reducedMotion === true) return controller;

    const materials = new Set();
    let patchedCount = 0;
    scene.traverse((object) => {
      if (!object?.isPoints) return;
      if (!object.geometry?.getAttribute?.('starBrightness')) return;
      const material = object.material;
      if (!material || materials.has(material)) return;
      materials.add(material);
      try {
        if (patchVisibleTwinkle(material)) patchedCount += 1;
      } catch (error) {
        console.warn('[homepage-star-visible-twinkle] material patch failed', error);
      }
    });

    if (patchedCount < 2) {
      console.warn(`[homepage-star-visible-twinkle] expected bright + micro materials, patched ${patchedCount}`);
    }

    return controller;
  };

  visibleTwinkleInstall.__smirelVisibleTwinkle = true;
  window[INSTALL_KEY] = visibleTwinkleInstall;
})();
