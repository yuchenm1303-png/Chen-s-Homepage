const canvas = document.getElementById('galaxyCanvas');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const gl = canvas.getContext('webgl2', {
  alpha: false,
  antialias: false,
  depth: false,
  stencil: false,
  powerPreference: 'high-performance',
  premultipliedAlpha: false,
});

if (!gl) throw new Error('WebGL2 is required for the galaxy composition lab.');

const colorBufferFloat = gl.getExtension('EXT_color_buffer_float');
const floatLinear = gl.getExtension('OES_texture_float_linear');
const useHDR = Boolean(colorBufferFloat);

// Full-screen authored Milky Way field, using Astra's filtered sub-pixel star idea,
// but with a rebuilt stellar body: hot point core -> circular corona -> diffraction.

const STAR_VERTEX = `#version 300 es
precision highp float;

in vec3 aPosition;
in vec3 aColor;
in float aSize;
in float aAlpha;
in float aPhase;
in float aRate;
in float aKind;

uniform float uAspect;
uniform float uTime;
uniform float uDpr;
uniform float uExposure;
uniform float uPointerActive;
uniform vec2 uPointer;

out vec3 vColor;
out float vOpacity;
out float vBrightness;
out float vRayStrength;
out float vParticleDiameter;
out float vPulse;
flat out float vKind;

mat2 rotate2d(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat2(c, -s, s, c);
}

void main() {
  vec3 p = aPosition;
  float depth = clamp((p.z + 1.0) * 0.5, 0.0, 1.0);

  float background = 1.0 - step(0.5, aKind);
  float stream = step(0.5, aKind) * (1.0 - step(1.5, aKind));
  float bright = step(1.5, aKind) * (1.0 - step(2.5, aKind));
  float hero = step(2.5, aKind) * (1.0 - step(3.5, aKind));

  // Slow depth-dependent flow. This preserves the authored path while preventing
  // the field from reading as a static wallpaper.
  float flowSpeed = mix(0.36, 0.76, depth) * (0.72 + 0.28 * aRate);
  float flowAmount = mix(0.0045, 0.020, depth);
  float phaseX = aPhase * 0.71 + aPosition.x * 4.2 + aPosition.y * 1.8;
  float phaseY = aPhase * 1.13 - aPosition.x * 2.6 + aPosition.y * 3.4;
  float structural = clamp(stream + bright + hero, 0.0, 1.0);
  float flowMask = mix(0.20, 1.0, structural) * mix(1.0, 0.48, hero);
  vec2 flowDirection = normalize(vec2(0.70, 1.0));
  vec2 flowAcross = vec2(-flowDirection.y, flowDirection.x);

  float alongFlow = (sin(phaseX + uTime * flowSpeed) - sin(phaseX))
    * flowAmount * flowMask;
  float acrossFlow = (cos(phaseY + uTime * flowSpeed * 0.73) - cos(phaseY))
    * flowAmount * 0.42 * flowMask;
  p.xy += flowDirection * alongFlow + flowAcross * acrossFlow;

  // Restrained observation parallax.
  p.xy += uPointer * mix(0.0035, 0.021, depth);
  vec2 pointerWorld = vec2(uPointer.x * uAspect, uPointer.y);
  vec2 delta = p.xy - pointerWorld;
  float repel = exp(-dot(delta, delta) * 15.0)
    * uPointerActive * (0.002 + 0.013 * depth);
  p.xy += normalize(delta + vec2(0.0001)) * repel;

  p.xy = rotate2d(-0.017 + uPointer.x * 0.006) * p.xy;

  // First-version galaxy composition, expanded to the whole viewport.
  p.x = (p.x - 0.535) * 1.72;
  p.y *= 1.035;
  float compact = 1.0 - smoothstep(0.78, 1.08, uAspect);
  p.x = mix(p.x, p.x * 0.76, compact);
  gl_Position = vec4(p.x / max(uAspect, 0.62), p.y, 0.0, 1.0);

  // Independent stellar scintillation. Structural stars move more visibly,
  // but size remains almost fixed so twinkle reads as light, not pulsating blobs.
  float basePulse = sin(aPhase + uTime * 0.62 * aRate);
  float secondPulse = sin(aPhase * 1.73 + uTime * (0.36 + 0.27 * aRate));
  float twinkle = 0.94 + 0.06 * basePulse;
  twinkle = mix(twinkle, 0.89 + 0.10 * basePulse + 0.02 * secondPulse, stream);
  twinkle = mix(twinkle, 0.84 + 0.13 * basePulse + 0.035 * secondPulse, bright);
  twinkle = mix(twinkle, 0.80 + 0.16 * basePulse + 0.045 * secondPulse, hero);

  float particleDiameter = max(0.15, aSize * uDpr)
    * mix(0.82, 1.22, depth)
    * (1.0 + bright * 0.04 + hero * 0.06);

  // Keep the field calm, then create a decisive luminance gap for main stars.
  float starBrightness = (0.46 + aSize * 0.19) * background;
  starBrightness += (0.88 + aSize * 0.35) * stream;
  starBrightness += (2.85 + aSize * 0.38) * bright;
  starBrightness += (5.55 + min(aSize, 10.0) * 0.075) * hero;

  float sequence = fract(aPhase * 0.173 + aPosition.x * 0.071 + aPosition.y * 0.113);
  float reveal = smoothstep(
    0.0, 1.0,
    clamp(uExposure * 1.22 - sequence * 0.36, 0.0, 1.0)
  );

  // Colour belongs mostly to the resolved stars, not to the whole particle field.
  float luma = dot(aColor, vec3(0.2126, 0.7152, 0.0722));
  float saturation = 1.02 + stream * 0.08 + bright * 0.54 + hero * 0.72;
  vColor = clamp(mix(vec3(luma), aColor, saturation), 0.0, 1.35);

  float opacityBoost = 1.0 + bright * 0.12 + hero * 0.08;
  vOpacity = min(1.0, aAlpha * reveal * (0.92 + twinkle * 0.08) * opacityBoost);
  vBrightness = starBrightness * twinkle;
  vRayStrength = smoothstep(2.7, 5.6, starBrightness);
  vParticleDiameter = particleDiameter;
  vPulse = twinkle;
  vKind = aKind;

  // Large sprite support is only for resolved bright/hero diffraction geometry.
  gl_PointSize = max(particleDiameter, 4.0 + bright * 5.0 + hero * 15.0);
}
`;

