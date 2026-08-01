(() => {
  'use strict';

  const APP_RAW = Object.freeze({
    radius: 0.230414746543779,
    iterations: 12,
    brightness: 1.14239631336406,
    contrast: 1.0241935483871,
    saturation: 1.112,
    bodyVisibility: 20,
    bodyMaxAlpha: 1,
    bodyOutputBrightness: 1.81152073732719,
    bodyLensBasePull: 300,
    bodyLensPullDp: 600,
    bodyLensConcentration: 10,
    bodyLensCornerBoost: 0,
    bodyLensExtraDistance: 200,
    bodyLensReachDp: 180,
    bodyLensDark: 0.23041474654378,
    bodyLensDebug: 0,
    bodyLowFrequencyWidth: 1.25059907834101,
    bodyLowFrequencyCurve: 0.2,
    bodyLowFrequencyGain: 12.4423963133641,
    bodyBrightness: 0.545161290322581,
    glassIntensity: 1.35,
    edgeMode: 5,
    shoulderWidthPx: 21.7162162162162,
    shoulderMaxAngleDeg: 89.5,
    shoulderFalloffRoundness: 0,
    shoulderMaterialStrength: 4,
    shoulderTangentialFlowStrength: 0,
    shoulderTangentialCorrection: 0.45,
    shoulderCaptureWidthPx: 96
  });

  const REFERENCE_SHORT_EDGE_PX = 160;
  const MIN_OPTICAL_SCALE = 0.28;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
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
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance'
      });

      this.sourceCanvas = document.createElement('canvas');
      this.colourCanvas = document.createElement('canvas');
      this.blurA = document.createElement('canvas');
      this.blurB = document.createElement('canvas');
      this.blurCanvas = document.createElement('canvas');
      this.source = this.sourceCanvas.getContext('2d');
      this.colour = this.colourCanvas.getContext('2d');
      this.blurACtx = this.blurA.getContext('2d');
      this.blurBCtx = this.blurB.getContext('2d');
      this.blurCtx = this.blurCanvas.getContext('2d');

      this.program = null;
      this.locations = null;
      this.texture = null;
      this.mainElement = null;
      this.sideElement = null;
      this.controlElements = [];
      this.dpr = 1;
      this.rootWidth = 1;
      this.rootHeight = 1;
      this.frame = 0;
      this.running = false;
      this.backdropDirty = true;
      this.resizeObserver = null;
      this.classObserver = null;
      this.boundSchedule = () => this.schedule();
    }

    initialise() {
      if (!this.gl || !this.output || !window.OpenGLV24Shaders) return false;
      const gl = this.gl;
      const { vs, fs } = window.OpenGLV24Shaders;
      const vertexShader = this.compile(gl.VERTEX_SHADER, vs);
      const fragmentShader = this.compile(gl.FRAGMENT_SHADER, fs);
      if (!vertexShader || !fragmentShader) return false;

      const program = gl.createProgram();
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.warn('Original glass program failed:', gl.getProgramInfoLog(program));
        return false;
      }

      this.program = program;
      const names = [
        'a', 'uRes', 'uOrigin', 'uRoot', 'uBlurTexture', 'uMat',
        'uBodyLensA', 'uBodyLensB', 'uBody', 'uShoulder',
        'uShoulderFlow', 'uShoulderCorrection', 'uShoulderEnabled',
        'uRadius', 'uIntensity'
      ];
      this.locations = {};
      names.forEach((name) => {
        this.locations[name] = name === 'a'
          ? gl.getAttribLocation(program, name)
          : gl.getUniformLocation(program, name);
      });

      const missing = names.filter((name) => name === 'a'
        ? this.locations[name] < 0
        : this.locations[name] === null);
      if (missing.length) {
        console.warn('Original glass uniforms missing:', missing.join(', '));
        return false;
      }

      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
        gl.STATIC_DRAW
      );
      gl.useProgram(program);
      gl.enableVertexAttribArray(this.locations.a);
      gl.vertexAttribPointer(this.locations.a, 2, gl.FLOAT, false, 0, 0);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.clearColor(0, 0, 0, 0);

      this.texture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform1i(this.locations.uBlurTexture, 0);
      return true;
    }

    compile(type, source) {
      const gl = this.gl;
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn('Original glass shader failed:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    bind(mainElement, controlElements) {
      this.mainElement = mainElement;
      this.sideElement = document.getElementById('articleToc');
      this.controlElements = [...controlElements];

      this.resizeObserver?.disconnect();
      this.resizeObserver = new ResizeObserver(this.boundSchedule);
      [this.mainElement, this.sideElement, ...this.controlElements]
        .filter(Boolean)
        .forEach((element) => this.resizeObserver.observe(element));

      this.classObserver?.disconnect();
      const reader = document.getElementById('articleReader');
      if (reader) {
        this.classObserver = new MutationObserver(this.boundSchedule);
        this.classObserver.observe(reader, { attributes: true, attributeFilter: ['class', 'hidden'] });
      }
      this.backdropDirty = true;
      this.schedule();
    }

    start() {
      this.running = true;
      this.backdropDirty = true;
      this.schedule();
    }

    stop() {
      this.running = false;
      cancelAnimationFrame(this.frame);
      this.frame = 0;
      this.resizeObserver?.disconnect();
      this.classObserver?.disconnect();
    }

    schedule() {
      if (!this.running || this.frame) return;
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        this.renderAll();
      });
    }

    chooseDpr() {
      const device = window.devicePixelRatio || 1;
      if (innerWidth <= 560) return Math.min(device, 1);
      if (innerWidth <= 1180) return Math.min(device, 1.15);
      return Math.min(device, 1.45);
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
      vertical.addColorStop(0, '#120721');
      vertical.addColorStop(0.34, '#45204c');
      vertical.addColorStop(0.64, '#25315c');
      vertical.addColorStop(1, '#09142f');
      context.fillStyle = vertical;
      context.fillRect(0, 0, width, height);

      const glow = (x, y, radius, colour) => {
        const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, colour);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        context.fillStyle = gradient;
        context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      };
      glow(width * 0.20, height * 0.22, width * 0.48, 'rgba(235,82,175,.30)');
      glow(width * 0.80, height * 0.26, width * 0.46, 'rgba(65,190,238,.26)');
      glow(width * 0.50, height * 0.52, width * 0.40, 'rgba(142,87,216,.18)');

      const random = mulberry32(20260801);
      for (let index = 0; index < 78; index += 1) {
        const x = random() * width;
        const y = random() * height;
        const radius = (0.65 + random() * 1.25) * this.dpr;
        const palette = ['#ff81c6', '#78eaff', '#b891ff', '#ffd36a', '#8ef1c8'];
        const colour = palette[Math.floor(random() * palette.length)];
        context.globalAlpha = 0.34 + random() * 0.56;
        context.fillStyle = colour;
        context.shadowColor = colour;
        context.shadowBlur = 3.5 * this.dpr;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }

      const crosses = [
        [0.11, 0.23, '#ff9acb'], [0.51, 0.20, '#88ebff'],
        [0.79, 0.80, '#98f2d0'], [0.34, 0.87, '#ffd477'],
        [0.96, 0.58, '#ee8ec9']
      ];
      crosses.forEach(([nx, ny, colour]) => {
        const x = width * nx;
        const y = height * ny;
        const long = 17 * this.dpr;
        const short = 6 * this.dpr;
        context.globalAlpha = 0.74;
        context.strokeStyle = colour;
        context.shadowColor = colour;
        context.shadowBlur = 9 * this.dpr;
        context.lineWidth = Math.max(1, this.dpr * 0.8);
        context.beginPath();
        context.moveTo(x - long, y);
        context.lineTo(x + long, y);
        context.moveTo(x, y - long);
        context.lineTo(x, y + long);
        context.moveTo(x - short, y - short);
        context.lineTo(x + short, y + short);
        context.moveTo(x + short, y - short);
        context.lineTo(x - short, y + short);
        context.stroke();
      });

      context.shadowBlur = 0;
      context.globalAlpha = 1;
    }

    shiftAverage(destination, source, width, height, step, horizontal) {
      this.prepareContext(destination);
      destination.clearRect(0, 0, width, height);
      destination.save();
      destination.globalCompositeOperation = 'lighter';
      destination.globalAlpha = 0.2;
      for (let index = -2; index <= 2; index += 1) {
        destination.drawImage(
          source,
          horizontal ? index * step : 0,
          horizontal ? 0 : index * step,
          width,
          height
        );
      }
      destination.restore();
      destination.save();
      destination.globalCompositeOperation = 'destination-over';
      destination.drawImage(source, 0, 0, width, height);
      destination.restore();
    }

    rebuildBackdrop() {
      this.dpr = this.chooseDpr();
      this.rootWidth = Math.max(1, Math.round(innerWidth * this.dpr));
      this.rootHeight = Math.max(1, Math.round(innerHeight * this.dpr));
      [this.canvas, this.sourceCanvas, this.colourCanvas, this.blurA, this.blurB, this.blurCanvas]
        .forEach((canvas) => this.setCanvasSize(canvas, this.rootWidth, this.rootHeight));
      this.canvas.style.width = `${innerWidth}px`;
      this.canvas.style.height = `${innerHeight}px`;

      this.drawBackdrop(this.source, this.rootWidth, this.rootHeight);
      this.prepareContext(this.colour);
      this.colour.clearRect(0, 0, this.rootWidth, this.rootHeight);
      this.colour.save();
      this.colour.filter = `brightness(${APP_RAW.brightness}) contrast(${APP_RAW.contrast}) saturate(${APP_RAW.saturation})`;
      this.colour.drawImage(this.sourceCanvas, 0, 0);
      this.colour.restore();

      const effectiveBlur = Math.max(
        0,
        APP_RAW.radius * this.dpr * Math.pow(Math.max(1, APP_RAW.iterations), 0.55)
      );
      const passes = Math.max(1, Math.min(3, Math.ceil(APP_RAW.iterations / 4)));
      const step = Math.max(0.25, effectiveBlur / Math.sqrt(2 * passes));
      let current = this.colourCanvas;
      for (let pass = 0; pass < passes; pass += 1) {
        this.shiftAverage(this.blurACtx, current, this.rootWidth, this.rootHeight, step, true);
        this.shiftAverage(this.blurBCtx, this.blurA, this.rootWidth, this.rootHeight, step, false);
        current = this.blurB;
      }
      this.prepareContext(this.blurCtx);
      this.blurCtx.clearRect(0, 0, this.rootWidth, this.rootHeight);
      this.blurCtx.drawImage(current, 0, 0);

      const gl = this.gl;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.blurCanvas);
      gl.flush();
      this.backdropDirty = false;
    }

    opticalScaleFor(rect) {
      return clamp(
        Math.min(rect.width, rect.height) / REFERENCE_SHORT_EDGE_PX,
        MIN_OPTICAL_SCALE,
        1
      );
    }

    renderGlassElement(element) {
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

      const cssRadius = parseFloat(getComputedStyle(element).borderTopLeftRadius) || 22;
      const radius = Math.min(cssRadius * this.dpr, Math.min(width, height) * 0.5);
      const scale = this.opticalScaleFor(rect);
      const distanceScale = this.dpr * scale;

      gl.uniform2f(this.locations.uRes, width, height);
      gl.uniform2f(this.locations.uOrigin, rect.left * this.dpr, rect.top * this.dpr);
      gl.uniform2f(this.locations.uRoot, this.rootWidth, this.rootHeight);
      gl.uniform1f(this.locations.uRadius, radius);
      gl.uniform1f(this.locations.uIntensity, APP_RAW.glassIntensity);
      gl.uniform4f(
        this.locations.uMat,
        APP_RAW.bodyVisibility,
        APP_RAW.bodyMaxAlpha,
        APP_RAW.bodyOutputBrightness,
        0
      );
      gl.uniform4f(
        this.locations.uBodyLensA,
        APP_RAW.bodyLensBasePull * distanceScale,
        APP_RAW.bodyLensPullDp * distanceScale,
        APP_RAW.bodyLensConcentration,
        APP_RAW.bodyLensCornerBoost
      );
      gl.uniform4f(
        this.locations.uBodyLensB,
        APP_RAW.bodyLensExtraDistance * distanceScale,
        APP_RAW.bodyLensReachDp * distanceScale,
        APP_RAW.bodyLensDark,
        APP_RAW.bodyLensDebug
      );
      gl.uniform4f(
        this.locations.uBody,
        APP_RAW.bodyLowFrequencyWidth,
        APP_RAW.bodyLowFrequencyCurve,
        APP_RAW.bodyLowFrequencyGain,
        APP_RAW.bodyBrightness
      );
      gl.uniform4f(
        this.locations.uShoulder,
        APP_RAW.shoulderWidthPx * distanceScale,
        APP_RAW.shoulderMaxAngleDeg,
        APP_RAW.shoulderFalloffRoundness,
        APP_RAW.shoulderMaterialStrength
      );
      gl.uniform2f(
        this.locations.uShoulderFlow,
        APP_RAW.shoulderCaptureWidthPx * distanceScale,
        APP_RAW.shoulderTangentialFlowStrength
      );
      gl.uniform1f(this.locations.uShoulderCorrection, APP_RAW.shoulderTangentialCorrection);
      gl.uniform1f(this.locations.uShoulderEnabled, APP_RAW.edgeMode);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      this.output.drawImage(
        this.glCanvas,
        Math.round(rect.left * this.dpr),
        Math.round(rect.top * this.dpr),
        width,
        height
      );
    }

    renderAll() {
      if (!this.running || !this.program) return;
      const expectedDpr = this.chooseDpr();
      const expectedWidth = Math.round(innerWidth * expectedDpr);
      const expectedHeight = Math.round(innerHeight * expectedDpr);
      if (
        this.backdropDirty ||
        this.rootWidth !== expectedWidth ||
        this.rootHeight !== expectedHeight
      ) {
        this.rebuildBackdrop();
      }

      this.prepareContext(this.output);
      this.output.clearRect(0, 0, this.rootWidth, this.rootHeight);
      this.output.drawImage(this.sourceCanvas, 0, 0);

      this.renderGlassElement(this.mainElement);
      if (this.sideElement && getComputedStyle(this.sideElement).visibility !== 'hidden') {
        this.renderGlassElement(this.sideElement);
      }
      this.controlElements.forEach((element) => this.renderGlassElement(element));
    }
  }

  window.BlogGlassRenderer = BlogGlassRenderer;
})();
