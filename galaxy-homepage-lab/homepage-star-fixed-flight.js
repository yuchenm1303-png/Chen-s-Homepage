(() => {
  'use strict';

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function' || baseInstall.__smirelFixedFlightAnchors) return;

  // The catalog may carry a fixedIndex for authored content stars. Those identities
  // are design data, not hints: the flight controller must use that exact bright-field
  // particle and skip the runtime brightness/colour/avoidance search entirely.
  const marker = `      for (const object of catalog) {\n        const target = object.star?.target || [0, 0];`;
  const replacement = `      for (const object of catalog) {\n        const fixedIndex = object.star?.fixedIndex;\n        if (Number.isInteger(fixedIndex) && fixedIndex >= 0 && fixedIndex < positions.count) {\n          const position = new THREE.Vector3().fromBufferAttribute(positions, fixedIndex);\n          const naturalColor = new THREE.Color(\n            colors.getX(fixedIndex),\n            colors.getY(fixedIndex),\n            colors.getZ(fixedIndex),\n          );\n          anchors.set(object.id, {\n            object,\n            index: fixedIndex,\n            position,\n            naturalColor,\n            originalOpacity: opacity.getX(fixedIndex),\n            fixed: true,\n          });\n          usedAnchorIndices.add(fixedIndex);\n          scratch.projected.copy(position).project(camera);\n          chosenProjected.push({ x: scratch.projected.x, y: scratch.projected.y });\n          continue;\n        }\n\n        const target = object.star?.target || [0, 0];`;

  const source = baseInstall.toString();
  if (!source.includes(marker)) {
    console.warn('[homepage-star-fixed-flight] anchor resolver marker not found; leaving base flight untouched');
    return;
  }

  let patchedInstall;
  try {
    patchedInstall = new Function(`return (${source.replace(marker, replacement)});`)();
  } catch (error) {
    console.warn('[homepage-star-fixed-flight] failed to compile fixed-anchor flight installer', error);
    return;
  }

  patchedInstall.__smirelFixedFlightAnchors = true;
  window[INSTALL_KEY] = patchedInstall;
})();
