const canvas = document.getElementById('galaxyCanvas');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!canvas) throw new Error('Galaxy canvas is required.');

const gl = canvas.getContext('webgl2', {
  alpha: false,
  antialias: false,
  depth: false,
  stencil: false,
  powerPreference: 'high-performance',
  premultipliedAlpha: false,
});

if (!gl) throw new Error('WebGL2 is required for the spatial galaxy lab.');

const colorBufferFloat = gl.getExtension('EXT_color_buffer_float');
const floatLinear = gl.getExtension('OES_texture_float_linear');
const useHDR = Boolean(colorBufferFloat);

// One camera owns both the resolved star field and the Milky Way volume.
// The camera moves in world space; neither layer receives a hand-authored 2D parallax offset.
const CAMERA = {
  fovY: 54 * Math.PI / 180,
  near: 0.35,
  far: 28,
};

const GALAXY_ROLL = 0.78539816339;
const GALAXY_CENTER = [2.05, 0.0, -8.6];
const rollCos = Math.cos(GALAXY_ROLL);
const rollSin = Math.sin(GALAXY_ROLL);

function galaxyToWorld(x, y, z) {
  return [
    rollCos * x - rollSin * y,
    rollSin * x + rollCos * y,
    z,
  ];
}

function normalize3(v) {
  const length = Math.max(1e-8, Math.hypot(v[0], v[1], v[2]));
  return [v[0] / length, v[1] / length, v[2] / length];
}

function cross3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function compile(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(log || 'Shader compilation failed.');
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
    throw new Error(log || 'Program link failed.');
  }
  return program;
}

const FULLSCREEN_VERTEX = `#version 300 es
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

const VOLUME_FRAGMENT = `#version 300 es
precision highp float;

in vec2 vUv;
uniform vec2 uResolution;
uniform vec3 uCameraPos;
uniform vec3 uCameraRight;
uniform vec3 uCameraUp;
uniform vec3 uCameraForward;
uniform float uTanHalfFov;
uniform float uTime;
out vec4 outColor;

const float ROLL_C = 0.70710678118;
const float ROLL_S = 0.70710678118;
const vec3 GALACTIC_CENTER = vec3(2.05, 0.0, -8.6);
const int VOLUME_STEPS = 36;

float saturate(float v) { return clamp(v, 0.0, 1.0); }

vec3 toGalaxy(vec3 w) {
  return vec3(
    ROLL_C * w.x + ROLL_S * w.y,
    -ROLL_S * w.x + ROLL_C * w.y,
    w.z
  );
}

float fieldNoise(vec3 p) {
  float a = sin(p.x + sin(p.z * 1.17 + p.y * 0.41));
  float b = sin(p.z * 1.31 + sin(p.x * 0.73 - p.y * 1.61));
  float c = sin(dot(p, vec3(0.61, 1.37, 0.93)) + sin(p.z * 0.49));
  return saturate(0.5 + 0.18 * a + 0.18 * b + 0.14 * c);
}

float layeredNoise(vec3 p) {
  return fieldNoise(p) * 0.62
    + fieldNoise(p * 2.07 + vec3(2.3, -1.1, 4.7)) * 0.28
    + fieldNoise(p * 4.31 + vec3(-3.8, 5.2, -0.9)) * 0.10;
}

