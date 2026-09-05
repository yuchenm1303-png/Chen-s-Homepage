const starCanvas = document.getElementById('galaxyCanvas');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!starCanvas) {
  throw new Error('Galaxy canvas is required before the Milky Way layer can mount.');
}

// Milky Way density / extinction renderer.
// The Astra-style resolved-star renderer stays untouched. This layer contributes
// broken stellar-cloud structure, embedded micro-stars, and dust extinction.
const canvas = document.createElement('canvas');
canvas.id = 'galaxyNebulaCanvas';
canvas.setAttribute('aria-hidden', 'true');
Object.assign(canvas.style, {
  position: 'fixed',
  inset: '0',
  width: '100vw',
  height: '100vh',
  display: 'block',
  pointerEvents: 'none',
  zIndex: '1',
});

starCanvas.style.zIndex = '0';
starCanvas.insertAdjacentElement('afterend', canvas);

const gl = canvas.getContext('webgl2', {
  alpha: true,
  antialias: false,
  depth: false,
  stencil: false,
  powerPreference: 'high-performance',
  premultipliedAlpha: false,
});

if (!gl) throw new Error('WebGL2 is required for the Milky Way density layer.');

const VERTEX = `#version 300 es
precision highp float;
out vec2 vUv;

void main() {
  vec2 p;
  if (gl_VertexID == 0) p = vec2(-1.0, -1.0);
  else if (gl_VertexID == 1) p = vec2(3.0, -1.0);
  else p = vec2(-1.0, 3.0);

  vUv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}
`;

