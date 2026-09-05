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
    `;

    const refinedCoreFragment = `
      uniform float uTime;
      uniform float uActivity;
      uniform vec3 uBaseColor;
      varying vec3 vLocalPosition;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      ${noiseLibrary}

      float fbmSurface(vec3 p) {
        float value = noise3(p) * 0.57;
        p = p * 2.03 + vec3(17.1, 7.2, 11.8);
        value += noise3(p) * 0.27;
        p = p * 2.07 + vec3(5.4, 19.6, 3.7);
        value += noise3(p) * 0.11;
        return value / 0.95;
      }

      void main() {
        float activity = clamp(uActivity, 0.0, 1.0);
        float phaseTime = uTime * mix(0.48, 0.92, activity);
        vec3 p = normalize(vLocalPosition);

        // A slow, three-dimensional convection field advects the finer plasma
        // detail across the sphere instead of simply scrolling one noise layer.
        vec3 flow = vec3(
          noise3(p * 1.75 + vec3(phaseTime * 0.018, 4.7, 1.3)),
          noise3(p * 1.75 + vec3(9.2, phaseTime * 0.014, 6.4)),
          noise3(p * 1.75 + vec3(2.8, 12.6, -phaseTime * 0.017))
        ) - 0.5;
        vec3 q = normalize(p + flow * (0.14 + activity * 0.045));

        float macro = fbmSurface(q * 2.55 + vec3(phaseTime * 0.016, -phaseTime * 0.010, 0.0));
        float cells = fbmSurface(q * 8.4 + vec3(-phaseTime * 0.034, phaseTime * 0.018, phaseTime * 0.012));
        float subCells = fbmSurface(q * 17.5 + vec3(phaseTime * 0.046, -phaseTime * 0.022, phaseTime * 0.017));
        float granules = noise3(q * 37.0 + vec3(-phaseTime * 0.074, phaseTime * 0.031, phaseTime * 0.052));

        // Narrow ridges through the cellular fields become the cooler seams
        // between convection cells. A second scale prevents the surface from
        // reading as one smooth marble texture at close range.
        float cellContour = 1.0 - abs(cells * 2.0 - 1.0);
        float subContour = 1.0 - abs(subCells * 2.0 - 1.0);
        float primaryLanes = smoothstep(0.885, 0.970, cellContour);
        float secondaryLanes = smoothstep(0.915, 0.985, subContour);
        float lanes = max(primaryLanes, secondaryLanes * 0.52);

        float hotGranules = smoothstep(0.60, 0.86, cells * 0.54 + granules * 0.46);
        float moltenThreads = smoothstep(0.82, 0.965, subContour)
          * smoothstep(0.56, 0.82, granules)
          * (0.45 + activity * 0.55);
        float coolPocket = smoothstep(0.70, 0.88, macro)
          * (1.0 - smoothstep(0.44, 0.66, cells));

        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float facing = max(dot(normalize(vWorldNormal), viewDir), 0.0);
        float limb = pow(facing, 0.36);
        float ignitionRim = pow(1.0 - facing, 4.2);

        vec3 deepColor = uBaseColor * vec3(0.30, 0.35, 0.44);
        vec3 midColor = mix(uBaseColor * vec3(0.84, 0.90, 0.98), vec3(1.0), 0.08);
        vec3 hotColor = mix(uBaseColor, vec3(1.0), 0.52) * 1.18;

        float thermal = 0.46
          + macro * 0.18
          + cells * 0.23
          + subCells * 0.08
          + hotGranules * 0.22
          + granules * 0.08;
        thermal *= 1.0 - lanes * (0.18 + activity * 0.10);
        thermal *= 1.0 - coolPocket * (0.27 + activity * 0.16);

        vec3 body = mix(deepColor, midColor, smoothstep(0.38, 0.78, thermal));
        body = mix(body, hotColor, hotGranules * (0.30 + activity * 0.18));
        body = mix(body, hotColor * 1.08, moltenThreads * 0.24);
        body *= 1.0 - lanes * (0.10 + activity * 0.08);
        body *= mix(0.52, 1.02, limb);

        // The photosphere itself owns a thin incandescent edge; the existing
        // chromosphere and corona remain responsible for the larger atmosphere.
        body += hotColor * ignitionRim * (0.13 + activity * 0.10);

        float emission = 0.80
          + thermal * 0.18
          + hotGranules * 0.18
          + moltenThreads * 0.12;
        emission *= 0.994 + (0.004 + 0.006 * activity) * sin(phaseTime * 1.08);
        gl_FragColor = vec4(body * emission, 1.0);
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
        float phaseTime = uTime * mix(0.70, 1.30, clamp(uActivity, 0.0, 1.0));
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float fresnel = pow(1.0 - abs(dot(normalize(vWorldNormal), viewDir)), 2.8);
        vec3 p = normalize(vLocalPosition);
        float plume = noise3(p * 6.2 + vec3(phaseTime * 0.022, -phaseTime * 0.017, phaseTime * 0.013));
        float alpha = fresnel * (0.030 + plume * (0.055 + 0.050 * uActivity)) * uStrength;
        vec3 color = mix(uBaseColor, vec3(0.82, 0.93, 1.0), 0.36) * (0.88 + plume * (0.24 + 0.12 * uActivity));
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
        float phaseTime = uTime * mix(0.72, 1.26, clamp(uActivity, 0.0, 1.0));
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float rim = pow(1.0 - max(dot(normalize(vWorldNormal), viewDir), 0.0), 4.0);
        vec3 p = normalize(vLocalPosition);
        float mottling = noise3(p * 10.0 + vec3(phaseTime * 0.035, -phaseTime * 0.018, phaseTime * 0.026));
        float alpha = rim * (0.025 + mottling * (0.035 + 0.035 * uActivity));
        vec3 color = mix(uBaseColor, vec3(1.0, 0.76, 0.56), 0.24) * (0.88 + mottling * 0.20);
        gl_FragColor = vec4(color, alpha);
      }
    `;

    function refineStarOnce() {
      if (refined) return;

      let core = null;
      let coronaMesh = null;
      scene.traverse((object) => {
        const fragment = object.material?.fragmentShader || '';
        if (!core && fragment.includes('float hot = smoothstep(0.40, 0.86')) core = object;
        if (!coronaMesh && fragment.includes('float fresnel = pow(1.0 - abs(dot')) coronaMesh = object;
      });
      if (!core || !coronaMesh || !core.parent || core.parent !== coronaMesh.parent) return;

      starCore = core;
      corona = coronaMesh;
      starGroup = core.parent;
      halo = starGroup.children.find((child) => child.isSprite) || null;

      starCore.geometry.dispose();
      starCore.geometry = new THREE.SphereGeometry(1, 64, 40);
      starCore.material.fragmentShader = refinedCoreFragment;
      starCore.material.uniforms.uActivity = { value: 1 };
      starCore.material.transparent = true;
      starCore.material.depthWrite = false;
      starCore.material.depthTest = false;
      starCore.material.blending = THREE.NoBlending;
      starCore.material.needsUpdate = true;
      starCore.renderOrder = 30;

      corona.geometry.dispose();
      corona.geometry = new THREE.SphereGeometry(1.105, 48, 30);
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
      chromosphere = new THREE.Mesh(new THREE.SphereGeometry(1.018, 48, 30), chromosphereMaterial);
      chromosphere.renderOrder = 31;
      starGroup.add(chromosphere);

      if (halo?.material) {
        halo.scale.setScalar(4.8);
        halo.material.opacity = 0.36;
        halo.renderOrder = 33;
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
        halo.scale.setScalar(4.35 + haloStrength * 0.72);
        halo.material.opacity = (0.085 + reveal * 0.23) * (0.76 + haloStrength * 0.28);
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