void galaxyFields(vec3 world, out float stellar, out float dust, out float warmth) {
  vec3 g = toGalaxy(world);
  vec2 planar = vec2(g.x - GALACTIC_CENTER.x, g.z - GALACTIC_CENTER.z);
  float radius = length(planar);
  float theta = atan(planar.y, planar.x);

  float warp = 0.075 * sin(g.z * 0.24 + 0.7)
    + 0.035 * sin(g.x * 0.41 - g.z * 0.13);

  float centreWeight = exp(-radius * radius / 8.5);
  float diskEnvelope = exp(-radius * 0.105)
    * (1.0 - smoothstep(13.2, 16.0, radius));

  float stellarHalfHeight = mix(0.30, 0.72, centreWeight);
  float vertical = exp(-pow((g.y - warp) / stellarHalfHeight, 2.0));

  float armPhase = theta * 4.0 - log(radius + 0.65) * 5.35;
  float arm = pow(0.5 + 0.5 * cos(armPhase), 5.0);
  float arm2 = pow(0.5 + 0.5 * cos(armPhase + 2.08), 8.0) * 0.62;

  float macro = layeredNoise(g * vec3(0.24, 1.15, 0.20) + vec3(1.3, -2.1, 0.4));
  float clouds = layeredNoise(g * vec3(0.56, 2.35, 0.43) + vec3(-3.1, 1.7, 2.8));

  float structuredDisk = diskEnvelope * vertical
    * (0.18 + 0.66 * macro + 0.62 * arm + 0.36 * arm2)
    * (0.54 + 0.72 * smoothstep(0.33, 0.74, clouds));

  float bulge = centreWeight
    * exp(-pow((g.y - warp * 0.35) / 0.95, 2.0))
    * (0.68 + 0.48 * macro);

  // A few coherent star-cloud complexes raise local complexity without becoming
  // screen-space painted blobs. They exist in the disk and therefore parallax.
  float complexA = exp(-dot((g - vec3(0.4, 0.06, -6.5)) / vec3(1.7, 0.55, 1.9),
                            (g - vec3(0.4, 0.06, -6.5)) / vec3(1.7, 0.55, 1.9)));
  float complexB = exp(-dot((g - vec3(3.2, -0.04, -9.5)) / vec3(2.0, 0.70, 2.2),
                            (g - vec3(3.2, -0.04, -9.5)) / vec3(2.0, 0.70, 2.2)));
  float complexC = exp(-dot((g - vec3(-2.8, 0.02, -12.5)) / vec3(2.3, 0.62, 2.5),
                            (g - vec3(-2.8, 0.02, -12.5)) / vec3(2.3, 0.62, 2.5)));

  stellar = clamp(
      structuredDisk * 1.20
    + bulge * 1.55
    + (complexA * 0.70 + complexB * 0.92 + complexC * 0.55)
      * vertical * (0.40 + 0.85 * clouds),
    0.0,
    2.8
  );

  // Dust occupies a physically thinner layer than the stars. Foreground clumps
  // therefore extinguish background emission only when the camera ray crosses them.
  float dustWarp = warp
    + 0.055 * sin(g.x * 0.82 + g.z * 0.31)
    + 0.025 * sin(g.z * 1.11 - g.x * 0.37);
  float dustVertical = exp(-pow((g.y - dustWarp) / 0.175, 2.0));
  float dustMacro = layeredNoise(g * vec3(0.34, 3.6, 0.27) + vec3(4.7, -2.2, 1.3));
  float dustFine = fieldNoise(g * vec3(1.18, 7.4, 0.93) + vec3(-5.2, 3.6, 8.1));
  float filament = pow(smoothstep(0.48, 0.80, dustMacro * 0.72 + dustFine * 0.28), 1.35);
  float armDust = 0.38 + 0.72 * max(arm, arm2);
  dust = clamp(
    diskEnvelope * dustVertical * filament * armDust * (0.60 + 0.78 * clouds),
    0.0,
    2.5
  );

  warmth = saturate(centreWeight * 1.18 + complexB * 0.22);
}

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 ndc = vUv * 2.0 - 1.0;

  vec3 ray = normalize(
      uCameraForward
    + uCameraRight * ndc.x * uTanHalfFov * aspect
    + uCameraUp * ndc.y * uTanHalfFov
  );

  float nearT = 0.55;
  float farT = 24.0;
  float stepLength = (farT - nearT) / float(VOLUME_STEPS);
  float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  float t = nearT + jitter * stepLength;

  vec3 radiance = vec3(0.0);
  float transmission = 1.0;

  for (int i = 0; i < VOLUME_STEPS; i++) {
    vec3 world = uCameraPos + ray * t;
    float stellar;
    float dust;
    float warmth;
    galaxyFields(world, stellar, dust, warmth);

    vec3 neutral = vec3(0.325, 0.335, 0.355);
    vec3 warm = vec3(0.585, 0.440, 0.285);
    vec3 localColor = mix(neutral, warm, warmth * 0.82);

    float emission = stellar * stepLength * 0.105;
    radiance += transmission * localColor * emission;

    // Beer-Lambert extinction. This is ordered along the actual camera ray,
    // so near dust blocks far stars and the relationship changes with viewpoint.
    transmission *= exp(-dust * stepLength * 1.42);
    if (transmission < 0.012) break;

    t += stepLength;
  }

  // A tiny blue bias keeps the outer stellar disk cool without colouring the dust.
  radiance += vec3(0.002, 0.003, 0.006) * (1.0 - transmission);
  outColor = vec4(radiance, 1.0);
}
`;

const COMPOSITE_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uVolume;
uniform float uExposure;
out vec4 outColor;

vec3 aces(vec3 x) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
  vec3 volume = texture(uVolume, vUv).rgb;
  vec3 background = vec3(0.0014, 0.0025, 0.0048);
  vec3 mapped = aces(background + volume * uExposure);
  mapped = pow(mapped, vec3(1.0 / 2.2));
  outColor = vec4(mapped, 1.0);
}
`;