const FRAGMENT = `#version 300 es
precision highp float;

in vec2 vUv;
uniform vec2 uResolution;
uniform vec2 uCamera;
uniform float uTime;
out vec4 outColor;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec2 hash22(vec2 p) {
  float n = sin(dot(p, vec2(41.0, 289.0)));
  return fract(vec2(262144.0, 32768.0) * n);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.52;
  mat2 octave = mat2(1.71, 1.09, -1.09, 1.71);

  for (int i = 0; i < 6; i++) {
    value += valueNoise(p) * amplitude;
    p = octave * p + vec2(0.17, -0.21);
    amplitude *= 0.48;
  }

  return value;
}

float ridgedFbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.54;
  mat2 octave = mat2(1.63, 1.14, -1.14, 1.63);

  for (int i = 0; i < 5; i++) {
    float n = valueNoise(p);
    float ridge = 1.0 - abs(n * 2.0 - 1.0);
    value += ridge * ridge * amplitude;
    p = octave * p + vec2(-0.27, 0.23);
    amplitude *= 0.49;
  }

  return value;
}

float gaussian(float x, float width) {
  return exp(-pow(x / max(width, 0.0001), 2.0));
}

float ellipticalGaussian(vec2 q, vec2 width) {
  vec2 n = q / max(width, vec2(0.0001));
  return exp(-dot(n, n));
}

float microStar(vec2 p, float scale, float threshold, float radius) {
  vec2 cellCoord = p * scale;
  vec2 cell = floor(cellCoord);
  vec2 local = fract(cellCoord) - 0.5;
  vec2 jitter = (hash22(cell + 7.31) - 0.5) * 0.78;
  float d = length(local - jitter);
  float gate = smoothstep(threshold, 1.0, hash21(cell + 31.77));

  float footprint = max(fwidth(d) * 0.82, 0.006);
  float coverage = 1.0 - smoothstep(radius - footprint, radius + footprint, d);
  return coverage * gate;
}

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);

  p += vec2(uCamera.x * 0.0025, uCamera.y * 0.0018);

  // The Milky Way is treated as a projected stellar-cloud lane, not an external
  // edge-on galaxy. There is no smooth nuclear ellipse spanning the whole band.
  vec2 axis = normalize(vec2(0.69, 0.724));
  vec2 normal = vec2(-axis.y, axis.x);
  float along = dot(p, axis);
  float across = dot(p, normal);

  float curve = 0.021 * sin(along * 1.30 + 0.42)
              + 0.011 * sin(along * 3.55 - 0.68);
  across -= curve;

  float drift = uTime * 0.000010;
  vec2 driftOffset = vec2(drift, -drift * 0.18);

  float broadWarp = fbm(vec2(along * 0.58, across * 1.10) + vec2(3.8, -2.7) + driftOffset);
  float middleWarp = fbm(vec2(along * 1.55, across * 2.80) + vec2(-5.6, 6.9));
  float warpedAcross = across
    + (broadWarp - 0.5) * 0.050
    + (middleWarp - 0.5) * 0.024;

  float widthScale = mix(0.82, 1.0, smoothstep(0.78, 1.12, aspect));

  // --- Irregular Milky Way silhouette --------------------------------------
  // Width changes continuously, but not as a symmetric central bulge.
  float widthNoise = fbm(vec2(along * 0.78, 3.15) + vec2(1.7, -4.2));
  float widthLumps =
      gaussian(along + 0.52, 0.42) * 0.040
    + gaussian(along - 0.34, 0.38) * 0.028
    + gaussian(along - 0.86, 0.34) * 0.020;
  float bandWidth = (0.205 + (widthNoise - 0.5) * 0.055 + widthLumps) * widthScale;
  bandWidth = max(bandWidth, 0.145 * widthScale);

  float bandProfile = gaussian(warpedAcross, bandWidth);
  float innerProfile = gaussian(warpedAcross, bandWidth * 0.58);
  float outerProfile = gaussian(warpedAcross, bandWidth * 1.34);

  // Longitudinal density is deliberately uneven: several sky star-cloud regions,
  // not one central body with symmetric tails.
  float leftField = gaussian(along + 1.00, 0.72);
  float sagittariusField = gaussian(along + 0.38, 0.46);
  float centralField = gaussian(along - 0.10, 0.62);
  float cygnusField = gaussian(along - 0.72, 0.58);
  float farField = gaussian(along - 1.30, 0.52);

  float alongEnvelope = clamp(
      leftField * 0.44
    + sagittariusField * 0.92
    + centralField * 0.55
    + cygnusField * 0.72
    + farField * 0.22,
    0.0,
    1.0
  );

  // --- Stellar cloud field --------------------------------------------------
  float macroA = fbm(vec2(along * 0.82, warpedAcross * 1.48) + vec2(7.8, 1.2));
  float macroB = fbm(vec2(along * 1.24, warpedAcross * 2.35) + vec2(-3.4, 9.1));
  float mid = fbm(vec2(along * 3.10, warpedAcross * 5.80) + vec2(-9.0, 2.9));
  float fine = fbm(vec2(along * 7.20, warpedAcross * 13.4) + vec2(4.9, -8.1));
  float ridges = ridgedFbm(vec2(along * 3.75, warpedAcross * 8.10) + vec2(11.4, -5.0));

  float cloudMacro = smoothstep(0.31, 0.71, macroA * 0.54 + macroB * 0.46);
  float cloudMid = smoothstep(0.30, 0.72, mid);
  float cloudFine = smoothstep(0.34, 0.74, fine);
  float ridgeTexture = smoothstep(0.40, 0.77, ridges);

  // Large low-density holes interrupt the emission so the band never becomes a
  // continuous translucent sheet.
  float cavityNoise = fbm(vec2(along * 2.10, warpedAcross * 3.40) + vec2(-13.0, 4.6));
  float cavities = smoothstep(0.62, 0.80, cavityNoise);

  float baseClouds = bandProfile
    * alongEnvelope
    * (0.16 + 0.84 * cloudMacro)
    * (0.42 + 0.58 * cloudMid)
    * (1.0 - cavities * 0.48);

  float filamentClouds = innerProfile
    * alongEnvelope
    * (0.20 + 0.80 * ridgeTexture)
    * (0.32 + 0.68 * cloudFine);

  // Distinct bright star-cloud complexes. They are noisy and embedded in the band,
  // rather than smooth ellipses painted as a galactic bulge.
  float sagittariusComplex = ellipticalGaussian(
    vec2(along + 0.43, warpedAcross + 0.020),
    vec2(0.30, 0.135 * widthScale)
  ) * (0.36 + 0.64 * cloudMacro)
    * (0.48 + 0.52 * ridgeTexture);

  float scutumComplex = ellipticalGaussian(
    vec2(along + 0.03, warpedAcross - 0.045),
    vec2(0.24, 0.115 * widthScale)
  ) * (0.30 + 0.70 * cloudMid);

  float cygnusComplex = ellipticalGaussian(
    vec2(along - 0.66, warpedAcross + 0.025),
    vec2(0.34, 0.125 * widthScale)
  ) * (0.34 + 0.66 * macroB)
    * (0.44 + 0.56 * cloudFine);

  float brightComplexes = clamp(
      sagittariusComplex * 0.92
    + scutumComplex * 0.62
    + cygnusComplex * 0.72,
    0.0,
    1.35
  );

  float stellarDensity = clamp(
      baseClouds * 0.82
    + filamentClouds * 0.38
    + brightComplexes * 0.66,
    0.0,
    1.55
  );

  // --- Dust extinction ------------------------------------------------------
  // The Great Rift is prominent but broken. It should not read as one continuous
  // black trench from corner to corner.
  float dustLarge = fbm(vec2(along * 1.95, warpedAcross * 4.20) + vec2(5.2, -7.4));
  float dustFine = fbm(vec2(along * 5.10, warpedAcross * 10.8) + vec2(-8.6, 2.2));

  float riftCentre = 0.004
    + (dustLarge - 0.5) * 0.070
    + (dustFine - 0.5) * 0.022
    + sin(along * 2.15 - 0.30) * 0.014;

  float riftAlong = clamp(
      gaussian(along + 0.28, 0.78) * 0.95
    + gaussian(along - 0.70, 0.52) * 0.60,
    0.0,
    1.0
  );

  float riftBreakNoise = fbm(vec2(along * 4.10, 0.7) + vec2(9.4, -3.1));
  float riftContinuity = 0.36 + 0.64 * (1.0 - smoothstep(0.60, 0.78, riftBreakNoise));

  float mainRift = gaussian(
    warpedAcross + riftCentre,
    (0.038 + 0.014 * smoothstep(0.45, 0.78, dustLarge)) * widthScale
  ) * riftAlong
    * riftContinuity
    * (0.50 + 0.50 * smoothstep(0.34, 0.72, dustLarge));

  float branchA = gaussian(
    warpedAcross - 0.090 + (macroA - 0.5) * 0.060,
    0.030 * widthScale
  ) * gaussian(along + 0.18, 0.48)
    * smoothstep(0.47, 0.75, dustFine);

  float branchB = gaussian(
    warpedAcross + 0.110 + (mid - 0.5) * 0.065,
    0.034 * widthScale
  ) * gaussian(along - 0.58, 0.42)
    * (1.0 - smoothstep(0.50, 0.73, fine));

  float pocketA = smoothstep(
    0.63,
    0.82,
    fbm(vec2(along * 4.8, warpedAcross * 10.2) + vec2(-12.5, 5.1))
  ) * gaussian(along + 0.50, 0.30);
  float pocketB = smoothstep(
    0.66,
    0.84,
    fbm(vec2(along * 5.6, warpedAcross * 11.8) + vec2(6.7, 11.9))
  ) * gaussian(along - 0.18, 0.34);

  float darkPockets = innerProfile
    * alongEnvelope
    * clamp(pocketA * 0.72 + pocketB * 0.62, 0.0, 1.0);

  float dustOpticalDepth = clamp(
      mainRift * 1.32
    + branchA * 0.62
    + branchB * 0.54
    + darkPockets * 0.82,
    0.0,
    2.75
  );

  float transmission = exp(-dustOpticalDepth * 1.48);

  float visibleDensity = stellarDensity * transmission;
  float visibleBase = baseClouds * transmission;
  float visibleFilaments = filamentClouds * transmission;
  float visibleComplexes = brightComplexes * transmission;

  // Only stellar density produces unresolved light. The weak outer profile is not
  // allowed to become a self-luminous fog halo.
  float unresolvedLinear =
      visibleDensity * 0.74
    + visibleComplexes * 0.30
    + visibleFilaments * 0.14;
  float unresolved = 1.0 - exp(-unresolvedLinear * 1.48);

  // Mostly grey-white and warm stellar light. Colour accents are kept tiny because
  // broad blue/orange gradients make the structure read as a nebula.
  float warmRegion = clamp(
      sagittariusComplex * 0.62
    + scutumComplex * 0.26,
    0.0,
    1.0
  ) * transmission;
  float coolRegion = cygnusComplex * transmission;
  float dustReddening = clamp((1.0 - transmission) * visibleBase, 0.0, 1.0);

  vec3 neutralLight = vec3(0.345, 0.352, 0.360);
  vec3 warmLight = vec3(0.455, 0.410, 0.345);
  vec3 coolLight = vec3(0.285, 0.330, 0.390);
  vec3 dustLight = vec3(0.355, 0.300, 0.260);

  vec3 glowColor = neutralLight;
  glowColor = mix(glowColor, warmLight, clamp(warmRegion * 0.38, 0.0, 0.38));
  glowColor = mix(glowColor, coolLight, clamp(coolRegion * 0.16, 0.0, 0.16));
  glowColor = mix(glowColor, dustLight, clamp(dustReddening * 0.14, 0.0, 0.14));

  // --- Embedded micro-stars -------------------------------------------------
  // More of the visual energy lives in discrete stars than in diffuse glow.
  float microMaskLinear =
      visibleDensity * 0.86
    + visibleComplexes * 0.42
    + visibleFilaments * 0.22;
  float microMask = 1.0 - exp(-microMaskLinear * 1.62);

  float microA = microStar(p + vec2(1.3, -2.1), 138.0, 0.960, 0.055);
  float microB = microStar(p + vec2(-3.0, 1.6), 218.0, 0.979, 0.050);
  float microC = microStar(p + vec2(4.6, 3.3), 342.0, 0.990, 0.045);
  float microD = microStar(p + vec2(-5.2, -4.1), 520.0, 0.996, 0.041);

  float microStars = (
      microA * 0.76
    + microB * 0.58
    + microC * 0.42
    + microD * 0.28
  ) * microMask;

  float starTemperature = hash21(floor(p * 173.0) + 9.17);
  vec3 coolStar = vec3(0.68, 0.78, 0.94);
  vec3 warmStar = vec3(0.98, 0.82, 0.62);
  vec3 microColor = mix(coolStar, warmStar, smoothstep(0.38, 0.76, starTemperature));

  // Keep the aggressive browser debug exposure from the previous iteration.
  // Here we deliberately reduce diffuse alpha so brightness comes from dense
  // star-cloud regions rather than one translucent luminous sheet.
  float emissionAlpha = clamp(
      unresolved * 0.118
    + visibleComplexes * 0.030,
    0.0,
    0.215
  );

  float exposure = 0.30 + unresolved * 0.72;
  vec3 emission = glowColor * exposure;

  emission += microColor * microStars * 1.16;
  emissionAlpha = clamp(emissionAlpha + microStars * 0.42, 0.0, 0.31);

  // Extinguish the resolved Astra stars only where actual dust lies.
  float extinctionAlpha = clamp(
    (1.0 - transmission)
    * bandProfile
    * alongEnvelope
    * 0.25,
    0.0,
    0.22
  );

  float alpha = clamp(emissionAlpha + extinctionAlpha, 0.0, 0.36);
  float extinctionMix = extinctionAlpha / max(alpha, 0.0001);
  vec3 color = mix(emission, vec3(0.0012, 0.0017, 0.0024), extinctionMix);

  // Suppress the smooth low-density outskirts and preserve only density-driven texture.
  float structuralMask = clamp(
      0.70
    + visibleDensity * 0.18
    + cloudFine * innerProfile * transmission * 0.08
    + ridgeTexture * visibleFilaments * 0.08,
    0.0,
    1.06
  );
  color *= structuralMask;

  float grain = hash21(gl_FragCoord.xy + 41.37) - 0.5;
  color += vec3(grain * 0.0014) * emissionAlpha;

  vec2 edgeUv = abs(vUv - 0.5) * 2.0;
  float edgeFade = 1.0 - smoothstep(0.82, 1.06, max(edgeUv.x, edgeUv.y));
  alpha *= mix(0.78, 1.0, edgeFade);

  // Keep the outer envelope strictly non-luminous unless stellar density exists there.
  alpha *= clamp(outerProfile * alongEnvelope * 1.16, 0.0, 1.0);

  if (alpha <= 0.0008) discard;
  outColor = vec4(max(color, vec3(0.0)), alpha);
}
`;

