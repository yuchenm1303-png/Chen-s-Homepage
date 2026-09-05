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

  // The original V29.5 was tuned against bright test imagery. A sparse star field
  // needs sharp source samples and a wider optical field so displaced stars stay readable.
  const params = {
    radius: 30,
    brightness: 1.10,
    contrast: 1.04,
    saturation: 1.05,
    bodyVisibility: 20,
    bodyMaxAlpha: 1,
    bodyOutputBrightness: 1.14,
    bodyLensBasePull: 300,
    bodyLensPullDp: 600,
    bodyLensConcentration: 10,
    bodyLensCornerBoost: 0,
    bodyLensExtraDistance: 200,
    bodyLensReachDp: 180,
    bodyLensDark: 0.045,
    bodyLowFrequencyWidth: 1.25,
    bodyLowFrequencyCurve: 0.58,
    bodyLowFrequencyGain: 135,
    bodyBrightness: 0.92,
    glassIntensity: 1.35,
    shoulderWidthPx: 30,
    shoulderMaxAngleDeg: 89.5,
    shoulderFalloffRoundness: 0,
    shoulderMaterialStrength: 3.35,
    shoulderTangentialFlowStrength: 0,
    shoulderCaptureWidthPx: 96,
  };

  // Do not cross-fade the refracted image with the undisplaced galaxy. Cross-fading
  // visually cancels the displacement and turns V29.5 into ordinary transparency.
  backdropCanvas.style.opacity = '0';
  opticsCanvas.style.opacity = '1';
  card.style.borderRadius = `${params.radius}px`;

  const source = document.createElement('canvas');
  const sourceCtx = source.getContext('2d', { alpha: false });
  const color = document.createElement('canvas');
  const colorCtx = color.getContext('2d', { alpha: false });

  let gl;
  let program;
  let quad;
  let texture;
  let locations;
  let visible = true;
  let failed = false;
  let lastCapture = -1e9;
  const CAPTURE_INTERVAL_MS = 1000 / 24;

  const setSize = (canvas, width, height) => {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
  };

  const reset2d = (ctx) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = true;
    try { ctx.imageSmoothingQuality = 'high'; } catch (_) {}
  };

  const compile = (type, shaderSource) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, shaderSource);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || 'Liquid glass shader compile failed');
    }
    return shader;
  };

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

  function captureSource() {
    const sourceRect = sourceCanvas.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    if (sourceRect.width <= 0 || sourceRect.height <= 0 || cardRect.width <= 0 || cardRect.height <= 0) return false;

    const quality = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = Math.max(1, Math.round(cardRect.width * quality));
    const height = Math.max(1, Math.round(cardRect.height * quality));
    const scaleX = sourceCanvas.width / sourceRect.width;
    const scaleY = sourceCanvas.height / sourceRect.height;
    const sx = Math.max(0, (cardRect.left - sourceRect.left) * scaleX);
    const sy = Math.max(0, (cardRect.top - sourceRect.top) * scaleY);
    const sw = Math.min(sourceCanvas.width - sx, cardRect.width * scaleX);
    const sh = Math.min(sourceCanvas.height - sy, cardRect.height * scaleY);
    if (sw <= 0 || sh <= 0) return false;

    setSize(source, width, height);
    setSize(color, width, height);
    setSize(opticsCanvas, width, height);
    setSize(backdropCanvas, width, height);

    reset2d(sourceCtx);
    sourceCtx.clearRect(0, 0, width, height);
    sourceCtx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, width, height);

    // Keep point-star cores sharp. Only color/exposure is adapted for the dark scene;
    // the V29.5 shader itself remains responsible for spatial distortion.
    reset2d(colorCtx);
    colorCtx.clearRect(0, 0, width, height);
    colorCtx.save();
    colorCtx.filter = `brightness(${params.brightness}) contrast(${params.contrast}) saturate(${params.saturation})`;
    colorCtx.drawImage(source, 0, 0, width, height);
    colorCtx.restore();

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, color);
    return true;
  }

  function renderOptics() {
    const quality = Math.min(window.devicePixelRatio || 1, 1.5);
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
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(locations.uBlurTexture, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function frame(now) {
    if (!failed && visible && !document.hidden && now - lastCapture >= CAPTURE_INTERVAL_MS) {
      try {
        if (captureSource()) {
          renderOptics();
          lastCapture = now;
        }
      } catch (error) {
        failed = true;
        card.classList.add('liquid-glass--fallback');
        console.warn('[homepage-liquid-glass] V29.5 fallback', error);
      }
    }
    requestAnimationFrame(frame);
  }

  try {
    initGl();
    const observer = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      if (visible) lastCapture = -1e9;
    }, { threshold: 0.01 });
    observer.observe(card);
    window.addEventListener('resize', () => {
      lastCapture = -1e9;
    }, { passive: true });
    requestAnimationFrame(frame);
  } catch (error) {
    failed = true;
    card.classList.add('liquid-glass--fallback');
    console.warn('[homepage-liquid-glass] unavailable; using shared CSS glass', error);
  }
})();
