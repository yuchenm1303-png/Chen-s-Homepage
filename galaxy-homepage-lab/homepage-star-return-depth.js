(() => {
  'use strict';

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function' || baseInstall.__smirelReturnDepthMatched) return;

  function replaceExactlyOnce(source, search, replacement, label) {
    const index = source.indexOf(search);
    if (index < 0) {
      throw new Error(`[homepage-star-return-depth] ${label} marker not found; refusing to patch an unknown flight revision.`);
    }
    if (source.indexOf(search, index + search.length) >= 0) {
      throw new Error(`[homepage-star-return-depth] ${label} marker is ambiguous; refusing to patch.`);
    }
    return source.slice(0, index) + replacement + source.slice(index + search.length);
  }

  let source = baseInstall.toString();

  // Outbound travel is distance-aware after homepage-star-depth.js, while the
  // baseline return still collapses the same distance into a fixed 2.2 seconds.
  // Recompute return duration from the exact endpoint-to-home distance using the
  // same timing law so the perceived world scale stays symmetric.
  source = replaceExactlyOnce(
    source,
    `      state.startedAt = performance.now();
      state.duration = RETURN_DURATION_MS;
      state.returnStartPosition.copy(camera.position);
      state.returnStartQuaternion.copy(camera.quaternion);
      state.returnStartFov = camera.fov;`,
    `      state.startedAt = performance.now();
      state.returnStartPosition.copy(camera.position);
      const returnDistance = state.returnStartPosition.distanceTo(state.homePosition);
      state.duration = reducedMotion
        ? RETURN_DURATION_MS
        : THREE.MathUtils.clamp(4300 + returnDistance * 18, 5600, 7200);
      state.returnStartQuaternion.copy(camera.quaternion);
      state.returnStartFov = camera.fov;`,
    'Return duration symmetry',
  );

  // Traverse the exact outbound cubic in reverse instead of linearly lerping
  // home. Mirror the outbound FOV speed pulse as well. Position, curvature and
  // projection therefore communicate the same amount of depth in both directions.
  source = replaceExactlyOnce(
    source,
    `      camera.position.lerpVectors(state.returnStartPosition, state.homePosition, motion);
      camera.quaternion.slerpQuaternions(state.returnStartQuaternion, state.homeQuaternion, motion);
      camera.fov = THREE.MathUtils.lerp(state.returnStartFov, state.homeFov, motion);
      camera.updateProjectionMatrix();`,
    `      cubicBezier(
        camera.position,
        state.returnStartPosition,
        state.controlB,
        state.controlA,
        state.homePosition,
        motion,
      );
      camera.quaternion.slerpQuaternions(state.returnStartQuaternion, state.homeQuaternion, motion);
      const speedPulse = Math.sin(Math.PI * raw);
      camera.fov = THREE.MathUtils.lerp(state.returnStartFov, state.homeFov, motion) + speedPulse * 13.5;
      camera.updateProjectionMatrix();`,
    'Reverse Bezier return path',
  );

  let patchedInstall;
  try {
    patchedInstall = Function(`"use strict"; return (${source});`)();
  } catch (error) {
    console.error('[homepage-star-return-depth] failed to compile return-depth patch', error);
    return;
  }

  patchedInstall.__smirelDepthExpanded = baseInstall.__smirelDepthExpanded === true;
  patchedInstall.__smirelReturnDepthMatched = true;
  window[INSTALL_KEY] = patchedInstall;
})();