const STAR_VERTEX = `#version 300 es
precision highp float;

in vec3 aPosition;
in vec3 aColor;
in float aSize;
in float aAlpha;
in float aPhase;
in float aRate;
in float aKind;

uniform vec3 uCameraPos;
uniform vec3 uCameraRight;
uniform vec3 uCameraUp;
uniform vec3 uCameraForward;
uniform float uAspect;
uniform float uTanHalfFov;
uniform float uDpr;
uniform float uTime;
uniform float uExposure;

out vec3 vColor;
out float vOpacity;
out float vBrightness;
out float vRayStrength;
out float vParticleDiameter;
flat out float vKind;

const float ROLL_C = 0.70710678118;
const float ROLL_S = 0.70710678118;
const vec3 GALACTIC_CENTER = vec3(2.05, 0.0, -8.6);

vec3 toGalaxy(vec3 w) {
  return vec3(
    ROLL_C * w.x + ROLL_S * w.y,
    -ROLL_S * w.x + ROLL_C * w.y,
    w.z
  );
}

float dustFast(vec3 world) {
  vec3 g = toGalaxy(world);
  vec2 planar = vec2(g.x - GALACTIC_CENTER.x, g.z - GALACTIC_CENTER.z);
  float radius = length(planar);
  float theta = atan(planar.y, planar.x);
  float diskEnvelope = exp(-radius * 0.105) * (1.0 - smoothstep(13.2, 16.0, radius));
  float warp = 0.075 * sin(g.z * 0.24 + 0.7)
    + 0.035 * sin(g.x * 0.41 - g.z * 0.13)
    + 0.040 * sin(g.x * 0.82 + g.z * 0.31);
  float vertical = exp(-pow((g.y - warp) / 0.18, 2.0));
  float armPhase = theta * 4.0 - log(radius + 0.65) * 5.35;
  float arm = pow(0.5 + 0.5 * cos(armPhase), 5.0);
  float filament = pow(0.5 + 0.5 * sin(g.x * 1.23 + sin(g.z * 0.77) * 2.1), 5.0);
  return diskEnvelope * vertical * (0.24 + 0.78 * arm) * (0.18 + 0.92 * filament);
}

float starTransmission(vec3 starPosition, float distanceToStar) {
  float tau = 0.0;
  for (int i = 0; i < 6; i++) {
    float f = (float(i) + 0.5) / 6.0;
    vec3 samplePosition = mix(uCameraPos, starPosition, f);
    tau += dustFast(samplePosition);
  }
  tau *= min(distanceToStar, 24.0) / 6.0 * 0.42;
  return exp(-tau);
}

void main() {
  vec3 rel = aPosition - uCameraPos;
  float viewX = dot(rel, uCameraRight);
  float viewY = dot(rel, uCameraUp);
  float viewZ = dot(rel, uCameraForward);

  if (viewZ <= 0.35) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 1.0;
    vColor = vec3(0.0);
    vOpacity = 0.0;
    vBrightness = 0.0;
    vRayStrength = 0.0;
    vParticleDiameter = 1.0;
    vKind = aKind;
    return;
  }

  // Real perspective projection: clip.w is the camera-space depth. Moving the
  // shared camera therefore changes every star by geometry, not by a 2D offset.
  gl_Position = vec4(
    viewX / (uTanHalfFov * uAspect),
    viewY / uTanHalfFov,
    0.0,
    viewZ
  );

  float distanceToStar = length(rel);
  float background = 1.0 - step(0.5, aKind);
  float stream = step(0.5, aKind) * (1.0 - step(1.5, aKind));
  float bright = step(1.5, aKind) * (1.0 - step(2.5, aKind));
  float hero = step(2.5, aKind);

  float projectedDiameter = aSize * uDpr * (8.8 / viewZ);
  projectedDiameter *= 1.0 + bright * 0.16 + hero * 0.30;
  vParticleDiameter = clamp(projectedDiameter, 0.16, 15.0);
  gl_PointSize = max(vParticleDiameter, 4.0 + bright * 5.0 + hero * 13.0);

  float pulse = sin(aPhase + uTime * aRate);
  float twinkle = 0.94 + pulse * 0.06;
  twinkle = mix(twinkle, 0.88 + pulse * 0.11, stream);
  twinkle = mix(twinkle, 0.84 + pulse * 0.14, bright);
  twinkle = mix(twinkle, 0.80 + pulse * 0.18, hero);

  float brightness = (0.55 + aSize * 0.11) * background;
  brightness += (0.88 + aSize * 0.20) * stream;
  brightness += (2.80 + aSize * 0.24) * bright;
  brightness += (5.20 + aSize * 0.20) * hero;

  float revealSeed = fract(aPhase * 0.173 + aPosition.x * 0.071 + aPosition.z * 0.113);
  float reveal = smoothstep(0.0, 1.0, clamp(uExposure * 1.18 - revealSeed * 0.32, 0.0, 1.0));
  float transmission = starTransmission(aPosition, distanceToStar);

  vColor = aColor;
  vOpacity = min(1.0, aAlpha * reveal * transmission * (0.92 + twinkle * 0.08));
  vBrightness = brightness * twinkle;
  vRayStrength = smoothstep(2.6, 5.0, brightness);
  vKind = aKind;
}
`;