const STAR_FRAGMENT = `#version 300 es
precision highp float;

in vec3 vColor;
in float vOpacity;
in float vBrightness;
in float vRayStrength;
in float vParticleDiameter;
in float vPulse;
flat in float vKind;

uniform float uBloomOnly;
out vec4 outColor;

float astraCubicCoverage(float coordinate) {
  float x = abs(coordinate);
  if (x < 1.0) {
    return (4.0 - 6.0 * x * x + 3.0 * x * x * x) / 6.0;
  }
  float tail = max(2.0 - x, 0.0);
  return tail * tail * tail / 6.0;
}

float astraFilteredCore(vec2 pixel, float area) {
  return astraCubicCoverage(pixel.x) * astraCubicCoverage(pixel.y)
    * area * vParticleDiameter * vParticleDiameter;
}

float gauss(float r2, float sharpness) {
  return exp(-r2 * sharpness);
}

void main() {
  float bright = step(1.5, vKind) * (1.0 - step(2.5, vKind));
  float hero = step(2.5, vKind) * (1.0 - step(3.5, vKind));
  float major = clamp(bright + hero, 0.0, 1.0);

  if (vKind > 3.5) discard;
  if (uBloomOnly > 0.5 && major < 0.5) discard;

  // Background / galaxy-body stars remain Astra-style filtered points.
  if (major < 0.5) {
    vec2 pixel = (gl_PointCoord - vec2(0.5)) * max(vParticleDiameter, 4.0);
    vec2 p = pixel * 2.0 / max(vParticleDiameter, 0.0001);
    float r = length(p);
    float resolved = smoothstep(2.0, 4.0, vParticleDiameter);
    float disc = pow(1.0 - smoothstep(0.05, 0.82, r), 3.0);
    float alpha = mix(
      astraFilteredCore(pixel, 0.150904),
      disc,
      resolved
    ) * vOpacity;

    if (alpha <= 0.0) discard;

    float whiteCore = gauss(r * r, 34.0)
      * smoothstep(0.95, 2.45, vBrightness);
    vec3 emission = mix(vColor, vec3(1.0), whiteCore * 0.68)
      * vBrightness;

    outColor = vec4(emission, alpha);
    return;
  }

  // Resolved bright/hero star body. Everything below is radially symmetric except
  // the diffraction spikes, preventing the former oval/bokeh reading.
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(q, q);
  float r = sqrt(r2);
  if (r > 1.0) discard;

  // 1) hot sub-pixel nucleus
  float needle = gauss(r2, 760.0);
  // 2) compact white stellar photosphere
  float photosphere = gauss(r2, 185.0);
  // 3) tight coloured inner corona
  float corona = gauss(r2, 56.0);
  // 4) subtle Airy-like ring, which gives the eye an optical "star" cue
  float airyRing = exp(-pow((r - 0.205) * 26.0, 2.0)) * 0.10;
  // 5) tiny neutral aura only; this is intentionally not a broad halo
  float aura = gauss(r2, 15.0) * (1.0 - smoothstep(0.40, 0.92, r)) * 0.022;

  // Thin long diffraction spikes. Hero stars are stronger; bright stars get just
  // a restrained hint so they still read as points rather than icons.
  float horizontal = exp(-abs(q.y) * 120.0)
    * exp(-abs(q.x) * 2.75)
    * (1.0 - smoothstep(0.18, 0.98, abs(q.x)));
  float vertical = exp(-abs(q.x) * 120.0)
    * exp(-abs(q.y) * 2.75)
    * (1.0 - smoothstep(0.18, 0.98, abs(q.y)));
  float mainCross = max(horizontal, vertical);

  vec2 diagCoord = vec2(q.x + q.y, q.y - q.x) * 0.70710678;
  float diagonal = max(
    exp(-abs(diagCoord.y) * 145.0) * exp(-abs(diagCoord.x) * 4.3),
    exp(-abs(diagCoord.x) * 145.0) * exp(-abs(diagCoord.y) * 4.3)
  );

  float spikeGain = (0.055 * bright + 0.24 * hero) * vRayStrength;
  float diagonalGain = 0.045 * hero * vRayStrength;
  float spikes = mainCross * spikeGain + diagonal * diagonalGain;

  // Core is white; colour lives in a narrow annulus immediately around it.
  float tintBand = smoothstep(0.055, 0.14, r)
    * (1.0 - smoothstep(0.28, 0.48, r));
  vec3 bodyColor = mix(vec3(1.0), vColor, tintBand * 0.92);

  float bodyLuma = dot(bodyColor, vec3(0.2126, 0.7152, 0.0722));
  bodyColor = mix(
    bodyColor,
    vec3(bodyLuma),
    smoothstep(0.45, 0.92, r) * 0.58
  );

  vec3 spikeColor = mix(vec3(1.0), vColor, 0.14);

  float bodyShape = needle * 1.45
    + photosphere * 1.00
    + corona * 0.30
    + airyRing
    + aura;

  vec3 bodyEnergy = bodyColor * (
      needle * 2.05
    + photosphere * 1.18
    + corona * 0.42
    + airyRing * 0.22
    + aura
  );

  vec3 emission = bodyEnergy + spikeColor * spikes * 0.96;
  float alpha = vOpacity * clamp(bodyShape + spikes, 0.0, 1.0);

  if (alpha <= 0.0004) discard;

  // Bloom source contains only the white-hot body and short spike energy.
  if (uBloomOnly > 0.5) {
    float bloomCore = needle * 1.75
      + photosphere * 0.80
      + corona * 0.12
      + mainCross * (0.025 * bright + 0.075 * hero);
    vec3 bloomColor = mix(vec3(1.0), vColor, 0.18);
    outColor = vec4(
      bloomColor * vBrightness * bloomCore,
      vOpacity * clamp(bloomCore, 0.0, 1.0)
    );
    return;
  }

  outColor = vec4(emission * vBrightness, alpha);
}
`;

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

