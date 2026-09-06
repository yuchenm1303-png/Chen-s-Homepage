(() => {
  'use strict';

  const INSTALL_KEY = '__SMIREL_STAR_FLIGHT_INSTALL__';
  const baseInstall = window[INSTALL_KEY];
  if (typeof baseInstall !== 'function' || baseInstall.__smirelDetailStarLayer) return;

  // The galaxy renderer already loads this exact module URL. Starting the same
  // import here reuses the browser module cache and lets the detached UI star use
  // the same HDR bloom + ACES pipeline instead of a visually different raw pass.
  const postprocessingPromise = import('https://cdn.jsdelivr.net/npm/postprocessing@6.39.4/build/index.js')
    .catch((error) => {
      console.warn('[homepage-star-detail-layer] postprocessing unavailable', error);
      return null;
    });

  const detailLayerInstall = function installDetailStarLayer(context) {
    const controller = baseInstall(context);
    if (!controller) return controller;

    const { THREE, scene, camera, reducedMotion, CONFIG } = context || {};
    if (!THREE || !scene || !camera) return controller;

    const OPEN_MS = reducedMotion ? 1 : 1080;
    const CLOSE_MS = reducedMotion ? 1 : 840;
    const BLOOM_THRESHOLD_DURING_FLIGHT = 0.95;

    const shell = document.querySelector('.star-detail-shell');
    const starHeader = shell?.querySelector('.star-detail-header') || null;
    const starSlot = shell?.querySelector('.star-detail-star-slot') || null;
    if (!shell || !starSlot) return controller;

    const detailScene = new THREE.Scene();
    const detailCanvas = document.createElement('canvas');
    detailCanvas.className = 'star-detail-star-layer';
    detailCanvas.setAttribute('aria-hidden', 'true');
    Object.assign(detailCanvas.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      zIndex: '12',
      pointerEvents: 'none',
      opacity: '0',
      visibility: 'hidden',
      transform: 'translate3d(-10000px,-10000px,0)',
      willChange: 'transform',
    });
    document.body.appendChild(detailCanvas);

    let detailRenderer = null;
    try {
      detailRenderer = new THREE.WebGLRenderer({
        canvas: detailCanvas,
        alpha: true,
        antialias: false,
        depth: false,
        powerPreference: 'high-performance',
      });
      detailRenderer.outputColorSpace = THREE.SRGBColorSpace;
      detailRenderer.toneMapping = THREE.NoToneMapping;
      detailRenderer.setClearColor(0x000000, 0);
      detailRenderer.setClearAlpha(0);
    } catch (error) {
      console.warn('[homepage-star-detail-layer] overlay renderer unavailable', error);
      detailCanvas.remove();
      return controller;
    }

    const detailCamera = new THREE.PerspectiveCamera(camera.fov, 1, camera.near, camera.far);
    const arrivalPosition = new THREE.Vector3();
    const arrivalQuaternion = new THREE.Quaternion();
    const starPosition = new THREE.Vector3();
    const cameraBack = new THREE.Vector3();
    const projectedStar = new THREE.Vector3();

    let arrivalFov = camera.fov;
    let arrivalDepth = 3.2;
    let detailArrivalDepth = 3.2;
    let detailFov = 26;
    let detailDepth = 10;

    let starGroup = null;
    let originalStarParent = null;
    let activeObject = null;
    let previousArrived = false;
    let ownsStarLayer = false;
    let phase = 'idle';
    let phaseStartedAt = 0;
    let currentBlend = 0;
    let closeStartBlend = 1;
    let closeDuration = CLOSE_MS;

    let targetReady = false;
    let measuredWidth = 0;
    let measuredHeight = 0;
    let canvasSide = 1;
    let renderSide = 1;
    let renderDpr = 1;
    let arrivalCenterX = 0;
    let arrivalCenterY = 0;
    let targetCenterX = 0;
    let targetCenterY = 0;

    let detailComposer = null;
    let detailBloom = null;
    let postprocessingReady = false;
    let starShadersPrewarmed = false;

    function smootherstep01(value) {
      const t = THREE.MathUtils.clamp(value, 0, 1);
      return t * t * t * (t * (t * 6 - 15) + 10);
    }

    function createAstraBloomEffect(pp) {
      const ASTRA_BLOOM_PREFILTER = `
#include <common>
uniform sampler2D inputBuffer;
uniform vec2 sourceTexelSize;
uniform float threshold;
uniform float smoothing;
varying vec2 vUv;
void main() {
  vec2 offset = sourceTexelSize * 0.5;
  vec4 color = (
    texture2D(inputBuffer, vUv + vec2(-offset.x, -offset.y)) +
    texture2D(inputBuffer, vUv + vec2( offset.x, -offset.y)) +
    texture2D(inputBuffer, vUv + vec2(-offset.x,  offset.y)) +
    texture2D(inputBuffer, vUv + vec2( offset.x,  offset.y))
  ) * 0.25;
  gl_FragColor = color * smoothstep(threshold, threshold + smoothing, luminance(color.rgb));
}`;
      const ASTRA_BLOOM_RECONSTRUCTION = `
uniform sampler2D source;
uniform vec2 stepSize;
varying vec2 vUv;
void main() {
  vec4 color = texture2D(source, vUv) * 0.2270270270;
  color += (texture2D(source, vUv + stepSize * 1.3846153846) + texture2D(source, vUv - stepSize * 1.3846153846)) * 0.3162162162;
  color += (texture2D(source, vUv + stepSize * 3.2307692308) + texture2D(source, vUv - stepSize * 3.2307692308)) * 0.0702702703;
  gl_FragColor = color;
}`;

      return class DetailAstraBloomEffect extends pp.BloomEffect {
        constructor(options) {
          super(options);
          this.sourceTexelSize = new THREE.Uniform(new THREE.Vector2());
          this.blurSource = new THREE.Uniform(null);
          this.blurStep = new THREE.Uniform(new THREE.Vector2());
          this.horizontalTarget = new THREE.WebGLRenderTarget(1, 1, {
            type: THREE.HalfFloatType,
            depthBuffer: false,
          });
          this.verticalTarget = this.horizontalTarget.clone();
          this.reconstruction = new pp.ShaderPass(new THREE.ShaderMaterial({
            uniforms: { source: this.blurSource, stepSize: this.blurStep },
            vertexShader: 'varying vec2 vUv; void main(){vUv=position.xy*0.5+0.5;gl_Position=vec4(position.xy,1.0,1.0);}',
            fragmentShader: ASTRA_BLOOM_RECONSTRUCTION,
            blending: THREE.NoBlending,
            depthTest: false,
            depthWrite: false,
            toneMapped: false,
          }));
          this.luminanceMaterial.uniforms.sourceTexelSize = this.sourceTexelSize;
          this.luminanceMaterial.fragmentShader = ASTRA_BLOOM_PREFILTER;
          this.luminanceMaterial.needsUpdate = true;
          this.uniforms.set('map', new THREE.Uniform(this.verticalTarget.texture));
        }
        setSize(width, height) {
          super.setSize(width, height);
          this.horizontalTarget.setSize(
            Math.max(1, Math.round(width * 0.5)),
            Math.max(1, Math.round(height * 0.5)),
          );
          this.verticalTarget.setSize(this.horizontalTarget.width, this.horizontalTarget.height);
        }
        update(renderer, inputBuffer, deltaTime) {
          this.sourceTexelSize.value.set(1 / inputBuffer.width, 1 / inputBuffer.height);
          super.update(renderer, inputBuffer, deltaTime);
          this.blurSource.value = super.texture;
          this.blurStep.value.set(1 / this.horizontalTarget.width, 0);
          this.reconstruction.render(renderer, null, this.horizontalTarget);
          this.blurSource.value = this.horizontalTarget.texture;
          this.blurStep.value.set(0, 1 / this.verticalTarget.height);
          this.reconstruction.render(renderer, null, this.verticalTarget);
        }
      };
    }

    postprocessingPromise.then((pp) => {
      if (!pp) return;
      try {
        const DetailAstraBloomEffect = createAstraBloomEffect(pp);
        detailComposer = new pp.EffectComposer(detailRenderer, {
          depthBuffer: false,
          frameBufferType: THREE.HalfFloatType,
          multisampling: 0,
        });
        detailComposer.addPass(new pp.RenderPass(detailScene, detailCamera));
        detailBloom = new DetailAstraBloomEffect({
          blendFunction: pp.BlendFunction.ADD,
          intensity: CONFIG?.bloomIntensity ?? 0.7,
          levels: CONFIG?.bloomLevels ?? 5,
          luminanceSmoothing: 0.18,
          luminanceThreshold: BLOOM_THRESHOLD_DURING_FLIGHT,
          mipmapBlur: true,
          radius: CONFIG?.bloomRadius ?? 0.72,
        });
        detailComposer.addPass(new pp.EffectPass(
          detailCamera,
          detailBloom,
          new pp.ToneMappingEffect({ mode: pp.ToneMappingMode.ACES_FILMIC }),
        ));
        postprocessingReady = true;
        syncRendererSize(true);

        // Compile the post stack while the canvas is invisible. The first detail
        // transition then pays only for the stellar shader upload, not the whole
        // bloom/tone-mapping pipeline.
        try {
          detailComposer.render(0);
        } catch (_) {
          // A later visible frame can safely compile if the browser refuses an
          // empty-scene warmup.
        }
      } catch (error) {
        detailComposer = null;
        detailBloom = null;
        postprocessingReady = false;
        console.warn('[homepage-star-detail-layer] matched postprocess setup failed', error);
      }
    });

    function desiredCanvasSide(slotWidth, viewportWidth, viewportHeight) {
      const minimum = viewportWidth <= 620 ? 380 : 520;
      const maximum = Math.max(320, Math.min(viewportWidth, viewportHeight) * 0.92);
      return Math.round(THREE.MathUtils.clamp(slotWidth * 2.18, minimum, maximum));
    }

    function syncRendererSize(force = false) {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      const side = Math.max(1, Math.round(canvasSide));
      if (!force && side === renderSide && dpr === renderDpr) return;
      renderSide = side;
      renderDpr = dpr;
      detailCanvas.style.width = `${side}px`;
      detailCanvas.style.height = `${side}px`;
      detailRenderer.setPixelRatio(dpr);
      detailRenderer.setSize(side, side, false);
      detailCamera.aspect = 1;
      detailCamera.updateProjectionMatrix();
      if (detailComposer) detailComposer.setSize(side, side, false);
      if (detailBloom) {
        detailBloom.setSize(
          Math.max(1, Math.floor(side * dpr * 0.5)),
          Math.max(1, Math.floor(side * dpr * 0.5)),
        );
      }
    }

    function measureTarget(force = false) {
      if (!starGroup || !activeObject) return false;
      const width = Math.max(window.innerWidth, 1);
      const height = Math.max(window.innerHeight, 1);
      if (!force && targetReady && width === measuredWidth && height === measuredHeight) return true;

      const rect = starSlot.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;

      let transformX = 0;
      let transformY = 0;
      if (starHeader) {
        const transform = getComputedStyle(starHeader).transform;
        if (transform && transform !== 'none' && typeof DOMMatrixReadOnly === 'function') {
          try {
            const matrix = new DOMMatrixReadOnly(transform);
            transformX = matrix.m41;
            transformY = matrix.m42;
          } catch (_) {
            // Ignore the tiny compositor offset on browsers without DOMMatrix.
          }
        }
      }

      targetCenterX = rect.left + rect.width * 0.5 - transformX;
      targetCenterY = rect.top + rect.height * 0.5 - transformY;
      canvasSide = desiredCanvasSide(rect.width, width, height);
      syncRendererSize();

      detailFov = width <= 620 ? 32 : (activeObject.kind === 'note' ? 28 : 26);
      const starScale = starGroup.scale?.x || 0.84;
      const focalPixels = canvasSide / Math.max(
        2 * Math.tan(THREE.MathUtils.degToRad(detailFov) * 0.5),
        1e-5,
      );
      const coreRatio = activeObject.kind === 'note' ? 0.35 : 0.37;
      const desiredCoreRadiusPx = Math.min(rect.width, rect.height) * coreRatio;
      detailDepth = THREE.MathUtils.clamp(
        starScale * focalPixels / Math.max(desiredCoreRadiusPx, 1),
        4.0,
        18.0,
      );

      // The detached canvas is much smaller than the viewport. Compensate its
      // arrival camera depth so the first overlay frame has the exact same
      // apparent stellar diameter as the final galaxy-rendered arrival frame.
      detailArrivalDepth = Math.max(
        0.55,
        arrivalDepth * canvasSide / Math.max(height, 1),
      );

      measuredWidth = width;
      measuredHeight = height;
      targetReady = true;
      return true;
    }

    function captureArrivalScreenPosition() {
      const width = Math.max(window.innerWidth, 1);
      const height = Math.max(window.innerHeight, 1);
      projectedStar.copy(starPosition).project(camera);
      arrivalCenterX = (projectedStar.x * 0.5 + 0.5) * width;
      arrivalCenterY = (-projectedStar.y * 0.5 + 0.5) * height;
    }

    function placeCanvas(blend) {
      const t = THREE.MathUtils.clamp(blend, 0, 1);
      const centreX = THREE.MathUtils.lerp(arrivalCenterX, targetCenterX, t);
      const centreY = THREE.MathUtils.lerp(arrivalCenterY, targetCenterY, t);
      const left = centreX - canvasSide * 0.5;
      const top = centreY - canvasSide * 0.5;
      detailCanvas.style.transform = `translate3d(${left.toFixed(2)}px,${top.toFixed(2)}px,0)`;
    }

    function takeStarLayer() {
      if (!starGroup || ownsStarLayer) return;
      originalStarParent = starGroup.parent || scene;
      detailScene.attach(starGroup);
      ownsStarLayer = true;
      detailCanvas.style.visibility = 'visible';
      detailCanvas.style.opacity = '1';
      document.body.classList.add('star-detail-star-layer-active');
    }

    function releaseStarLayer() {
      if (!ownsStarLayer) return;
      const targetParent = originalStarParent?.attach ? originalStarParent : scene;
      targetParent.attach(starGroup);
      originalStarParent = null;
      ownsStarLayer = false;
      detailCanvas.style.opacity = '0';
      detailCanvas.style.visibility = 'hidden';
      detailCanvas.style.transform = 'translate3d(-10000px,-10000px,0)';
      detailRenderer.clear();
      document.body.classList.remove('star-detail-star-layer-active');
    }

    function applyDetailCamera(blend) {
      if (!measureTarget()) return;
      const t = THREE.MathUtils.clamp(blend, 0, 1);
      const currentFov = THREE.MathUtils.lerp(arrivalFov, detailFov, t);
      const forwardDepth = THREE.MathUtils.lerp(detailArrivalDepth, detailDepth, t);

      starGroup.getWorldPosition(starPosition);
      detailCamera.position.copy(starPosition).addScaledVector(cameraBack, forwardDepth);
      detailCamera.quaternion.copy(arrivalQuaternion);
      detailCamera.fov = currentFov;
      detailCamera.near = Math.min(camera.near, Math.max(0.01, forwardDepth * 0.02));
      detailCamera.far = camera.far;
      detailCamera.updateProjectionMatrix();
      detailCamera.updateMatrixWorld(true);
      placeCanvas(t);
    }

    function renderDetailStar(dt) {
      if (!ownsStarLayer || !starGroup?.visible) return;
      syncRendererSize();
      if (postprocessingReady && detailComposer && detailBloom) {
        detailBloom.luminanceMaterial.uniforms.threshold.value = BLOOM_THRESHOLD_DURING_FLIGHT;
        detailComposer.render(dt || 0);
      } else {
        detailRenderer.clear();
        detailRenderer.render(detailScene, detailCamera);
      }
    }

    function scheduleStarShaderPrewarm() {
      if (starShadersPrewarmed) return;
      requestAnimationFrame(() => {
        const group = controller.stellarModel?.group || null;
        if (!group) return;
        const compile = () => {
          if (starShadersPrewarmed) return;
          try {
            detailRenderer.compile(group, detailCamera);
            starShadersPrewarmed = true;
          } catch (_) {
            // First visible detail frame will compile normally if unsupported.
          }
        };
        if ('requestIdleCallback' in window) {
          window.requestIdleCallback(compile, { timeout: 900 });
        } else {
          setTimeout(compile, 80);
        }
      });
    }
    window.addEventListener('smirel:stellar-object', scheduleStarShaderPrewarm);

    function beginLayerOpen(now) {
      activeObject = controller.activeObject || null;
      starGroup = controller.stellarModel?.group || null;
      if (!activeObject || !starGroup?.parent) return false;

      starGroup.getWorldPosition(starPosition);
      arrivalPosition.copy(camera.position);
      arrivalQuaternion.copy(camera.quaternion);
      arrivalFov = camera.fov;
      arrivalDepth = Math.max(arrivalPosition.distanceTo(starPosition), 0.001);
      cameraBack.subVectors(arrivalPosition, starPosition).normalize();
      captureArrivalScreenPosition();

      targetReady = false;
      if (!measureTarget(true)) return false;

      detailCamera.quaternion.copy(arrivalQuaternion);
      detailCamera.fov = arrivalFov;
      detailCamera.updateProjectionMatrix();
      takeStarLayer();

      currentBlend = 0;
      phase = 'opening';
      phaseStartedAt = now;
      applyDetailCamera(0);
      renderDetailStar(0);
      return true;
    }

    function beginLayerClose(now = performance.now()) {
      if (phase !== 'opening' && phase !== 'open') return;
      phase = 'closing';
      phaseStartedAt = now;
      closeStartBlend = currentBlend;
      closeDuration = reducedMotion ? 1 : Math.max(360, CLOSE_MS * Math.max(0.50, closeStartBlend));
    }

    const classObserver = new MutationObserver(() => {
      if (document.body.classList.contains('star-detail-closing')) beginLayerClose(performance.now());
    });
    classObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    window.addEventListener('resize', () => {
      targetReady = false;
    }, { passive: true });

    const baseUpdate = controller.update.bind(controller);
    controller.update = (now, dt, elapsed) => {
      // The legacy detail controller remains the sole writer of the galaxy
      // camera. This wrapper owns only the detached physical star and its small
      // UI render surface.
      const baseOwnsCamera = baseUpdate(now, dt, elapsed);
      const arrived = document.body.classList.contains('star-flight-arrived');

      if (arrived && !previousArrived) beginLayerOpen(now);

      if (arrived && ownsStarLayer && starGroup && activeObject) {
        if (document.body.classList.contains('star-detail-closing')) beginLayerClose(now);

        if (phase === 'opening') {
          const raw = THREE.MathUtils.clamp((now - phaseStartedAt) / OPEN_MS, 0, 1);
          currentBlend = smootherstep01(raw);
          if (raw >= 1) {
            currentBlend = 1;
            phase = 'open';
          }
        } else if (phase === 'open') {
          currentBlend = 1;
        } else if (phase === 'closing') {
          const raw = THREE.MathUtils.clamp((now - phaseStartedAt) / closeDuration, 0, 1);
          currentBlend = closeStartBlend * (1 - smootherstep01(raw));
        }

        applyDetailCamera(currentBlend);
        renderDetailStar(dt);
      }

      if (!arrived && previousArrived && ownsStarLayer) {
        // The original detail controller has restored its exact arrival pose and
        // started the base return flight. Reattach the same Object3D in that
        // exact frame; never clone the star or rewrite the galaxy camera.
        releaseStarLayer();
        currentBlend = 0;
        phase = 'handoff';
      }

      if (!document.body.classList.contains('star-flight-active') && ownsStarLayer) {
        releaseStarLayer();
        phase = 'idle';
        activeObject = null;
        starGroup = null;
      }

      if (!arrived && !document.body.classList.contains('star-flight-active') && phase === 'handoff') {
        phase = 'idle';
        activeObject = null;
        starGroup = null;
      }

      previousArrived = arrived;
      return baseOwnsCamera || ownsStarLayer;
    };

    return controller;
  };

  detailLayerInstall.__smirelDetailStarLayer = true;
  window[INSTALL_KEY] = detailLayerInstall;
})();