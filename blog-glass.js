(() => {
  'use strict';

  const STYLE = Object.freeze({
    brightness: 1.14239631336406,
    contrast: 1.0241935483871,
    saturation: 1.112,
    bodyVisibility: 20,
    bodyMaxAlpha: 1,
    bodyOutputBrightness: 1.81152073732719,
    bodyLensBasePull: 300,
    bodyLensPullDp: 600,
    bodyLensConcentration: 10,
    bodyLensExtraDistance: 200,
    bodyLensReachDp: 180,
    bodyLensDark: 0.23041474654378,
    bodyWidth: 1.25059907834101,
    bodyCurve: 0.2,
    bodyGain: 12.4423963133641,
    bodyBrightness: 0.545161290322581,
    shoulderWidth: 21.7162162162162,
    shoulderCaptureWidth: 96,
    shoulderMaxAngle: 89.5,
    shoulderFalloff: 0,
    shoulderMaterial: 4,
    shoulderFlow: 0,
    dispersionStrength: 0.34,
    dispersionDistance: 3.2,
    dispersionEdgeWidth: 18,
    dispersionConcentration: 1.45,
    glassIntensity: 1.35,
    blurAmount: 1.22,
  });

  const REFERENCE_SHORT_EDGE = 160;
  const MIN_OPTICAL_SCALE = 0.28;
  const STIFFNESS = Object.freeze({ veryLow: 50, low: 200 });

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const smoothStep = (value) => {
    const x = clamp(value, 0, 1);
    return x * x * (3 - 2 * x);
  };

  function cubicBezier(x1, y1, x2, y2) {
    const cx = 3 * x1;
    const bx = 3 * (x2 - x1) - cx;
    const ax = 1 - cx - bx;
    const cy = 3 * y1;
    const by = 3 * (y2 - y1) - cy;
    const ay = 1 - cy - by;
    const sampleX = (t) => ((ax * t + bx) * t + cx) * t;
    const sampleY = (t) => ((ay * t + by) * t + cy) * t;
    const sampleDx = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return (x) => {
      let t = clamp(x, 0, 1);
      for (let index = 0; index < 7; index += 1) {
        const derivative = sampleDx(t);
        if (Math.abs(derivative) < 1e-7) break;
        t = clamp(t - (sampleX(t) - x) / derivative, 0, 1);
      }
      return sampleY(t);
    };
  }

  const EASE = Object.freeze({
    fastOutSlowIn: cubicBezier(0.40, 0.00, 0.20, 1.00),
    shellPreload: cubicBezier(0.20, 0.00, 0.18, 1.00),
    shellSink: cubicBezier(0.14, 0.00, 0.10, 1.00),
    shellRelease: cubicBezier(0.18, 0.00, 0.16, 1.00),
    shellPulse: cubicBezier(0.16, 0.00, 0.12, 1.00),
  });

  const tweenStep = (target, duration, easing) => ({ type: 'tween', target, duration, easing });
  const springStep = (target, dampingRatio, stiffness) => ({ type: 'spring', target, dampingRatio, stiffness });

  function makeShellState(element) {
    return {
      element,
      pressValue: 0,
      openGlPress: 0,
      centerX: 0.5,
      centerY: 0.42,
      pointerId: null,
      animations: new Map(),
    };
  }

  function mulberry32(seed) {
    let state = seed >>> 0;
    return () => {
      state += 0x6D2B79F5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  class BlogGlassRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.output = canvas.getContext('2d', { alpha: true, desynchronized: true });
      this.glCanvas = document.createElement('canvas');
      this.gl = this.glCanvas.getContext('webgl', {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance',
      });

      this.clearCanvas = document.createElement('canvas');
      this.lowCanvas = document.createElement('canvas');
      this.mediumCanvas = document.createElement('canvas');
      this.highCanvas = document.createElement('canvas');
      this.clearContext = this.clearCanvas.getContext('2d');
      this.lowContext = this.lowCanvas.getContext('2d');
      this.mediumContext = this.mediumCanvas.getContext('2d');
      this.highContext = this.highCanvas.getContext('2d');

      this.program = null;
      this.locations = null;
      this.quadBuffer = null;
      this.textures = [];
      this.mainElement = null;
      this.sideElement = null;
      this.controlElements = [];
      this.shellState = null;
      this.running = false;
      this.frame = 0;
      this.lastFrameTime = 0;
      this.dirty = true;
      this.backdropDirty = true;
      this.dpr = 1;
      this.rootWidth = 1;
      this.rootHeight = 1;
      this.resizeObserver = null;
      this.classObserver = null;
      this.cleanup = [];
      this.boundTick = (time) => this.tick(time);
    }

    initialise() {
      if (!this.gl || !this.output || !window.BlogAppGlassShaders) return false;
      const gl = this.gl;
      const vertex = this.compile(gl.VERTEX_SHADER, window.BlogAppGlassShaders.vs);
      const fragment = this.compile(gl.FRAGMENT_SHADER, window.BlogAppGlassShaders.fs);
      if (!vertex || !fragment) return false;

      const program = gl.createProgram();
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.warn('Exact app glass link failed:', gl.getProgramInfoLog(program));
        return false;
      }
      this.program = program;

      const attributeNames = ['aPosition'];
      const uniformNames = [
        'uResolution', 'uCardOrigin', 'uRootResolution', 'uRect', 'uRadius',
        'uIntensity', 'uPress', 'uTextureReady', 'uBlurAmount', 'uOpticalScale',
        'uClearTexture', 'uBlurLowTexture', 'uBlurMediumTexture', 'uBlurHighTexture',
        'uMaterial', 'uBodyLensA', 'uBodyLensB', 'uBody', 'uShoulder',
        'uShoulderFlow', 'uDispersion',
      ];
      this.locations = {};
      attributeNames.forEach((name) => { this.locations[name] = gl.getAttribLocation(program, name); });
      uniformNames.forEach((name) => { this.locations[name] = gl.getUniformLocation(program, name); });
      if (this.locations.aPosition < 0 || uniformNames.some((name) => this.locations[name] === null)) {
        console.warn('Exact app glass uniform binding failed');
        return false;
      }

      this.quadBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.useProgram(program);
      gl.enableVertexAttribArray(this.locations.aPosition);
      gl.vertexAttribPointer(this.locations.aPosition, 2, gl.FLOAT, false, 0, 0);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.clearColor(0, 0, 0, 0);

      for (let index = 0; index < 4; index += 1) {
        const texture = gl.createTexture();
        this.textures.push(texture);
        gl.activeTexture(gl.TEXTURE0 + index);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      }
      gl.uniform1i(this.locations.uClearTexture, 0);
      gl.uniform1i(this.locations.uBlurLowTexture, 1);
      gl.uniform1i(this.locations.uBlurMediumTexture, 2);
      gl.uniform1i(this.locations.uBlurHighTexture, 3);
      return true;
    }

    compile(type, source) {
      const gl = this.gl;
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn('Exact app glass shader compile failed:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    bind(mainElement, controlElements) {
      this.detachInteractions();
      this.mainElement = mainElement;
      this.sideElement = document.getElementById('articleToc');
      this.controlElements = [...controlElements];
      this.shellState = makeShellState(mainElement);
      this.attachShellInteraction(this.shellState);

      this.resizeObserver?.disconnect();
      this.resizeObserver = new ResizeObserver(() => {
        this.backdropDirty = true;
        this.requestRender();
      });
      [this.mainElement, this.sideElement, ...this.controlElements]
        .filter(Boolean)
        .forEach((element) => this.resizeObserver.observe(element));

      this.classObserver?.disconnect();
      const reader = document.getElementById('articleReader');
      if (reader) {
        this.classObserver = new MutationObserver(() => this.requestRender());
        this.classObserver.observe(reader, { attributes: true, attributeFilter: ['class', 'hidden'] });
      }
      this.backdropDirty = true;
      this.requestRender();
    }

    start() {
      if (this.running) return;
      this.running = true;
      this.lastFrameTime = performance.now();
      this.backdropDirty = true;
      this.requestRender();
    }

    stop() {
      this.running = false;
      cancelAnimationFrame(this.frame);
      this.frame = 0;
      this.resizeObserver?.disconnect();
      this.classObserver?.disconnect();
      this.detachInteractions();
      this.resetShellTransform();
    }

    requestRender() {
      this.dirty = true;
      if (!this.running || this.frame || document.hidden) return;
      this.frame = requestAnimationFrame(this.boundTick);
    }

    tick(time) {
      this.frame = 0;
      if (!this.running || document.hidden) return;
      const delta = clamp((time - this.lastFrameTime) / 1000, 0.001, 0.05);
      this.lastFrameTime = time;
      const active = this.updateStateAnimations(this.shellState, time, delta);
      this.applyShellTransform();
      if (this.dirty || active) {
        this.dirty = false;
        this.renderAll();
      }
      if (active || this.dirty) this.frame = requestAnimationFrame(this.boundTick);
    }

    attachShellInteraction(state) {
      const element = state?.element;
      if (!element) return;
      const updateCenter = (event) => {
        const rect = element.getBoundingClientRect();
        state.centerX = clamp((event.clientX - rect.left) / Math.max(rect.width, 1), 0, 1);
        state.centerY = clamp((event.clientY - rect.top) / Math.max(rect.height, 1), 0, 1);
      };
      const down = (event) => {
        if (event.button !== undefined && event.button !== 0) return;
        state.pointerId = event.pointerId;
        updateCenter(event);
        this.beginShellPress(state);
      };
      const move = (event) => {
        if (state.pointerId !== event.pointerId) return;
        updateCenter(event);
        this.requestRender();
      };
      const up = (event) => {
        if (state.pointerId !== event.pointerId) return;
        updateCenter(event);
        state.pointerId = null;
        this.endShellPress(state, true);
      };
      const cancel = (event) => {
        if (state.pointerId !== event.pointerId) return;
        state.pointerId = null;
        this.endShellPress(state, false);
      };
      element.addEventListener('pointerdown', down, { passive: true });
      window.addEventListener('pointermove', move, { passive: true });
      window.addEventListener('pointerup', up, { passive: true });
      window.addEventListener('pointercancel', cancel, { passive: true });
      this.cleanup.push(() => element.removeEventListener('pointerdown', down));
      this.cleanup.push(() => window.removeEventListener('pointermove', move));
      this.cleanup.push(() => window.removeEventListener('pointerup', up));
      this.cleanup.push(() => window.removeEventListener('pointercancel', cancel));
    }

    detachInteractions() {
      this.cleanup.splice(0).forEach((remove) => remove());
    }

    beginShellPress(state) {
      state.animations.clear();
      if (state.pressValue < 0.18) state.pressValue = 0.18;
      this.setSequence(state, 'pressValue', [
        tweenStep(0.42, 150, EASE.shellPulse),
        tweenStep(0.62, 360, EASE.shellSink),
        tweenStep(0.76, 620, EASE.fastOutSlowIn),
        tweenStep(0.62, 680, EASE.fastOutSlowIn),
        springStep(0.70, 0.95, STIFFNESS.veryLow),
      ]);
      this.setSequence(state, 'openGlPress', [
        tweenStep(0.26, 230, EASE.shellPreload),
        tweenStep(0.72, 520, EASE.shellSink),
        tweenStep(0.88, 620, EASE.fastOutSlowIn),
        tweenStep(0.74, 680, EASE.fastOutSlowIn),
        springStep(0.80, 0.95, STIFFNESS.veryLow),
      ]);
      this.requestRender();
    }

    endShellPress(state, releasedInsideGesture) {
      state.animations.clear();
      const openSteps = [];
      if (releasedInsideGesture && state.openGlPress < 0.24) {
        openSteps.push(tweenStep(0.34, 120, EASE.shellPulse));
      }
      openSteps.push(tweenStep(0, releasedInsideGesture ? 560 : 380, EASE.fastOutSlowIn));
      this.setSequence(state, 'openGlPress', openSteps);

      if (releasedInsideGesture) {
        const pressSteps = state.pressValue < 0.46
          ? [
              tweenStep(0.52, 105, EASE.shellPulse),
              tweenStep(-0.060, 150, EASE.shellRelease),
              springStep(0, 0.66, STIFFNESS.low),
            ]
          : [
              tweenStep(-0.065, 220, EASE.shellRelease),
              springStep(0, 0.66, STIFFNESS.low),
            ];
        this.setSequence(state, 'pressValue', pressSteps);
      } else {
        this.setSequence(state, 'pressValue', [tweenStep(0, 430, EASE.fastOutSlowIn)]);
      }
      this.requestRender();
    }

    setSequence(state, property, steps) {
      state.animations.set(property, {
        property,
        steps,
        index: 0,
        from: state[property],
        started: performance.now(),
        velocity: 0,
      });
    }

    updateStateAnimations(state, time, delta) {
      if (!state) return false;
      let active = false;
      for (const [property, animation] of [...state.animations]) {
        const step = animation.steps[animation.index];
        if (!step) {
          state.animations.delete(property);
          continue;
        }
        active = true;
        if (step.type === 'tween') {
          const progress = clamp((time - animation.started) / step.duration, 0, 1);
          state[property] = animation.from + (step.target - animation.from) * step.easing(progress);
          if (progress >= 1) this.advanceAnimation(state, animation, time);
        } else {
          const damping = 2 * step.dampingRatio * Math.sqrt(step.stiffness);
          const acceleration = -step.stiffness * (state[property] - step.target) - damping * animation.velocity;
          animation.velocity += acceleration * delta;
          state[property] += animation.velocity * delta;
          if (Math.abs(state[property] - step.target) < 0.0012 && Math.abs(animation.velocity) < 0.004) {
            state[property] = step.target;
            this.advanceAnimation(state, animation, time);
          }
        }
      }
      return active;
    }

    advanceAnimation(state, animation, time) {
      animation.index += 1;
      const next = animation.steps[animation.index];
      if (!next) {
        state.animations.delete(animation.property);
        return;
      }
      animation.from = state[animation.property];
      animation.started = time;
      animation.velocity = 0;
    }

    dynamicSnapshot() {
      const state = this.shellState;
      const positive = Math.max(state?.pressValue || 0, 0);
      const pressCompression = smoothStep(clamp(positive / 0.72, 0, 1));
      const pressRebound = smoothStep(clamp(-(state?.pressValue || 0) / 0.10, 0, 1));
      return {
        pressCompression,
        pressRebound,
        openGlPress: clamp(state?.openGlPress || 0, 0, 1),
        centerX: clamp(state?.centerX ?? 0.5, 0, 1),
        centerY: clamp(state?.centerY ?? 0.42, 0, 1),
        intensityScale: 1 + pressCompression * 0.10,
      };
    }

    applyShellTransform() {
      if (!this.mainElement || !this.shellState) return;
      const dynamic = this.dynamicSnapshot();
      const scaleX = 1 + dynamic.pressCompression * 0.014 - dynamic.pressRebound * 0.004;
      const scaleY = 1 - dynamic.pressCompression * 0.022 + dynamic.pressRebound * 0.008;
      const translateY = dynamic.pressCompression * 2.10 - dynamic.pressRebound * 0.80;
      this.mainElement.style.transformOrigin = `${dynamic.centerX * 100}% ${dynamic.centerY * 100}%`;
      this.mainElement.style.transform = `translateY(${translateY}px) scale(${scaleX}, ${scaleY})`;
    }

    resetShellTransform() {
      if (!this.mainElement) return;
      this.mainElement.style.transform = '';
      this.mainElement.style.transformOrigin = '';
    }

    chooseDpr() {
      const device = window.devicePixelRatio || 1;
      if (innerWidth <= 560) return Math.min(device, 1);
      if (innerWidth <= 1180) return Math.min(device, 1.08);
      return Math.min(device, 1.30);
    }

    setCanvasSize(canvas, width, height) {
      const safeWidth = Math.max(1, Math.round(width));
      const safeHeight = Math.max(1, Math.round(height));
      if (canvas.width !== safeWidth) canvas.width = safeWidth;
      if (canvas.height !== safeHeight) canvas.height = safeHeight;
    }

    prepareContext(context) {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.globalAlpha = 1;
      context.globalCompositeOperation = 'source-over';
      context.imageSmoothingEnabled = true;
      try { context.imageSmoothingQuality = 'high'; } catch (_) {}
    }

    drawBackdrop(context, width, height) {
      this.prepareContext(context);
      context.clearRect(0, 0, width, height);
      const vertical = context.createLinearGradient(0, 0, 0, height);
      vertical.addColorStop(0, '#10061e');
      vertical.addColorStop(0.32, '#47214e');
      vertical.addColorStop(0.63, '#26345f');
      vertical.addColorStop(1, '#08142f');
      context.fillStyle = vertical;
      context.fillRect(0, 0, width, height);

      const glow = (x, y, radius, color) => {
        const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        context.fillStyle = gradient;
        context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      };
      glow(width * 0.20, height * 0.20, width * 0.46, 'rgba(235,82,175,.31)');
      glow(width * 0.82, height * 0.25, width * 0.45, 'rgba(65,190,238,.27)');
      glow(width * 0.52, height * 0.56, width * 0.40, 'rgba(142,87,216,.20)');

      const random = mulberry32(20260801);
      const palette = ['#ff81c6', '#78eaff', '#b891ff', '#ffd36a', '#8ef1c8'];
      for (let index = 0; index < 82; index += 1) {
        const x = random() * width;
        const y = random() * height;
        const radius = (0.55 + random() * 1.18) * this.dpr;
        const color = palette[Math.floor(random() * palette.length)];
        context.globalAlpha = 0.30 + random() * 0.56;
        context.fillStyle = color;
        context.shadowColor = color;
        context.shadowBlur = 3.5 * this.dpr;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }
      context.shadowBlur = 0;
      context.globalAlpha = 1;
    }

    drawBlurLevel(destination, source, radius) {
      this.prepareContext(destination);
      destination.clearRect(0, 0, source.width, source.height);
      destination.save();
      destination.filter = `blur(${radius}px)`;
      const overscan = Math.ceil(radius * 2);
      destination.drawImage(source, -overscan, -overscan, source.width + overscan * 2, source.height + overscan * 2);
      destination.restore();
    }

    rebuildBackdrop() {
      this.dpr = this.chooseDpr();
      this.rootWidth = Math.max(1, Math.round(innerWidth * this.dpr));
      this.rootHeight = Math.max(1, Math.round(innerHeight * this.dpr));
      [this.canvas, this.clearCanvas, this.lowCanvas, this.mediumCanvas, this.highCanvas]
        .forEach((canvas) => this.setCanvasSize(canvas, this.rootWidth, this.rootHeight));
      this.canvas.style.width = `${innerWidth}px`;
      this.canvas.style.height = `${innerHeight}px`;

      this.drawBackdrop(this.clearContext, this.rootWidth, this.rootHeight);
      this.clearContext.save();
      this.clearContext.globalCompositeOperation = 'source-atop';
      this.clearContext.filter = `brightness(${STYLE.brightness}) contrast(${STYLE.contrast}) saturate(${STYLE.saturation})`;
      this.clearContext.drawImage(this.clearCanvas, 0, 0);
      this.clearContext.restore();
      this.drawBlurLevel(this.lowContext, this.clearCanvas, 1.8 * this.dpr);
      this.drawBlurLevel(this.mediumContext, this.clearCanvas, 4.8 * this.dpr);
      this.drawBlurLevel(this.highContext, this.clearCanvas, 9.2 * this.dpr);

      const gl = this.gl;
      [this.clearCanvas, this.lowCanvas, this.mediumCanvas, this.highCanvas].forEach((image, index) => {
        gl.activeTexture(gl.TEXTURE0 + index);
        gl.bindTexture(gl.TEXTURE_2D, this.textures[index]);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      });
      gl.flush();
      this.backdropDirty = false;
    }

    isSideVisible() {
      if (!this.sideElement) return false;
      const style = getComputedStyle(this.sideElement);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      if (innerWidth <= 820) {
        return document.getElementById('articleReader')?.classList.contains('toc-open') === true;
      }
      return true;
    }

    renderAll() {
      if (!this.program) return;
      const expectedDpr = this.chooseDpr();
      if (
        this.backdropDirty ||
        this.dpr !== expectedDpr ||
        this.rootWidth !== Math.round(innerWidth * expectedDpr) ||
        this.rootHeight !== Math.round(innerHeight * expectedDpr)
      ) {
        this.rebuildBackdrop();
      }
      this.prepareContext(this.output);
      this.output.clearRect(0, 0, this.rootWidth, this.rootHeight);
      this.output.drawImage(this.clearCanvas, 0, 0);
      this.renderGlassElement(this.mainElement, true);
      if (this.isSideVisible()) this.renderGlassElement(this.sideElement, false);
    }

    renderGlassElement(element, dynamicShell) {
      if (!element) return;
      const rect = element.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2 || rect.bottom < 0 || rect.top > innerHeight) return;
      const width = Math.max(1, Math.round(rect.width * this.dpr));
      const height = Math.max(1, Math.round(rect.height * this.dpr));
      this.setCanvasSize(this.glCanvas, width, height);

      const gl = this.gl;
      gl.viewport(0, 0, width, height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(this.program);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
      gl.enableVertexAttribArray(this.locations.aPosition);
      gl.vertexAttribPointer(this.locations.aPosition, 2, gl.FLOAT, false, 0, 0);

      const dynamic = dynamicShell ? this.dynamicSnapshot() : {
        openGlPress: 0,
        centerX: 0.5,
        centerY: 0.5,
        intensityScale: 1,
      };
      const radiusCss = parseFloat(getComputedStyle(element).borderTopLeftRadius) || 44;
      const radius = Math.min(radiusCss * this.dpr, Math.min(width, height) * 0.5);
      const opticalScale = clamp(Math.min(rect.width, rect.height) / REFERENCE_SHORT_EDGE, MIN_OPTICAL_SCALE, 1);
      const baseIntensity = clamp(STYLE.glassIntensity * dynamic.intensityScale, 0.35, 1.35);

      gl.uniform2f(this.locations.uResolution, width, height);
      gl.uniform2f(this.locations.uCardOrigin, rect.left * this.dpr, rect.top * this.dpr);
      gl.uniform2f(this.locations.uRootResolution, this.rootWidth, this.rootHeight);
      gl.uniform4f(this.locations.uRect, 0, 0, width, height);
      gl.uniform1f(this.locations.uRadius, radius);
      gl.uniform1f(this.locations.uIntensity, baseIntensity);
      gl.uniform4f(
        this.locations.uPress,
        dynamic.openGlPress,
        dynamic.centerX,
        dynamic.centerY,
        0,
      );
      gl.uniform1f(this.locations.uTextureReady, 1);
      gl.uniform1f(this.locations.uBlurAmount, STYLE.blurAmount);
      gl.uniform1f(this.locations.uOpticalScale, opticalScale);
      gl.uniform4f(
        this.locations.uMaterial,
        STYLE.bodyVisibility,
        STYLE.bodyMaxAlpha,
        STYLE.bodyOutputBrightness,
        0,
      );
      gl.uniform4f(
        this.locations.uBodyLensA,
        STYLE.bodyLensBasePull * this.dpr,
        STYLE.bodyLensPullDp * this.dpr,
        STYLE.bodyLensConcentration,
        0,
      );
      gl.uniform4f(
        this.locations.uBodyLensB,
        STYLE.bodyLensExtraDistance * this.dpr,
        STYLE.bodyLensReachDp * this.dpr,
        STYLE.bodyLensDark,
        0,
      );
      gl.uniform4f(
        this.locations.uBody,
        STYLE.bodyWidth,
        STYLE.bodyCurve,
        STYLE.bodyGain,
        STYLE.bodyBrightness,
      );
      gl.uniform4f(
        this.locations.uShoulder,
        STYLE.shoulderWidth * this.dpr,
        STYLE.shoulderMaxAngle,
        STYLE.shoulderFalloff,
        STYLE.shoulderMaterial,
      );
      gl.uniform2f(
        this.locations.uShoulderFlow,
        STYLE.shoulderCaptureWidth * this.dpr,
        STYLE.shoulderFlow,
      );
      gl.uniform4f(
        this.locations.uDispersion,
        STYLE.dispersionStrength,
        STYLE.dispersionDistance * this.dpr,
        STYLE.dispersionEdgeWidth * this.dpr,
        STYLE.dispersionConcentration,
      );
      this.textures.forEach((texture, index) => {
        gl.activeTexture(gl.TEXTURE0 + index);
        gl.bindTexture(gl.TEXTURE_2D, texture);
      });
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      this.output.drawImage(
        this.glCanvas,
        Math.round(rect.left * this.dpr),
        Math.round(rect.top * this.dpr),
        width,
        height,
      );
    }
  }

  window.BlogGlassRenderer = BlogGlassRenderer;
})();
