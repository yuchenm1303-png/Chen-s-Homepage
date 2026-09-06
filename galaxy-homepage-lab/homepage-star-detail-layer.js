(() => {
  'use strict';

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function' || baseInstall.__smirelDetailStarLayer) return;

  const detailLayerInstall = function installDetailStarLayer(context) {
    const controller = baseInstall(context);
    if (!controller) return controller;

    const { THREE, scene, camera, reducedMotion } = context || {};
    if (!THREE || !scene || !camera) return controller;

    const DETAIL_STAR_LAYER = 7;
    const OPEN_MS = reducedMotion ? 1 : 1080;
    const CLOSE_MS = reducedMotion ? 1 : 840;

    const shell = document.querySelector('.star-detail-shell');
    const starHeader = shell?.querySelector('.star-detail-header') || null;
    const starSlot = shell?.querySelector('.star-detail-star-slot') || null;
    if (!shell || !starSlot) return controller;

    const detailCanvas = document.createElement('canvas');
    detailCanvas.className = 'star-detail-star-layer';
    detailCanvas.setAttribute('aria-hidden', 'true');
    Object.assign(detailCanvas.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '12',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      opacity: '0',
      visibility: 'hidden',
    });
    document.body.appendChild(detailCanvas);

    let detailRenderer = null;
    try {
      detailRenderer = new THREE.WebGLRenderer({
        canvas: detailCanvas,
        alpha: true,
        antialias: true,
        depth: true,
        powerPreference: 'high-performance',
      });
      detailRenderer.outputColorSpace = THREE.SRGBColorSpace;
      detailRenderer.toneMapping = THREE.NoToneMapping;
      detailRenderer.setClearColor(0x000000, 0);
    } catch (error) {
      console.warn('[homepage-star-detail-layer] overlay renderer unavailable', error);
      detailCanvas.remove();
      return controller;
    }

    const detailCamera = new THREE.PerspectiveCamera(camera.fov, 1, camera.near, camera.far);
    detailCamera.layers.set(DETAIL_STAR_LAYER);

    const arrivalPosition = new THREE.Vector3();
    const arrivalQuaternion = new THREE.Quaternion();
    let arrivalFov = camera.fov;
    let arrivalDepth = 3.2;

    const starPosition = new THREE.Vector3();
    const cameraBack = new THREE.Vector3();
    const cameraRight = new THREE.Vector3();
    const cameraUp = new THREE.Vector3();
    const targetNdc = new THREE.Vector2();

    let starGroup = null;
    let activeObject = null;
    let previousArrived = false;
    let ownsStarLayer = false;
    let phase = 'idle';
    let phaseStartedAt = 0;
    let currentBlend = 0;
    let closeStartBlend = 1;
    let closeDuration = CLOSE_MS;
    let targetReady = false;
    let measuredWidth = 0;
    let measuredHeight = 0;
    let detailFov = 26;
    let detailDepth = 34;
    let renderWidth = 1;
    let renderHeight = 1;
    let renderDpr = 1;
    const savedLayerMasks = new Map();

    function smootherstep01(value) {
      const t = THREE.MathUtils.clamp(value, 0, 1);
      return t * t * t * (t * (t * 6 - 15) + 10);
    }

    function syncRendererSize() {
      const width = Math.max(1, Math.floor(window.innerWidth));
      const height = Math.max(1, Math.floor(window.innerHeight));
      const dpr = Math.min(window.devicePixelRatio || 1, 1.35);
      if (width === renderWidth && height === renderHeight && dpr === renderDpr) return;
      renderWidth = width;
      renderHeight = height;
      renderDpr = dpr;
      detailRenderer.setPixelRatio(dpr);
      detailRenderer.setSize(width, height, false);
      detailCamera.aspect = width / Math.max(height, 1);
      detailCamera.updateProjectionMatrix();
      targetReady = false;
    }

    function measureTarget(force = false) {
      if (!starGroup || !activeObject) return false;
      syncRendererSize();
      const width = renderWidth;
      const height = renderHeight;
      if (!force && targetReady && width === measuredWidth && height === measuredHeight) return true;

      const rect = starSlot.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;

      let transformX = 0;
      let transformY = 0;
      if (starHeader) {
        const transform = getComputedStyle(starHeader).transform;
        if (transform && transform !== 'none' && typeof DOMMatrixReadOnly === 'function') {
          try {
            const matrix = new DOMMatrixReadOnly(transform);
            transformX = matrix.m41;
            transformY = matrix.m42;
          } catch (_) {
            // The slot still resolves correctly without the tiny compositor offset.
          }
        }
      }

      const centreX = rect.left + rect.width * 0.5 - transformX;
      const centreY = rect.top + rect.height * 0.5 - transformY;
      targetNdc.set(
        centreX / width * 2 - 1,
        1 - centreY / height * 2,
      );

      if (width <= 620) {
        detailFov = 32;
      } else {
        detailFov = activeObject.kind === 'note' ? 28 : 26;
      }

      const starScale = starGroup.scale?.x || 0.84;
      const focalPixels = height / Math.max(
        2 * Math.tan(THREE.MathUtils.degToRad(detailFov) * 0.5),
        1e-5,
      );
      const coreRatio = activeObject.kind === 'note' ? 0.35 : 0.37;
      const desiredCoreRadiusPx = Math.min(rect.width, rect.height) * coreRatio;
      detailDepth = THREE.MathUtils.clamp(
        starScale * focalPixels / Math.max(desiredCoreRadiusPx, 1),
        Math.max(arrivalDepth + 7, 16),
        38,
      );

      measuredWidth = width;
      measuredHeight = height;
      targetReady = true;
      return true;
    }

    function takeStarLayer() {
      if (!starGroup || ownsStarLayer) return;
      savedLayerMasks.clear();
      starGroup.traverse((object) => {
        savedLayerMasks.set(object, object.layers.mask);
        object.layers.set(DETAIL_STAR_LAYER);
      });
      camera.layers.disable(DETAIL_STAR_LAYER);
      detailCamera.layers.set(DETAIL_STAR_LAYER);
      ownsStarLayer = true;
      detailCanvas.style.visibility = 'visible';
      detailCanvas.style.opacity = '1';
      document.body.classList.add('star-detail-star-layer-active');
    }

    function releaseStarLayer() {
      if (!ownsStarLayer) return;
      for (const [object, mask] of savedLayerMasks) object.layers.mask = mask;
      savedLayerMasks.clear();
      ownsStarLayer = false;
      detailCanvas.style.opacity = '0';
      detailCanvas.style.visibility = 'hidden';
      detailRenderer.clear();
      document.body.classList.remove('star-detail-star-layer-active');
    }

    function applyDetailCamera(blend) {
      if (!measureTarget()) return;
      const t = THREE.MathUtils.clamp(blend, 0, 1);
      const currentFov = THREE.MathUtils.lerp(arrivalFov, detailFov, t);
      const forwardDepth = THREE.MathUtils.lerp(arrivalDepth, detailDepth, t);
      const screenX = targetNdc.x * t;
      const screenY = targetNdc.y * t;
      const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(currentFov) * 0.5);
      const lateralX = screenX * forwardDepth * detailCamera.aspect * tanHalfFov;
      const lateralY = screenY * forwardDepth * tanHalfFov;

      detailCamera.position.copy(starPosition)
        .addScaledVector(cameraBack, forwardDepth)
        .addScaledVector(cameraRight, -lateralX)
        .addScaledVector(cameraUp, -lateralY);
      detailCamera.quaternion.copy(arrivalQuaternion);
      detailCamera.fov = currentFov;
      detailCamera.updateProjectionMatrix();
      detailCamera.updateMatrixWorld(true);
    }

    function renderDetailStar() {
      if (!ownsStarLayer || !starGroup?.visible) return;
      syncRendererSize();
      const background = scene.background;
      scene.background = null;
      detailRenderer.clear();
      detailRenderer.render(scene, detailCamera);
      scene.background = background;
    }

    function beginLayerOpen(now) {
      activeObject = controller.activeObject || null;
      starGroup = controller.stellarModel?.group || null;
      if (!activeObject || !starGroup?.parent) return false;

      starGroup.getWorldPosition(starPosition);
      arrivalPosition.copy(camera.position);
      arrivalQuaternion.copy(camera.quaternion);
      arrivalFov = camera.fov;
      arrivalDepth = Math.max(arrivalPosition.distanceTo(starPosition), 0.001);

      cameraBack.subVectors(arrivalPosition, starPosition).normalize();
      cameraRight.set(1, 0, 0).applyQuaternion(arrivalQuaternion).normalize();
      cameraUp.set(0, 1, 0).applyQuaternion(arrivalQuaternion).normalize();

      detailCamera.position.copy(arrivalPosition);
      detailCamera.quaternion.copy(arrivalQuaternion);
      detailCamera.fov = arrivalFov;
      detailCamera.near = camera.near;
      detailCamera.far = camera.far;
      detailCamera.updateProjectionMatrix();
      detailCamera.updateMatrixWorld(true);

      targetReady = false;
      measureTarget(true);
      takeStarLayer();
      currentBlend = 0;
      phase = 'opening';
      phaseStartedAt = now;
      applyDetailCamera(0);
      renderDetailStar();
      return true;
    }

    function beginLayerClose(now = performance.now()) {
      if (phase !== 'opening' && phase !== 'open') return;
      phase = 'closing';
      phaseStartedAt = now;
      closeStartBlend = currentBlend;
      closeDuration = reducedMotion ? 1 : Math.max(360, CLOSE_MS * Math.max(0.50, closeStartBlend));
    }

    const classObserver = new MutationObserver(() => {
      if (document.body.classList.contains('star-detail-closing')) beginLayerClose(performance.now());
    });
    classObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    window.addEventListener('resize', () => {
      targetReady = false;
      syncRendererSize();
    }, { passive: true });

    const baseUpdate = controller.update.bind(controller);
    controller.update = (now, dt, elapsed) => {
      // Important ownership boundary: baseUpdate contains the original detail
      // camera choreography. It remains the sole writer of the galaxy camera.
      // This wrapper only owns the detached detail-star camera/render layer.
      const baseOwnsCamera = baseUpdate(now, dt, elapsed);
      const arrived = document.body.classList.contains('star-flight-arrived');

      if (arrived && !previousArrived) beginLayerOpen(now);

      if (arrived && ownsStarLayer && starGroup && activeObject) {
        if (document.body.classList.contains('star-detail-closing')) {
          beginLayerClose(now);
        }

        if (phase === 'opening') {
          const raw = THREE.MathUtils.clamp((now - phaseStartedAt) / OPEN_MS, 0, 1);
          currentBlend = smootherstep01(raw);
          if (raw >= 1) {
            currentBlend = 1;
            phase = 'open';
          }
        } else if (phase === 'open') {
          currentBlend = 1;
        } else if (phase === 'closing') {
          const raw = THREE.MathUtils.clamp((now - phaseStartedAt) / closeDuration, 0, 1);
          currentBlend = closeStartBlend * (1 - smootherstep01(raw));
        }

        starGroup.getWorldPosition(starPosition);
        applyDetailCamera(currentBlend);
        renderDetailStar();
      }

      if (!arrived && previousArrived && ownsStarLayer) {
        // The original detail controller has already restored its exact arrival
        // pose and started the base return flight. Restore only the star's scene
        // layer here; never rewrite the galaxy camera during the handoff.
        releaseStarLayer();
        currentBlend = 0;
        phase = 'handoff';
      }

      if (!document.body.classList.contains('star-flight-active') && ownsStarLayer) {
        releaseStarLayer();
        phase = 'idle';
        activeObject = null;
        starGroup = null;
      }

      if (!arrived && !document.body.classList.contains('star-flight-active') && phase === 'handoff') {
        phase = 'idle';
        activeObject = null;
        starGroup = null;
      }

      previousArrived = arrived;
      return baseOwnsCamera || ownsStarLayer;
    };

    return controller;
  };

  detailLayerInstall.__smirelDetailStarLayer = true;
  window[INSTALL_KEY] = detailLayerInstall;
})();