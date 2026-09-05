(() => {
  'use strict';

  const card = document.querySelector('[data-liquid-glass="v29.5"]');
  const sourceCanvas = document.getElementById('galaxyCanvas');
  const shaders = window.OpenGLV24Shaders;
  const backdropCanvas = card?.querySelector('.liquid-glass__backdrop');
  const opticsCanvas = card?.querySelector('.liquid-glass__optics');

  let syncFallbackLoading = false;
  function loadSyncFallback(reason) {
    if (syncFallbackLoading) return;
    syncFallbackLoading = true;
    window.__SMIREL_HOMEPAGE_GLASS_SYNC__ = undefined;
    console.warn('[homepage-liquid-glass] async adapter unavailable; loading synchronized fallback', reason);
    const script = document.createElement('script');
    script.src = './homepage-liquid-glass-v29-sync.js';
    script.async = false;
    document.head.appendChild(script);
  }

  if (!card
      || !(sourceCanvas instanceof HTMLCanvasElement)
      || !(backdropCanvas instanceof HTMLCanvasElement)
      || !(opticsCanvas instanceof HTMLCanvasElement)
      || !shaders?.vs
      || !shaders?.fs
      || typeof createImageBitmap !== 'function'
      || typeof Worker !== 'function'
      || typeof OffscreenCanvas !== 'function') {
    loadSyncFallback('required browser capability missing');
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

  const SAMPLE_MARGIN_CSS_PX = 128;
  const CAPTURE_INTERVAL_MS = 1000 / 24;
  const backdropCtx = backdropCanvas.getContext('2d', { alpha: true });

  let gl;
  let program;
  let buffer;
  let locations;
  let blurTexture;
  let captureState = null;
  let visible = true;
  let failed = false;
  let lastCapture = -1e9;
  let lastRectKey = '';
  let capturePending = false;
  let captureId = 0;
  let pending = null;
  let worker = null;
  let workerUrl = null;

  function smoothContext(ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = true;
    try { ctx.imageSmoothingQuality = 'high'; } catch (_) {}
  }

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
    return { left, top, right: left + width, bottom: top + height, width, height };
  }

  function computeCaptureState() {
    const sourceRect = sourceCanvas.getBoundingClientRect();
    const cardRect = getUntransformedCardRect();
    if (sourceRect.width <= 0 || sourceRect.height <= 0 || cardRect.width <= 0 || cardRect.height <= 0) return null;

    const quality = Math.min(window.devicePixelRatio || 1, 1.5);
    const cropLeft = Math.max(sourceRect.left, cardRect.left - SAMPLE_MARGIN_CSS_PX);
    const cropTop = Math.max(sourceRect.top, cardRect.top - SAMPLE_MARGIN_CSS_PX);
    const cropRight = Math.min(sourceRect.right, cardRect.right + SAMPLE_MARGIN_CSS_PX);
    const cropBottom = Math.min(sourceRect.bottom, cardRect.bottom + SAMPLE_MARGIN_CSS_PX);
    if (cropRight <= cropLeft || cropBottom <= cropTop) return null;

    const rootWidth = Math.max(1, Math.round((cropRight - cropLeft) * quality));
    const rootHeight = Math.max(1, Math.round((cropBottom - cropTop) * quality));
    const cardWidth = Math.max(1, Math.round(cardRect.width * quality));
    const cardHeight = Math.max(1, Math.round(cardRect.height * quality));
    const originX = (cardRect.left - cropLeft) * quality;
    const originY = (cardRect.top - cropTop) * quality;
    const scaleX = sourceCanvas.width / sourceRect.width;
    const scaleY = sourceCanvas.height / sourceRect.height;

    return {
      quality,
      rootWidth,
      rootHeight,
      cardWidth,
      cardHeight,
      originX,
      originY,
      sx: (cropLeft - sourceRect.left) * scaleX,
      sy: (cropTop - sourceRect.top) * scaleY,
      sw: (cropRight - cropLeft) * scaleX,
      sh: (cropBottom - cropTop) * scaleY,
    };
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
    gl.uniform4f(locations.uBodyLensA, params.bodyLensBasePull * quality, params.bodyLensPullDp * quality, params.bodyLensConcentration, params.bodyLensCornerBoost);
    gl.uniform4f(locations.uBodyLensB, params.bodyLensExtraDistance * quality, params.bodyLensReachDp * quality, params.bodyLensDark, 0);
    gl.uniform4f(locations.uBody, params.bodyLowFrequencyWidth, params.bodyLowFrequencyCurve, params.bodyLowFrequencyGain, params.bodyBrightness);
    gl.uniform4f(locations.uShoulder, params.shoulderWidthPx * quality, params.shoulderMaxAngleDeg, params.shoulderFalloffRoundness, params.shoulderMaterialStrength);
    gl.uniform2f(locations.uShoulderFlow, params.shoulderCaptureWidthPx * quality, params.shoulderTangentialFlowStrength);
    gl.uniform1f(locations.uShoulderEnabled, 2);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, blurTexture);
    gl.uniform1i(locations.uBlurTexture, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function applyProcessedFrame(bitmap, state) {
    setCanvasSize(backdropCanvas, state.cardWidth, state.cardHeight);
    setCanvasSize(opticsCanvas, state.cardWidth, state.cardHeight);
    smoothContext(backdropCtx);
    backdropCtx.clearRect(0, 0, state.cardWidth, state.cardHeight);
    backdropCtx.drawImage(
      bitmap,
      state.originX, state.originY, state.cardWidth, state.cardHeight,
      0, 0, state.cardWidth, state.cardHeight,
    );

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, blurTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
    captureState = state;
    renderOptics();
  }

  const workerSource = `
    'use strict';
    let captureCanvas, captureCtx, colorCanvas, colorCtx, blurA, blurACtx, blurB, blurBCtx, blurCanvas, blurCtx;
    let width = 0, height = 0;

    function smooth(ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.imageSmoothingEnabled = true;
      try { ctx.imageSmoothingQuality = 'high'; } catch (_) {}
    }

    function ensure(w, h) {
      if (captureCanvas && width === w && height === h) return;
      width = w; height = h;
      captureCanvas = new OffscreenCanvas(w, h); captureCtx = captureCanvas.getContext('2d', { alpha: false });
      colorCanvas = new OffscreenCanvas(w, h); colorCtx = colorCanvas.getContext('2d', { alpha: false });
      blurA = new OffscreenCanvas(w, h); blurACtx = blurA.getContext('2d', { alpha: false });
      blurB = new OffscreenCanvas(w, h); blurBCtx = blurB.getContext('2d', { alpha: false });
      blurCanvas = new OffscreenCanvas(w, h); blurCtx = blurCanvas.getContext('2d', { alpha: false });
      if (!captureCtx || !colorCtx || !blurACtx || !blurBCtx || !blurCtx) throw new Error('OffscreenCanvas 2D unavailable');
    }

    function shift(dst, src, w, h, step, horizontal) {
      smooth(dst); dst.clearRect(0, 0, w, h); dst.save();
      dst.globalCompositeOperation = 'lighter'; dst.globalAlpha = 0.2;
      for (let i = -2; i <= 2; i += 1) dst.drawImage(src, horizontal ? i * step : 0, horizontal ? 0 : i * step, w, h);
      dst.restore(); dst.save(); dst.globalCompositeOperation = 'destination-over'; dst.drawImage(src, 0, 0, w, h); dst.restore();
    }

    self.onmessage = (event) => {
      const d = event.data;
      try {
        ensure(d.width, d.height);
        smooth(captureCtx); captureCtx.clearRect(0, 0, d.width, d.height);
        captureCtx.drawImage(d.bitmap, d.sourceX, d.sourceY, d.sourceWidth, d.sourceHeight, 0, 0, d.width, d.height);
        d.bitmap.close?.();

        smooth(colorCtx); colorCtx.clearRect(0, 0, d.width, d.height); colorCtx.save();
        colorCtx.filter = d.filter; colorCtx.drawImage(captureCanvas, 0, 0, d.width, d.height); colorCtx.restore();

        smooth(blurCtx); blurCtx.clearRect(0, 0, d.width, d.height);
        if (d.radius <= 0.025) {
          blurCtx.drawImage(colorCanvas, 0, 0, d.width, d.height);
        } else {
          const passes = Math.max(1, Math.min(3, Math.ceil(d.blurIterations / 4)));
          const step = Math.max(0.25, d.radius / Math.sqrt(2 * passes));
          let current = colorCanvas;
          for (let i = 0; i < passes; i += 1) {
            shift(blurACtx, current, d.width, d.height, step, true);
            shift(blurBCtx, blurA, d.width, d.height, step, false);
            current = blurB;
          }
          blurCtx.drawImage(current, 0, 0, d.width, d.height);
        }
        const result = blurCanvas.transferToImageBitmap();
        self.postMessage({ id: d.id, bitmap: result }, [result]);
      } catch (error) {
        try { d.bitmap.close?.(); } catch (_) {}
        self.postMessage({ id: d.id, error: error instanceof Error ? error.message : String(error) });
      }
    };
  `;

  function initWorker() {
    const test = new OffscreenCanvas(1, 1).getContext('2d');
    if (!test || !('filter' in test)) throw new Error('OffscreenCanvas filter unavailable');
    workerUrl = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
    worker = new Worker(workerUrl);
    worker.onmessage = (event) => {
      const data = event.data;
      if (!capturePending || !pending || data.id !== pending.id) {
        data.bitmap?.close?.();
        return;
      }
      const completed = pending;
      capturePending = false;
      pending = null;
      if (data.error || !data.bitmap) {
        failed = true;
        loadSyncFallback(data.error || 'worker returned no frame');
        return;
      }
      try {
        applyProcessedFrame(data.bitmap, completed.state);
        lastRectKey = completed.rectKey;
        card.classList.remove('liquid-glass--fallback');
      } catch (error) {
        failed = true;
        loadSyncFallback(error);
      } finally {
        data.bitmap.close?.();
      }
    };
    worker.onerror = (event) => {
      capturePending = false;
      pending = null;
      failed = true;
      loadSyncFallback(event.message || 'glass worker error');
    };
  }

  function requestCapture(now, rectKey, state) {
    if (capturePending || !worker) return;
    const x = Math.max(0, Math.floor(state.sx));
    const y = Math.max(0, Math.floor(state.sy));
    const right = Math.min(sourceCanvas.width, Math.ceil(state.sx + state.sw));
    const bottom = Math.min(sourceCanvas.height, Math.ceil(state.sy + state.sh));
    const width = Math.max(1, right - x);
    const height = Math.max(1, bottom - y);
    const id = ++captureId;
    capturePending = true;
    pending = { id, rectKey, state };
    lastCapture = now;

    createImageBitmap(sourceCanvas, x, y, width, height).then((bitmap) => {
      if (!capturePending || !pending || pending.id !== id || failed) {
        bitmap.close?.();
        return;
      }
      const radius = Math.max(0, params.blurRadius * state.quality * Math.pow(Math.max(1, params.blurIterations), 0.55));
      worker.postMessage({
        id,
        bitmap,
        width: state.rootWidth,
        height: state.rootHeight,
        sourceX: state.sx - x,
        sourceY: state.sy - y,
        sourceWidth: state.sw,
        sourceHeight: state.sh,
        filter: `brightness(${params.brightness}) contrast(${params.contrast}) saturate(${params.saturation})`,
        radius,
        blurIterations: params.blurIterations,
      }, [bitmap]);
    }).catch((error) => {
      capturePending = false;
      pending = null;
      failed = true;
      loadSyncFallback(error);
    });
  }

  function syncFromGalaxyFrame(now = performance.now()) {
    if (failed || !visible || document.hidden || capturePending) return;
    const rect = getUntransformedCardRect();
    const rectKey = `${Math.round(rect.left)}:${Math.round(rect.top)}:${Math.round(rect.width)}:${Math.round(rect.height)}:${sourceCanvas.width}:${sourceCanvas.height}`;
    if (rectKey === lastRectKey && now - lastCapture < CAPTURE_INTERVAL_MS) return;
    const state = computeCaptureState();
    if (state) requestCapture(now, rectKey, state);
  }

  try {
    initGl();
    initWorker();
    new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
    }, { root: null, threshold: 0.01 }).observe(card);

    window.addEventListener('pagehide', () => {
      worker?.terminate();
      if (workerUrl) URL.revokeObjectURL(workerUrl);
    }, { once: true });

    // Same 24 Hz V29.5 visual pipeline as before. Only the framebuffer snapshot
    // and Canvas2D filter/blur work leave the animation frame's main-thread path.
    window.__SMIREL_HOMEPAGE_GLASS_SYNC__ = syncFromGalaxyFrame;
  } catch (error) {
    failed = true;
    loadSyncFallback(error);
  }
})();
