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
      float fbm3(vec3 p) {
        float value = noise3(p) * 0.55;
        p = p * 2.07 + vec3(13.1, 7.7, 3.9);
        value += noise3(p) * 0.28;
        p = p * 2.11 + vec3(5.3, 17.2, 11.6);
        value += noise3(p) * 0.12;
        return value / 0.95;
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
        float phaseTime = uTime * mix(0.62, 1.02, activity);
        vec3 p = normalize(vLocalPosition);

        // Stellaris-style surface construction: the large-scale field stays
        // continuous. Several smooth noise octaves are phase-animated into a
        // molten mask; no Voronoi borders are exposed to the image.
        vec3 flow = vec3(
          noise3(p * 1.35 + vec3(phaseTime * 0.011, 5.2, 1.7)),
          noise3(p * 1.35 + vec3(8.4, -phaseTime * 0.009, 3.6)),
          noise3(p * 1.35 + vec3(2.9, 11.1, phaseTime * 0.010))
        ) - 0.5;
        vec3 q = normalize(p + flow * (0.105 + activity * 0.035));

        float noise1 = noise3(q * 2.2 + vec3(phaseTime * 0.006, 0.0, 3.4)) - 0.5;
        float noise2 = noise3(q * 8.8 + vec3(-phaseTime * 0.018, phaseTime * 0.012, 9.1)) - 0.5;
        float noise3Fine = noise3(q * 17.6 + vec3(4.7, -phaseTime * 0.029, phaseTime * 0.021)) - 0.5;
        float field = noise1 + noise2 * 0.72 + noise3Fine * 0.38;

        float animatedNoise = sin((field + phaseTime * 0.064) * 9.6);
        float invertedHeat = clamp((1.0 - animatedNoise) * 0.5, 0.0, 1.0);
        float lavaMask = pow(max(-animatedNoise, 0.0), 2.0);

        // Emulate Stellaris' separate lava / heated-stone textures with two
        // procedural detail bands. The fine band breaks up the broad plasma
        // field without turning it into a visible geometric cell network.
        float broadThermal = fbm3(q * 3.0 + vec3(phaseTime * 0.008, 7.3, -phaseTime * 0.006));
        float stoneA = noise3(q * 24.0 + vec3(-phaseTime * 0.038, phaseTime * 0.022, 13.0));
        float stoneB = noise3(q * 49.0 + vec3(phaseTime * 0.074, -phaseTime * 0.051, phaseTime * 0.033));
        float stoneTexture = 0.66 + stoneA * 0.21 + stoneB * 0.13;
        float lavaTexture = 0.72 + noise3(q * 31.0 + vec3(phaseTime * 0.052, 3.2, -phaseTime * 0.041)) * 0.28;

        float stoneHeat = smoothstep(0.10, 0.92, invertedHeat * 0.82 + broadThermal * 0.18);
        float hotIslands = smoothstep(0.38, 0.88, lavaMask * (0.72 + stoneA * 0.28));
        float whiteHotIslands = smoothstep(0.70, 0.98, lavaMask * (0.66 + stoneB * 0.34));
        float coolVeil = smoothstep(0.70, 0.93, broadThermal)
          * smoothstep(0.10, 0.82, animatedNoise * 0.5 + 0.5);

        vec3 coldColor = uBaseColor * vec3(0.12, 0.16, 0.24);
        vec3 hotStoneColor = uBaseColor * vec3(0.54, 0.66, 0.84);
        vec3 brightColor = mix(uBaseColor, vec3(1.0, 0.89, 0.70), 0.22) * 1.18;
        vec3 whiteHotColor = mix(uBaseColor, vec3(1.0), 0.70) * 1.38;

        vec3 heatedStone = mix(coldColor, hotStoneColor, stoneHeat);
        heatedStone *= stoneTexture;
        heatedStone += hotStoneColor * pow(invertedHeat, 2.2) * (0.10 + activity * 0.06);

        vec3 lava = brightColor
          * lavaTexture
          * pow(lavaMask, 0.62)
          * (0.66 + activity * 0.28);

        vec3 body = heatedStone + lava;
        body = mix(body, whiteHotColor, hotIslands * (0.10 + activity * 0.12));
        body += whiteHotColor * whiteHotIslands * (0.08 + activity * 0.10);
        body *= 1.0 - coolVeil * (0.10 + activity * 0.06);

        // Fine granulation remains subordinate to the molten field, so the
        // surface reads as turbulent plasma rather than cracked polygons.
        float microGranulation = noise3(q * 72.0 + vec3(-phaseTime * 0.11, phaseTime * 0.067, 5.9));
        body *= 0.94 + microGranulation * (0.07 + activity * 0.025);

        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float facing = max(dot(normalize(vWorldNormal), viewDir), 0.0);
        float limb = pow(facing, 0.30);
        float incandescentRim = pow(1.0 - facing, 6.0);
        body *= mix(0.44, 1.0, limb);
        body += brightColor * incandescentRim * (0.045 + activity * 0.030);

        float pulse = 0.996 + (0.003 + activity * 0.004) * sin(phaseTime * 0.88);
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
