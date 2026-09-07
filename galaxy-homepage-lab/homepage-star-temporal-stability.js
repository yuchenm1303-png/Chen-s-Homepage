(() => {
  'use strict';

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function' || baseInstall.__smirelStellarTemporalStability) return;

  // The refined photosphere contains very high-frequency procedural bands.
  // At detail-page scale those bands approach sub-pixel size, and because they
  // are evaluated from the animated flow field they alias temporally at the
  // settled 30 fps render cadence. Keep the large plasma field animated, but
  // anchor the finest granulation to local surface coordinates at frequencies
  // that remain resolvable on the rendered star.
  const STONE_B_MARKER = 'float stoneB = noise3(q * 54.0 + vec3(phaseTime * 0.074, -phaseTime * 0.051, phaseTime * 0.033));';
  const MICRO_A_MARKER = 'float microA = noise3(q * 92.0 + vec3(-phaseTime * 0.125, phaseTime * 0.071, 5.9));';
  const MICRO_B_MARKER = 'float microB = noise3(q * 146.0 + vec3(phaseTime * 0.164, -phaseTime * 0.093, 17.2));';

  const STONE_B_STABLE = 'float stoneB = noise3(p * 34.0 + vec3(6.7, 11.2, 13.0));';
  const MICRO_A_STABLE = 'float microA = noise3(p * 46.0 + vec3(5.9, 3.4, 12.1));';
  const MICRO_B_STABLE = 'float microB = noise3(p * 60.0 + vec3(17.2, 9.6, 4.3));';

  const DETAIL_CORE_SPIN_RAD_S = 0.012;
  const DETAIL_CORONA_SPIN_RAD_S = -0.006;

  const temporalInstall = function installStellarTemporalStability(context) {
    const controller = baseInstall(context);
    if (!controller) return controller;

    const baseUpdate = controller.update.bind(controller);
    const patchedMaterials = new WeakSet();
    const warnedMaterials = new WeakSet();

    let wasArrived = false;
    let detailCoreSpin = 0;
    let detailCoronaSpin = 0;
    let lastNow = 0;

    function patchPhotosphere() {
      const material = controller.stellarModel?.photosphere?.material;
      if (!material || patchedMaterials.has(material)) return;

      const source = material.fragmentShader;
      if (typeof source !== 'string'
          || !source.includes(STONE_B_MARKER)
          || !source.includes(MICRO_A_MARKER)
          || !source.includes(MICRO_B_MARKER)) {
        if (!warnedMaterials.has(material)) {
          console.warn('[homepage-star-temporal-stability] photosphere markers not found; keeping current shader unchanged.');
          warnedMaterials.add(material);
        }
        return;
      }

      material.fragmentShader = source
        .replace(STONE_B_MARKER, STONE_B_STABLE)
        .replace(MICRO_A_MARKER, MICRO_A_STABLE)
        .replace(MICRO_B_MARKER, MICRO_B_STABLE);
      material.needsUpdate = true;
      patchedMaterials.add(material);
    }

    function stabilizeSettledSpin(now) {
      const model = controller.stellarModel;
      const arrived = document.body.classList.contains('star-flight-arrived');
      if (!model?.photosphere || !arrived) {
        wasArrived = false;
        lastNow = now;
        return;
      }

      if (!wasArrived) {
        // Continue from the exact arrival orientation so the stabilisation is
        // visually continuous rather than snapping to a new rotation phase.
        detailCoreSpin = model.photosphere.rotation.y;
        detailCoronaSpin = model.corona?.rotation?.y || 0;
        wasArrived = true;
        lastNow = now;
      } else {
        const deltaSeconds = Math.min(0.05, Math.max(0, (now - lastNow) / 1000));
        lastNow = now;
        detailCoreSpin += deltaSeconds * DETAIL_CORE_SPIN_RAD_S;
        detailCoronaSpin += deltaSeconds * DETAIL_CORONA_SPIN_RAD_S;
      }

      model.photosphere.rotation.y = detailCoreSpin;
      if (model.corona) model.corona.rotation.y = detailCoronaSpin;
    }

    controller.update = (now, dt, elapsed) => {
      const ownsCamera = baseUpdate(now, dt, elapsed);
      patchPhotosphere();
      stabilizeSettledSpin(now);
      return ownsCamera;
    };

    return controller;
  };

  temporalInstall.__smirelStellarTemporalStability = true;
  window[INSTALL_KEY] = temporalInstall;
})();
