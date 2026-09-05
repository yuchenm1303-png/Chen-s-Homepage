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

  // Preserve the current angular composition while expanding only the world-space
  // depth. Scaling x/y by the same depth ratio keeps each star in effectively the
  // same screen position at the home camera, but gives forward camera travel real
  // near/mid/far parallax and enough physical room to fly through the field.
  source = replaceOnce(
    source,
    '    const FLIGHT_DURATION_MS = reducedMotion ? 1100 : 4200;',
    `    const DEPTH_START = 12.0;
    const DEPTH_STRETCH = 3.6;
    const DEPTH_FAR = 220;

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

    camera.far = Math.max(camera.far, DEPTH_FAR);
    camera.updateProjectionMatrix();
    deepenPoints(brightField);
    scene.traverse((object) => {
      if (!object?.isPoints || object === brightField) return;
      if (!object.geometry?.getAttribute?.('starBrightness')) return;
      deepenPoints(object);
    });

    const FLIGHT_DURATION_MS = reducedMotion ? 1100 : 4200;`,
    'Depth expansion insertion',
  );

  // The previous prototype deliberately chose a nearby star (13..38 units),
  // which capped the perceived size of the whole universe. Select the test anchor
  // from the newly expanded far shell instead.
  source = replaceOnce(
    source,
    '          if (depth < 13 || depth > 38) continue;',
    '          if (depth < 92 || depth > 150) continue;',
    'Deep anchor selection',
  );

  // Scale travel time with the actual world-space journey. A deep target should
  // read as a journey rather than covering 3-4x the distance in the same 4.2 s.
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
