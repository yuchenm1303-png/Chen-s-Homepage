(() => {
  'use strict';

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function' || baseInstall.__smirelStableStarBinding) return;

  const bindingInstall = function installStableStarBinding(context) {
    const controller = baseInstall(context);
    if (!controller) return controller;

    const { scene } = context || {};
    let activeStarGroup = null;

    function locateActiveStarGroup() {
      const anchor = controller.activeAnchor;
      const anchorPosition = anchor?.position;
      if (!scene || !anchorPosition) {
        activeStarGroup = null;
        return null;
      }

      if (
        activeStarGroup?.parent
        && activeStarGroup.visible
        && activeStarGroup.position.distanceToSquared(anchorPosition) < 1e-8
      ) {
        return activeStarGroup;
      }

      let candidate = null;
      let candidateDistanceSq = Infinity;

      scene.traverse((object) => {
        if (!object?.isGroup || !object.visible || !Array.isArray(object.children)) return;

        let meshCount = 0;
        let hasSprite = false;
        for (const child of object.children) {
          if (child?.isMesh) meshCount += 1;
          if (child?.isSprite) hasSprite = true;
        }
        if (meshCount < 2 || !hasSprite) return;

        const distanceSq = object.position.distanceToSquared(anchorPosition);
        if (distanceSq < candidateDistanceSq) {
          candidate = object;
          candidateDistanceSq = distanceSq;
        }
      });

      if (!candidate || candidateDistanceSq > 1e-4) {
        activeStarGroup = null;
        return null;
      }

      activeStarGroup = candidate;
      activeStarGroup.userData.smirelActiveStar = true;

      // Compatibility bridge for the current detail view. The detail locator used
      // to infer the active star from a shader implementation string. Keep that
      // legacy path alive without recompiling or changing the actual shader while
      // exposing activeStarGroup as the stable API for future detail code.
      const core = activeStarGroup.children.find(
        (child) => child?.isMesh && typeof child.material?.fragmentShader === 'string'
      );
      const legacyMarker = 'float convection = noise3(p * 4.2';
      if (core && !core.material.fragmentShader.includes(legacyMarker)) {
        core.material.fragmentShader += `\n// ${legacyMarker} -- smirel stable detail binding marker\n`;
      }

      return activeStarGroup;
    }

    const baseUpdate = controller.update.bind(controller);
    controller.update = (now, dt, elapsed) => {
      const ownsCamera = baseUpdate(now, dt, elapsed);
      if (document.body.classList.contains('star-flight-active')) {
        locateActiveStarGroup();
      } else {
        activeStarGroup = null;
      }
      return ownsCamera;
    };

    Object.defineProperty(controller, 'activeStarGroup', {
      configurable: true,
      get: locateActiveStarGroup,
    });

    return controller;
  };

  bindingInstall.__smirelStableStarBinding = true;
  window[INSTALL_KEY] = bindingInstall;
})();
