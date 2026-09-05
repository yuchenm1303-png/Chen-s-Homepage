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

    const catalog = Array.isArray(window.__SMIREL_STELLAR_CATALOG__)
      ? window.__SMIREL_STELLAR_CATALOG__
      : [];
    if (!catalog.length) {
      console.warn('[homepage-star-flight] stellar catalog unavailable');
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

    const anchors = new Map();
    const usedAnchorIndices = new Set();
    const anchorButtons = new Map();
    let visibleKind = 'project';
    let anchorsResolved = false;

    const state = {
      mode: 'idle',
      activeObject: null,
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
      candidateColor: new THREE.Color(),
      targetColor: new THREE.Color(),
      modelColor: new THREE.Color(),
    };

    const style = document.createElement('style');
    style.dataset.smirelStarFlight = 'true';
    style.textContent = `
      .smirel-star-anchor {
        --star-anchor-color: #d8efff;
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
        color: rgba(242,248,255,.94);
        cursor: pointer;
        pointer-events: none;
        opacity: 0;
        transition: opacity .30s ease;
      }
      .smirel-star-anchor::before {
        content: '';
        position: absolute;
        inset: 13px;
        border: 1px solid color-mix(in srgb, var(--star-anchor-color) 42%, transparent);
        border-radius: inherit;
        box-shadow: 0 0 18px color-mix(in srgb, var(--star-anchor-color) 14%, transparent), inset 0 0 10px rgba(255,255,255,.06);
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
        background: var(--star-anchor-color);
        box-shadow: 0 0 10px var(--star-anchor-color);
      }
      .smirel-star-anchor[data-star-kind="note"]::before {
        inset: 15px;
        border-style: dashed;
        opacity: .80;
      }
      .smirel-star-anchor:hover::before,
      .smirel-star-anchor:focus-visible::before {
        transform: scale(1);
        border-color: color-mix(in srgb, var(--star-anchor-color) 82%, white 18%);
        box-shadow: 0 0 26px color-mix(in srgb, var(--star-anchor-color) 28%, transparent), inset 0 0 13px rgba(255,255,255,.10);
      }
      .smirel-star-anchor__label {
        position: absolute;
        left: 52px;
        top: 20px;
        display: flex;
        gap: 8px;
        align-items: baseline;
        font: 600 9px/1 ui-sans-serif, system-ui, sans-serif;
        letter-spacing: .14em;
        text-transform: uppercase;
        white-space: nowrap;
        opacity: 0;
        transform: translateX(-5px);
        transition: opacity .22s ease, transform .22s ease;
        text-shadow: 0 1px 12px #000, 0 0 18px #000;
      }
      .smirel-star-anchor__label small {
        color: rgba(255,255,255,.44);
        font-size: 8px;
        letter-spacing: .12em;
      }
      .smirel-star-anchor:hover .smirel-star-anchor__label,
      .smirel-star-anchor:focus-visible .smirel-star-anchor__label {
        opacity: .92;
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
      body.star-flight-active .home-overlay { opacity: 0; pointer-events: none; transition: opacity .7s cubic-bezier(.22,.61,.36,1); }
      body.star-flight-active .smirel-star-anchor { opacity: 0 !important; pointer-events: none !important; }
      body.star-flight-arrived .smirel-star-back { opacity: 1; pointer-events: auto; transform: translateY(0); }
      @media (max-width: 760px) { .smirel-star-back { right: 14px; top: 14px; } }
      @media (prefers-reduced-motion: reduce) {
        .smirel-star-anchor,
        .smirel-star-anchor::before,
        .smirel-star-back,
        .home-overlay { transition-duration: .01ms !important; }
      }
    `;
    document.head.appendChild(style);

    const backButton = document.createElement('button');
    backButton.type = 'button';
    backButton.className = 'smirel-star-back';
    backButton.textContent = 'Esc · Back to galaxy';
    document.body.appendChild(backButton);

    for (const object of catalog) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'smirel-star-anchor';
      button.dataset.starId = object.id;
      button.dataset.starKind = object.kind;
      button.style.setProperty('--star-anchor-color', object.star?.tint || '#d8efff');
      button.setAttribute('aria-label', `Open ${object.title} ${object.kind === 'note' ? 'note' : 'project'} star`);
      button.innerHTML = `<span class="smirel-star-anchor__label"><span>${object.title}</span><small>${object.kind}</small></span>`;
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        beginFlight(object.id);
      });
      document.body.appendChild(button);
      anchorButtons.set(object.id, button);
    }

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

    function chooseAnchors() {
      if (anchorsResolved || camera.aspect <= 0) return;

      const introRect = document.querySelector('.home-intro')?.getBoundingClientRect() || null;
      const indexRect = document.querySelector('.home-index')?.getBoundingClientRect() || null;
      const viewportWidth = Math.max(window.innerWidth, 1);
      const viewportHeight = Math.max(window.innerHeight, 1);
      const chosenProjected = [];

      for (const object of catalog) {
        const target = object.star?.target || [0, 0];
        const depthRange = object.star?.depth || [13, 38];
        const requestedBrightness = object.star?.minBrightness ?? 1.8;
        const brightnessPasses = [requestedBrightness, Math.max(1.35, requestedBrightness - 0.55), 1.05];
        scratch.targetColor.set(object.star?.tint || '#d8efff');

        let bestIndex = -1;
        let bestScore = -Infinity;
        let bestProjectedX = 0;
        let bestProjectedY = 0;

        for (const minBrightness of brightnessPasses) {
          for (let i = 0; i < positions.count; i += 1) {
            if (usedAnchorIndices.has(i)) continue;
            const b = brightness.getX(i);
            if (b < minBrightness) continue;

            scratch.world.fromBufferAttribute(positions, i);
            const depth = -scratch.world.z;
            if (depth < depthRange[0] || depth > depthRange[1]) continue;

            scratch.projected.copy(scratch.world).project(camera);
            if (scratch.projected.z < -1 || scratch.projected.z > 1) continue;
            if (Math.abs(scratch.projected.x) > 0.86 || Math.abs(scratch.projected.y) > 0.82) continue;

            const screenX = (scratch.projected.x * 0.5 + 0.5) * viewportWidth;
            const screenY = (-scratch.projected.y * 0.5 + 0.5) * viewportHeight;
            if (pointInsideExpandedRect(screenX, screenY, introRect, 42)) continue;
            if (pointInsideExpandedRect(screenX, screenY, indexRect, 34)) continue;

            let tooClose = false;
            for (const previous of chosenProjected) {
              const px = scratch.projected.x - previous.x;
              const py = scratch.projected.y - previous.y;
              if (px * px + py * py < 0.0225) {
                tooClose = true;
                break;
              }
            }
            if (tooClose) continue;

            scratch.candidateColor.setRGB(colors.getX(i), colors.getY(i), colors.getZ(i));
            const colorDistance = Math.sqrt(
              (scratch.candidateColor.r - scratch.targetColor.r) ** 2
              + (scratch.candidateColor.g - scratch.targetColor.g) ** 2
              + (scratch.candidateColor.b - scratch.targetColor.b) ** 2
            );
            const dx = scratch.projected.x - target[0];
            const dy = scratch.projected.y - target[1];
            const positionPenalty = Math.sqrt(dx * dx + dy * dy);
            const depthCentre = (depthRange[0] + depthRange[1]) * 0.5;
            const depthPenalty = Math.abs(depth - depthCentre) / Math.max(depthRange[1] - depthRange[0], 1);
            const score = b * 0.40 - positionPenalty * 3.55 - colorDistance * 0.70 - depthPenalty * 0.18;

            if (score > bestScore) {
              bestScore = score;
              bestIndex = i;
              bestProjectedX = scratch.projected.x;
              bestProjectedY = scratch.projected.y;
            }
          }
          if (bestIndex >= 0) break;
        }

        if (bestIndex < 0) continue;
        const position = new THREE.Vector3().fromBufferAttribute(positions, bestIndex);
        const naturalColor = new THREE.Color(
          colors.getX(bestIndex),
          colors.getY(bestIndex),
          colors.getZ(bestIndex),
        );
        const anchor = {
          object,
          index: bestIndex,
          position,
          naturalColor,
          originalOpacity: opacity.getX(bestIndex),
        };
        anchors.set(object.id, anchor);
        usedAnchorIndices.add(bestIndex);
        chosenProjected.push({ x: bestProjectedX, y: bestProjectedY });
      }

      anchorsResolved = true;
      updateAnchorButtons();
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
      if (starGroup) return;

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
          uBaseColor: { value: new THREE.Color(0xd8efff) },
        },
        vertexShader: coreVertex,
        fragmentShader: coreFragment,
        toneMapped: false,
      });

      coronaMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uBaseColor: { value: new THREE.Color(0xe8f6ff) },
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
      starGroup.scale.setScalar(0.001);
      starGroup.visible = false;
      starGroup.renderOrder = 20;

      starCore = new THREE.Mesh(new THREE.SphereGeometry(1, 72, 48), coreMaterial);
      corona = new THREE.Mesh(new THREE.SphereGeometry(1.09, 64, 40), coronaMaterial);

      const haloMaterial = new THREE.SpriteMaterial({
        map: makeHaloTexture(new THREE.Color(0xd8efff)),
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

    function configureActiveStar(anchor) {
      buildStar();
      const object = anchor.object;
      scratch.targetColor.set(object.star?.tint || '#d8efff');
      scratch.modelColor.copy(anchor.naturalColor).lerp(scratch.targetColor, 0.64);
      state.anchorColor.copy(scratch.modelColor);

      coreMaterial.uniforms.uBaseColor.value.copy(scratch.modelColor).lerp(new THREE.Color(0xf7fbff), 0.18);
      coronaMaterial.uniforms.uBaseColor.value.copy(scratch.modelColor).lerp(new THREE.Color(0xffffff), 0.28);

      if (halo?.material) {
        const previousMap = halo.material.map;
        halo.material.map = makeHaloTexture(scratch.modelColor);
        halo.material.needsUpdate = true;
        previousMap?.dispose?.();
      }

      starGroup.position.copy(anchor.position);
    }

    function setPointOpacity(value) {
      if (state.anchorIndex < 0) return;
      opacity.setX(state.anchorIndex, Math.max(0, value));
      opacity.needsUpdate = true;
    }

    function setVisibleKind(kind) {
      if (kind !== 'project' && kind !== 'note') return;
      visibleKind = kind;
      updateAnchorButtons();
    }

    function updateAnchorButtons() {
      for (const object of catalog) {
        const button = anchorButtons.get(object.id);
        const anchor = anchors.get(object.id);
        if (!button || !anchor || state.mode !== 'idle' || object.kind !== visibleKind) {
          if (button) {
            button.style.opacity = '0';
            button.style.pointerEvents = 'none';
          }
          continue;
        }

        scratch.projected.copy(anchor.position).project(camera);
        const visible = scratch.projected.z >= -1 && scratch.projected.z <= 1
          && Math.abs(scratch.projected.x) <= 1.06
          && Math.abs(scratch.projected.y) <= 1.06;
        if (!visible) {
          button.style.opacity = '0';
          button.style.pointerEvents = 'none';
          continue;
        }

        const x = (scratch.projected.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-scratch.projected.y * 0.5 + 0.5) * window.innerHeight;
        button.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        button.style.opacity = '1';
        button.style.pointerEvents = 'auto';
      }
    }

    function beginFlight(objectId) {
      if (state.mode !== 'idle') return;
      chooseAnchors();
      const anchor = anchors.get(objectId);
      if (!anchor) return;

      if (document.body.classList.contains('home-panel-open')) {
        document.querySelector('.home-panel-close')?.click();
      }

      state.activeObject = anchor.object;
      state.anchorIndex = anchor.index;
      state.anchorPosition.copy(anchor.position);
      state.originalOpacity = anchor.originalOpacity;
      configureActiveStar(anchor);

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

      const radius = state.activeObject.star?.radius ?? 1;
      starGroup.visible = true;
      starGroup.scale.setScalar(0.035 * radius);
      state.starScale = 0.035 * radius;
      document.body.dataset.activeStar = state.activeObject.id;
      document.body.dataset.activeStarKind = state.activeObject.kind;
      document.body.classList.add('star-flight-active');
      document.body.classList.remove('star-flight-arrived');
      updateAnchorButtons();
      window.dispatchEvent(new CustomEvent('smirel:stellar-object', { detail: state.activeObject }));
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

    backButton.addEventListener('click', beginReturn);
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && state.mode === 'arrived') beginReturn();
    });

    document.addEventListener('click', (event) => {
      const panelButton = event.target.closest?.('[data-home-panel]');
      const panelName = panelButton?.dataset?.homePanel;
      if (panelName === 'projects') setVisibleKind('project');
      if (panelName === 'notes') setVisibleKind('note');

      const objectButton = event.target.closest?.('[data-star-object]');
      if (objectButton?.dataset?.starObject) {
        event.preventDefault();
        beginFlight(objectButton.dataset.starObject);
      }
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

      const radius = state.activeObject?.star?.radius ?? 1;
      const reveal = smoothstep01((raw - 0.43) / 0.50);
      state.starScale = THREE.MathUtils.lerp(0.035 * radius, radius, reveal);
      starGroup.scale.setScalar(state.starScale);
      setPointOpacity(state.originalOpacity * (1 - reveal));
      updateStarVisuals(elapsed, reveal);

      if (raw >= 1) {
        state.mode = 'arrived';
        camera.position.copy(state.pathEnd);
        camera.lookAt(state.anchorPosition);
        camera.fov = FINAL_FOV;
        camera.updateProjectionMatrix();
        starGroup.scale.setScalar(radius);
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

      const radius = state.activeObject?.star?.radius ?? 1;
      const reveal = 1 - smoothstep01((raw - 0.08) / 0.76);
      state.starScale = Math.max(0.035 * radius, reveal * radius);
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
        delete document.body.dataset.activeStar;
        delete document.body.dataset.activeStarKind;
        state.activeObject = null;
        state.anchorIndex = -1;
        updateAnchorButtons();
      }
      return true;
    }

    const controller = {
      get needsContinuousRender() {
        return state.mode !== 'idle';
      },
      get activeObject() {
        return state.activeObject;
      },
      get activeAnchor() {
        return state.activeObject ? anchors.get(state.activeObject.id) || null : null;
      },
      get catalog() {
        return catalog;
      },
      openObject: beginFlight,
      setVisibleKind,
      update(now, dt, elapsed) {
        chooseAnchors();

        if (state.mode === 'idle') {
          updateAnchorButtons();
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
