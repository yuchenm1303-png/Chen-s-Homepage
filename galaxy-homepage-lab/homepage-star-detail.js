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

    const { THREE, reducedMotion } = context || {};
    if (!THREE) return controller;

    const shell = createDetailShell();
    const kicker = shell.querySelector('.star-detail-kicker');
    const title = shell.querySelector('.star-detail-title');
    const subtitle = shell.querySelector('.star-detail-subtitle');
    const detailMain = shell.querySelector('.star-detail-main');
    const detailBack = shell.querySelector('.star-detail-back');
    const originalBack = document.querySelector('.smirel-star-back');

    const OPEN_MS = reducedMotion ? 1 : 1080;
    const CLOSE_MS = reducedMotion ? 1 : 840;
    const DETAIL_REVEAL_AT = 0.28;

    let phase = 'idle';
    let phaseStartedAt = 0;
    let previousArrived = false;
    let detailShown = false;
    let openProgress = 0;
    let closeDuration = CLOSE_MS;
    let activeObject = null;

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
      return true;
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
      closeDuration = reducedMotion
        ? 1
        : Math.max(360, CLOSE_MS * Math.max(0.50, openProgress));
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
        const object = controller.activeObject;
        if (object && renderObject(object)) {
          openProgress = 0;
          detailShown = false;
          hideDetail();
          phase = 'opening';
          phaseStartedAt = now;
        }
      }

      if (arrived && activeObject) {
        if (phase === 'opening') {
          const raw = THREE.MathUtils.clamp((now - phaseStartedAt) / OPEN_MS, 0, 1);
          openProgress = raw;
          if (raw >= DETAIL_REVEAL_AT) showDetail();
          if (raw >= 1) {
            openProgress = 1;
            showDetail();
            phase = 'open';
          }
        } else if (phase === 'open') {
          openProgress = 1;
        } else if (phase === 'closing') {
          const raw = THREE.MathUtils.clamp((now - phaseStartedAt) / closeDuration, 0, 1);
          if (raw >= 1) {
            hideDetail();
            openProgress = 0;
            phase = 'handoff';
            originalBack?.click();
          }
        }
      } else if (previousArrived) {
        hideDetail();
        openProgress = 0;
        activeObject = null;
        phase = 'idle';

        // The shell identity belongs to one completed arrival. Clearing it on
        // departure lets project/article owners invalidate their DOM cache, so
        // re-entering the same star cannot leave the generic fallback markup in place.
        delete shell.dataset.starKind;
        delete shell.dataset.starId;
      }

      previousArrived = arrived;

      // The detail shell owns interaction after arrival so pointer parallax does
      // not move the galaxy camera. It no longer computes slot projection,
      // changes camera/FOV, or forces full-scene frames just to move the star.
      return ownsCamera || phase === 'opening' || phase === 'open' || phase === 'closing';
    };

    Object.defineProperty(controller, 'detailShellPhase', {
      configurable: true,
      get() { return phase; },
    });

    return controller;
  };

  detailedInstall.__smirelDetailView = true;
  window[INSTALL_KEY] = detailedInstall;
})();