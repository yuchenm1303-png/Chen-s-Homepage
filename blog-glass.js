(() => {
  'use strict';

  const STYLE = Object.freeze({
    blurRadius: 0.230414746543779,
    blurIterations: 12,
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
  });

  const EASE = Object.freeze({
    fastOutSlowIn: cubicBezier(0.40, 0.00, 0.20, 1.00),
    shellPreload: cubicBezier(0.20, 0.00, 0.18, 1.00),
    shellSink: cubicBezier(0.14, 0.00, 0.10, 1.00),
    shellRelease: cubicBezier(0.18, 0.00, 0.16, 1.00),
    shellPulse: cubicBezier(0.16, 0.00, 0.12, 1.00),
    ordinaryPress: cubicBezier(0.12, 0.00, 0.08, 1.00),
    ordinarySink: cubicBezier(0.10, 0.00, 0.08, 1.00),
    ordinaryRelease: cubicBezier(0.14, 0.00, 0.12, 1.00),
  });

  const SPRING = Object.freeze({
    veryLow: 50,
    low: 200,
    mediumLow: 400,
  });

  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function smoothStep(value) { const x = clamp(value, 0, 1); return x * x * (3 - 2 * x); }
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
      let t = x;
      for (let index = 0; index < 6; index += 1) {
        const dx = sampleX(t) - x;
        const derivative = sampleDx(t);
        if (Math.abs(derivative) < 1e-6) break;
        t = clamp(t - dx / derivative, 0, 1);
      }
      return sampleY(t);
    };
  }

  function roundRectPath(context, x, y, width, height, radius) {
    const r = clamp(radius, 0, Math.min(width, height) * 0.5);
    context.beginPath();
    if (typeof context.roundRect === 'function') {
      context.roundRect(x, y, width, height, r);
      return;
    }
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
  }

  function makeState(kind, element) {
    return {
      kind,
      element,
      pressValue: 0,
      openGlPress: 0,
      material: 0,
      lens: 0,
      sweep: 0,
      afterglow: 0,
      centerX: 0.5,
      centerY: kind === 'shell' ? 0.42 : 0.5,
      rimFlowSeed: 0.5,
      rimFlowDirection: 1,
      rimFlowBand: 0,
      rimFlowStrength: 1,
      animations: new Map(),
      pointerId: null,
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

      this.sourceCanvas = document.createElement('canvas');
      this.lowCanvas = document.createElement('canvas');
      this.mediumCanvas = document.createElement('canvas');
      this.highCanvas = document.createElement('canvas');
      this.source = this.sourceCanvas.getContext('2d');
      this.low = this.lowCanvas.getContext('2d');
      this.medium = this.mediumCanvas.getContext('2d');
      this.high = this.highCanvas.getContext('2d');

      this.program = null;
      this.locations = null;
      this.textures = [];
      this.mainElement = null;
      this.sideElement = null;
      this.controlElements = [];
      this.shellState = null;
      this.controlStates = [];
      this.states = [];
      this.running = false;
      this.raf = 0;
      this.lastTime = 0;
      this.dirty = true;
      this.backdropDirty = true;
      this.dpr = 1;
      this.rootWidth = 1;
      this.rootHeight = 1;
      this.resizeObserver = null;
      this.cleanup = [];
      this.autoPulseTimer = 0;
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
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.warn('App glass program link failed:', gl.getProgramInfoLog(program));
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
        console.warn('App glass shader uniform binding failed');
        return false;
      }

      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
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
        console.warn('App glass shader compile failed:', gl.getShaderInfoLog(shader));
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
      this.shellState = makeState('shell', this.mainElement);
      this.controlStates = this.controlElements.map((element) => makeState('control', element));
      this.states = [this.shellState, ...this.controlStates];
      this.attachShellInteraction(this.shellState);
      this.controlStates.forEach((state) => this.attachControlInteraction(state));

      this.resizeObserver?.disconnect();
      this.resizeObserver = new ResizeObserver(() => {
        this.backdropDirty = true;
        this.requestRender();
      });
      [this.mainElement, this.sideElement, ...this.controlElements].filter(Boolean)
        .forEach((element) => this.resizeObserver.observe(element));
      this.backdropDirty = true;
      this.requestRender();
    }

    start() {
      if (this.running) return;
      this.running = true;
      this.lastTime = performance.now();
      this.backdropDirty = true;
      this.requestRender();
      clearTimeout(this.autoPulseTimer);
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this.autoPulseTimer = setTimeout(() => {
          if (this.running && this.shellState && this.shellState.pointerId === null) {
            this.shellState.centerX = 0.46;
            this.shellState.centerY = 0.28;
            this.beginShellPress(this.shellState);
            setTimeout(() => this.endShellPress(this.shellState), 720);
          }
        }, 520);
      }
    }

    stop() {
      this.running = false;
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      clearTimeout(this.autoPulseTimer);
      this.resizeObserver?.disconnect();
      this.detachInteractions();
      this.states.forEach((state) => this.resetElementTransform(state));
    }

    requestRender() {
      this.dirty = true;
      if (!this.running || this.raf || document.hidden) return;
      this.raf = requestAnimationFrame(this.boundTick);
    }

    tick(time) {
      this.raf = 0;
      if (!this.running || document.hidden) return;
      const delta = clamp((time - this.lastTime) / 1000, 0.001, 0.05);
      this.lastTime = time;
      let active = false;
      this.states.forEach((state) => {
        if (this.updateStateAnimations(state, time, delta)) active = true;
        this.applyElementTransform(state);
      });
      if (this.dirty || active) {
        this.dirty = false;
        this.renderAll();
      }
      if (active || this.dirty) this.raf = requestAnimationFrame(this.boundTick);
    }

    chooseDpr() {
      const device = window.devicePixelRatio || 1;
      if (innerWidth <= 560) return Math.min(device, 1);
      if (innerWidth <= 1180) return Math.min(device, 1.08);
      return Math.min(device, 1.30);
    }

    setCanvasSize(canvas, width, height) {
      const w = Math.max(1, Math.round(width));
      const h = Math.max(1, Math.round(height));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
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
      const crosses = [
        [0.11, 0.23, '#ff9acb'], [0.51, 0.20, '#88ebff'],
        [0.79, 0.80, '#98f2d0'], [0.34, 0.87, '#ffd477'],
        [0.96, 0.58, '#ee8ec9'],
      ];
      crosses.forEach(([nx, ny, color]) => {
        const x = width * nx;
        const y = height * ny;
        const long = 16 * this.dpr;
        const short = 5 * this.dpr;
        context.globalAlpha = 0.72;
        context.strokeStyle = color;
        context.shadowColor = color;
        context.shadowBlur = 8 * this.dpr;
        context.lineWidth = Math.max(1, this.dpr * 0.78);
        context.beginPath();
        context.moveTo(x - long, y); context.lineTo(x + long, y);
        context.moveTo(x, y - long); context.lineTo(x, y + long);
        context.moveTo(x - short, y - short); context.lineTo(x + short, y + short);
        context.moveTo(x + short, y - short); context.lineTo(x - short, y + short);
        context.stroke();
      });
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
      [this.canvas, this.sourceCanvas, this.lowCanvas, this.mediumCanvas, this.highCanvas]
        .forEach((canvas) => this.setCanvasSize(canvas, this.rootWidth, this.rootHeight));
      this.canvas.style.width = `${innerWidth}px`;
      this.canvas.style.height = `${innerHeight}px`;

      this.drawBackdrop(this.source, this.rootWidth, this.rootHeight);
      this.source.save();
      this.source.globalCompositeOperation = 'source-atop';
      this.source.filter = `brightness(${STYLE.brightness}) contrast(${STYLE.contrast}) saturate(${STYLE.saturation})`;
      this.source.drawImage(this.sourceCanvas, 0, 0);
      this.source.restore();
      this.drawBlurLevel(this.low, this.sourceCanvas, 1.8 * this.dpr);
      this.drawBlurLevel(this.medium, this.sourceCanvas, 4.8 * this.dpr);
      this.drawBlurLevel(this.high, this.sourceCanvas, 9.2 * this.dpr);

      const gl = this.gl;
      [this.sourceCanvas, this.lowCanvas, this.mediumCanvas, this.highCanvas].forEach((image, index) => {
        gl.activeTexture(gl.TEXTURE0 + index);
        gl.bindTexture(gl.TEXTURE_2D, this.textures[index]);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      });
      gl.flush();
      this.backdropDirty = false;
    }

    renderAll() {
      if (!this.program) return;
      const expectedDpr = this.chooseDpr();
      if (this.backdropDirty || this.dpr !== expectedDpr || this.rootWidth !== Math.round(innerWidth * expectedDpr) || this.rootHeight !== Math.round(innerHeight * expectedDpr)) {
        this.rebuildBackdrop();
      }
      this.prepareContext(this.output);
      this.output.clearRect(0, 0, this.rootWidth, this.rootHeight);
      this.output.drawImage(this.sourceCanvas, 0, 0);

      this.renderGlassElement(this.mainElement, this.shellState, 'main');
      if (this.sideElement && getComputedStyle(this.sideElement).visibility !== 'hidden') {
        this.renderGlassElement(this.sideElement, null, 'side');
      }
      this.controlStates.forEach((state) => this.renderGlassElement(state.element, state, 'control'));
      this.drawShellSurfaceOptics(this.shellState);
    }

    renderGlassElement(element, state, role) {
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
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.getParameter(gl.ARRAY_BUFFER_BINDING));

      const radiusCss = parseFloat(getComputedStyle(element).borderTopLeftRadius) || 22;
      const radius = Math.min(radiusCss * this.dpr, Math.min(width, height) * 0.5);
      const opticalScale = clamp(Math.min(rect.width, rect.height) / 160, 0.28, 1);
      const dynamic = state ? this.dynamicValues(state) : { press: 0, intensity: STYLE.glassIntensity };
      const blurAmount = role === 'main' ? 1.22 : role === 'side' ? 0.92 : 0.58;

      gl.uniform2f(this.locations.uResolution, width, height);
      gl.uniform2f(this.locations.uCardOrigin, rect.left * this.dpr, rect.top * this.dpr);
      gl.uniform2f(this.locations.uRootResolution, this.rootWidth, this.rootHeight);
      gl.uniform4f(this.locations.uRect, 0, 0, width, height);
      gl.uniform1f(this.locations.uRadius, radius);
      gl.uniform1f(this.locations.uIntensity, dynamic.intensity);
      gl.uniform4f(this.locations.uPress, dynamic.press, state?.centerX ?? 0.5, state?.centerY ?? 0.5, 0);
      gl.uniform1f(this.locations.uTextureReady, 1);
      gl.uniform1f(this.locations.uBlurAmount, blurAmount);
      gl.uniform1f(this.locations.uOpticalScale, opticalScale);
      gl.uniform4f(this.locations.uMaterial, STYLE.bodyVisibility, STYLE.bodyMaxAlpha, STYLE.bodyOutputBrightness, 0);
      gl.uniform4f(this.locations.uBodyLensA, STYLE.bodyLensBasePull * this.dpr, STYLE.bodyLensPullDp * this.dpr, STYLE.bodyLensConcentration, 0);
      gl.uniform4f(this.locations.uBodyLensB, STYLE.bodyLensExtraDistance * this.dpr, STYLE.bodyLensReachDp * this.dpr, STYLE.bodyLensDark, 0);
      gl.uniform4f(this.locations.uBody, STYLE.bodyWidth, STYLE.bodyCurve, STYLE.bodyGain, STYLE.bodyBrightness);
      gl.uniform4f(this.locations.uShoulder, STYLE.shoulderWidth * this.dpr, STYLE.shoulderMaxAngle, STYLE.shoulderFalloff, STYLE.shoulderMaterial);
      gl.uniform2f(this.locations.uShoulderFlow, STYLE.shoulderCaptureWidth * this.dpr, STYLE.shoulderFlow);
      gl.uniform4f(this.locations.uDispersion, STYLE.dispersionStrength, STYLE.dispersionDistance * this.dpr, STYLE.dispersionEdgeWidth * this.dpr, STYLE.dispersionConcentration);
      this.textures.forEach((texture, index) => {
        gl.activeTexture(gl.TEXTURE0 + index);
        gl.bindTexture(gl.TEXTURE_2D, texture);
      });
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      this.output.drawImage(this.glCanvas, Math.round(rect.left * this.dpr), Math.round(rect.top * this.dpr), width, height);
    }

    dynamicValues(state) {
      if (state.kind === 'shell') {
        const positive = Math.max(state.pressValue, 0);
        const compression = smoothStep(clamp(positive / 0.72, 0, 1));
        return {
          press: clamp(state.openGlPress, 0, 1),
          intensity: clamp(STYLE.glassIntensity * (1 + compression * 0.10), 0.35, 1.35),
        };
      }
      const positive = Math.max(state.material, 0);
      const rebound = smoothStep(clamp(-state.material / 0.18, 0, 1));
      const compression = smoothStep(clamp(positive / 0.94, 0, 1));
      return {
        press: clamp(Math.max(positive, state.lens * 0.86, rebound * 0.28), 0, 1),
        intensity: clamp(1.10 * (1 + compression * 0.19), 0.35, 1.35),
      };
    }

    drawShellSurfaceOptics(state) {
      if (!state?.element) return;
      const positive = Math.max(state.pressValue, 0);
      const rebound = smoothStep(clamp(-state.pressValue / 0.10, 0, 1));
      const safePress = clamp(Math.max(positive, state.openGlPress * 0.62, rebound * 0.24), 0, 1.08);
      if (safePress < 0.001) return;
      const rect = state.element.getBoundingClientRect();
      const x = rect.left * this.dpr;
      const y = rect.top * this.dpr;
      const w = rect.width * this.dpr;
      const h = rect.height * this.dpr;
      const radius = (parseFloat(getComputedStyle(state.element).borderTopLeftRadius) || 44) * this.dpr;
      const raw = clamp(safePress / 0.72, 0, 1);
      const p = smoothStep(raw);
      const breath = smoothStep(clamp(safePress / 0.50, 0, 1)) * (1 - 0.11 * smoothStep(clamp((safePress - 0.58) / 0.28, 0, 1)));
      const compression = p * p;
      const cx = clamp(state.centerX, 0, 1) * w;
      const cy = clamp(state.centerY, 0, 1) * h;
      const maxSide = Math.max(w, h);
      const nearEdge = (distance) => clamp(1 - distance / 0.42, 0, 1) * p;
      const topNear = nearEdge(state.centerY);
      const bottomNear = nearEdge(1 - state.centerY);
      const leftNear = nearEdge(state.centerX);
      const rightNear = nearEdge(1 - state.centerX);
      const flow = smoothStep(clamp(safePress / 0.62, 0, 1));
      const seedShift = (state.rimFlowSeed - 0.5) * 0.36;
      const sweepX = state.rimFlowDirection >= 0 ? -0.24 + seedShift + flow * 1.42 : 1.24 + seedShift - flow * 1.42;
      const starts = [0.02, 0.74, 0.10, 0.18];
      const ends = [0.26, 0.98, 0.92, 0.58];
      const bandStartY = starts[state.rimFlowBand % 4];
      const bandEndY = ends[state.rimFlowBand % 4];
      const bandAlpha = breath * clamp(state.rimFlowStrength, 0.70, 1.45);
      const context = this.output;

      context.save();
      roundRectPath(context, x, y, w, h, radius);
      context.clip();

      const radial = (centerX, centerY, radiusPx, stops, mode = 'screen') => {
        const gradient = context.createRadialGradient(x + centerX, y + centerY, 0, x + centerX, y + centerY, radiusPx);
        stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
        context.globalCompositeOperation = mode;
        context.fillStyle = gradient;
        context.fillRect(x, y, w, h);
      };
      radial(w * 0.5, h * 0.4, maxSide * 1.18, [[0,'rgba(255,255,255,' + (0.021 * breath) + ')'],[0.52,'rgba(216,255,255,' + (0.014 * breath) + ')'],[1,'rgba(0,0,0,0)']]);
      radial(cx, cy, maxSide * (0.86 + 0.06 * p), [[0,'rgba(239,255,255,' + (0.066 * breath) + ')'],[0.35,'rgba(184,247,255,' + (0.032 * breath) + ')'],[0.68,'rgba(130,232,255,' + (0.010 * breath) + ')'],[1,'rgba(0,0,0,0)']]);
      radial(cx, cy, maxSide * (1 + 0.035 * p), [[0,'rgba(0,0,0,0)'],[0.58,'rgba(16,44,102,' + (0.006 * p) + ')'],[1,'rgba(3,11,26,' + (0.034 * compression) + ')']], 'multiply');

      const lower = context.createLinearGradient(0, y + h * 0.44, 0, y + h);
      lower.addColorStop(0, 'rgba(0,0,0,0)'); lower.addColorStop(0.44, 'rgba(0,0,0,0)'); lower.addColorStop(1, 'rgba(2,8,21,' + (0.044 * compression) + ')');
      context.globalCompositeOperation = 'multiply'; context.fillStyle = lower; context.fillRect(x, y, w, h);
      context.restore();

      const strokeGradient = (gradient, lineWidth, composite = 'screen') => {
        context.save();
        context.globalCompositeOperation = composite;
        context.strokeStyle = gradient;
        context.lineWidth = lineWidth;
        roundRectPath(context, x + 0.56 * this.dpr, y + 0.56 * this.dpr, w - 1.12 * this.dpr, h - 1.12 * this.dpr, Math.max(0, radius - 0.56 * this.dpr));
        context.stroke();
        context.restore();
      };

      const ambient = context.createRadialGradient(x + cx, y + cy, 0, x + cx, y + cy, maxSide * 0.74);
      ambient.addColorStop(0, 'rgba(239,255,255,' + (0.052 * breath) + ')');
      ambient.addColorStop(0.42, 'rgba(146,255,241,' + (0.038 * breath) + ')');
      ambient.addColorStop(0.70, 'rgba(255,139,232,' + (0.014 * breath) + ')');
      ambient.addColorStop(1, 'rgba(0,0,0,0)');
      strokeGradient(ambient, (0.74 + 0.26 * p) * this.dpr);

      const flowing = context.createLinearGradient(x + w * (sweepX - 0.26), y + h * bandStartY, x + w * (sweepX + 0.22), y + h * bandEndY);
      flowing.addColorStop(0, 'rgba(0,0,0,0)');
      flowing.addColorStop(0.18, 'rgba(255,106,219,' + (0.20 * bandAlpha) + ')');
      flowing.addColorStop(0.38, 'rgba(255,255,255,' + (0.34 * bandAlpha) + ')');
      flowing.addColorStop(0.56, 'rgba(255,224,138,' + (0.18 * bandAlpha) + ')');
      flowing.addColorStop(0.74, 'rgba(98,255,240,' + (0.30 * bandAlpha) + ')');
      flowing.addColorStop(0.88, 'rgba(146,166,255,' + (0.12 * bandAlpha) + ')');
      flowing.addColorStop(1, 'rgba(0,0,0,0)');
      strokeGradient(flowing, 1.02 * this.dpr, 'lighter');

      const edgeHalo = (px, py, power, white, cyan) => {
        if (power <= 0.001) return;
        const gradient = context.createRadialGradient(x + px, y + py, 0, x + px, y + py, maxSide * 0.38);
        gradient.addColorStop(0, 'rgba(255,255,255,' + (white * power) + ')');
        gradient.addColorStop(0.30, 'rgba(255,125,226,' + (0.05 * power) + ')');
        gradient.addColorStop(0.55, 'rgba(255,226,138,' + (0.036 * power) + ')');
        gradient.addColorStop(0.76, 'rgba(128,255,242,' + (cyan * power) + ')');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        strokeGradient(gradient, (1.18 + 0.48 * p) * this.dpr);
      };
      edgeHalo(cx, 0, topNear, 0.23, 0.072);
      edgeHalo(cx, h, bottomNear, 0.16, 0.054);
      edgeHalo(0, cy, leftNear, 0.18, 0.060);
      edgeHalo(w, cy, rightNear, 0.18, 0.060);
      context.globalCompositeOperation = 'source-over';
    }

    attachShellInteraction(state) {
      const element = state.element;
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
        this.endShellPress(state);
      };
      element.addEventListener('pointerdown', down, { passive: true });
      window.addEventListener('pointermove', move, { passive: true });
      window.addEventListener('pointerup', up, { passive: true });
      window.addEventListener('pointercancel', up, { passive: true });
      this.cleanup.push(() => element.removeEventListener('pointerdown', down));
      this.cleanup.push(() => window.removeEventListener('pointermove', move));
      this.cleanup.push(() => window.removeEventListener('pointerup', up));
      this.cleanup.push(() => window.removeEventListener('pointercancel', up));
    }

    attachControlInteraction(state) {
      const element = state.element;
      const updateCenter = (event) => {
        const rect = element.getBoundingClientRect();
        state.centerX = clamp((event.clientX - rect.left) / Math.max(rect.width, 1), 0, 1);
        state.centerY = clamp((event.clientY - rect.top) / Math.max(rect.height, 1), 0, 1);
      };
      const down = (event) => {
        if (event.button !== undefined && event.button !== 0) return;
        state.pointerId = event.pointerId;
        updateCenter(event);
        this.beginControlPress(state);
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
        this.endControlPress(state);
      };
      element.addEventListener('pointerdown', down, { passive: true });
      window.addEventListener('pointermove', move, { passive: true });
      window.addEventListener('pointerup', up, { passive: true });
      window.addEventListener('pointercancel', up, { passive: true });
      this.cleanup.push(() => element.removeEventListener('pointerdown', down));
      this.cleanup.push(() => window.removeEventListener('pointermove', move));
      this.cleanup.push(() => window.removeEventListener('pointerup', up));
      this.cleanup.push(() => window.removeEventListener('pointercancel', up));
    }

    detachInteractions() {
      this.cleanup.splice(0).forEach((remove) => remove());
    }

    beginShellPress(state) {
      state.rimFlowSeed = Math.random();
      state.rimFlowDirection = Math.random() >= 0.5 ? 1 : -1;
      state.rimFlowBand = Math.floor(Math.random() * 4);
      state.rimFlowStrength = 0.86 + Math.random() * 0.52;
      if (state.pressValue < 0.18) state.pressValue = 0.18;
      this.setSequence(state, 'pressValue', [
        tweenStep(0.42, 150, EASE.shellPulse),
        tweenStep(0.62, 360, EASE.shellSink),
        tweenStep(0.76, 620, EASE.fastOutSlowIn),
        tweenStep(0.62, 680, EASE.fastOutSlowIn),
        springStep(0.70, 0.95, SPRING.veryLow),
      ]);
      this.setSequence(state, 'openGlPress', [
        tweenStep(0.26, 230, EASE.shellPreload),
        tweenStep(0.72, 520, EASE.shellSink),
        tweenStep(0.88, 620, EASE.fastOutSlowIn),
        tweenStep(0.74, 680, EASE.fastOutSlowIn),
        springStep(0.80, 0.95, SPRING.veryLow),
      ]);
      this.requestRender();
    }

    endShellPress(state) {
      const openSteps = [];
      if (state.openGlPress < 0.24) openSteps.push(tweenStep(0.34, 120, EASE.shellPulse));
      openSteps.push(tweenStep(0, 560, EASE.fastOutSlowIn));
      this.setSequence(state, 'openGlPress', openSteps);
      const pressSteps = state.pressValue < 0.46
        ? [tweenStep(0.52, 105, EASE.shellPulse), tweenStep(-0.060, 150, EASE.shellRelease), springStep(0, 0.66, SPRING.low)]
        : [tweenStep(-0.065, 220, EASE.shellRelease), springStep(0, 0.66, SPRING.low)];
      this.setSequence(state, 'pressValue', pressSteps);
      this.requestRender();
    }

    beginControlPress(state) {
      if (state.material < 0.22) state.material = 0.22;
      if (state.lens < 0.18) state.lens = 0.18;
      state.sweep = 0;
      this.setSequence(state, 'material', [
        tweenStep(0.92, 132, EASE.ordinaryPress),
        tweenStep(1.10, 210, EASE.ordinarySink),
        springStep(0.94, 0.72, SPRING.mediumLow),
      ]);
      this.setSequence(state, 'lens', [
        tweenStep(0.78, 150, EASE.ordinaryPress),
        tweenStep(1.04, 330, EASE.fastOutSlowIn),
      ]);
      this.setSequence(state, 'sweep', [tweenStep(1.18, 520, EASE.fastOutSlowIn)]);
      this.requestRender();
    }

    endControlPress(state) {
      this.setSequence(state, 'material', [
        tweenStep(-0.145, 130, EASE.ordinaryRelease),
        springStep(0.060, 0.50, SPRING.mediumLow),
        springStep(0, 0.72, SPRING.low),
      ]);
      this.setSequence(state, 'lens', [
        tweenStep(0.42, 180, EASE.ordinaryRelease),
        tweenStep(0, 480, EASE.fastOutSlowIn),
      ]);
      this.setSequence(state, 'sweep', [
        tweenStep(0.18, 260, EASE.fastOutSlowIn),
        tweenStep(0, 420, EASE.fastOutSlowIn),
      ]);
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
          const stiffness = step.stiffness;
          const damping = 2 * step.dampingRatio * Math.sqrt(stiffness);
          const acceleration = -stiffness * (state[property] - step.target) - damping * animation.velocity;
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

    applyElementTransform(state) {
      const element = state.element;
      if (!element) return;
      if (state.kind === 'shell') {
        const positive = Math.max(state.pressValue, 0);
        const compression = smoothStep(clamp(positive / 0.72, 0, 1));
        const rebound = smoothStep(clamp(-state.pressValue / 0.10, 0, 1));
        const scaleX = 1 + compression * 0.014 - rebound * 0.004;
        const scaleY = 1 - compression * 0.022 + rebound * 0.008;
        const translateY = compression * 2.10 - rebound * 0.80;
        element.style.transformOrigin = `${state.centerX * 100}% ${state.centerY * 100}%`;
        element.style.transform = `translateY(${translateY}px) scale(${scaleX}, ${scaleY})`;
        return;
      }
      const positive = Math.max(state.material, 0);
      const compression = smoothStep(clamp(positive / 0.94, 0, 1));
      const rebound = smoothStep(clamp(-state.material / 0.18, 0, 1));
      const elasticity = 1;
      const scaleX = 1 + compression * (0.006 + 0.049 * elasticity) - rebound * 0.018 * elasticity;
      const scaleY = 1 - compression * (0.010 + 0.064 * elasticity) + rebound * 0.030 * elasticity;
      const translateY = compression * (0.70 + 3.90 * elasticity) - rebound * 1.55 * elasticity;
      element.style.transformOrigin = `${state.centerX * 100}% ${state.centerY * 100}%`;
      element.style.transform = `translateY(${translateY}px) scale(${scaleX}, ${scaleY})`;
    }

    resetElementTransform(state) {
      if (!state.element) return;
      state.element.style.transform = '';
      state.element.style.transformOrigin = '';
    }
  }

  function tweenStep(target, duration, easing) { return { type: 'tween', target, duration, easing }; }
  function springStep(target, dampingRatio, stiffness) { return { type: 'spring', target, dampingRatio, stiffness }; }

  window.BlogGlassRenderer = BlogGlassRenderer;
})();
