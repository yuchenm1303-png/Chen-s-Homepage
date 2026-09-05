(() => {
  'use strict';

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function' || baseInstall.__smirelFieldNavigation) return;

  const fieldInstall = function installStarFields(context) {
    const controller = baseInstall(context);
    if (!controller) return controller;

    const { THREE, camera, pointer, reducedMotion } = context || {};
    if (!THREE || !camera) return controller;

    const catalog = Array.isArray(controller.catalog)
      ? controller.catalog
      : (window.__SMIREL_STELLAR_CATALOG__ || []);
    const fields = catalog.filter((item) => item.kind === 'field');
    if (!fields.length) return controller;

    const objectById = new Map(catalog.map((item) => [item.id, item]));
    const fieldById = new Map(fields.map((item) => [item.id, item]));

    const ENTER_MS = reducedMotion ? 1 : 1180;
    const LEAVE_MS = reducedMotion ? 1 : 980;

    const state = {
      phase: 'galaxy',
      fieldId: null,
      startedAt: 0,
      galaxyPosition: new THREE.Vector3(),
      galaxyQuaternion: new THREE.Quaternion(),
      galaxyFov: camera.fov,
      fieldPosition: new THREE.Vector3(),
      fieldQuaternion: new THREE.Quaternion(),
      fieldFov: camera.fov,
      leaveStartPosition: new THREE.Vector3(),
      leaveStartQuaternion: new THREE.Quaternion(),
      leaveStartFov: camera.fov,
      pointerSnapshot: null,
    };

    const scratch = {
      centre: new THREE.Vector3(),
      point: new THREE.Vector3(),
      back: new THREE.Vector3(),
      forward: new THREE.Vector3(),
      targetPosition: new THREE.Vector3(),
      lookMatrix: new THREE.Matrix4(),
      targetQuaternion: new THREE.Quaternion(),
    };

    const style = document.createElement('style');
    style.dataset.smirelStarField = 'true';
    style.textContent = `
      .smirel-field-hud {
        position: fixed;
        left: clamp(22px, 3.2vw, 48px);
        top: clamp(20px, 3.1vh, 38px);
        z-index: 13;
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 14px 18px;
        align-items: center;
        min-width: min(430px, calc(100vw - 44px));
        max-width: min(560px, calc(100vw - 44px));
        color: rgba(247,250,255,.94);
        opacity: 0;
        transform: translate3d(0,-8px,0);
        pointer-events: none;
        transition: opacity .34s ease, transform .50s cubic-bezier(.16,1,.3,1);
      }
      body.star-field-transition .smirel-field-hud,
      body.star-field-open .smirel-field-hud {
        opacity: 1;
        transform: translate3d(0,0,0);
        pointer-events: auto;
      }
      .smirel-field-back {
        grid-row: 1 / span 2;
        align-self: start;
        border: 1px solid rgba(255,255,255,.15);
        border-radius: 999px;
        padding: 8px 11px;
        background: rgba(0,0,0,.20);
        color: rgba(255,255,255,.68);
        -webkit-backdrop-filter: blur(12px);
        backdrop-filter: blur(12px);
        font: 650 8px/1 ui-sans-serif, system-ui, sans-serif;
        letter-spacing: .13em;
        text-transform: uppercase;
        cursor: pointer;
      }
      .smirel-field-back:hover,
      .smirel-field-back:focus-visible {
        color: #fff;
        border-color: rgba(255,255,255,.34);
        outline: none;
      }
      .smirel-field-copy { min-width: 0; }
      .smirel-field-kicker {
        margin: 0 0 5px;
        color: rgba(255,255,255,.40);
        font: 650 8px/1 ui-sans-serif, system-ui, sans-serif;
        letter-spacing: .16em;
        text-transform: uppercase;
      }
      .smirel-field-title {
        margin: 0;
        font: 560 clamp(24px, 2.8vw, 40px)/.95 ui-rounded, "SF Pro Rounded", "Segoe UI", sans-serif;
        letter-spacing: -.04em;
        text-shadow: 0 2px 20px rgba(0,0,0,.85);
      }
      .smirel-field-subtitle {
        grid-column: 2;
        margin: -5px 0 0;
        max-width: 48ch;
        color: rgba(255,255,255,.48);
        font: 500 10px/1.45 ui-sans-serif, system-ui, sans-serif;
        letter-spacing: .015em;
        text-shadow: 0 1px 14px #000;
      }

      body.star-field-transition .home-overlay,
      body.star-field-open .home-overlay {
        opacity: 0 !important;
        pointer-events: none !important;
      }

      body.star-field-transition .smirel-field-star,
      body.star-field-open .smirel-field-star {
        opacity: 0 !important;
        pointer-events: none !important;
      }

      @media (max-width: 620px) {
        .smirel-field-hud {
          left: 14px;
          top: 14px;
          min-width: calc(100vw - 28px);
          max-width: calc(100vw - 28px);
          gap: 10px 12px;
        }
        .smirel-field-subtitle { display: none; }
      }

      @media (prefers-reduced-motion: reduce) {
        .smirel-field-hud { transition-duration: .01ms !important; }
      }
    `;
    document.head.appendChild(style);

    const hud = document.createElement('section');
    hud.className = 'smirel-field-hud';
    hud.setAttribute('aria-hidden', 'true');
    hud.innerHTML = `
      <button class="smirel-field-back" type="button">← Galaxy</button>
      <div class="smirel-field-copy">
        <p class="smirel-field-kicker"></p>
        <h2 class="smirel-field-title"></h2>
      </div>
      <p class="smirel-field-subtitle"></p>
    `;
    document.body.appendChild(hud);

    const backButton = hud.querySelector('.smirel-field-back');
    const kicker = hud.querySelector('.smirel-field-kicker');
    const title = hud.querySelector('.smirel-field-title');
    const subtitle = hud.querySelector('.smirel-field-subtitle');

    const baseUpdate = controller.update.bind(controller);
    const baseOpenObject = typeof controller.openObject === 'function'
      ? controller.openObject.bind(controller)
      : null;
    const baseNeedsDescriptor = Object.getOwnPropertyDescriptor(controller, 'needsContinuousRender');

    function smootherstep01(value) {
      const t = THREE.MathUtils.clamp(value, 0, 1);
      return t * t * t * (t * (t * 6 - 15) + 10);
    }

    function copyPointerSnapshot() {
      if (!pointer) return null;
      return {
        targetX: pointer.targetX,
        targetY: pointer.targetY,
        currentX: pointer.currentX,
        currentY: pointer.currentY,
      };
    }

    function restorePointerSnapshot(snapshot) {
      if (!pointer || !snapshot) return;
      pointer.targetX = snapshot.targetX;
      pointer.targetY = snapshot.targetY;
      pointer.currentX = snapshot.currentX;
      pointer.currentY = snapshot.currentY;
    }

    function updateHud(field) {
      if (!field) return;
      kicker.textContent = `${field.title.toUpperCase()} / LOCAL FIELD`;
      title.textContent = field.title;
      subtitle.textContent = field.field?.description || field.subtitle || '';
      hud.setAttribute('aria-label', `${field.title} local field`);
    }

    function computeFieldPose(field) {
      controller.resolveSpatialAnchors?.();
      const ids = [field.id, ...(field.constellation?.nodes || [])];
      const anchors = ids
        .map((id) => controller.getSpatialAnchor?.(id))
        .filter(Boolean);
      if (!anchors.length) return false;

      scratch.centre.set(0, 0, 0);
      let weightTotal = 0;
      for (const anchor of anchors) {
        const weight = anchor.object?.id === field.id ? 1.8 : 1;
        scratch.centre.addScaledVector(anchor.position, weight);
        weightTotal += weight;
      }
      scratch.centre.multiplyScalar(1 / Math.max(weightTotal, 1));

      let radius = 0;
      for (const anchor of anchors) {
        radius = Math.max(radius, anchor.position.distanceTo(scratch.centre));
      }

      scratch.back.subVectors(camera.position, scratch.centre);
      if (scratch.back.lengthSq() < 1e-6) {
        camera.getWorldDirection(scratch.forward);
        scratch.back.copy(scratch.forward).multiplyScalar(-1);
      }
      scratch.back.normalize();

      const fieldFov = field.field?.fov || (window.innerWidth <= 620 ? 54 : 46);
      const zoom = field.field?.zoom || 1;
      const distance = THREE.MathUtils.clamp(
        Math.max(radius * (1.62 / Math.max(zoom, .55)), 10.5),
        10.5,
        24,
      );

      scratch.targetPosition.copy(scratch.centre).addScaledVector(scratch.back, distance);
      scratch.lookMatrix.lookAt(scratch.targetPosition, scratch.centre, camera.up);
      scratch.targetQuaternion.setFromRotationMatrix(scratch.lookMatrix);

      state.fieldPosition.copy(scratch.targetPosition);
      state.fieldQuaternion.copy(scratch.targetQuaternion);
      state.fieldFov = fieldFov;
      return true;
    }

    function openField(fieldId) {
      const field = fieldById.get(fieldId);
      if (!field || state.phase !== 'galaxy') return false;
      if (document.body.classList.contains('star-flight-active')) return false;

      controller.resolveSpatialAnchors?.();
      if (!controller.getSpatialAnchor?.(fieldId)) return false;

      if (document.body.classList.contains('home-panel-open')) {
        document.querySelector('.home-panel-close')?.click();
      }

      state.galaxyPosition.copy(camera.position);
      state.galaxyQuaternion.copy(camera.quaternion);
      state.galaxyFov = camera.fov;
      state.pointerSnapshot = copyPointerSnapshot();
      if (!computeFieldPose(field)) return false;

      state.phase = 'entering';
      state.fieldId = fieldId;
      state.startedAt = performance.now();
      updateHud(field);

      document.body.dataset.starField = fieldId;
      document.body.classList.add('star-field-transition');
      document.body.classList.remove('star-field-open');
      hud.setAttribute('aria-hidden', 'false');
      controller.constellation?.setPersistentField?.(fieldId, true);
      window.dispatchEvent(new CustomEvent('smirel:field-change', {
        detail: { phase: 'entering', field },
      }));
      return true;
    }

    function leaveField() {
      if (state.phase !== 'field') return false;
      if (document.body.classList.contains('star-flight-active')) return false;

      state.phase = 'leaving';
      state.startedAt = performance.now();
      state.leaveStartPosition.copy(camera.position);
      state.leaveStartQuaternion.copy(camera.quaternion);
      state.leaveStartFov = camera.fov;
      document.body.classList.add('star-field-transition');
      document.body.classList.remove('star-field-open');
      window.dispatchEvent(new CustomEvent('smirel:field-change', {
        detail: { phase: 'leaving', field: fieldById.get(state.fieldId) || null },
      }));
      return true;
    }

    backButton?.addEventListener('click', leaveField);

    window.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (state.phase !== 'field') return;
      if (document.body.classList.contains('star-flight-active')) return;
      if (document.body.classList.contains('star-detail-open')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      leaveField();
    }, true);

    const panelToField = {
      about: 'about',
      projects: 'projects',
      notes: 'blog',
      blog: 'blog',
      contact: 'contact',
    };

    document.addEventListener('click', (event) => {
      const panelButton = event.target.closest?.('[data-home-panel]');
      const fieldId = panelButton ? panelToField[panelButton.dataset.homePanel] : null;
      if (!fieldId || state.phase !== 'galaxy') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openField(fieldId);
    }, true);

    controller.openField = openField;
    controller.leaveField = leaveField;
    controller.openObject = (objectId) => {
      const object = objectById.get(objectId);
      if (object?.kind === 'field') return openField(objectId);
      return baseOpenObject ? baseOpenObject(objectId) : false;
    };

    Object.defineProperty(controller, 'currentField', {
      configurable: true,
      get() {
        return state.fieldId ? fieldById.get(state.fieldId) || null : null;
      },
    });

    Object.defineProperty(controller, 'needsContinuousRender', {
      configurable: true,
      get() {
        const baseNeeds = baseNeedsDescriptor?.get
          ? Boolean(baseNeedsDescriptor.get.call(controller))
          : false;
        return baseNeeds || state.phase === 'entering' || state.phase === 'leaving';
      },
    });

    controller.update = (now, dt, elapsed) => {
      const baseOwnsCamera = baseUpdate(now, dt, elapsed);
      const contentFlightActive = document.body.classList.contains('star-flight-active');

      if (!contentFlightActive && state.phase === 'entering') {
        const raw = THREE.MathUtils.clamp((now - state.startedAt) / ENTER_MS, 0, 1);
        const t = smootherstep01(raw);
        camera.position.lerpVectors(state.galaxyPosition, state.fieldPosition, t);
        camera.quaternion.slerpQuaternions(state.galaxyQuaternion, state.fieldQuaternion, t);
        camera.fov = THREE.MathUtils.lerp(state.galaxyFov, state.fieldFov, t);
        camera.updateProjectionMatrix();

        if (raw >= 1) {
          camera.position.copy(state.fieldPosition);
          camera.quaternion.copy(state.fieldQuaternion);
          camera.fov = state.fieldFov;
          camera.updateProjectionMatrix();
          state.phase = 'field';
          document.body.classList.remove('star-field-transition');
          document.body.classList.add('star-field-open');
          window.dispatchEvent(new CustomEvent('smirel:field-change', {
            detail: { phase: 'open', field: fieldById.get(state.fieldId) || null },
          }));
        }
        return true;
      }

      if (!contentFlightActive && state.phase === 'field') {
        camera.position.copy(state.fieldPosition);
        camera.quaternion.copy(state.fieldQuaternion);
        camera.fov = state.fieldFov;
        camera.updateProjectionMatrix();
        controller.constellation?.setPersistentField?.(state.fieldId, true);
        return true;
      }

      if (!contentFlightActive && state.phase === 'leaving') {
        const raw = THREE.MathUtils.clamp((now - state.startedAt) / LEAVE_MS, 0, 1);
        const t = smootherstep01(raw);
        camera.position.lerpVectors(state.leaveStartPosition, state.galaxyPosition, t);
        camera.quaternion.slerpQuaternions(state.leaveStartQuaternion, state.galaxyQuaternion, t);
        camera.fov = THREE.MathUtils.lerp(state.leaveStartFov, state.galaxyFov, t);
        camera.updateProjectionMatrix();

        if (raw >= 1) {
          camera.position.copy(state.galaxyPosition);
          camera.quaternion.copy(state.galaxyQuaternion);
          camera.fov = state.galaxyFov;
          camera.updateProjectionMatrix();
          restorePointerSnapshot(state.pointerSnapshot);
          controller.constellation?.setPersistentField?.(state.fieldId, false);
          controller.constellation?.close?.(true);
          document.body.classList.remove('star-field-transition', 'star-field-open');
          delete document.body.dataset.starField;
          hud.setAttribute('aria-hidden', 'true');
          const previousField = fieldById.get(state.fieldId) || null;
          state.phase = 'galaxy';
          state.fieldId = null;
          window.dispatchEvent(new CustomEvent('smirel:field-change', {
            detail: { phase: 'galaxy', field: previousField },
          }));
        }
        return true;
      }

      return baseOwnsCamera || state.phase !== 'galaxy';
    };

    return controller;
  };

  fieldInstall.__smirelFieldNavigation = true;
  window[INSTALL_KEY] = fieldInstall;
})();
