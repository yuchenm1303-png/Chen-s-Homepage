(() => {
  'use strict';

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function' || baseInstall.__smirelStellarEmissionBoost) return;

  const UNIFORM_MARKER = 'uniform float uActivity;';
  const CORE_OUTPUT_MARKER = 'gl_FragColor = vec4(body * pulse * 1.34, 1.0);';
  const CORE_OUTPUT_REPLACEMENT = 'gl_FragColor = vec4(body * pulse * 1.34 * uEmissionBoost, 1.0);';
  const SHELL_OUTPUT_MARKER = 'gl_FragColor = vec4(color, alpha);';
  const SHELL_OUTPUT_REPLACEMENT = 'gl_FragColor = vec4(color * uEmissionBoost, alpha);';

  // Keep distant flight visually identical to the source point star. Only the
  // final close approach is allowed to develop the HDR stellar envelope.
  const CLOSE_APPROACH_START = 0.82;
  const CLOSE_APPROACH_FULL = 0.985;
  const CORE_MAX_BOOST = 5.0;
  const CHROMOSPHERE_MAX_BOOST = 3.0;
  const CORONA_MAX_BOOST = 2.2;
  const HALO_MAX_OPACITY = 0.018;
  const HALO_SCALE_FACTOR = 0.72;

  function smootherstep01(value) {
    const t = Math.min(1, Math.max(0, value));
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  const emissionInstall = function installStellarEmissionBoost(context) {
    const controller = baseInstall(context);
    if (!controller) return controller;

    const patchedMaterials = new WeakSet();

    function patchMaterial(material, outputMarker, outputReplacement, label) {
      if (!material || patchedMaterials.has(material)) return;
      const source = material.fragmentShader;
      if (typeof source !== 'string'
          || !source.includes(UNIFORM_MARKER)
          || !source.includes(outputMarker)) {
        console.warn(`[homepage-star-emission] ${label} shader marker not found; keeping approved shader unchanged.`);
        patchedMaterials.add(material);
        return;
      }

      material.uniforms.uEmissionBoost = { value: 1.0 };
      material.fragmentShader = source
        .replace(UNIFORM_MARKER, `${UNIFORM_MARKER}\n      uniform float uEmissionBoost;`)
        .replace(outputMarker, outputReplacement);
      material.needsUpdate = true;
      patchedMaterials.add(material);
    }

    function setUniform(material, value) {
      if (material?.uniforms?.uEmissionBoost) {
        material.uniforms.uEmissionBoost.value = value;
      }
    }

    function getCloseApproach(model) {
      const active = controller.activeObject;
      if (!active || !model?.group) return 0;

      // The refined stellar model settles at 0.84 * catalog radius. Use its
      // actual rendered scale rather than the binary flight CSS class, so a
      // distant target remains visually identical to its original point star.
      const radius = active.star?.radius ?? 1;
      const finalScale = Math.max(0.84 * radius, 0.001);
      const sizeRatio = Math.min(1, Math.max(0, model.group.scale.x / finalScale));
      const local = (sizeRatio - CLOSE_APPROACH_START)
        / (CLOSE_APPROACH_FULL - CLOSE_APPROACH_START);
      return smootherstep01(local);
    }

    function applyEmissionBoost() {
      const model = controller.stellarModel;
      if (!model) return;

      patchMaterial(
        model.photosphere?.material,
        CORE_OUTPUT_MARKER,
        CORE_OUTPUT_REPLACEMENT,
        'photosphere',
      );
      patchMaterial(
        model.chromosphere?.material,
        SHELL_OUTPUT_MARKER,
        SHELL_OUTPUT_REPLACEMENT,
        'chromosphere',
      );
      patchMaterial(
        model.corona?.material,
        SHELL_OUTPUT_MARKER,
        SHELL_OUTPUT_REPLACEMENT,
        'corona',
      );

      const approach = getCloseApproach(model);
      setUniform(
        model.photosphere?.material,
        1.0 + (CORE_MAX_BOOST - 1.0) * approach,
      );
      setUniform(
        model.chromosphere?.material,
        1.0 + (CHROMOSPHERE_MAX_BOOST - 1.0) * approach,
      );
      setUniform(
        model.corona?.material,
        1.0 + (CORONA_MAX_BOOST - 1.0) * approach,
      );

      // The camera-facing legacy halo remains only a compact optical envelope.
      // The refined runtime resets its descriptor scale before this wrapper runs,
      // so this per-frame factor does not accumulate.
      if (model.halo?.material) {
        model.halo.scale.multiplyScalar(HALO_SCALE_FACTOR);
        model.halo.material.opacity = HALO_MAX_OPACITY * approach;
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