const STAR_FRAGMENT = `#version 300 es
precision highp float;

in vec3 vColor;
in float vOpacity;
in float vBrightness;
in float vRayStrength;
in float vParticleDiameter;
flat in float vKind;
out vec4 outColor;

float cubicCoverage(float coordinate) {
  float x = abs(coordinate);
  if (x < 1.0) return (4.0 - 6.0 * x * x + 3.0 * x * x * x) / 6.0;
  float tail = max(2.0 - x, 0.0);
  return tail * tail * tail / 6.0;
}

float filteredCore(vec2 pixel, float area) {
  return cubicCoverage(pixel.x) * cubicCoverage(pixel.y)
    * area * vParticleDiameter * vParticleDiameter;
}

float gauss(float r2, float sharpness) {
  return exp(-r2 * sharpness);
}

void main() {
  float bright = step(1.5, vKind) * (1.0 - step(2.5, vKind));
  float hero = step(2.5, vKind);
  float major = clamp(bright + hero, 0.0, 1.0);

  if (major < 0.5) {
    vec2 pixel = (gl_PointCoord - vec2(0.5)) * max(vParticleDiameter, 4.0);
    vec2 p = pixel * 2.0 / max(vParticleDiameter, 0.0001);
    float r = length(p);
    float resolved = smoothstep(2.0, 4.0, vParticleDiameter);
    float disc = pow(1.0 - smoothstep(0.04, 0.84, r), 3.0);
    float alpha = mix(filteredCore(pixel, 0.150904), disc, resolved) * vOpacity;
    if (alpha <= 0.0) discard;

    float whiteCore = gauss(r * r, 34.0) * smoothstep(0.95, 2.45, vBrightness);
    vec3 emission = mix(vColor, vec3(1.0), whiteCore * 0.68) * vBrightness;
    outColor = vec4(emission, alpha);
    return;
  }

  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(q, q);
  float r = sqrt(r2);
  if (r > 1.0) discard;

  float needle = gauss(r2, 760.0);
  float photosphere = gauss(r2, 185.0);
  float corona = gauss(r2, 56.0);
  float airyRing = exp(-pow((r - 0.205) * 26.0, 2.0)) * 0.10;
  float aura = gauss(r2, 15.0) * (1.0 - smoothstep(0.40, 0.92, r)) * 0.022;

  float horizontal = exp(-abs(q.y) * 120.0)
    * exp(-abs(q.x) * 2.75)
    * (1.0 - smoothstep(0.18, 0.98, abs(q.x)));
  float vertical = exp(-abs(q.x) * 120.0)
    * exp(-abs(q.y) * 2.75)
    * (1.0 - smoothstep(0.18, 0.98, abs(q.y)));
  float mainCross = max(horizontal, vertical);

  vec2 diag = vec2(q.x + q.y, q.y - q.x) * 0.70710678;
  float diagonal = max(
    exp(-abs(diag.y) * 145.0) * exp(-abs(diag.x) * 4.3),
    exp(-abs(diag.x) * 145.0) * exp(-abs(diag.y) * 4.3)
  );

  float spikes = mainCross * (0.055 * bright + 0.24 * hero) * vRayStrength
    + diagonal * 0.045 * hero * vRayStrength;

  float tintBand = smoothstep(0.055, 0.14, r)
    * (1.0 - smoothstep(0.28, 0.48, r));
  vec3 bodyColor = mix(vec3(1.0), vColor, tintBand * 0.92);
  vec3 spikeColor = mix(vec3(1.0), vColor, 0.14);

  vec3 emission = bodyColor * (
      needle * 2.05
    + photosphere * 1.18
    + corona * 0.42
    + airyRing * 0.22
    + aura
  ) + spikeColor * spikes * 0.96;

  float alpha = vOpacity * clamp(
      needle * 1.45
    + photosphere
    + corona * 0.30
    + airyRing
    + aura
    + spikes,
    0.0,
    1.0
  );

  if (alpha <= 0.0004) discard;
  outColor = vec4(emission * vBrightness, alpha);
}
`;

