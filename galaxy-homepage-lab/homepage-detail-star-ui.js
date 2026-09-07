(() => {
  'use strict';

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function' || baseInstall.__smirelDetailStarUiV1) return;

  const UI_FOV = 28;
  const ENTRY_MS = 760;
  const REJOIN_MS = 260;
  const CAMERA_RELEASE_MS = 560;
  const MAX_DPR = 1.0;
  const OWNED_FRAME_INTERVAL_MS = 1000 / 30;

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

  const detailStarUiInstall = function installDetailStarUiV1(context) {
    const controller = baseInstall(context);
    if (!controller) return controller;

    const { THREE, camera, reducedMotion } = context || {};
    if (!THREE || !camera) return controller;

    const baseUpdate = controller.update.bind(controller);

    let state = 'idle';
    let activeId = null;
    let sourceGroup = null;
    let uiGroup = null;
    let sourceNodes = [];
    let uiNodes = [];
    let materialPairs = [];
    let overlay = null;
    let canvas = null;
    let renderer = null;
    let uiScene = null;
    let uiCamera = null;
    let entryStartedAt = 0;
    let rejoinStartedAt = 0;
    let entryStartRect = null;
    let rejoinStartRect = null;
    let currentRect = null;
    let lastRenderSize = 0;
    let lastDpr = 0;
    let lastUiRenderMs = -Infinity;
    let rendererFailed = false;

    let previousArrived = false;
    let arrivalCaptured = false;
    let holdCaptured = false;
    let cameraReleaseStartedAt = 0;
    let cameraDetached = false;

    const worldCenter = new THREE.Vector3();
    const worldScale = new THREE.Vector3();
    const worldEdge = new THREE.Vector3();
    const projectedCenter = new THREE.Vector3();
    const projectedEdge = new THREE.Vector3();
    const cameraRight = new THREE.Vector3();

    const arrivalCameraPosition = new THREE.Vector3();
    const arrivalCameraQuaternion = new THREE.Quaternion();
    let arrivalCameraFov = 47;
    const holdCameraPosition = new THREE.Vector3();
    const holdCameraQuaternion = new THREE.Quaternion();
    let holdCameraFov = 47;
    const releaseCameraPosition = new THREE.Vector3();
    const releaseCameraQuaternion = new THREE.Quaternion();
    let releaseCameraFov = 47;

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

    function ensureOverlay() {
      if (overlay?.isConnected && canvas?.isConnected) return true;
      overlay = document.createElement('div');
      overlay.className = 'stellar-article-star-ui-layer stellar-detail-star-ui-layer';
      overlay.setAttribute('aria-hidden', 'true');
      canvas = document.createElement('canvas');
      canvas.className = 'stellar-article-star-ui-canvas stellar-detail-star-ui-canvas';
      overlay.appendChild(canvas);
      document.body.appendChild(overlay);
      return true;
    }

    function ensureRenderer() {
      if (rendererFailed) return false;
      if (renderer && uiScene && uiCamera) return true;
      if (!ensureOverlay()) return false;

      try {
        renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: true,
          antialias: true,
          depth: false,
          premultipliedAlpha: true,
          powerPreference: 'high-performance',
        });
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        renderer.setClearColor(0x000000, 0);

        uiScene = new THREE.Scene();
        uiCamera = new THREE.PerspectiveCamera(UI_FOV, 1, 0.1, 64);
        uiCamera.position.set(0, 0, 4);
        uiCamera.lookAt(0, 0, 0);
      } catch (error) {
        rendererFailed = true;
        console.warn('[homepage-detail-star-ui] renderer initialization failed; keeping world-space star', error);
        return false;
      }

      canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        rendererFailed = true;
        abortToWorld();
      }, { passive: false });
      return true;
    }

    function disposeUiModel() {
      if (uiGroup?.parent) uiGroup.parent.remove(uiGroup);
      for (const pair of materialPairs) pair.target?.dispose?.();
      uiGroup = null;
      sourceNodes = [];
      uiNodes = [];
      materialPairs = [];
    }

    function cloneMaterial(material) {
      if (!material) return material;
      if (Array.isArray(material)) return material.map((item) => item?.clone?.() || item);
      return material.clone?.() || material;
    }

    function registerMaterialPairs(sourceMaterial, targetMaterial) {
      if (Array.isArray(sourceMaterial) && Array.isArray(targetMaterial)) {
        const count = Math.min(sourceMaterial.length, targetMaterial.length);
        for (let i = 0; i < count; i += 1) {
          if (sourceMaterial[i] && targetMaterial[i]) {
            materialPairs.push({ source: sourceMaterial[i], target: targetMaterial[i] });
          }
        }
        return;
      }
      if (sourceMaterial && targetMaterial) materialPairs.push({ source: sourceMaterial, target: targetMaterial });
    }

    function configureLocalGlow() {
      if (!overlay) return;
      const sourceColor = controller.stellarModel?.photosphere?.material?.uniforms?.uBaseColor?.value;
      const color = sourceColor?.clone?.() || new THREE.Color(0xeaf6ff);
      color.lerp(new THREE.Color(0xffffff), 0.48);
      color.convertLinearToSRGB?.();
      const r = Math.round(clamp01(color.r) * 255);
      const g = Math.round(clamp01(color.g) * 255);
      const b = Math.round(clamp01(color.b) * 255);
      overlay.style.setProperty('--stellar-ui-glow-inner', `rgba(${r},${g},${b},.34)`);
      overlay.style.setProperty('--stellar-ui-glow-outer', `rgba(${r},${g},${b},.14)`);
    }

    function rebuildUiModel(group, objectId) {
      if (!ensureRenderer() || !group?.parent) return false;
      if (uiGroup && activeId === objectId && sourceGroup === group) return true;

      disposeUiModel();
      activeId = objectId;
      sourceGroup = group;
      uiGroup = group.clone(true);
      group.traverse((node) => sourceNodes.push(node));
      uiGroup.traverse((node) => uiNodes.push(node));

      const count = Math.min(sourceNodes.length, uiNodes.length);
      for (let i = 0; i < count; i += 1) {
        const sourceNode = sourceNodes[i];
        const uiNode = uiNodes[i];
        if (!uiNode) continue;
        if (sourceNode?.isSprite || uiNode.isSprite) {
          uiNode.visible = false;
          continue;
        }
        if (!sourceNode?.material) continue;
        const clonedMaterial = cloneMaterial(sourceNode.material);
        uiNode.material = clonedMaterial;
        registerMaterialPairs(sourceNode.material, clonedMaterial);
      }

      uiGroup.position.set(0, 0, 0);
      uiGroup.visible = true;
      uiScene.add(uiGroup);
      configureLocalGlow();
      lastUiRenderMs = -Infinity;
      return true;
    }

    function copyUniformValue(targetUniform, sourceUniform) {
      if (!targetUniform || !sourceUniform) return;
      const sourceValue = sourceUniform.value;
      const targetValue = targetUniform.value;
      if (sourceValue?.isTexture) {
        targetUniform.value = sourceValue;
      } else if (targetValue && sourceValue && typeof targetValue.copy === 'function') {
        targetValue.copy(sourceValue);
      } else if (Array.isArray(sourceValue)) {
        targetUniform.value = sourceValue.slice();
      } else {
        targetUniform.value = sourceValue;
      }
    }

    function syncMaterials() {
      for (const pair of materialPairs) {
        const sourceMaterial = pair.source;
        const targetMaterial = pair.target;
        if (!sourceMaterial || !targetMaterial) continue;
        targetMaterial.opacity = sourceMaterial.opacity;
        targetMaterial.visible = sourceMaterial.visible;
        if (!sourceMaterial.uniforms || !targetMaterial.uniforms) continue;
        for (const [name, targetUniform] of Object.entries(targetMaterial.uniforms)) {
          const sourceUniform = sourceMaterial.uniforms[name];
          if (sourceUniform) copyUniformValue(targetUniform, sourceUniform);
        }
      }
    }

    function syncUiModel() {
      if (!sourceGroup || !uiGroup) return;
      const count = Math.min(sourceNodes.length, uiNodes.length);
      for (let i = 0; i < count; i += 1) {
        const sourceNode = sourceNodes[i];
        const uiNode = uiNodes[i];
        if (!sourceNode || !uiNode) continue;
        if (sourceNode.isSprite || uiNode.isSprite) {
          uiNode.visible = false;
          continue;
        }
        uiNode.position.copy(sourceNode.position);
        uiNode.quaternion.copy(sourceNode.quaternion);
        if (i === 0) {
          const scalar = Math.max(
            0.001,
            (Math.abs(sourceNode.scale.x) + Math.abs(sourceNode.scale.y) + Math.abs(sourceNode.scale.z)) / 3,
          );
          uiNode.scale.setScalar(scalar);
        } else {
          uiNode.scale.copy(sourceNode.scale);
        }
        if (i !== 0) uiNode.visible = sourceNode.visible;
      }
      uiGroup.position.set(0, 0, 0);
      uiGroup.visible = true;
      syncMaterials();
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

    function setOverlayRect(inputRect) {
      if (!overlay || !inputRect) return false;
      const rect = squareRect(inputRect);
      if (!rect) return false;
      currentRect = rect;
      overlay.style.left = `${rect.left}px`;
      overlay.style.top = `${rect.top}px`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.width}px`;

      const size = Math.max(1, Math.round(rect.width));
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      if (Math.abs(size - lastRenderSize) > 1 || Math.abs(dpr - lastDpr) > 0.01) {
        lastRenderSize = size;
        lastDpr = dpr;
        renderer.setPixelRatio(dpr);
        renderer.setSize(size, size, false);
        uiCamera.aspect = 1;
        uiCamera.updateProjectionMatrix();
      }
      return true;
    }

    function fitUiCamera(inputRect) {
      if (!uiGroup || !uiCamera || !inputRect) return;
      const rect = squareRect(inputRect);
      if (!rect) return;
      const radiusPx = Math.max(1, rect.width * coreRadiusFraction());
      const focalPixels = rect.width / Math.max(
        2 * Math.tan(THREE.MathUtils.degToRad(UI_FOV) * 0.5),
        1e-5,
      );
      const modelRadius = Math.max(uiGroup.scale.x, 0.001);
      const distance = modelRadius * focalPixels / radiusPx;
      uiCamera.aspect = 1;
      uiCamera.position.set(0, 0, Math.max(distance, 0.25));
      uiCamera.lookAt(0, 0, 0);
      uiCamera.updateProjectionMatrix();
    }

    function renderUi(rect, now = performance.now(), force = false) {
      if (!renderer || !uiGroup || !rect) return false;
      const square = squareRect(rect);
      if (!square || !setOverlayRect(square)) return false;
      fitUiCamera(square);
      if (!force && now - lastUiRenderMs < OWNED_FRAME_INTERVAL_MS) return true;
      syncUiModel();
      renderer.render(uiScene, uiCamera);
      lastUiRenderMs = now;
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
      if (state !== 'idle' || rendererFailed || !detailModeReady()) return false;
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
      if (!renderUi(startRect, now, true)) {
        state = 'idle';
        setUiOwned(false);
        return false;
      }

      overlay.classList.add('is-active');
      overlay.style.opacity = '1';
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
      if (rect) renderUi(rect, now, true);
      if (raw >= 1) {
        currentRect = slotRect;
        state = 'owned';
        lastUiRenderMs = -Infinity;
      }
    }

    function updateOwned(now) {
      if (!sourceGroup?.parent || !uiGroup) {
        abortToWorld();
        return;
      }
      sourceGroup.visible = false;
      const slotRect = readSlotRect();
      if (slotRect) renderUi(slotRect, now, false);
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
        renderUi(rejoinStartRect, now, true);
        return;
      }
      const duration = reducedMotion ? 1 : REJOIN_MS;
      const raw = clamp01((now - rejoinStartedAt) / duration);
      const rect = lerpSquareRect(rejoinStartRect, targetRect, smootherstep01(raw));
      if (rect) renderUi(rect, now, true);

      if (raw >= 1) {
        sourceGroup.visible = true;
        overlay.style.opacity = '0';
        overlay.classList.remove('is-active');
        setUiOwned(false);
        state = 'world';
      }
    }

    function abortToWorld() {
      if (sourceGroup?.parent && document.body.classList.contains('star-flight-arrived')) {
        sourceGroup.visible = true;
      }
      if (overlay) {
        overlay.style.opacity = '0';
        overlay.classList.remove('is-active');
      }
      setUiOwned(false);
      state = 'world';
    }

    function resetAfterFlight() {
      if (overlay) {
        overlay.style.opacity = '0';
        overlay.classList.remove('is-active');
      }
      setUiOwned(false);
      state = 'idle';
      activeId = null;
      sourceGroup = null;
      entryStartRect = null;
      rejoinStartRect = null;
      currentRect = null;
      lastUiRenderMs = -Infinity;
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

        // Neutralize the legacy detail-camera placement before computing any
        // UI->world rejoin target. During extraction the camera is frozen at the
        // exact handoff frame; once the UI star settles, the background camera
        // eases back to the original flight-arrival composition.
        applyCameraOwnership(now);

        if (closing && (state === 'owned' || state === 'extracting')) beginRejoin(now);
        if (state === 'idle') startExtraction(now);
        if (state === 'extracting') updateExtraction(now);
        else if (state === 'owned') updateOwned(now);
        else if (state === 'rejoining') updateRejoin(now);

        applyCameraOwnership(now);
      } catch (error) {
        console.warn('[homepage-detail-star-ui] handoff failed; restoring world-space star', error);
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

  detailStarUiInstall.__smirelDetailStarUiV1 = true;
  window[INSTALL_KEY] = detailStarUiInstall;
})();
