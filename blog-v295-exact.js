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
    shoulderWidthPx: 21.7162162162162,
    shoulderMaxAngleDeg: 89.5,
    shoulderFalloffRoundness: 0,
    shoulderMaterialStrength: 4,
    shoulderTangentialFlowStrength: 0,
  });

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
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

  class ExactGlassTarget {
    constructor(system, element) {
      this.system = system;
      this.element = element;
      this.gb = document.createElement('canvas');
      this.glCanvas = document.createElement('canvas');
      this.gb.className = 'v295-exact-gb';
      this.glCanvas.className = 'v295-exact-gl';
      this.gb.setAttribute('aria-hidden', 'true');
      this.glCanvas.setAttribute('aria-hidden', 'true');
      this.gbContext = this.gb.getContext('2d');
      this.gl = this.glCanvas.getContext('webgl', {
        alpha: true,
        premultipliedAlpha: false,
      });
      this.program = null;
      this.buffer = null;
      this.locations = null;
      this.blurTexture = null;
      this.mount();
    }

    mount() {
      this.element.classList.add('v295-exact-host');
      this.element.prepend(this.glCanvas);
      this.element.prepend(this.gb);
      this.wrapButtonLabel();
      this.initialiseGl();
    }

    wrapButtonLabel() {
      if (!this.element.matches('button')) return;
      const nodes = [...this.element.childNodes].filter((node) => (
        node !== this.gb && node !== this.glCanvas
      ));
      if (nodes.length === 1 && nodes[0].nodeType === Node.ELEMENT_NODE && nodes[0].classList?.contains('v295-exact-label')) return;
      const label = document.createElement('span');
      label.className = 'v295-exact-label';
      nodes.forEach((node) => label.appendChild(node));
      this.element.appendChild(label);
    }

    initialiseGl() {
      if (!this.gl || !window.OpenGLV24Shaders) throw new Error('V29.5 WebGL unavailable');
      const gl = this.gl;
      const { vs, fs } = window.OpenGLV24Shaders;
      const compile = (type, source) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          throw new Error(gl.getShaderInfoLog(shader));
        }
        return shader;
      };

      this.program = gl.createProgram();
      gl.attachShader(this.program, compile(gl.VERTEX_SHADER, vs));
      gl.attachShader(this.program, compile(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(this.program);
      if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(this.program));
      }

      this.buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
        gl.STATIC_DRAW,
      );

      const names = [
        'a', 'uRes', 'uOrigin', 'uRoot', 'uBlurTexture', 'uMat',
        'uBodyLensA', 'uBodyLensB', 'uBody', 'uShoulder',
        'uShoulderFlow', 'uShoulderEnabled', 'uRadius', 'uIntensity',
      ];
      this.locations = {};
      for (const name of names) {
        this.locations[name] = name === 'a'
          ? gl.getAttribLocation(this.program, name)
          : gl.getUniformLocation(this.program, name);
      }
      const missing = names.filter((name) => (
        name === 'a' ? this.locations[name] < 0 : this.locations[name] === null
      ));
      if (missing.length) throw new Error(`V29.5 uniforms missing: ${missing.join(', ')}`);

      this.blurTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.blurTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    isVisible() {
      const style = getComputedStyle(this.element);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
      const rect = this.element.getBoundingClientRect();
      return rect.width > 1 && rect.height > 1 && rect.bottom > 0 && rect.top < innerHeight;
    }

    render() {
      if (!this.isVisible()) return;
      const system = this.system;
      const d = system.pixelRatio;
      const rect = this.element.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width * d));
      const height = Math.max(1, Math.round(rect.height * d));
      const sourceX = Math.round(rect.left * d);
      const sourceY = Math.round(rect.top * d);

      size(this.gb, width, height);
      size(this.glCanvas, width, height);

      smoothContext(this.gbContext);
      this.gbContext.clearRect(0, 0, width, height);
      this.gbContext.drawImage(
        system.blurCanvas,
        sourceX,
        sourceY,
        width,
        height,
        0,
        0,
        width,
        height,
      );

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
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        system.blurCanvas,
      );

      gl.uniform2f(this.locations.uRes, width, height);
      gl.uniform2f(this.locations.uOrigin, sourceX, sourceY);
      gl.uniform2f(this.locations.uRoot, system.rootWidth, system.rootHeight);
      gl.uniform1f(this.locations.uRadius, 46 * d);
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
        P.bodyLensBasePull * d,
        P.bodyLensPullDp * d,
        P.bodyLensConcentration,
        P.bodyLensCornerBoost,
      );
      gl.uniform4f(
        this.locations.uBodyLensB,
        P.bodyLensExtraDistance * d,
        P.bodyLensReachDp * d,
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
        P.shoulderWidthPx * d,
        P.shoulderMaxAngleDeg,
        P.shoulderFalloffRoundness,
        P.shoulderMaterialStrength,
      );
      gl.uniform2f(
        this.locations.uShoulderFlow,
        SHOULDER_CAPTURE_WIDTH_PX * d,
        P.shoulderTangentialFlowStrength,
      );
      gl.uniform1f(this.locations.uShoulderEnabled, P.edgeMode);
      gl.uniform1i(this.locations.uBlurTexture, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.flush();
    }

    destroy() {
      this.element.classList.remove('v295-exact-host');
      this.gb.remove();
      this.glCanvas.remove();
    }
  }

  class ExactV295BlogRenderer {
    constructor(backgroundCanvas) {
      this.backgroundCanvas = backgroundCanvas;
      this.backgroundContext = backgroundCanvas.getContext('2d');
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
      this.targets = [];
      this.pixelRatio = 1;
      this.rootWidth = 1;
      this.rootHeight = 1;
      this.running = false;
      this.frame = 0;
      this.resizeObserver = null;
      this.classObserver = null;
      this.boundSchedule = () => this.schedule(true);
    }

    initialise() {
      return Boolean(
        this.backgroundContext &&
        this.sourceContext &&
        this.colorContext &&
        this.blurAContext &&
        this.blurBContext &&
        this.blurContext &&
        window.OpenGLV24Shaders
      );
    }

    bind(mainElement, controlElements) {
      this.clearTargets();
      const sideElement = document.getElementById('articleToc');
      const elements = [mainElement, sideElement, ...controlElements].filter(Boolean);
      this.targets = elements.map((element) => new ExactGlassTarget(this, element));

      this.resizeObserver?.disconnect();
      this.resizeObserver = new ResizeObserver(() => this.schedule(true));
      elements.forEach((element) => this.resizeObserver.observe(element));

      this.classObserver?.disconnect();
      const reader = document.getElementById('articleReader');
      if (reader) {
        this.classObserver = new MutationObserver(() => this.schedule(false));
        this.classObserver.observe(reader, { attributes: true, attributeFilter: ['class', 'hidden'] });
      }
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
      this.clearTargets();
    }

    clearTargets() {
      this.targets.forEach((target) => target.destroy());
      this.targets = [];
    }

    schedule(rebuildBackdrop) {
      if (!this.running && !rebuildBackdrop) return;
      if (rebuildBackdrop) this.needsBackdrop = true;
      cancelAnimationFrame(this.frame);
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        if (document.hidden) return;
        if (this.needsBackdrop) {
          this.rebuildBackdrop();
          this.needsBackdrop = false;
        }
        this.targets.forEach((target) => target.render());
      });
    }

    rebuildBackdrop() {
      this.pixelRatio = dpr();
      this.rootWidth = Math.max(1, Math.round(innerWidth * this.pixelRatio));
      this.rootHeight = Math.max(1, Math.round(innerHeight * this.pixelRatio));

      [
        this.backgroundCanvas,
        this.sourceCanvas,
        this.colorCanvas,
        this.blurCanvas,
        this.blurA,
        this.blurB,
      ].forEach((canvas) => size(canvas, this.rootWidth, this.rootHeight));

      this.backgroundCanvas.style.width = `${innerWidth}px`;
      this.backgroundCanvas.style.height = `${innerHeight}px`;

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
        return;
      }

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
  }

  window.BlogGlassRenderer = ExactV295BlogRenderer;
})();
