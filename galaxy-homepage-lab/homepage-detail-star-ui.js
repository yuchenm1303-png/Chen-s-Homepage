(() => {
  'use strict';

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function' || baseInstall.__smirelDetailStarUiV2) return;

  const ENTRY_MS = 760;
  const REJOIN_MS = 260;
  const CAMERA_RELEASE_MS = 560;
  const UI_DEPTH = 6.0;

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

  const detailStarUiInstall = function installDetailStarUiV2(context) {
    const controller = baseInstall(context);
    if (!controller) return controller;

    const { THREE, scene, camera, reducedMotion } = context || {};
    if (!THREE || !scene || !camera) return controller;

    const baseUpdate = controller.update.bind(controller);

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
    let holdCaptured = false;
    let cameraReleaseStartedAt = 0;
    let cameraDetached = false;
    let viewOrientationCaptured = false;

    const worldCenter = new THREE.Vector3();
    const worldScale = new THREE.Vector3();
    const worldEdge = new THREE.Vector3();
    const projectedCenter = new THREE.Vector3();
    const projectedEdge = new THREE.Vector3();
    const cameraRight = new THREE.Vector3();
    const cameraUp = new THREE.Vector3();
    const cameraForward = new THREE.Vector3();

    const arrivalCameraPosition = new THREE.Vector3();
    const arrivalCameraQuaternion = new THREE.Quaternion();
    let arrivalCameraFov = 47;
    const holdCameraPosition = new THREE.Vector3();
    const holdCameraQuaternion = new THREE.Quaternion();
    let holdCameraFov = 47;
    const releaseCameraPosition = new THREE.Vector3();
    const releaseCameraQuaternion = new THREE.Quaternion();
    let releaseCameraFov = 47;
    const sourceViewQuaternion = new THREE.Quaternion();
    const sourceWorldQuaternion = new THREE.Quaternion();
    const inverseCameraQuaternion = new THREE.Quaternion();

    function coreRadiusFraction() {
      return controller.activeObject?.kind === 'project' ? 0.37 : 0.35;
    }

    function setUiOwned(owned) {
      document.body.classList.toggle('star-detail-ui-star-owned', Boolean(owned));
    }

    function applyCameraPose(position, quaternion, fov) {
      camera.position.copy(position);
      camera.quaternion.copy(quaternion);
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    function captureArrivalCamera() {
      arrivalCameraPosition.copy(camera.position);
      arrivalCameraQuaternion.copy(camera.quaternion);
      arrivalCameraFov = camera.fov;
      arrivalCaptured = true;
    }

    function captureHoldCamera() {
      holdCameraPosition.copy(camera.position);
      holdCameraQuaternion.copy(camera.quaternion);
      holdCameraFov = camera.fov;
      holdCaptured = true;
      cameraReleaseStartedAt = 0;
      cameraDetached = false;
    }

    function applyCameraOwnership(now) {
      if (!arrivalCaptured) return;

      if (state === 'extracting') {
        if (holdCaptured) applyCameraPose(holdCameraPosition, holdCameraQuaternion, holdCameraFov);
        return;
      }

      if (state === 'owned') {
        if (cameraDetached) {
          applyCameraPose(arrivalCameraPosition, arrivalCameraQuaternion, arrivalCameraFov);
          return;
        }
        if (!holdCaptured) captureHoldCamera();
        if (!cameraReleaseStartedAt) {
          cameraReleaseStartedAt = now;
          releaseCameraPosition.copy(holdCameraPosition);
          releaseCameraQuaternion.copy(holdCameraQuaternion);
          releaseCameraFov = holdCameraFov;
        }
        const duration = reducedMotion ? 1 : CAMERA_RELEASE_MS;
        const raw = clamp01((now - cameraReleaseStartedAt) / duration);
        const t = smootherstep01(raw);
        camera.position.lerpVectors(releaseCameraPosition, arrivalCameraPosition, t);
        camera.quaternion.slerpQuaternions(releaseCameraQuaternion, arrivalCameraQuaternion, t);
        camera.fov = lerp(releaseCameraFov, arrivalCameraFov, t);
        camera.updateProjectionMatrix();
        if (raw >= 1) cameraDetached = true;
        return;
      }

      if ((state === 'rejoining' || state === 'world') && (cameraDetached || cameraReleaseStartedAt)) {
        applyCameraPose(arrivalCameraPosition, arrivalCameraQuaternion, arrivalCameraFov);
      }
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
      inverseCameraQuaternion.copy(camera.quaternion).invert();
      sourceViewQuaternion.copy(inverseCameraQuaternion).multiply(sourceWorldQuaternion);
      viewOrientationCaptured = true;
    }

    function rebuildUiModel(group, objectId) {
      if (!group?.parent) return false;
      if (uiGroup && activeId === objectId && sourceGroup === group) return true;

      disposeUiModel();
      activeId = objectId;
      sourceGroup = group;

      // Clone only the Object3D transform hierarchy. Three.js clone() keeps the
      // same geometry/material references, so the UI model receives the exact
      // same photosphere/chromosphere/corona/activity shaders and textures as the
      // galaxy model without duplicating shader programs or synchronizing uniforms.
      uiGroup = group.clone(true);
      group.traverse((node) => sourceNodes.push(node));
      uiGroup.traverse((node) => uiNodes.push(node));

      uiGroup.name = 'SmirelDetailStarUI';
      uiGroup.userData.smirelDetailUi = true;
      uiGroup.visible = true;
      uiGroup.renderOrder = Math.max(group.renderOrder || 0, 40);
      scene.add(uiGroup);
      captureViewOrientation(group);
      syncUiChildren();
      return true;
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
        uiNode.renderOrder = Math.max(sourceNode.renderOrder || 0, 40 + i);
      }
      uiGroup.visible = true;
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
      if (!shell || !slot || shell.getAttribute('aria-hidden') === 'true') return null;
      return squareRect(slot.getBoundingClientRect());
    }

    function placeUiStar(inputRect) {
      if (!uiGroup || !inputRect) return false;
      const rect = squareRect(inputRect);
      if (!rect) return false;
      currentRect = rect;
      syncUiChildren();

      const viewportWidth = Math.max(window.innerWidth, 1);
      const viewportHeight = Math.max(window.innerHeight, 1);
      const centreX = rect.left + rect.width * 0.5;
      const centreY = rect.top + rect.height * 0.5;
      const ndcX = centreX / viewportWidth * 2 - 1;
      const ndcY = 1 - centreY / viewportHeight * 2;
      const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5);
      const halfHeight = UI_DEPTH * tanHalfFov;
      const halfWidth = halfHeight * camera.aspect;

      cameraRight.set(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
      cameraUp.set(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
      cameraForward.set(0, 0, -1).applyQuaternion(camera.quaternion).normalize();

      uiGroup.position.copy(camera.position)
        .addScaledVector(cameraForward, UI_DEPTH)
        .addScaledVector(cameraRight, ndcX * halfWidth)
        .addScaledVector(cameraUp, ndcY * halfHeight);

      if (!viewOrientationCaptured) captureViewOrientation(sourceGroup);
      uiGroup.quaternion.copy(camera.quaternion).multiply(sourceViewQuaternion);

      const focalPixels = viewportHeight / Math.max(2 * tanHalfFov, 1e-5);
      const desiredCoreRadiusPx = Math.max(1, rect.width * coreRadiusFraction());
      const uiScale = desiredCoreRadiusPx * UI_DEPTH / Math.max(focalPixels, 1);
      uiGroup.scale.setScalar(Math.max(uiScale, 0.001));
      uiGroup.updateMatrixWorld(true);
      return true;
    }

    function detailModeReady() {
      const object = controller.activeObject;
      const shell = document.querySelector('.star-detail-shell');
      return Boolean(
        object
        && shell
        && shell.dataset.starId === object.id
        && shell.getAttribute('aria-hidden') !== 'true'
        && document.body.classList.contains('star-flight-arrived')
        && document.body.classList.contains('star-detail-open')
        && !document.body.classList.contains('star-detail-closing')
      );
    }

    function startExtraction(now) {
      if (state !== 'idle' || !detailModeReady()) return false;
      const object = controller.activeObject;
      const group = controller.stellarModel?.group || null;
      const startRect = squareRect(projectWorldStarRect(group));
      const slotRect = readSlotRect();
      if (!object || !group || !startRect || !slotRect) return false;
      if (!rebuildUiModel(group, object.id)) return false;

      captureHoldCamera();
      entryStartRect = startRect;
      entryStartedAt = now;
      state = 'extracting';
      setUiOwned(true);
      if (!placeUiStar(startRect)) {
        state = 'idle';
        setUiOwned(false);
        disposeUiModel();
        return false;
      }

      // The handoff is same-frame and same-material: after the UI clone is in the
      // exact projected rectangle, the world model can disappear without a visual
      // change. From this point the UI clone is camera-relative, not galaxy-bound.
      group.visible = false;
      return true;
    }

    function updateExtraction(now) {
      if (!sourceGroup?.parent || !uiGroup) {
        abortToWorld();
        return;
      }
      sourceGroup.visible = false;
      const slotRect = readSlotRect();
      if (!slotRect || !entryStartRect) {
        abortToWorld();
        return;
      }
      const duration = reducedMotion ? 1 : ENTRY_MS;
      const raw = clamp01((now - entryStartedAt) / duration);
      const rect = lerpSquareRect(entryStartRect, slotRect, smootherstep01(raw));
      if (rect) placeUiStar(rect);
      if (raw >= 1) {
        currentRect = slotRect;
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
      if (slotRect) placeUiStar(slotRect);
    }

    function beginRejoin(now) {
      if (state !== 'owned' && state !== 'extracting') return;
      rejoinStartRect = squareRect(currentRect || readSlotRect() || projectWorldStarRect(sourceGroup));
      rejoinStartedAt = now;
      state = 'rejoining';
    }

    function updateRejoin(now) {
      if (!sourceGroup?.parent || !uiGroup || !rejoinStartRect) {
        abortToWorld();
        return;
      }
      sourceGroup.visible = false;
      const targetRect = squareRect(projectWorldStarRect(sourceGroup));
      if (!targetRect) {
        placeUiStar(rejoinStartRect);
        return;
      }
      const duration = reducedMotion ? 1 : REJOIN_MS;
      const raw = clamp01((now - rejoinStartedAt) / duration);
      const rect = lerpSquareRect(rejoinStartRect, targetRect, smootherstep01(raw));
      if (rect) placeUiStar(rect);

      if (raw >= 1) {
        syncUiChildren();
        uiGroup.visible = false;
        sourceGroup.visible = true;
        setUiOwned(false);
        state = 'world';
      }
    }

    function abortToWorld() {
      if (uiGroup) uiGroup.visible = false;
      if (sourceGroup?.parent && document.body.classList.contains('star-flight-arrived')) {
        sourceGroup.visible = true;
      }
      setUiOwned(false);
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
      holdCaptured = false;
      cameraReleaseStartedAt = 0;
      cameraDetached = false;
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

        applyCameraOwnership(now);

        if (closing && (state === 'owned' || state === 'extracting')) beginRejoin(now);
        if (state === 'idle') startExtraction(now);
        if (state === 'extracting') updateExtraction(now);
        else if (state === 'owned') updateOwned();
        else if (state === 'rejoining') updateRejoin(now);

        // The detail star is camera-relative, so every camera-release frame must
        // update its world transform after the camera pose is finalized.
        applyCameraOwnership(now);
        if ((state === 'extracting' || state === 'owned' || state === 'rejoining') && currentRect) {
          placeUiStar(currentRect);
        }
      } catch (error) {
        console.warn('[homepage-detail-star-ui-v2] handoff failed; restoring world-space star', error);
        abortToWorld();
      }

      previousArrived = arrived;
      return ownsCamera
        || state === 'extracting'
        || state === 'owned'
        || state === 'rejoining'
        || cameraDetached;
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
      get() { return cameraDetached; },
    });

    return controller;
  };

  detailStarUiInstall.__smirelDetailStarUiV2 = true;
  window[INSTALL_KEY] = detailStarUiInstall;
})();
