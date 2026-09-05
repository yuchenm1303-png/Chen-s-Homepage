(() => {
  'use strict';

  const primaryCard = document.querySelector('[data-liquid-glass="v29.5"]');
  const panelCard = document.querySelector('.home-panel');
  const sourceCanvas = document.getElementById('galaxyCanvas');
  const shaders = window.OpenGLV24Shaders;
  if (!primaryCard || !(sourceCanvas instanceof HTMLCanvasElement) || !shaders?.vs || !shaders?.fs) {
    primaryCard?.classList.add('liquid-glass--fallback');
    panelCard?.classList.add('liquid-glass--fallback');
    console.warn('[homepage-liquid-glass] V29.5 prerequisites unavailable; using CSS fallback');
    return;
  }

  const primaryBackdropCanvas = primaryCard.querySelector('.liquid-glass__backdrop');
  const panelBackdropCanvas = panelCard?.querySelector('.liquid-glass__backdrop');
  const opticsCanvas = primaryCard.querySelector('.liquid-glass__optics');
  if (!(primaryBackdropCanvas instanceof HTMLCanvasElement) || !(opticsCanvas instanceof HTMLCanvasElement)) {
    primaryCard.classList.add('liquid-glass--fallback');
    panelCard?.classList.add('liquid-glass--fallback');
    return;
  }

  let card = primaryCard;
  let backdropCanvas = primaryBackdropCanvas;
  let backdropCtx = backdropCanvas.getContext('2d', { alpha: true });

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

  // Keep the approved V29.5 sampling domain around the active glass surface.
  // Only one surface is optically rendered per galaxy frame; when the section
  // panel opens, the existing optics canvas moves there instead of creating a
  // second WebGL -> Canvas2D -> WebGL pipeline.
  const SAMPLE_MARGIN_CSS_PX = 128;
  const MAX_CAPTURE_DPR = 1.25;

  // One prefilter surface replaces the old capture -> color -> blurA -> blurB ->
  // blur chain. Canvas native filters can combine color treatment and the small
  // V29.5 blur in one raster pass, which removes dozens of full-canvas copies.
  const prefilterCanvas = document.createElement('canvas');
  const prefilterCtx = prefilterCanvas.getContext('2d', { alpha: false });

  let gl;
  let program;
  let buffer;
  let locations;
  let blurTexture;
  let textureWidth = 0;
  let textureHeight = 0;
  let failed = false;
  let captureState = null;

  function switchActiveSurface() {
    const panelReady = panelCard instanceof HTMLElement
      && panelBackdropCanvas instanceof HTMLCanvasElement;
    const usePanel = panelReady && document.body.classList.contains('home-panel-open');
    const nextCard = usePanel ? panelCard : primaryCard;
    const nextBackdrop = usePanel ? panelBackdropCanvas : primaryBackdropCanvas;

    if (card === nextCard
        && backdropCanvas === nextBackdrop
        && opticsCanvas.parentElement === nextCard) {
      return;
    }

    card = nextCard;
    backdropCanvas = nextBackdrop;
    backdropCtx = backdropCanvas.getContext('2d', { alpha: true });
    card.prepend(opticsCanvas);
    captureState = null;
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
    try { ctx.filter = 'none'; } catch (_) {}
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
    if (sourceRect.width <= 0 || sourceRect.height <= 0 || cardRect.width <= 0 || cardRect.height <= 0) {
      return false;
    }

    // The glass is deliberately soft and distorted, so sampling above 1.25 DPR
    // adds bandwidth much faster than visible detail. DOM text remains native.
    const quality = Math.min(window.devicePixelRatio || 1, MAX_CAPTURE_DPR);
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

    setCanvasSize(prefilterCanvas, rootWidth, rootHeight);
    setCanvasSize(backdropCanvas, cardWidth, cardHeight);
    setCanvasSize(opticsCanvas, cardWidth, cardHeight);

    const effectiveBlur = Math.max(
      0,
      params.blurRadius * quality * Math.pow(Math.max(1, params.blurIterations), 0.55),
    );

    // One source read and one native filtered raster pass. The old implementation
    // first copied WebGL -> 2D, then ran three horizontal/vertical five-tap passes
    // (36 full-surface drawImage operations) before uploading the result again.
    smoothContext(prefilterCtx);
    prefilterCtx.clearRect(0, 0, rootWidth, rootHeight);
    prefilterCtx.save();
    prefilterCtx.filter = [
      `brightness(${params.brightness})`,
      `contrast(${params.contrast})`,
      `saturate(${params.saturation})`,
      `blur(${effectiveBlur}px)`,
    ].join(' ');
    prefilterCtx.drawImage(
      sourceCanvas,
      sx, sy, sw, sh,
      0, 0, rootWidth, rootHeight,
    );
    prefilterCtx.restore();

    smoothContext(backdropCtx);
    backdropCtx.clearRect(0, 0, cardWidth, cardHeight);
    backdropCtx.drawImage(
      prefilterCanvas,
      originX, originY, cardWidth, cardHeight,
      0, 0, cardWidth, cardHeight,
    );

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, blurTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

    // Preserve texture storage while the capture dimensions are stable. Reusing
    // the allocation avoids a texture redefinition/synchronization on every frame.
    if (textureWidth !== rootWidth || textureHeight !== rootHeight) {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        prefilterCanvas,
      );
      textureWidth = rootWidth;
      textureHeight = rootHeight;
    } else {
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        prefilterCanvas,
      );
    }

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

  function syncFromGalaxyFrame() {
    if (failed || document.hidden) return;
    switchActiveSurface();

    // Do not add a second frame-rate gate here. The galaxy renderer already
    // decides which frames are presented (24 Hz when truly idle, browser cadence
    // while the camera is moving) and calls this hook immediately after each one.
    // Following that cadence keeps the active glass surface spatially locked to
    // the visible galaxy without rendering a second optics pipeline.
    try {
      if (captureBackdrop()) {
        renderOptics();
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

    // The galaxy renderer calls this immediately after composer.render(). At
    // that point preserveDrawingBuffer=false is still safe because the displayed
    // framebuffer has just been produced and has not been discarded yet.
    window.__SMIREL_HOMEPAGE_GLASS_SYNC__ = syncFromGalaxyFrame;
  } catch (error) {
    failed = true;
    primaryCard.classList.add('liquid-glass--fallback');
    panelCard?.classList.add('liquid-glass--fallback');
    console.warn('[homepage-liquid-glass] unavailable; using CSS fallback', error);
  }
})();
