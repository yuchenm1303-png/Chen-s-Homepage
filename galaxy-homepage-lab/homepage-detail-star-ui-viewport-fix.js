(() => {
  'use strict';

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function' || baseInstall.__smirelDetailStarUiViewportFix) return;

  const PATCH_FLAG = '__smirelDetailUiViewportCssScale';
  const PATCHED_FLAG = '__smirelDetailUiViewportPatched';

  function patchRendererViewportOnce(renderer) {
    if (!renderer || renderer[PATCHED_FLAG]) return;

    const nativeSetViewport = renderer.setViewport.bind(renderer);
    const nativeSetScissor = renderer.setScissor.bind(renderer);

    renderer.setViewport = function setViewportWithDetailUiFix(...args) {
      const correction = Number(renderer[PATCH_FLAG]) || 1;
      if (correction !== 1
          && args.length === 4
          && args.every((value) => Number.isFinite(value))) {
        return nativeSetViewport(
          args[0] / correction,
          args[1] / correction,
          args[2] / correction,
          args[3] / correction,
        );
      }
      return nativeSetViewport(...args);
    };

    renderer.setScissor = function setScissorWithDetailUiFix(...args) {
      const correction = Number(renderer[PATCH_FLAG]) || 1;
      if (correction !== 1
          && args.length === 4
          && args.every((value) => Number.isFinite(value))) {
        return nativeSetScissor(
          args[0] / correction,
          args[1] / correction,
          args[2] / correction,
          args[3] / correction,
        );
      }
      return nativeSetScissor(...args);
    };

    renderer[PATCHED_FLAG] = true;
  }

  const fixedInstall = function installDetailStarUiViewportFix(context) {
    const controller = baseInstall(context);
    if (!controller || typeof controller.renderDetailStarUi !== 'function') return controller;

    const baseRenderDetailStarUi = controller.renderDetailStarUi.bind(controller);

    controller.renderDetailStarUi = (renderer) => {
      if (!renderer) return false;
      patchRendererViewportOnce(renderer);

      // homepage-detail-star-ui V3 calculates its overlay rectangle in drawing-
      // buffer pixels. WebGLRenderer.setViewport()/setScissor() expect logical
      // canvas pixels and multiply by renderer.pixelRatio internally. Undo that
      // one conversion only while the detail overlay submits its numeric viewport.
      const pixelRatio = Math.max(Number(renderer.getPixelRatio?.()) || 1, 1e-6);
      renderer[PATCH_FLAG] = pixelRatio;
      try {
        return baseRenderDetailStarUi(renderer);
      } finally {
        renderer[PATCH_FLAG] = 1;
      }
    };

    return controller;
  };

  fixedInstall.__smirelDetailStarUiViewportFix = true;
  window[INSTALL_KEY] = fixedInstall;
})();
