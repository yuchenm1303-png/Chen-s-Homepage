(() => {
  'use strict';

  const card = document.querySelector('[data-liquid-glass="v29.5"]');
  const sourceCanvas = document.getElementById('galaxyCanvas');
  const shaders = window.OpenGLV24Shaders;
  if (!card || !sourceCanvas || !shaders?.vs || !shaders?.fs) {
    card?.classList.add('liquid-glass--fallback');
    return;
  }

  const backdropCanvas = card.querySelector('.liquid-glass__backdrop');
  const opticsCanvas = card.querySelector('.liquid-glass__optics');
  if (!(backdropCanvas instanceof HTMLCanvasElement) || !(opticsCanvas instanceof HTMLCanvasElement)) {
    card.classList.add('liquid-glass--fallback');
    return;
  }

  // Pinned defaults from OpenGL V29.5 / APP_RAW at commit 48b489c.
  // These values are intentionally not retuned for the homepage.
  const params = Object.freeze({
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
    bodyLensCornerBoost: 0,
    bodyLensExtraDistance: 200,
    bodyLensReachDp: 180,
    bodyLensDark: 0.23041474654378,
    bodyLowFrequencyWidth: 1.25059907834101,
    bodyLowFrequencyCurve: 0.2,
    bodyLowFrequencyGain: 12.4423963133641,
    bodyBrightness: 0.545161290322581,
    glassIntensity: 1.35,
    shoulderWidthPx: 21.7162162162162,
    shoulderMaxAngleDeg: 89.5,
    shoulderFalloffRoundness: 0,
    shoulderMaterialStrength: 4,
    shoulderTangentialFlowStrength: 0,
    shoulderCaptureWidthPx: 96,
    edgeMode: 2,
  });

  const OPTICAL_RADIUS_PX = 46;
  const CAPTURE_INTERVAL_MS = 1000 / 24;
  const quality = () => Math.min(window.devicePixelRatio || 1, 1.5);

  // Match the original three-layer V29.5 composition: gb + gl + ui.
  // Do not cross-fade the optical canvas with the untouched galaxy; that would
  // average away the displacement we are trying to see.
  card.style.borderRadius = `${OPTICAL_RADIUS_PX}px`;
  backdropCanvas.style.opacity = '1';
  opticsCanvas.style.opacity = '1';

  const source = document.createElement('canvas');
  const sourceCtx = source.getContext('2d', { alpha: false });
  const colorCanvas = document.createElement('canvas');
  const colorCtx = colorCanvas.getContext('2d', { alpha: false });
  const blurA = document.createElement('canvas');
  const blurACtx = blurA.getContext('2d', { alpha: false });
  const blurB = document.createElement('canvas');
  const blurBCtx = blurB.getContext('2d', { alpha: false });
  const blurCanvas = document.createElement('canvas');
  const blurCtx = blurCanvas.getContext('2d', { alpha: false });
  const backdropCtx = backdropCanvas.getContext('2d', { alpha: true });

  if (!sourceCtx || !colorCtx || !blurACtx || !blurBCtx || !blurCtx || !backdropCtx) {
    card.classList.add('liquid-glass--fallback');
    return;
  }

  let gl;
  let program;
  let quad;
  let texture;
  let locations;
  let visible = true;
  let failed = false;
  let lastCapture = -1e9;

  function setSize(canvas, width, height) {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
  }

  function reset2d(ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = true;
    try { ctx.imageSmoothingQuality = 'high'; } catch (_) {}
  }

  function shift(dst, src, width, height, step, horizontal) {
    reset2d(dst);
    dst.clearRect(0, 0, width, height);
    dst.save();
    dst.globalCompositeOperation = 'lighter';
    dst.globalAlpha = 0.2;
    for (let i = -2; i <= 2; i += 1) {
      dst.drawImage(src, horizontal ? i * step : 0, horizontal ? 0 : i * step, width, height);
    }
    dst.restore();
    dst.save();
    dst.globalCompositeOperation = 'destination-over';
    dst.drawImage(src, 0, 0, width, height);
    dst.restore();
  }

  function blur(sourceImage, width, height, radius) {
    reset2d(blurCtx);
    blurCtx.clearRect(0, 0, width, height);
    if (radius <= 0.025) {
      blurCtx.drawImage(sourceImage, 0, 0, width, height);
      return;
    }

    setSize(blurA, width, height);
    setSize(blurB, width, height);
    const passes = Math.max(1, Math.min(3, Math.ceil(params.blurIterations / 4)));
    const step = Math.max(0.25, radius / Math.sqrt(2 * passes));
    let current = sourceImage;
    for (let i = 0; i < passes; i += 1) {
      shift(blurACtx, current, width, height, step, true);
      shift(blurBCtx, blurA, width, height, step, false);
      current = blurB;
    }
    blurCtx.drawImage(current, 0, 0, width, height);
  }

  function compile(type, shaderSource) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, shaderSource);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || 'Liquid glass shader compile failed');
    }
    return shader;
  }

  function initGl() {
    gl = opticsCanvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) throw new Error('WebGL unavailable for liquid glass');

    program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, shaders.vs));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, shaders.fs));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'Liquid glass program link failed');
    }

    quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    const names = [
      'a', 'uRes', 'uOrigin', 'uRoot', 'uBlurTexture', 'uMat', 'uBodyLensA',
      'uBodyLensB', 'uBody', 'uShoulder', 'uShoulderFlow', 'uShoulderEnabled',
      'uRadius', 'uIntensity',
    ];
    locations = {};
    for (const name of names) {
      locations[name] = name === 'a' ? gl.getAttribLocation(program, name) : gl.getUniformLocation(program, name);
    }
    const missing = names.filter((name) => name === 'a' ? locations[name] < 0 : locations[name] === null);
    if (missing.length) throw new Error(`Liquid glass uniforms missing: ${missing.join(', ')}`);

    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  function captureBackdropFromValidGalaxyBuffer() {
    const sourceRect = sourceCanvas.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    if (sourceRect.width <= 0 || sourceRect.height <= 0 || cardRect.width <= 0 || cardRect.height <= 0) return false;

    const d = quality();
    const width = Math.max(1, Math.round(cardRect.width * d));
    const height = Math.max(1, Math.round(cardRect.height * d));
    const scaleX = sourceCanvas.width / sourceRect.width;
    const scaleY = sourceCanvas.height / sourceRect.height;
    const sx = Math.max(0, (cardRect.left - sourceRect.left) * scaleX);
    const sy = Math.max(0, (cardRect.top - sourceRect.top) * scaleY);
    const sw = Math.min(sourceCanvas.width - sx, cardRect.width * scaleX);
    const sh = Math.min(sourceCanvas.height - sy, cardRect.height * scaleY);
    if (sw <= 0 || sh <= 0) return false;

    for (const canvas of [source, colorCanvas, blurCanvas, backdropCanvas, opticsCanvas]) {
      setSize(canvas, width, height);
    }

    // IMPORTANT: this drawImage is called synchronously from the galaxy
    // renderer's post-render hook, before its preserveDrawingBuffer=false
    // framebuffer can be invalidated by browser compositing.
    reset2d(sourceCtx);
    sourceCtx.clearRect(0, 0, width, height);
    sourceCtx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, width, height);

    // Original V29.5 backdrop preprocessing.
    reset2d(colorCtx);
    colorCtx.clearRect(0, 0, width, height);
    colorCtx.save();
    colorCtx.filter = `brightness(${params.brightness}) contrast(${params.contrast}) saturate(${params.saturation})`;
    colorCtx.drawImage(source, 0, 0, width, height);
    colorCtx.restore();

    const effectiveBlur = Math.max(
      0,
      params.blurRadius * d * Math.pow(Math.max(1, params.blurIterations), 0.55),
    );
    blur(colorCanvas, width, height, effectiveBlur);

    reset2d(backdropCtx);
    backdropCtx.clearRect(0, 0, width, height);
    backdropCtx.drawImage(blurCanvas, 0, 0, width, height);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, blurCanvas);
    gl.flush();
    return true;
  }

  function renderOptics() {
    const d = quality();
    const width = opticsCanvas.width;
    const height = opticsCanvas.height;

    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(locations.a);
    gl.vertexAttribPointer(locations.a, 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(locations.uRes, width, height);
    gl.uniform2f(locations.uOrigin, 0, 0);
    gl.uniform2f(locations.uRoot, width, height);
    gl.uniform1f(locations.uRadius, OPTICAL_RADIUS_PX * d);
    gl.uniform1f(locations.uIntensity, params.glassIntensity);
    gl.uniform4f(locations.uMat, params.bodyVisibility, params.bodyMaxAlpha, params.bodyOutputBrightness, 0);
    gl.uniform4f(
      locations.uBodyLensA,
      params.bodyLensBasePull * d,
      params.bodyLensPullDp * d,
      params.bodyLensConcentration,
      params.bodyLensCornerBoost,
    );
    gl.uniform4f(
      locations.uBodyLensB,
      params.bodyLensExtraDistance * d,
      params.bodyLensReachDp * d,
      params.bodyLensDark,
      0,
    );
    gl.uniform4f(
      locations.uBody,
      params.bodyLowFrequencyWidth,
      params.bodyLowFrequencyCurve,
      params.bodyLowFrequencyGain,
      params.bodyBrightness,
    );
    gl.uniform4f(
      locations.uShoulder,
      params.shoulderWidthPx * d,
      params.shoulderMaxAngleDeg,
      params.shoulderFalloffRoundness,
      params.shoulderMaterialStrength,
    );
    gl.uniform2f(
      locations.uShoulderFlow,
      params.shoulderCaptureWidthPx * d,
      params.shoulderTangentialFlowStrength,
    );
    gl.uniform1f(locations.uShoulderEnabled, params.edgeMode);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(locations.uBlurTexture, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function consumeGalaxyFrame(now) {
    if (failed || !visible || document.hidden || now - lastCapture < CAPTURE_INTERVAL_MS) return;
    try {
      if (captureBackdropFromValidGalaxyBuffer()) {
        renderOptics();
        lastCapture = now;
      }
    } catch (error) {
      failed = true;
      card.classList.add('liquid-glass--fallback');
      console.warn('[homepage-liquid-glass] V29.5 fallback', error);
    }
  }

  try {
    initGl();

    const previousAfterRender = window.__ASTRA_AFTER_RENDER__;
    window.__ASTRA_AFTER_RENDER__ = (now) => {
      if (typeof previousAfterRender === 'function') previousAfterRender(now);
      consumeGalaxyFrame(now);
    };

    const observer = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      if (visible) lastCapture = -1e9;
    }, { threshold: 0.01 });
    observer.observe(card);

    window.addEventListener('resize', () => {
      lastCapture = -1e9;
    }, { passive: true });
  } catch (error) {
    failed = true;
    card.classList.add('liquid-glass--fallback');
    console.warn('[homepage-liquid-glass] unavailable; using shared CSS glass', error);
  }
})();
