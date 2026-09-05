const starCanvas = document.getElementById('galaxyCanvas');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!starCanvas) {
  throw new Error('Galaxy canvas is required before the Milky Way layer can mount.');
}

// Milky Way density / extinction renderer.
// Keep the d612 material / colour treatment, but rebuild the projected sky silhouette
// so it reads as an asymmetric inner-Milky-Way band rather than an edge-on galaxy.
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

  vec2 axis = normalize(vec2(0.69, 0.724));
  vec2 normal = vec2(-axis.y, axis.x);
  float along = dot(p, axis);
  float across = dot(p, normal);

  // A more obvious projected-sky arc. The centreline bends and fans out around
  // Sagittarius instead of behaving like the major axis of an external galaxy.
  float curve = 0.034 * sin(along * 1.18 + 0.22)
              + 0.018 * sin(along * 2.85 - 0.64);
  across -= curve;

  float drift = uTime * 0.000012;
  vec2 driftOffset = vec2(drift, -drift * 0.22);

  float warpBroad = fbm(vec2(along * 0.55, across * 1.00) + vec2(3.8, -2.7) + driftOffset);
  float warpMid = fbm(vec2(along * 1.40, across * 2.65) + vec2(-5.6, 6.9));
  float warpedAcross = across
    + (warpBroad - 0.5) * 0.060
    + (warpMid - 0.5) * 0.025;

  float widthScale = mix(0.82, 1.0, smoothstep(0.78, 1.12, aspect));

  // --- Strongly asymmetric Milky Way silhouette ----------------------------
  float sagittariusZone = gaussian(along + 0.34, 0.48);
  float scutumZone = gaussian(along - 0.14, 0.62);
  float cygnusZone = gaussian(along - 0.82, 0.76);
  float leftTail = gaussian(along + 1.10, 0.80);
  float farRight = gaussian(along - 1.42, 0.58);

  // Keep this name because the d612 colour/material path uses it downstream.
  float galacticCentreLong = sagittariusZone;

  // The inner Milky Way fans toward one side instead of swelling symmetrically.
  float lopsidedShift = sagittariusZone * 0.080
    - scutumZone * 0.026
    + sin(along * 1.72 + 0.35) * 0.014;
  float localAcross = warpedAcross + lopsidedShift;

  float broadWidth = (
      0.245
    + sagittariusZone * 0.245
    + scutumZone * 0.060
    + (warpBroad - 0.5) * 0.040
  ) * widthScale;
  float diskWidth = (
      0.170
    + sagittariusZone * 0.145
    + scutumZone * 0.035
  ) * widthScale;
  float innerWidth = (
      0.100
    + sagittariusZone * 0.070
  ) * widthScale;

  float upperFan = gaussian(
    warpedAcross - (0.120 + sagittariusZone * 0.055),
    0.145 * widthScale
  ) * sagittariusZone;
  float lowerFan = gaussian(
    warpedAcross + (0.155 - scutumZone * 0.028),
    0.195 * widthScale
  ) * sagittariusZone;

  float broadProfile = clamp(
      gaussian(localAcross, broadWidth) * 0.78
    + upperFan * 0.36
    + lowerFan * 0.58,
    0.0,
    1.35
  );
  float diskProfile = clamp(
      gaussian(localAcross, diskWidth) * 0.82
    + upperFan * 0.25
    + lowerFan * 0.38,
    0.0,
    1.25
  );
  float innerProfile = clamp(
      gaussian(localAcross, innerWidth) * 0.90
    + upperFan * 0.18,
    0.0,
    1.15
  );

  float longitudinal = clamp(
      leftTail * 0.34
    + sagittariusZone * 1.00
    + scutumZone * 0.78
    + cygnusZone * 0.70
    + farRight * 0.18,
    0.0,
    1.0
  );

  // Material-compatible "bulge" fields, now made from offset sky fans rather than
  // smooth external-galaxy ellipses.
  float bulge = clamp(
      lowerFan * 0.72
    + gaussian(localAcross, 0.145 * widthScale) * sagittariusZone * 0.42,
    0.0,
    1.0
  );
  float outerBulge = clamp(
      lowerFan * 0.58
    + upperFan * 0.34
    + gaussian(localAcross, 0.260 * widthScale) * sagittariusZone * 0.44,
    0.0,
    1.0
  );

  // --- Multi-scale stellar cloud structure --------------------------------
  float macroA = fbm(vec2(along * 0.72, warpedAcross * 1.35) + vec2(7.8, 1.2));
  float macroB = fbm(vec2(along * 1.12, warpedAcross * 2.20) + vec2(-3.4, 9.1));
  float mid = fbm(vec2(along * 2.75, warpedAcross * 5.40) + vec2(-9.0, 2.9));
  float fine = fbm(vec2(along * 6.60, warpedAcross * 12.8) + vec2(4.9, -8.1));
  float ridges = ridgedFbm(vec2(along * 3.45, warpedAcross * 7.60) + vec2(11.4, -5.0));

  float macroDensity = smoothstep(0.34, 0.70, macroA * 0.56 + macroB * 0.44);
  float midDensity = smoothstep(0.31, 0.72, mid);
  float filamentDensity = smoothstep(0.40, 0.76, ridges);
  float fineDensity = smoothstep(0.36, 0.73, fine);

  // Two banks now diverge strongly around Sagittarius and then converge again.
  float ridgeOffsetA = 0.095
    + sagittariusZone * 0.080
    + sin(along * 1.70 + 0.62) * 0.022
    + (macroA - 0.5) * 0.034;
  float ridgeOffsetB = -0.078
    - scutumZone * 0.035
    + sin(along * 1.42 - 0.48) * 0.024
    + (macroB - 0.5) * 0.038;

  float ridgeA = gaussian(
    warpedAcross - ridgeOffsetA,
    (0.070 + sagittariusZone * 0.028) * widthScale
  ) * longitudinal
    * (0.35 + 0.65 * macroDensity)
    * (0.48 + 0.52 * filamentDensity);

  float ridgeB = gaussian(
    warpedAcross - ridgeOffsetB,
    (0.080 + scutumZone * 0.018) * widthScale
  ) * longitudinal
    * (0.30 + 0.70 * macroDensity)
    * (0.44 + 0.56 * midDensity);

  // Localized giant star-cloud complexes keep the d612 nebular material, but now
  // occupy visibly different parts of the widened sky band.
  float cloudMaskA = gaussian(along + 0.58, 0.30);
  float cloudMaskB = gaussian(along - 0.12, 0.36);
  float cloudMaskC = gaussian(along - 0.82, 0.34);
  float cloudComplexes = clamp(
      cloudMaskA * smoothstep(0.40, 0.73, macroA) * 0.78
    + cloudMaskB * smoothstep(0.38, 0.71, macroB) * 0.86
    + cloudMaskC * smoothstep(0.50, 0.76, mid) * 0.52,
    0.0,
    1.0
  );

  float broadStars = broadProfile
    * longitudinal
    * (0.28 + 0.72 * macroDensity)
    * (0.50 + 0.50 * midDensity);

  float diskStars = diskProfile
    * longitudinal
    * (0.34 + 0.66 * macroDensity)
    * (0.42 + 0.58 * filamentDensity);

  float granularStars = innerProfile
    * longitudinal
    * (0.18 + 0.82 * midDensity)
    * (0.30 + 0.70 * fineDensity);

  float ridgeStars = ridgeA * 0.88 + ridgeB * 0.82;
  float bulgeStars = bulge * (0.56 + 0.44 * macroDensity)
    + outerBulge * 0.34 * (0.55 + 0.45 * midDensity);

  float stellarDensity = clamp(
      broadStars * 0.56
    + diskStars * 0.62
    + ridgeStars * 0.78
    + granularStars * 0.36
    + bulgeStars * 0.92
    + cloudComplexes * diskProfile * 0.38,
    0.0,
    1.65
  );

  // --- Dust extinction ------------------------------------------------------
  // Make the Great Rift an obvious S-shaped split with two forks. This is the main
  // structural change: it should carve the wide band, not merely recolour it.
  float dustWarp = (mid - 0.5) * 0.090
    + (fine - 0.5) * 0.032
    + sin(along * 1.48 - 0.22) * 0.050
    + sagittariusZone * 0.028;

  float riftWidth = (
      0.047
    + sagittariusZone * 0.048
    + scutumZone * 0.012
  ) * widthScale;
  float riftEnvelope = clamp(
      sagittariusZone * 1.00
    + scutumZone * 0.88
    + cygnusZone * 0.55
    + leftTail * 0.32,
    0.0,
    1.0
  );

  float mainRift = gaussian(
    warpedAcross + dustWarp,
    riftWidth
  ) * riftEnvelope
    * (0.56 + 0.56 * smoothstep(0.35, 0.72, macroB));

  float upperBranch = gaussian(
    warpedAcross - (0.132 + sagittariusZone * 0.060) + (macroA - 0.5) * 0.066,
    (0.040 + sagittariusZone * 0.016) * widthScale
  ) * gaussian(along + 0.18, 0.66)
    * smoothstep(0.45, 0.76, fine)
    * (0.48 + 0.52 * cloudMaskB);

  float lowerBranch = gaussian(
    warpedAcross + (0.158 + scutumZone * 0.042) + (mid - 0.5) * 0.072,
    (0.046 + scutumZone * 0.015) * widthScale
  ) * gaussian(along - 0.22, 0.72)
    * (1.0 - smoothstep(0.48, 0.72, fine))
    * (0.50 + 0.50 * cloudMaskA);

  float pocketA = fbm(vec2(along * 4.1, warpedAcross * 9.4) + vec2(-12.5, 5.1));
  float pocketB = fbm(vec2(along * 5.3, warpedAcross * 11.4) + vec2(6.7, 11.9));
  float darkPockets = diskProfile
    * longitudinal
    * clamp(
        smoothstep(0.58, 0.78, pocketA) * 0.66
      + smoothstep(0.62, 0.82, pocketB) * 0.54,
      0.0,
      1.0
    );

  float centralDust = mainRift
    * (0.78 + sagittariusZone * 0.72);

  float dustOpticalDepth = clamp(
      centralDust * 1.48
    + upperBranch * 0.86
    + lowerBranch * 0.74
    + darkPockets * 1.08,
    0.0,
    3.2
  );

  float transmission = exp(-dustOpticalDepth * 1.48);

  // Dust removes stellar energy. No independently-painted black cloud silhouette.
  float visibleStellarDensity = stellarDensity * transmission;
  float visibleRidgeA = ridgeA * transmission;
  float visibleRidgeB = ridgeB * transmission;
  float visibleBulge = bulgeStars * transmission;
  float visibleGranular = granularStars * transmission;

  // Tone-map stellar density into unresolved photographic glow.
  float unresolvedLinear =
      visibleStellarDensity * 0.72
    + (visibleRidgeA + visibleRidgeB) * 0.30
    + visibleGranular * 0.18
    + visibleBulge * 0.48;
  float unresolved = 1.0 - exp(-unresolvedLinear * 1.38);

  // --- Colour hierarchy -----------------------------------------------------
  float centreWarmth = clamp(outerBulge * 0.72 + bulge * 0.52, 0.0, 1.0);
  float dustReddening = clamp((1.0 - transmission) * stellarDensity, 0.0, 1.0);
  float youngBlue = clamp(
    (visibleRidgeA * 0.55 + visibleRidgeB * 0.34)
    * smoothstep(0.54, 0.80, macroB)
    * (1.0 - bulge * 0.70),
    0.0,
    1.0
  );

  float hiiA = gaussian(along + 0.48, 0.14)
    * gaussian(warpedAcross - ridgeOffsetA, 0.082);
  float hiiB = gaussian(along - 0.34, 0.16)
    * gaussian(warpedAcross - ridgeOffsetB, 0.090);
  float hii = max(hiiA, hiiB)
    * smoothstep(0.54, 0.80, fine)
    * transmission
    * 0.22;

  vec3 neutralLight = vec3(0.340, 0.350, 0.365);
  vec3 warmLight = vec3(0.565, 0.465, 0.345);
  vec3 reddenedLight = vec3(0.390, 0.245, 0.185);
  vec3 blueLight = vec3(0.180, 0.245, 0.365);
  vec3 hiiLight = vec3(0.390, 0.145, 0.175);

  vec3 glowColor = neutralLight;
  glowColor = mix(glowColor, warmLight, clamp(centreWarmth * 0.78, 0.0, 1.0));
  glowColor = mix(glowColor, reddenedLight, clamp(dustReddening * 0.30, 0.0, 0.28));
  glowColor += blueLight * youngBlue * 0.16;
  glowColor += hiiLight * hii * 0.18;

  // --- Embedded micro-stars -------------------------------------------------
  float microMaskLinear =
      visibleStellarDensity * 0.70
    + (visibleRidgeA + visibleRidgeB) * 0.36
    + visibleBulge * 0.30;
  float microMask = 1.0 - exp(-microMaskLinear * 1.42);

  float microA = microStar(p + vec2(1.3, -2.1), 185.0, 0.978, 0.052);
  float microB = microStar(p + vec2(-3.0, 1.6), 285.0, 0.988, 0.047);
  float microC = microStar(p + vec2(4.6, 3.3), 410.0, 0.994, 0.043);

  float microStars = (
      microA * 0.72
    + microB * 0.52
    + microC * 0.34
  ) * microMask;

  float starTemperature = hash21(floor(p * 173.0) + 9.17);
  vec3 coolStar = vec3(0.58, 0.70, 0.92);
  vec3 warmStar = vec3(0.95, 0.76, 0.54);
  vec3 microColor = mix(coolStar, warmStar, smoothstep(0.36, 0.76, starTemperature));

  // Preserve the d612 material/exposure path exactly: this iteration changes geometry.
  float emissionAlpha = clamp(
      unresolved * 0.150
    + visibleBulge * 0.070
    + hii * 0.020,
    0.0,
    0.260
  );

  float exposure = 0.42
    + unresolved * 0.58
    + visibleBulge * 0.22;
  vec3 emission = glowColor * exposure;

  emission += microColor * microStars * 0.86;
  emissionAlpha = clamp(emissionAlpha + microStars * 0.34, 0.0, 0.30);

  float extinctionAlpha = clamp(
    (1.0 - transmission)
    * diskProfile
    * longitudinal
    * 0.34,
    0.0,
    0.29
  );

  float alpha = clamp(emissionAlpha + extinctionAlpha, 0.0, 0.42);
  float extinctionMix = extinctionAlpha / max(alpha, 0.0001);
  vec3 color = mix(emission, vec3(0.0012, 0.0017, 0.0024), extinctionMix);

  float structuralContrast = 0.90
    + (visibleRidgeA + visibleRidgeB) * 0.12
    + cloudComplexes * transmission * 0.10;
  color *= structuralContrast;

  float grain = hash21(gl_FragCoord.xy + 41.37) - 0.5;
  color += vec3(grain * 0.0014) * emissionAlpha;

  vec2 edgeUv = abs(vUv - 0.5) * 2.0;
  float edgeFade = 1.0 - smoothstep(0.82, 1.06, max(edgeUv.x, edgeUv.y));
  alpha *= mix(0.78, 1.0, edgeFade);

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