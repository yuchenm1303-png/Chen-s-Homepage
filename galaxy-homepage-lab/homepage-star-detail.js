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

    // Keep the arrival beat, but do not make the user wait through a second long
    // UI animation. The detail model is a real clone of the arrived Three.js star,
    // not the same world-space object dragged across the frustum.
    const HOLD_MS = reducedMotion ? 20 : 140;
    const OPEN_MS = reducedMotion ? 1 : 460;
    const CLOSE_MS = reducedMotion ? 1 : 280;

    let phase = 'idle';
    let arrivedAt = 0;
    let phaseStartedAt = 0;
    let starGroup = null;
    let detailStar = null;
    let previousArrived = false;

    const arrivalPosition = new THREE.Vector3();
    const detailLocal = new THREE.Vector3();
    const detailWorld = new THREE.Vector3();

    function easeOutQuint(value) {
      const t = THREE.MathUtils.clamp(value, 0, 1);
      return 1 - Math.pow(1 - t, 5);
    }

    function locateStarGroup() {
      if (starGroup?.parent) return starGroup;

      let refinedCore = null;
      let fallbackCore = null;
      scene.traverse((object) => {
        if (object === detailStar || detailStar?.getObjectById?.(object.id)) return;
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

    function ensureDetailStar() {
      if (detailStar?.parent) return detailStar;
      const source = locateStarGroup();
      if (!source) return null;

      // Object3D.clone(true) keeps the exact geometry/material graph. Materials and
      // uniforms stay shared with the arrived star, so photosphere, chromosphere,
      // corona and halo continue to animate as the very same stellar design.
      detailStar = source.clone(true);
      detailStar.name = 'smirel-detail-star-model';
      detailStar.visible = false;
      detailStar.frustumCulled = false;
      detailStar.traverse((object) => {
        object.frustumCulled = false;
        if (Number.isFinite(object.renderOrder)) object.renderOrder += 24;
      });
      scene.add(detailStar);
      return detailStar;
    }

    function updateDetailStar(progress = 1) {
      const star = ensureDetailStar();
      if (!star || !starSlot) return;

      const rect = starSlot.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const viewportWidth = Math.max(window.innerWidth, 1);
      const viewportHeight = Math.max(window.innerHeight, 1);
      const mobile = viewportWidth <= 620;
      const distance = mobile ? 8.8 : 10.5;
      const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5) * distance;
      const halfWidth = halfHeight * camera.aspect;
      const centreX = rect.left + rect.width * 0.5;
      const centreY = rect.top + rect.height * 0.5;
      const ndcX = centreX / viewportWidth * 2 - 1;
      const ndcY = 1 - centreY / viewportHeight * 2;

      detailLocal.set(ndcX * halfWidth, ndcY * halfHeight, -distance);
      camera.updateMatrixWorld();
      detailWorld.copy(detailLocal).applyMatrix4(camera.matrixWorld);
      star.position.copy(detailWorld);

      // Size the actual spherical core from a pixel target, then apply one scalar
      // uniformly to XYZ. This is what prevents the old off-axis "oval logo" look.
      const pixelsPerWorldUnit = viewportHeight / Math.max(2 * halfHeight, 1e-5);
      const desiredCoreRadiusPx = Math.min(rect.width, rect.height) * (mobile ? 0.285 : 0.30);
      const finalScale = desiredCoreRadiusPx / pixelsPerWorldUnit;
      const reveal = easeOutQuint(progress);
      star.scale.setScalar(finalScale * THREE.MathUtils.lerp(0.86, 1.0, reveal));
    }

    function showDetail() {
      shell.setAttribute('aria-hidden', 'false');
      document.body.classList.remove('star-detail-closing');
      document.body.classList.add('star-detail-open');
    }

    function hideDetail() {
      shell.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('star-detail-open', 'star-detail-closing');
      if (detailStar) detailStar.visible = false;
    }

    function beginClose() {
      if (!document.body.classList.contains('star-flight-arrived')) return;
      if (phase !== 'opening' && phase !== 'open') return;
      if (!locateStarGroup()) return;

      phase = 'closing';
      phaseStartedAt = performance.now();
      document.body.classList.remove('star-detail-open');
      document.body.classList.add('star-detail-closing');
    }

    detailBack?.addEventListener('click', beginClose);

    window.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (phase !== 'opening' && phase !== 'open') return;
      if (!document.body.classList.contains('star-flight-arrived')) return;

      // Baseline Escape is registered in bubble phase. Capture first so this quick
      // detail dissolve finishes before the untouched star-flight return begins.
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
          group.visible = true;
          phase = 'holding';
          arrivedAt = now;
          ensureDetailStar();
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
            if (detailStar) detailStar.visible = true;
          }

          if (phase === 'holding') {
            group.visible = true;
            group.position.copy(arrivalPosition);
          } else if (phase === 'opening') {
            const raw = THREE.MathUtils.clamp((now - phaseStartedAt) / OPEN_MS, 0, 1);

            // A short optical hand-off replaces the old world-space travel to the
            // corner. The giant star remains for only the first ~80 ms while the
            // title-sized real model materializes in its dedicated header slot.
            group.visible = raw < 0.18;
            if (detailStar) {
              detailStar.visible = true;
              updateDetailStar(raw);
            }

            if (raw >= 1) phase = 'open';
          } else if (phase === 'open') {
            group.visible = false;
            if (detailStar) {
              detailStar.visible = true;
              updateDetailStar(1);
            }
          } else if (phase === 'closing') {
            const raw = THREE.MathUtils.clamp((now - phaseStartedAt) / CLOSE_MS, 0, 1);

            // Dissolve the archive layer instead of mechanically flying the logo
            // back. Re-introduce the arrived giant only after the page has started
            // fading, then hand control back to the original return animation.
            group.visible = raw >= 0.34;
            if (detailStar) {
              detailStar.visible = raw < 0.58;
              if (detailStar.visible) updateDetailStar(1);
            }

            if (raw >= 1) {
              group.visible = true;
              group.position.copy(arrivalPosition);
              group.scale.setScalar(0.84);
              hideDetail();
              phase = 'handoff';
              originalBack?.click();
            }
          }
        }
      } else if (previousArrived) {
        if (starGroup) starGroup.visible = true;
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
