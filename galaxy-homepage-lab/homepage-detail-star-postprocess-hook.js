(() => {
  'use strict';

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function' || baseInstall.__smirelDetailStarPostprocessHookV1) return;

  const detailPostprocessInstall = function installDetailStarPostprocessHook(context) {
    const { THREE } = context || {};
    if (THREE?.WebGLRenderer?.prototype && !THREE.WebGLRenderer.prototype.__smirelDetailStarPostprocessHookV1) {
      const prototype = THREE.WebGLRenderer.prototype;
      const originalRender = prototype.render;

      prototype.render = function smirelRenderWithDetailStarPostprocess(scene, camera) {
        const detailCanvas = this.domElement?.classList?.contains('smirel-detail-star-canvas') === true;
        const factory = window.__SMIREL_CREATE_DETAIL_STELLAR_POSTPROCESS__;

        if (!detailCanvas || this.__smirelDetailPostprocessGuard || typeof factory !== 'function') {
          return originalRender.call(this, scene, camera);
        }

        try {
          if (!this.__smirelDetailStellarPostprocess) {
            this.__smirelDetailStellarPostprocess = factory({
              renderer: this,
              scene,
              camera,
              size: 512,
            });
          }

          const postprocess = this.__smirelDetailStellarPostprocess;
          if (!postprocess?.render) {
            return originalRender.call(this, scene, camera);
          }

          this.__smirelDetailPostprocessGuard = true;
          postprocess.render(1 / 30);
          return undefined;
        } finally {
          this.__smirelDetailPostprocessGuard = false;
        }
      };

      prototype.__smirelDetailStarPostprocessHookV1 = true;
      prototype.__smirelDetailStarOriginalRender = originalRender;
    }

    return baseInstall(context);
  };

  detailPostprocessInstall.__smirelDetailStarPostprocessHookV1 = true;
  window[INSTALL_KEY] = detailPostprocessInstall;
})();
