(() => {
  'use strict';

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function' || baseInstall.__smirelArticleReader) return;

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

      .stellar-article-reader {
        width: 100%;
        max-width: 68ch;
        color: rgba(255,255,255,.73);
        font: 400 15px/1.88 ui-rounded, "SF Pro Rounded", "Segoe UI", "Microsoft YaHei UI", sans-serif;
      }
      .stellar-article-reader > :first-child { margin-top: 0 !important; }
      .stellar-article-reader p { margin: 0 0 22px; }
      .stellar-article-reader .article-lead,
      .stellar-article-reader > p:first-child {
        color: rgba(255,255,255,.84);
        font-size: 18px;
        line-height: 1.76;
        letter-spacing: -.01em;
      }
      .stellar-article-reader h2 {
        margin: 58px 0 18px;
        color: rgba(255,255,255,.94);
        font-size: clamp(24px, 3vw, 34px);
        line-height: 1.18;
        font-weight: 540;
        letter-spacing: -.035em;
      }
      .stellar-article-reader h3 {
        margin: 38px 0 14px;
        color: rgba(255,255,255,.88);
        font-size: 19px;
        line-height: 1.35;
        font-weight: 570;
      }
      .stellar-article-reader ul,
      .stellar-article-reader ol {
        margin: 18px 0 26px;
        padding-left: 1.35em;
      }
      .stellar-article-reader li { margin: 8px 0; }
      .stellar-article-reader strong { color: rgba(255,255,255,.91); font-weight: 620; }
      .stellar-article-reader a { color: rgba(207,232,255,.92); }
      .stellar-article-reader blockquote {
        margin: 30px 0;
        padding: 2px 0 2px 20px;
        border-left: 1px solid rgba(194,225,255,.34);
        color: rgba(225,239,255,.77);
        font-size: 17px;
        line-height: 1.72;
      }
      .stellar-article-reader code {
        font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
        font-size: .88em;
        color: rgba(230,240,255,.88);
      }
      .stellar-article-reader pre,
      .stellar-article-reader .article-code {
        overflow: auto;
        margin: 28px 0;
        border: 1px solid rgba(255,255,255,.11);
        border-radius: 14px;
        background: rgba(3,7,13,.46);
        -webkit-backdrop-filter: blur(10px);
        backdrop-filter: blur(10px);
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
      .star-detail-main[data-article-reader] .star-detail-note-date,
      .star-detail-main[data-article-reader] .star-detail-note-lede,
      .star-detail-main[data-article-reader] .star-detail-meta,
      .star-detail-main[data-article-reader] .star-detail-divider,
      .star-detail-main[data-article-reader] .star-detail-note-intro,
      .star-detail-main[data-article-reader] .star-detail-object {
        display: none;
      }
      @media (max-width: 620px) {
        .stellar-article-reader { font-size: 14px; line-height: 1.82; }
        .stellar-article-reader .article-lead,
        .stellar-article-reader > p:first-child { font-size: 16px; }
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

    function applyFullArticle() {
      const object = controller.activeObject;
      const main = document.querySelector('.star-detail-main');
      if (!main) return;

      if (!object || object.kind !== 'note' || !object.articleHtml) {
        if (!document.body.classList.contains('star-detail-open')) {
          appliedId = null;
          delete main.dataset.articleReader;
        }
        return;
      }

      if (appliedId === object.id && main.dataset.articleReader === object.id) return;
      const shell = document.querySelector('.star-detail-shell');
      if (shell?.dataset.starId !== object.id) return;

      main.innerHTML = `<article class="stellar-article-reader">${object.articleHtml}</article>`;
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