const BLOOM_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSource;
uniform vec2 uTexel;
uniform vec2 uDirection;
uniform float uThreshold;
uniform float uExtract;
out vec4 outColor;

vec3 sourceAt(vec2 uv) {
  vec3 c = texture(
    uSource,
    clamp(uv, vec2(0.001), vec2(0.999))
  ).rgb;

  if (uExtract > 0.5) {
    float luminance = max(c.r, max(c.g, c.b));
    float gate = smoothstep(uThreshold, uThreshold + 0.10, luminance);
    c *= gate;
  }

  return c;
}

void main() {
  vec2 stepUv = uTexel * uDirection;

  // Compact kernel: bloom should kiss the stellar body, not turn it into bokeh.
  vec3 c = sourceAt(vUv) * 0.40;
  c += (
    sourceAt(vUv + stepUv * 0.78)
    + sourceAt(vUv - stepUv * 0.78)
  ) * 0.24;
  c += (
    sourceAt(vUv + stepUv * 1.58)
    + sourceAt(vUv - stepUv * 1.58)
  ) * 0.06;

  outColor = vec4(c, 1.0);
}
`;

const COMPOSITE_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uBloom0;
uniform sampler2D uBloom1;
uniform sampler2D uBloom2;
uniform float uBloomIntensity;
out vec4 outColor;

vec3 acesFilmic(vec3 x) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp(
    (x * (a * x + b)) / (x * (c * x + d) + e),
    0.0,
    1.0
  );
}

void main() {
  vec3 scene = texture(uScene, vUv).rgb;
  vec3 bloom = texture(uBloom0, vUv).rgb * 0.76
             + texture(uBloom1, vUv).rgb * 0.19
             + texture(uBloom2, vUv).rgb * 0.05;

  vec3 hdrColor = scene + bloom * uBloomIntensity;
  vec3 mapped = acesFilmic(hdrColor);
  mapped = pow(mapped, vec3(1.0 / 2.2));
  mapped += vec3(0.003, 0.005, 0.009);

  outColor = vec4(mapped, 1.0);
}
`;

