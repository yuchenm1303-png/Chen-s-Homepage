(() => {
  'use strict';

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function' || baseInstall.__smirelRefined) return;

  const refinedInstall = function refinedStarFlightInstall(context) {
    const controller = baseInstall(context);
    if (!controller) return controller;

    const { THREE, scene } = context;
    let refined = false;
    let starGroup = null;
    let starCore = null;
    let chromosphere = null;
    let corona = null;
    let halo = null;
    let activeObjectId = null;

    const stellarModel = {
      group: null,
      photosphere: null,
      chromosphere: null,
      corona: null,
      halo: null,
    };

    Object.defineProperty(controller, 'stellarModel', {
      configurable: true,
      get() {
        return stellarModel.group?.parent ? stellarModel : null;
      },
    });

    const noiseLibrary = `
      float hash31(vec3 p) {
        p = fract(p * 0.1031);
        p += dot(p, p.yzx + 31.32);
        return fract((p.x + p.y) * p.z);
      }
      vec3 hash33(vec3 p) {
        p = vec3(
          dot(p, vec3(127.1, 311.7, 74.7)),
          dot(p, vec3(269.5, 183.3, 246.1)),
          dot(p, vec3(113.5, 271.9, 124.6))
        );
        return fract(sin(p) * 43758.5453123);
      }
      float noise3(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float n000 = hash31(i + vec3(0,0,0));
        float n100 = hash31(i + vec3(1,0,0));
        float n010 = hash31(i + vec3(0,1,0));
        float n110 = hash31(i + vec3(1,1,0));
        float n001 = hash31(i + vec3(0,0,1));
        float n101 = hash31(i + vec3(1,0,1));
        float n011 = hash31(i + vec3(0,1,1));
        float n111 = hash31(i + vec3(1,1,1));
        float nx00 = mix(n000, n100, f.x);
        float nx10 = mix(n010, n110, f.x);
        float nx01 = mix(n001, n101, f.x);
        float nx11 = mix(n011, n111, f.x);
        return mix(mix(nx00, nx10, f.y), mix(nx01, nx11, f.y), f.z);
      }
      void cellular3(vec3 p, out float nearestDistance, out float borderDistance, out float cellSeed) {
        vec3 base = floor(p);
        vec3 local = fract(p);
        float d1 = 10.0;
        float d2 = 10.0;
        float seed = 0.0;
        for (int z = 0; z < 3; z++) {
          for (int y = 0; y < 3; y++) {
            for (int x = 0; x < 3; x++) {
              vec3 offset = vec3(float(x) - 1.0, float(y) - 1.0, float(z) - 1.0);
              vec3 lattice = base + offset;
              vec3 feature = hash33(lattice);
              vec3 delta = offset + feature - local;
              float d = dot(delta, delta);
              if (d < d1) {
                d2 = d1;
                d1 = d;
                seed = hash31(lattice + vec3(19.17, 7.31, 11.83));
              } else if (d < d2) {
                d2 = d;
              }
            }
          }
        }
        nearestDistance = sqrt(d1);
        borderDistance = sqrt(d2) - sqrt(d1);
        cellSeed = seed;
      }
    `;

    const refinedCoreFragment = `
      uniform float uTime;
      uniform float uActivity;
      uniform vec3 uBaseColor;
      varying vec3 vLocalPosition;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      ${noiseLibrary}

      void main() {
        float activity = clamp(uActivity, 0.0, 1.0);
        float phaseTime = uTime * mix(0.55, 1.0, activity);
        vec3 p = normalize(vLocalPosition);

        vec3 flow = vec3(
          noise3(p * 1.65 + vec3(phaseTime * 0.020, 3.1, 9.4)),
          noise3(p * 1.65 + vec3(7.7, -phaseTime * 0.016, 2.5)),
          noise3(p * 1.65 + vec3(4.2, 12.3, phaseTime * 0.018))
        ) - 0.5;
        vec3 q = normalize(p + flow * (0.18 + activity * 0.05));

        float cellDistance;
        float borderDistance;
        float cellSeed;
        vec3 cellularPosition = q * 6.4 + vec3(
          phaseTime * 0.022,
          -phaseTime * 0.013,
          phaseTime * 0.017
        );
        cellular3(cellularPosition, cellDistance, borderDistance, cellSeed);

        float lane = 1.0 - smoothstep(0.035, 0.145, borderDistance);
        float cellInterior = smoothstep(0.045, 0.19, borderDistance);
        float centreHeat = 1.0 - smoothstep(0.14, 0.72, cellDistance);
        float macro = noise3(q * 2.35 + vec3(phaseTime * 0.010, 6.7, -phaseTime * 0.008));
        float plasma = noise3(q * 14.0 + vec3(-phaseTime * 0.040, phaseTime * 0.026, phaseTime * 0.018));
        float granules = noise3(q * 36.0 + vec3(phaseTime * 0.083, -phaseTime * 0.047, phaseTime * 0.031));
        float cellVariation = mix(0.78, 1.18, cellSeed);
        float hotGranules = smoothstep(0.62, 0.88, granules * 0.62 + plasma * 0.38);
        float flareThread = smoothstep(0.80, 0.96, plasma)
          * smoothstep(0.42, 0.82, centreHeat)
          * (0.25 + activity * 0.75);
        float coolPatch = smoothstep(0.72, 0.91, macro)
          * (1.0 - centreHeat)
          * (0.30 + activity * 0.70);

        float heat = 0.18
          + centreHeat * 0.38
          + cellInterior * 0.15
          + macro * 0.10
          + plasma * 0.10
          + hotGranules * 0.20;
        heat *= cellVariation;
        heat *= 1.0 - lane * (0.58 + activity * 0.16);
        heat *= 1.0 - coolPatch * (0.22 + activity * 0.12);

        vec3 deepColor = uBaseColor * vec3(0.10, 0.13, 0.18);
        vec3 lowColor = uBaseColor * vec3(0.34, 0.42, 0.56);
        vec3 bodyColor = mix(uBaseColor * 0.72, uBaseColor, 0.45);
        vec3 hotColor = mix(uBaseColor, vec3(1.0, 0.91, 0.72), 0.28) * 1.08;
        vec3 whiteHot = mix(uBaseColor, vec3(1.0), 0.76) * 1.34;

        vec3 body = mix(deepColor, lowColor, smoothstep(0.06, 0.30, heat));
        body = mix(body, bodyColor, smoothstep(0.24, 0.56, heat));
        body = mix(body, hotColor, smoothstep(0.52, 0.82, heat));
        body = mix(body, whiteHot, hotGranules * (0.18 + activity * 0.22));
        body = mix(body, whiteHot * 1.08, flareThread * 0.30);
        body *= 1.0 - lane * (0.34 + activity * 0.12);

        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float facing = max(dot(normalize(vWorldNormal), viewDir), 0.0);
        float limb = pow(facing, 0.30);
        float incandescentRim = pow(1.0 - facing, 6.0);
        body *= mix(0.42, 1.0, limb);
        body += hotColor * incandescentRim * (0.055 + activity * 0.035);

        float pulse = 0.996 + (0.003 + activity * 0.004) * sin(phaseTime * 0.92);
        gl_FragColor = vec4(body * pulse, 1.0);
      }
    `;

    const refinedCoronaFragment = `
      uniform float uTime;
      uniform float uActivity;
      uniform vec3 uBaseColor;
      uniform float uStrength;
      varying vec3 vLocalPosition;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      ${noiseLibrary}
      void main() {
        float activity = clamp(uActivity, 0.0, 1.0);
        float phaseTime = uTime * mix(0.70, 1.30, activity);
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float fresnel = pow(1.0 - abs(dot(normalize(vWorldNormal), viewDir)), 3.8);
        vec3 p = normalize(vLocalPosition);
        float plume = noise3(p * 5.4 + vec3(phaseTime * 0.021, -phaseTime * 0.015, phaseTime * 0.012));
        float broken = smoothstep(0.34, 0.82, noise3(p * 11.5 + vec3(-phaseTime * 0.028, phaseTime * 0.019, 3.7)));
        float alpha = fresnel * (0.018 + plume * (0.040 + 0.035 * activity))
          * mix(0.62, 1.0, broken) * uStrength;
        vec3 color = mix(uBaseColor, vec3(0.88, 0.96, 1.0), 0.30)
          * (0.82 + plume * (0.20 + 0.10 * activity));
        gl_FragColor = vec4(color, alpha);
      }
    `;

    const chromosphereFragment = `
      uniform float uTime;
      uniform float uActivity;
      uniform vec3 uBaseColor;
      varying vec3 vLocalPosition;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      ${noiseLibrary}
      void main() {
        float activity = clamp(uActivity, 0.0, 1.0);
        float phaseTime = uTime * mix(0.72, 1.26, activity);
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float facing = max(dot(normalize(vWorldNormal), viewDir), 0.0);
        float rim = pow(1.0 - facing, 7.0);
        vec3 p = normalize(vLocalPosition);
        float mottling = noise3(p * 12.0 + vec3(phaseTime * 0.032, -phaseTime * 0.020, phaseTime * 0.025));
        float alpha = rim * (0.018 + mottling * (0.028 + 0.025 * activity));
        vec3 color = mix(uBaseColor, vec3(1.0, 0.76, 0.48), 0.18) * (0.88 + mottling * 0.16);
        gl_FragColor = vec4(color, alpha);
      }
    `;

    function makeExteriorHaloTexture(color) {
      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      const c = color.clone().lerp(new THREE.Color(0xffffff), 0.22);
      const rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;
      const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      gradient.addColorStop(0.00, `rgba(${rgb},0)`);
      gradient.addColorStop(0.31, `rgba(${rgb},0)`);
      gradient.addColorStop(0.37, `rgba(${rgb},0.025)`);
      gradient.addColorStop(0.43, `rgba(${rgb},0.15)`);
      gradient.addColorStop(0.52, `rgba(${rgb},0.085)`);
      gradient.addColorStop(0.70, `rgba(${rgb},0.030)`);
      gradient.addColorStop(1.00, `rgba(${rgb},0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      return texture;
    }

    function installExteriorHaloTexture() {
      if (!halo?.material || !starCore?.material?.uniforms?.uBaseColor) return;
      const nextMap = makeExteriorHaloTexture(starCore.material.uniforms.uBaseColor.value);
      if (!nextMap) return;
      const previousMap = halo.material.map;
      halo.material.map = nextMap;
      halo.material.needsUpdate = true;
      previousMap?.dispose?.();
    }

    function locateBaseStellarModel() {
      if (starGroup?.parent && starCore?.parent === starGroup && corona?.parent === starGroup) return true;

      let candidate = null;
      scene.traverse((object) => {
        if (candidate || !object.isGroup || object.renderOrder !== 20) return;
        const sprite = object.children.find((child) => child.isSprite) || null;
        const meshes = object.children.filter((child) => child.isMesh);
        if (!sprite || meshes.length < 2) return;
        const core = meshes.find((mesh) => (
          mesh.material?.uniforms?.uTime
          && mesh.material?.uniforms?.uBaseColor
          && !mesh.material?.uniforms?.uStrength
        )) || null;
        const coronaMesh = meshes.find((mesh) => (
          mesh.material?.uniforms?.uTime
          && mesh.material?.uniforms?.uBaseColor
          && mesh.material?.uniforms?.uStrength
        )) || null;
        if (!core || !coronaMesh) return;
        candidate = { group: object, core, corona: coronaMesh, halo: sprite };
      });

      if (!candidate) return false;
      starGroup = candidate.group;
      starCore = candidate.core;
      corona = candidate.corona;
      halo = candidate.halo;
      stellarModel.group = starGroup;
      stellarModel.photosphere = starCore;
      stellarModel.corona = corona;
      stellarModel.halo = halo;
      return true;
    }

    function refineStarOnce() {
      if (refined) return;
      if (!locateBaseStellarModel()) return;

      starCore.geometry.dispose();
      starCore.geometry = new THREE.SphereGeometry(1, 72, 48);
      starCore.material.fragmentShader = refinedCoreFragment;
      starCore.material.uniforms.uActivity = { value: 1 };
      starCore.material.transparent = false;
      starCore.material.depthWrite = false;
      starCore.material.depthTest = false;
      starCore.material.blending = THREE.NoBlending;
      starCore.material.needsUpdate = true;
      starCore.renderOrder = 30;

      corona.geometry.dispose();
      corona.geometry = new THREE.SphereGeometry(1.072, 56, 36);
      corona.material.fragmentShader = refinedCoronaFragment;
      corona.material.uniforms.uActivity = { value: 1 };
      corona.material.depthWrite = false;
      corona.material.depthTest = false;
      corona.material.blending = THREE.AdditiveBlending;
      corona.material.needsUpdate = true;
      corona.renderOrder = 32;

      const chromosphereMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uActivity: { value: 1 },
          uBaseColor: { value: starCore.material.uniforms.uBaseColor.value.clone() },
        },
        vertexShader: starCore.material.vertexShader,
        fragmentShader: chromosphereFragment,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      });
      chromosphere = new THREE.Mesh(new THREE.SphereGeometry(1.012, 56, 36), chromosphereMaterial);
      chromosphere.renderOrder = 31;
      starGroup.add(chromosphere);

      stellarModel.chromosphere = chromosphere;

      if (halo?.material) {
        halo.scale.setScalar(4.9);
        halo.material.opacity = 0.30;
        halo.renderOrder = 33;
        installExteriorHaloTexture();
      }

      refined = true;
    }

    function applyDescriptor(elapsed) {
      if (!refined || !starGroup) return;
      const active = controller.activeObject;
      const descriptor = active?.star || null;
      const radius = descriptor?.radius ?? 1;
      const activity = descriptor?.activity ?? 1;
      const coronaStrength = descriptor?.corona ?? 1;
      const haloStrength = descriptor?.halo ?? 1;

      if (active?.id !== activeObjectId) {
        activeObjectId = active?.id || null;
        if (starCore?.material?.uniforms?.uActivity) starCore.material.uniforms.uActivity.value = activity;
        if (corona?.material?.uniforms?.uActivity) corona.material.uniforms.uActivity.value = activity;
        if (chromosphere?.material?.uniforms?.uActivity) chromosphere.material.uniforms.uActivity.value = activity;
        if (chromosphere?.material?.uniforms?.uBaseColor && starCore?.material?.uniforms?.uBaseColor) {
          chromosphere.material.uniforms.uBaseColor.value.copy(starCore.material.uniforms.uBaseColor.value);
        }
        installExteriorHaloTexture();
      }

      if (chromosphere?.material?.uniforms?.uTime) {
        chromosphere.material.uniforms.uTime.value = elapsed;
      }
      if (corona?.material?.uniforms?.uStrength) {
        corona.material.uniforms.uStrength.value *= coronaStrength;
      }

      const arrived = document.body.classList.contains('star-flight-arrived');
      if (arrived) {
        starGroup.scale.setScalar(0.84 * radius);
      } else {
        starGroup.scale.setScalar(starGroup.scale.x * 0.84);
      }

      if (halo?.material) {
        const reveal = Math.min(1, Math.max(0, starGroup.scale.x / Math.max(0.84 * radius, 0.001)));
        halo.scale.setScalar(4.45 + haloStrength * 0.62);
        halo.material.opacity = (0.045 + reveal * 0.18) * (0.72 + haloStrength * 0.25);
      }
    }

    const baseUpdate = controller.update.bind(controller);
    controller.update = (now, dt, elapsed) => {
      const ownsCamera = baseUpdate(now, dt, elapsed);
      refineStarOnce();
      applyDescriptor(elapsed);
      return ownsCamera;
    };

    Object.defineProperty(controller, 'continuumIntervalMs', {
      configurable: true,
      get() {
        if (document.body.classList.contains('star-flight-arrived')) return 1000;
        if (document.body.classList.contains('star-flight-active')) return 58;
        return 30;
      },
    });

    controller.shouldRenderFrame = (now, lastCompositeMs) => {
      if (!document.body.classList.contains('star-flight-active')) return false;
      if (document.body.classList.contains('star-flight-arrived')) {
        return now - lastCompositeMs >= 1000 / 30;
      }
      return true;
    };

    return controller;
  };

  refinedInstall.__smirelRefined = true;
  window[INSTALL_KEY] = refinedInstall;
})();
