(() => {
  'use strict';

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function' || baseInstall.__smirelFieldPointerDrive) return;

  const pointerDriveInstall = function installFieldPointerDrive(context) {
    const controller = baseInstall(context);
    if (!controller) return controller;

    const { pointer, reducedMotion } = context || {};
    if (!pointer || reducedMotion) return controller;

    const baseUpdate = controller.update.bind(controller);
    let fieldPhase = 'galaxy';

    function damp(current, target, speed, dt) {
      return current + (target - current) * (1 - Math.exp(-speed * dt));
    }

    window.addEventListener('smirel:field-change', (event) => {
      const phase = event.detail?.phase;
      if (phase === 'entering' || phase === 'open' || phase === 'leaving' || phase === 'galaxy') {
        fieldPhase = phase;
      }
    });

    controller.update = (now, dt, elapsed) => {
      const contentOwnsCamera = document.body.classList.contains('star-flight-active')
        || document.body.classList.contains('star-detail-open');
      const fieldOwnsPointer = fieldPhase === 'entering'
        || fieldPhase === 'open'
        || document.body.classList.contains('star-field-open');

      // The base galaxy frame intentionally skips pointer damping whenever the
      // stellar controller owns the camera. A local field owns that camera, so it
      // must also advance the same pointer state before the field viewport reads
      // currentX/currentY. Otherwise targetX/targetY change but the live values
      // remain frozen at the moment the field opened.
      if (fieldOwnsPointer && !contentOwnsCamera) {
        pointer.currentX = damp(pointer.currentX, pointer.targetX, 2.7, dt);
        pointer.currentY = damp(pointer.currentY, pointer.targetY, 2.7, dt);
      }

      return baseUpdate(now, dt, elapsed);
    };

    return controller;
  };

  pointerDriveInstall.__smirelFieldPointerDrive = true;
  window[INSTALL_KEY] = pointerDriveInstall;
})();
