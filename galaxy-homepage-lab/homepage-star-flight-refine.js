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
      uniform vec3 uBaseColor;
      varying vec3 vLocalPosition;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      ${noiseLibrary}
      void main() {
        vec3 p = normalize(vLocalPosition);
        float convection = noise3(p * 4.2 + vec3(uTime * 0.030, -uTime * 0.019, uTime * 0.013));
        float cells = noise3(p * 13.5 + vec3(-uTime * 0.058, uTime * 0.026, uTime * 0.021));
        float granules = noise3(p * 27.0 + vec3(uTime * 0.082, uTime * 0.021, -uTime * 0.044));

        float cellEdge = 1.0 - abs(cells * 2.0 - 1.0);
        float lanes = smoothstep(0.70, 0.94, cellEdge);
        float brightGranules = smoothstep(0.56, 0.88, granules);
        float latitudeFlow = 0.5 + 0.5 * sin((p.y + convection * 0.11) * 15.0 + uTime * 0.16);
        float broadSpot = smoothstep(0.70, 0.88, convection)
          * (1.0 - smoothstep(0.48, 0.66, cells));

        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float facing = max(dot(normalize(vWorldNormal), viewDir), 0.0);
        float limb = pow(facing, 0.42);

        vec3 deep = uBaseColor * vec3(0.50, 0.56, 0.68);
        vec3 photosphere = uBaseColor * vec3(0.92, 0.96, 1.00);
        vec3 granuleColor = mix(uBaseColor, vec3(1.0, 0.91, 0.74), 0.30);

        float surface = 0.72 + convection * 0.20 + latitudeFlow * 0.08 + brightGranules * 0.14;
        surface *= 1.0 - lanes * 0.13;
        surface *= 1.0 - broadSpot * 0.38;

        vec3 body = mix(deep, photosphere, clamp(surface, 0.0, 1.0));
        body = mix(body, granuleColor, brightGranules * 0.22);
        body *= mix(0.55, 1.02, limb);

        float emission = 0.78 + brightGranules * 0.22 + convection * 0.10;
        emission *= 0.985 + 0.015 * sin(uTime * 1.1);
        gl_FragColor = vec4(body * emission, 1.0);
      }
    `;

    const refinedCoronaFragment = `
      uniform float uTime;
      uniform vec3 uBaseColor;
      uniform float uStrength;
      varying vec3 vLocalPosition;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      ${noiseLibrary}
      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float fresnel = pow(1.0 - abs(dot(normalize(vWorldNormal), viewDir)), 2.8);
        vec3 p = normalize(vLocalPosition);
        float plume = noise3(p * 6.2 + vec3(uTime * 0.022, -uTime * 0.017, uTime * 0.013));
        float alpha = fresnel * (0.035 + plume * 0.085) * uStrength;
        vec3 color = mix(uBaseColor, vec3(0.82, 0.93, 1.0), 0.36) * (0.88 + plume * 0.32);
        gl_FragColor = vec4(color, alpha);
      }
    `;

    const chromosphereFragment = `
      uniform float uTime;
      uniform vec3 uBaseColor;
      varying vec3 vLocalPosition;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      ${noiseLibrary}
      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float rim = pow(1.0 - max(dot(normalize(vWorldNormal), viewDir), 0.0), 4.0);
        vec3 p = normalize(vLocalPosition);
        float mottling = noise3(p * 10.0 + vec3(uTime * 0.035, -uTime * 0.018, uTime * 0.026));
        float alpha = rim * (0.030 + mottling * 0.050);
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
      starCore.material.transparent = true;
      starCore.material.depthWrite = false;
      starCore.material.depthTest = false;
      starCore.material.blending = THREE.NoBlending;
      starCore.material.needsUpdate = true;
      starCore.renderOrder = 30;

      corona.geometry.dispose();
      corona.geometry = new THREE.SphereGeometry(1.105, 48, 30);
      corona.material.fragmentShader = refinedCoronaFragment;
      corona.material.depthWrite = false;
      corona.material.depthTest = false;
      corona.material.blending = THREE.AdditiveBlending;
      corona.material.needsUpdate = true;
      corona.renderOrder = 32;

      const chromosphereMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
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

    const baseUpdate = controller.update.bind(controller);
    controller.update = (now, dt, elapsed) => {
      const ownsCamera = baseUpdate(now, dt, elapsed);
      refineStarOnce();

      if (refined && starGroup) {
        const arrived = document.body.classList.contains('star-flight-arrived');
        if (arrived) {
          starGroup.scale.setScalar(0.84);
        } else {
          starGroup.scale.setScalar(starGroup.scale.x * 0.84);
        }
        if (chromosphere?.material?.uniforms?.uTime) {
          chromosphere.material.uniforms.uTime.value = elapsed;
        }
        if (halo?.material) {
          const reveal = Math.min(1, Math.max(0, starGroup.scale.x / 0.84));
          halo.material.opacity = 0.10 + reveal * 0.24;
        }
      }
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
