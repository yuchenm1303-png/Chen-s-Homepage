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
        <p class="star-detail-kicker">Project / 01</p>
        <h1 class="star-detail-title">Loom</h1>
        <p class="star-detail-subtitle">General-purpose agent · 2026 — present</p>
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
    const originalBack = document.querySelector('.smirel-star-back');

    const HOLD_MS = reducedMotion ? 180 : 820;
    const OPEN_MS = reducedMotion ? 1 : 1180;
    const CLOSE_MS = reducedMotion ? 1 : 720;

    let phase = 'idle';
    let arrivedAt = 0;
    let phaseStartedAt = 0;
    let starGroup = null;
    let previousArrived = false;
    let closeStartScale = 0.84;

    const arrivalPosition = new THREE.Vector3();
    const closeStartPosition = new THREE.Vector3();
    const targetPosition = new THREE.Vector3();
    const projected = new THREE.Vector3();
    const direction = new THREE.Vector3();

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

    function targetScale() {
      const h = Math.max(window.innerHeight, 1);
      if (window.innerWidth <= 620) return THREE.MathUtils.clamp(h / 900 * 0.145, 0.105, 0.135);
      return THREE.MathUtils.clamp(h / 900 * 0.175, 0.145, 0.19);
    }

    function updateTargetPosition() {
      const width = Math.max(window.innerWidth, 1);
      const height = Math.max(window.innerHeight, 1);
      const mobile = width <= 620;

      const screenX = mobile
        ? 58
        : THREE.MathUtils.clamp(width * 0.057, 78, 104);
      const screenY = mobile
        ? 58
        : THREE.MathUtils.clamp(height * 0.082, 64, 88);

      const ndcX = screenX / width * 2 - 1;
      const ndcY = 1 - screenY / height * 2;
      projected.set(ndcX, ndcY, 0.12).unproject(camera);
      direction.subVectors(projected, camera.position).normalize();
      targetPosition.copy(camera.position).addScaledVector(direction, mobile ? 4.65 : 5.15);
      return targetPosition;
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
      if (!locateStarGroup()) return;

      phase = 'closing';
      phaseStartedAt = performance.now();
      closeStartPosition.copy(starGroup.position);
      closeStartScale = starGroup.scale.x;
      document.body.classList.remove('star-detail-open');
      document.body.classList.add('star-detail-closing');
    }

    detailBack?.addEventListener('click', beginClose);

    window.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (phase !== 'opening' && phase !== 'open') return;
      if (!document.body.classList.contains('star-flight-arrived')) return;

      // The baseline star-flight Escape handler is registered in bubble phase.
      // Capture first so the detail star can return to its arrival position before
      // handing control back to the untouched baseline return animation.
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
            showDetail();
          }

          if (phase === 'holding') {
            group.position.copy(arrivalPosition);
          } else if (phase === 'opening') {
            const raw = THREE.MathUtils.clamp((now - phaseStartedAt) / OPEN_MS, 0, 1);
            const motion = smootherstep01(raw);
            updateTargetPosition();
            group.position.lerpVectors(arrivalPosition, targetPosition, motion);
            group.scale.setScalar(THREE.MathUtils.lerp(0.84, targetScale(), motion));
            if (raw >= 1) phase = 'open';
          } else if (phase === 'open') {
            updateTargetPosition();
            group.position.copy(targetPosition);
            group.scale.setScalar(targetScale());
          } else if (phase === 'closing') {
            const raw = THREE.MathUtils.clamp((now - phaseStartedAt) / CLOSE_MS, 0, 1);
            const motion = smootherstep01(raw);
            group.position.lerpVectors(closeStartPosition, arrivalPosition, motion);
            group.scale.setScalar(THREE.MathUtils.lerp(closeStartScale, 0.84, motion));

            if (raw >= 1) {
              group.position.copy(arrivalPosition);
              group.scale.setScalar(0.84);
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