function compile(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(log || 'Milky Way shader compilation failed');
  }

  return shader;
}

function link(vertexSource, fragmentSource) {
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(log || 'Milky Way shader link failed');
  }

  return program;
}

const program = link(VERTEX, FRAGMENT);
const vao = gl.createVertexArray();
const uniforms = {
  resolution: gl.getUniformLocation(program, 'uResolution'),
  camera: gl.getUniformLocation(program, 'uCamera'),
  time: gl.getUniformLocation(program, 'uTime'),
};

const state = {
  width: 1,
  height: 1,
  dpr: 1,
  inputTarget: [0, 0],
  input: [0, 0],
  camera: [0, 0],
  active: false,
  startTime: performance.now(),
  lastFrame: 0,
};

function applyDeadZone(value, deadZone = 0.06) {
  const magnitude = Math.abs(value);
  if (magnitude <= deadZone) return 0;
  const sign = value < 0 ? -1 : 1;
  return sign * (magnitude - deadZone) / (1 - deadZone);
}

function damp(current, target, speed, dt) {
  return current + (target - current) * (1 - Math.exp(-speed * dt));
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.45);
  const width = Math.max(1, Math.round(window.innerWidth * dpr));
  const height = Math.max(1, Math.round(window.innerHeight * dpr));

  if (width === state.width && height === state.height && dpr === state.dpr) return;

  state.dpr = dpr;
  state.width = width;
  state.height = height;
  canvas.width = width;
  canvas.height = height;
}

