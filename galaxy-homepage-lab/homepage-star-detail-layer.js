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
    } = context || {};

    if (!scene || !camera || !detailOverlayScene || !detailOverlayCamera) {
      console.error('[homepage-star-detail-layer] shared HDR overlay unavailable');
      return controller;
    }

    let starGroup = null;
    let originalStarParent = null;
    let previousArrived = false;
    let ownsStarLayer = false;

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
      document.body.classList.add('star-detail-star-layer-active');
      return true;
    }

    function releaseStarLayer() {
      if (!ownsStarLayer || !starGroup) return;
      const targetParent = originalStarParent?.attach ? originalStarParent : scene;
      targetParent.attach(starGroup);
      originalStarParent = null;
      ownsStarLayer = false;
      document.body.classList.remove('star-detail-star-layer-active');
    }

    const baseUpdate = controller.update.bind(controller);
    controller.update = (now, dt, elapsed) => {
      // The approved legacy detail controller computes its camera pullback first.
      // The UI star then mirrors that exact projection on the same HDR surface.
      const baseOwnsCamera = baseUpdate(now, dt, elapsed);
      const arrived = document.body.classList.contains('star-flight-arrived');

      if (arrived && !previousArrived) takeStarLayer();

      if (arrived && ownsStarLayer) {
        syncOverlayCamera();
      }

      if (!arrived && previousArrived && ownsStarLayer) {
        // Reattach before the shared composer renders this frame. There is never
        // a second canvas, double-rendered star, or blank handoff frame.
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
