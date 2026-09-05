(() => {
  'use strict';

  const card = document.querySelector('[data-liquid-glass="v29.5"]');
  const sourceCanvas = document.getElementById('galaxyCanvas');
  const shaders = window.OpenGLV24Shaders;
  if (!card || !(sourceCanvas instanceof HTMLCanvasElement) || !shaders?.vs || !shaders?.fs) {
    card?.classList.add('liquid-glass--fallback');
    console.warn('[homepage-liquid-glass] V29.5 prerequisites unavailable; using CSS fallback');
    return;
  }

  const backdropCanvas = card.querySelector('.liquid-glass__backdrop');
  const opticsCanvas = card.querySelector('.liquid-glass__optics');
  if (!(backdropCanvas instanceof HTMLCanvasElement) || !(opticsCanvas instanceof HTMLCanvasElement)) {
    card.classList.add('liquid-glass--fallback');
    return;
  }

  const params = Object.freeze({
    radius: 22,
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
  });

  // Keep a real sampling domain around the card. The old homepage adapter cropped
  // the texture exactly to the card, so V29.5 optical coordinates hit CLAMP_TO_EDGE
  // instead of seeing the neighboring galaxy that exists in the original test.
  const SAMPLE_MARGIN_CSS_PX = 128;
  const CAPTURE_INTERVAL_MS = 1000 / 24;

  const captureCanvas = document.createElement('canvas');
  const captureCtx = captureCanvas.getContext('2d', { alpha: false });
  const colorCanvas = document.createElement('canvas');
  const colorCtx = colorCanvas.getContext('2d', { alpha: false });
  const blurA = document.createElement('canvas');
  const blurACtx = blurA.getContext('2d', { alpha: false });
  const blurB = document.createElement('canvas');
  const blurBCtx = blurB.getContext('2d', { alpha: false });
  const blurCanvas = document.createElement('canvas');
  const blurCtx = blurCanvas.getContext('2d', { alpha: false });
  const backdropCtx = backdropCanvas.getContext('2d', { alpha: true });

  let gl;
  let program;
  let buffer;
  let locations;
  let blurTexture;
  let visible = true;
  let failed = false;
  let lastCapture = -1e9;
  let lastRectKey = '';
  let captureState = null;

  function setCanvasSize(canvas, width, height) {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
  }

  function getUntransformedCardRect() {
    const width = card.offsetWidth;
    const height = card.offsetHeight;
    let left = 0;
    let top = 0;
    let node = card;

    while (node instanceof HTMLElement) {
      left += node.offsetLeft;
      top += node.offsetTop;
      node = node.offsetParent;
    }

    return {
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height,
    };
  }

  function smoothContext(ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = true;
    try { ctx.imageSmoothingQuality = 'high'; } catch (_) {}
  }

  function shift(dst, src, width, height, step, horizontal) {
    smoothContext(dst);
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

  function blur(source, width, height, radius) {
    smoothContext(blurCtx);
    blurCtx.clearRect(0, 0, width, height);
    if (radius <= 0.025) {
      blurCtx.drawImage(source, 0, 0, width, height);
      return;
    }
    setCanvasSize(blurA, width, height);
    setCanvasSize(blurB, width, height);
    const passes = Math.max(1, Math.min(3, Math.ceil(params.blurIterations / 4)));
    const step = Math.max(0.25, radius / Math.sqrt(2 * passes));
    let current = source;
    for (let i = 0; i < passes; i += 1) {
      shift(blurACtx, current, width, height, step, true);
      shift(blurBCtx, blurA, width, height, step, false);
      current = blurB;
    }
    blurCtx.drawImage(current, 0, 0, width, height);
  }

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
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

    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
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
    if (missing.length) throw new Error(`V29.5 shader parameters missing: ${missing.join(', ')}`);

    blurTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, blurTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  function captureBackdrop() {
    const sourceRect = sourceCanvas.getBoundingClientRect();
    const cardRect = getUntransformedCardRect();
    if (sourceRect.width <= 0 || sourceRect.height <= 0 || cardRect.width <= 0 || cardRect.height <= 0) return false;

    const quality = Math.min(window.devicePixelRatio || 1, 1.5);
    const cropLeft = Math.max(sourceRect.left, cardRect.left - SAMPLE_MARGIN_CSS_PX);
    const cropTop = Math.max(sourceRect.top, cardRect.top - SAMPLE_MARGIN_CSS_PX);
    const cropRight = Math.min(sourceRect.right, cardRect.right + SAMPLE_MARGIN_CSS_PX);
    const cropBottom = Math.min(sourceRect.bottom, cardRect.bottom + SAMPLE_MARGIN_CSS_PX);
    if (cropRight <= cropLeft || cropBottom <= cropTop) return false;

    const rootWidth = Math.max(1, Math.round((cropRight - cropLeft) * quality));
    const rootHeight = Math.max(1, Math.round((cropBottom - cropTop) * quality));
    const cardWidth = Math.max(1, Math.round(cardRect.width * quality));
    const cardHeight = Math.max(1, Math.round(cardRect.height * quality));
    const originX = (cardRect.left - cropLeft) * quality;
    const originY = (cardRect.top - cropTop) * quality;

    const scaleX = sourceCanvas.width / sourceRect.width;
    const scaleY = sourceCanvas.height / sourceRect.height;
    const sx = (cropLeft - sourceRect.left) * scaleX;
    const sy = (cropTop - sourceRect.top) * scaleY;
    const sw = (cropRight - cropLeft) * scaleX;
    const sh = (cropBottom - cropTop) * scaleY;

    for (const canvas of [captureCanvas, colorCanvas, blurCanvas]) {
      setCanvasSize(canvas, rootWidth, rootHeight);
    }
    setCanvasSize(backdropCanvas, cardWidth, cardHeight);
    setCanvasSize(opticsCanvas, cardWidth, cardHeight);

    smoothContext(captureCtx);
    captureCtx.clearRect(0, 0, rootWidth, rootHeight);
    captureCtx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, rootWidth, rootHeight);

    smoothContext(colorCtx);
    colorCtx.clearRect(0, 0, rootWidth, rootHeight);
    colorCtx.save();
    colorCtx.filter = `brightness(${params.brightness}) contrast(${params.contrast}) saturate(${params.saturation})`;
    colorCtx.drawImage(captureCanvas, 0, 0, rootWidth, rootHeight);
    colorCtx.restore();

    const effectiveBlur = Math.max(
      0,
      params.blurRadius * quality * Math.pow(Math.max(1, params.blurIterations), 0.55),
    );
    blur(colorCanvas, rootWidth, rootHeight, effectiveBlur);

    smoothContext(backdropCtx);
    backdropCtx.clearRect(0, 0, cardWidth, cardHeight);
    backdropCtx.drawImage(
      blurCanvas,
      originX, originY, cardWidth, cardHeight,
      0, 0, cardWidth, cardHeight,
    );

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, blurTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, blurCanvas);

    captureState = { quality, rootWidth, rootHeight, cardWidth, cardHeight, originX, originY };
    return true;
  }

  function renderOptics() {
    if (!captureState) return;
    const { quality, rootWidth, rootHeight, cardWidth, cardHeight, originX, originY } = captureState;

    gl.viewport(0, 0, cardWidth, cardHeight);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(locations.a);
    gl.vertexAttribPointer(locations.a, 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(locations.uRes, cardWidth, cardHeight);
    gl.uniform2f(locations.uOrigin, originX, originY);
    gl.uniform2f(locations.uRoot, rootWidth, rootHeight);
    gl.uniform1f(locations.uRadius, params.radius * quality);
    gl.uniform1f(locations.uIntensity, params.glassIntensity);
    gl.uniform4f(locations.uMat, params.bodyVisibility, params.bodyMaxAlpha, params.bodyOutputBrightness, 0);
    gl.uniform4f(
      locations.uBodyLensA,
      params.bodyLensBasePull * quality,
      params.bodyLensPullDp * quality,
      params.bodyLensConcentration,
      params.bodyLensCornerBoost,
    );
    gl.uniform4f(
      locations.uBodyLensB,
      params.bodyLensExtraDistance * quality,
      params.bodyLensReachDp * quality,
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
      params.shoulderWidthPx * quality,
      params.shoulderMaxAngleDeg,
      params.shoulderFalloffRoundness,
      params.shoulderMaterialStrength,
    );
    gl.uniform2f(
      locations.uShoulderFlow,
      params.shoulderCaptureWidthPx * quality,
      params.shoulderTangentialFlowStrength,
    );
    gl.uniform1f(locations.uShoulderEnabled, 2);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, blurTexture);
    gl.uniform1i(locations.uBlurTexture, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function syncFromGalaxyFrame(now = performance.now()) {
    if (failed || !visible || document.hidden) return;

    const rect = getUntransformedCardRect();
    const rectKey = `${Math.round(rect.left)}:${Math.round(rect.top)}:${Math.round(rect.width)}:${Math.round(rect.height)}:${sourceCanvas.width}:${sourceCanvas.height}`;
    const layoutChanged = rectKey !== lastRectKey;
    if (!layoutChanged && now - lastCapture < CAPTURE_INTERVAL_MS) return;

    try {
      if (captureBackdrop()) {
        renderOptics();
        lastCapture = now;
        lastRectKey = rectKey;
        card.classList.remove('liquid-glass--fallback');
      }
    } catch (error) {
      failed = true;
      card.classList.add('liquid-glass--fallback');
      console.warn('[homepage-liquid-glass] synchronized V29.5 capture failed; using CSS fallback', error);
    }
  }

  try {
    initGl();
    const observer = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
    }, { root: null, threshold: 0.01 });
    observer.observe(card);

    // The galaxy renderer calls this immediately after composer.render(). At
    // that point preserveDrawingBuffer=false is still safe because the displayed
    // framebuffer has just been produced and has not been discarded yet.
    window.__SMIREL_HOMEPAGE_GLASS_SYNC__ = syncFromGalaxyFrame;
  } catch (error) {
    failed = true;
    card.classList.add('liquid-glass--fallback');
    console.warn('[homepage-liquid-glass] unavailable; using CSS fallback', error);
  }
})();
