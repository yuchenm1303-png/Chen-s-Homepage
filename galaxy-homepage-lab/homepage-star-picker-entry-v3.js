(() => {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  if (params.get('picker') !== '1') return;

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const BOOT_KEY = '__SMIREL_STAR_PICKER_BOOTSTRAP_V4__';
  const RESET_MARKER = 'smirel:star-picker:lifecycle-v4-reset';
  const V3_STORAGE_KEY = 'smirel:integrated-star-picker:v3';
  const V2_STORAGE_KEY = 'smirel:integrated-star-picker:v2';
  if (window[BOOT_KEY]) return;

  const boot = {
    invoked: false,
    controller: null,
    context: null,
    startedAt: performance.now(),
    badge: null,
    timer: 0,
    baseline: new Map(),
    resolvedAspect: null,
    lifecycleReady: false,
  };
  window[BOOT_KEY] = boot;

  // V2/V3 may contain indices captured while the camera still had its constructor
  // aspect of 1. Reset that contaminated editor state exactly once. Future V3
  // selections remain persistent after this lifecycle migration.
  try {
    if (localStorage.getItem(RESET_MARKER) !== '1') {
      localStorage.removeItem(V3_STORAGE_KEY);
      localStorage.removeItem(V2_STORAGE_KEY);
      localStorage.setItem(RESET_MARKER, '1');
    }
  } catch {}

  const badge = document.createElement('button');
  badge.type = 'button';
  badge.setAttribute('aria-label', 'Star picker bootstrap status');
  badge.textContent = '选星器加载中…';
  badge.style.cssText = [
    'position:fixed',
    'right:18px',
    'top:18px',
    'z-index:999999',
    'min-height:36px',
    'padding:0 13px',
    'border:1px solid rgba(190,225,255,.28)',
    'border-radius:999px',
    'background:rgba(5,8,12,.92)',
    'color:rgba(245,250,255,.92)',
    'box-shadow:0 12px 36px rgba(0,0,0,.42)',
    'font:700 11px/1 ui-sans-serif,system-ui,sans-serif',
    'letter-spacing:.04em',
    'cursor:default',
  ].join(';');
  document.body.appendChild(badge);
  boot.badge = badge;

  function setStatus(text, error = false) {
    if (!boot.badge?.isConnected) return;
    boot.badge.textContent = text;
    boot.badge.style.borderColor = error
      ? 'rgba(255,170,140,.55)'
      : 'rgba(190,225,255,.28)';
    boot.badge.style.color = error
      ? 'rgba(255,220,205,.96)'
      : 'rgba(245,250,255,.92)';
  }

  function hardReload() {
    const url = new URL(window.location.href);
    url.searchParams.set('picker', '1');
    url.searchParams.set('pickerReload', Date.now().toString(36));
    window.location.replace(url.toString());
  }

  function enableRetry() {
    if (!boot.badge?.isConnected) return;
    boot.badge.style.cursor = 'pointer';
    boot.badge.title = '点击强制刷新选星器资源';
    boot.badge.onclick = hardReload;
  }

  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function') {
    setStatus('选星器错误：基础星空运行时未注册', true);
    enableRetry();
    return;
  }

  function setViewportProjection(context) {
    const { camera, canvas } = context || {};
    if (!camera || !canvas) return;
    const width = Math.max(1, Math.floor(canvas.clientWidth || window.innerWidth || 1));
    const height = Math.max(1, Math.floor(canvas.clientHeight || window.innerHeight || 1));
    camera.aspect = width / height;
    camera.updateProjectionMatrix?.();
    boot.resolvedAspect = camera.aspect;
  }

  function finishPickerLifecycle(controller, context, rawGetSpatialAnchor) {
    const picker = controller?.starPicker;
    const positions = context?.brightField?.geometry?.getAttribute?.('position');
    if (!picker || !positions || typeof rawGetSpatialAnchor !== 'function') return;

    const applyIndex = (objectId, index) => {
      if (!Number.isInteger(index) || index < 0 || index >= positions.count) return false;
      const anchor = rawGetSpatialAnchor(objectId);
      if (!anchor) return false;
      anchor.index = index;
      anchor.position?.set?.(positions.getX(index), positions.getY(index), positions.getZ(index));
      return true;
    };

    const restoreBaseline = () => {
      for (const [objectId, index] of boot.baseline) applyIndex(objectId, index);
    };

    const applyWorkingSelections = () => {
      const selections = picker.selections;
      if (!(selections instanceof Map)) return;
      for (const [objectId, index] of selections) applyIndex(objectId, index);
    };

    const launch = document.querySelector('.smirel-picker-v2-launch');
    launch?.addEventListener('click', () => {
      if (!picker.active) applyWorkingSelections();
    }, true);

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

    // V3 auto-enables during install. End bootstrap in the required OFF = normal
    // homepage state. Entering edit mode is now an explicit user action.
    if (picker.active) picker.setActive(false);
    restoreBaseline();
    boot.lifecycleReady = boot.baseline.size > 0;
  }

  const probeInstall = function pickerBootstrapProbe(context) {
    boot.invoked = true;
    boot.context = context || null;

    // Root cause fix: the renderer constructs PerspectiveCamera with aspect=1
    // and normally corrects it in resize() before the first frame. Picker V3 used
    // to resolve anchors during install, before that resize. Reproduce the normal
    // viewport projection before V3 is allowed to resolve anything.
    setViewportProjection(context);

    const controller = baseInstall(context);
    boot.controller = controller || null;
    if (!controller || typeof controller.getSpatialAnchor !== 'function') return controller;

    const rawGetSpatialAnchor = controller.getSpatialAnchor.bind(controller);
    controller.getSpatialAnchor = (objectId) => {
      const anchor = rawGetSpatialAnchor(objectId);
      if (anchor && Number.isInteger(anchor.index) && !boot.baseline.has(objectId)) {
        // V3 queries each anchor before applying its working selections. The first
        // observed index is therefore the normal-homepage baseline.
        boot.baseline.set(objectId, anchor.index);
      }
      return anchor;
    };

    queueMicrotask(() => finishPickerLifecycle(controller, context, rawGetSpatialAnchor));
    return controller;
  };
  probeInstall.__smirelPickerBootstrapProbeV4 = true;
  window[INSTALL_KEY] = probeInstall;

  function describeFailure() {
    const context = boot.context;
    const controller = boot.controller;
    if (!boot.invoked) return '选星器错误：星空安装链未执行';
    if (!controller) return '选星器错误：星空控制器为空';
    if (!context?.THREE) return '选星器错误：THREE 上下文缺失';
    if (!context?.camera) return '选星器错误：camera 上下文缺失';
    if (!context?.brightField?.geometry) return '选星器错误：brightField 上下文缺失';
    if (!context?.canvas) return '选星器错误：canvas 上下文缺失';
    if (typeof controller.getSpatialAnchor !== 'function') {
      return '选星器错误：constellation anchor API 未接入';
    }
    const catalog = Array.isArray(controller.catalog) ? controller.catalog : [];
    const fieldCount = catalog.filter((item) => item?.kind === 'field').length;
    if (!fieldCount) return '选星器错误：主页 field catalog 为空';
    return '选星器错误：picker runtime 未完成挂载';
  }

  boot.timer = window.setInterval(() => {
    const launcher = document.querySelector('.smirel-picker-v2-launch');
    if (launcher) {
      window.clearInterval(boot.timer);
      boot.timer = 0;
      boot.badge?.remove();
      boot.badge = null;
      return;
    }

    const elapsed = performance.now() - boot.startedAt;
    const currentInstall = window[INSTALL_KEY];
    const v2Wrapped = Boolean(currentInstall?.__smirelIntegratedStarPickerV2);

    if (elapsed > 900 && !v2Wrapped) {
      setStatus('选星器错误：picker 脚本未执行', true);
      enableRetry();
      return;
    }

    if (elapsed > 6500) {
      setStatus(describeFailure(), true);
      enableRetry();
      window.clearInterval(boot.timer);
      boot.timer = 0;
      return;
    }

    if (v2Wrapped && !boot.invoked) {
      setStatus('选星器已加载，等待星空运行时…');
    } else if (boot.invoked) {
      setStatus('选星器正在连接真实星座…');
    }
  }, 120);
})();
