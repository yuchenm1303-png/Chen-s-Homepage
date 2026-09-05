(() => {
  'use strict';

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function' || baseInstall.__smirelStarMotion) return;

  const BRIGHT_TWINKLE = '  float twinkle = 0.86 + 0.14 * sin(twinklePhase + uTime * uTwinkleSpeed * twinkleRate);';
  const MICRO_TWINKLE = '  float twinkle = 0.97 + 0.03 * sin(twinklePhase + uTime * uTwinkleSpeed * twinkleRate);';
  const VIEW_POSITION = '  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);';

  // Keep the existing two sine evaluations per vertex, but shape their positive
  // crest into a short bright spark. The previous revision clamped twinkle at
  // 1.0, so stars could only dim and recover; they never crossed further into
  // bloom and therefore did not read as visible scintillation.
  const BRIGHT_TWINKLE_REPLACEMENT = `  float twinklePrimary = sin(twinklePhase + uTime * uTwinkleSpeed * twinkleRate);
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

  // The million-scale micro field gets a much smaller asymmetric sparkle. This
  // keeps the background alive without turning the whole sky into synchronized
  // brightness noise or adding another expensive trigonometric sample.
  const MICRO_TWINKLE_REPLACEMENT = `  float twinklePrimary = sin(twinklePhase + uTime * uTwinkleSpeed * twinkleRate);
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

  // Keep the approved star distribution fixed. Motion is a tiny angular offset
  // evaluated in the vertex shader, so every original and depth-continuation
  // star participates without a per-frame CPU position update.
  const FLOW_REPLACEMENT = `  float smirelDepth = max(-position.z, 1.0);
  float smirelAngularX = position.x / smirelDepth;
  float smirelAngularY = position.y / smirelDepth;
  float smirelFlowClock = uTime * (0.18 + 0.08 * twinkleRate);
  float smirelWave = sin(
    twinklePhase * 0.43
    + smirelAngularX * 7.0
    + smirelAngularY * 11.0
    - smirelFlowClock
  );
  float smirelEddy = sin(
    twinklePhase * 1.17
    - smirelAngularY * 9.0
    + smirelAngularX * 4.0
    + smirelFlowClock * 0.73
  );
  float smirelFlowAmplitude = smirelDepth * 0.00085;
  vec3 smirelAnimatedPosition = position;
  smirelAnimatedPosition.x += (
    0.8290376 * smirelWave - 0.5591929 * smirelEddy * 0.28
  ) * smirelFlowAmplitude;
  smirelAnimatedPosition.y += (
    0.5591929 * smirelWave + 0.8290376 * smirelEddy * 0.28
  ) * smirelFlowAmplitude;
  smirelAnimatedPosition.z += sin(
    twinklePhase * 0.71 + smirelFlowClock * 0.91
  ) * smirelDepth * 0.00022;
  vec4 viewPosition = modelViewMatrix * vec4(smirelAnimatedPosition, 1.0);`;

  function replaceExactlyOnce(source, search, replacement, label) {
    const index = source.indexOf(search);
    if (index < 0) {
      throw new Error(`[homepage-star-motion] ${label} marker not found`);
    }
    if (source.indexOf(search, index + search.length) >= 0) {
      throw new Error(`[homepage-star-motion] ${label} marker is ambiguous`);
    }
    return source.slice(0, index) + replacement + source.slice(index + search.length);
  }

  function patchStarMaterial(material, reducedMotion) {
    if (!material?.vertexShader || material.userData?.smirelStarMotion) return false;

    const isBright = material.vertexShader.includes('varying float vRayStrength;');
    const isMicro = material.vertexShader.includes('varying float vFluxCompensation;');
    if (!isBright && !isMicro) return false;

    let vertex = material.vertexShader;
    vertex = replaceExactlyOnce(
      vertex,
      isBright ? BRIGHT_TWINKLE : MICRO_TWINKLE,
      isBright ? BRIGHT_TWINKLE_REPLACEMENT : MICRO_TWINKLE_REPLACEMENT,
      isBright ? 'bright-star twinkle' : 'micro-star twinkle',
    );

    if (!reducedMotion) {
      vertex = replaceExactlyOnce(
        vertex,
        VIEW_POSITION,
        FLOW_REPLACEMENT,
        isBright ? 'bright-star flow' : 'micro-star flow',
      );
    }

    material.vertexShader = vertex;
    material.userData = material.userData || {};
    material.userData.smirelStarMotion = true;
    material.needsUpdate = true;
    return true;
  }

  const starMotionInstall = function installStarMotion(context) {
    const controller = baseInstall(context);
    const { scene, reducedMotion } = context || {};
    if (!scene?.traverse) return controller;

    const materials = new Set();
    let patchedCount = 0;

    scene.traverse((object) => {
      if (!object?.isPoints) return;
      if (!object.geometry?.getAttribute?.('starBrightness')) return;
      const material = object.material;
      if (!material || materials.has(material)) return;
      materials.add(material);
      try {
        if (patchStarMaterial(material, reducedMotion === true)) patchedCount += 1;
      } catch (error) {
        console.warn('[homepage-star-motion] star material patch failed', error);
      }
    });

    if (patchedCount < 2) {
      console.warn(`[homepage-star-motion] expected bright + micro star materials, patched ${patchedCount}`);
    }

    return controller;
  };

  starMotionInstall.__smirelStarMotion = true;
  window[INSTALL_KEY] = starMotionInstall;
})();
