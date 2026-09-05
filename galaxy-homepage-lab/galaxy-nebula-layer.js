const starCanvas = document.getElementById('galaxyCanvas');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!starCanvas) {
  throw new Error('Galaxy canvas is required before the Milky Way layer can mount.');
}

// Milky Way density / extinction renderer.
// The Astra-style resolved-star renderer stays untouched. This layer contributes
// the broad galactic stellar disk, the central bulge, split bright ridges, embedded
// micro-stars, and physically-motivated dust extinction.
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

  // Deep-space layer: tiny camera parallax only.
  p += vec2(uCamera.x * 0.0025, uCamera.y * 0.0018);

  // Keep the diagonal composition, but model the Milky Way as a thick stellar disk
  // instead of a single procedural stripe.
  vec2 axis = normalize(vec2(0.69, 0.724));
  vec2 normal = vec2(-axis.y, axis.x);
  float along = dot(p, axis);
  float across = dot(p, normal);

  float curve = 0.026 * sin(along * 1.35 + 0.34)
              + 0.010 * sin(along * 3.35 - 0.72);
  across -= curve;

  // Nearly static: the body should read as a star field, not animated smoke.
  float drift = uTime * 0.000012;
  vec2 driftOffset = vec2(drift, -drift * 0.22);

  float warpBroad = fbm(vec2(along * 0.55, across * 1.00) + vec2(3.8, -2.7) + driftOffset);
  float warpMid = fbm(vec2(along * 1.40, across * 2.65) + vec2(-5.6, 6.9));
  float warpedAcross = across
    + (warpBroad - 0.5) * 0.060
    + (warpMid - 0.5) * 0.025;

  float widthScale = mix(0.82, 1.0, smoothstep(0.78, 1.12, aspect));

  // --- Global silhouette ----------------------------------------------------
  // The real Milky Way is not constant-width. It swells around the galactic centre,
  // then tapers into a broad but much fainter disk on both sides.
  float galacticCentreLong = gaussian(along + 0.13, 0.47);
  float centreWidthBoost = 1.0 + galacticCentreLong * 0.62;

  float broadProfile = gaussian(warpedAcross, 0.315 * widthScale * centreWidthBoost);
  float diskProfile = gaussian(warpedAcross, 0.205 * widthScale * (1.0 + galacticCentreLong * 0.38));
  float innerProfile = gaussian(warpedAcross, 0.125 * widthScale * (1.0 + galacticCentreLong * 0.22));

  float leftDisk = gaussian(along + 0.94, 0.88);
  float centreDisk = gaussian(along + 0.10, 0.72);
  float rightDisk = gaussian(along - 0.78, 0.92);
  float farRight = gaussian(along - 1.36, 0.62);
  float longitudinal = clamp(
      leftDisk * 0.50
    + centreDisk * 0.95
    + rightDisk * 0.58
    + farRight * 0.20,
    0.0,
    1.0
  );

  // A separate elliptical nuclear bulge is the key silhouette cue that was missing.
  float bulge = ellipticalGaussian(
    vec2(along + 0.13, warpedAcross - 0.008),
    vec2(0.42, 0.190 * widthScale)
  );
  float outerBulge = ellipticalGaussian(
    vec2(along + 0.13, warpedAcross - 0.004),
    vec2(0.58, 0.275 * widthScale)
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

  // Two irregular luminous ridges on opposite sides of the central dust rift.
  // This gives the characteristic "split Milky Way" appearance instead of one ribbon.
  float ridgeOffsetA = 0.082
    + sin(along * 1.95 + 0.70) * 0.018
    + (macroA - 0.5) * 0.032;
  float ridgeOffsetB = -0.092
    + sin(along * 1.55 - 0.45) * 0.022
    + (macroB - 0.5) * 0.036;

  float ridgeA = gaussian(warpedAcross - ridgeOffsetA, 0.070 * widthScale)
    * longitudinal
    * (0.35 + 0.65 * macroDensity)
    * (0.48 + 0.52 * filamentDensity);

  float ridgeB = gaussian(warpedAcross - ridgeOffsetB, 0.082 * widthScale)
    * longitudinal
    * (0.30 + 0.70 * macroDensity)
    * (0.44 + 0.56 * midDensity);

  // Localized giant star-cloud complexes make the band asymmetric and lumpy.
  float cloudMaskA = gaussian(along + 0.55, 0.28);
  float cloudMaskB = gaussian(along - 0.28, 0.34);
  float cloudMaskC = gaussian(along - 0.82, 0.30);
  float cloudComplexes = clamp(
      cloudMaskA * smoothstep(0.40, 0.73, macroA) * 0.72
    + cloudMaskB * smoothstep(0.38, 0.71, macroB) * 0.82
    + cloudMaskC * smoothstep(0.50, 0.76, mid) * 0.46,
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
  // A wide, wandering main rift cuts the stellar disk into two luminous banks.
  // Secondary branches and opaque pockets break it up like photographic dust lanes.
  float dustWarp = (mid - 0.5) * 0.085
    + (fine - 0.5) * 0.030
    + sin(along * 2.05 - 0.25) * 0.018;

  float riftWidth = (0.052 + galacticCentreLong * 0.020) * widthScale;
  float mainRift = gaussian(warpedAcross + 0.006 + dustWarp, riftWidth)
    * longitudinal
    * (0.58 + 0.54 * smoothstep(0.35, 0.72, macroB));

  float upperBranch = gaussian(
    warpedAcross - 0.122 + (macroA - 0.5) * 0.060,
    0.038 * widthScale
  ) * longitudinal
    * smoothstep(0.45, 0.76, fine)
    * (0.45 + 0.55 * cloudMaskB);

  float lowerBranch = gaussian(
    warpedAcross + 0.148 + (mid - 0.5) * 0.068,
    0.043 * widthScale
  ) * longitudinal
    * (1.0 - smoothstep(0.48, 0.72, fine))
    * (0.48 + 0.52 * cloudMaskA);

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
    * (0.72 + galacticCentreLong * 0.46);

  float dustOpticalDepth = clamp(
      centralDust * 1.48
    + upperBranch * 0.82
    + lowerBranch * 0.68
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

  // Keep the previous debug exposure behaviour. This iteration changes geometry,
  // not the browser-level brightness experiment already applied to this canvas.
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

  // Black alpha only where the dust actually lives, so it extinguishes the resolved
  // star canvas below and makes the rift visually carve through the galactic band.
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

  // Add local stellar-cloud contrast without introducing a separate fog field.
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
