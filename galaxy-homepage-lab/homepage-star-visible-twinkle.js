(() => {
  'use strict';

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function' || baseInstall.__smirelVisibleTwinkle) return;

  const BRIGHT_TWINKLE_BLOCK = `  float twinklePrimary = sin(twinklePhase + uTime * uTwinkleSpeed * twinkleRate);
  float twinkleFine = sin(
    twinklePhase * 1.731
    + uTime * uTwinkleSpeed * (1.91 + twinkleRate * 0.37)
  );
  float twinkleSignal = twinklePrimary * 0.78 + twinkleFine * 0.22;
  float twinkleSpark = pow(max(twinkleSignal, 0.0), 6.0);
  float twinkle = clamp(
    0.88 + twinklePrimary * 0.10 + twinkleFine * 0.035 + twinkleSpark * 0.42,
    0.72,
    1.38
  );`;

  const MICRO_TWINKLE_BLOCK = `  float twinklePrimary = sin(twinklePhase + uTime * uTwinkleSpeed * twinkleRate);
  float twinkleFine = sin(
    twinklePhase * 1.487
    + uTime * uTwinkleSpeed * (1.73 + twinkleRate * 0.31)
  );
  float twinkleSignal = twinklePrimary * 0.82 + twinkleFine * 0.18;
  float twinkleSpark = pow(max(twinkleSignal, 0.0), 8.0);
  float twinkle = clamp(
    0.95 + twinklePrimary * 0.045 + twinkleFine * 0.018 + twinkleSpark * 0.14,
    0.88,
    1.16
  );`;

  const BRIGHT_PULSE_BLOCK = `  // Each star derives its own clock from the existing random phase/rate data.
  // Every cycle is re-hashed, so a pulse can be skipped, shifted, widened or
  // strengthened independently instead of repeating a sinusoidal rhythm.
  float smirelStarSeed = fract(twinklePhase * 0.159154943 + twinkleRate * 0.618033989);
  smirelStarSeed = fract(smirelStarSeed * (smirelStarSeed + 33.33));
  smirelStarSeed = fract(smirelStarSeed * (smirelStarSeed + smirelStarSeed));
  float smirelPulseClock = uTime * uTwinkleSpeed * (0.62 + twinkleRate * 0.34)
    + smirelStarSeed * 11.731;
  float smirelPulseCycle = floor(smirelPulseClock);
  float smirelPulseLocal = fract(smirelPulseClock);
  float smirelPulseRandom = fract(
    (smirelPulseCycle + 1.0) * 0.1031 + smirelStarSeed * 0.11369
  );
  smirelPulseRandom = fract(smirelPulseRandom * (smirelPulseRandom + 33.33));
  smirelPulseRandom = fract(
    smirelPulseRandom * (smirelPulseRandom + smirelPulseRandom)
  );
  float smirelPulseCentre = 0.18
    + fract(smirelPulseRandom * 7.31 + smirelStarSeed * 3.17) * 0.64;
  float smirelPulseWidth = 0.055
    + fract(smirelPulseRandom * 13.73 + smirelStarSeed * 5.71) * 0.065;
  float smirelPulseStrength = 0.72
    + fract(smirelPulseRandom * 19.19 + smirelStarSeed * 8.23) * 0.28;
  float smirelPulseGate = step(0.52, smirelPulseRandom);
  float smirelPulseRise = smoothstep(
    smirelPulseCentre - smirelPulseWidth,
    smirelPulseCentre,
    smirelPulseLocal
  );
  float smirelPulseFall = 1.0 - smoothstep(
    smirelPulseCentre,
    smirelPulseCentre + smirelPulseWidth * 1.55,
    smirelPulseLocal
  );
  float smirelPulse = smirelPulseGate * smirelPulseRise * smirelPulseFall;
  smirelPulse *= smirelPulse;
  float twinkle = 0.92 + smirelPulse * (0.58 + smirelPulseStrength * 0.42);`;

  const MICRO_PULSE_BLOCK = `  // Micro stars use the same independent pulse model with a lower event rate
  // and smaller amplitude so the deep field shimmers without becoming noisy.
  float smirelStarSeed = fract(twinklePhase * 0.159154943 + twinkleRate * 0.754877666);
  smirelStarSeed = fract(smirelStarSeed * (smirelStarSeed + 27.17));
  smirelStarSeed = fract(smirelStarSeed * (smirelStarSeed + smirelStarSeed));
  float smirelPulseClock = uTime * uTwinkleSpeed * (0.68 + twinkleRate * 0.29)
    + smirelStarSeed * 17.173;
  float smirelPulseCycle = floor(smirelPulseClock);
  float smirelPulseLocal = fract(smirelPulseClock);
  float smirelPulseRandom = fract(
    (smirelPulseCycle + 1.0) * 0.0973 + smirelStarSeed * 0.17321
  );
  smirelPulseRandom = fract(smirelPulseRandom * (smirelPulseRandom + 29.79));
  smirelPulseRandom = fract(
    smirelPulseRandom * (smirelPulseRandom + smirelPulseRandom)
  );
  float smirelPulseCentre = 0.22
    + fract(smirelPulseRandom * 5.93 + smirelStarSeed * 2.71) * 0.56;
  float smirelPulseWidth = 0.045
    + fract(smirelPulseRandom * 11.41 + smirelStarSeed * 6.37) * 0.050;
  float smirelPulseStrength = 0.62
    + fract(smirelPulseRandom * 17.83 + smirelStarSeed * 9.19) * 0.38;
  float smirelPulseGate = step(0.76, smirelPulseRandom);
  float smirelPulseRise = smoothstep(
    smirelPulseCentre - smirelPulseWidth,
    smirelPulseCentre,
    smirelPulseLocal
  );
  float smirelPulseFall = 1.0 - smoothstep(
    smirelPulseCentre,
    smirelPulseCentre + smirelPulseWidth * 1.45,
    smirelPulseLocal
  );
  float smirelPulse = smirelPulseGate * smirelPulseRise * smirelPulseFall;
  smirelPulse *= smirelPulse;
  float twinkle = 0.97 + smirelPulse * (0.17 + smirelPulseStrength * 0.15);`;

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
    vertex = replaceExactlyOnce(
      vertex,
      isBright ? BRIGHT_TWINKLE_BLOCK : MICRO_TWINKLE_BLOCK,
      isBright ? BRIGHT_PULSE_BLOCK : MICRO_PULSE_BLOCK,
      isBright ? 'bright random pulse model' : 'micro random pulse model',
    );

    if (isBright) {
      vertex = replaceExactlyOnce(
        vertex,
        '  vOpacity = starOpacity * (0.92 + twinkle * 0.08);',
        `  float smirelVisibleTwinkle = 0.78 + smirelPulse * (0.16 + smirelPulseStrength * 0.06);
  vOpacity = starOpacity * smirelVisibleTwinkle;`,
        'bright pulse alpha',
      );
      vertex = replaceExactlyOnce(
        vertex,
        '    * (0.97 + twinkle * 0.03) * introParticleScale;',
        `    * (0.90 + smirelPulse * (0.22 + smirelPulseStrength * 0.10))
    * introParticleScale;`,
        'bright pulse halo-size',
      );
    } else {
      vertex = replaceExactlyOnce(
        vertex,
        '  vOpacity = starOpacity * smoothstep(0.0, 0.62, uIntroProgress);',
        `  float smirelVisibleTwinkle = 0.92 + smirelPulse * (0.055 + smirelPulseStrength * 0.025);
  vOpacity = starOpacity * smoothstep(0.0, 0.62, uIntroProgress) * smirelVisibleTwinkle;`,
        'micro pulse alpha',
      );
      vertex = replaceExactlyOnce(
        vertex,
        '  float opticalDiameter = uPixelRatio * (0.34 + starScale * 3.0) * depthScale;',
        `  float opticalDiameter = uPixelRatio * (0.34 + starScale * 3.0) * depthScale
    * (0.96 + smirelPulse * (0.07 + smirelPulseStrength * 0.04));`,
        'micro pulse size',
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
