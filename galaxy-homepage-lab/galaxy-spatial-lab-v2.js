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

const useHDR = Boolean(gl.getExtension('EXT_color_buffer_float'));
const floatLinear = gl.getExtension('OES_texture_float_linear');

const CAMERA = {
  fovY: 54 * Math.PI / 180,
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
  const vertex = compile(gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
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
out vec4 outColor;

const float ROLL_C = 0.70710678118;
const float ROLL_S = 0.70710678118;
const vec3 GALACTIC_CENTER = vec3(2.05, 0.0, -8.6);
const int VOLUME_STEPS = 42;

float saturate(float v) { return clamp(v, 0.0, 1.0); }

vec3 toGalaxy(vec3 w) {
  return vec3(
    ROLL_C * w.x + ROLL_S * w.y,
    -ROLL_S * w.x + ROLL_C * w.y,
    w.z
  );
}

float hash31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float valueNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash31(i + vec3(0,0,0));
  float n100 = hash31(i + vec3(1,0,0));
  float n010 = hash31(i + vec3(0,1,0));
  float n110 = hash31(i + vec3(1,1,0));
  float n001 = hash31(i + vec3(0,0,1));
  float n101 = hash31(i + vec3(1,0,1));
  float n011 = hash31(i + vec3(0,1,1));
  float n111 = hash31(i + vec3(1,1,1));
  float nx00 = mix(n000, n100, f.x);
  float nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x);
  float nx11 = mix(n011, n111, f.x);
  return mix(mix(nx00, nx10, f.y), mix(nx01, nx11, f.y), f.z);
}

float fbm(vec3 p) {
  float sum = 0.0;
  float amp = 0.55;
  for (int i = 0; i < 4; i++) {
    sum += valueNoise(p) * amp;
    p = p * 2.03 + vec3(1.7, -2.4, 0.9);
    amp *= 0.48;
  }
  return sum;
}

