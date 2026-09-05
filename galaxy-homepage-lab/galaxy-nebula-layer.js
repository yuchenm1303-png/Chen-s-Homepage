const starCanvas = document.getElementById('galaxyCanvas');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!starCanvas) {
  throw new Error('Galaxy canvas is required before the Milky Way layer can mount.');
}

// Milky Way density / extinction renderer.
// The approved Astra-style resolved-star renderer stays untouched. This layer adds
// only unresolved stellar density, embedded micro-stars, and dust extinction.
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

float microStar(vec2 p, float scale, float threshold, float radius) {
  vec2 cellCoord = p * scale;
  vec2 cell = floor(cellCoord);
  vec2 local = fract(cellCoord) - 0.5;
  vec2 jitter = (hash22(cell + 7.31) - 0.5) * 0.78;
  float d = length(local - jitter);
  float gate = smoothstep(threshold, 1.0, hash21(cell + 31.77));
  return smoothstep(radius, 0.0, d) * gate;
}

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);

  // Deep-space layer: tiny parallax only.
  p += vec2(uCamera.x * 0.0025, uCamera.y * 0.0018);

  // Preserve the approved diagonal composition, but use a mildly curved galactic plane.
  vec2 axis = normalize(vec2(0.69, 0.724));
  vec2 normal = vec2(-axis.y, axis.x);
  float along = dot(p, axis);
  float across = dot(p, normal);

  float curve = 0.036 * sin(along * 1.55 + 0.48)
              + 0.009 * sin(along * 4.20 - 0.68);
  across -= curve;

  // Essentially static. This prevents the Milky Way body from reading as animated smoke.
  float drift = uTime * 0.000018;
  vec2 driftOffset = vec2(drift, -drift * 0.22);

  float warpA = fbm(vec2(along * 0.52, across * 1.06) + vec2(3.8, -2.7) + driftOffset);
  float warpB = fbm(vec2(along * 1.28, across * 2.45) + vec2(-5.6, 6.9));
  float warpedAcross = across
    + (warpA - 0.5) * 0.080
    + (warpB - 0.5) * 0.030;

  // Portrait screens should not be filled by a giant cloud stripe.
  float widthScale = mix(0.76, 1.0, smoothstep(0.78, 1.12, aspect));
  float broadProfile = gaussian(warpedAcross, 0.245 * widthScale);
  float innerProfile = gaussian(warpedAcross, 0.135 * widthScale);
  float coreProfile = gaussian(warpedAcross, 0.070 * widthScale);

  // Longitudinal stellar density: one dominant centre and weaker shoulders.
  float leftShoulder = gaussian(along + 0.82, 0.66);
  float galacticCentre = gaussian(along + 0.04, 0.46);
  float rightShoulder = gaussian(along - 0.66, 0.68);
  float farTail = gaussian(along - 1.08, 0.50);

  float longitudinal = clamp(
      leftShoulder * 0.30
    + galacticCentre * 1.00
    + rightShoulder * 0.40
    + farTail * 0.17,
    0.0,
    1.0
  );

  // Multi-scale stellar structure. These fields modulate density, not opaque cloud colour.
  float macroA = fbm(vec2(along * 0.74, warpedAcross * 1.50) + vec2(7.8, 1.2));
  float macroB = fbm(vec2(along * 1.08, warpedAcross * 2.00) + vec2(-3.4, 9.1));
  float mid = fbm(vec2(along * 2.65, warpedAcross * 5.00) + vec2(-9.0, 2.9));
  float fine = fbm(vec2(along * 6.20, warpedAcross * 12.0) + vec2(4.9, -8.1));
  float ridges = ridgedFbm(vec2(along * 3.20, warpedAcross * 7.40) + vec2(11.4, -5.0));

  float macroDensity = smoothstep(0.37, 0.70, macroA * 0.58 + macroB * 0.42);
  float midDensity = smoothstep(0.34, 0.71, mid);
  float filamentDensity = smoothstep(0.43, 0.75, ridges);
  float fineDensity = smoothstep(0.39, 0.72, fine);

  // This is the actual Milky Way stellar-density field.
  float stellarDensity = broadProfile
    * longitudinal
    * (0.24 + 0.76 * macroDensity)
    * (0.40 + 0.60 * midDensity);

  float denseLane = innerProfile
    * longitudinal
    * (0.18 + 0.82 * macroDensity)
    * (0.40 + 0.60 * filamentDensity);

  float granularDensity = innerProfile
    * longitudinal
    * midDensity
    * fineDensity;

  float centreDensity = coreProfile
    * galacticCentre
    * (0.30 + 0.70 * macroDensity)
    * (0.44 + 0.56 * filamentDensity);

  // Dust optical depth. Dark structure is produced by attenuation, not by painting black fog.
  float dustWarp = (mid - 0.5) * 0.072
    + (fine - 0.5) * 0.024
    + sin(along * 2.15 - 0.16) * 0.012;

  float mainRift = gaussian(
    warpedAcross + 0.010 + dustWarp,
    0.043 * widthScale
  ) * (0.38 + 0.62 * smoothstep(0.39, 0.70, macroB));

  float branchA = gaussian(
    warpedAcross - 0.082 + (macroA - 0.5) * 0.050,
    0.028 * widthScale
  ) * smoothstep(0.50, 0.76, fine);

  float branchB = gaussian(
    warpedAcross + 0.108 + (mid - 0.5) * 0.054,
    0.032 * widthScale
  ) * (1.0 - smoothstep(0.46, 0.70, fine));

  float pocketA = fbm(vec2(along * 3.9, warpedAcross * 9.0) + vec2(-12.5, 5.1));
  float pocketB = fbm(vec2(along * 5.0, warpedAcross * 11.0) + vec2(6.7, 11.9));
  float cloudPockets = innerProfile
    * longitudinal
    * clamp(
        smoothstep(0.60, 0.78, pocketA) * 0.60
      + smoothstep(0.65, 0.82, pocketB) * 0.40,
      0.0,
      1.0
    );

  float dustOpticalDepth = clamp(
      mainRift * 1.15
    + branchA * 0.55
    + branchB * 0.42
    + cloudPockets * 0.92,
    0.0,
    2.4
  );

  // Beer-Lambert-like transmission: the dust genuinely removes stellar energy.
  float transmission = exp(-dustOpticalDepth * 1.55);

  float visibleStellarDensity = stellarDensity * transmission;
  float visibleDenseLane = denseLane * transmission;
  float visibleGranular = granularDensity * transmission;
  float visibleCentre = centreDensity * transmission;

  // Unresolved glow is derived from density only. There is no independent nebula silhouette.
  float unresolved = clamp(
      visibleStellarDensity * 0.42
    + visibleDenseLane * 0.40
    + visibleGranular * 0.24
    + visibleCentre * 0.64,
    0.0,
    1.0
  );

  // Subtle physical colour hierarchy.
  float centreWarmth = galacticCentre * (0.45 + 0.55 * macroDensity);
  float dustReddening = clamp((1.0 - transmission) * visibleStellarDensity, 0.0, 1.0);
  float youngBlue = broadProfile
    * (1.0 - galacticCentre)
    * smoothstep(0.58, 0.82, macroB)
    * filamentDensity
    * transmission;

  float hiiA = gaussian(along + 0.42, 0.13)
    * gaussian(warpedAcross - 0.055, 0.075);
  float hiiB = gaussian(along - 0.37, 0.14)
    * gaussian(warpedAcross + 0.065, 0.082);
  float hii = max(hiiA, hiiB)
    * smoothstep(0.58, 0.80, fine)
    * transmission
    * 0.22;

  vec3 neutralLight = vec3(0.215, 0.225, 0.235);
  vec3 warmLight = vec3(0.405, 0.335, 0.250);
  vec3 reddenedLight = vec3(0.295, 0.185, 0.145);
  vec3 blueLight = vec3(0.135, 0.185, 0.285);
  vec3 hiiLight = vec3(0.315, 0.115, 0.145);

  vec3 glowColor = neutralLight;
  glowColor = mix(glowColor, warmLight, clamp(centreWarmth * 0.72, 0.0, 1.0));
  glowColor = mix(glowColor, reddenedLight, clamp(dustReddening * 0.32, 0.0, 0.30));
  glowColor += blueLight * youngBlue * 0.16;
  glowColor += hiiLight * hii * 0.18;

  // Micro-star density is also modulated by extinction. This is the key visual change:
  // the Milky Way becomes bright because there are many stars, not because there is fog.
  float microMask = clamp(
    (visibleStellarDensity * 0.62 + visibleDenseLane * 0.58 + visibleCentre * 0.55),
    0.0,
    1.0
  );

  float microA = microStar(p + vec2(1.3, -2.1), 185.0, 0.980, 0.050);
  float microB = microStar(p + vec2(-3.0, 1.6), 285.0, 0.989, 0.046);
  float microC = microStar(p + vec2(4.6, 3.3), 410.0, 0.995, 0.042);

  float microStars = (
      microA * 0.68
    + microB * 0.48
    + microC * 0.32
  ) * microMask;

  float starTemperature = hash21(floor(p * 173.0) + 9.17);
  vec3 coolStar = vec3(0.58, 0.70, 0.92);
  vec3 warmStar = vec3(0.95, 0.76, 0.54);
  vec3 microColor = mix(coolStar, warmStar, smoothstep(0.36, 0.76, starTemperature));

  // Low-opacity unresolved starlight. The surrounding sky remains true black.
  float emissionAlpha = clamp(
      unresolved * 0.085
    + visibleCentre * 0.045
    + hii * 0.012,
    0.0,
    0.145
  );

  vec3 emission = glowColor * (
      unresolved * 0.72
    + visibleCentre * 0.28
  );

  emission += microColor * microStars * 0.52;
  emissionAlpha = clamp(emissionAlpha + microStars * 0.22, 0.0, 0.18);

  // Extinction pass: black alpha removes the resolved star field beneath this canvas.
  // Keep it localized to the galactic plane so the rest of the screen is untouched.
  float extinctionAlpha = clamp(
    (1.0 - transmission)
    * innerProfile
    * longitudinal
    * 0.30,
    0.0,
    0.26
  );

  float alpha = clamp(emissionAlpha + extinctionAlpha, 0.0, 0.30);
  float extinctionMix = extinctionAlpha / max(alpha, 0.0001);
  vec3 color = mix(emission, vec3(0.0012, 0.0017, 0.0024), extinctionMix);

  // Mild texture contrast only; no global fog or large opaque beige fields.
  color *= 0.92 + filamentDensity * visibleDenseLane * 0.18;

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