function compile(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(log || 'Shader compilation failed');
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
    throw new Error(log || 'Program link failed');
  }
  return program;
}

const starProgram = link(STAR_VERTEX, STAR_FRAGMENT);
const bloomProgram = link(FULLSCREEN_VERTEX, BLOOM_FRAGMENT);
const compositeProgram = link(FULLSCREEN_VERTEX, COMPOSITE_FRAGMENT);
const emptyVao = gl.createVertexArray();

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

const random = mulberry32(0x51A7F19D);

function gaussian() {
  const u = Math.max(random(), 1e-7);
  const v = Math.max(random(), 1e-7);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
}

// Astra production palette / weights.
const PALETTE = [
  { limit: 0.15, color: [0.427, 0.796, 0.957] },
  { limit: 0.33, color: [0.478, 0.694, 0.996] },
  { limit: 0.40, color: [0.973, 0.475, 0.082] },
  { limit: 0.48, color: [0.980, 0.600, 0.298] },
  { limit: 1.00, color: [0.961, 0.965, 0.984] },
];

function pickColor(scale = 1) {
  const value = random();
  const entry = PALETTE.find(item => value <= item.limit)
    || PALETTE[PALETTE.length - 1];
  const temperatureNoise = 0.965 + random() * 0.07;
  return entry.color.map(channel =>
    Math.min(1.15, channel * temperatureNoise * scale)
  );
}

const PRIMARY_PATH = [
  [-0.46, -1.30],
  [-0.16, -0.98],
  [ 0.16, -0.70],
  [ 0.43, -0.43],
  [ 0.67, -0.12],
  [ 0.82,  0.19],
  [ 0.98,  0.47],
  [ 1.22,  0.78],
  [ 1.53,  1.19],
];

const SECONDARY_PATH = [
  [-0.08, -1.30],
  [ 0.18, -1.01],
  [ 0.38, -0.69],
  [ 0.58, -0.40],
  [ 0.83, -0.13],
  [ 1.04,  0.19],
  [ 1.20,  0.54],
  [ 1.39,  0.90],
  [ 1.69,  1.24],
];

