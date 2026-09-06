(() => {
  'use strict';

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function' || baseInstall.__smirelDetailStarLayer) return;

  const detailLayerInstall = function installDetailStarLayer(context) {
    const controller = baseInstall(context);
    if (!controller) return controller;

    const {
      scene,
      camera,
      detailOverlayScene,
      detailOverlayCamera,
      detailOverlayPass,
    } = context || {};

    if (!scene || !camera || !detailOverlayScene || !detailOverlayCamera || !detailOverlayPass) {
      console.error('[homepage-star-detail-layer] shared HDR overlay unavailable');
      return controller;
    }

    let starGroup = null;
    let originalStarParent = null;
    let previousArrived = false;
    let ownsStarLayer = false;

    detailOverlayPass.enabled = false;

    function syncOverlayCamera() {
      camera.updateMatrixWorld(true);
      detailOverlayCamera.position.copy(camera.position);
      detailOverlayCamera.quaternion.copy(camera.quaternion);
      detailOverlayCamera.scale.copy(camera.scale);
      detailOverlayCamera.fov = camera.fov;
      detailOverlayCamera.aspect = camera.aspect;
      detailOverlayCamera.near = camera.near;
      detailOverlayCamera.far = camera.far;
      detailOverlayCamera.zoom = camera.zoom;
      detailOverlayCamera.projectionMatrix.copy(camera.projectionMatrix);
      detailOverlayCamera.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
      detailOverlayCamera.updateMatrixWorld(true);
    }

    function takeStarLayer() {
      if (ownsStarLayer) return true;
      starGroup = controller.stellarModel?.group || null;
      if (!starGroup?.parent) return false;

      originalStarParent = starGroup.parent || scene;
      syncOverlayCamera();
      detailOverlayScene.attach(starGroup);
      ownsStarLayer = true;
      detailOverlayPass.enabled = true;
      document.body.classList.add('star-detail-star-layer-active');
      return true;
    }

    function releaseStarLayer() {
      if (!ownsStarLayer || !starGroup) return;

      // The shared composer renders after controller.update(). Disable the
      // overlay before reattaching so this frame can never render the same star
      // once in the galaxy pass and once again in the UI pass.
      detailOverlayPass.enabled = false;
      const targetParent = originalStarParent?.attach ? originalStarParent : scene;
      targetParent.attach(starGroup);
      originalStarParent = null;
      ownsStarLayer = false;
      document.body.classList.remove('star-detail-star-layer-active');
    }

    const baseUpdate = controller.update.bind(controller);
    controller.update = (now, dt, elapsed) => {
      // The approved legacy detail controller computes its camera pullback first.
      // The UI star then mirrors that exact projection in a separate scene on the
      // SAME HDR framebuffer. There is no secondary canvas or WebGL context.
      const baseOwnsCamera = baseUpdate(now, dt, elapsed);
      const arrived = document.body.classList.contains('star-flight-arrived');

      if (arrived && !previousArrived) takeStarLayer();

      if (arrived && ownsStarLayer) {
        syncOverlayCamera();
      }

      if (!arrived && previousArrived && ownsStarLayer) {
        // Reattach before the shared composer renders this frame. Because both
        // passes target the same framebuffer, there is no rectangular handoff
        // surface, double-rendered star, or blank transition frame.
        releaseStarLayer();
      }

      if (!document.body.classList.contains('star-flight-active') && ownsStarLayer) {
        releaseStarLayer();
      }

      previousArrived = arrived;
      return baseOwnsCamera || ownsStarLayer;
    };

    return controller;
  };

  detailLayerInstall.__smirelDetailStarLayer = true;
  window[INSTALL_KEY] = detailLayerInstall;
})();
