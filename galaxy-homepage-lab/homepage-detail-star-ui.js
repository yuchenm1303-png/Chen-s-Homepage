(() => {
  'use strict';

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function' || baseInstall.__smirelDetailStarUiV4) return;

  window.__SMIREL_DETAIL_STAR_UI_INDEPENDENT_CANVAS__ = true;

  const CANVAS_SIZE = 512;
  const UI_FOV = 28;
  const ENTRY_MS = 640;
  const REJOIN_MS = 280;
  const UI_FRAME_INTERVAL_MS = 1000 / 30;
  const GALAXY_DETAIL_INTERVAL_MS = 1000 / 24;

  function squareRect(rect) {
    if (!rect) return null;
    const width = Math.max(Number(rect.width) || 0, 0);
    const height = Math.max(Number(rect.height) || 0, 0);
    if (width <= 0 || height <= 0) return null;
    const size = Math.max(1, Math.min(width, height));
    const centreX = Number(rect.left) + width * 0.5;
    const centreY = Number(rect.top) + height * 0.5;
    return {
      left: centreX - size * 0.5,
      top: centreY - size * 0.5,
      width: size,
      height: size,
    };
  }

  const detailStarUiInstall = function installDetailStarUiV4(context) {
    const controller = baseInstall(context);
    if (!controller) return controller;

    const { THREE, camera, reducedMotion } = context || {};
    if (!THREE || !camera) return controller;

    const baseUpdate = controller.update.bind(controller);
    const baseShouldRenderFrame = typeof controller.shouldRenderFrame === 'function'
      ? controller.shouldRenderFrame.bind(controller)
      : null;
    const baseMotionLodActive = typeof controller.motionLodActive === 'function'
      ? controller.motionLodActive.bind(controller)
      : null;

    let overlay = null;
    let canvas = null;
    let renderer = null;
    let uiScene = null;
    let uiCamera = null;
    let postprocess = null;

    let state = 'idle';
    let activeId = null;
    let sourceGroup = null;
    let uiGroup = null;
    let sourceNodes = [];
    let uiNodes = [];
    let currentRect = null;
    let activeAnimation = null;
    let lastUiRenderMs = -1e9;
    let previousArrived = false;
    let prewarmStarted = false;
    let prewarmed = false;
    let needsGalaxyRefresh = false;
    let settleMotionLodUntilMs = 0;

    const worldCenter = new THREE.Vector3();
    const worldScale = new THREE.Vector3();
    const worldEdge = new THREE.Vector3();
    const projectedCenter = new THREE.Vector3();
    const projectedEdge = new THREE.Vector3();
    const cameraRight = new THREE.Vector3();

    const sourceViewQuaternion = new THREE.Quaternion();
    const sourceWorldQuaternion = new THREE.Quaternion();
    const inverseCameraQuaternion = new THREE.Quaternion();

    function coreRadiusFraction() {
      return controller.activeObject?.kind === 'project' ? 0.37 : 0.35;
    }

    function ensureOverlay() {
      if (overlay && canvas) return true;

      overlay = document.createElement('div');
      overlay.className = 'smirel-detail-star-canvas-layer';
      overlay.setAttribute('aria-hidden', 'true');

      canvas = document.createElement('canvas');
      canvas.className = 'smirel-detail-star-canvas';
      canvas.width = CANVAS_SIZE;
      canvas.height = CANVAS_SIZE;
      canvas.setAttribute('aria-hidden', 'true');
      overlay.appendChild(canvas);
      document.body.appendChild(overlay);
      return true;
    }

    function ensureRenderer() {
      if (renderer && uiScene && uiCamera) return true;
      if (!ensureOverlay()) return false;

      try {
        // Keep the detail canvas opaque black so the HDR bloom reconstruction
        // has a stable alpha channel. The whole fixed canvas is screen-blended
        // by CSS, making black visually neutral while preserving bloom RGB.
        renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: false,
          antialias: false,
          depth: false,
          powerPreference: 'high-performance',
        });
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.NoToneMapping;
        renderer.setPixelRatio(1);
        renderer.setSize(CANVAS_SIZE, CANVAS_SIZE, false);
        renderer.setClearColor(0x000000, 1);

        uiScene = new THREE.Scene();
        uiScene.background = new THREE.Color(0x000000);
        uiCamera = new THREE.PerspectiveCamera(UI_FOV, 1, 0.01, 64);
        uiCamera.position.set(0, 0, 4);
        uiCamera.lookAt(0, 0, 0);
        return true;
      } catch (error) {
        console.warn('[homepage-detail-star-ui] lightweight renderer init failed', error);
        renderer = null;
        uiScene = null;
        uiCamera = null;
        return false;
      }
    }

    function ensurePostprocess() {
      if (postprocess?.render) return postprocess;
      if (!renderer || !uiScene || !uiCamera) return null;

      const factory = window.__SMIREL_CREATE_DETAIL_STELLAR_POSTPROCESS__;
      if (typeof factory !== 'function') return null;

      try {
        postprocess = factory({
          renderer,
          scene: uiScene,
          camera: uiCamera,
          size: CANVAS_SIZE,
        });
      } catch (error) {
        console.warn('[homepage-detail-star-ui] Astra bloom init failed; retrying on a later frame', error);
        postprocess = null;
      }
      return postprocess;
    }

    function setUiOwned(owned) {
      document.body.classList.toggle('star-detail-ui-star-owned', Boolean(owned));
      overlay?.classList.toggle('is-active', Boolean(owned));
    }

    function transformForRect(rect) {
      const square = squareRect(rect);
      if (!square) return 'translate3d(-9999px,-9999px,0) scale(0.001)';
      const scale = square.width / CANVAS_SIZE;
      return `translate3d(${square.left}px,${square.top}px,0) scale(${scale})`;
    }

    function applyRect(rect) {
      const square = squareRect(rect);
      if (!square || !overlay) return false;
      currentRect = square;
      overlay.style.transform = transformForRect(square);
      return true;
    }

    function cancelAnimation() {
      if (!activeAnimation) return;
      try { activeAnimation.cancel(); } catch (_) {}
      activeAnimation = null;
    }

    function animateRect(fromRect, toRect, duration, onFinish) {
      if (!overlay) return false;
      const from = squareRect(fromRect);
      const to = squareRect(toRect);
      if (!from || !to) return false;

      cancelAnimation();
      currentRect = to;
      overlay.style.transform = transformForRect(from);

      if (reducedMotion || duration <= 1 || typeof overlay.animate !== 'function') {
        overlay.style.transform = transformForRect(to);
        onFinish?.();
        return true;
      }

      const animation = overlay.animate(
        [
          { transform: transformForRect(from) },
          { transform: transformForRect(to) },
        ],
        {
          duration,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
          fill: 'forwards',
        },
      );
      activeAnimation = animation;
      animation.onfinish = () => {
        if (activeAnimation !== animation) return;
        overlay.style.transform = transformForRect(to);
        activeAnimation = null;
        onFinish?.();
      };
      animation.oncancel = () => {
        if (activeAnimation === animation) activeAnimation = null;
      };
      return true;
    }

    function readVisualOverlayRect() {
      if (!overlay) return squareRect(currentRect);
      return squareRect(overlay.getBoundingClientRect()) || squareRect(currentRect);
    }

    function readSlotRect() {
      const shell = document.querySelector('.star-detail-shell');
      const slot = shell?.querySelector('.star-detail-star-slot');
      if (!shell || !slot) return null;

      const rect = slot.getBoundingClientRect();
      let transformX = 0;
      let transformY = 0;
      const header = shell.querySelector('.star-detail-header');
      if (header && typeof DOMMatrixReadOnly === 'function') {
        const transform = getComputedStyle(header).transform;
        if (transform && transform !== 'none') {
          try {
            const matrix = new DOMMatrixReadOnly(transform);
            transformX = matrix.m41;
            transformY = matrix.m42;
          } catch (_) {}
        }
      }

      return squareRect({
        left: rect.left - transformX,
        top: rect.top - transformY,
        width: rect.width,
        height: rect.height,
      });
    }

    function projectWorldStarRect(group) {
      if (!group?.parent) return null;
      const viewportWidth = Math.max(window.innerWidth, 1);
      const viewportHeight = Math.max(window.innerHeight, 1);

      group.updateWorldMatrix(true, false);
      camera.updateMatrixWorld();
      group.getWorldPosition(worldCenter);
      group.getWorldScale(worldScale);
      cameraRight.set(1, 0, 0).applyQuaternion(camera.quaternion).normalize();

      const radiusWorld = Math.max(worldScale.x, worldScale.y, worldScale.z, 0.001);
      worldEdge.copy(worldCenter).addScaledVector(cameraRight, radiusWorld);
      projectedCenter.copy(worldCenter).project(camera);
      projectedEdge.copy(worldEdge).project(camera);
      if (projectedCenter.z < -1.2 || projectedCenter.z > 1.2) return null;

      const centreX = (projectedCenter.x * 0.5 + 0.5) * viewportWidth;
      const centreY = (-projectedCenter.y * 0.5 + 0.5) * viewportHeight;
      const edgeX = (projectedEdge.x * 0.5 + 0.5) * viewportWidth;
      const edgeY = (-projectedEdge.y * 0.5 + 0.5) * viewportHeight;
      const radiusPx = Math.max(1, Math.hypot(edgeX - centreX, edgeY - centreY));
      const size = Math.max(24, radiusPx / coreRadiusFraction());

      return {
        left: centreX - size * 0.5,
        top: centreY - size * 0.5,
        width: size,
        height: size,
      };
    }

    function captureViewOrientation(group) {
      if (!group) return;
      group.getWorldQuaternion(sourceWorldQuaternion);
      inverseCameraQuaternion.copy(camera.quaternion).invert();
      sourceViewQuaternion.copy(inverseCameraQuaternion).multiply(sourceWorldQuaternion);
    }

    function syncUiChildren() {
      if (!sourceGroup || !uiGroup) return;

      const count = Math.min(sourceNodes.length, uiNodes.length);
      for (let i = 1; i < count; i += 1) {
        const sourceNode = sourceNodes[i];
        const uiNode = uiNodes[i];
        if (!sourceNode || !uiNode) continue;
        uiNode.position.copy(sourceNode.position);
        uiNode.quaternion.copy(sourceNode.quaternion);
        uiNode.scale.copy(sourceNode.scale);
        uiNode.visible = sourceNode.visible;
        uiNode.renderOrder = sourceNode.renderOrder || 0;
      }

      const scalar = Math.max(
        0.001,
        (Math.abs(sourceGroup.scale.x) + Math.abs(sourceGroup.scale.y) + Math.abs(sourceGroup.scale.z)) / 3,
      );
      uiGroup.position.set(0, 0, 0);
      uiGroup.scale.setScalar(scalar);
      uiGroup.quaternion.copy(sourceViewQuaternion);
      uiGroup.visible = true;
    }

    function fitUiCamera() {
      if (!uiGroup || !uiCamera) return;
      const modelRadius = Math.max(uiGroup.scale.x, 0.001);
      const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(UI_FOV) * 0.5);
      const distance = modelRadius / Math.max(2 * coreRadiusFraction() * tanHalfFov, 1e-5);
      uiCamera.aspect = 1;
      uiCamera.position.set(0, 0, Math.max(distance, modelRadius * 1.25));
      uiCamera.quaternion.identity();
      uiCamera.lookAt(0, 0, 0);
      uiCamera.updateProjectionMatrix();
    }

    function disposeUiModel() {
      if (uiGroup?.parent) uiGroup.parent.remove(uiGroup);
      uiGroup = null;
      sourceNodes = [];
      uiNodes = [];
      activeId = null;
      prewarmStarted = false;
      prewarmed = false;
    }

    function rebuildUiModel(group, objectId) {
      if (!group?.parent || !ensureRenderer()) return false;
      if (uiGroup && activeId === objectId && sourceGroup === group) return true;

      disposeUiModel();
      activeId = objectId;
      sourceGroup = group;

      // Object3D transforms are independent. Geometry, materials, textures and
      // shader uniforms remain shared with the source star, so the lightweight
      // renderer avoids a per-frame material/uniform copy pass.
      uiGroup = group.clone(true);
      group.traverse((node) => sourceNodes.push(node));
      uiGroup.traverse((node) => uiNodes.push(node));
      uiGroup.name = 'SmirelDetailStarUICanvas';
      uiGroup.userData.smirelDetailUi = true;
      uiScene.add(uiGroup);

      captureViewOrientation(group);
      syncUiChildren();
      fitUiCamera();
      return true;
    }

    function renderUiOnce() {
      if (!renderer || !uiScene || !uiCamera || !uiGroup) return false;
      syncUiChildren();
      fitUiCamera();

      const activityUniform = controller.stellarModel?.activity?.material?.uniforms?.uPixelRatio;
      const previousActivityDpr = activityUniform ? activityUniform.value : null;
      if (activityUniform) activityUniform.value = 1;

      try {
        const pipeline = ensurePostprocess();
        if (pipeline?.render) {
          pipeline.render(1 / 30);
        } else {
          renderer.render(uiScene, uiCamera);
        }
      } finally {
        if (activityUniform && previousActivityDpr != null) {
          activityUniform.value = previousActivityDpr;
        }
      }
      return true;
    }

    function requestPrewarm() {
      if (prewarmStarted || prewarmed || !renderer || !uiScene || !uiCamera || !uiGroup) return;
      prewarmStarted = true;

      const warm = async () => {
        try {
          if (typeof renderer.compileAsync === 'function') {
            await renderer.compileAsync(uiScene, uiCamera);
          } else if (typeof renderer.compile === 'function') {
            renderer.compile(uiScene, uiCamera);
          }
          ensurePostprocess();
          renderUiOnce();
          prewarmed = true;
        } catch (error) {
          console.warn('[homepage-detail-star-ui] prewarm failed; first UI frame will compile lazily', error);
        }
      };

      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(() => { warm(); }, { timeout: 220 });
      } else {
        setTimeout(() => { warm(); }, 0);
      }
    }

    function prepareDuringFlight() {
      if (state !== 'idle') return;
      if (!document.body.classList.contains('star-flight-active')) return;
      if (document.body.classList.contains('star-flight-arrived')) return;

      const object = controller.activeObject;
      const group = controller.stellarModel?.group || null;
      if (!object || !group?.parent) return;
      if (!rebuildUiModel(group, object.id)) return;

      captureViewOrientation(group);
      syncUiChildren();
      fitUiCamera();
      requestPrewarm();
    }

    function detailModeReady() {
      const object = controller.activeObject;
      const shell = document.querySelector('.star-detail-shell');
      return Boolean(
        object
        && shell
        && shell.dataset.starId === object.id
        && document.body.classList.contains('star-flight-arrived')
        && !document.body.classList.contains('star-detail-closing')
      );
    }

    function startExtraction() {
      if (state !== 'idle' || !detailModeReady()) return false;

      const object = controller.activeObject;
      const group = controller.stellarModel?.group || null;
      if (!object || !group?.parent || !rebuildUiModel(group, object.id)) return false;

      captureViewOrientation(group);
      syncUiChildren();
      fitUiCamera();

      const startRect = squareRect(projectWorldStarRect(group));
      const slotRect = readSlotRect();
      if (!startRect || !slotRect || !ensureOverlay()) return false;

      setUiOwned(true);
      overlay.style.transform = transformForRect(startRect);
      renderUiOnce();

      sourceGroup = group;
      sourceGroup.visible = false;
      needsGalaxyRefresh = true;
      state = 'extracting';

      animateRect(startRect, slotRect, ENTRY_MS, () => {
        if (state !== 'extracting') return;
        state = 'owned';
        currentRect = slotRect;
        settleMotionLodUntilMs = performance.now() + 140;
      });
      return true;
    }

    function updateOwnedLayout() {
      if (state !== 'owned' || !overlay) return;
      const slotRect = readSlotRect();
      if (slotRect) applyRect(slotRect);
    }

    function beginRejoin() {
      if (state !== 'owned' && state !== 'extracting') return false;
      if (!sourceGroup?.parent || !overlay) {
        abortToWorld();
        return false;
      }

      const fromRect = readVisualOverlayRect();
      const targetRect = squareRect(projectWorldStarRect(sourceGroup));
      if (!fromRect || !targetRect) {
        abortToWorld();
        return false;
      }

      state = 'rejoining';
      animateRect(fromRect, targetRect, REJOIN_MS, () => {
        if (state !== 'rejoining') return;

        sourceGroup.visible = true;
        needsGalaxyRefresh = true;
        state = 'world';
        setUiOwned(false);

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (state !== 'world') return;
            overlay?.classList.remove('is-active');
            disposeUiModel();
            currentRect = null;
          });
        });
      });
      return true;
    }

    function abortToWorld() {
      cancelAnimation();
      if (sourceGroup?.parent && document.body.classList.contains('star-flight-arrived')) {
        sourceGroup.visible = true;
        needsGalaxyRefresh = true;
      }
      state = 'world';
      setUiOwned(false);
      overlay?.classList.remove('is-active');
      disposeUiModel();
      currentRect = null;
    }

    function resetAfterFlight() {
      cancelAnimation();
      setUiOwned(false);
      overlay?.classList.remove('is-active');
      if (sourceGroup?.parent) sourceGroup.visible = true;
      state = 'idle';
      sourceGroup = null;
      currentRect = null;
      previousArrived = false;
      settleMotionLodUntilMs = 0;
      disposeUiModel();
    }

    const resizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => updateOwnedLayout())
      : null;

    function observeCurrentSlot() {
      const slot = document.querySelector('.star-detail-shell .star-detail-star-slot');
      resizeObserver?.disconnect();
      if (slot) resizeObserver?.observe(slot);
    }

    window.addEventListener('resize', updateOwnedLayout, { passive: true });

    function uiFrame(now) {
      requestAnimationFrame(uiFrame);
      if (!renderer || !uiGroup || !overlay?.classList.contains('is-active')) return;
      if (now - lastUiRenderMs < UI_FRAME_INTERVAL_MS) return;
      lastUiRenderMs = now;
      renderUiOnce();
    }
    requestAnimationFrame(uiFrame);

    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => ensureRenderer(), { timeout: 1200 });
    } else {
      setTimeout(() => ensureRenderer(), 400);
    }

    controller.update = (now, dt, elapsed) => {
      const ownsCamera = baseUpdate(now, dt, elapsed);
      const arrived = document.body.classList.contains('star-flight-arrived');
      const closing = document.body.classList.contains('star-detail-closing');

      try {
        if (!arrived) {
          if (previousArrived || state !== 'idle') resetAfterFlight();
          prepareDuringFlight();
          previousArrived = false;
          return ownsCamera;
        }

        if (!previousArrived) {
          observeCurrentSlot();
          startExtraction();
        } else if (state === 'idle') {
          startExtraction();
        }

        if (closing && (state === 'owned' || state === 'extracting')) {
          beginRejoin();
        }
      } catch (error) {
        console.warn('[homepage-detail-star-ui] compositor handoff failed; restoring world star', error);
        abortToWorld();
      }

      previousArrived = arrived;
      return ownsCamera || state === 'extracting' || state === 'owned' || state === 'rejoining';
    };

    controller.shouldRenderFrame = (now, lastCompositeMs) => {
      if (needsGalaxyRefresh) {
        needsGalaxyRefresh = false;
        return true;
      }

      if (state === 'extracting' || state === 'owned' || state === 'rejoining') {
        return now - lastCompositeMs >= GALAXY_DETAIL_INTERVAL_MS;
      }

      return baseShouldRenderFrame ? baseShouldRenderFrame(now, lastCompositeMs) : false;
    };

    controller.motionLodActive = (now = performance.now()) => {
      if (state === 'extracting' || state === 'rejoining' || now < settleMotionLodUntilMs) {
        return true;
      }
      return baseMotionLodActive ? baseMotionLodActive(now) : false;
    };

    Object.defineProperty(controller, 'detailStarUiState', {
      configurable: true,
      get() { return state; },
    });

    Object.defineProperty(controller, 'articleStarUiState', {
      configurable: true,
      get() { return state; },
    });

    Object.defineProperty(controller, 'detailStarUiOwned', {
      configurable: true,
      get() {
        return state === 'extracting' || state === 'owned' || state === 'rejoining';
      },
    });

    return controller;
  };

  detailStarUiInstall.__smirelDetailStarUiV4 = true;
  window[INSTALL_KEY] = detailStarUiInstall;
})();