function catmullRom(points, t) {
  const last = points.length - 1;
  const scaled = Math.max(0, Math.min(0.999999, t)) * last;
  const i = Math.floor(scaled);
  const u = scaled - i;

  const p0 = points[Math.max(0, i - 1)];
  const p1 = points[i];
  const p2 = points[Math.min(last, i + 1)];
  const p3 = points[Math.min(last, i + 2)];

  const u2 = u * u;
  const u3 = u2 * u;

  return [
    0.5 * (
      (2 * p1[0])
      + (-p0[0] + p2[0]) * u
      + (2*p0[0] - 5*p1[0] + 4*p2[0] - p3[0]) * u2
      + (-p0[0] + 3*p1[0] - 3*p2[0] + p3[0]) * u3
    ),
    0.5 * (
      (2 * p1[1])
      + (-p0[1] + p2[1]) * u
      + (2*p0[1] - 5*p1[1] + 4*p2[1] - p3[1]) * u2
      + (-p0[1] + 3*p1[1] - 3*p2[1] + p3[1]) * u3
    ),
  ];
}

function pathFrame(points, t) {
  const p = catmullRom(points, t);
  const before = catmullRom(points, Math.max(0, t - 0.0025));
  const after = catmullRom(points, Math.min(0.9999, t + 0.0025));

  let tx = after[0] - before[0];
  let ty = after[1] - before[1];
  const length = Math.max(Math.hypot(tx, ty), 1e-6);
  tx /= length;
  ty /= length;

  return { x: p[0], y: p[1], tx, ty, nx: -ty, ny: tx };
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
    const x = -2.22 + random() * 4.44;
    const y = -1.20 + random() * 2.40;
    const z = -0.94 + random() * 1.88;
    const rare = random();

    const size = rare > 0.985
      ? 1.65 + random() * 1.20
      : 0.46 + random() * 0.82;

    const alpha = rare > 0.985
      ? 0.26 + random() * 0.24
      : 0.045 + random() * 0.15;

    pushStar(
      x, y, z,
      pickColor(0.84),
      size, alpha,
      random() * 39,
      0.45 + random() * 0.90,
      0,
    );
  }
}

function streamWidth(t, secondary = false) {
  const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 4.6 + 0.9);
  const body = secondary ? 0.082 : 0.125;
  const swell = secondary ? 0.080 : 0.155;
  return body + pulse * swell;
}

function dustLaneOffset(t) {
  return -0.026 + Math.sin(t * 8.4 + 0.6) * 0.038;
}

function dustLaneWidth(t) {
  return 0.032
    + (0.5 + 0.5 * Math.sin(t * 5.8 + 2.1)) * 0.024;
}

function addStream(count, points, secondary = false) {
  let created = 0;
  let guard = 0;

  while (created < count && guard < count * 12) {
    guard++;

    const t = Math.pow(random(), secondary ? 1.03 : 0.96);
    const frame = pathFrame(points, t);
    const width = streamWidth(t, secondary);
    const offset = gaussian() * width;

    if (!secondary) {
      const laneDistance = Math.abs(offset - dustLaneOffset(t));
      if (laneDistance < dustLaneWidth(t) && random() < 0.86) continue;
    }

    const along = gaussian() * 0.012;
    const x = frame.x + frame.nx * offset + frame.tx * along;
    const y = frame.y + frame.ny * offset + frame.ty * along;
    const z = Math.max(
      -0.88,
      Math.min(
        0.92,
        gaussian() * (secondary ? 0.26 : 0.34)
          + (random() - 0.5) * 0.15
      )
    );

    const densityCenter = Math.exp(-Math.pow((t - 0.52) / 0.34, 2));
    const size = 0.58 + random() * (1.12 + densityCenter * 0.42);
    const alpha = (0.082 + random() * 0.29)
      * (0.80 + densityCenter * 0.30)
      * (secondary ? 0.80 : 1);

    pushStar(
      x, y, z,
      pickColor(secondary ? 0.88 : 0.98),
      size,
      alpha,
      random() * 57,
      0.55 + random() * 1.25,
      1,
    );

    created++;
  }
}

