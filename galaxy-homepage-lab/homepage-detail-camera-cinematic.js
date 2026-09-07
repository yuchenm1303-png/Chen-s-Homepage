(() => {
  'use strict';

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function' || baseInstall.__smirelDetailCameraCinematicV1) return;

  const cinematicInstall = function installDetailCameraCinematic(context) {
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

    const OPEN_MS = reducedMotion ? 1 : 1080;
    const RETURN_MS = reducedMotion ? 1 : 400;
    const CAMERA_FRAME_INTERVAL_MS = 1000 / 40;

    const arrivalPosition = new THREE.Vector3();
    const arrivalQuaternion = new THREE.Quaternion();
    const targetPosition = new THREE.Vector3();
    const returnStartPosition = new THREE.Vector3();
    const returnStartQuaternion = new THREE.Quaternion();
    const holdPosition = new THREE.Vector3();
    const holdQuaternion = new THREE.Quaternion();
    const starPosition = new THREE.Vector3();
    const cameraBack = new THREE.Vector3();

    let arrivalFov = 47;
    let targetFov = 32;
    let returnStartFov = 47;
    let holdFov = 47;
    let phase = 'idle';
    let phaseStartedAt = 0;
    let previousArrived = false;
    let snapshotReady = false;

    function smootherstep01(value) {
      const t = THREE.MathUtils.clamp(value, 0, 1);
      return t * t * t * (t * (t * 6 - 15) + 10);
    }

    function applyPose(position, quaternion, fov) {
      camera.position.copy(position);
      camera.quaternion.copy(quaternion);
      if (Math.abs(camera.fov - fov) > 1e-5) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    }

    function captureArrival(now) {
      arrivalPosition.copy(camera.position);
      arrivalQuaternion.copy(camera.quaternion);
      arrivalFov = camera.fov;

      const group = controller.stellarModel?.group || null;
      let arrivalDepth = 3.2;

      if (group?.parent) {
        group.updateWorldMatrix(true, false);
        group.getWorldPosition(starPosition);
        arrivalDepth = Math.max(arrivalPosition.distanceTo(starPosition), 0.001);
        cameraBack.subVectors(arrivalPosition, starPosition).normalize();

        // Rebuild the old dolly-zoom feeling without reading the detail slot.
        // The star remains a separate UI model; this camera only moves the galaxy.
        const targetDepth = THREE.MathUtils.clamp(
          arrivalDepth * 5.1,
          Math.max(arrivalDepth + 7, 16),
          24,
        );
        targetPosition.copy(starPosition).addScaledVector(cameraBack, targetDepth);
      } else {
        cameraBack.set(0, 0, 1).applyQuaternion(arrivalQuaternion).normalize();
        targetPosition.copy(arrivalPosition).addScaledVector(cameraBack, 12);
      }

      const object = controller.activeObject;
      targetFov = window.innerWidth <= 620
        ? Math.min(arrivalFov, 32)
        : Math.min(arrivalFov, object?.kind === 'note' ? 28 : 26);

      phase = 'opening';
      phaseStartedAt = now;
      snapshotReady = true;
    }

    function applyOpening(now) {
      const raw = THREE.MathUtils.clamp((now - phaseStartedAt) / OPEN_MS, 0, 1);
      const t = smootherstep01(raw);
      camera.position.lerpVectors(arrivalPosition, targetPosition, t);
      camera.quaternion.copy(arrivalQuaternion);
      camera.fov = THREE.MathUtils.lerp(arrivalFov, targetFov, t);
      camera.updateProjectionMatrix();

      if (raw >= 1) {
        phase = 'settled';
        applyPose(targetPosition, arrivalQuaternion, targetFov);
      }
    }

    function holdForUiRejoin() {
      if (phase !== 'waiting-rejoin') {
        holdPosition.copy(camera.position);
        holdQuaternion.copy(camera.quaternion);
        holdFov = camera.fov;
        phase = 'waiting-rejoin';
      }
      applyPose(holdPosition, holdQuaternion, holdFov);
    }

    function startReturn(now) {
      returnStartPosition.copy(camera.position);
      returnStartQuaternion.copy(camera.quaternion);
      returnStartFov = camera.fov;
      phase = 'returning';
      phaseStartedAt = now;
    }

    function applyReturn(now) {
      const raw = THREE.MathUtils.clamp((now - phaseStartedAt) / RETURN_MS, 0, 1);
      const t = smootherstep01(raw);
      camera.position.lerpVectors(returnStartPosition, arrivalPosition, t);
      camera.quaternion.slerpQuaternions(returnStartQuaternion, arrivalQuaternion, t);
      camera.fov = THREE.MathUtils.lerp(returnStartFov, arrivalFov, t);
      camera.updateProjectionMatrix();

      if (raw >= 1) {
        phase = 'restored';
        applyPose(arrivalPosition, arrivalQuaternion, arrivalFov);
      }
    }

    function uiStillOwnsStar() {
      const state = controller.detailStarUiState;
      return state === 'extracting' || state === 'owned' || state === 'rejoining';
    }

    function resetState() {
      phase = 'idle';
      snapshotReady = false;
      previousArrived = false;
    }

    controller.update = (now, dt, elapsed) => {
      const ownsCamera = baseUpdate(now, dt, elapsed);
      const arrived = document.body.classList.contains('star-flight-arrived');
      const closing = document.body.classList.contains('star-detail-closing');

      if (arrived && !previousArrived) {
        captureArrival(now);
      }

      if (arrived && snapshotReady) {
        if (closing) {
          if (uiStillOwnsStar()) {
            holdForUiRejoin();
          } else {
            if (phase !== 'returning' && phase !== 'restored') startReturn(now);
            if (phase === 'returning') applyReturn(now);
            else if (phase === 'restored') applyPose(arrivalPosition, arrivalQuaternion, arrivalFov);
          }
        } else if (phase === 'opening') {
          applyOpening(now);
        } else if (phase === 'settled') {
          applyPose(targetPosition, arrivalQuaternion, targetFov);
        }
      } else if (!arrived && previousArrived) {
        resetState();
      }

      previousArrived = arrived;
      return ownsCamera || phase === 'opening' || phase === 'returning';
    };

    controller.shouldRenderFrame = (now, lastCompositeMs) => {
      if (phase === 'opening' || phase === 'returning') {
        return now - lastCompositeMs >= CAMERA_FRAME_INTERVAL_MS;
      }
      return baseShouldRenderFrame ? baseShouldRenderFrame(now, lastCompositeMs) : false;
    };

    controller.motionLodActive = (now = performance.now()) => {
      if (phase === 'opening' || phase === 'returning') return true;
      return baseMotionLodActive ? baseMotionLodActive(now) : false;
    };

    Object.defineProperty(controller, 'detailCameraCinematicPhase', {
      configurable: true,
      get() { return phase; },
    });

    return controller;
  };

  cinematicInstall.__smirelDetailCameraCinematicV1 = true;
  window[INSTALL_KEY] = cinematicInstall;
})();