const volumeProgram = link(FULLSCREEN_VERTEX, VOLUME_FRAGMENT);
const compositeProgram = link(FULLSCREEN_VERTEX, COMPOSITE_FRAGMENT);
const starProgram = link(STAR_VERTEX, STAR_FRAGMENT);
const emptyVao = gl.createVertexArray();

const volumeUniforms = {
  resolution: gl.getUniformLocation(volumeProgram, 'uResolution'),
  cameraPos: gl.getUniformLocation(volumeProgram, 'uCameraPos'),
  cameraRight: gl.getUniformLocation(volumeProgram, 'uCameraRight'),
  cameraUp: gl.getUniformLocation(volumeProgram, 'uCameraUp'),
  cameraForward: gl.getUniformLocation(volumeProgram, 'uCameraForward'),
  tanHalfFov: gl.getUniformLocation(volumeProgram, 'uTanHalfFov'),
  time: gl.getUniformLocation(volumeProgram, 'uTime'),
};

const compositeUniforms = {
  volume: gl.getUniformLocation(compositeProgram, 'uVolume'),
  exposure: gl.getUniformLocation(compositeProgram, 'uExposure'),
};

const starUniforms = {
  cameraPos: gl.getUniformLocation(starProgram, 'uCameraPos'),
  cameraRight: gl.getUniformLocation(starProgram, 'uCameraRight'),
  cameraUp: gl.getUniformLocation(starProgram, 'uCameraUp'),
  cameraForward: gl.getUniformLocation(starProgram, 'uCameraForward'),
  aspect: gl.getUniformLocation(starProgram, 'uAspect'),
  tanHalfFov: gl.getUniformLocation(starProgram, 'uTanHalfFov'),
  dpr: gl.getUniformLocation(starProgram, 'uDpr'),
  time: gl.getUniformLocation(starProgram, 'uTime'),
  exposure: gl.getUniformLocation(starProgram, 'uExposure'),
};

const STRIDE = 11;
const FLOAT_BYTES = 4;

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value |= 0;
    value = (value + 0x6D2B79F5) | 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(0x6A17C93D);

function gaussian() {
  const u = Math.max(random(), 1e-7);
  const v = Math.max(random(), 1e-7);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
}

const PALETTE = [
  { limit: 0.15, color: [0.427, 0.796, 0.957] },
  { limit: 0.33, color: [0.478, 0.694, 0.996] },
  { limit: 0.40, color: [0.973, 0.475, 0.082] },
  { limit: 0.48, color: [0.980, 0.600, 0.298] },
  { limit: 1.00, color: [0.961, 0.965, 0.984] },
];

function pickColor(scale = 1) {
  const value = random();
  const entry = PALETTE.find(item => value <= item.limit) || PALETTE[PALETTE.length - 1];
  const temperatureNoise = 0.965 + random() * 0.07;
  return entry.color.map(channel => Math.min(1.15, channel * temperatureNoise * scale));
}

const stars = [];

function pushStar(x, y, z, color, size, alpha, phase, rate, kind) {
  stars.push(
    x, y, z,
    color[0], color[1], color[2],
    size, alpha, phase, rate, kind,
  );
}