function addMidStars(count) {
  for (let i = 0; i < count; i++) {
    const t = 0.04 + random() * 0.92;
    const frame = pathFrame(PRIMARY_PATH, t);
    const offset = gaussian() * (streamWidth(t, false) * 0.92);

    pushStar(
      frame.x + frame.nx * offset,
      frame.y + frame.ny * offset,
      -0.35 + random() * 1.10,
      pickColor(1.05),
      1.35 + Math.pow(random(), 2.1) * 1.75,
      0.34 + random() * 0.48,
      random() * 73,
      0.58 + random() * 1.15,
      1,
    );
  }
}

function addBrightStars(count) {
  for (let i = 0; i < count; i++) {
    const t = 0.05 + random() * 0.90;
    const frame = pathFrame(
      random() < 0.78 ? PRIMARY_PATH : SECONDARY_PATH,
      t
    );
    const offset = gaussian() * streamWidth(t, false) * 0.80;

    pushStar(
      frame.x + frame.nx * offset,
      frame.y + frame.ny * offset,
      -0.12 + random() * 1.00,
      pickColor(1.14),
      3.0 + Math.pow(random(), 1.55) * 3.6,
      0.72 + random() * 0.26,
      random() * 91,
      0.48 + random() * 0.95,
      2,
    );
  }
}

const HERO_STARS = [
  { t: .18, offset: -.072, size: 8.3, color: [0.47, 0.77, 1.00] },
  { t: .31, offset:  .098, size: 6.7, color: [1.00, 0.63, 0.28] },
  { t: .42, offset: -.115, size: 9.6, color: [0.40, 0.70, 1.00] },
  { t: .53, offset:  .055, size: 7.4, color: [0.97, 0.98, 1.00] },
  { t: .61, offset: -.083, size: 10.2, color: [1.00, 0.57, 0.20] },
  { t: .70, offset:  .092, size: 7.8, color: [0.45, 0.74, 1.00] },
  { t: .79, offset: -.048, size: 8.8, color: [0.95, 0.97, 1.00] },
  { t: .88, offset:  .061, size: 6.8, color: [1.00, 0.68, 0.34] },
];

function addHeroStars() {
  HERO_STARS.forEach((star, index) => {
    const frame = pathFrame(PRIMARY_PATH, star.t);

    pushStar(
      frame.x + frame.nx * star.offset,
      frame.y + frame.ny * star.offset,
      0.58 + (index % 3) * 0.09,
      star.color,
      star.size,
      0.98,
      17 + index * 8.31,
      0.42 + (index % 4) * 0.11,
      3,
    );
  });
}

// Keep the original field structure. The old large haze sprites remain disabled.
addBackground(5000);
addStream(4300, PRIMARY_PATH, false);
addStream(1450, SECONDARY_PATH, true);
addMidStars(700);
addBrightStars(68);
addHeroStars();

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
  gl.vertexAttribPointer(
    location,
    size,
    gl.FLOAT,
    false,
    STRIDE * FLOAT_BYTES,
    offsetFloats * FLOAT_BYTES,
  );
}

bindAttribute('aPosition', 3, 0);
bindAttribute('aColor', 3, 3);
bindAttribute('aSize', 1, 6);
bindAttribute('aAlpha', 1, 7);
bindAttribute('aPhase', 1, 8);
bindAttribute('aRate', 1, 9);
bindAttribute('aKind', 1, 10);
gl.bindVertexArray(null);

const starUniforms = {
  aspect: gl.getUniformLocation(starProgram, 'uAspect'),
  time: gl.getUniformLocation(starProgram, 'uTime'),
  dpr: gl.getUniformLocation(starProgram, 'uDpr'),
  exposure: gl.getUniformLocation(starProgram, 'uExposure'),
  pointerActive: gl.getUniformLocation(starProgram, 'uPointerActive'),
  pointer: gl.getUniformLocation(starProgram, 'uPointer'),
  bloomOnly: gl.getUniformLocation(starProgram, 'uBloomOnly'),
};

const bloomUniforms = {
  source: gl.getUniformLocation(bloomProgram, 'uSource'),
  texel: gl.getUniformLocation(bloomProgram, 'uTexel'),
  direction: gl.getUniformLocation(bloomProgram, 'uDirection'),
  threshold: gl.getUniformLocation(bloomProgram, 'uThreshold'),
  extract: gl.getUniformLocation(bloomProgram, 'uExtract'),
};

