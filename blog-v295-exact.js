(() => {
  'use strict';

  const SHOULDER_CAPTURE_WIDTH_PX = 96;
  const P = Object.freeze({
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
    edgeMode: 2,
    shoulderWidthPx: 38.189,
    shoulderMaxAngleDeg: 89.5,
    shoulderFalloffRoundness: 0,
    shoulderMaterialStrength: 1.119,
    shoulderTangentialFlowStrength: 0,
  });

  const dpr = () => Math.min(window.devicePixelRatio || 1, 2);

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

  function size(canvas, width, height) {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
  }

  function smoothContext(context) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.imageSmoothingEnabled = true;
    try { context.imageSmoothingQuality = 'high'; } catch (_) {}
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
    context.filter = 'none';
  }

  function drawBlogBackdrop(context, width, height) {
    smoothContext(context);
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
      const radius = (0.55 + random() * 1.18) * dpr();
      const color = palette[Math.floor(random() * palette.length)];
      context.globalAlpha = 0.30 + random() * 0.56;
      context.fillStyle = color;
      context.shadowColor = color;
      context.shadowBlur = 3.5 * dpr();
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
    context.shadowBlur = 0;
    context.globalAlpha = 1;
  }

  function shift(destination, source, width, height, step, horizontal) {
    smoothContext(destination);
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
        height,
      );
    }
    destination.restore();
    destination.save();
    destination.globalCompositeOperation = 'destination-over';
    destination.drawImage(source, 0, 0, width, height);
    destination.restore();
  }

  class ExactV295BlogRenderer {
    constructor(backgroundCanvas) {
      this.backgroundCanvas = backgroundCanvas;
      this.backgroundContext = backgroundCanvas.getContext('2d');
      this.reader = backgroundCanvas.parentElement;

      this.sourceCanvas = document.createElement('canvas');
      this.sourceContext = this.sourceCanvas.getContext('2d');
      this.colorCanvas = document.createElement('canvas');
      this.colorContext = this.colorCanvas.getContext('2d');
      this.blurA = document.createElement('canvas');
      this.blurAContext = this.blurA.getContext('2d');
      this.blurB = document.createElement('canvas');
      this.blurBContext = this.blurB.getContext('2d');
      this.blurCanvas = document.createElement('canvas');
      this.blurContext = this.blurCanvas.getContext('2d');

      this.opticalCanvas = document.createElement('canvas');
      this.opticalContext = this.opticalCanvas.getContext('2d');
      this.opticalCanvas.className = 'article-v295-optical-canvas';
      Object.assign(this.opticalCanvas.style, {
        position: 'absolute',
        inset: '0',
        width: '100%',
        height: '100%',
        zIndex: '1',
        pointerEvents: 'none',
      });
      this.reader.insertBefore(this.opticalCanvas, this.reader.querySelector('.article-reader-stage'));

      this.glCanvas = document.createElement('canvas');
      this.gl = this.glCanvas.getContext('webgl', {
        alpha: true,
        premultipliedAlpha: false,
        preserveDrawingBuffer: true,
        antialias: false,
      });

      this.program = null;
      this.buffer = null;
      this.locations = null;
      this.blurTexture = null;
      this.targets = [];
      this.pixelRatio = 1;
      this.rootWidth = 1;
      this.rootHeight = 1;
      this.running = false;
      this.frame = 0;
      this.resizeObserver = null;
      this.classObserver = null;
      this.needsBackdrop = true;
      this.boundSchedule = () => this.schedule(true);
    }

    initialise() {
      if (!this.gl || !window.OpenGLV24Shaders) return false;
      if (!this.backgroundContext || !this.sourceContext || !this.colorContext || !this.blurAContext || !this.blurBContext || !this.blurContext || !this.opticalContext) return false;
      try {
        this.initialiseGl();
        return true;
      } catch (error) {
        console.error('[V29.5] initialise failed', error);
        return false;
      }
    }

    initialiseGl() {
      const gl = this.gl;
      const { vs, fs } = window.OpenGLV24Shaders;
      const compile = (type, source) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
        return shader;
      };

      this.program = gl.createProgram();
      gl.attachShader(this.program, compile(gl.VERTEX_SHADER, vs));
      gl.attachShader(this.program, compile(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(this.program);
      if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(this.program));

      this.buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

      const names = [
        'a', 'uRes', 'uOrigin', 'uRoot', 'uBlurTexture', 'uMat',
        'uBodyLensA', 'uBodyLensB', 'uBody', 'uShoulder',
        'uShoulderFlow', 'uShoulderEnabled', 'uRadius', 'uIntensity',
      ];
      this.locations = {};
      for (const name of names) {
        this.locations[name] = name === 'a' ? gl.getAttribLocation(this.program, name) : gl.getUniformLocation(this.program, name);
      }
      const missing = names.filter((name) => name === 'a' ? this.locations[name] < 0 : this.locations[name] === null);
      if (missing.length) throw new Error(`V29.5 uniforms missing: ${missing.join(', ')}`);

      this.blurTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.blurTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    bind(mainElement, controlElements) {
      this.targets = [mainElement, document.getElementById('articleToc'), ...controlElements].filter(Boolean);
      this.targets.forEach((element) => {
        element.classList.add('v295-exact-host');
        element.style.background = 'transparent';
        if (element.matches('button') && !element.querySelector('.v295-exact-label')) {
          const label = document.createElement('span');
          label.className = 'v295-exact-label';
          while (element.firstChild) label.appendChild(element.firstChild);
          element.appendChild(label);
        }
      });

      this.resizeObserver?.disconnect();
      this.resizeObserver = new ResizeObserver(() => this.schedule(true));
      this.targets.forEach((element) => this.resizeObserver.observe(element));

      this.classObserver?.disconnect();
      this.classObserver = new MutationObserver(() => this.schedule(false));
      this.classObserver.observe(this.reader, { attributes: true, attributeFilter: ['class', 'hidden'] });
      this.schedule(true);
    }

    start() {
      if (this.running) return;
      this.running = true;
      addEventListener('resize', this.boundSchedule, { passive: true });
      this.schedule(true);
    }

    stop() {
      this.running = false;
      cancelAnimationFrame(this.frame);
      this.frame = 0;
      removeEventListener('resize', this.boundSchedule);
      this.resizeObserver?.disconnect();
      this.classObserver?.disconnect();
      this.targets.forEach((element) => {
        element.classList.remove('v295-exact-host');
        element.style.background = '';
      });
      this.targets = [];
      this.opticalCanvas.remove();
    }

    schedule(rebuildBackdrop) {
      if (!this.running && !rebuildBackdrop) return;
      if (rebuildBackdrop) this.needsBackdrop = true;
      cancelAnimationFrame(this.frame);
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        if (document.hidden || this.reader.hidden) return;
        if (this.needsBackdrop) {
          this.rebuildBackdrop();
          this.needsBackdrop = false;
        }
        this.renderAll();
      });
    }

    rebuildBackdrop() {
      this.pixelRatio = dpr();
      this.rootWidth = Math.max(1, Math.round(this.reader.clientWidth * this.pixelRatio));
      this.rootHeight = Math.max(1, Math.round(this.reader.clientHeight * this.pixelRatio));

      [this.backgroundCanvas, this.sourceCanvas, this.colorCanvas, this.blurCanvas, this.blurA, this.blurB, this.opticalCanvas].forEach((canvas) => size(canvas, this.rootWidth, this.rootHeight));
      this.backgroundCanvas.style.width = `${this.reader.clientWidth}px`;
      this.backgroundCanvas.style.height = `${this.reader.clientHeight}px`;

      drawBlogBackdrop(this.backgroundContext, this.rootWidth, this.rootHeight);
      drawBlogBackdrop(this.sourceContext, this.rootWidth, this.rootHeight);

      smoothContext(this.colorContext);
      this.colorContext.clearRect(0, 0, this.rootWidth, this.rootHeight);
      this.colorContext.save();
      this.colorContext.filter = `brightness(${P.brightness}) contrast(${P.contrast}) saturate(${P.saturation})`;
      this.colorContext.drawImage(this.sourceCanvas, 0, 0, this.rootWidth, this.rootHeight);
      this.colorContext.restore();

      const radius = Math.max(0, P.radius * this.pixelRatio * Math.pow(Math.max(1, P.iterations), 0.55));
      smoothContext(this.blurContext);
      this.blurContext.clearRect(0, 0, this.rootWidth, this.rootHeight);
      if (radius <= 0.025) {
        this.blurContext.drawImage(this.colorCanvas, 0, 0, this.rootWidth, this.rootHeight);
      } else {
        const passes = Math.max(1, Math.min(3, Math.ceil(P.iterations / 4)));
        const step = Math.max(0.25, radius / Math.sqrt(2 * passes));
        let current = this.colorCanvas;
        for (let index = 0; index < passes; index += 1) {
          shift(this.blurAContext, current, this.rootWidth, this.rootHeight, step, true);
          shift(this.blurBContext, this.blurA, this.rootWidth, this.rootHeight, step, false);
          current = this.blurB;
        }
        this.blurContext.drawImage(current, 0, 0, this.rootWidth, this.rootHeight);
      }

      const gl = this.gl;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.blurTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.blurCanvas);
    }

    renderAll() {
      smoothContext(this.opticalContext);
      this.opticalContext.clearRect(0, 0, this.rootWidth, this.rootHeight);

      const readerRect = this.reader.getBoundingClientRect();
      for (const element of this.targets) {
        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
        const rect = element.getBoundingClientRect();
        if (rect.width <= 1 || rect.height <= 1) continue;

        const width = Math.max(1, Math.round(rect.width * this.pixelRatio));
        const height = Math.max(1, Math.round(rect.height * this.pixelRatio));
        const originX = Math.round((rect.left - readerRect.left) * this.pixelRatio);
        const originY = Math.round((rect.top - readerRect.top) * this.pixelRatio);

        this.renderTarget(width, height, originX, originY);
        this.opticalContext.drawImage(this.glCanvas, originX, originY, width, height);
      }
    }

    renderTarget(width, height, originX, originY) {
      size(this.glCanvas, width, height);
      const gl = this.gl;
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(this.program);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.enableVertexAttribArray(this.locations.a);
      gl.vertexAttribPointer(this.locations.a, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.blurTexture);

      gl.uniform2f(this.locations.uRes, width, height);
      gl.uniform2f(this.locations.uOrigin, originX, originY);
      gl.uniform2f(this.locations.uRoot, this.rootWidth, this.rootHeight);
      gl.uniform1f(this.locations.uRadius, 46 * this.pixelRatio);
      gl.uniform1f(this.locations.uIntensity, P.glassIntensity);
      gl.uniform4f(this.locations.uMat, P.bodyVisibility, P.bodyMaxAlpha, P.bodyOutputBrightness, 0);
      gl.uniform4f(this.locations.uBodyLensA, P.bodyLensBasePull * this.pixelRatio, P.bodyLensPullDp * this.pixelRatio, P.bodyLensConcentration, P.bodyLensCornerBoost);
      gl.uniform4f(this.locations.uBodyLensB, P.bodyLensExtraDistance * this.pixelRatio, P.bodyLensReachDp * this.pixelRatio, P.bodyLensDark, P.bodyLensDebug);
      gl.uniform4f(this.locations.uBody, P.bodyLowFrequencyWidth, P.bodyLowFrequencyCurve, P.bodyLowFrequencyGain, P.bodyBrightness);
      gl.uniform4f(this.locations.uShoulder, P.shoulderWidthPx * this.pixelRatio, P.shoulderMaxAngleDeg, P.shoulderFalloffRoundness, P.shoulderMaterialStrength);
      gl.uniform2f(this.locations.uShoulderFlow, SHOULDER_CAPTURE_WIDTH_PX * this.pixelRatio, P.shoulderTangentialFlowStrength);
      gl.uniform1f(this.locations.uShoulderEnabled, P.edgeMode);
      gl.uniform1i(this.locations.uBlurTexture, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.finish();
    }
  }

  window.BlogGlassRenderer = ExactV295BlogRenderer;
})();
