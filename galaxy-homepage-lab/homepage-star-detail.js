(() => {
  'use strict';

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function' || baseInstall.__smirelDetailView) return;

  function createDetailShell() {
    const shell = document.createElement('section');
    shell.className = 'star-detail-shell';
    shell.setAttribute('aria-hidden', 'true');
    shell.innerHTML = `
      <header class="star-detail-header">
        <div class="star-detail-heading">
          <p class="star-detail-kicker"></p>
          <h1 class="star-detail-title"></h1>
          <p class="star-detail-subtitle"></p>
        </div>
        <span class="star-detail-star-slot" aria-hidden="true"></span>
      </header>

      <button class="star-detail-back" type="button" aria-label="Back to galaxy">
        Esc · Back to galaxy
      </button>

      <main class="star-detail-main"></main>
    `;
    document.body.appendChild(shell);
    return shell;
  }

  function projectMarkup(object) {
    const meta = (object.meta || []).map((item) => `<span>${item}</span>`).join('');
    const systems = (object.systems || []).map((item) => `<li>${item}</li>`).join('');
    const links = (object.links || []).map((link) => (
      `<a class="star-detail-link" href="${link.href}" target="_blank" rel="noreferrer">${link.label} ↗</a>`
    )).join('');

    return `
      <p class="star-detail-lede">${object.lede || ''}</p>
      <p class="star-detail-meta">${meta}</p>
      <div class="star-detail-divider"></div>
      <section class="star-detail-grid" aria-label="Overview">
        <p class="star-detail-section-label">Overview</p>
        <div>
          <p class="star-detail-copy">${object.overview || ''}</p>
          ${links ? `<div class="star-detail-links">${links}</div>` : ''}
        </div>
      </section>
      <div class="star-detail-divider"></div>
      <section class="star-detail-grid" aria-label="Selected systems">
        <p class="star-detail-section-label">Selected systems</p>
        <ul class="star-detail-systems">${systems}</ul>
      </section>
      <p class="star-detail-object">Object ${object.order} · ${object.star?.classLabel || 'Stellar archive'}</p>
    `;
  }

  function noteMarkup(object) {
    const meta = (object.meta || []).map((item) => `<span>${item}</span>`).join('');
    const paragraphs = (object.body || []).map((paragraph) => `<p>${paragraph}</p>`).join('');

    return `
      <article class="star-detail-article">
        <p class="star-detail-note-date">${object.date || 'Archive note'}</p>
        <h2 class="star-detail-note-lede">${object.lede || ''}</h2>
        <p class="star-detail-meta">${meta}</p>
        <div class="star-detail-divider"></div>
        <p class="star-detail-note-intro">${object.overview || ''}</p>
        <div class="star-detail-note-body">${paragraphs}</div>
        <p class="star-detail-object">Observation ${object.order} · ${object.star?.classLabel || 'Journal star'}</p>
      </article>
    `;
  }

  const detailedInstall = function installStarDetail(context) {
    const controller = baseInstall(context);
    if (!controller) return controller;

    const { THREE, scene, camera, reducedMotion } = context || {};
    if (!THREE || !scene || !camera) return controller;

    const shell = createDetailShell();
    const starHeader = shell.querySelector('.star-detail-header');
    const heading = shell.querySelector('.star-detail-heading');
    const kicker = shell.querySelector('.star-detail-kicker');
    const title = shell.querySelector('.star-detail-title');
    const subtitle = shell.querySelector('.star-detail-subtitle');
    const detailMain = shell.querySelector('.star-detail-main');
    const detailBack = shell.querySelector('.star-detail-back');
    const starSlot = shell.querySelector('.star-detail-star-slot');
    const originalBack = document.querySelector('.smirel-star-back');

    const OPEN_MS = reducedMotion ? 1 : 1080;
    const CLOSE_MS = reducedMotion ? 1 : 840;
    const DETAIL_REVEAL_AT = 0.28;
    const FULL_QUALITY_SETTLE_MS = reducedMotion ? 0 : 140;

    let phase = 'idle';
    let phaseStartedAt = 0;
    let previousArrived = false;
    let detailShown = false;
    let currentBlend = 0;
    let closeStartBlend = 1;
    let closeDuration = CLOSE_MS;
    let starGroup = null;
    let activeObject = null;
    let arrivalFov = 47;
    let arrivalDepth = 3.2;
    let detailFov = 26;
    let detailDepth = 34;
    let layoutDirty = true;
    let targetReady = false;
    let measuredWidth = 0;
    let measuredHeight = 0;
    let fullQualityAfterMs = 0;

    const starPosition = new THREE.Vector3();
    const arrivalCameraPosition = new THREE.Vector3();
    const arrivalQuaternion = new THREE.Quaternion();
    const cameraBack = new THREE.Vector3();
    const cameraRight = new THREE.Vector3();
    const cameraUp = new THREE.Vector3();
    const targetNdc = new THREE.Vector2();

    const baseShouldRenderFrame = typeof controller.shouldRenderFrame === 'function'
      ? controller.shouldRenderFrame.bind(controller)
      : null;

    function smootherstep01(value) {
      const t = THREE.MathUtils.clamp(value, 0, 1);
      return t * t * t * (t * (t * 6 - 15) + 10);
    }

    function renderObject(object) {
      if (!object) return false;
      activeObject = object;
      shell.dataset.starKind = object.kind;
      shell.dataset.starId = object.id;
      shell.setAttribute('aria-label', `${object.title} ${object.kind === 'note' ? 'note' : 'project'} detail`);
      kicker.textContent = `${object.kind === 'note' ? 'Note' : 'Project'} / ${object.order}`;
      title.textContent = object.title;
      subtitle.textContent = object.subtitle || '';
      detailMain.innerHTML = object.kind === 'note' ? noteMarkup(object) : projectMarkup(object);
      targetReady = false;
      layoutDirty = true;
      return true;
    }

    function locateStarGroup() {
      const sharedGroup = controller.stellarModel?.group || null;
      if (sharedGroup?.parent) {
        starGroup = sharedGroup;
        return starGroup;
      }
      if (starGroup?.parent) return starGroup;
      return null;
    }

    function markLayoutDirty() {
      layoutDirty = true;
    }
    window.addEventListener('resize', markLayoutDirty, { passive: true });

    function measureArchiveTarget(force = false) {
      if (!starSlot || !activeObject) return false;

      const width = Math.max(window.innerWidth, 1);
      const height = Math.max(window.innerHeight, 1);
      if (!force && targetReady && !layoutDirty
          && width === measuredWidth && height === measuredHeight) {
        return true;
      }

      const rect = starSlot.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;

      let transformX = 0;
      let transformY = 0;
      if (starHeader) {
        const transform = getComputedStyle(starHeader).transform;
        if (transform && transform !== 'none' && typeof DOMMatrixReadOnly === 'function') {
          try {
            const matrix = new DOMMatrixReadOnly(transform);
            transformX = matrix.m41;
            transformY = matrix.m42;
          } catch (_) {
            // The transition remains valid without removing the tiny compositor offset.
          }
        }
      }

      const centreX = rect.left + rect.width * 0.5 - transformX;
      const centreY = rect.top + rect.height * 0.5 - transformY;
      targetNdc.set(
        centreX / width * 2 - 1,
        1 - centreY / height * 2,
      );

      if (width <= 620) {
        detailFov = 32;
      } else {
        detailFov = activeObject.kind === 'note' ? 28 : 26;
      }

      const starScale = starGroup?.scale?.x || 0.84;
      const focalPixels = height / Math.max(
        2 * Math.tan(THREE.MathUtils.degToRad(detailFov) * 0.5),
        1e-5,
      );
      const coreRatio = activeObject.kind === 'note' ? 0.35 : 0.37;
      const desiredCoreRadiusPx = Math.min(rect.width, rect.height) * coreRatio;
      detailDepth = THREE.MathUtils.clamp(
        starScale * focalPixels / Math.max(desiredCoreRadiusPx, 1),
        Math.max(arrivalDepth + 7, 16),
        38,
      );

      measuredWidth = width;
      measuredHeight = height;
      layoutDirty = false;
      targetReady = true;
      return true;
    }

    function applyCameraBlend(blend) {
      if (!measureArchiveTarget()) return;

      const t = THREE.MathUtils.clamp(blend, 0, 1);
      const currentFov = THREE.MathUtils.lerp(arrivalFov, detailFov, t);
      const forwardDepth = THREE.MathUtils.lerp(arrivalDepth, detailDepth, t);
      const screenX = targetNdc.x * t;
      const screenY = targetNdc.y * t;
      const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(currentFov) * 0.5);
      const lateralX = screenX * forwardDepth * camera.aspect * tanHalfFov;
      const lateralY = screenY * forwardDepth * tanHalfFov;

      camera.position.copy(starPosition)
        .addScaledVector(cameraBack, forwardDepth)
        .addScaledVector(cameraRight, -lateralX)
        .addScaledVector(cameraUp, -lateralY);
      camera.quaternion.copy(arrivalQuaternion);
      camera.fov = currentFov;
      camera.updateProjectionMatrix();
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
      fullQualityAfterMs = 0;
      closeStartBlend = currentBlend;
      closeDuration = reducedMotion ? 1 : Math.max(360, CLOSE_MS * Math.max(0.50, closeStartBlend));
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

    controller.shouldRenderFrame = (now, lastCompositeMs) => {
      if (phase === 'opening' || phase === 'closing') return true;
      return baseShouldRenderFrame ? baseShouldRenderFrame(now, lastCompositeMs) : false;
    };

    controller.motionLodActive = (now = performance.now()) => (
      phase === 'opening'
      || phase === 'closing'
      || (phase === 'open' && now < fullQualityAfterMs)
    );

    const baseUpdate = controller.update.bind(controller);
    controller.update = (now, dt, elapsed) => {
      const ownsCamera = baseUpdate(now, dt, elapsed);
      const arrived = document.body.classList.contains('star-flight-arrived');

      if (arrived && !previousArrived) {
        const object = controller.activeObject;
        const group = locateStarGroup();
        if (object && group && renderObject(object)) {
          starPosition.copy(group.position);
          arrivalCameraPosition.copy(camera.position);
          arrivalQuaternion.copy(camera.quaternion);
          arrivalFov = camera.fov;
          arrivalDepth = Math.max(camera.position.distanceTo(starPosition), 0.001);

          cameraBack.subVectors(arrivalCameraPosition, starPosition).normalize();
          cameraRight.set(1, 0, 0).applyQuaternion(arrivalQuaternion).normalize();
          cameraUp.set(0, 1, 0).applyQuaternion(arrivalQuaternion).normalize();

          currentBlend = 0;
          detailShown = false;
          fullQualityAfterMs = 0;
          hideDetail();
          phase = 'opening';
          phaseStartedAt = now;
          measureArchiveTarget(true);
        }
      }

      if (arrived && starGroup && activeObject) {
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
            fullQualityAfterMs = now + FULL_QUALITY_SETTLE_MS;
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
            camera.position.copy(arrivalCameraPosition);
            camera.quaternion.copy(arrivalQuaternion);
            camera.fov = arrivalFov;
            camera.updateProjectionMatrix();
            hideDetail();
            fullQualityAfterMs = 0;
            phase = 'handoff';
            originalBack?.click();
          }
        }
      } else if (previousArrived) {
        hideDetail();
        currentBlend = 0;
        fullQualityAfterMs = 0;
        activeObject = null;
        targetReady = false;
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