const compositeUniforms = {
  scene: gl.getUniformLocation(compositeProgram, 'uScene'),
  blooms: [0, 1, 2].map(i =>
    gl.getUniformLocation(compositeProgram, `uBloom${i}`)
  ),
  bloomIntensity: gl.getUniformLocation(
    compositeProgram,
    'uBloomIntensity'
  ),
};

function createTarget(width, height) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  const internalFormat = useHDR ? gl.RGBA16F : gl.RGBA8;
  const type = useHDR ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;

  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    internalFormat,
    width,
    height,
    0,
    gl.RGBA,
    type,
    null,
  );

  const filter = useHDR && !floatLinear ? gl.NEAREST : gl.LINEAR;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0,
  );

  if (
    gl.checkFramebufferStatus(gl.FRAMEBUFFER)
    !== gl.FRAMEBUFFER_COMPLETE
  ) {
    throw new Error('Galaxy framebuffer incomplete.');
  }

  return { texture, framebuffer, width, height };
}

function destroyTarget(target) {
  if (!target) return;
  gl.deleteTexture(target.texture);
  gl.deleteFramebuffer(target.framebuffer);
}

let sceneTarget = null;
let bloomSourceTarget = null;
let bloomLevels = [];

const state = {
  dpr: 1,
  width: 1,
  height: 1,
  aspect: 1,
  pointerTarget: [0, 0],
  pointer: [0, 0],
  pointerActiveTarget: 0,
  pointerActive: 0,
  startTime: performance.now(),
  lastFrame: 0,
};

function rebuildTargets() {
  destroyTarget(sceneTarget);
  destroyTarget(bloomSourceTarget);

  for (const level of bloomLevels) {
    destroyTarget(level.a);
    destroyTarget(level.b);
  }

  sceneTarget = createTarget(state.width, state.height);
  bloomSourceTarget = createTarget(state.width, state.height);
  bloomLevels = [];

  const scales = [0.5, 0.25, 0.125];
  for (const scale of scales) {
    const width = Math.max(1, Math.floor(state.width * scale));
    const height = Math.max(1, Math.floor(state.height * scale));
    bloomLevels.push({
      a: createTarget(width, height),
      b: createTarget(width, height),
    });
  }
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.85);
  const width = Math.max(1, Math.round(window.innerWidth * dpr));
  const height = Math.max(1, Math.round(window.innerHeight * dpr));
  const changed =
    width !== state.width
    || height !== state.height
    || dpr !== state.dpr;

  state.dpr = dpr;
  state.width = width;
  state.height = height;
  state.aspect = window.innerWidth / Math.max(window.innerHeight, 1);

  if (!changed) return;

  canvas.width = width;
  canvas.height = height;
  rebuildTargets();
}

function onPointerMove(event) {
  state.pointerTarget[0] =
    (event.clientX / Math.max(window.innerWidth, 1)) * 2 - 1;
  state.pointerTarget[1] =
    -((event.clientY / Math.max(window.innerHeight, 1)) * 2 - 1);
  state.pointerActiveTarget = 1;
}

function onPointerLeave() {
  state.pointerActiveTarget = 0;
}

window.addEventListener('resize', resize, { passive: true });
window.addEventListener('pointermove', onPointerMove, { passive: true });
window.addEventListener('pointerleave', onPointerLeave, { passive: true });
window.addEventListener('blur', onPointerLeave, { passive: true });
canvas.addEventListener(
  'webglcontextlost',
  event => event.preventDefault()
);

function damp(current, target, speed, dt) {
  return current
    + (target - current) * (1 - Math.exp(-speed * dt));
}

function easeInOut(value) {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
}

function bindTexture(unit, texture) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
}

