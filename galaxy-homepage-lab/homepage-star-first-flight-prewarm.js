(() => {
  'use strict';

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function' || baseInstall.__smirelWorldStarPrewarmV1) return;

  const IDLE_TIMEOUT_MS = 160;

  const prewarmInstall = function installWorldStarPrewarm(context) {
    const controller = baseInstall(context);
    if (!controller) return controller;

    const { THREE, renderer, camera } = context || {};
    if (!THREE || !camera) return controller;

    const baseUpdate = typeof controller.update === 'function'
      ? controller.update.bind(controller)
      : null;

    let buildRequested = false;
    let compileStarted = false;
    let compileReady = false;
    let warmPromise = null;

    function finalModelReady() {
      const model = controller.stellarModel;
      const coreMaterial = model?.photosphere?.material;
      return Boolean(
        model?.group?.parent
        && model?.photosphere
        && model?.chromosphere
        && model?.corona
        && model?.activity
        && coreMaterial?.uniforms?.uEmissionBoost
        && typeof coreMaterial.fragmentShader === 'string'
        && coreMaterial.fragmentShader.includes('noise3(p * 34.0 + vec3(6.7, 11.2, 13.0))')
      );
    }

    function buildDuringIdle() {
      if (buildRequested) return;
      buildRequested = true;

      const build = () => {
        if (document.body.classList.contains('star-flight-active')) return;
        try {
          controller.prewarmWorldStar?.();
        } catch (error) {
          console.warn('[homepage-star-prewarm] world-star allocation failed', error);
        }
      };

      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(build, { timeout: IDLE_TIMEOUT_MS });
      } else {
        setTimeout(build, 48);
      }
    }

    function compileFinalWorldStar() {
      if (compileReady || compileStarted || !renderer || !finalModelReady()) return;
      if (document.body.classList.contains('star-flight-active')) return;

      const model = controller.stellarModel;
      const warmScene = new THREE.Scene();
      const warmGroup = model.group.clone(true);
      warmGroup.visible = true;
      warmGroup.position.set(0, 0, -4);
      warmGroup.scale.setScalar(0.4);
      warmScene.add(warmGroup);
      compileStarted = true;

      const finish = () => {
        warmScene.remove(warmGroup);
        compileReady = true;
        compileStarted = false;
        window.__SMIREL_WORLD_STAR_PREWARM_READY__ = true;
      };

      const fail = (error) => {
        warmScene.remove(warmGroup);
        compileStarted = false;
        console.warn('[homepage-star-prewarm] main-renderer compile failed; continuing with lazy compile', error);
      };

      try {
        if (typeof renderer.compileAsync === 'function') {
          warmPromise = renderer.compileAsync(warmScene, camera)
            .then(finish)
            .catch(fail);
        } else if (typeof renderer.compile === 'function') {
          renderer.compile(warmScene, camera);
          finish();
          warmPromise = Promise.resolve();
        }
      } catch (error) {
        fail(error);
      }

      window.__SMIREL_WORLD_STAR_PREWARM_PROMISE__ = warmPromise;
    }

    if (baseUpdate) {
      controller.update = (now, dt, elapsed) => {
        const ownsCamera = baseUpdate(now, dt, elapsed);
        if (!compileReady && !compileStarted) compileFinalWorldStar();
        return ownsCamera;
      };
    }

    Object.defineProperty(controller, 'worldStarPrewarmReady', {
      configurable: true,
      get() { return compileReady; },
    });

    window.__SMIREL_WORLD_STAR_PREWARM_READY__ = false;
    buildDuringIdle();
    return controller;
  };

  prewarmInstall.__smirelWorldStarPrewarmV1 = true;
  window[INSTALL_KEY] = prewarmInstall;
})();