function addBackground(count) {
  for (let i = 0; i < count; i++) {
    const depth = 3.0 + Math.pow(random(), 0.72) * 25.0;
    const halfHeight = Math.tan(CAMERA.fovY * 0.5) * depth * 1.28;
    const halfWidth = halfHeight * 2.15;
    const x = (random() * 2 - 1) * halfWidth;
    const y = (random() * 2 - 1) * halfHeight;
    const z = -depth;
    const rare = random();
    const size = rare > 0.988 ? 2.2 + random() * 2.4 : 0.75 + random() * 1.05;
    const alpha = rare > 0.988 ? 0.34 + random() * 0.34 : 0.055 + random() * 0.16;
    pushStar(x, y, z, pickColor(0.90), size, alpha, random() * 47, 0.35 + random() * 0.95, 0);
  }
}

function armWeight(x, z) {
  const dx = x - GALAXY_CENTER[0];
  const dz = z - GALAXY_CENTER[2];
  const radius = Math.max(0.1, Math.hypot(dx, dz));
  const theta = Math.atan2(dz, dx);
  const phase = theta * 4 - Math.log(radius + 0.65) * 5.35;
  const arm = Math.pow(0.5 + 0.5 * Math.cos(phase), 5);
  const arm2 = Math.pow(0.5 + 0.5 * Math.cos(phase + 2.08), 8) * 0.62;
  return Math.min(1, 0.16 + arm * 0.78 + arm2 * 0.46);
}

function sampleGalaxyPoint() {
  for (let guard = 0; guard < 120; guard++) {
    const radius = 0.35 + Math.pow(random(), 0.74) * 13.2;
    const theta = random() * Math.PI * 2;
    const x = GALAXY_CENTER[0] + Math.cos(theta) * radius;
    const z = GALAXY_CENTER[2] + Math.sin(theta) * radius;
    if (z > -1.1 || z < -25.5) continue;

    const density = Math.exp(-radius * 0.075);
    const arms = armWeight(x, z);
    if (random() > Math.min(0.96, density * (0.34 + arms * 0.92))) continue;

    const centre = Math.exp(-(radius * radius) / 8.5);
    const halfHeight = 0.14 + radius * 0.012 + centre * 0.32;
    const warp = 0.075 * Math.sin(z * 0.24 + 0.7) + 0.035 * Math.sin(x * 0.41 - z * 0.13);
    const y = warp + gaussian() * halfHeight;
    return { x, y, z, centre, radius, arms };
  }

  return { x: 0, y: 0, z: -8, centre: 0, radius: 8, arms: 0.3 };
}

function addGalaxyStars(count) {
  for (let i = 0; i < count; i++) {
    const p = sampleGalaxyPoint();
    const w = galaxyToWorld(p.x, p.y, p.z);
    const size = 0.72 + random() * (1.15 + p.centre * 0.45 + p.arms * 0.24);
    const alpha = (0.10 + random() * 0.34) * (0.78 + p.centre * 0.30 + p.arms * 0.16);
    pushStar(w[0], w[1], w[2], pickColor(0.98), size, alpha, random() * 61, 0.45 + random() * 1.2, 1);
  }
}

function addBrightStars(count) {
  for (let i = 0; i < count; i++) {
    const p = sampleGalaxyPoint();
    const w = galaxyToWorld(p.x, p.y, p.z);
    pushStar(
      w[0], w[1], w[2],
      pickColor(1.10),
      3.6 + Math.pow(random(), 1.5) * 4.4,
      0.74 + random() * 0.24,
      random() * 97,
      0.40 + random() * 0.90,
      2,
    );
  }
}

function addHeroStars(count) {
  for (let i = 0; i < count; i++) {
    const p = sampleGalaxyPoint();
    p.y += (random() - 0.5) * 0.18;
    const w = galaxyToWorld(p.x, p.y, p.z);
    pushStar(
      w[0], w[1], w[2],
      i % 4 === 1 ? [0.48, 0.74, 1.0] : i % 5 === 2 ? [1.0, 0.70, 0.38] : [0.98, 0.99, 1.0],
      6.6 + random() * 4.8,
      0.94,
      11 + i * 7.31,
      0.34 + (i % 5) * 0.09,
      3,
    );
  }
}

addBackground(6200);
addGalaxyStars(8200);
addBrightStars(92);
addHeroStars(16);

