(() => {
  'use strict';

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function' || baseInstall.__smirelStellarEmissionBoost) return;

  const CORE_MARKER = 'gl_FragColor = vec4(body * pulse * 1.34, 1.0);';
  const CORE_REPLACEMENT = 'gl_FragColor = vec4(body * pulse * 1.34 * 6.0, 1.0);';
  const SHELL_MARKER = 'gl_FragColor = vec4(color, alpha);';

  const emissionInstall = function installStellarEmissionBoost(context) {
    const controller = baseInstall(context);
    if (!controller) return controller;

    const patchedMaterials = new WeakSet();

    function patchMaterial(material, marker, replacement, label) {
      if (!material || patchedMaterials.has(material)) return;
      const source = material.fragmentShader;
      if (typeof source !== 'string' || !source.includes(marker)) {
        console.warn(`[homepage-star-emission] ${label} shader marker not found; keeping approved shader unchanged.`);
        patchedMaterials.add(material);
        return;
      }
      material.fragmentShader = source.replace(marker, replacement);
      material.needsUpdate = true;
      patchedMaterials.add(material);
    }

    function applyEmissionBoost() {
      const model = controller.stellarModel;
      if (!model) return;

      patchMaterial(
        model.photosphere?.material,
        CORE_MARKER,
        CORE_REPLACEMENT,
        'photosphere',
      );
      patchMaterial(
        model.chromosphere?.material,
        SHELL_MARKER,
        'gl_FragColor = vec4(color * 3.6, alpha);',
        'chromosphere',
      );
      patchMaterial(
        model.corona?.material,
        SHELL_MARKER,
        'gl_FragColor = vec4(color * 3.0, alpha);',
        'corona',
      );

      // Keep the legacy camera-facing sprite as a very weak optical envelope.
      // The visible stellar brightness must come from the HDR 3D model itself,
      // otherwise strong bloom exposes the finite circular sprite boundary.
      if (model.halo?.material) {
        model.halo.material.opacity = Math.min(model.halo.material.opacity, 0.035);
      }
    }

    const baseUpdate = controller.update.bind(controller);
    controller.update = (now, dt, elapsed) => {
      const ownsCamera = baseUpdate(now, dt, elapsed);
      applyEmissionBoost();
      return ownsCamera;
    };

    return controller;
  };

  emissionInstall.__smirelStellarEmissionBoost = true;
  window[INSTALL_KEY] = emissionInstall;
})();
