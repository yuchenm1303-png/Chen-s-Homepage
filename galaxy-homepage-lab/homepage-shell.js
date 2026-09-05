(() => {
  'use strict';

  const panel = document.querySelector('.home-panel');
  const closeButton = document.querySelector('.home-panel-close');
  const triggers = [...document.querySelectorAll('[data-home-panel]')];
  const views = [...document.querySelectorAll('[data-home-panel-view]')];
  if (!panel || !closeButton || !triggers.length || !views.length) return;

  let activeKey = null;
  let closeTimer = 0;

  function setActiveTrigger(key) {
    triggers.forEach((trigger) => {
      if (trigger.dataset.homePanel === key) {
        trigger.setAttribute('aria-current', 'true');
      } else {
        trigger.removeAttribute('aria-current');
      }
    });
  }

  function showView(key) {
    let matched = false;
    for (const view of views) {
      const isTarget = view.dataset.homePanelView === key;
      view.hidden = !isTarget;
      matched ||= isTarget;
    }
    return matched;
  }

  function openPanel(key) {
    if (!showView(key)) return;
    window.clearTimeout(closeTimer);
    activeKey = key;
    setActiveTrigger(key);
    panel.setAttribute('aria-hidden', 'false');
    document.body.classList.add('home-panel-open');
    requestAnimationFrame(() => panel.classList.add('is-open'));
  }

  function closePanel({ restoreFocus = true } = {}) {
    if (!activeKey) return;
    const trigger = triggers.find((item) => item.dataset.homePanel === activeKey);
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('home-panel-open');
    setActiveTrigger(null);
    activeKey = null;

    closeTimer = window.setTimeout(() => {
      views.forEach((view) => { view.hidden = true; });
    }, 220);

    if (restoreFocus) trigger?.focus({ preventScroll: true });
  }

  triggers.forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const key = trigger.dataset.homePanel;
      if (key === activeKey && panel.classList.contains('is-open')) {
        closePanel({ restoreFocus: false });
        return;
      }
      openPanel(key);
    });
  });

  closeButton.addEventListener('click', () => closePanel());

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !activeKey) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    closePanel();
  }, true);

  const observer = new MutationObserver(() => {
    if (!document.body.classList.contains('star-flight-active')) return;
    closePanel({ restoreFocus: false });
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
})();
