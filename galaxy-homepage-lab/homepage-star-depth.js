(() => {
  'use strict';

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function' || baseInstall.__smirelDepthExpanded) return;

  function replaceOnce(input, search, replacement, label) {
    const index = input.indexOf(search);
    if (index < 0) {
      throw new Error(`[homepage-star-depth] ${label} marker not found; refusing to patch an unknown star-flight revision.`);
    }
    if (input.indexOf(search, index + search.length) >= 0) {
      throw new Error(`[homepage-star-depth] ${label} marker is ambiguous; refusing to patch.`);
    }
    return input.slice(0, index) + replacement + input.slice(index + search.length);
  }

  let source = baseInstall.toString();

  // The approved field was generated inside roughly 3..58 world units. Merely
  // moving those exact points farther away preserves the same projected star map
  // and still reads like a thin sky dome. Keep the original near/mid population,
  // stretch its rear half, then continue the volume with deterministic deep and
  // ultra-deep shells derived from the same angular Milky Way distribution.
  source = replaceOnce(
    source,
    '    const FLIGHT_DURATION_MS = reducedMotion ? 1100 : 4200;',
    `    const DEPTH_START = 12.0;
    const DEPTH_STRETCH = 3.6;
    const DEPTH_FAR = 480;

    function deepenPoints(pointsObject) {
      const geometry = pointsObject?.geometry;
      const position = geometry?.getAttribute?.('position');
      if (!position || pointsObject.userData?.smirelDepthExpanded) return;

      for (let i = 0; i < position.count; i += 1) {
        const depth = -position.getZ(i);
        if (!(depth > DEPTH_START)) continue;

        const deepenedDepth = DEPTH_START + (depth - DEPTH_START) * DEPTH_STRETCH;
        const ratio = deepenedDepth / depth;
        position.setXYZ(
          i,
          position.getX(i) * ratio,
          position.getY(i) * ratio,
          -deepenedDepth,
        );
      }

      position.needsUpdate = true;
      geometry.computeBoundingSphere?.();
      pointsObject.userData = pointsObject.userData || {};
      pointsObject.userData.smirelDepthExpanded = true;
    }

    function patchDepthResponse(pointsObject) {
      const material = pointsObject?.material;
      if (!material?.vertexShader || material.userData?.smirelDeepResponse) return;

      let vertex = material.vertexShader;
      if (vertex.includes('clamp(8.5 / cameraDepth, 0.28, 2.05)')) {
        vertex = vertex.replace(
          'clamp(8.5 / cameraDepth, 0.28, 2.05)',
          'clamp(9.0 / cameraDepth, 0.045, 2.05)',
        );
      }
      if (vertex.includes('clamp(9.0 / cameraDepth, 0.26, 1.12)')) {
        vertex = vertex.replace(
          'clamp(9.0 / cameraDepth, 0.26, 1.12)',
          'clamp(9.0 / cameraDepth, 0.035, 1.12)',
        );
      }
      if (vertex.includes('max(opticalDiameter, uPixelRatio * 0.58)')) {
        vertex = vertex.replace(
          'max(opticalDiameter, uPixelRatio * 0.58)',
          'max(opticalDiameter, uPixelRatio * 0.24)',
        );
      }

      material.vertexShader = vertex;
      material.userData = material.userData || {};
      material.userData.smirelDeepResponse = true;
      material.needsUpdate = true;
    }

    function seededDepthRandom(seed) {
      let value = seed >>> 0;
      return () => {
        value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
        return value / 4294967296;
      };
    }

    function buildContinuationLayer(sourcePoints, options) {
      const sourceGeometry = sourcePoints?.geometry;
      const sourcePosition = sourceGeometry?.getAttribute?.('position');
      const sourceBrightness = sourceGeometry?.getAttribute?.('starBrightness');
      const sourceColor = sourceGeometry?.getAttribute?.('starColor');
      const sourceOpacity = sourceGeometry?.getAttribute?.('starOpacity');
      const sourceScale = sourceGeometry?.getAttribute?.('starScale');
      const sourcePhase = sourceGeometry?.getAttribute?.('twinklePhase');
      const sourceRate = sourceGeometry?.getAttribute?.('twinkleRate');
      if (!sourcePosition || !sourceBrightness || !sourceColor || !sourceOpacity
          || !sourceScale || !sourcePhase || !sourceRate || !sourcePoints.material) return null;

      const count = options.count;
      const random = seededDepthRandom(options.seed);
      const geometry = new THREE.BufferGeometry();
      const positionsOut = new Float32Array(count * 3);
      const brightnessOut = new Float32Array(count);
      const colorsOut = new Float32Array(count * 3);
      const opacityOut = new Float32Array(count);
      const scaleOut = new Float32Array(count);
      const phaseOut = new Float32Array(count);
      const rateOut = new Float32Array(count);

      for (let i = 0; i < count; i += 1) {
        const sourceIndex = Math.min(sourcePosition.count - 1, Math.floor(random() * sourcePosition.count));
        const sourceDepth = Math.max(-sourcePosition.getZ(sourceIndex), 1.0);
        const angularX = sourcePosition.getX(sourceIndex) / sourceDepth;
        const angularY = sourcePosition.getY(sourceIndex) / sourceDepth;
        const jitterX = (random() + random() - 1.0) * options.angularJitter;
        const jitterY = (random() + random() - 1.0) * options.angularJitter * 0.72;
        const depthT = Math.pow(random(), options.depthExponent);
        const depth = THREE.MathUtils.lerp(options.near, options.far, depthT);
        const p = i * 3;

        positionsOut[p] = (angularX + jitterX) * depth;
        positionsOut[p + 1] = (angularY + jitterY) * depth;
        positionsOut[p + 2] = -depth;

        const variation = 0.86 + random() * 0.28;
        brightnessOut[i] = sourceBrightness.getX(sourceIndex) * options.brightness * variation;
        opacityOut[i] = THREE.MathUtils.clamp(
          sourceOpacity.getX(sourceIndex) * options.opacity * (0.80 + random() * 0.30),
          0.025,
          1.0,
        );
        scaleOut[i] = sourceScale.getX(sourceIndex) * options.scale * (0.82 + random() * 0.30);
        phaseOut[i] = sourcePhase.getX(sourceIndex) + random() * 6.28318530718;
        rateOut[i] = sourceRate.getX(sourceIndex) * (0.82 + random() * 0.38);
        colorsOut[p] = sourceColor.getX(sourceIndex);
        colorsOut[p + 1] = sourceColor.getY(sourceIndex);
        colorsOut[p + 2] = sourceColor.getZ(sourceIndex);
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positionsOut, 3));
      geometry.setAttribute('starBrightness', new THREE.BufferAttribute(brightnessOut, 1));
      geometry.setAttribute('starColor', new THREE.BufferAttribute(colorsOut, 3));
      geometry.setAttribute('starOpacity', new THREE.BufferAttribute(opacityOut, 1));
      geometry.setAttribute('starScale', new THREE.BufferAttribute(scaleOut, 1));
      geometry.setAttribute('twinklePhase', new THREE.BufferAttribute(phaseOut, 1));
      geometry.setAttribute('twinkleRate', new THREE.BufferAttribute(rateOut, 1));
      geometry.computeBoundingSphere();

      const points = new THREE.Points(geometry, sourcePoints.material);
      points.frustumCulled = false;
      points.renderOrder = sourcePoints.renderOrder;
      points.userData.smirelDepthContinuation = true;
      scene.add(points);
      return points;
    }

    camera.far = Math.max(camera.far, DEPTH_FAR);
    camera.updateProjectionMatrix();

    const originalStarFields = [];
    scene.traverse((object) => {
      if (!object?.isPoints) return;
      if (!object.geometry?.getAttribute?.('starBrightness')) return;
      originalStarFields.push(object);
    });

    for (const pointsObject of originalStarFields) {
      deepenPoints(pointsObject);
      patchDepthResponse(pointsObject);
    }

    const microField = originalStarFields.find((object) => object !== brightField) || null;
    buildContinuationLayer(brightField, {
      count: 5200,
      seed: 0x44504545,
      near: 165,
      far: 350,
      depthExponent: 1.08,
      angularJitter: 0.012,
      brightness: 0.74,
      opacity: 0.56,
      scale: 0.64,
    });
    if (microField) {
      buildContinuationLayer(microField, {
        count: 16800,
        seed: 0x554C5452,
        near: 150,
        far: 455,
        depthExponent: 1.16,
        angularJitter: 0.018,
        brightness: 0.66,
        opacity: 0.62,
        scale: 0.72,
      });
    }

    const FLIGHT_DURATION_MS = reducedMotion ? 1100 : 4200;`,
    'Depth expansion insertion',
  );

  // Keep the test anchor in the rear half of the original bright field. The new
  // continuation layers extend far beyond it, so the star no longer defines the
  // perceived edge of the universe.
  source = replaceOnce(
    source,
    '          if (depth < 13 || depth > 38) continue;',
    '          if (depth < 92 || depth > 150) continue;',
    'Deep anchor selection',
  );

  source = replaceOnce(
    source,
    '      const travelLength = travelVector.length();',
    `      const travelLength = travelVector.length();
      if (!reducedMotion) {
        state.duration = THREE.MathUtils.clamp(4300 + travelLength * 18, 5600, 7200);
      }`,
    'Distance-aware flight duration',
  );

  let patchedInstall;
  try {
    patchedInstall = Function(`"use strict"; return (${source});`)();
  } catch (error) {
    console.error('[homepage-star-depth] failed to compile patched star-flight installer', error);
    return;
  }

  patchedInstall.__smirelDepthExpanded = true;
  window[INSTALL_KEY] = patchedInstall;
})();
