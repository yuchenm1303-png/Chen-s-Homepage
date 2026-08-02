(() => {
  'use strict';

  const BaseRenderer = window.BlogGlassRenderer;
  const V295 = window.OpenGLV24Shaders;
  if (!BaseRenderer || !V295) return;

  const G = Object.freeze({
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
    shoulderCaptureWidthPx: 96,
    shoulderMaxAngleDeg: 89.5,
    shoulderFalloffRoundness: 0,
    shoulderMaterialStrength: 4,
    shoulderTangentialFlowStrength: 0,
  });

  class StaticV295Renderer extends BaseRenderer {
    constructor(canvas) {
      super(canvas);
      this.staticControls = [];
      this.v295Texture = null;
      this.v295Color = document.createElement('canvas');
      this.v295BlurA = document.createElement('canvas');
      this.v295BlurB = document.createElement('canvas');
      this.v295Blur = document.createElement('canvas');
      this.v295ColorCtx = this.v295Color.getContext('2d');
      this.v295BlurACtx = this.v295BlurA.getContext('2d');
      this.v295BlurBCtx = this.v295BlurB.getContext('2d');
      this.v295BlurCtx = this.v295Blur.getContext('2d');
    }

    chooseDpr() {
      return Math.min(window.devicePixelRatio || 1, 2);
    }

    initialise() {
      const gl = this.gl;
      if (!gl) return false;

      const vertex = this.compile(gl.VERTEX_SHADER, V295.vs);
      const fragment = this.compile(gl.FRAGMENT_SHADER, V295.fs);
      if (!vertex || !fragment) return false;

      this.program = gl.createProgram();
      gl.attachShader(this.program, vertex);
      gl.attachShader(this.program, fragment);
      gl.linkProgram(this.program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);

      if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
        console.warn('V29.5 link failed', gl.getProgramInfoLog(this.program));
        return false;
      }

      const names = [
        'a', 'uRes', 'uOrigin', 'uRoot', 'uBlurTexture', 'uMat',
        'uBodyLensA', 'uBodyLensB', 'uBody', 'uShoulder',
        'uShoulderFlow', 'uShoulderEnabled', 'uRadius', 'uIntensity',
      ];
      this.locations = {};
      names.forEach((name) => {
        this.locations[name] = name === 'a'
          ? gl.getAttribLocation(this.program, name)
          : gl.getUniformLocation(this.program, name);
      });
      if (this.locations.a < 0 || names.slice(1).some((name) => this.locations[name] === null)) {
        return false;
      }

      this.quadBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
        gl.STATIC_DRAW,
      );

      this.v295Texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.v295Texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.clearColor(0, 0, 0, 0);
      return true;
    }

    bind(mainElement, controlElements) {
      super.bind(mainElement, controlElements);
      this.detachInteractions();
      this.staticControls = [...controlElements];
      this.resetShellTransform();
      this.staticControls.forEach((element) => {
        element.style.transform = '';
        element.style.transformOrigin = '';
      });
      if (this.shellState) {
        this.shellState.pressValue = 0;
        this.shellState.openGlPress = 0;
        this.shellState.animations?.clear();
      }
      this.requestRender();
    }

    tick() {
      this.frame = 0;
      if (!this.running || document.hidden || !this.dirty) return;
      this.dirty = false;
      this.renderAll();
    }

    rebuildBackdrop() {
      this.dpr = this.chooseDpr();
      this.rootWidth = Math.max(1, Math.round(innerWidth * this.dpr));
      this.rootHeight = Math.max(1, Math.round(innerHeight * this.dpr));

      [
        this.canvas,
        this.clearCanvas,
        this.v295Color,
        this.v295BlurA,
        this.v295BlurB,
        this.v295Blur,
      ].forEach((canvas) => this.setCanvasSize(canvas, this.rootWidth, this.rootHeight));

      this.canvas.style.width = `${innerWidth}px`;
      this.canvas.style.height = `${innerHeight}px`;

      this.drawBackdrop(this.clearContext, this.rootWidth, this.rootHeight);

      this.prepareContext(this.v295ColorCtx);
      this.v295ColorCtx.clearRect(0, 0, this.rootWidth, this.rootHeight);
      this.v295ColorCtx.save();
      this.v295ColorCtx.filter = `brightness(${G.brightness}) contrast(${G.contrast}) saturate(${G.saturation})`;
      this.v295ColorCtx.drawImage(this.clearCanvas, 0, 0);
      this.v295ColorCtx.restore();

      const radius = Math.max(
        0,
        G.radius * this.dpr * Math.pow(Math.max(1, G.iterations), 0.55),
      );
      const passes = Math.max(1, Math.min(3, Math.ceil(G.iterations / 4)));
      const step = Math.max(0.25, radius / Math.sqrt(2 * passes));
      let current = this.v295Color;
      for (let index = 0; index < passes; index += 1) {
        this.shiftBlur(this.v295BlurACtx, current, step, true);
        this.shiftBlur(this.v295BlurBCtx, this.v295BlurA, step, false);
        current = this.v295BlurB;
      }

      this.prepareContext(this.v295BlurCtx);
      this.v295BlurCtx.clearRect(0, 0, this.rootWidth, this.rootHeight);
      this.v295BlurCtx.drawImage(current, 0, 0);

      const gl = this.gl;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.v295Texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        this.v295Blur,
      );
      gl.flush();
      this.backdropDirty = false;
    }

    shiftBlur(context, source, step, horizontal) {
      this.prepareContext(context);
      context.clearRect(0, 0, this.rootWidth, this.rootHeight);
      context.save();
      context.globalCompositeOperation = 'lighter';
      context.globalAlpha = 0.2;
      for (let index = -2; index <= 2; index += 1) {
        context.drawImage(
          source,
          horizontal ? index * step : 0,
          horizontal ? 0 : index * step,
          this.rootWidth,
          this.rootHeight,
        );
      }
      context.restore();
      context.save();
      context.globalCompositeOperation = 'destination-over';
      context.drawImage(source, 0, 0, this.rootWidth, this.rootHeight);
      context.restore();
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

      this.renderV295(this.mainElement, G.glassIntensity);
      if (this.isSideVisible()) this.renderV295(this.sideElement, G.glassIntensity);
      this.staticControls.forEach((element) => this.renderV295(element, G.glassIntensity));
    }

    renderV295(element, intensity) {
      if (!element) return;
      const rect = element.getBoundingClientRect();
      if (
        rect.width < 2 || rect.height < 2 ||
        rect.bottom < 0 || rect.top > innerHeight
      ) return;

      const width = Math.max(1, Math.round(rect.width * this.dpr));
      const height = Math.max(1, Math.round(rect.height * this.dpr));
      this.setCanvasSize(this.glCanvas, width, height);

      const gl = this.gl;
      gl.viewport(0, 0, width, height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(this.program);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
      gl.enableVertexAttribArray(this.locations.a);
      gl.vertexAttribPointer(this.locations.a, 2, gl.FLOAT, false, 0, 0);

      const radiusCss = parseFloat(getComputedStyle(element).borderTopLeftRadius)
        || Math.min(rect.height / 2, 46);
      gl.uniform2f(this.locations.uRes, width, height);
      gl.uniform2f(this.locations.uOrigin, rect.left * this.dpr, rect.top * this.dpr);
      gl.uniform2f(this.locations.uRoot, this.rootWidth, this.rootHeight);
      gl.uniform1f(
        this.locations.uRadius,
        Math.min(radiusCss * this.dpr, Math.min(width, height) / 2),
      );
      gl.uniform1f(this.locations.uIntensity, intensity);
      gl.uniform4f(
        this.locations.uMat,
        G.bodyVisibility,
        G.bodyMaxAlpha,
        G.bodyOutputBrightness,
        0,
      );
      gl.uniform4f(
        this.locations.uBodyLensA,
        G.bodyLensBasePull * this.dpr,
        G.bodyLensPullDp * this.dpr,
        G.bodyLensConcentration,
        G.bodyLensCornerBoost,
      );
      gl.uniform4f(
        this.locations.uBodyLensB,
        G.bodyLensExtraDistance * this.dpr,
        G.bodyLensReachDp * this.dpr,
        G.bodyLensDark,
        G.bodyLensDebug,
      );
      gl.uniform4f(
        this.locations.uBody,
        G.bodyLowFrequencyWidth,
        G.bodyLowFrequencyCurve,
        G.bodyLowFrequencyGain,
        G.bodyBrightness,
      );
      gl.uniform4f(
        this.locations.uShoulder,
        G.shoulderWidthPx * this.dpr,
        G.shoulderMaxAngleDeg,
        G.shoulderFalloffRoundness,
        G.shoulderMaterialStrength,
      );
      gl.uniform2f(
        this.locations.uShoulderFlow,
        G.shoulderCaptureWidthPx * this.dpr,
        G.shoulderTangentialFlowStrength,
      );
      gl.uniform1f(this.locations.uShoulderEnabled, G.edgeMode);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.v295Texture);
      gl.uniform1i(this.locations.uBlurTexture, 0);
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

  window.BlogGlassRenderer = StaticV295Renderer;
})();