function bloomPass(source, target, direction, extract) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
  gl.viewport(0, 0, target.width, target.height);
  gl.disable(gl.BLEND);
  gl.useProgram(bloomProgram);
  gl.bindVertexArray(emptyVao);

  bindTexture(0, source.texture);
  gl.uniform1i(bloomUniforms.source, 0);
  gl.uniform2f(
    bloomUniforms.texel,
    1 / source.width,
    1 / source.height,
  );
  gl.uniform2f(
    bloomUniforms.direction,
    direction[0],
    direction[1],
  );
  gl.uniform1f(
    bloomUniforms.threshold,
    useHDR ? 0.30 : 0.22,
  );
  gl.uniform1f(
    bloomUniforms.extract,
    extract ? 1 : 0,
  );

  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function renderBloom() {
  let source = bloomSourceTarget;

  for (let i = 0; i < bloomLevels.length; i++) {
    const level = bloomLevels[i];
    bloomPass(source, level.a, [1, 0], i === 0);
    bloomPass(level.a, level.b, [0, 1], false);
    source = level.b;
  }
}

function composite() {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, state.width, state.height);
  gl.disable(gl.BLEND);
  gl.useProgram(compositeProgram);
  gl.bindVertexArray(emptyVao);

  bindTexture(0, sceneTarget.texture);
  gl.uniform1i(compositeUniforms.scene, 0);

  bloomLevels.forEach((level, index) => {
    bindTexture(index + 1, level.b.texture);
    gl.uniform1i(compositeUniforms.blooms[index], index + 1);
  });

  gl.uniform1f(compositeUniforms.bloomIntensity, 0.38);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

resize();

gl.disable(gl.DEPTH_TEST);
gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);
gl.blendFuncSeparate(
  gl.SRC_ALPHA,
  gl.ONE,
  gl.ONE,
  gl.ONE_MINUS_SRC_ALPHA
);

function drawStarPass(target, bloomOnly, seconds, exposure) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
  gl.viewport(0, 0, state.width, state.height);

  if (bloomOnly) {
    gl.clearColor(0, 0, 0, 0);
  } else {
    gl.clearColor(0.0015, 0.0030, 0.0060, 1);
  }
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.enable(gl.BLEND);
  gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);
  gl.blendFuncSeparate(
    gl.SRC_ALPHA,
    gl.ONE,
    gl.ONE,
    gl.ONE_MINUS_SRC_ALPHA
  );

  gl.useProgram(starProgram);
  gl.bindVertexArray(starVao);

  gl.uniform1f(starUniforms.aspect, state.aspect);
  gl.uniform1f(
    starUniforms.time,
    reducedMotion ? 0 : seconds,
  );
  gl.uniform1f(starUniforms.dpr, state.dpr);
  gl.uniform1f(starUniforms.exposure, exposure);
  gl.uniform1f(
    starUniforms.pointerActive,
    state.pointerActive,
  );
  gl.uniform2f(
    starUniforms.pointer,
    state.pointer[0],
    state.pointer[1],
  );
  gl.uniform1f(
    starUniforms.bloomOnly,
    bloomOnly ? 1 : 0,
  );

  gl.drawArrays(gl.POINTS, 0, starCount);
  gl.bindVertexArray(null);
  gl.disable(gl.BLEND);
}

function render(now) {
  resize();

  const seconds = (now - state.startTime) / 1000;
  const dt = Math.min(
    0.05,
    Math.max(
      0.001,
      state.lastFrame
        ? (now - state.lastFrame) / 1000
        : 0.016
    )
  );
  state.lastFrame = now;

  if (reducedMotion) {
    state.pointer[0] = 0;
    state.pointer[1] = 0;
    state.pointerActive = 0;
  } else {
    state.pointer[0] = damp(
      state.pointer[0],
      state.pointerTarget[0],
      5.2,
      dt,
    );
    state.pointer[1] = damp(
      state.pointer[1],
      state.pointerTarget[1],
      5.2,
      dt,
    );
    state.pointerActive = damp(
      state.pointerActive,
      state.pointerActiveTarget,
      4.4,
      dt,
    );
  }

  const exposure = reducedMotion
    ? 1
    : easeInOut(
      Math.max(
        0,
        Math.min(1, (seconds - 0.10) / 2.45)
      )
    );

  drawStarPass(sceneTarget, false, seconds, exposure);
  drawStarPass(bloomSourceTarget, true, seconds, exposure);

  renderBloom();
  composite();

  requestAnimationFrame(render);
}

requestAnimationFrame(render);
