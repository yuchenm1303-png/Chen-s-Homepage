(() => {
  'use strict';

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function' || baseInstall.__smirelArticleReader) return;

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const articleInstall = function installArticleReader(context) {
    const controller = baseInstall(context);
    if (!controller) return controller;

    const style = document.createElement('style');
    style.dataset.smirelArticleReader = 'true';
    style.textContent = `
      /* A local-field HUD belongs to the field level, not to a companion detail. */
      body.star-flight-active .smirel-field-hud {
        opacity: 0 !important;
        pointer-events: none !important;
      }

      .stellar-article-reader strong {
        color: rgba(255,255,255,.91);
        font-weight: 620;
      }
      .stellar-article-reader a {
        color: rgba(207,232,255,.92);
      }
      .stellar-article-reader code {
        font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
        font-size: .88em;
        color: rgba(230,240,255,.88);
      }
      .stellar-article-reader pre,
      .stellar-article-reader .article-code {
        overflow: auto;
        border: 1px solid rgba(255,255,255,.11);
      }
      .stellar-article-reader pre {
        padding: 18px;
        line-height: 1.65;
      }
      .stellar-article-reader .article-code pre {
        margin: 0;
        border: 0;
        border-radius: 0;
        background: transparent;
        backdrop-filter: none;
      }
      .stellar-article-reader .code-title {
        padding: 11px 14px 9px;
        border-bottom: 1px solid rgba(255,255,255,.08);
        color: rgba(255,255,255,.39);
        font: 650 8px/1 ui-sans-serif, system-ui, sans-serif;
        letter-spacing: .14em;
        text-transform: uppercase;
      }
      .stellar-article-reader .article-callout {
        display: grid;
        gap: 8px;
        margin: 30px 0;
        padding: 18px 20px;
        border: 1px solid rgba(188,220,255,.14);
        border-radius: 16px;
        background: rgba(10,17,27,.30);
      }
      .stellar-article-reader .article-callout span {
        color: rgba(255,255,255,.66);
        line-height: 1.72;
      }
      .stellar-article-reader svg,
      .stellar-article-reader img,
      .stellar-article-reader video,
      .stellar-article-reader canvas {
        max-width: 100%;
        height: auto;
      }
      .stellar-article-reader table {
        display: block;
        max-width: 100%;
        overflow-x: auto;
        margin: 28px 0;
        border-collapse: collapse;
      }
      .stellar-article-reader th,
      .stellar-article-reader td {
        padding: 10px 12px;
        border-bottom: 1px solid rgba(255,255,255,.10);
        text-align: left;
      }
    `;
    document.head.appendChild(style);

    const baseUpdate = controller.update.bind(controller);
    let appliedId = null;
    let backContextKey = '';

    function updateBackContext() {
      const back = document.querySelector('.star-detail-back');
      if (!back) return;
      const field = controller.currentField;
      const key = field?.id || 'galaxy';
      if (key === backContextKey) return;
      backContextKey = key;
      if (field) {
        back.textContent = `Esc · Back to ${field.title} field`;
        back.setAttribute('aria-label', `Back to ${field.title} field`);
      } else {
        back.textContent = 'Esc · Back to galaxy';
        back.setAttribute('aria-label', 'Back to galaxy');
      }
    }

    function clearArticleMode(main, shell) {
      appliedId = null;
      if (main) delete main.dataset.articleReader;
      shell?.classList.remove('is-article-reader');
    }

    function articleMarkup(object) {
      const metaItems = [object.subtitle, ...(object.meta || [])]
        .filter(Boolean)
        .filter((value, index, list) => list.indexOf(value) === index)
        .map((item) => `<span>${escapeHtml(item)}</span>`)
        .join('');
      const deck = object.lede
        ? `<p class="stellar-article-deck">${escapeHtml(object.lede)}</p>`
        : '';
      const objectLabel = object.star?.classLabel || 'Journal star';

      return `
        <article class="stellar-article-page">
          <header class="stellar-article-hero">
            <p class="stellar-article-eyebrow">Note / ${escapeHtml(object.order || '')}</p>
            <h1 class="stellar-article-title">${escapeHtml(object.title || '')}</h1>
            ${deck}
            <p class="stellar-article-meta">${metaItems}</p>
          </header>
          <div class="stellar-article-reader">${object.articleHtml}</div>
          <footer class="stellar-article-footer">Observation ${escapeHtml(object.order || '')} · ${escapeHtml(objectLabel)}</footer>
        </article>
      `;
    }

    function applyFullArticle() {
      const object = controller.activeObject;
      const main = document.querySelector('.star-detail-main');
      const shell = document.querySelector('.star-detail-shell');
      if (!main || !shell) return;

      if (!object || object.kind !== 'note' || !object.articleHtml) {
        if (main.dataset.articleReader || shell.classList.contains('is-article-reader')) {
          clearArticleMode(main, shell);
        }
        return;
      }

      if (shell.dataset.starId !== object.id) return;
      if (appliedId === object.id && main.dataset.articleReader === object.id) return;

      shell.classList.add('is-article-reader');
      main.innerHTML = articleMarkup(object);
      main.dataset.articleReader = object.id;
      appliedId = object.id;
    }

    controller.update = (now, dt, elapsed) => {
      const ownsCamera = baseUpdate(now, dt, elapsed);
      updateBackContext();
      applyFullArticle();
      return ownsCamera;
    };

    return controller;
  };

  articleInstall.__smirelArticleReader = true;
  window[INSTALL_KEY] = articleInstall;
})();
