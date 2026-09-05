(() => {
  'use strict';

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function' || baseInstall.__smirelRichProjectDetail) return;

  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  const listMarkup = (items, className) => (
    `<ul class="${className}">${(items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
  );

  const section = (label, body, extraClass = '') => `
    <section class="project-archive-section ${extraClass}">
      <p class="project-archive-label">${label}</p>
      <div class="project-archive-section-body">${body}</div>
    </section>
  `;

  function projectMarkup(object) {
    const detail = object.projectDetail;
    if (!detail) return '';

    const facts = [
      ['Type', detail.type],
      ['Period', detail.period],
      ['Role', detail.role],
      ['Status', detail.status],
    ].map(([label, value]) => `
      <div class="project-archive-fact">
        <span>${label}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `).join('');

    const architecture = (detail.architecture || []).map((item, index) => `
      <li>
        <span>${String(index + 1).padStart(2, '0')}</span>
        <p>${escapeHtml(item)}</p>
      </li>
    `).join('');

    const stages = (detail.stages || []).map(([item, state], index) => {
      const stateLabel = state === 'done' ? 'DONE' : state === 'active' ? 'ACTIVE' : 'NEXT';
      return `
        <li class="is-${escapeHtml(state)}">
          <span class="project-progress-index">${String(index + 1).padStart(2, '0')}</span>
          <p>${escapeHtml(item)}</p>
          <b>${stateLabel}</b>
        </li>
      `;
    }).join('');

    const stack = (detail.stack || []).map((item) => `<span>${escapeHtml(item)}</span>`).join('');
    const links = (object.links || []).map((link) => (
      `<a class="project-archive-link" href="${escapeHtml(link.href)}" target="_blank" rel="noreferrer">${escapeHtml(link.label)} ↗</a>`
    )).join('');

    return `
      <article class="project-archive">
        <section class="project-archive-intro">
          <p class="project-archive-label">Project thesis</p>
          <h2 class="project-archive-thesis">${escapeHtml(object.lede || '')}</h2>
          <div class="project-archive-facts">${facts}</div>
        </section>

        ${section('Overview', `<p class="project-archive-summary">${escapeHtml(detail.summary)}</p>`)}

        ${section('Architecture', `<ol class="project-architecture-list">${architecture}</ol>`)}

        <div class="project-archive-pair">
          ${section('Key work', listMarkup(detail.highlights, 'project-archive-list'), 'project-archive-half')}
          ${section('Challenges', listMarkup(detail.challenges, 'project-archive-list'), 'project-archive-half')}
        </div>

        ${section('Outputs', listMarkup(detail.outputs, 'project-output-list'))}

        ${section('Technology', `<div class="project-stack-list">${stack}</div>`)}

        ${section('Progress', `<ol class="project-progress-list">${stages}</ol>`)}

        ${section('Next', `<p class="project-next-copy">${escapeHtml(detail.next)}</p>${links ? `<div class="project-archive-links">${links}</div>` : ''}`, 'project-archive-next')}

        <p class="project-archive-object">Object ${escapeHtml(object.order)} · ${escapeHtml(object.star?.classLabel || 'Stellar archive')}</p>
      </article>
    `;
  }

  const richInstall = function installRichProjectDetail(context) {
    const controller = baseInstall(context);
    if (!controller) return controller;

    const shell = document.querySelector('.star-detail-shell');
    const main = shell?.querySelector('.star-detail-main');
    let renderedId = null;

    const renderIfNeeded = () => {
      if (!shell || !main || shell.dataset.starKind !== 'project') {
        renderedId = null;
        return;
      }

      const id = shell.dataset.starId || '';
      if (!id || renderedId === id) return;
      const object = (window.__SMIREL_STELLAR_CATALOG__ || []).find((item) => item.id === id);
      if (!object?.projectDetail) return;

      main.innerHTML = projectMarkup(object);
      renderedId = id;
    };

    const baseUpdate = controller.update.bind(controller);
    controller.update = (...args) => {
      const ownsCamera = baseUpdate(...args);
      renderIfNeeded();
      return ownsCamera;
    };

    return controller;
  };

  richInstall.__smirelRichProjectDetail = true;
  window[INSTALL_KEY] = richInstall;
})();
