(() => {
  'use strict';

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function' || baseInstall.__smirelDetailStarUiV3) return;

  const UI_FOV = 28;
  const ENTRY_MS = 680;
  const REJOIN_MS = 260;

  function clamp01(value) {
    return Math.min(1, Math.max(0, value));
  }

  function smootherstep01(value) {
    const t = clamp01(value);
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

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

  function lerpSquareRect(fromRect, toRect, t) {
    const from = squareRect(fromRect);
    const to = squareRect(toRect);
    if (!from || !to) return null;
    const size = lerp(from.width, to.width, t);
    const fromCx = from.left + from.width * 0.5;
    const fromCy = from.top + from.height * 0.5;
    const toCx = to.left + to.width * 0.5;
    const toCy = to.top + to.height * 0.5;
    const centreX = lerp(fromCx, toCx, t);
    const centreY = lerp(fromCy, toCy, t);
    return {
      left: centreX - size * 0.5,
      top: centreY - size * 0.5,
      width: size,
      height: size,
    };
  }

  const detailStarUiInstall = function installDetailStarUiV3(context) {
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

    const uiScene = new THREE.Scene();
    const uiCamera = new THREE.PerspectiveCamera(UI_FOV, 1, 0.01, 64);
    uiCamera.position.set(0, 0, 4);
    uiCamera.lookAt(0, 0, 0);

    let state = 'idle';
    let activeId = null;
    let sourceGroup = null;
    let uiGroup = null;
    let sourceNodes = [];
    let uiNodes = [];
    let entryStartedAt = 0;
    let rejoinStartedAt = 0;
    let entryStartRect = null;
    let rejoinStartRect = null;
    let currentRect = null;
    let previousArrived = false;
    let arrivalCaptured = false;
    let viewOrientationCaptured = false;

    const worldCenter = new THREE.Vector3();
    const worldScale = new THREE.Vector3();
    const worldEdge = new THREE.Vector3();
    const projectedCenter = new THREE.Vector3();
    const projectedEdge = new THREE.Vector3();
    const cameraRight = new THREE.Vector3();

    const arrivalCameraPosition = new THREE.Vector3();
    const arrivalCameraQuaternion = new THREE.Quaternion();
    let arrivalCameraFov = 47;

    const sourceViewQuaternion = new THREE.Quaternion();
    const sourceWorldQuaternion = new THREE.Quaternion();
    const inverseCameraQuaternion = new THREE.Quaternion();

    const previousViewport = new THREE.Vector4();
    const previousScissor = new THREE.Vector4();
    const drawingBufferSize = new THREE.Vector2();

    function coreRadiusFraction() {
      return controller.activeObject?.kind === 'project' ? 0.37 : 0.35;
    }

    function setUiOwned(owned) {
      document.body.classList.toggle('star-detail-ui-star-owned', Boolean(owned));
    }

    function captureArrivalCamera() {
      arrivalCameraPosition.copy(camera.position);
      arrivalCameraQuaternion.copy(camera.quaternion);
      arrivalCameraFov = camera.fov;
      arrivalCaptured = true;
    }

    function restoreArrivalCamera() {
      if (!arrivalCaptured) return;
      camera.position.copy(arrivalCameraPosition);
      camera.quaternion.copy(arrivalCameraQuaternion);
      camera.fov = arrivalCameraFov;
      camera.updateProjectionMatrix();
    }

    function disposeUiModel() {
      if (uiGroup?.parent) uiGroup.parent.remove(uiGroup);
      uiGroup = null;
      sourceNodes = [];
      uiNodes = [];
      viewOrientationCaptured = false;
    }

    function captureViewOrientation(group) {
      if (!group) return;
      group.getWorldQuaternion(sourceWorldQuaternion);
      inverseCameraQuaternion.copy(arrivalCameraQuaternion).invert();
      sourceViewQuaternion.copy(inverseCameraQuaternion).multiply(sourceWorldQuaternion);
      viewOrientationCaptured = true;
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
      if (!viewOrientationCaptured) captureViewOrientation(sourceGroup);
      uiGroup.quaternion.copy(sourceViewQuaternion);
      uiGroup.visible = true;
    }

    function rebuildUiModel(group, objectId) {
      if (!group?.parent) return false;
      if (uiGroup && activeId === objectId && sourceGroup === group) return true;

      disposeUiModel();
      activeId = objectId;
      sourceGroup = group;

      // Clone only Object3D transforms. Geometry, materials, textures and shader
      // uniforms remain shared with the galaxy star: no second shader stack and
      // no per-frame material/uniform synchronization.
      uiGroup = group.clone(true);
      group.traverse((node) => sourceNodes.push(node));
      uiGroup.traverse((node) => uiNodes.push(node));
      uiGroup.name = 'SmirelDetailStarUI';
      uiGroup.userData.smirelDetailUi = true;
      uiScene.add(uiGroup);
      captureViewOrientation(group);
      syncUiChildren();
      return true;
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

    function readSlotRect() {
      const shell = document.querySelector('.star-detail-shell');
      const slot = shell?.querySelector('.star-detail-star-slot');
      if (!shell || !slot) return null;
      return squareRect(slot.getBoundingClientRect());
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

    function fitUiCamera() {
      if (!uiGroup) return;
      const modelRadius = Math.max(uiGroup.scale.x, 0.001);
      const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(UI_FOV) * 0.5);
      const distance = modelRadius / Math.max(2 * coreRadiusFraction() * tanHalfFov, 1e-5);
      uiCamera.aspect = 1;
      uiCamera.position.set(0, 0, Math.max(distance, modelRadius * 1.25));
      uiCamera.quaternion.identity();
      uiCamera.lookAt(0, 0, 0);
      uiCamera.updateProjectionMatrix();
    }

    function setCurrentRect(rect) {
      const square = squareRect(rect);
      if (!square) return false;
      currentRect = square;
      return true;
    }

    function startExtraction(now) {
      if (state !== 'idle' || !detailModeReady()) return false;
      const object = controller.activeObject;
      const group = controller.stellarModel?.group || null;
      if (!object || !group) return false;

      restoreArrivalCamera();
      const startRect = squareRect(projectWorldStarRect(group));
      const slotRect = readSlotRect();
      if (!startRect || !slotRect || !rebuildUiModel(group, object.id)) return false;

      entryStartRect = startRect;
      entryStartedAt = now;
      state = 'extracting';
      setUiOwned(true);
      setCurrentRect(startRect);
      syncUiChildren();
      fitUiCamera();

      // Same-frame handoff: overlay the UI model in the source star's exact
      // screen rectangle, then hide the galaxy-bound source object.
      group.visible = false;
      return true;
    }

    function updateExtraction(now) {
      if (!sourceGroup?.parent || !uiGroup || !entryStartRect) {
        abortToWorld();
        return;
      }

      sourceGroup.visible = false;
      const slotRect = readSlotRect();
      if (!slotRect) {
        abortToWorld();
        return;
      }

      const duration = reducedMotion ? 1 : ENTRY_MS;
      const raw = clamp01((now - entryStartedAt) / duration);
      setCurrentRect(lerpSquareRect(entryStartRect, slotRect, smootherstep01(raw)));
      syncUiChildren();
      fitUiCamera();

      if (raw >= 1) {
        setCurrentRect(slotRect);
        state = 'owned';
      }
    }

    function updateOwned() {
      if (!sourceGroup?.parent || !uiGroup) {
        abortToWorld();
        return;
      }

      sourceGroup.visible = false;
      const slotRect = readSlotRect();
      if (slotRect) setCurrentRect(slotRect);
      syncUiChildren();
      fitUiCamera();
    }

    function beginRejoin(now) {
      if (state !== 'owned' && state !== 'extracting') return;
      rejoinStartRect = squareRect(currentRect || readSlotRect() || projectWorldStarRect(sourceGroup));
      if (!rejoinStartRect) {
        abortToWorld();
        return;
      }
      rejoinStartedAt = now;
      state = 'rejoining';
    }

    function updateRejoin(now) {
      if (!sourceGroup?.parent || !uiGroup || !rejoinStartRect) {
        abortToWorld();
        return;
      }

      sourceGroup.visible = false;
      restoreArrivalCamera();
      const targetRect = squareRect(projectWorldStarRect(sourceGroup));
      if (!targetRect) return;

      const duration = reducedMotion ? 1 : REJOIN_MS;
      const raw = clamp01((now - rejoinStartedAt) / duration);
      setCurrentRect(lerpSquareRect(rejoinStartRect, targetRect, smootherstep01(raw)));
      syncUiChildren();
      fitUiCamera();

      if (raw >= 1) {
        sourceGroup.visible = true;
        setUiOwned(false);
        disposeUiModel();
        currentRect = null;
        state = 'world';
      }
    }

    function abortToWorld() {
      if (sourceGroup?.parent && document.body.classList.contains('star-flight-arrived')) {
        sourceGroup.visible = true;
      }
      setUiOwned(false);
      disposeUiModel();
      currentRect = null;
      state = 'world';
    }

    function resetAfterFlight() {
      setUiOwned(false);
      state = 'idle';
      activeId = null;
      sourceGroup = null;
      entryStartRect = null;
      rejoinStartRect = null;
      currentRect = null;
      arrivalCaptured = false;
      disposeUiModel();
    }

    controller.update = (now, dt, elapsed) => {
      const ownsCamera = baseUpdate(now, dt, elapsed);
      const arrived = document.body.classList.contains('star-flight-arrived');
      const closing = document.body.classList.contains('star-detail-closing');

      try {
        if (arrived && !previousArrived) captureArrivalCamera();

        if (!arrived) {
          if (state !== 'idle') resetAfterFlight();
          previousArrived = false;
          return ownsCamera;
        }

        // The legacy detail runtime keeps only shell reveal/close timing. Once the
        // flight arrives, the galaxy camera is frozen at that arrival pose; the
        // independent UI star performs all subsequent movement itself.
        restoreArrivalCamera();

        if (closing && (state === 'owned' || state === 'extracting')) beginRejoin(now);
        if (state === 'idle') startExtraction(now);
        if (state === 'extracting') updateExtraction(now);
        else if (state === 'owned') updateOwned();
        else if (state === 'rejoining') updateRejoin(now);
      } catch (error) {
        console.warn('[homepage-detail-star-ui] independent overlay handoff failed; restoring world star', error);
        abortToWorld();
      }

      previousArrived = arrived;
      return ownsCamera
        || state === 'extracting'
        || state === 'owned'
        || state === 'rejoining';
    };

    controller.shouldRenderFrame = (now, lastCompositeMs) => {
      if (state === 'extracting' || state === 'rejoining') return true;
      return baseShouldRenderFrame ? baseShouldRenderFrame(now, lastCompositeMs) : false;
    };

    controller.motionLodActive = (now = performance.now()) => {
      if (state === 'extracting' || state === 'rejoining') return true;
      return baseMotionLodActive ? baseMotionLodActive(now) : false;
    };

    controller.renderDetailStarUi = (renderer) => {
      if (!renderer || !uiGroup || !currentRect) return false;
      if (state !== 'extracting' && state !== 'owned' && state !== 'rejoining') return false;

      syncUiChildren();
      fitUiCamera();

      renderer.getDrawingBufferSize(drawingBufferSize);
      const bufferWidth = Math.max(1, drawingBufferSize.x);
      const bufferHeight = Math.max(1, drawingBufferSize.y);
      const cssWidth = Math.max(window.innerWidth, 1);
      const cssHeight = Math.max(window.innerHeight, 1);
      const scaleX = bufferWidth / cssWidth;
      const scaleY = bufferHeight / cssHeight;
      const pixelScale = Math.min(scaleX, scaleY);

      const centreX = (currentRect.left + currentRect.width * 0.5) * scaleX;
      const centreYFromTop = (currentRect.top + currentRect.height * 0.5) * scaleY;
      const size = Math.max(1, Math.round(currentRect.width * pixelScale));
      const x = Math.round(centreX - size * 0.5);
      const y = Math.round(bufferHeight - centreYFromTop - size * 0.5);

      renderer.getViewport(previousViewport);
      renderer.getScissor(previousScissor);
      const previousScissorTest = renderer.getScissorTest();
      const previousAutoClear = renderer.autoClear;
      const previousRenderTarget = renderer.getRenderTarget();

      try {
        renderer.setRenderTarget(null);
        renderer.autoClear = false;
        renderer.setScissorTest(true);
        renderer.setViewport(x, y, size, size);
        renderer.setScissor(x, y, size, size);
        renderer.render(uiScene, uiCamera);
      } finally {
        renderer.setViewport(previousViewport);
        renderer.setScissor(previousScissor);
        renderer.setScissorTest(previousScissorTest);
        renderer.autoClear = previousAutoClear;
        renderer.setRenderTarget(previousRenderTarget);
      }
      return true;
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

    Object.defineProperty(controller, 'detailCameraDetached', {
      configurable: true,
      get() {
        return arrivalCaptured && document.body.classList.contains('star-flight-arrived');
      },
    });

    return controller;
  };

  detailStarUiInstall.__smirelDetailStarUiV3 = true;
  window[INSTALL_KEY] = detailStarUiInstall;
})();
