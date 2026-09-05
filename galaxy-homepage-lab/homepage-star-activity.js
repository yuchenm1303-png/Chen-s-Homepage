(() => {
  'use strict';

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function' || baseInstall.__smirelStellarActivity) return;

  const ACTIVITY_PARTICLE_COUNT = 224;
  const PARTICLE_SEED = 0x53544152;

  function seededRandom(seed) {
    let state = seed >>> 0;
    return () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  const activityInstall = function installStellarActivity(context) {
    const controller = baseInstall(context);
    if (!controller) return controller;

    const { THREE } = context || {};
    if (!THREE) return controller;

    let activityPoints = null;
    let boundGroup = null;
    let activeObjectId = null;

    const randomUnit = (random) => {
      const z = random() * 2 - 1;
      const angle = random() * Math.PI * 2;
      const radius = Math.sqrt(Math.max(0, 1 - z * z));
      return new THREE.Vector3(
        Math.cos(angle) * radius,
        z,
        Math.sin(angle) * radius,
      );
    };

    function disposeLayer() {
      if (!activityPoints) return;
      activityPoints.parent?.remove(activityPoints);
      activityPoints.geometry?.dispose?.();
      activityPoints.material?.dispose?.();
      activityPoints = null;
      boundGroup = null;
    }

    function createLayer(model) {
      if (!model?.group || !model?.photosphere) return null;

      const random = seededRandom(PARTICLE_SEED);
      const anchors = Array.from({ length: 9 }, () => randomUnit(random));
      const positions = new Float32Array(ACTIVITY_PARTICLE_COUNT * 3);
      const tangents = new Float32Array(ACTIVITY_PARTICLE_COUNT * 3);
      const phases = new Float32Array(ACTIVITY_PARTICLE_COUNT);
      const speeds = new Float32Array(ACTIVITY_PARTICLE_COUNT);
      const lengths = new Float32Array(ACTIVITY_PARTICLE_COUNT);
      const sizes = new Float32Array(ACTIVITY_PARTICLE_COUNT);
      const energies = new Float32Array(ACTIVITY_PARTICLE_COUNT);

      for (let i = 0; i < ACTIVITY_PARTICLE_COUNT; i += 1) {
        const anchor = anchors[i % anchors.length];
        const direction = anchor.clone()
          .add(randomUnit(random).multiplyScalar(0.12 + random() * 0.30))
          .normalize();

        const tangent = randomUnit(random);
        tangent.addScaledVector(direction, -tangent.dot(direction));
        if (tangent.lengthSq() < 0.0001) tangent.set(direction.y, -direction.x, direction.z * 0.1);
        tangent.normalize();

        positions[i * 3] = direction.x;
        positions[i * 3 + 1] = direction.y;
        positions[i * 3 + 2] = direction.z;
        tangents[i * 3] = tangent.x;
        tangents[i * 3 + 1] = tangent.y;
        tangents[i * 3 + 2] = tangent.z;
        phases[i] = random();
        speeds[i] = 0.034 + random() * 0.055;
        lengths[i] = 0.055 + Math.pow(random(), 1.8) * 0.19;
        sizes[i] = 1.45 + Math.pow(random(), 1.65) * 3.2;
        energies[i] = 0.24 + Math.pow(random(), 0.78) * 0.76;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('aTangent', new THREE.BufferAttribute(tangents, 3));
      geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
      geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
      geometry.setAttribute('aLength', new THREE.BufferAttribute(lengths, 1));
      geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
      geometry.setAttribute('aEnergy', new THREE.BufferAttribute(energies, 1));

      const material = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uActivity: { value: 1 },
          uStrength: { value: 1 },
          uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
          uBaseColor: {
            value: model.photosphere.material?.uniforms?.uBaseColor?.value?.clone?.()
              || new THREE.Color(0xffffff),
          },
        },
        vertexShader: `
          uniform float uTime;
          uniform float uActivity;
          uniform float uPixelRatio;
          attribute vec3 aTangent;
          attribute float aPhase;
          attribute float aSpeed;
          attribute float aLength;
          attribute float aSize;
          attribute float aEnergy;
          varying float vAlpha;
          varying float vHeat;
          varying float vFacing;

          void main() {
            float activity = clamp(uActivity, 0.0, 1.0);
            float cycle = fract(aPhase + uTime * aSpeed * (0.72 + activity * 0.72));
            float riseIn = smoothstep(0.0, 0.12, cycle);
            float fadeOut = 1.0 - smoothstep(0.62, 1.0, cycle);
            float envelope = riseIn * fadeOut;
            float arc = sin(3.14159265 * cycle);

            vec3 direction = normalize(position);
            float radial = 1.018 + cycle * aLength * (0.72 + activity * 0.62);
            vec3 displaced = direction * radial
              + aTangent * arc * arc * aLength * (0.16 + activity * 0.24);

            vec4 worldPosition = modelMatrix * vec4(displaced, 1.0);
            vec3 worldDirection = normalize(mat3(modelMatrix) * direction);
            vec3 viewDirection = normalize(cameraPosition - worldPosition.xyz);
            float facing = dot(worldDirection, viewDirection);

            vec4 mvPosition = viewMatrix * worldPosition;
            float objectScale = max(length(modelMatrix[0].xyz), 0.05);
            float perspective = clamp(2.8 / max(-mvPosition.z, 0.45), 0.52, 2.35);
            gl_PointSize = max(
              1.0,
              aSize * uPixelRatio * sqrt(objectScale) * perspective * (0.72 + activity * 0.62)
            );
            gl_Position = projectionMatrix * mvPosition;

            vAlpha = envelope * (0.30 + aEnergy * 0.70) * (0.42 + activity * 0.58);
            vHeat = aEnergy * (0.72 + (1.0 - cycle) * 0.28);
            vFacing = smoothstep(-0.12, 0.22, facing);
          }
        `,
        fragmentShader: `
          uniform vec3 uBaseColor;
          uniform float uStrength;
          varying float vAlpha;
          varying float vHeat;
          varying float vFacing;

          void main() {
            vec2 centered = gl_PointCoord - 0.5;
            float radius = length(centered);
            if (radius > 0.5) discard;

            float soft = 1.0 - smoothstep(0.08, 0.50, radius);
            float core = 1.0 - smoothstep(0.0, 0.24, radius);
            float alpha = soft * vAlpha * vFacing * uStrength;
            if (alpha <= 0.001) discard;

            vec3 warm = mix(uBaseColor, vec3(1.0, 0.88, 0.68), 0.34 + vHeat * 0.34);
            vec3 color = warm * (1.12 + vHeat * 0.72 + core * vHeat * 1.45);
            gl_FragColor = vec4(color, alpha);
          }
        `,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      });

      const points = new THREE.Points(geometry, material);
      points.name = 'smirel-stellar-activity';
      points.frustumCulled = false;
      points.renderOrder = 34;
      model.group.add(points);
      model.activity = points;
      return points;
    }

    function ensureLayer() {
      const model = controller.stellarModel;
      if (!model?.group || !model?.photosphere) return null;
      if (activityPoints && boundGroup === model.group && activityPoints.parent === model.group) return activityPoints;

      disposeLayer();
      boundGroup = model.group;
      activityPoints = createLayer(model);
      return activityPoints;
    }

    function syncLayer(elapsed) {
      const points = ensureLayer();
      if (!points?.material?.uniforms) return;

      const model = controller.stellarModel;
      const descriptor = controller.activeObject?.star || null;
      const activity = descriptor?.activity ?? 1;
      const coronaStrength = descriptor?.corona ?? 1;
      const currentObjectId = controller.activeObject?.id || null;
      const uniforms = points.material.uniforms;

      uniforms.uTime.value = elapsed;
      uniforms.uActivity.value = activity;
      uniforms.uStrength.value = (0.30 + activity * 0.54) * (0.80 + coronaStrength * 0.20);
      uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio || 1, 2);

      if (currentObjectId !== activeObjectId) {
        activeObjectId = currentObjectId;
        const sourceColor = model?.photosphere?.material?.uniforms?.uBaseColor?.value;
        if (sourceColor && uniforms.uBaseColor?.value?.copy) uniforms.uBaseColor.value.copy(sourceColor);
      }
    }

    const baseUpdate = controller.update.bind(controller);
    controller.update = (now, dt, elapsed) => {
      const ownsCamera = baseUpdate(now, dt, elapsed);
      syncLayer(elapsed);
      return ownsCamera;
    };

    return controller;
  };

  activityInstall.__smirelStellarActivity = true;
  window[INSTALL_KEY] = activityInstall;
})();