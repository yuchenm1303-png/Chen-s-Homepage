(() => {
  'use strict';

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function' || baseInstall.__smirelDetailView) return;

  function createDetailShell() {
    const shell = document.createElement('section');
    shell.className = 'star-detail-shell';
    shell.setAttribute('aria-label', 'Loom project detail');
    shell.setAttribute('aria-hidden', 'true');
    shell.innerHTML = `
      <header class="star-detail-header">
        <span class="star-detail-star-slot" aria-hidden="true"></span>
        <div class="star-detail-heading">
          <p class="star-detail-kicker">Project / 01</p>
          <h1 class="star-detail-title">Loom</h1>
          <p class="star-detail-subtitle">General-purpose agent · 2026 — present</p>
        </div>
      </header>

      <button class="star-detail-back" type="button" aria-label="Back to galaxy">
        Esc · Back to galaxy
      </button>

      <main class="star-detail-main">
        <p class="star-detail-lede">A general-purpose agent for tools, planning and execution.</p>
        <p class="star-detail-meta">
          <span>Python</span>
          <span>Agents</span>
          <span>Tool use</span>
          <span>Browser interaction</span>
        </p>

        <div class="star-detail-divider"></div>

        <section class="star-detail-grid" aria-labelledby="loom-overview-label">
          <p class="star-detail-section-label" id="loom-overview-label">Overview</p>
          <div>
            <p class="star-detail-copy">
              Loom is an experimental general-purpose agent focused on reliable planning,
              tool orchestration and practical execution. The project explores how a small
              agent runtime can move between reasoning, browser interaction and external
              tools without becoming a single-purpose workflow.
            </p>
            <div class="star-detail-links">
              <a class="star-detail-link" href="https://github.com/yuchenm1303-png/Loom" target="_blank" rel="noreferrer">Repository ↗</a>
            </div>
          </div>
        </section>

        <div class="star-detail-divider"></div>

        <section class="star-detail-grid" aria-labelledby="loom-systems-label">
          <p class="star-detail-section-label" id="loom-systems-label">Selected systems</p>
          <ul class="star-detail-systems">
            <li>Planning &amp; execution</li>
            <li>Tool orchestration</li>
            <li>Browser interaction</li>
            <li>Session runtime</li>
          </ul>
        </section>

        <p class="star-detail-object">Object 01 · Blue-white stellar archive</p>
      </main>
    `;
    document.body.appendChild(shell);
    return shell;
  }

  const detailedInstall = function installStarDetail(context) {
    const controller = baseInstall(context);
    if (!controller) return controller;

    const { THREE, scene, camera, reducedMotion } = context || {};
    if (!THREE || !scene || !camera) return controller;

    const shell = createDetailShell();
    const detailBack = shell.querySelector('.star-detail-back');
    const starSlot = shell.querySelector('.star-detail-star-slot');
    const originalBack = document.querySelector('.smirel-star-back');

    // The detail transition owns the exact arrived star body. There is no clone,
    // sprite or screenshot hand-off: one starGroup moves from arrival into the UI.
    const HOLD_MS = reducedMotion ? 1 : 70;
    const OPEN_MS = reducedMotion ? 1 : 620;
    const CLOSE_MS = reducedMotion ? 1 : 440;
    const DETAIL_DISTANCE = 8.4;

    let phase = 'idle';
    let arrivedAt = 0;
    let phaseStartedAt = 0;
    let starGroup = null;
    let previousArrived = false;
    let arrivalScale = 0.84;
    let detailScale = 0.34;

    const arrivalPosition = new THREE.Vector3();
    const targetPosition = new THREE.Vector3();
    const startPosition = new THREE.Vector3();
    const cameraLocal = new THREE.Vector3();
    const arcOffset = new THREE.Vector3();
    const cameraRight = new THREE.Vector3();
    const cameraUp = new THREE.Vector3();
    const cameraForward = new THREE.Vector3();

    function easeOutQuint(value) {
      const t = THREE.MathUtils.clamp(value, 0, 1);
      return 1 - Math.pow(1 - t, 5);
    }

    function smootherstep01(value) {
      const t = THREE.MathUtils.clamp(value, 0, 1);
      return t * t * t * (t * (t * 6 - 15) + 10);
    }

    function locateStarGroup() {
      if (starGroup?.parent) return starGroup;

      let refinedCore = null;
      let fallbackCore = null;
      scene.traverse((object) => {
        const fragment = object.material?.fragmentShader || '';
        if (!refinedCore && fragment.includes('float convection = noise3(p * 4.2')) {
          refinedCore = object;
        }
        if (!fallbackCore && fragment.includes('float hot = smoothstep(0.40, 0.86')) {
          fallbackCore = object;
        }
      });

      const core = refinedCore || fallbackCore;
      if (core?.parent) starGroup = core.parent;
      return starGroup;
    }

    function updateDetailTarget() {
      if (!starSlot) return false;
      const rect = starSlot.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;

      const width = Math.max(window.innerWidth, 1);
      const height = Math.max(window.innerHeight, 1);
      const centreX = rect.left + rect.width * 0.5;
      const centreY = rect.top + rect.height * 0.5;
      const ndcX = centreX / width * 2 - 1;
      const ndcY = 1 - centreY / height * 2;

      const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5) * DETAIL_DISTANCE;
      const halfWidth = halfHeight * camera.aspect;
      cameraLocal.set(ndcX * halfWidth, ndcY * halfHeight, -DETAIL_DISTANCE);
      camera.updateMatrixWorld();
      targetPosition.copy(cameraLocal).applyMatrix4(camera.matrixWorld);

      // Keep the real sphere physically smaller than the arrived body, while
      // placing it far enough from the camera that off-axis perspective is tiny.
      const pixelsPerWorldUnit = height / Math.max(2 * halfHeight, 1e-5);
      const desiredCoreRadiusPx = Math.min(rect.width, rect.height) * 0.39;
      detailScale = desiredCoreRadiusPx / pixelsPerWorldUnit;
      detailScale = Math.min(arrivalScale * 0.72, Math.max(0.22, detailScale));
      return true;
    }

    function showDetail() {
      shell.setAttribute('aria-hidden', 'false');
      document.body.classList.remove('star-detail-closing');
      document.body.classList.add('star-detail-open');
    }

    function hideDetail() {
      shell.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('star-detail-open', 'star-detail-closing');
    }

    function beginClose() {
      if (!document.body.classList.contains('star-flight-arrived')) return;
      if (phase !== 'opening' && phase !== 'open') return;
      const group = locateStarGroup();
      if (!group) return;

      phase = 'closing';
      phaseStartedAt = performance.now();
      startPosition.copy(group.position);
      document.body.classList.remove('star-detail-open');
      document.body.classList.add('star-detail-closing');
    }

    detailBack?.addEventListener('click', beginClose);

    window.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (phase !== 'opening' && phase !== 'open') return;
      if (!document.body.classList.contains('star-flight-arrived')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      beginClose();
    }, true);

    const baseUpdate = controller.update.bind(controller);
    controller.update = (now, dt, elapsed) => {
      const ownsCamera = baseUpdate(now, dt, elapsed);
      const arrived = document.body.classList.contains('star-flight-arrived');

      if (arrived && !previousArrived) {
        const group = locateStarGroup();
        if (group) {
          arrivalPosition.copy(group.position);
          arrivalScale = group.scale.x || 0.84;
          group.visible = true;
          phase = 'holding';
          arrivedAt = now;
          hideDetail();
        }
      }

      if (arrived) {
        const group = locateStarGroup();
        if (group) {
          if (phase === 'holding' && now - arrivedAt >= HOLD_MS) {
            phase = 'opening';
            phaseStartedAt = now;
            startPosition.copy(arrivalPosition);
            showDetail();
          }

          if (phase === 'holding') {
            group.visible = true;
            group.position.copy(arrivalPosition);
            group.scale.setScalar(arrivalScale);
          } else if (phase === 'opening') {
            const raw = THREE.MathUtils.clamp((now - phaseStartedAt) / OPEN_MS, 0, 1);
            const move = easeOutQuint(raw);
            const size = smootherstep01(raw);
            updateDetailTarget();

            // Move the exact arrived star along a shallow camera-space arc so the
            // transition reads as one physical object receding into the archive UI.
            camera.getWorldDirection(cameraForward);
            cameraRight.set(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
            cameraUp.set(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
            group.position.lerpVectors(startPosition, targetPosition, move);
            arcOffset.copy(cameraUp).multiplyScalar(Math.sin(Math.PI * raw) * 0.18)
              .addScaledVector(cameraRight, Math.sin(Math.PI * raw) * -0.10);
            group.position.add(arcOffset);
            group.scale.setScalar(THREE.MathUtils.lerp(arrivalScale, detailScale, size));
            group.visible = true;

            if (raw >= 1) phase = 'open';
          } else if (phase === 'open') {
            updateDetailTarget();
            group.position.copy(targetPosition);
            group.scale.setScalar(detailScale);
            group.visible = true;
          } else if (phase === 'closing') {
            const raw = THREE.MathUtils.clamp((now - phaseStartedAt) / CLOSE_MS, 0, 1);
            const move = smootherstep01(raw);
            updateDetailTarget();
            group.position.lerpVectors(startPosition, arrivalPosition, move);
            group.scale.setScalar(THREE.MathUtils.lerp(detailScale, arrivalScale, move));
            group.visible = true;

            if (raw >= 1) {
              group.position.copy(arrivalPosition);
              group.scale.setScalar(arrivalScale);
              hideDetail();
              phase = 'handoff';
              originalBack?.click();
            }
          }
        }
      } else if (previousArrived) {
        hideDetail();
        phase = 'idle';
      }

      previousArrived = arrived;
      return ownsCamera;
    };

    return controller;
  };

  detailedInstall.__smirelDetailView = true;
  window[INSTALL_KEY] = detailedInstall;
})();
