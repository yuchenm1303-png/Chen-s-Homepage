(() => {
  'use strict';

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  if (window[INSTALL_KEY]) return;

  window[INSTALL_KEY] = function installStarFlight(context) {
    const {
      THREE,
      scene,
      camera,
      brightField,
      CONFIG,
      canvas,
      pointer,
      reducedMotion,
    } = context || {};

    if (!THREE || !scene || !camera || !brightField?.geometry || !canvas || !CONFIG) {
      console.warn('[homepage-star-flight] renderer context unavailable');
      return null;
    }

    const positions = brightField.geometry.getAttribute('position');
    const brightness = brightField.geometry.getAttribute('starBrightness');
    const colors = brightField.geometry.getAttribute('starColor');
    const opacity = brightField.geometry.getAttribute('starOpacity');
    if (!positions || !brightness || !colors || !opacity) {
      console.warn('[homepage-star-flight] bright-star attributes unavailable');
      return null;
    }

    const FLIGHT_DURATION_MS = reducedMotion ? 1100 : 4200;
    const RETURN_DURATION_MS = reducedMotion ? 700 : 2200;
    const APPROACH_DISTANCE = 3.2;
    const FINAL_FOV = 47;

    const state = {
      mode: 'idle',
      anchorIndex: -1,
      anchorPosition: new THREE.Vector3(),
      anchorColor: new THREE.Color(0xcfeeff),
      originalOpacity: 1,
      startedAt: 0,
      duration: FLIGHT_DURATION_MS,
      homePosition: new THREE.Vector3(),
      homeQuaternion: new THREE.Quaternion(),
      homeFov: CONFIG.fov,
      homePointer: { targetX: 0, targetY: 0, currentX: 0, currentY: 0 },
      pathStart: new THREE.Vector3(),
      pathEnd: new THREE.Vector3(),
      controlA: new THREE.Vector3(),
      controlB: new THREE.Vector3(),
      startLook: new THREE.Vector3(),
      returnStartPosition: new THREE.Vector3(),
      returnStartQuaternion: new THREE.Quaternion(),
      returnStartFov: CONFIG.fov,
      starScale: 0.001,
    };

    const scratch = {
      projected: new THREE.Vector3(),
      world: new THREE.Vector3(),
      forward: new THREE.Vector3(),
      travel: new THREE.Vector3(),
      side: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
      look: new THREE.Vector3(),
    };

    const style = document.createElement('style');
    style.dataset.smirelStarFlight = 'true';
    style.textContent = `
      .smirel-star-anchor {
        position: fixed;
        left: 0;
        top: 0;
        z-index: 8;
        width: 58px;
        height: 58px;
        margin: -29px 0 0 -29px;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background: transparent;
        color: rgba(235,248,255,.92);
        cursor: pointer;
        pointer-events: auto;
        opacity: 0;
        transition: opacity .35s ease;
      }
      .smirel-star-anchor::before {
        content: '';
        position: absolute;
        inset: 13px;
        border: 1px solid rgba(193,229,255,.34);
        border-radius: inherit;
        box-shadow: 0 0 18px rgba(133,204,255,.12), inset 0 0 10px rgba(210,239,255,.08);
        transform: scale(.72);
        transition: transform .3s cubic-bezier(.2,.8,.2,1), border-color .3s ease, box-shadow .3s ease;
      }
      .smirel-star-anchor::after {
        content: '';
        position: absolute;
        left: 50%;
        top: 50%;
        width: 3px;
        height: 3px;
        margin: -1.5px 0 0 -1.5px;
        border-radius: 50%;
        background: rgba(245,252,255,.92);
        box-shadow: 0 0 9px rgba(158,218,255,.9);
      }
      .smirel-star-anchor:hover::before,
      .smirel-star-anchor:focus-visible::before {
        transform: scale(1);
        border-color: rgba(216,240,255,.76);
        box-shadow: 0 0 25px rgba(133,204,255,.26), inset 0 0 13px rgba(220,244,255,.12);
      }
      .smirel-star-anchor__label {
        position: absolute;
        left: 52px;
        top: 21px;
        font: 600 9px/1 ui-sans-serif, system-ui, sans-serif;
        letter-spacing: .16em;
        text-transform: uppercase;
        white-space: nowrap;
        opacity: 0;
        transform: translateX(-5px);
        transition: opacity .25s ease, transform .25s ease;
        text-shadow: 0 1px 10px #000;
      }
      .smirel-star-anchor:hover .smirel-star-anchor__label,
      .smirel-star-anchor:focus-visible .smirel-star-anchor__label {
        opacity: .82;
        transform: translateX(0);
      }
      .smirel-star-back {
        position: fixed;
        right: 28px;
        top: 24px;
        z-index: 10;
        border: 1px solid rgba(255,255,255,.14);
        border-radius: 999px;
        padding: 8px 12px;
        color: rgba(255,255,255,.68);
        background: rgba(0,0,0,.26);
        -webkit-backdrop-filter: blur(12px);
        backdrop-filter: blur(12px);
        font: 600 9px/1 ui-sans-serif, system-ui, sans-serif;
        letter-spacing: .14em;
        text-transform: uppercase;
        cursor: pointer;
        opacity: 0;
        pointer-events: none;
        transform: translateY(-6px);
        transition: opacity .35s ease, transform .35s ease, border-color .25s ease, color .25s ease;
      }
      .smirel-star-back:hover { border-color: rgba(255,255,255,.28); color: rgba(255,255,255,.9); }
      body.star-flight-active .home-overlay {
        opacity: 0;
        pointer-events: none;
      }
      body.star-flight-active .home-overlay {
        transition: opacity .7s cubic-bezier(.22,.61,.36,1);
      }
      body.star-flight-active .smirel-star-anchor { opacity: 0 !important; pointer-events: none; }
      body.star-flight-arrived .smirel-star-back {
        opacity: 1;
        pointer-events: auto;
        transform: translateY(0);
      }
      @media (max-width: 760px) {
        .smirel-star-back { right: 14px; top: 14px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .smirel-star-anchor,
        .smirel-star-anchor::before,
        .smirel-star-back,
        .home-overlay { transition-duration: .01ms !important; }
      }
    `;
    document.head.appendChild(style);

    const anchorButton = document.createElement('button');
    anchorButton.type = 'button';
    anchorButton.className = 'smirel-star-anchor';
    anchorButton.setAttribute('aria-label', 'Open Loom test star');
    anchorButton.innerHTML = '<span class="smirel-star-anchor__label">Loom · Test star</span>';
    document.body.appendChild(anchorButton);

    const backButton = document.createElement('button');
    backButton.type = 'button';
    backButton.className = 'smirel-star-back';
    backButton.textContent = 'Esc · Back to galaxy';
    document.body.appendChild(backButton);

    function smoothstep01(value) {
      const t = THREE.MathUtils.clamp(value, 0, 1);
      return t * t * (3 - 2 * t);
    }

    function smootherstep01(value) {
      const t = THREE.MathUtils.clamp(value, 0, 1);
      return t * t * t * (t * (t * 6 - 15) + 10);
    }

    function cubicBezier(out, a, b, c, d, t) {
      const mt = 1 - t;
      out.set(0, 0, 0)
        .addScaledVector(a, mt * mt * mt)
        .addScaledVector(b, 3 * mt * mt * t)
        .addScaledVector(c, 3 * mt * t * t)
        .addScaledVector(d, t * t * t);
      return out;
    }

    function pointInsideExpandedRect(x, y, rect, margin) {
      if (!rect) return false;
      return x >= rect.left - margin && x <= rect.right + margin
        && y >= rect.top - margin && y <= rect.bottom + margin;
    }

    function chooseAnchor() {
      if (state.anchorIndex >= 0 || camera.aspect <= 0) return;

      const introRect = document.querySelector('.home-intro')?.getBoundingClientRect() || null;
      const projectsRect = document.querySelector('.home-projects')?.getBoundingClientRect() || null;
      const viewportWidth = Math.max(window.innerWidth, 1);
      const viewportHeight = Math.max(window.innerHeight, 1);
      const targetNdcX = 0.12;
      const targetNdcY = 0.46;

      let bestIndex = -1;
      let bestScore = -Infinity;
      const passes = [3.0, 2.35, 1.7];

      for (const minBrightness of passes) {
        for (let i = 0; i < positions.count; i += 1) {
          const b = brightness.getX(i);
          if (b < minBrightness) continue;

          scratch.world.fromBufferAttribute(positions, i);
          const depth = -scratch.world.z;
          if (depth < 13 || depth > 38) continue;

          scratch.projected.copy(scratch.world).project(camera);
          if (scratch.projected.z < -1 || scratch.projected.z > 1) continue;
          if (Math.abs(scratch.projected.x) > 0.82 || Math.abs(scratch.projected.y) > 0.80) continue;

          const screenX = (scratch.projected.x * 0.5 + 0.5) * viewportWidth;
          const screenY = (-scratch.projected.y * 0.5 + 0.5) * viewportHeight;
          if (pointInsideExpandedRect(screenX, screenY, introRect, 46)) continue;
          if (pointInsideExpandedRect(screenX, screenY, projectsRect, 54)) continue;

          const dx = scratch.projected.x - targetNdcX;
          const dy = scratch.projected.y - targetNdcY;
          const centrePenalty = Math.sqrt(dx * dx + dy * dy);
          const score = b * 0.38 - centrePenalty * 3.2 + Math.min(depth, 30) * 0.012;
          if (score > bestScore) {
            bestScore = score;
            bestIndex = i;
          }
        }
        if (bestIndex >= 0) break;
      }

      if (bestIndex < 0) return;
      state.anchorIndex = bestIndex;
      state.anchorPosition.fromBufferAttribute(positions, bestIndex);
      state.anchorColor.setRGB(
        colors.getX(bestIndex),
        colors.getY(bestIndex),
        colors.getZ(bestIndex),
      );
      state.originalOpacity = opacity.getX(bestIndex);
      buildStar();
      updateAnchorButton();
    }

    let starGroup = null;
    let starCore = null;
    let corona = null;
    let halo = null;
    let coreMaterial = null;
    let coronaMaterial = null;

    function makeHaloTexture(color) {
      const size = 256;
      const haloCanvas = document.createElement('canvas');
      haloCanvas.width = size;
      haloCanvas.height = size;
      const ctx = haloCanvas.getContext('2d');
      const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      const c = color.clone().lerp(new THREE.Color(0xffffff), 0.34);
      gradient.addColorStop(0, `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},.38)`);
      gradient.addColorStop(0.16, `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},.18)`);
      gradient.addColorStop(0.48, `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},.055)`);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
      const texture = new THREE.CanvasTexture(haloCanvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      return texture;
    }

    function buildStar() {
      if (starGroup || state.anchorIndex < 0) return;

      const coreVertex = `
        varying vec3 vLocalPosition;
        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;
        void main() {
          vLocalPosition = position;
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `;

      const noiseLibrary = `
        float hash31(vec3 p) {
          p = fract(p * 0.1031);
          p += dot(p, p.yzx + 33.33);
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
          float value = 0.0;
          float amplitude = 0.54;
          for (int i = 0; i < 4; i++) {
            value += noise3(p) * amplitude;
            p = p * 2.03 + vec3(17.1, 9.2, 5.7);
            amplitude *= 0.5;
          }
          return value;
        }
      `;

      const coreFragment = `
        uniform float uTime;
        uniform vec3 uBaseColor;
        varying vec3 vLocalPosition;
        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;
        ${noiseLibrary}
        void main() {
          vec3 p = normalize(vLocalPosition);
          float slow = fbm3(p * 3.1 + vec3(uTime * 0.045, -uTime * 0.028, uTime * 0.018));
          float cells = fbm3(p * 13.0 + vec3(-uTime * 0.12, uTime * 0.055, uTime * 0.035));
          float filaments = fbm3(p * 25.0 + vec3(uTime * 0.09, uTime * 0.025, -uTime * 0.06));
          float hot = smoothstep(0.40, 0.86, cells * 0.62 + filaments * 0.38);
          float spotNoise = fbm3(p * 2.0 + vec3(8.0, 3.0, uTime * 0.012));
          float spots = smoothstep(0.69, 0.84, spotNoise) * smoothstep(0.34, 0.64, slow);
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);
          float facing = max(dot(normalize(vWorldNormal), viewDir), 0.0);
          float limb = pow(facing, 0.34);
          vec3 deep = uBaseColor * vec3(0.46, 0.50, 0.58);
          vec3 body = mix(deep, uBaseColor * 1.34, 0.34 + slow * 0.54);
          body = mix(body, vec3(1.0, 0.965, 0.89) * 2.05, hot * 0.72);
          body *= 1.0 - spots * 0.42;
          body *= mix(0.68, 1.20, limb);
          float pulse = 0.97 + 0.03 * sin(uTime * 1.3);
          gl_FragColor = vec4(body * (1.58 + hot * 0.48) * pulse, 1.0);
        }
      `;

      const coronaFragment = `
        uniform float uTime;
        uniform vec3 uBaseColor;
        uniform float uStrength;
        varying vec3 vLocalPosition;
        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;
        ${noiseLibrary}
        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);
          float fresnel = pow(1.0 - abs(dot(normalize(vWorldNormal), viewDir)), 2.25);
          vec3 p = normalize(vLocalPosition);
          float plume = fbm3(p * 5.5 + vec3(uTime * 0.035, -uTime * 0.025, uTime * 0.018));
          float alpha = fresnel * (0.19 + plume * 0.25) * uStrength;
          vec3 color = mix(uBaseColor, vec3(0.93, 0.98, 1.0), 0.34) * (1.65 + plume * 0.72);
          gl_FragColor = vec4(color, alpha);
        }
      `;

      coreMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uBaseColor: { value: state.anchorColor.clone().lerp(new THREE.Color(0xf7fbff), 0.18) },
        },
        vertexShader: coreVertex,
        fragmentShader: coreFragment,
        toneMapped: false,
      });

      coronaMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uBaseColor: { value: state.anchorColor.clone().lerp(new THREE.Color(0xffffff), 0.28) },
          uStrength: { value: 1 },
        },
        vertexShader: coreVertex,
        fragmentShader: coronaFragment,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        side: THREE.FrontSide,
        toneMapped: false,
      });

      starGroup = new THREE.Group();
      starGroup.position.copy(state.anchorPosition);
      starGroup.scale.setScalar(0.001);
      starGroup.visible = false;
      starGroup.renderOrder = 20;

      starCore = new THREE.Mesh(new THREE.SphereGeometry(1, 72, 48), coreMaterial);
      corona = new THREE.Mesh(new THREE.SphereGeometry(1.09, 64, 40), coronaMaterial);

      const haloMaterial = new THREE.SpriteMaterial({
        map: makeHaloTexture(state.anchorColor),
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        opacity: 0.72,
      });
      halo = new THREE.Sprite(haloMaterial);
      halo.scale.setScalar(5.4);
      halo.renderOrder = 19;

      starGroup.add(halo, corona, starCore);
      scene.add(starGroup);
    }

    function setPointOpacity(value) {
      if (state.anchorIndex < 0) return;
      opacity.setX(state.anchorIndex, Math.max(0, value));
      opacity.needsUpdate = true;
    }

    function updateAnchorButton() {
      if (state.anchorIndex < 0 || state.mode !== 'idle') {
        anchorButton.style.opacity = '0';
        anchorButton.style.pointerEvents = 'none';
        return;
      }
      scratch.projected.copy(state.anchorPosition).project(camera);
      const visible = scratch.projected.z >= -1 && scratch.projected.z <= 1
        && Math.abs(scratch.projected.x) <= 1.05
        && Math.abs(scratch.projected.y) <= 1.05;
      if (!visible) {
        anchorButton.style.opacity = '0';
        anchorButton.style.pointerEvents = 'none';
        return;
      }
      const x = (scratch.projected.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-scratch.projected.y * 0.5 + 0.5) * window.innerHeight;
      anchorButton.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      anchorButton.style.opacity = '1';
      anchorButton.style.pointerEvents = 'auto';
    }

    function beginFlight() {
      if (state.mode !== 'idle' || state.anchorIndex < 0 || !starGroup) return;

      state.mode = 'flying';
      state.startedAt = performance.now();
      state.duration = FLIGHT_DURATION_MS;
      state.homePosition.copy(camera.position);
      state.homeQuaternion.copy(camera.quaternion);
      state.homeFov = camera.fov;
      state.homePointer = {
        targetX: pointer?.targetX ?? 0,
        targetY: pointer?.targetY ?? 0,
        currentX: pointer?.currentX ?? 0,
        currentY: pointer?.currentY ?? 0,
      };
      state.pathStart.copy(camera.position);
      camera.getWorldDirection(scratch.forward);
      state.startLook.copy(camera.position).addScaledVector(scratch.forward, 12);

      const approachDirection = scratch.travel.subVectors(camera.position, state.anchorPosition).normalize();
      state.pathEnd.copy(state.anchorPosition).addScaledVector(approachDirection, APPROACH_DISTANCE);

      const travelVector = scratch.travel.subVectors(state.pathEnd, state.pathStart);
      const travelLength = travelVector.length();
      const travelDir = travelVector.clone().normalize();
      scratch.side.crossVectors(travelDir, scratch.up);
      if (scratch.side.lengthSq() < 1e-5) scratch.side.set(1, 0, 0);
      scratch.side.normalize();
      const curve = Math.min(1.5, travelLength * 0.045);
      state.controlA.copy(state.pathStart)
        .addScaledVector(travelDir, travelLength * 0.27)
        .addScaledVector(scratch.side, curve)
        .addScaledVector(scratch.up, curve * 0.28);
      state.controlB.copy(state.pathStart)
        .addScaledVector(travelDir, travelLength * 0.76)
        .addScaledVector(scratch.side, -curve * 0.38)
        .addScaledVector(scratch.up, curve * 0.12);

      starGroup.visible = true;
      starGroup.scale.setScalar(0.035);
      state.starScale = 0.035;
      document.body.classList.add('star-flight-active');
      document.body.classList.remove('star-flight-arrived');
      updateAnchorButton();
    }

    function beginReturn() {
      if (state.mode !== 'arrived') return;
      state.mode = 'returning';
      state.startedAt = performance.now();
      state.duration = RETURN_DURATION_MS;
      state.returnStartPosition.copy(camera.position);
      state.returnStartQuaternion.copy(camera.quaternion);
      state.returnStartFov = camera.fov;
      document.body.classList.remove('star-flight-arrived');
    }

    anchorButton.addEventListener('click', beginFlight);
    backButton.addEventListener('click', beginReturn);
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && state.mode === 'arrived') beginReturn();
    });

    function updateStarVisuals(elapsed, reveal) {
      if (!starGroup) return;
      if (coreMaterial) coreMaterial.uniforms.uTime.value = elapsed;
      if (coronaMaterial) {
        coronaMaterial.uniforms.uTime.value = elapsed;
        coronaMaterial.uniforms.uStrength.value = 0.55 + reveal * 0.75;
      }
      if (starCore) {
        starCore.rotation.y = elapsed * 0.075;
        starCore.rotation.x = Math.sin(elapsed * 0.11) * 0.055;
      }
      if (corona) corona.rotation.y = -elapsed * 0.035;
      if (halo?.material) halo.material.opacity = 0.28 + reveal * 0.58;
    }

    function updateFlying(now, elapsed) {
      const raw = THREE.MathUtils.clamp((now - state.startedAt) / state.duration, 0, 1);
      const motion = smootherstep01(raw);
      cubicBezier(camera.position, state.pathStart, state.controlA, state.controlB, state.pathEnd, motion);

      const lookEase = smootherstep01(Math.min(1, raw * 1.42));
      scratch.look.lerpVectors(state.startLook, state.anchorPosition, lookEase);
      camera.lookAt(scratch.look);

      const speedPulse = Math.sin(Math.PI * raw);
      camera.fov = THREE.MathUtils.lerp(state.homeFov, FINAL_FOV, motion) + speedPulse * 13.5;
      camera.updateProjectionMatrix();

      const reveal = smoothstep01((raw - 0.43) / 0.50);
      state.starScale = THREE.MathUtils.lerp(0.035, 1.0, reveal);
      starGroup.scale.setScalar(state.starScale);
      setPointOpacity(state.originalOpacity * (1 - reveal));
      updateStarVisuals(elapsed, reveal);

      if (raw >= 1) {
        state.mode = 'arrived';
        camera.position.copy(state.pathEnd);
        camera.lookAt(state.anchorPosition);
        camera.fov = FINAL_FOV;
        camera.updateProjectionMatrix();
        starGroup.scale.setScalar(1);
        setPointOpacity(0);
        document.body.classList.add('star-flight-arrived');
      }
      return true;
    }

    function updateArrived(elapsed) {
      camera.position.copy(state.pathEnd);
      camera.lookAt(state.anchorPosition);
      camera.fov = FINAL_FOV;
      camera.updateProjectionMatrix();
      updateStarVisuals(elapsed, 1);
      return true;
    }

    function updateReturning(now, elapsed) {
      const raw = THREE.MathUtils.clamp((now - state.startedAt) / state.duration, 0, 1);
      const motion = smootherstep01(raw);
      camera.position.lerpVectors(state.returnStartPosition, state.homePosition, motion);
      camera.quaternion.slerpQuaternions(state.returnStartQuaternion, state.homeQuaternion, motion);
      camera.fov = THREE.MathUtils.lerp(state.returnStartFov, state.homeFov, motion);
      camera.updateProjectionMatrix();

      const reveal = 1 - smoothstep01((raw - 0.08) / 0.76);
      state.starScale = Math.max(0.035, reveal);
      starGroup.scale.setScalar(state.starScale);
      setPointOpacity(state.originalOpacity * (1 - reveal));
      updateStarVisuals(elapsed, reveal);

      if (raw >= 1) {
        state.mode = 'idle';
        starGroup.visible = false;
        starGroup.scale.setScalar(0.001);
        setPointOpacity(state.originalOpacity);
        camera.position.copy(state.homePosition);
        camera.quaternion.copy(state.homeQuaternion);
        camera.fov = state.homeFov;
        camera.updateProjectionMatrix();
        if (pointer) {
          pointer.targetX = state.homePointer.targetX;
          pointer.targetY = state.homePointer.targetY;
          pointer.currentX = state.homePointer.currentX;
          pointer.currentY = state.homePointer.currentY;
        }
        document.body.classList.remove('star-flight-active', 'star-flight-arrived');
        updateAnchorButton();
      }
      return true;
    }

    const controller = {
      get needsContinuousRender() {
        return state.mode !== 'idle';
      },
      update(now, dt, elapsed) {
        chooseAnchor();

        if (state.mode === 'idle') {
          updateAnchorButton();
          return false;
        }
        if (state.mode === 'flying') return updateFlying(now, elapsed);
        if (state.mode === 'arrived') return updateArrived(elapsed);
        if (state.mode === 'returning') return updateReturning(now, elapsed);
        return false;
      },
    };

    return controller;
  };
})();
