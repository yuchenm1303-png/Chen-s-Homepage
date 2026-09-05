(() => {
  'use strict';

  const panel = document.querySelector('.home-panel');
  const closeButton = document.querySelector('.home-panel-close');
  const triggers = [...document.querySelectorAll('[data-home-panel]')];
  const views = [...document.querySelectorAll('[data-home-panel-view]')];
  if (!panel || !closeButton || !triggers.length || !views.length) return;

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
  const OPEN_MS = reducedMotion ? 1 : 640;
  const CLOSE_MS = reducedMotion ? 1 : 440;
  const SWAP_OUT_MS = reducedMotion ? 1 : 150;
  const SWAP_IN_MS = reducedMotion ? 1 : 300;

  let activeKey = null;
  let phase = 'closed';
  let motionToken = 0;
  const timers = new Set();

  function later(callback, delay) {
    const id = window.setTimeout(() => {
      timers.delete(id);
      callback();
    }, delay);
    timers.add(id);
    return id;
  }

  function clearTimers() {
    for (const id of timers) window.clearTimeout(id);
    timers.clear();
  }

  function setActiveTrigger(key) {
    triggers.forEach((trigger) => {
      if (trigger.dataset.homePanel === key) {
        trigger.setAttribute('aria-current', 'true');
      } else {
        trigger.removeAttribute('aria-current');
      }
    });
  }

  function viewFor(key) {
    return views.find((view) => view.dataset.homePanelView === key) || null;
  }

  function resetView(view, { hidden = true } = {}) {
    view.classList.remove('is-view-entering', 'is-view-active', 'is-view-leaving');
    view.hidden = hidden;
  }

  function hideAllViews(except = null) {
    views.forEach((view) => {
      if (view === except) return;
      resetView(view);
    });
  }

  function revealView(view) {
    hideAllViews(view);
    view.hidden = false;
    view.classList.remove('is-view-leaving', 'is-view-active');
    view.classList.add('is-view-entering');
    // Force the entering pose to be committed before the active pose.
    void view.offsetHeight;
    requestAnimationFrame(() => view.classList.add('is-view-active'));
  }

  function settleView(view) {
    view.classList.remove('is-view-entering', 'is-view-leaving');
    view.classList.add('is-view-active');
  }

  function openFresh(key) {
    const target = viewFor(key);
    if (!target) return;

    clearTimers();
    const token = ++motionToken;
    activeKey = key;
    phase = 'opening';
    setActiveTrigger(key);
    revealView(target);

    panel.classList.remove('is-closing', 'is-switching');
    panel.classList.add('is-open', 'is-opening');
    panel.setAttribute('aria-hidden', 'false');
    document.body.classList.remove('home-panel-closing');
    // Keep this class alive through the full close animation. The liquid-glass
    // capture pipeline uses it as the "surface is live" signal.
    document.body.classList.add('home-panel-open');

    later(() => {
      if (token !== motionToken || phase !== 'opening') return;
      panel.classList.remove('is-opening');
      settleView(target);
      phase = 'open';
    }, OPEN_MS);
  }

  function switchView(key) {
    const incoming = viewFor(key);
    const outgoing = viewFor(activeKey);
    if (!incoming || incoming === outgoing) return;

    clearTimers();
    const token = ++motionToken;
    phase = 'switching';
    activeKey = key;
    setActiveTrigger(key);
    panel.classList.remove('is-opening', 'is-closing');
    panel.classList.add('is-open', 'is-switching');

    if (outgoing) {
      outgoing.classList.remove('is-view-entering', 'is-view-active');
      outgoing.classList.add('is-view-leaving');
    }

    later(() => {
      if (token !== motionToken || phase !== 'switching') return;
      if (outgoing) resetView(outgoing);

      incoming.hidden = false;
      incoming.classList.remove('is-view-leaving', 'is-view-active');
      incoming.classList.add('is-view-entering');
      void incoming.offsetHeight;
      requestAnimationFrame(() => incoming.classList.add('is-view-active'));

      later(() => {
        if (token !== motionToken || phase !== 'switching') return;
        panel.classList.remove('is-switching');
        settleView(incoming);
        phase = 'open';
      }, SWAP_IN_MS);
    }, SWAP_OUT_MS);
  }

  function openPanel(key) {
    const target = viewFor(key);
    if (!target) return;

    if (key === activeKey && (phase === 'open' || phase === 'opening' || phase === 'switching')) {
      closePanel({ restoreFocus: false });
      return;
    }

    if (phase === 'open' || phase === 'opening' || phase === 'switching') {
      switchView(key);
      return;
    }

    if (phase === 'closing') {
      // A new selection during the retreat reverses the material without waiting
      // for the old close timer to finish.
      panel.classList.remove('is-closing');
      document.body.classList.remove('home-panel-closing');
    }
    openFresh(key);
  }

  function closePanel({ restoreFocus = true } = {}) {
    if (phase === 'closed' || phase === 'closing') return;

    clearTimers();
    const token = ++motionToken;
    const closingKey = activeKey;
    const trigger = triggers.find((item) => item.dataset.homePanel === closingKey);
    const currentView = viewFor(closingKey);

    phase = 'closing';
    setActiveTrigger(null);
    panel.setAttribute('aria-hidden', 'true');
    panel.classList.remove('is-opening', 'is-switching', 'is-open');
    panel.classList.add('is-closing');
    document.body.classList.add('home-panel-closing');

    if (currentView) {
      currentView.classList.remove('is-view-entering', 'is-view-active');
      currentView.classList.add('is-view-leaving');
    }

    later(() => {
      if (token !== motionToken || phase !== 'closing') return;
      panel.classList.remove('is-closing');
      document.body.classList.remove('home-panel-open', 'home-panel-closing');
      hideAllViews();
      activeKey = null;
      phase = 'closed';
      if (restoreFocus) trigger?.focus({ preventScroll: true });
    }, CLOSE_MS);
  }

  triggers.forEach((trigger) => {
    trigger.addEventListener('click', () => openPanel(trigger.dataset.homePanel));
  });

  closeButton.addEventListener('click', () => closePanel());

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || phase === 'closed') return;
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
