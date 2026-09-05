(() => {
  'use strict';

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function' || baseInstall.__smirelAnchorForeground) return;

  function replaceExactlyOnce(source, search, replacement, label) {
    const index = source.indexOf(search);
    if (index < 0) {
      throw new Error(`[homepage-star-anchor-placement] ${label} marker not found; refusing to patch an unknown flight revision.`);
    }
    if (source.indexOf(search, index + search.length) >= 0) {
      throw new Error(`[homepage-star-anchor-placement] ${label} marker is ambiguous; refusing to patch.`);
    }
    return source.slice(0, index) + replacement + source.slice(index + search.length);
  }

  let source = baseInstall.toString();

  // Main project stars belong in the foreground half of the nebula, not near its
  // rear boundary. The continuum has strong layers around t≈31 and t≈47, so an
  // anchor at 22..30 leaves both the mid and far Milky Way structure behind it
  // when the camera arrives roughly 3.2 units in front of the star.
  source = replaceExactlyOnce(
    source,
    '          if (depth < 36 || depth > 54) continue;',
    '          if (depth < 22 || depth > 30) continue;',
    'Foreground nebula anchor depth',
  );

  // Brightness alone can select a random field star sitting over a dark patch.
  // Score how much of the original bright-star volume remains in a narrow cone
  // behind each candidate. This biases the interactive anchor toward a genuinely
  // dense Milky Way sightline, so the arrival view still has visible depth and
  // stellar structure behind the enlarged star.
  source = replaceExactlyOnce(
    source,
    '          const score = b * 0.38 - centrePenalty * 3.2 + Math.min(depth, 30) * 0.012;',
    `          const candidateAngularX = scratch.world.x / Math.max(depth, 1.0);
          const candidateAngularY = scratch.world.y / Math.max(depth, 1.0);
          const supportRadius = 0.072;
          const supportRadiusSq = supportRadius * supportRadius;
          let backgroundSupport = 0;
          let backgroundCount = 0;

          for (let j = 0; j < positions.count; j += 1) {
            if (j === i) continue;
            const backgroundDepth = -positions.getZ(j);
            if (backgroundDepth < depth + 9 || backgroundDepth > 96) continue;

            const backgroundAngularX = positions.getX(j) / Math.max(backgroundDepth, 1.0);
            const backgroundAngularY = positions.getY(j) / Math.max(backgroundDepth, 1.0);
            const angularDx = backgroundAngularX - candidateAngularX;
            const angularDy = backgroundAngularY - candidateAngularY;
            const angularDistanceSq = angularDx * angularDx + angularDy * angularDy;
            if (angularDistanceSq > supportRadiusSq) continue;

            const proximity = 1.0 - Math.sqrt(angularDistanceSq) / supportRadius;
            backgroundSupport += Math.min(brightness.getX(j), 1.8) * proximity;
            backgroundCount += 1;
          }

          const supportScore = Math.min(backgroundSupport, 14.0) * 0.24
            + Math.min(backgroundCount, 24) * 0.028;
          const nebulaReserve = THREE.MathUtils.clamp((47.0 - depth) / 25.0, 0.0, 1.0);
          const score = b * 0.38
            - centrePenalty * 2.65
            + supportScore
            + nebulaReserve * 0.72;`,
    'Background-rich anchor score',
  );

  let patchedInstall;
  try {
    patchedInstall = Function(`"use strict"; return (${source});`)();
  } catch (error) {
    console.error('[homepage-star-anchor-placement] failed to compile anchor placement patch', error);
    return;
  }

  patchedInstall.__smirelDepthExpanded = baseInstall.__smirelDepthExpanded === true;
  patchedInstall.__smirelAnchorForeground = true;
  window[INSTALL_KEY] = patchedInstall;
})();