const starData = new Float32Array(stars);
const starCount = starData.length / STRIDE;
const starBuffer = gl.createBuffer();
const starVao = gl.createVertexArray();

gl.bindVertexArray(starVao);
gl.bindBuffer(gl.ARRAY_BUFFER, starBuffer);
gl.bufferData(gl.ARRAY_BUFFER, starData, gl.STATIC_DRAW);

function bindAttribute(name, size, offsetFloats) {
  const location = gl.getAttribLocation(starProgram, name);
  if (location < 0) return;
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, size, gl.FLOAT, false, STRIDE * FLOAT_BYTES, offsetFloats * FLOAT_BYTES);
}

bindAttribute('aPosition', 3, 0);
bindAttribute('aColor', 3, 3);
bindAttribute('aSize', 1, 6);
bindAttribute('aAlpha', 1, 7);
bindAttribute('aPhase', 1, 8);
bindAttribute('aRate', 1, 9);
bindAttribute('aKind', 1, 10);
gl.bindVertexArray(null);

function createVolumeTarget(width, height) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  const internalFormat = useHDR ? gl.RGBA16F : gl.RGBA8;
  const type = useHDR ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, gl.RGBA, type, null);

  const filter = useHDR && !floatLinear ? gl.NEAREST : gl.LINEAR;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error('Milky Way volume framebuffer incomplete.');
  }

  return { texture, framebuffer, width, height };
}

function destroyTarget(target) {
  if (!target) return;
  gl.deleteTexture(target.texture);
  gl.deleteFramebuffer(target.framebuffer);
}

const cameraBase = galaxyToWorld(0, 0.12, 0);
const state = {
  dpr: 1,
  width: 1,
  height: 1,
  aspect: 1,
  volumeScale: 0.5,
  volumeTarget: null,
  pointerTarget: [0, 0],
  pointerIntent: [0, 0],
  pointer: [0, 0],
  cameraPos: cameraBase.slice(),
  cameraRight: [1, 0, 0],
  cameraUp: [0, 1, 0],
  cameraForward: [0, 0, -1],
  startTime: performance.now(),
  lastFrame: 0,
};

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
  const width = Math.max(1, Math.round(window.innerWidth * dpr));
  const height = Math.max(1, Math.round(window.innerHeight * dpr));
  const aspect = window.innerWidth / Math.max(window.innerHeight, 1);
  const volumeScale = width * height > 2400000 ? 0.42 : 0.50;
  const volumeWidth = Math.max(1, Math.round(width * volumeScale));
  const volumeHeight = Math.max(1, Math.round(height * volumeScale));

  const changed = width !== state.width
    || height !== state.height
    || dpr !== state.dpr
    || volumeScale !== state.volumeScale;

  state.dpr = dpr;
  state.width = width;
  state.height = height;
  state.aspect = aspect;
  state.volumeScale = volumeScale;

  if (!changed) return;

  canvas.width = width;
  canvas.height = height;
  destroyTarget(state.volumeTarget);
  state.volumeTarget = createVolumeTarget(volumeWidth, volumeHeight);
}

function shapePointerAxis(value) {
  const deadZone = 0.055;
  const magnitude = Math.abs(value);
  if (magnitude <= deadZone) return 0;
  const normalized = Math.min(1, (magnitude - deadZone) / (1 - deadZone));
  const eased = normalized * normalized * (3 - 2 * normalized);
  return Math.sign(value) * eased;
}

function onPointerMove(event) {
  if (reducedMotion) return;
  const rawX = event.clientX / Math.max(window.innerWidth, 1) * 2 - 1;
  const rawY = -(event.clientY / Math.max(window.innerHeight, 1) * 2 - 1);
  state.pointerTarget[0] = shapePointerAxis(rawX);
  state.pointerTarget[1] = shapePointerAxis(rawY);
}

function resetPointer() {
  state.pointerTarget[0] = 0;
  state.pointerTarget[1] = 0;
}

function damp(current, target, speed, dt) {
  return current + (target - current) * (1 - Math.exp(-speed * dt));
}

