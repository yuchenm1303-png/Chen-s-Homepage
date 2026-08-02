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

  function compileProgram(gl) {
    const { vs, fs } = window.OpenGLV24Shaders;
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader) || 'Shader compilation failed');
      }
      return shader;
    };

    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'Shader link failed');
    }
    return program;
  }

  class StandardGlassHost {
    constructor(element) {
      this.element = element;
      this.backdropCanvas = null;
      this.backdropContext = null;
      this.glCanvas = null;
      this.gl = null;
      this.program = null;
      this.buffer = null;
      this.locations = null;
      this.blurTexture = null;
      this.backdropRevision = -1;
      this.ready = false;
    }

    initialise() {
      if (this.ready) return true;

      if (this.element.matches('button') && !this.element.querySelector('.v295-standard-label')) {
        const label = document.createElement('span');
        label.className = 'v295-standard-label';
        while (this.element.firstChild) label.appendChild(this.element.firstChild);
        this.element.appendChild(label);
      }

      this.backdropCanvas = document.createElement('canvas');
      this.backdropCanvas.className = 'v295-standard-gb';
      this.backdropCanvas.setAttribute('aria-hidden', 'true');
      this.backdropContext = this.backdropCanvas.getContext('2d');

      this.glCanvas = document.createElement('canvas');
      this.glCanvas.className = 'v295-standard-gl';
      this.glCanvas.setAttribute('aria-hidden', 'true');
      this.gl = this.glCanvas.getContext('webgl', {
        alpha: true,
        premultipliedAlpha: false,
      });

      if (!this.backdropContext || !this.gl) return false;

      this.program = compileProgram(this.gl);
      this.buffer = this.gl.createBuffer();
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
      this.gl.bufferData(
        this.gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
        this.gl.STATIC_DRAW,
      );

      const names = [
        'a', 'uRes', 'uOrigin', 'uRoot', 'uBlurTexture', 'uMat',
        'uBodyLensA', 'uBodyLensB', 'uBody', 'uShoulder',
        'uShoulderFlow', 'uShoulderEnabled', 'uRadius', 'uIntensity',
      ];
      this.locations = {};
      for (const name of names) {
        this.locations[name] = name === 'a'
          ? this.gl.getAttribLocation(this.program, name)
          : this.gl.getUniformLocation(this.program, name);
      }
      const missing = names.filter((name) => (
        name === 'a' ? this.locations[name] < 0 : this.locations[name] === null
      ));
      if (missing.length) throw new Error(`V29.5 uniforms missing: ${missing.join(', ')}`);

      this.blurTexture = this.gl.createTexture();
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.blurTexture);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

      this.element.classList.add('v295-standard-host');
      this.element.prepend(this.backdropCanvas, this.glCanvas);
      this.ready = true;
      return true;
    }

    isVisible() {
      const style = getComputedStyle(this.element);
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity) !== 0;
    }

    uploadBackdrop(blurCanvas, revision) {
      if (this.backdropRevision === revision) return;
      const gl = this.gl;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.blurTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        blurCanvas,
      );
      gl.flush();
      this.backdropRevision = revision;
    }

    drawBackdropCrop(blurCanvas, originX, originY, width, height) {
      size(this.backdropCanvas, width, height);
      smoothContext(this.backdropContext);
      this.backdropContext.clearRect(0, 0, width, height);
      this.backdropContext.drawImage(
        blurCanvas,
        originX,
        originY,
        width,
        height,
        0,
        0,
        width,
        height,
      );
    }

    render({ readerRect, pixelRatio, rootWidth, rootHeight, blurCanvas, revision }) {
      if (!this.ready || !this.isVisible()) return false;

      const rect = this.element.getBoundingClientRect();
      if (rect.width <= 1 || rect.height <= 1) return false;

      const width = Math.max(1, Math.round(rect.width * pixelRatio));
      const height = Math.max(1, Math.round(rect.height * pixelRatio));
      const originX = Math.round((rect.left - readerRect.left) * pixelRatio);
      const originY = Math.round((rect.top - readerRect.top) * pixelRatio);

      size(this.glCanvas, width, height);
      this.drawBackdropCrop(blurCanvas, originX, originY, width, height);
      this.uploadBackdrop(blurCanvas, revision);

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

      const computedRadius = parseFloat(getComputedStyle(this.element).borderTopLeftRadius) || 46;
      gl.uniform2f(this.locations.uRes, width, height);
      gl.uniform2f(this.locations.uOrigin, originX, originY);
      gl.uniform2f(this.locations.uRoot, rootWidth, rootHeight);
      gl.uniform1f(this.locations.uRadius, computedRadius * pixelRatio);
      gl.uniform1f(this.locations.uIntensity, P.glassIntensity);
      gl.uniform4f(
        this.locations.uMat,
        P.bodyVisibility,
        P.bodyMaxAlpha,
        P.bodyOutputBrightness,
        0,
      );
      gl.uniform4f(
        this.locations.uBodyLensA,
        P.bodyLensBasePull * pixelRatio,
        P.bodyLensPullDp * pixelRatio,
        P.bodyLensConcentration,
        P.bodyLensCornerBoost,
      );
      gl.uniform4f(
        this.locations.uBodyLensB,
        P.bodyLensExtraDistance * pixelRatio,
        P.bodyLensReachDp * pixelRatio,
        P.bodyLensDark,
        P.bodyLensDebug,
      );
      gl.uniform4f(
        this.locations.uBody,
        P.bodyLowFrequencyWidth,
        P.bodyLowFrequencyCurve,
        P.bodyLowFrequencyGain,
        P.bodyBrightness,
      );
      gl.uniform4f(
        this.locations.uShoulder,
        P.shoulderWidthPx * pixelRatio,
        P.shoulderMaxAngleDeg,
        P.shoulderFalloffRoundness,
        P.shoulderMaterialStrength,
      );
      gl.uniform2f(
        this.locations.uShoulderFlow,
        SHOULDER_CAPTURE_WIDTH_PX * pixelRatio,
        P.shoulderTangentialFlowStrength,
      );
      gl.uniform1f(this.locations.uShoulderEnabled, P.edgeMode);
      gl.uniform1i(this.locations.uBlurTexture, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.flush();
      return true;
    }
  }

  class StandardBlogGlassRenderer {
    constructor(backgroundCanvas) {
      this.backgroundCanvas = backgroundCanvas;
      this.backgroundContext = backgroundCanvas?.getContext('2d') || null;
      this.reader = backgroundCanvas?.parentElement || null;

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

      this.hostMap = new Map();
      this.hosts = [];
      this.pixelRatio = 1;
      this.rootWidth = 1;
      this.rootHeight = 1;
      this.backdropRevision = 0;
      this.running = false;
      this.frame = 0;
      this.needsBackdrop = true;
      this.resizeObserver = null;
      this.classObserver = null;
      this.boundSchedule = () => this.schedule(true);
    }

    initialise() {
      const contexts = [
        this.backgroundContext,
        this.sourceContext,
        this.colorContext,
        this.blurAContext,
        this.blurBContext,
        this.blurContext,
      ];
      return Boolean(
        this.reader
        && window.OpenGLV24Shaders
        && contexts.every(Boolean)
      );
    }

    bind(mainElement, controlElements) {
      const targets = [
        mainElement,
        document.getElementById('articleToc'),
        ...controlElements,
      ].filter(Boolean);

      this.hosts = targets.map((element) => {
        let host = this.hostMap.get(element);
        if (!host) {
          host = new StandardGlassHost(element);
          try {
            if (!host.initialise()) throw new Error('WebGL host initialisation unavailable');
            this.hostMap.set(element, host);
          } catch (error) {
            console.error('[Standard V29.5] host initialisation failed', error);
            element.classList.add('v295-standard-fallback');
          }
        }
        return host;
      }).filter((host) => host?.ready);

      this.resizeObserver?.disconnect();
      this.resizeObserver = new ResizeObserver(() => this.schedule(true));
      targets.forEach((element) => this.resizeObserver.observe(element));

      this.classObserver?.disconnect();
      this.classObserver = new MutationObserver(() => this.schedule(false));
      this.classObserver.observe(this.reader, {
        attributes: true,
        attributeFilter: ['class', 'hidden'],
      });

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
      this.reader?.classList.remove('v295-ready');
      this.needsBackdrop = true;
    }

    schedule(rebuildBackdrop) {
      if (!this.running && !rebuildBackdrop) return;
      if (rebuildBackdrop) this.needsBackdrop = true;
      cancelAnimationFrame(this.frame);
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        if (document.hidden || this.reader?.hidden) return;

        try {
          if (this.needsBackdrop) {
            this.rebuildBackdrop();
            this.needsBackdrop = false;
          }
          const rendered = this.renderAll();
          this.reader?.classList.toggle('v295-ready', rendered > 0);
          this.reader?.classList.toggle('glass-fallback', rendered === 0);
        } catch (error) {
          console.error('[Standard V29.5] render failed', error);
          this.reader?.classList.remove('v295-ready');
          this.reader?.classList.add('glass-fallback');
        }
      });
    }

    rebuildBackdrop() {
      this.pixelRatio = dpr();
      this.rootWidth = Math.max(1, Math.round(this.reader.clientWidth * this.pixelRatio));
      this.rootHeight = Math.max(1, Math.round(this.reader.clientHeight * this.pixelRatio));

      [
        this.backgroundCanvas,
        this.sourceCanvas,
        this.colorCanvas,
        this.blurCanvas,
        this.blurA,
        this.blurB,
      ].forEach((canvas) => size(canvas, this.rootWidth, this.rootHeight));

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

      const radius = Math.max(
        0,
        P.radius * this.pixelRatio * Math.pow(Math.max(1, P.iterations), 0.55),
      );
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

      this.backdropRevision += 1;
    }

    renderAll() {
      const readerRect = this.reader.getBoundingClientRect();
      const state = {
        readerRect,
        pixelRatio: this.pixelRatio,
        rootWidth: this.rootWidth,
        rootHeight: this.rootHeight,
        blurCanvas: this.blurCanvas,
        revision: this.backdropRevision,
      };

      let rendered = 0;
      for (const host of this.hosts) {
        if (host.render(state)) rendered += 1;
      }
      return rendered;
    }
  }

  window.BlogGlassRenderer = StandardBlogGlassRenderer;
})();