void galaxyFields(vec3 world, out float stellar, out float dust, out float warmth) {
  vec3 g = toGalaxy(world);
  vec2 planar = vec2(g.x - GALACTIC_CENTER.x, g.z - GALACTIC_CENTER.z);
  float radius = length(planar);
  float theta = atan(planar.y, planar.x);

  float edge = 1.0 - smoothstep(12.8, 15.8, radius);
  float radial = exp(-radius * 0.11) * edge;
  float centre = exp(-radius * radius / 7.2);

  float warp = 0.065 * sin(g.z * 0.25 + 0.65)
    + 0.028 * sin(g.x * 0.43 - g.z * 0.15);

  float stellarHeight = mix(0.20, 0.46, centre);
  float stellarVertical = exp(-pow((g.y - warp) / stellarHeight, 2.0));

  float armPhase = theta * 4.0 - log(radius + 0.72) * 5.15;
  float armA = pow(0.5 + 0.5 * cos(armPhase), 5.5);
  float armB = pow(0.5 + 0.5 * cos(armPhase + 2.16), 7.0) * 0.58;
  float arms = clamp(armA + armB, 0.0, 1.35);

  float macro = fbm(g * vec3(0.22, 1.15, 0.20) + vec3(1.1, -2.0, 0.7));
  float clumps = fbm(g * vec3(0.50, 2.25, 0.43) + vec3(-3.2, 1.5, 2.4));
  float filaments = fbm(g * vec3(1.15, 4.2, 0.95) + vec3(5.0, -1.8, -3.1));

  float cloudGate = smoothstep(0.30, 0.74, macro * 0.60 + clumps * 0.40);
  float mottling = 0.35 + 0.65 * smoothstep(0.28, 0.72, clumps);
  float thread = 0.72 + 0.28 * smoothstep(0.38, 0.78, filaments);

  float disk = radial * stellarVertical
    * (0.10 + 0.46 * cloudGate + 0.54 * arms)
    * mottling * thread;

  float bulge = centre
    * exp(-pow((g.y - warp * 0.25) / 0.58, 2.0))
    * (0.42 + 0.38 * macro);

  float complexA = exp(-dot((g - vec3(0.5, 0.04, -6.8)) / vec3(1.6, 0.36, 1.7),
                            (g - vec3(0.5, 0.04, -6.8)) / vec3(1.6, 0.36, 1.7)));
  float complexB = exp(-dot((g - vec3(3.0, -0.03, -9.7)) / vec3(1.8, 0.42, 2.0),
                            (g - vec3(3.0, -0.03, -9.7)) / vec3(1.8, 0.42, 2.0)));
  float complexC = exp(-dot((g - vec3(-2.7, 0.04, -12.4)) / vec3(2.0, 0.40, 2.2),
                            (g - vec3(-2.7, 0.04, -12.4)) / vec3(2.0, 0.40, 2.2)));

  stellar = clamp(
      disk * 0.82
    + bulge * 0.62
    + (complexA * 0.38 + complexB * 0.50 + complexC * 0.30)
      * stellarVertical * (0.42 + 0.58 * clumps),
    0.0,
    1.55
  );

  float dustWarp = warp
    + 0.050 * sin(g.x * 0.80 + g.z * 0.33)
    + 0.022 * sin(g.z * 1.12 - g.x * 0.39);
  float dustVertical = exp(-pow((g.y - dustWarp) / 0.205, 2.0));
  float dustMacro = fbm(g * vec3(0.34, 3.4, 0.28) + vec3(4.4, -2.0, 1.5));
  float dustFine = fbm(g * vec3(0.92, 6.4, 0.78) + vec3(-4.8, 3.1, 7.2));
  float dustRidge = smoothstep(0.44, 0.73, dustMacro * 0.68 + dustFine * 0.32);
  float dustKnots = smoothstep(0.58, 0.82, dustFine);
  float armDust = 0.55 + 0.72 * min(1.0, arms);

  dust = clamp(
    radial * dustVertical * armDust
      * (0.10 + dustRidge * 1.05 + dustKnots * 0.55)
      * (0.66 + 0.44 * clumps),
    0.0,
    2.35
  );

  warmth = saturate(centre * 0.92 + complexB * 0.16);
}

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 ndc = vUv * 2.0 - 1.0;
  vec3 ray = normalize(
      uCameraForward
    + uCameraRight * ndc.x * uTanHalfFov * aspect
    + uCameraUp * ndc.y * uTanHalfFov
  );

  float nearT = 0.65;
  float farT = 23.5;
  float stepLength = (farT - nearT) / float(VOLUME_STEPS);
  float jitter = hash31(vec3(gl_FragCoord.xy, 17.0));
  float t = nearT + jitter * stepLength;

  vec3 radiance = vec3(0.0);
  float transmission = 1.0;

  for (int i = 0; i < VOLUME_STEPS; i++) {
    vec3 world = uCameraPos + ray * t;
    float stellar;
    float dust;
    float warmth;
    galaxyFields(world, stellar, dust, warmth);

    float sampleExtinction = exp(-dust * stepLength * 2.35);
    vec3 neutral = vec3(0.255, 0.270, 0.295);
    vec3 warm = vec3(0.460, 0.355, 0.245);
    vec3 localColor = mix(neutral, warm, warmth * 0.72);

    float emissiveDensity = pow(max(stellar, 0.0), 1.18);
    float emission = emissiveDensity * stepLength * 0.026;
    radiance += transmission * mix(1.0, sampleExtinction, 0.62)
      * localColor * emission;

    transmission *= sampleExtinction;
    if (transmission < 0.008) break;
    t += stepLength;
  }

  radiance += vec3(0.0012, 0.0018, 0.0032) * (1.0 - transmission);
  outColor = vec4(radiance, 1.0);
}
`;

const COMPOSITE_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uVolume;
out vec4 outColor;

vec3 filmic(vec3 x) {
  x = max(x, vec3(0.0));
  vec3 mapped = x / (1.0 + x * 1.35);
  return pow(mapped, vec3(1.0 / 2.2));
}

void main() {
  vec3 volume = texture(uVolume, vUv).rgb;
  vec3 background = vec3(0.0012, 0.0021, 0.0042);
  vec3 mapped = filmic(background + volume * 0.92);
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
uniform float uReveal;

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

float fastDust(vec3 world) {
  vec3 g = toGalaxy(world);
  vec2 planar = vec2(g.x - GALACTIC_CENTER.x, g.z - GALACTIC_CENTER.z);
  float radius = length(planar);
  float theta = atan(planar.y, planar.x);
  float radial = exp(-radius * 0.11) * (1.0 - smoothstep(12.8, 15.8, radius));
  float warp = 0.065 * sin(g.z * 0.25 + 0.65)
    + 0.028 * sin(g.x * 0.43 - g.z * 0.15)
    + 0.044 * sin(g.x * 0.80 + g.z * 0.33);
  float vertical = exp(-pow((g.y - warp) / 0.21, 2.0));
  float phase = theta * 4.0 - log(radius + 0.72) * 5.15;
  float arms = pow(0.5 + 0.5 * cos(phase), 5.5);
  float filament = pow(0.5 + 0.5 * sin(g.x * 1.20 + sin(g.z * 0.73) * 2.0), 4.0);
  return radial * vertical * (0.10 + 0.62 * arms + 0.58 * filament);
}

float starTransmission(vec3 starPosition, float distanceToStar) {
  float tau = 0.0;
  for (int i = 0; i < 6; i++) {
    float f = (float(i) + 0.5) / 6.0;
    tau += fastDust(mix(uCameraPos, starPosition, f));
  }
  tau *= min(distanceToStar, 23.5) / 6.0 * 0.68;
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

  gl_Position = vec4(
    viewX / (uTanHalfFov * uAspect),
    viewY / uTanHalfFov,
    0.0,
    viewZ
  );

  float background = 1.0 - step(0.5, aKind);
  float stream = step(0.5, aKind) * (1.0 - step(1.5, aKind));
  float bright = step(1.5, aKind) * (1.0 - step(2.5, aKind));
  float hero = step(2.5, aKind);

  float projectedDiameter = aSize * uDpr * (8.4 / viewZ);
  projectedDiameter *= 1.0 + bright * 0.15 + hero * 0.28;
  vParticleDiameter = clamp(projectedDiameter, 0.14, 14.0);
  gl_PointSize = max(vParticleDiameter, 4.0 + bright * 5.0 + hero * 12.0);

  float pulse = sin(aPhase + uTime * aRate);
  float twinkle = 0.95 + pulse * 0.05;
  twinkle = mix(twinkle, 0.90 + pulse * 0.09, stream);
  twinkle = mix(twinkle, 0.86 + pulse * 0.12, bright);
  twinkle = mix(twinkle, 0.82 + pulse * 0.15, hero);

  float brightness = (0.48 + aSize * 0.10) * background;
  brightness += (0.78 + aSize * 0.17) * stream;
  brightness += (2.55 + aSize * 0.21) * bright;
  brightness += (4.65 + aSize * 0.19) * hero;

  float distanceToStar = length(rel);
  float transmission = starTransmission(aPosition, distanceToStar);
  float seed = fract(aPhase * 0.173 + aPosition.x * 0.071 + aPosition.z * 0.113);
  float reveal = smoothstep(seed * 0.22, 0.72 + seed * 0.10, uReveal);

  vColor = aColor;
  vOpacity = min(1.0, aAlpha * reveal * transmission * (0.94 + twinkle * 0.06));
  vBrightness = brightness * twinkle;
  vRayStrength = smoothstep(2.4, 4.8, brightness);
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

float gauss(float r2, float sharpness) { return exp(-r2 * sharpness); }

void main() {
  float bright = step(1.5, vKind) * (1.0 - step(2.5, vKind));
  float hero = step(2.5, vKind);
  float major = clamp(bright + hero, 0.0, 1.0);

  if (major < 0.5) {
    vec2 pixel = (gl_PointCoord - vec2(0.5)) * max(vParticleDiameter, 4.0);
    vec2 p = pixel * 2.0 / max(vParticleDiameter, 0.0001);
    float r = length(p);
    float resolved = smoothstep(2.0, 4.0, vParticleDiameter);
    float disc = pow(1.0 - smoothstep(0.05, 0.86, r), 3.0);
    float alpha = mix(filteredCore(pixel, 0.150904), disc, resolved) * vOpacity;
    if (alpha <= 0.0) discard;
    float whiteCore = gauss(r * r, 34.0) * smoothstep(0.92, 2.35, vBrightness);
    vec3 emission = mix(vColor, vec3(1.0), whiteCore * 0.66) * vBrightness;
    outColor = vec4(emission, alpha);
    return;
  }

  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(q, q);
  float r = sqrt(r2);
  if (r > 1.0) discard;

  float needle = gauss(r2, 760.0);
  float photosphere = gauss(r2, 185.0);
  float corona = gauss(r2, 58.0);
  float airyRing = exp(-pow((r - 0.205) * 26.0, 2.0)) * 0.09;
  float aura = gauss(r2, 15.0) * (1.0 - smoothstep(0.40, 0.92, r)) * 0.020;

  float horizontal = exp(-abs(q.y) * 120.0)
    * exp(-abs(q.x) * 2.9)
    * (1.0 - smoothstep(0.18, 0.98, abs(q.x)));
  float vertical = exp(-abs(q.x) * 120.0)
    * exp(-abs(q.y) * 2.9)
    * (1.0 - smoothstep(0.18, 0.98, abs(q.y)));
  float mainCross = max(horizontal, vertical);

  vec2 diag = vec2(q.x + q.y, q.y - q.x) * 0.70710678;
  float diagonal = max(
    exp(-abs(diag.y) * 145.0) * exp(-abs(diag.x) * 4.5),
    exp(-abs(diag.x) * 145.0) * exp(-abs(diag.y) * 4.5)
  );

  float spikes = mainCross * (0.050 * bright + 0.21 * hero) * vRayStrength
    + diagonal * 0.040 * hero * vRayStrength;

  float tintBand = smoothstep(0.055, 0.14, r)
    * (1.0 - smoothstep(0.28, 0.48, r));
  vec3 bodyColor = mix(vec3(1.0), vColor, tintBand * 0.90);
  vec3 spikeColor = mix(vec3(1.0), vColor, 0.13);

  vec3 emission = bodyColor * (
      needle * 1.95
    + photosphere * 1.10
    + corona * 0.38
    + airyRing * 0.20
    + aura
  ) + spikeColor * spikes * 0.92;

  float alpha = vOpacity * clamp(
      needle * 1.42
    + photosphere
    + corona * 0.28
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
};

const compositeUniforms = {
  volume: gl.getUniformLocation(compositeProgram, 'uVolume'),
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
  reveal: gl.getUniformLocation(starProgram, 'uReveal'),
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
  { limit: 0.14, color: [0.43, 0.79, 0.96] },
  { limit: 0.31, color: [0.49, 0.70, 1.00] },
  { limit: 0.39, color: [0.96, 0.49, 0.12] },
  { limit: 0.47, color: [0.98, 0.62, 0.32] },
  { limit: 1.00, color: [0.96, 0.97, 0.99] },
];

function pickColor(scale = 1) {
  const value = random();
  const entry = PALETTE.find(item => value <= item.limit) || PALETTE[PALETTE.length - 1];
  const temperatureNoise = 0.965 + random() * 0.07;
  return entry.color.map(channel => Math.min(1.12, channel * temperatureNoise * scale));
}

const stars = [];
function pushStar(x, y, z, color, size, alpha, phase, rate, kind) {
  stars.push(x, y, z, color[0], color[1], color[2], size, alpha, phase, rate, kind);
}

function addBackground(count) {
  for (let i = 0; i < count; i++) {
    const depth = 3.2 + Math.pow(random(), 0.74) * 24.5;
    const halfHeight = Math.tan(CAMERA.fovY * 0.5) * depth * 1.25;
    const halfWidth = halfHeight * 2.15;
    const x = (random() * 2 - 1) * halfWidth;
    const y = (random() * 2 - 1) * halfHeight;
    const z = -depth;
    const rare = random();
    const size = rare > 0.989 ? 2.0 + random() * 2.2 : 0.70 + random() * 1.00;
    const alpha = rare > 0.989 ? 0.30 + random() * 0.28 : 0.045 + random() * 0.14;
    pushStar(x, y, z, pickColor(0.88), size, alpha, random() * 47, 0.35 + random() * 0.90, 0);
  }
}

function armWeight(x, z) {
  const dx = x - GALAXY_CENTER[0];
  const dz = z - GALAXY_CENTER[2];
  const radius = Math.max(0.1, Math.hypot(dx, dz));
  const theta = Math.atan2(dz, dx);
  const phase = theta * 4 - Math.log(radius + 0.72) * 5.15;
  const armA = Math.pow(0.5 + 0.5 * Math.cos(phase), 5.5);
  const armB = Math.pow(0.5 + 0.5 * Math.cos(phase + 2.16), 7) * 0.58;
  return Math.min(1, 0.12 + armA * 0.74 + armB * 0.44);
}

function sampleGalaxyPoint() {
  for (let guard = 0; guard < 120; guard++) {
    const radius = 0.35 + Math.pow(random(), 0.76) * 12.9;
    const theta = random() * Math.PI * 2;
    const x = GALAXY_CENTER[0] + Math.cos(theta) * radius;
    const z = GALAXY_CENTER[2] + Math.sin(theta) * radius;
    if (z > -1.2 || z < -24.8) continue;
    const density = Math.exp(-radius * 0.082);
    const arms = armWeight(x, z);
    if (random() > Math.min(0.93, density * (0.30 + arms * 0.84))) continue;
    const centre = Math.exp(-(radius * radius) / 7.2);
    const halfHeight = 0.11 + radius * 0.010 + centre * 0.22;
    const warp = 0.065 * Math.sin(z * 0.25 + 0.65) + 0.028 * Math.sin(x * 0.43 - z * 0.15);
    const y = warp + gaussian() * halfHeight;
    return { x, y, z, centre, arms };
  }
  return { x: 0, y: 0, z: -8, centre: 0, arms: 0.3 };
}

function addGalaxyStars(count) {
  for (let i = 0; i < count; i++) {
    const p = sampleGalaxyPoint();
    const w = galaxyToWorld(p.x, p.y, p.z);
    const size = 0.68 + random() * (1.02 + p.centre * 0.34 + p.arms * 0.18);
    const alpha = (0.08 + random() * 0.26) * (0.78 + p.centre * 0.20 + p.arms * 0.12);
    pushStar(w[0], w[1], w[2], pickColor(0.96), size, alpha, random() * 61, 0.45 + random() * 1.05, 1);
  }
}

function addBrightStars(count) {
  for (let i = 0; i < count; i++) {
    const p = sampleGalaxyPoint();
    const w = galaxyToWorld(p.x, p.y, p.z);
    pushStar(
      w[0], w[1], w[2], pickColor(1.07),
      3.4 + Math.pow(random(), 1.5) * 4.0,
      0.68 + random() * 0.22,
      random() * 97,
      0.40 + random() * 0.85,
      2,
    );
  }
}

function addHeroStars(count) {
  for (let i = 0; i < count; i++) {
    const p = sampleGalaxyPoint();
    p.y += (random() - 0.5) * 0.16;
    const w = galaxyToWorld(p.x, p.y, p.z);
    pushStar(
      w[0], w[1], w[2],
      i % 4 === 1 ? [0.49, 0.75, 1.0] : i % 5 === 2 ? [1.0, 0.71, 0.40] : [0.98, 0.99, 1.0],
      6.2 + random() * 4.4,
      0.90,
      11 + i * 7.31,
      0.34 + (i % 5) * 0.09,
      3,
    );
  }
}

addBackground(6200);
addGalaxyStars(7000);
addBrightStars(76);
addHeroStars(14);

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

const cameraBase = galaxyToWorld(0, 0.28, 0);
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

  const yaw = state.pointer[0] * 0.050;
  const pitch = state.pointer[1] * 0.036;
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

  const slideX = state.pointer[0] * 0.20;
  const slideY = state.pointer[1] * 0.11;
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

function renderVolume() {
  const target = state.volumeTarget;
  gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
  gl.viewport(0, 0, target.width, target.height);
  gl.disable(gl.BLEND);
  gl.useProgram(volumeProgram);
  gl.bindVertexArray(emptyVao);
  gl.uniform2f(volumeUniforms.resolution, target.width, target.height);
  bindCameraUniforms(volumeUniforms);
  gl.uniform1f(volumeUniforms.tanHalfFov, Math.tan(CAMERA.fovY * 0.5));
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
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function renderStars(seconds, reveal) {
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
  gl.uniform1f(starUniforms.reveal, reveal);
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
  const reveal = reducedMotion ? 1 : easeInOut((seconds - 0.06) / 1.9);
  renderVolume();
  compositeVolume();
  renderStars(seconds, reveal);
  requestAnimationFrame(render);
}

requestAnimationFrame(render);
