(() => {
  'use strict';

  const card = document.querySelector('[data-liquid-glass="v29.5"]');
  const sourceCanvas = document.getElementById('galaxyCanvas');
  const shaders = window.OpenGLV24Shaders;
  if (!card || !sourceCanvas || !shaders?.vs || !shaders?.fs) {
    card?.classList.add('liquid-glass--fallback');
    return;
  }

  // Pinned OpenGL V29.5 defaults from commit 48b489c. Optical mapping and
  // material parameters are unchanged; only the backdrop transport moves from
  // CPU canvases to the galaxy renderer's existing WebGL context.
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
  card.style.borderRadius = `${OPTICAL_RADIUS_PX}px`;

  let rendererRef = null;
  let gl = null;
  let program = null;
  let quad = null;
  let texture = null;
  let locations = null;
  let textureWidth = 0;
  let textureHeight = 0;
  let visible = true;
  let failed = false;

  const previousAfterRender = window.__ASTRA_AFTER_RENDER__;

  function fail(error) {
    if (failed) return;
    failed = true;
    card.classList.add('liquid-glass--fallback');
    console.warn('[homepage-liquid-glass] same-context V29.5 fallback', error);
  }

  function convertVertexShader(source) {
    return `#version 300 es\n${source}`
      .replace(/attribute\s+vec2\s+a\s*;/, 'in vec2 a;');
  }

  function convertFragmentShader(source) {
    let fragment = source
      .replace(
        'uniform float uShoulderEnabled,uRadius,uIntensity;',
        'uniform float uShoulderEnabled,uRadius,uIntensity;\nuniform vec2 uViewportOrigin,uBlurTexel;',
      )
      .replace(
        /vec3 bodyBackdrop\(vec2 uv\)\{[\s\S]*?\n\}/,
        `vec3 bodyBackdrop(vec2 uv){
  vec2 c=clamp(uv,uBlurTexel*1.6,vec2(1.0)-uBlurTexel*1.6);
  vec2 s=vec2(c.x,1.0-c.y);
  vec3 color=texture(uBlurTexture,s).rgb*.20;
  color+=texture(uBlurTexture,s+vec2( uBlurTexel.x,0.0)).rgb*.12;
  color+=texture(uBlurTexture,s+vec2(-uBlurTexel.x,0.0)).rgb*.12;
  color+=texture(uBlurTexture,s+vec2(0.0, uBlurTexel.y)).rgb*.12;
  color+=texture(uBlurTexture,s+vec2(0.0,-uBlurTexel.y)).rgb*.12;
  color+=texture(uBlurTexture,s+vec2( uBlurTexel.x, uBlurTexel.y)).rgb*.08;
  color+=texture(uBlurTexture,s+vec2(-uBlurTexel.x, uBlurTexel.y)).rgb*.08;
  color+=texture(uBlurTexture,s+vec2( uBlurTexel.x,-uBlurTexel.y)).rgb*.08;
  color+=texture(uBlurTexture,s+vec2(-uBlurTexel.x,-uBlurTexel.y)).rgb*.08;
  color*=1.14239631336406;
  color=(color-vec3(.5))*1.0241935483871+vec3(.5);
  float luma=dot(color,vec3(.2126,.7152,.0722));
  color=mix(vec3(luma),color,1.112);
  return clamp(color,0.0,1.0);
}`,
      )
      .replace(
        'vec2 p=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y);',
        'vec2 localFrag=gl_FragCoord.xy-uViewportOrigin;\n  vec2 p=vec2(localFrag.x,uRes.y-localFrag.y);',
      )
      .replace(/texture2D\(/g, 'texture(')
      .replace(/gl_FragColor/g, 'outColor');

    fragment = fragment.replace(
      'precision highp float;',
      'precision highp float;\nout vec4 outColor;',
    );
    return `#version 300 es\n${fragment}`;
  }

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader) || 'Liquid glass shader compile failed';
      gl.deleteShader(shader);
      throw new Error(message);
    }
    return shader;
  }

  function initialize(renderer) {
    if (rendererRef === renderer && program) return;
    rendererRef = renderer;
    gl = renderer.getContext();
    if (!gl || !(gl instanceof WebGL2RenderingContext)) {
      throw new Error('Homepage liquid glass requires the galaxy WebGL2 context.');
    }

    const vertex = compile(gl.VERTEX_SHADER, convertVertexShader(shaders.vs));
    const fragment = compile(gl.FRAGMENT_SHADER, convertFragmentShader(shaders.fs));
    program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'Liquid glass program link failed');
    }

    quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const names = [
      'a', 'uRes', 'uOrigin', 'uRoot', 'uBlurTexture', 'uMat', 'uBodyLensA',
      'uBodyLensB', 'uBody', 'uShoulder', 'uShoulderFlow', 'uShoulderEnabled',
      'uRadius', 'uIntensity', 'uViewportOrigin', 'uBlurTexel',
    ];
    locations = {};
    for (const name of names) {
      locations[name] = name === 'a'
        ? gl.getAttribLocation(program, name)
        : gl.getUniformLocation(program, name);
    }
    const missing = names.filter((name) => (
      name === 'a' ? locations[name] < 0 : locations[name] === null
    ));
    if (missing.length) throw new Error(`Liquid glass uniforms missing: ${missing.join(', ')}`);

    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  function ensureTexture(width, height) {
    if (textureWidth === width && textureHeight === height) return;
    textureWidth = width;
    textureHeight = height;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
  }

  function cardFramebufferRect() {
    const canvasRect = sourceCanvas.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    if (
      canvasRect.width <= 0 || canvasRect.height <= 0
      || cardRect.width <= 0 || cardRect.height <= 0
    ) return null;

    const scaleX = sourceCanvas.width / canvasRect.width;
    const scaleY = sourceCanvas.height / canvasRect.height;
    const left = Math.round((cardRect.left - canvasRect.left) * scaleX);
    const right = Math.round((cardRect.right - canvasRect.left) * scaleX);
    const top = Math.round((cardRect.top - canvasRect.top) * scaleY);
    const bottom = Math.round((cardRect.bottom - canvasRect.top) * scaleY);

    const x = Math.max(0, left);
    const y = Math.max(0, sourceCanvas.height - bottom);
    const width = Math.min(sourceCanvas.width - x, right - left);
    const height = Math.min(sourceCanvas.height - y, bottom - top);
    if (width <= 1 || height <= 1) return null;

    return { x, y, width, height, scale: (scaleX + scaleY) * 0.5 };
  }

  function renderGlass(frame) {
    if (failed || !visible || document.hidden) return;
    const { renderer } = frame || {};
    if (!renderer) return;

    initialize(renderer);
    const rect = cardFramebufferRect();
    if (!rect) return;
    const { x, y, width, height, scale } = rect;

    // GPU-local copy: only the pixels under the liquid card are copied. This
    // replaces WebGL -> 2D Canvas readback and the subsequent CPU -> GPU upload.
    ensureTexture(width, height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, x, y, width, height);

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(locations.a);
    gl.vertexAttribPointer(locations.a, 2, gl.FLOAT, false, 0, 0);

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    gl.enable(gl.SCISSOR_TEST);
    gl.viewport(x, y, width, height);
    gl.scissor(x, y, width, height);

    gl.uniform2f(locations.uRes, width, height);
    gl.uniform2f(locations.uOrigin, 0, 0);
    gl.uniform2f(locations.uRoot, width, height);
    gl.uniform2f(locations.uViewportOrigin, x, y);

    const effectiveBlurPx = params.blurRadius
      * scale
      * Math.pow(Math.max(1, params.blurIterations), 0.55);
    gl.uniform2f(
      locations.uBlurTexel,
      effectiveBlurPx / Math.max(width, 1),
      effectiveBlurPx / Math.max(height, 1),
    );

    gl.uniform1f(locations.uRadius, OPTICAL_RADIUS_PX * scale);
    gl.uniform1f(locations.uIntensity, params.glassIntensity);
    gl.uniform4f(
      locations.uMat,
      params.bodyVisibility,
      params.bodyMaxAlpha,
      params.bodyOutputBrightness,
      0,
    );
    gl.uniform4f(
      locations.uBodyLensA,
      params.bodyLensBasePull * scale,
      params.bodyLensPullDp * scale,
      params.bodyLensConcentration,
      params.bodyLensCornerBoost,
    );
    gl.uniform4f(
      locations.uBodyLensB,
      params.bodyLensExtraDistance * scale,
      params.bodyLensReachDp * scale,
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
      params.shoulderWidthPx * scale,
      params.shoulderMaxAngleDeg,
      params.shoulderFalloffRoundness,
      params.shoulderMaterialStrength,
    );
    gl.uniform2f(
      locations.uShoulderFlow,
      params.shoulderCaptureWidthPx * scale,
      params.shoulderTangentialFlowStrength,
    );
    gl.uniform1f(locations.uShoulderEnabled, params.edgeMode);
    gl.uniform1i(locations.uBlurTexture, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Restore the default viewport/scissor and invalidate Three.js' GL state
    // cache so the next composer frame starts from a known state.
    gl.disable(gl.SCISSOR_TEST);
    gl.viewport(0, 0, sourceCanvas.width, sourceCanvas.height);
    renderer.resetState();
  }

  window.__ASTRA_AFTER_RENDER__ = (frame) => {
    if (typeof previousAfterRender === 'function') previousAfterRender(frame);
    try {
      renderGlass(frame);
    } catch (error) {
      fail(error);
    }
  };

  const observer = new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting);
  }, { threshold: 0.01 });
  observer.observe(card);
})();
