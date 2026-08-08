(() => {
  'use strict';

  if (typeof state === 'undefined' || typeof render !== 'function' || !contentElement) return;

  const originalRender = render;
  const sectionCache = new Map();
  const scrollCache = new Map();
  const validSections = new Set(['about', 'projects', 'blog', 'contact']);
  let visibleLang = state.lang;
  let visibleSection = state.section;
  let insideOriginalRender = false;

  const style = document.createElement('style');
  style.textContent = `
    .navigation-cache-pane { display: contents; }

    .menu-item,
    .menu-item:active,
    .menu-item.active {
      transition: none !important;
      animation: none !important;
      transform: none !important;
    }

    .screen-refresh,
    .inspector-refresh {
      animation: none !important;
      filter: none !important;
      transform: none !important;
      opacity: 1 !important;
    }
  `;
  document.head.appendChild(style);

  const cacheKey = (lang, section) => `${lang}:${section}`;

  function syncChrome() {
    const dictionary = content[state.lang];
    document.documentElement.lang = state.lang === 'zh' ? 'zh-CN' : 'en';
    langSwitch.textContent = state.lang === 'zh' ? 'EN' : 'CN';

    document.querySelectorAll('[data-i18n]').forEach((element) => {
      const key = element.dataset.i18n;
      if (dictionary[key]) element.textContent = dictionary[key];
    });

    menuItems.forEach((button) => {
      button.classList.toggle('active', button.dataset.section === state.section);
    });
  }

  function wrapCurrentContent(lang = visibleLang, section = visibleSection) {
    const key = cacheKey(lang, section);
    let pane = sectionCache.get(key);

    if (pane?.parentNode === contentElement) return pane;

    if (
      contentElement.children.length === 1
      && contentElement.firstElementChild?.classList.contains('navigation-cache-pane')
    ) {
      pane = contentElement.firstElementChild;
      sectionCache.set(key, pane);
      return pane;
    }

    pane = document.createElement('div');
    pane.className = 'navigation-cache-pane';
    pane.dataset.navigationCacheKey = key;
    while (contentElement.firstChild) pane.appendChild(contentElement.firstChild);
    contentElement.appendChild(pane);
    sectionCache.set(key, pane);
    return pane;
  }

  function stashVisibleSection() {
    if (!contentElement.firstChild) return;
    const key = cacheKey(visibleLang, visibleSection);
    scrollCache.set(key, contentElement.scrollTop);
    const pane = wrapCurrentContent(visibleLang, visibleSection);
    if (pane.parentNode === contentElement) pane.remove();
  }

  function restoreCachedSection(lang, section) {
    const key = cacheKey(lang, section);
    const pane = sectionCache.get(key);
    if (!pane) return false;

    contentElement.replaceChildren(pane);
    visibleLang = lang;
    visibleSection = section;
    contentElement.scrollTop = scrollCache.get(key) || 0;
    return true;
  }

  function renderCurrentState() {
    const targetLang = state.lang;
    const targetSection = state.section;

    if (targetLang === visibleLang && targetSection === visibleSection && contentElement.firstChild) {
      syncChrome();
      return;
    }

    stashVisibleSection();
    syncChrome();

    if (restoreCachedSection(targetLang, targetSection)) {
      syncChrome();
      return;
    }

    insideOriginalRender = true;
    try {
      originalRender();
    } finally {
      insideOriginalRender = false;
    }

    visibleLang = targetLang;
    visibleSection = targetSection;
    wrapCurrentContent(targetLang, targetSection);
    syncChrome();
  }

  render = function cachedRender() {
    if (insideOriginalRender) return originalRender();
    renderCurrentState();
  };

  // Cache the already-rendered initial section once. From then on each return
  // moves one lightweight wrapper node instead of rebuilding all descendants.
  wrapCurrentContent(visibleLang, visibleSection);

  document.addEventListener('click', (event) => {
    const menuButton = event.target.closest('.menu-item[data-section]');
    if (menuButton) {
      const target = menuButton.dataset.section;
      if (!validSections.has(target)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      state.section = target;
      render();
      return;
    }

    const shortcut = event.target.closest('[data-open]');
    if (shortcut) {
      const target = shortcut.dataset.open;
      if (!validSections.has(target)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      state.section = target;
      render();
      return;
    }

    if (event.target.closest('#langSwitch')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      state.lang = state.lang === 'zh' ? 'en' : 'zh';
      render();
    }
  }, true);

  document.addEventListener('dblclick', (event) => {
    const shortcut = event.target.closest('[data-open]');
    if (!shortcut) return;
    const target = shortcut.dataset.open;
    if (!validSections.has(target)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    restoreWindow();
    state.section = target;
    render();
  }, true);
})();
