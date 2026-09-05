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

  // Preserve the approved near-field composition, then add two different kinds
  // of scale: coherent Milky Way continuation and a genuinely broad 3D ambient
  // star volume. The latter is sampled independently of the Milky Way band so
  // the home view itself gains visible breadth instead of merely pushing stars
  // outside the camera frustum.
  source = replaceOnce(
    source,
    '    const FLIGHT_DURATION_MS = reducedMotion ? 1100 : 4200;',
    `    const DEPTH_START = 12.0;
    const DEPTH_STRETCH = 4.4;
    const DEPTH_FAR = 1100;

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
          'clamp(9.0 / cameraDepth, 0.032, 2.05)',
        );
      }
      if (vertex.includes('clamp(9.0 / cameraDepth, 0.26, 1.12)')) {
        vertex = vertex.replace(
          'clamp(9.0 / cameraDepth, 0.26, 1.12)',
          'clamp(9.0 / cameraDepth, 0.026, 1.12)',
        );
      }
      if (vertex.includes('max(opticalDiameter, uPixelRatio * 0.58)')) {
        vertex = vertex.replace(
          'max(opticalDiameter, uPixelRatio * 0.58)',
          'max(opticalDiameter, uPixelRatio * 0.22)',
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
      const angularScaleX = options.angularScaleX ?? 1.0;
      const angularScaleY = options.angularScaleY ?? 1.0;
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
        const angularX = (sourcePosition.getX(sourceIndex) / sourceDepth) * angularScaleX;
        const angularY = (sourcePosition.getY(sourceIndex) / sourceDepth) * angularScaleY;
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
          0.018,
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

    function buildAmbientVolumeLayer(sourcePoints, options) {
      const sourceGeometry = sourcePoints?.geometry;
      const sourceBrightness = sourceGeometry?.getAttribute?.('starBrightness');
      const sourceColor = sourceGeometry?.getAttribute?.('starColor');
      const sourceOpacity = sourceGeometry?.getAttribute?.('starOpacity');
      const sourceScale = sourceGeometry?.getAttribute?.('starScale');
      const sourcePhase = sourceGeometry?.getAttribute?.('twinklePhase');
      const sourceRate = sourceGeometry?.getAttribute?.('twinkleRate');
      if (!sourceBrightness || !sourceColor || !sourceOpacity || !sourceScale
          || !sourcePhase || !sourceRate || !sourcePoints.material) return null;

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
        const sourceIndex = Math.min(sourceBrightness.count - 1, Math.floor(random() * sourceBrightness.count));
        const depthT = Math.pow(random(), options.depthExponent);
        const depth = THREE.MathUtils.lerp(options.near, options.far, depthT);
        const angularX = (random() * 2.0 - 1.0) * options.angularHalfX;
        const angularY = (random() * 2.0 - 1.0) * options.angularHalfY;
        const p = i * 3;

        positionsOut[p] = angularX * depth;
        positionsOut[p + 1] = angularY * depth;
        positionsOut[p + 2] = -depth;

        const sourceB = Math.min(sourceBrightness.getX(sourceIndex), options.maxSourceBrightness);
        const sourceS = Math.min(sourceScale.getX(sourceIndex), options.maxSourceScale);
        const variation = 0.82 + random() * 0.34;
        brightnessOut[i] = sourceB * options.brightness * variation;
        opacityOut[i] = THREE.MathUtils.clamp(
          sourceOpacity.getX(sourceIndex) * options.opacity * (0.78 + random() * 0.34),
          0.016,
          1.0,
        );
        scaleOut[i] = sourceS * options.scale * (0.78 + random() * 0.34);
        phaseOut[i] = sourcePhase.getX(sourceIndex) + random() * 6.28318530718;
        rateOut[i] = sourceRate.getX(sourceIndex) * (0.76 + random() * 0.46);
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
      points.userData.smirelAmbientVolume = true;
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

    // Coherent deep shells retain the original Milky Way identity.
    buildContinuationLayer(brightField, {
      count: 12000,
      seed: 0x44504545,
      near: 145,
      far: 700,
      depthExponent: 1.12,
      angularJitter: 0.028,
      angularScaleX: 1.08,
      angularScaleY: 1.05,
      brightness: 0.68,
      opacity: 0.50,
      scale: 0.60,
    });
    if (microField) {
      buildContinuationLayer(microField, {
        count: 36000,
        seed: 0x554C5452,
        near: 130,
        far: 780,
        depthExponent: 1.22,
        angularJitter: 0.042,
        angularScaleX: 1.12,
        angularScaleY: 1.08,
        brightness: 0.58,
        opacity: 0.54,
        scale: 0.66,
      });
    }

    // Peripheral copies keep the Milky Way structure alive outside the home
    // framing and become visible as the camera travels through the scene.
    buildContinuationLayer(brightField, {
      count: 12000,
      seed: 0x42524454,
      near: 190,
      far: 860,
      depthExponent: 1.08,
      angularJitter: 0.095,
      angularScaleX: 1.68,
      angularScaleY: 1.48,
      brightness: 0.46,
      opacity: 0.34,
      scale: 0.50,
    });
    if (microField) {
      buildContinuationLayer(microField, {
        count: 40000,
        seed: 0x57494445,
        near: 165,
        far: 930,
        depthExponent: 1.16,
        angularJitter: 0.135,
        angularScaleX: 1.88,
        angularScaleY: 1.64,
        brightness: 0.42,
        opacity: 0.40,
        scale: 0.56,
      });
    }

    // True wide-field background volume. Unlike the layers above, these stars
    // are not sampled from the narrow Milky Way angular distribution. Roughly a
    // third to a half of them are inside the home frustum immediately, while the
    // rest surround it and appear through parallax during flight.
    buildAmbientVolumeLayer(brightField, {
      count: 16000,
      seed: 0x414D4242,
      near: 95,
      far: 880,
      depthExponent: 1.24,
      angularHalfX: 1.48,
      angularHalfY: 0.86,
      maxSourceBrightness: 2.2,
      maxSourceScale: 1.55,
      brightness: 0.52,
      opacity: 0.38,
      scale: 0.56,
    });
    if (microField) {
      buildAmbientVolumeLayer(microField, {
        count: 80000,
        seed: 0x414D424D,
        near: 82,
        far: 1040,
        depthExponent: 1.34,
        angularHalfX: 1.55,
        angularHalfY: 0.92,
        maxSourceBrightness: 1.25,
        maxSourceScale: 0.28,
        brightness: 0.58,
        opacity: 0.52,
        scale: 0.78,
      });
    }

    const FLIGHT_DURATION_MS = reducedMotion ? 1100 : 4200;`,
    'Depth expansion insertion',
  );

  // The continuum raymarch spans t=6..62 from the home camera, with its far
  // nebula mass centred near t=47. Keep the interactive target inside that
  // luminous volume instead of selecting it from the surrounding deep shells.
  // The independent background volume now extends to roughly 1040 world units.
  source = replaceOnce(
    source,
    '          if (depth < 13 || depth > 38) continue;',
    '          if (depth < 36 || depth > 54) continue;',
    'Nebula-bounded anchor selection',
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