function onPointerMove(event) {
  const rawX = (event.clientX / Math.max(window.innerWidth, 1)) * 2 - 1;
  const rawY = -((event.clientY / Math.max(window.innerHeight, 1)) * 2 - 1);
  state.inputTarget[0] = applyDeadZone(rawX);
  state.inputTarget[1] = applyDeadZone(rawY);
  state.active = true;
}

function onPointerLeave() {
  state.active = false;
  state.inputTarget[0] = 0;
  state.inputTarget[1] = 0;
}

window.addEventListener('resize', resize, { passive: true });
window.addEventListener('pointermove', onPointerMove, { passive: true });
window.addEventListener('pointerleave', onPointerLeave, { passive: true });
window.addEventListener('blur', onPointerLeave, { passive: true });

resize();
gl.disable(gl.DEPTH_TEST);
gl.disable(gl.BLEND);

function render(now) {
  resize();

  const seconds = (now - state.startTime) / 1000;
  const dt = Math.min(
    0.05,
    Math.max(0.001, state.lastFrame ? (now - state.lastFrame) / 1000 : 0.016)
  );
  state.lastFrame = now;

  if (reducedMotion) {
    state.input[0] = 0;
    state.input[1] = 0;
    state.camera[0] = 0;
    state.camera[1] = 0;
  } else {
    const targetX = state.active ? state.inputTarget[0] : 0;
    const targetY = state.active ? state.inputTarget[1] : 0;

    state.input[0] = damp(state.input[0], targetX, 7.0, dt);
    state.input[1] = damp(state.input[1], targetY, 7.0, dt);
    state.camera[0] = damp(state.camera[0], state.input[0], 3.0, dt);
    state.camera[1] = damp(state.camera[1], state.input[1], 3.0, dt);
  }

  gl.viewport(0, 0, state.width, state.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(program);
  gl.bindVertexArray(vao);
  gl.uniform2f(uniforms.resolution, state.width, state.height);
  gl.uniform2f(uniforms.camera, state.camera[0], state.camera[1]);
  gl.uniform1f(uniforms.time, reducedMotion ? 0 : seconds);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  requestAnimationFrame(render);
}

requestAnimationFrame(render);