function updateCamera(dt) {
  if (reducedMotion) {
    state.pointerIntent[0] = 0;
    state.pointerIntent[1] = 0;
    state.pointer[0] = 0;
    state.pointer[1] = 0;
  } else {
    state.pointerIntent[0] = damp(state.pointerIntent[0], state.pointerTarget[0], 6.5, dt);
    state.pointerIntent[1] = damp(state.pointerIntent[1], state.pointerTarget[1], 6.5, dt);
    state.pointer[0] = damp(state.pointer[0], state.pointerIntent[0], 2.8, dt);
    state.pointer[1] = damp(state.pointer[1], state.pointerIntent[1], 2.8, dt);
  }

  const yaw = state.pointer[0] * 0.052;
  const pitch = state.pointer[1] * 0.038;
  const cosPitch = Math.cos(pitch);
  const forward = normalize3([
    Math.sin(yaw) * cosPitch,
    Math.sin(pitch),
    -Math.cos(yaw) * cosPitch,
  ]);
  const right = normalize3(cross3(forward, [0, 1, 0]));
  const up = normalize3(cross3(right, forward));

  state.cameraForward = forward;
  state.cameraRight = right;
  state.cameraUp = up;

  const slideX = state.pointer[0] * 0.22;
  const slideY = state.pointer[1] * 0.13;
  state.cameraPos[0] = cameraBase[0] + right[0] * slideX + up[0] * slideY;
  state.cameraPos[1] = cameraBase[1] + right[1] * slideX + up[1] * slideY;
  state.cameraPos[2] = cameraBase[2] + right[2] * slideX + up[2] * slideY;
}

function bindCameraUniforms(uniforms) {
  gl.uniform3fv(uniforms.cameraPos, state.cameraPos);
  gl.uniform3fv(uniforms.cameraRight, state.cameraRight);
  gl.uniform3fv(uniforms.cameraUp, state.cameraUp);
  gl.uniform3fv(uniforms.cameraForward, state.cameraForward);
}

function renderVolume(seconds) {
  const target = state.volumeTarget;
  gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
  gl.viewport(0, 0, target.width, target.height);
  gl.disable(gl.BLEND);
  gl.useProgram(volumeProgram);
  gl.bindVertexArray(emptyVao);

  gl.uniform2f(volumeUniforms.resolution, target.width, target.height);
  bindCameraUniforms(volumeUniforms);
  gl.uniform1f(volumeUniforms.tanHalfFov, Math.tan(CAMERA.fovY * 0.5));
  gl.uniform1f(volumeUniforms.time, reducedMotion ? 0 : seconds);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function compositeVolume() {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, state.width, state.height);
  gl.disable(gl.BLEND);
  gl.useProgram(compositeProgram);
  gl.bindVertexArray(emptyVao);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, state.volumeTarget.texture);
  gl.uniform1i(compositeUniforms.volume, 0);
  gl.uniform1f(compositeUniforms.exposure, 2.35);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function renderStars(seconds, exposure) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, state.width, state.height);
  gl.enable(gl.BLEND);
  gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);
  gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.useProgram(starProgram);
  gl.bindVertexArray(starVao);

  bindCameraUniforms(starUniforms);
  gl.uniform1f(starUniforms.aspect, state.aspect);
  gl.uniform1f(starUniforms.tanHalfFov, Math.tan(CAMERA.fovY * 0.5));
  gl.uniform1f(starUniforms.dpr, state.dpr);
  gl.uniform1f(starUniforms.time, reducedMotion ? 0 : seconds);
  gl.uniform1f(starUniforms.exposure, exposure);

  gl.drawArrays(gl.POINTS, 0, starCount);
  gl.bindVertexArray(null);
  gl.disable(gl.BLEND);
}

function easeInOut(value) {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
}

window.addEventListener('resize', resize, { passive: true });
window.addEventListener('pointermove', onPointerMove, { passive: true });
window.addEventListener('pointerleave', resetPointer, { passive: true });
window.addEventListener('blur', resetPointer, { passive: true });
canvas.addEventListener('webglcontextlost', event => event.preventDefault());

resize();
updateCamera(0.016);

function render(now) {
  resize();

  const seconds = (now - state.startTime) / 1000;
  const dt = Math.min(0.05, Math.max(0.001, state.lastFrame ? (now - state.lastFrame) / 1000 : 0.016));
  state.lastFrame = now;

  updateCamera(dt);
  const exposure = reducedMotion ? 1 : easeInOut((seconds - 0.08) / 2.1);

  renderVolume(seconds);
  compositeVolume();
  renderStars(seconds, exposure);

  requestAnimationFrame(render);
}

requestAnimationFrame(render);
