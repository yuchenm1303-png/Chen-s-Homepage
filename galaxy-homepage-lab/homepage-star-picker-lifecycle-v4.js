(() => {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  if (params.get('picker') !== '1') return;

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const LIFECYCLE_KEY = '__SMIREL_STAR_PICKER_LIFECYCLE_V4__';
  const RESET_MARKER = 'smirel:star-picker:lifecycle-v4-reset';
  const V3_STORAGE_KEY = 'smirel:integrated-star-picker:v3';
  const V2_STORAGE_KEY = 'smirel:integrated-star-picker:v2';

  if (window[LIFECYCLE_KEY]) return;

  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function') return;

  // V2/V3 could persist anchors resolved before the renderer had applied its
  // real viewport aspect. Discard that contaminated working set exactly once.
  try {
    if (localStorage.getItem(RESET_MARKER) !== '1') {
      localStorage.removeItem(V3_STORAGE_KEY);
      localStorage.removeItem(V2_STORAGE_KEY);
      localStorage.setItem(RESET_MARKER, '1');
    }
  } catch {}

  const lifecycle = {
    controller: null,
    context: null,
    baseline: new Map(),
    resolvedAspect: null,
    ready: false,
  };
  window[LIFECYCLE_KEY] = lifecycle;

  function setRendererAspectFromViewport(context) {
    const { camera, canvas } = context || {};
    if (!camera || !canvas) return;
    const width = Math.max(1, Math.floor(canvas.clientWidth || window.innerWidth || 1));
    const height = Math.max(1, Math.floor(canvas.clientHeight || window.innerHeight || 1));
    const aspect = width / height;
    camera.aspect = aspect;
    camera.updateProjectionMatrix?.();
    lifecycle.resolvedAspect = aspect;
  }

  function installLifecycle(context) {
    // The renderer creates PerspectiveCamera(..., 1, ...) and normally fixes its
    // aspect in resize() before the first frame. Picker V3 resolves anchors during
    // install, so give that premature resolve the exact viewport projection the
    // normal first frame would have used.
    setRendererAspectFromViewport(context);

    const controller = baseInstall(context);
    if (!controller || typeof controller.getSpatialAnchor !== 'function') return controller;

    lifecycle.controller = controller;
    lifecycle.context = context || null;

    const rawGetSpatialAnchor = controller.getSpatialAnchor.bind(controller);
    controller.getSpatialAnchor = (objectId) => {
      const anchor = rawGetSpatialAnchor(objectId);
      if (anchor && Number.isInteger(anchor.index) && !lifecycle.baseline.has(objectId)) {
        // V3 asks for every resolved anchor before it applies saved selections.
        // Capture that first value as the immutable normal-homepage baseline.
        lifecycle.baseline.set(objectId, anchor.index);
      }
      return anchor;
    };

    queueMicrotask(() => {
      const picker = controller.starPicker;
      const positions = context?.brightField?.geometry?.getAttribute?.('position');
      if (!picker || !positions) return;

      const applyIndex = (objectId, index) => {
        if (!Number.isInteger(index) || index < 0 || index >= positions.count) return false;
        const anchor = rawGetSpatialAnchor(objectId);
        if (!anchor) return false;
        anchor.index = index;
        if (anchor.position?.set) {
          anchor.position.set(positions.getX(index), positions.getY(index), positions.getZ(index));
        }
        return true;
      };

      const restoreBaseline = () => {
        for (const [objectId, index] of lifecycle.baseline) applyIndex(objectId, index);
      };

      const applyWorkingSelections = () => {
        const selections = picker.selections;
        if (!(selections instanceof Map)) return;
        for (const [objectId, index] of selections) applyIndex(objectId, index);
      };

      const launch = document.querySelector('.smirel-picker-v2-launch');
      if (launch) {
        // Apply the editor working set immediately before V3 turns ON. While OFF,
        // the real anchors remain the untouched normal-homepage baseline.
        launch.addEventListener('click', () => {
          if (!picker.active) applyWorkingSelections();
        }, true);
      }

      window.addEventListener('keydown', (event) => {
        if (event.shiftKey && event.key.toLowerCase() === 'p' && !picker.active) {
          applyWorkingSelections();
        }
      }, true);

      let wasActive = Boolean(picker.active);
      const observer = new MutationObserver(() => {
        const isActive = document.body.classList.contains('smirel-star-picker-v2-active');
        if (wasActive && !isActive) restoreBaseline();
        wasActive = isActive;
      });
      observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

      const originalSetActive = picker.setActive.bind(picker);
      picker.setActive = (next) => {
        if (next) applyWorkingSelections();
        const result = originalSetActive(next);
        if (!next) restoreBaseline();
        return result;
      };

      // V3 currently auto-enables itself during install. End bootstrap in the
      // required OFF = normal-homepage state, then let the user explicitly enter
      // edit mode.
      if (picker.active) picker.setActive(false);
      restoreBaseline();
      lifecycle.ready = lifecycle.baseline.size > 0;
    });

    return controller;
  }

  installLifecycle.__smirelStarPickerLifecycleV4 = true;
  window[INSTALL_KEY] = installLifecycle;
})();
