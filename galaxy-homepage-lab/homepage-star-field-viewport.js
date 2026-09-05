(() => {
  'use strict';

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function' || baseInstall.__smirelFieldViewport) return;

  const fieldViewportInstall = function installFieldViewport(context) {
    const controller = baseInstall(context);
    if (!controller) return controller;

    const { THREE, camera, reducedMotion, brightField } = context || {};
    if (!THREE || !camera) return controller;

    const catalog = Array.isArray(controller.catalog)
      ? controller.catalog
      : (window.__SMIREL_STELLAR_CATALOG__ || []);
    const fieldById = new Map(
      catalog.filter((item) => item.kind === 'field').map((item) => [item.id, item]),
    );

    const ENTER_MS = reducedMotion ? 1 : 1180;
    const REFRAME_MS = reducedMotion ? 1 : 520;
    const FIT_FOV_MAX = 62;
    const POINTER_DAMP_SPEED = 2.7;

    const state = {
      mode: 'galaxy',
      field: null,
      startedAt: 0,

      startPosition: new THREE.Vector3(),
      startQuaternion: new THREE.Quaternion(),
      startFov: camera.fov,

      centre: new THREE.Vector3(),
      basePosition: new THREE.Vector3(),
      baseQuaternion: new THREE.Quaternion(),
      baseBack: new THREE.Vector3(0, 0, 1),
      right: new THREE.Vector3(1, 0, 0),
      up: new THREE.Vector3(0, 1, 0),
      distance: 16,
      fov: camera.fov,

      pointerTargetX: 0,
      pointerTargetY: 0,
      pointerCurrentX: 0,
      pointerCurrentY: 0,
      renderUntil: 0,

      // A content flight leaves a fitted local field, visits a detail, then
      // returns through the base star-flight controller. Freeze the exact field
      // camera + pointer state for that whole trip so the field can resume from
      // the same pose instead of recomputing a different camera on the handoff
      // frame.
      contentHandoff: null,
      pendingRefit: false,

      reframeStartPosition: new THREE.Vector3(),
      reframeStartQuaternion: new THREE.Quaternion(),
      reframeStartFov: camera.fov,
      reframeTargetPosition: new THREE.Vector3(),
      reframeTargetQuaternion: new THREE.Quaternion(),
      reframeTargetFov: camera.fov,
    };

    const scratch = {
      min: new THREE.Vector3(),
      max: new THREE.Vector3(),
      world: new THREE.Vector3(),
      relative: new THREE.Vector3(),
      forward: new THREE.Vector3(),
      right: new THREE.Vector3(),
      up: new THREE.Vector3(),
      look: new THREE.Vector3(),
      position: new THREE.Vector3(),
      targetPosition: new THREE.Vector3(),
      lookMatrix: new THREE.Matrix4(),
      targetQuaternion: new THREE.Quaternion(),
      projected: new THREE.Vector3(),
    };

    const baseUpdate = controller.update.bind(controller);
    const baseNeedsDescriptor = Object.getOwnPropertyDescriptor(controller, 'needsContinuousRender');
    const baseShouldRenderFrame = typeof controller.shouldRenderFrame === 'function'
      ? controller.shouldRenderFrame.bind(controller)
      : null;
    const baseMotionLodActive = typeof controller.motionLodActive === 'function'
      ? controller.motionLodActive.bind(controller)
      : null;

    const style = document.createElement('style');
    style.dataset.smirelFieldViewport = 'true';
    style.textContent = `
      .smirel-companion-star.is-label-left .smirel-companion-label {
        left: auto;
        right: 36px;
        align-items: flex-end;
        text-align: right;
      }
    `;
    document.head.appendChild(style);

    function smootherstep01(value) {
      const t = THREE.MathUtils.clamp(value, 0, 1);
      return t * t * t * (t * (t * 6 - 15) + 10);
    }

    function shapeAxis(value) {
      const dead = 0.045;
      const a = Math.abs(value);
      if (a <= dead) return 0;
      const n = Math.min(1, (a - dead) / (1 - dead));
      return Math.sign(value) * n * n * (3 - 2 * n);
    }

    function damp(current, target, speed, dt) {
      return current + (target - current) * (1 - Math.exp(-speed * dt));
    }

    function contentOwnsCamera() {
      return document.body.classList.contains('star-flight-active')
        || document.body.classList.contains('star-detail-open');
    }

    function advancePointer(dt) {
      if (reducedMotion) return;
      if (state.contentHandoff || contentOwnsCamera()) return;
      if (state.mode !== 'entering' && state.mode !== 'field') return;
      state.pointerCurrentX = damp(
        state.pointerCurrentX,
        state.pointerTargetX,
        POINTER_DAMP_SPEED,
        dt,
      );
      state.pointerCurrentY = damp(
        state.pointerCurrentY,
        state.pointerTargetY,
        POINTER_DAMP_SPEED,
        dt,
      );
    }

    function anchorWorldPosition(id, target) {
      const anchor = controller.getSpatialAnchor?.(id);
      if (!anchor?.position) return null;
      target.copy(anchor.position);
      const points = brightField?.points;
      if (points?.matrixWorld) {
        points.updateMatrixWorld?.(true);
        target.applyMatrix4(points.matrixWorld);
      }
      return target;
    }

    function collectFieldPoints(field) {
      controller.resolveSpatialAnchors?.();
      const ids = [field.id, ...(field.constellation?.nodes || [])];
      const points = [];
      for (const id of ids) {
        const value = anchorWorldPosition(id, new THREE.Vector3());
        if (value) points.push({ id, position: value });
      }
      return points;
    }

    function requiredDistance(points, centre, back, fov) {
      scratch.lookMatrix.lookAt(
        scratch.position.copy(centre).add(back),
        centre,
        camera.up,
      );
      scratch.targetQuaternion.setFromRotationMatrix(scratch.lookMatrix);
      scratch.right.set(1, 0, 0).applyQuaternion(scratch.targetQuaternion).normalize();
      scratch.up.set(0, 1, 0).applyQuaternion(scratch.targetQuaternion).normalize();

      const vHalf = THREE.MathUtils.degToRad(fov * 0.5);
      const hHalf = Math.atan(Math.tan(vHalf) * Math.max(camera.aspect, 0.25));
      const safeX = window.innerWidth <= 760 ? 0.62 : 0.72;
      const safeY = window.innerWidth <= 760 ? 0.60 : 0.68;
      const tanH = Math.max(Math.tan(hHalf) * safeX, 0.08);
      const tanV = Math.max(Math.tan(vHalf) * safeY, 0.08);

      let distance = 9.5;
      for (const point of points) {
        scratch.relative.subVectors(point.position, centre);
        const x = Math.abs(scratch.relative.dot(scratch.right));
        const y = Math.abs(scratch.relative.dot(scratch.up));
        const towardCamera = scratch.relative.dot(back);
        distance = Math.max(
          distance,
          x / tanH + towardCamera,
          y / tanV + towardCamera,
        );
      }
      return distance + 1.35;
    }

    function computeFit(field, preserveBack = false) {
      const points = collectFieldPoints(field);
      if (!points.length) return false;

      scratch.min.set(Infinity, Infinity, Infinity);
      scratch.max.set(-Infinity, -Infinity, -Infinity);
      for (const point of points) {
        scratch.min.min(point.position);
        scratch.max.max(point.position);
      }
      state.centre.addVectors(scratch.min, scratch.max).multiplyScalar(0.5);

      if (!preserveBack) {
        state.baseBack.subVectors(camera.position, state.centre);
        if (state.baseBack.lengthSq() < 1e-6) {
          camera.getWorldDirection(scratch.forward);
          state.baseBack.copy(scratch.forward).multiplyScalar(-1);
        }
        state.baseBack.normalize();
      }

      let fieldFov = field.field?.fov || (window.innerWidth <= 620 ? 54 : 46);
      let distance = requiredDistance(points, state.centre, state.baseBack, fieldFov);

      let depthRadius = 0;
      for (const point of points) {
        scratch.relative.subVectors(point.position, state.centre);
        depthRadius = Math.max(depthRadius, Math.abs(scratch.relative.dot(state.baseBack)));
      }

      const farBudget = Math.max(13, camera.far - depthRadius - 3.5);
      while (distance > farBudget && fieldFov < FIT_FOV_MAX) {
        fieldFov = Math.min(FIT_FOV_MAX, fieldFov + 2);
        distance = requiredDistance(points, state.centre, state.baseBack, fieldFov);
      }
      distance = Math.min(distance, farBudget);

      state.distance = distance;
      state.fov = fieldFov;
      state.basePosition.copy(state.centre).addScaledVector(state.baseBack, distance);
      scratch.lookMatrix.lookAt(state.basePosition, state.centre, camera.up);
      state.baseQuaternion.setFromRotationMatrix(scratch.lookMatrix);
      state.right.set(1, 0, 0).applyQuaternion(state.baseQuaternion).normalize();
      state.up.set(0, 1, 0).applyQuaternion(state.baseQuaternion).normalize();
      return true;
    }

    function pointerMotionActive(now = performance.now()) {
      if (state.mode !== 'field' || reducedMotion || state.contentHandoff) return false;
      const settling = Math.abs(state.pointerTargetX - state.pointerCurrentX) > 0.0007
        || Math.abs(state.pointerTargetY - state.pointerCurrentY) > 0.0007;
      return settling || now < state.renderUntil;
    }

    function buildInteractivePose(scale = 1) {
      const px = reducedMotion ? 0 : state.pointerCurrentX * scale;
      const py = reducedMotion ? 0 : state.pointerCurrentY * scale;

      const positionX = state.distance * 0.016;
      const positionY = state.distance * 0.010;
      const lookX = state.distance * 0.072;
      const lookY = state.distance * 0.046;

      scratch.targetPosition.copy(state.basePosition)
        .addScaledVector(state.right, px * positionX)
        .addScaledVector(state.up, py * positionY);
      scratch.look.copy(state.centre)
        .addScaledVector(state.right, px * lookX)
        .addScaledVector(state.up, py * lookY);
      scratch.lookMatrix.lookAt(scratch.targetPosition, scratch.look, camera.up);
      scratch.targetQuaternion.setFromRotationMatrix(scratch.lookMatrix);
    }

    function applyStablePose(scale = 1) {
      buildInteractivePose(scale);
      camera.position.copy(scratch.targetPosition);
      camera.quaternion.copy(scratch.targetQuaternion);
      camera.fov = state.fov;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
    }

    function projectAnchor(id) {
      const world = anchorWorldPosition(id, scratch.world);
      if (!world) return null;
      scratch.projected.copy(world).project(camera);
      if (scratch.projected.z < -1 || scratch.projected.z > 1) return null;
      return {
        x: (scratch.projected.x * 0.5 + 0.5) * window.innerWidth,
        y: (-scratch.projected.y * 0.5 + 0.5) * window.innerHeight,
      };
    }

    function refreshVisibleConstellation() {
      const fieldId = state.field?.id || document.body.dataset.starField;
      if (!fieldId) return;

      camera.updateMatrixWorld(true);
      const points = new Map();
      const pointFor = (id) => {
        if (points.has(id)) return points.get(id);
        const point = projectAnchor(id);
        points.set(id, point);
        return point;
      };

      const selector = `.smirel-companion-star[data-parent-field="${CSS.escape(fieldId)}"]`;
      for (const marker of document.querySelectorAll(selector)) {
        if (marker.hidden || !marker.classList.contains('is-open')) continue;
        const point = pointFor(marker.dataset.companionId);
        if (!point) {
          marker.style.opacity = '0';
          marker.style.pointerEvents = 'none';
          continue;
        }
        marker.style.transform = `translate3d(${point.x}px, ${point.y}px, 0)`;
        marker.style.opacity = '';
        marker.style.pointerEvents = '';
        marker.classList.toggle('is-label-left', point.x > window.innerWidth - 290);
      }

      const edgeSelector = `.smirel-constellation-edge[data-parent-field="${CSS.escape(fieldId)}"]`;
      for (const line of document.querySelectorAll(edgeSelector)) {
        if (!line.classList.contains('is-open')) continue;
        const from = pointFor(line.dataset.fromStar);
        const to = pointFor(line.dataset.toStar);
        if (!from || !to) {
          line.style.opacity = '0';
          continue;
        }
        line.setAttribute('x1', from.x.toFixed(2));
        line.setAttribute('y1', from.y.toFixed(2));
        line.setAttribute('x2', to.x.toFixed(2));
        line.setAttribute('y2', to.y.toFixed(2));
        line.style.opacity = '';
      }
    }

    function captureContentHandoff() {
      if (state.mode !== 'field' || !state.field || state.contentHandoff) return;
      if (!document.body.classList.contains('star-field-open')) return;

      state.contentHandoff = {
        fieldId: state.field.id,
        pointerTargetX: state.pointerTargetX,
        pointerTargetY: state.pointerTargetY,
        pointerCurrentX: state.pointerCurrentX,
        pointerCurrentY: state.pointerCurrentY,
        cameraPosition: camera.position.clone(),
        cameraQuaternion: camera.quaternion.clone(),
        cameraFov: camera.fov,
      };
      state.pendingRefit = false;
    }

    function startReframe(now) {
      if (!state.field) return false;

      state.reframeStartPosition.copy(camera.position);
      state.reframeStartQuaternion.copy(camera.quaternion);
      state.reframeStartFov = camera.fov;

      if (!computeFit(state.field, true)) return false;
      buildInteractivePose(1);
      state.reframeTargetPosition.copy(scratch.targetPosition);
      state.reframeTargetQuaternion.copy(scratch.targetQuaternion);
      state.reframeTargetFov = state.fov;
      state.startedAt = now;
      state.mode = 'reframing';
      state.renderUntil = now + REFRAME_MS + 120;
      return true;
    }

    function finishContentHandoff(now) {
      const snapshot = state.contentHandoff;
      if (!snapshot) return false;

      state.contentHandoff = null;
      if (!state.field || snapshot.fieldId !== state.field.id) {
        state.pendingRefit = false;
        return false;
      }

      state.pointerTargetX = snapshot.pointerTargetX;
      state.pointerTargetY = snapshot.pointerTargetY;
      state.pointerCurrentX = snapshot.pointerCurrentX;
      state.pointerCurrentY = snapshot.pointerCurrentY;

      // Force the first field-owned frame to be byte-for-byte the pose that the
      // star-flight controller originally captured as homePosition. The inner
      // field controller may have written its legacy static pose earlier in this
      // same update; this outer viewport owns the final camera and restores the
      // exact handoff pose before presentation.
      camera.position.copy(snapshot.cameraPosition);
      camera.quaternion.copy(snapshot.cameraQuaternion);
      camera.fov = snapshot.cameraFov;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);

      const needsRefit = state.pendingRefit;
      state.pendingRefit = false;
      state.mode = 'field';
      state.renderUntil = now + 220;
      refreshVisibleConstellation();

      if (needsRefit) startReframe(now);
      return true;
    }

    window.addEventListener('smirel:stellar-object', captureContentHandoff);

    window.addEventListener('pointermove', (event) => {
      if (reducedMotion || state.contentHandoff || contentOwnsCamera()) return;
      state.pointerTargetX = shapeAxis(
        event.clientX / Math.max(window.innerWidth, 1) * 2 - 1,
      );
      state.pointerTargetY = shapeAxis(
        -(event.clientY / Math.max(window.innerHeight, 1) * 2 - 1),
      );
      if (state.mode === 'field' || state.mode === 'entering') {
        state.renderUntil = performance.now() + 220;
      }
    }, { passive: true });

    function resetFieldPointer() {
      if (state.contentHandoff || contentOwnsCamera()) return;
      state.pointerTargetX = 0;
      state.pointerTargetY = 0;
      if (state.mode === 'field') state.renderUntil = performance.now() + 220;
    }

    window.addEventListener('pointerleave', resetFieldPointer, { passive: true });
    window.addEventListener('blur', resetFieldPointer, { passive: true });

    window.addEventListener('resize', () => {
      if (!state.field) return;
      if (state.contentHandoff || contentOwnsCamera()) {
        state.pendingRefit = true;
        return;
      }
      if (state.mode !== 'field' && state.mode !== 'entering') return;
      computeFit(state.field, true);
      state.renderUntil = performance.now() + 240;
    }, { passive: true });

    window.addEventListener('smirel:field-change', (event) => {
      const phase = event.detail?.phase;
      const field = event.detail?.field
        || fieldById.get(document.body.dataset.starField)
        || null;

      if (phase === 'entering' && field) {
        state.mode = 'entering';
        state.field = field;
        state.startedAt = performance.now();
        state.startPosition.copy(camera.position);
        state.startQuaternion.copy(camera.quaternion);
        state.startFov = camera.fov;
        state.pointerCurrentX = 0;
        state.pointerCurrentY = 0;
        state.contentHandoff = null;
        state.pendingRefit = false;
        computeFit(field, false);
        state.renderUntil = performance.now() + ENTER_MS + 220;
        return;
      }

      if (phase === 'open' && field) {
        state.mode = 'field';
        state.field = field;
        state.renderUntil = performance.now() + 220;
        return;
      }

      if (phase === 'leaving') {
        state.mode = 'leaving';
        state.contentHandoff = null;
        state.pendingRefit = false;
        return;
      }

      if (phase === 'galaxy') {
        state.mode = 'galaxy';
        state.field = null;
        state.pointerCurrentX = 0;
        state.pointerCurrentY = 0;
        state.contentHandoff = null;
        state.pendingRefit = false;
      }
    });

    Object.defineProperty(controller, 'needsContinuousRender', {
      configurable: true,
      get() {
        const baseNeeds = baseNeedsDescriptor?.get
          ? Boolean(baseNeedsDescriptor.get.call(controller))
          : false;
        return baseNeeds
          || state.mode === 'entering'
          || state.mode === 'reframing'
          || pointerMotionActive();
      },
    });

    controller.shouldRenderFrame = (now, lastCompositeMs) => {
      if (state.mode === 'entering' || state.mode === 'reframing' || pointerMotionActive(now)) {
        return true;
      }
      return baseShouldRenderFrame ? baseShouldRenderFrame(now, lastCompositeMs) : false;
    };

    controller.motionLodActive = (now = performance.now()) => (
      state.mode === 'entering'
      || state.mode === 'reframing'
      || pointerMotionActive(now)
      || (baseMotionLodActive ? baseMotionLodActive(now) : false)
    );

    controller.update = (now, dt, elapsed) => {
      advancePointer(dt);
      const baseOwnsCamera = baseUpdate(now, dt, elapsed);
      const contentActiveAfterBase = contentOwnsCamera();

      if (state.contentHandoff) {
        if (contentActiveAfterBase) return baseOwnsCamera;
        finishContentHandoff(now);
        return true;
      }

      if (contentActiveAfterBase) return baseOwnsCamera;

      if (state.mode === 'entering' && state.field) {
        const raw = THREE.MathUtils.clamp((now - state.startedAt) / ENTER_MS, 0, 1);
        const t = smootherstep01(raw);
        buildInteractivePose(t);
        camera.position.lerpVectors(state.startPosition, scratch.targetPosition, t);
        camera.quaternion.slerpQuaternions(
          state.startQuaternion,
          scratch.targetQuaternion,
          t,
        );
        camera.fov = THREE.MathUtils.lerp(state.startFov, state.fov, t);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld(true);
        refreshVisibleConstellation();
        return true;
      }

      if (state.mode === 'reframing' && state.field) {
        const raw = THREE.MathUtils.clamp((now - state.startedAt) / REFRAME_MS, 0, 1);
        const t = smootherstep01(raw);
        camera.position.lerpVectors(
          state.reframeStartPosition,
          state.reframeTargetPosition,
          t,
        );
        camera.quaternion.slerpQuaternions(
          state.reframeStartQuaternion,
          state.reframeTargetQuaternion,
          t,
        );
        camera.fov = THREE.MathUtils.lerp(
          state.reframeStartFov,
          state.reframeTargetFov,
          t,
        );
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld(true);
        refreshVisibleConstellation();

        if (raw >= 1) {
          state.mode = 'field';
          applyStablePose(1);
          refreshVisibleConstellation();
        }
        return true;
      }

      if (state.mode === 'field' && state.field) {
        applyStablePose(1);
        refreshVisibleConstellation();
        return true;
      }

      return baseOwnsCamera;
    };

    return controller;
  };

  fieldViewportInstall.__smirelFieldViewport = true;
  window[INSTALL_KEY] = fieldViewportInstall;
})();
