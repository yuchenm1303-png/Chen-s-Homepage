(() => {
  'use strict';

  if (typeof state === 'undefined' || typeof render !== 'function' || !contentElement) return;

  const sectionCache = new Map();
  const validSections = new Set(['about', 'projects', 'blog', 'contact']);

  const style = document.createElement('style');
  style.textContent = `
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

  function syncMenuState() {
    menuItems.forEach((button) => {
      button.classList.toggle('active', button.dataset.section === state.section);
    });
  }

  function stashCurrentSection() {
    if (!contentElement.firstChild) return;

    const fragment = document.createDocumentFragment();
    while (contentElement.firstChild) {
      fragment.appendChild(contentElement.firstChild);
    }
    sectionCache.set(cacheKey(state.lang, state.section), fragment);
  }

  function restoreCachedSection(targetSection) {
    const key = cacheKey(state.lang, targetSection);
    const fragment = sectionCache.get(key);
    if (!fragment) return false;

    contentElement.replaceChildren(fragment);
    sectionCache.delete(key);
    contentElement.scrollTop = 0;
    return true;
  }

  function navigateToSection(targetSection) {
    if (!validSections.has(targetSection) || targetSection === state.section) return;

    stashCurrentSection();
    state.section = targetSection;
    syncMenuState();

    if (restoreCachedSection(targetSection)) return;

    // First visit still goes through the original renderer so Projects/Blog
    // can perform their one-time setup. Later visits reuse the existing DOM,
    // preserving listeners and avoiding repeated innerHTML parsing/layout.
    render();
  }

  document.addEventListener('click', (event) => {
    const menuButton = event.target.closest('.menu-item[data-section]');
    if (menuButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      navigateToSection(menuButton.dataset.section);
      return;
    }

    const shortcut = event.target.closest('[data-open]');
    if (shortcut) {
      event.preventDefault();
      event.stopImmediatePropagation();
      navigateToSection(shortcut.dataset.open);
    }
  }, true);

  document.addEventListener('dblclick', (event) => {
    const shortcut = event.target.closest('[data-open]');
    if (!shortcut) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    restoreWindow();
    navigateToSection(shortcut.dataset.open);
  }, true);
})();
