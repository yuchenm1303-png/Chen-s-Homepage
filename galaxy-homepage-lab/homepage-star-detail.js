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
        <div class="star-detail-heading">
          <p class="star-detail-kicker">Project / 01</p>
          <h1 class="star-detail-title">Loom</h1>
          <p class="star-detail-subtitle">General-purpose agent · 2026 — present</p>
        </div>
        <span class="star-detail-star-slot" aria-hidden="true"></span>
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

    // The arrived star remains one physical object in one scene for the whole
    // transition. Its world position and scale never change in detail mode.
    // Apparent shrinking comes only from a real camera retreat; screen travel
    // comes only from a continuously animated asymmetric perspective frustum.
    const OPEN_MS = reducedMotion ? 1 : 1040;
    const CLOSE_MS = reducedMotion ? 1 : 820;
    const DETAIL_REVEAL_AT = 0.30;

    let phase = 'idle';
    let phaseStartedAt = 0;
    let previousArrived = false;
    let detailShown = false;
    let currentBlend = 0;
    let closeStartBlend = 1;
    let closeDuration = CLOSE_MS;
    let starGroup = null;
    let arrivalFov = 47;
    let arrivalDistance = 3.2;
    let detailDistance = 20;

    const starPosition = new THREE.Vector3();
    const arrivalCameraPosition = new THREE.Vector3();
    const arrivalQuaternion = new THREE.Quaternion();
    const retreatDirection = new THREE.Vector3();
    const targetViewOffset = new THREE.Vector2();

    const baseShouldRenderFrame = typeof controller.shouldRenderFrame === 'function'
      ? controller.shouldRenderFrame.bind(controller)
      : null;
    const baseContinuumDescriptor = Object.getOwnPropertyDescriptor(controller, 'continuumIntervalMs');

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
        if (!refinedCore && fragment.includes('float convection = noise3(p * 4.2')) refinedCore = object;
        if (!fallbackCore && fragment.includes('float hot = smoothstep(0.40, 0.86')) fallbackCore = object;
      });

      const core = refinedCore || fallbackCore;
      if (core?.parent) starGroup = core.parent;
      return starGroup;
    }

    function measureArchiveTarget() {
      if (!starSlot) return false;
      const rect = starSlot.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;

      const width = Math.max(window.innerWidth, 1);
      const height = Math.max(window.innerHeight, 1);
      const centreX = rect.left + rect.width * 0.5;
      const centreY = rect.top + rect.height * 0.5;
      const ndcX = centreX / width * 2 - 1;
      const ndcY = 1 - centreY / height * 2;

      // PerspectiveCamera.setViewOffset with a full-size sub-view changes only
      // the projection principal point. A sphere kept on the physical camera axis
      // therefore moves on screen without becoming an off-axis ellipse.
      targetViewOffset.set(
        -ndcX * width * 0.5,
        ndcY * height * 0.5,
      );

      // Keep the model scale untouched (refined arrival scale is 0.84). Choose a
      // real viewing distance that makes the photosphere fit the title slot; halo
      // is intentionally allowed to breathe beyond the slot.
      const starScale = starGroup?.scale?.x || 0.84;
      const focalPixels = height / Math.max(2 * Math.tan(THREE.MathUtils.degToRad(arrivalFov) * 0.5), 1e-5);
      const desiredCoreRadiusPx = Math.min(rect.width, rect.height) * 0.28;
      detailDistance = THREE.MathUtils.clamp(
        starScale * focalPixels / Math.max(desiredCoreRadiusPx, 1),
        Math.max(arrivalDistance + 5, 13),
        34,
      );
      return true;
    }

    function applyCameraBlend(blend) {
      const t = THREE.MathUtils.clamp(blend, 0, 1);
      measureArchiveTarget();

      const distance = THREE.MathUtils.lerp(arrivalDistance, detailDistance, t);
      camera.position.copy(starPosition).addScaledVector(retreatDirection, distance);
      camera.quaternion.copy(arrivalQuaternion);
      camera.fov = arrivalFov;

      const width = Math.max(window.innerWidth, 1);
      const height = Math.max(window.innerHeight, 1);
      const offsetX = targetViewOffset.x * t;
      const offsetY = targetViewOffset.y * t;
      if (Math.abs(offsetX) < 0.01 && Math.abs(offsetY) < 0.01) {
        camera.clearViewOffset();
        camera.updateProjectionMatrix();
      } else {
        camera.setViewOffset(width, height, offsetX, offsetY, width, height);
      }
    }

    function showDetail() {
      if (detailShown) return;
      detailShown = true;
      shell.setAttribute('aria-hidden', 'false');
      document.body.classList.remove('star-detail-closing');
      document.body.classList.add('star-detail-open');
    }

    function hideDetail() {
      detailShown = false;
      shell.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('star-detail-open', 'star-detail-closing');
    }

    function beginClose() {
      if (!document.body.classList.contains('star-flight-arrived')) return;
      if (phase !== 'opening' && phase !== 'open') return;

      phase = 'closing';
      phaseStartedAt = performance.now();
      closeStartBlend = currentBlend;
      closeDuration = reducedMotion ? 1 : Math.max(340, CLOSE_MS * Math.max(0.48, closeStartBlend));
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

    // Arrived mode is normally presentation-throttled. Camera motion during the
    // detail hand-off must stay frame-synchronous or the physical star/background
    // relationship appears to jump even if the transform math is continuous.
    controller.shouldRenderFrame = (now, lastCompositeMs) => {
      if (phase === 'opening' || phase === 'closing') return true;
      return baseShouldRenderFrame ? baseShouldRenderFrame(now, lastCompositeMs) : false;
    };

    Object.defineProperty(controller, 'continuumIntervalMs', {
      configurable: true,
      get() {
        if (phase === 'opening' || phase === 'closing') return 0;
        return baseContinuumDescriptor?.get
          ? baseContinuumDescriptor.get.call(controller)
          : 30;
      },
    });

    const baseUpdate = controller.update.bind(controller);
    controller.update = (now, dt, elapsed) => {
      const ownsCamera = baseUpdate(now, dt, elapsed);
      const arrived = document.body.classList.contains('star-flight-arrived');

      if (arrived && !previousArrived) {
        const group = locateStarGroup();
        if (group) {
          starPosition.copy(group.position);
          arrivalCameraPosition.copy(camera.position);
          arrivalQuaternion.copy(camera.quaternion);
          arrivalFov = camera.fov;
          arrivalDistance = Math.max(camera.position.distanceTo(starPosition), 0.001);
          retreatDirection.subVectors(arrivalCameraPosition, starPosition).normalize();
          camera.clearViewOffset();
          camera.updateProjectionMatrix();
          currentBlend = 0;
          detailShown = false;
          hideDetail();
          phase = 'opening';
          phaseStartedAt = now;
        }
      }

      if (arrived && starGroup) {
        if (phase === 'opening') {
          const raw = THREE.MathUtils.clamp((now - phaseStartedAt) / OPEN_MS, 0, 1);
          currentBlend = smootherstep01(raw);
          applyCameraBlend(currentBlend);
          if (raw >= DETAIL_REVEAL_AT) showDetail();
          if (raw >= 1) {
            currentBlend = 1;
            applyCameraBlend(1);
            showDetail();
            phase = 'open';
          }
        } else if (phase === 'open') {
          currentBlend = 1;
          applyCameraBlend(1);
        } else if (phase === 'closing') {
          const raw = THREE.MathUtils.clamp((now - phaseStartedAt) / closeDuration, 0, 1);
          currentBlend = closeStartBlend * (1 - smootherstep01(raw));
          applyCameraBlend(currentBlend);

          if (raw >= 1) {
            currentBlend = 0;
            camera.clearViewOffset();
            camera.position.copy(arrivalCameraPosition);
            camera.quaternion.copy(arrivalQuaternion);
            camera.fov = arrivalFov;
            camera.updateProjectionMatrix();
            hideDetail();
            phase = 'handoff';
            originalBack?.click();
          }
        }
      } else if (previousArrived) {
        camera.clearViewOffset();
        camera.updateProjectionMatrix();
        hideDetail();
        currentBlend = 0;
        phase = 'idle';
      }

      previousArrived = arrived;
      return ownsCamera || phase === 'opening' || phase === 'open' || phase === 'closing';
    };

    return controller;
  };

  detailedInstall.__smirelDetailView = true;
  window[INSTALL_KEY] = detailedInstall;
})();
