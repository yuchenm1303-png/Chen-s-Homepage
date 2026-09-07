(() => {
  'use strict';

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function' || baseInstall.__smirelArticleStarUi) return;

  const POSTPROCESSING_URL = 'https://cdn.jsdelivr.net/npm/postprocessing@6.39.4/build/index.js';
  let postprocessing = null;
  let postprocessingFailed = false;
  import(POSTPROCESSING_URL)
    .then((module) => { postprocessing = module; })
    .catch((error) => {
      postprocessingFailed = true;
      console.warn('[homepage-article-star-ui] postprocessing unavailable; keeping world-space star', error);
    });

  const CORE_RADIUS_FRACTION = 0.35;
  const UI_FOV = 28;
  const ENTRY_MS = 760;
  const REJOIN_MS = 260;
  const MAX_DPR = 1.5;

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

  function lerpRect(from, to, t) {
    return {
      left: lerp(from.left, to.left, t),
      top: lerp(from.top, to.top, t),
      width: lerp(from.width, to.width, t),
      height: lerp(from.height, to.height, t),
    };
  }

  const articleStarUiInstall = function installArticleStarUi(context) {
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
    let composer = null;
    let uiScene = null;
    let uiCamera = null;
    let entryStartedAt = 0;
    let rejoinStartedAt = 0;
    let entryStartRect = null;
    let rejoinStartRect = null;
    let currentRect = null;
    let lastRenderWidth = 0;
    let lastRenderHeight = 0;
    let lastDpr = 0;
    let rendererFailed = false;

    const worldCenter = new THREE.Vector3();
    const worldScale = new THREE.Vector3();
    const worldEdge = new THREE.Vector3();
    const projectedCenter = new THREE.Vector3();
    const projectedEdge = new THREE.Vector3();
    const cameraRight = new THREE.Vector3();

    function setUiOwned(owned) {
      document.body.classList.toggle('star-detail-ui-star-owned', Boolean(owned));
    }

    function ensureOverlay() {
      if (overlay?.isConnected && canvas?.isConnected) return true;

      overlay = document.createElement('div');
      overlay.className = 'stellar-article-star-ui-layer';
      overlay.setAttribute('aria-hidden', 'true');
      canvas = document.createElement('canvas');
      canvas.className = 'stellar-article-star-ui-canvas';
      overlay.appendChild(canvas);
      document.body.appendChild(overlay);
      return true;
    }

    function ensureRenderer() {
      if (rendererFailed || postprocessingFailed || !postprocessing) return false;
      if (renderer && composer && uiScene && uiCamera) return true;
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
        renderer.toneMapping = THREE.NoToneMapping;
        renderer.setClearColor(0x000000, 0);

        uiScene = new THREE.Scene();
        uiCamera = new THREE.PerspectiveCamera(UI_FOV, 1, 0.1, 64);
        uiCamera.position.set(0, 0, 4);
        uiCamera.lookAt(0, 0, 0);

        const {
          EffectComposer,
          EffectPass,
          RenderPass,
          ToneMappingEffect,
          ToneMappingMode,
        } = postprocessing;

        composer = new EffectComposer(renderer, {
          depthBuffer: false,
          frameBufferType: THREE.HalfFloatType,
          multisampling: 2,
        });
        composer.addPass(new RenderPass(uiScene, uiCamera));
        composer.addPass(new EffectPass(
          uiCamera,
          new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }),
        ));
      } catch (error) {
        rendererFailed = true;
        console.warn('[homepage-article-star-ui] renderer initialization failed; keeping world-space star', error);
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
      for (const pair of materialPairs) {
        pair.target?.dispose?.();
      }
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
      if (sourceMaterial && targetMaterial) {
        materialPairs.push({ source: sourceMaterial, target: targetMaterial });
      }
    }

    function rebuildUiModel(group, objectId) {
      if (!ensureRenderer() || !group?.parent) return false;
      if (uiGroup && activeId === objectId && sourceGroup === group) return true;

      disposeUiModel();
      activeId = objectId;
      sourceGroup = group;
      uiGroup = group.clone(true);
      sourceNodes = [];
      uiNodes = [];
      group.traverse((node) => sourceNodes.push(node));
      uiGroup.traverse((node) => uiNodes.push(node));

      const count = Math.min(sourceNodes.length, uiNodes.length);
      for (let i = 0; i < count; i += 1) {
        const sourceNode = sourceNodes[i];
        const uiNode = uiNodes[i];
        if (!sourceNode?.material || !uiNode) continue;
        const clonedMaterial = cloneMaterial(sourceNode.material);
        uiNode.material = clonedMaterial;
        registerMaterialPairs(sourceNode.material, clonedMaterial);
      }

      uiGroup.position.set(0, 0, 0);
      uiGroup.visible = true;
      uiScene.add(uiGroup);
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
          if (!sourceUniform) continue;
          copyUniformValue(targetUniform, sourceUniform);
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
        uiNode.position.copy(sourceNode.position);
        uiNode.quaternion.copy(sourceNode.quaternion);
        uiNode.scale.copy(sourceNode.scale);
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
      const diameterFraction = CORE_RADIUS_FRACTION * 2;
      const size = Math.max(24, radiusPx * 2 / diameterFraction);

      return {
        left: centreX - size * 0.5,
        top: centreY - size * 0.5,
        width: size,
        height: size,
      };
    }

    function readSlotRect() {
      const slot = document.querySelector('.star-detail-shell.is-article-reader .star-detail-star-slot');
      if (!slot) return null;
      const rect = slot.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };
    }

    function setOverlayRect(rect) {
      if (!overlay || !rect) return false;
      currentRect = rect;
      overlay.style.left = `${rect.left}px`;
      overlay.style.top = `${rect.top}px`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;

      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      if (Math.abs(width - lastRenderWidth) > 1
          || Math.abs(height - lastRenderHeight) > 1
          || Math.abs(dpr - lastDpr) > 0.01) {
        lastRenderWidth = width;
        lastRenderHeight = height;
        lastDpr = dpr;
        renderer.setPixelRatio(dpr);
        renderer.setSize(width, height, false);
        composer.setSize(width, height, false);
        uiCamera.aspect = width / Math.max(height, 1);
        uiCamera.updateProjectionMatrix();
      }
      return true;
    }

    function fitUiCamera(rect) {
      if (!uiGroup || !uiCamera || !rect) return;
      const radiusPx = Math.max(1, Math.min(rect.width, rect.height) * CORE_RADIUS_FRACTION);
      const focalPixels = rect.height / Math.max(
        2 * Math.tan(THREE.MathUtils.degToRad(UI_FOV) * 0.5),
        1e-5,
      );
      const modelRadius = Math.max(uiGroup.scale.x, uiGroup.scale.y, uiGroup.scale.z, 0.001);
      const distance = modelRadius * focalPixels / radiusPx;
      uiCamera.position.set(0, 0, Math.max(distance, 0.25));
      uiCamera.lookAt(0, 0, 0);
      uiCamera.updateProjectionMatrix();
    }

    function renderUi(rect) {
      if (!composer || !uiGroup || !rect) return false;
      syncUiModel();
      if (!setOverlayRect(rect)) return false;
      fitUiCamera(rect);
      composer.render();
      return true;
    }

    function articleModeReady() {
      const object = controller.activeObject;
      const shell = document.querySelector('.star-detail-shell');
      return Boolean(
        object
        && object.kind === 'note'
        && object.articleHtml
        && shell?.classList.contains('is-article-reader')
        && shell.dataset.starId === object.id
        && document.body.classList.contains('star-flight-arrived')
      );
    }

    function startExtraction(now) {
      if (state !== 'idle' || rendererFailed || postprocessingFailed || !postprocessing) return false;
      if (!articleModeReady() || !document.body.classList.contains('star-detail-open')) return false;
      if (document.body.classList.contains('star-detail-closing')) return false;

      const object = controller.activeObject;
      const group = controller.stellarModel?.group || null;
      const startRect = projectWorldStarRect(group);
      const slotRect = readSlotRect();
      if (!object || !group || !startRect || !slotRect) return false;
      if (!rebuildUiModel(group, object.id)) return false;

      entryStartRect = startRect;
      entryStartedAt = now;
      state = 'extracting';
      setUiOwned(true);

      if (!renderUi(startRect)) {
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
      const motion = smootherstep01(raw);
      const rect = lerpRect(entryStartRect, slotRect, motion);
      renderUi(rect);
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
      if (slotRect) renderUi(slotRect);
    }

    function beginRejoin(now) {
      if (state !== 'owned' && state !== 'extracting') return;
      rejoinStartRect = currentRect || readSlotRect() || projectWorldStarRect(sourceGroup);
      rejoinStartedAt = now;
      state = 'rejoining';
    }

    function updateRejoin(now) {
      if (!sourceGroup?.parent || !uiGroup || !rejoinStartRect) {
        abortToWorld();
        return;
      }

      sourceGroup.visible = false;
      const targetRect = projectWorldStarRect(sourceGroup);
      if (!targetRect) {
        renderUi(rejoinStartRect);
        return;
      }

      const duration = reducedMotion ? 1 : REJOIN_MS;
      const raw = clamp01((now - rejoinStartedAt) / duration);
      const motion = smootherstep01(raw);
      const rect = lerpRect(rejoinStartRect, targetRect, motion);
      renderUi(rect);

      if (raw >= 1) {
        // The main composer renders after controller.update(). Switching here
        // means the world star is drawn in the exact screen rect that the UI
        // renderer occupied during this same frame.
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
      disposeUiModel();
    }

    controller.update = (now, dt, elapsed) => {
      const ownsCamera = baseUpdate(now, dt, elapsed);
      const arrived = document.body.classList.contains('star-flight-arrived');
      const closing = document.body.classList.contains('star-detail-closing');

      try {
        if (!arrived) {
          if (state !== 'idle') resetAfterFlight();
          return ownsCamera;
        }

        if (closing && (state === 'owned' || state === 'extracting')) {
          beginRejoin(now);
        }

        if (state === 'idle') {
          startExtraction(now);
        }

        if (state === 'extracting') {
          updateExtraction(now);
        } else if (state === 'owned') {
          updateOwned();
        } else if (state === 'rejoining') {
          updateRejoin(now);
        }
      } catch (error) {
        console.warn('[homepage-article-star-ui] handoff failed; restoring world-space star', error);
        abortToWorld();
      }

      return ownsCamera || state === 'extracting' || state === 'owned' || state === 'rejoining';
    };

    Object.defineProperty(controller, 'articleStarUiState', {
      configurable: true,
      get() {
        return state;
      },
    });

    return controller;
  };

  articleStarUiInstall.__smirelArticleStarUi = true;
  window[INSTALL_KEY] = articleStarUiInstall;
})();
