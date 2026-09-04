const canvas = document.getElementById('galaxyCanvas');
const statusEl = document.getElementById('renderStatus');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const gl = canvas.getContext('webgl2', {
  alpha: false,
  antialias: false,
  depth: false,
  stencil: false,
  powerPreference: 'high-performance',
  premultipliedAlpha: false,
});

if (!gl) {
  document.body.classList.add('webgl-failed');
  if (statusEl) statusEl.textContent = 'WebGL2 unavailable';
  throw new Error('WebGL2 is required for the galaxy prototype.');
}

const SKY_VERTEX_SHADER = `#version 300 es
precision highp float;
void main() {
  vec2 position;
  if (gl_VertexID == 0) position = vec2(-1.0, -1.0);
  else if (gl_VertexID == 1) position = vec2(3.0, -1.0);
  else position = vec2(-1.0, 3.0);
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const SKY_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform float uExposure;
uniform vec2 uPointer;
out vec4 outColor;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise2(vec2 p) {
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
  mat2 basis = mat2(0.80, -0.60, 0.60, 0.80);
  for (int i = 0; i < 5; i++) {
    value += noise2(p) * amplitude;
    p = basis * p * 2.03 + 13.17;
    amplitude *= 0.50;
  }
  return value;
}

mat2 rotate2d(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat2(c, -s, s, c);
}

void main() {
  vec2 uv = gl_FragCoord.xy / max(uResolution, vec2(1.0));
  vec2 p = uv * 2.0 - 1.0;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  p.x *= aspect;
  p -= uPointer * vec2(0.010 * aspect, 0.007);

  vec2 centered = p - vec2(0.48, -0.04);
  vec2 q = rotate2d(-0.88) * centered;

  float slowTime = uTime * 0.004;
  vec2 warpSample = q * 0.72 + vec2(slowTime, -slowTime * 0.6);
  vec2 warp = vec2(
    fbm(warpSample + vec2(2.1, 7.4)),
    fbm(warpSample + vec2(9.7, 1.8))
  ) - 0.5;
  q += warp * 0.15;

  float along = q.x;
  float axis = 0.030 * sin(along * 1.45 + 0.4)
             + 0.018 * sin(along * 3.15 - 1.1);
  float across = q.y - axis;

  float widthNoise = fbm(vec2(along * 0.55 + 8.0, 2.4));
  float width = 0.29 + widthNoise * 0.11;
  float broadWidth = 0.58 + widthNoise * 0.12;

  float mainEnvelope = exp(-pow(abs(across) / max(width, 0.001), 2.0) * 1.45);
  float outerEnvelope = exp(-pow(abs(across) / max(broadWidth, 0.001), 2.0) * 1.10);
  float longitudinal = exp(-pow((along + 0.05) / 1.62, 4.0));
  mainEnvelope *= longitudinal;
  outerEnvelope *= longitudinal;

  float nLarge = fbm(q * vec2(0.78, 1.08) + vec2(3.1, 4.7));
  float nMid = fbm(q * vec2(1.65, 2.10) + vec2(-2.8, 8.2));
  float nFine = noise2(q * vec2(5.1, 6.2) + 11.4);
  float cloud = smoothstep(0.28, 0.83, nLarge * 0.62 + nMid * 0.31 + nFine * 0.07);
  float veil = smoothstep(0.18, 0.78, nLarge * 0.78 + nMid * 0.22);

  float bulge = exp(-pow((along + 0.05) / 0.80, 2.0)
                    -pow((across + 0.018) / 0.38, 2.0));
  bulge *= 0.56 + 0.44 * smoothstep(0.22, 0.82, nLarge);

  float laneCenter = -0.018
                   + 0.050 * sin(along * 1.20 + 0.55)
                   + 0.017 * sin(along * 3.75 - 0.8);
  float laneWidth = 0.050 + 0.020 * fbm(vec2(along * 0.92 + 5.4, 9.1));
  float lane = exp(-pow((across - laneCenter) / laneWidth, 2.0));
  float laneBreakup = smoothstep(0.20, 0.78, fbm(q * vec2(2.5, 3.0) + vec2(7.2, -3.4)));
  lane *= mix(0.46, 1.0, laneBreakup) * mainEnvelope;

  float knotA = exp(-pow((along + 0.62) / 0.34, 2.0) - pow((across - 0.10) / 0.22, 2.0));
  float knotB = exp(-pow((along - 0.52) / 0.40, 2.0) - pow((across + 0.12) / 0.27, 2.0));

  vec3 color = vec3(0.0012, 0.0020, 0.0034);
  vec3 coolDust = vec3(0.080, 0.092, 0.108);
  vec3 warmDust = vec3(0.225, 0.145, 0.103);
  vec3 warmCore = vec3(0.300, 0.178, 0.115);
  vec3 coolEdge = vec3(0.060, 0.082, 0.110);

  float outerLight = outerEnvelope * veil * 0.22;
  float bodyLight = mainEnvelope * (0.17 + 0.32 * cloud);
  float coreLight = bulge * (0.20 + 0.32 * cloud);

  color += coolDust * outerLight;
  color += mix(coolDust, warmDust, 0.62) * bodyLight;
  color += warmCore * coreLight;
  color += warmDust * (knotA * 0.055 + knotB * 0.045) * cloud;
  color += coolEdge * outerEnvelope * (1.0 - mainEnvelope) * 0.10;

  color *= 1.0 - lane * (0.48 + 0.20 * cloud);

  float shadowCloud = exp(-pow((along - 0.18) / 0.72, 2.0)
                          -pow((across + 0.20) / 0.31, 2.0));
  color *= 1.0 - shadowCloud * 0.18 * smoothstep(0.25, 0.75, nMid);

  float vignette = 1.0 - smoothstep(0.72, 1.52, length(vec2(p.x / aspect, p.y)));
  color *= mix(0.58, 1.0, vignette);

  float grain = (hash21(gl_FragCoord.xy + uTime * 3.0) - 0.5) * 0.0022;
  color += grain;
  color *= 0.18 + 0.82 * uExposure;
  outColor = vec4(max(color, vec3(0.0)), 1.0);
}
`;

const STAR_VERTEX_SHADER = `#version 300 es
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
out float vAlpha;
flat out float vKind;
flat out float vPhase;

void main() {
  vec3 p = aPosition;
  float depth = clamp((p.z + 1.0) * 0.5, 0.0, 1.0);
  float parallax = mix(0.0015, 0.020, depth);
  p.xy += uPointer * parallax;
  p.x += sin(uTime * 0.032 + aPhase * 0.071) * (0.0007 + depth * 0.0028);
  p.y += cos(uTime * 0.028 + aPhase * 0.053) * (0.0006 + depth * 0.0022);

  vec2 pointerWorld = vec2(uPointer.x * uAspect, uPointer.y);
  vec2 delta = p.xy - pointerWorld;
  float dist2 = dot(delta, delta);
  float repel = exp(-dist2 * 11.0) * uPointerActive * (0.0006 + depth * 0.0046);
  p.xy += normalize(delta + vec2(0.0001)) * repel;

  float compact = 1.0 - smoothstep(0.82, 1.08, uAspect);
  p.x = mix(p.x, p.x * 0.64 - 0.02, compact);
  gl_Position = vec4(p.x / max(uAspect, 0.62), p.y, 0.0, 1.0);

  float bright = step(1.5, aKind);
  float hero = step(2.5, aKind);
  float twinkleAmount = mix(0.015, 0.055, bright);
  float twinkle = 1.0 + twinkleAmount * sin(uTime * aRate + aPhase);
  float depthScale = mix(0.78, 1.24, depth);
  gl_PointSize = max(1.0, aSize * uDpr * twinkle * depthScale);

  float revealBias = bright * 0.18 + hero * 0.14;
  float sequence = fract(aPhase * 0.173 + aPosition.x * 0.091 + aPosition.y * 0.137);
  float reveal = smoothstep(0.0, 1.0, clamp(uExposure * 1.24 + revealBias - sequence * 0.26, 0.0, 1.0));
  vColor = aColor;
  vAlpha = aAlpha * reveal;
  vKind = aKind;
  vPhase = aPhase;
}
`;

const STAR_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 vColor;
in float vAlpha;
flat in float vKind;
flat in float vPhase;
out vec4 outColor;

mat2 rotate2d(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat2(c, -s, s, c);
}

void main() {
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float r = length(uv);
  if (r > 1.0) discard;

  float bright = step(1.5, vKind);
  float hero = step(2.5, vKind);
  float core = exp(-r * r * mix(48.0, 34.0, bright));
  float halo = exp(-r * r * mix(12.0, 5.8, bright));
  float disc = 1.0 - smoothstep(0.42, 0.88, r);

  float angle = fract(vPhase * 0.147) * 6.28318530718;
  vec2 q = rotate2d(angle) * uv;
  float photographicStreak = exp(-abs(q.y) * 20.0) * exp(-abs(q.x) * 3.6);

  float baseEnergy = core * 1.46 + halo * 0.16 + disc * 0.16;
  float brightEnergy = core * 1.84 + halo * 0.56 + photographicStreak * 0.075;
  float heroEnergy = core * 2.12 + halo * 0.76 + photographicStreak * 0.11;
  float energy = mix(baseEnergy, brightEnergy, bright);
  energy = mix(energy, heroEnergy, hero);

  float edgeFade = 1.0 - smoothstep(0.60, 1.0, r);
  float alphaShape = mix(edgeFade, max(edgeFade, halo * 0.48), bright);
  outColor = vec4(vColor * energy, vAlpha * alphaShape);
}
`;

function compileShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || 'Shader compilation failed';
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function createProgram(vertexSource, fragmentSource) {
  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || 'Program link failed';
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
}

const skyProgram = createProgram(SKY_VERTEX_SHADER, SKY_FRAGMENT_SHADER);
const starProgram = createProgram(STAR_VERTEX_SHADER, STAR_FRAGMENT_SHADER);
const skyUniforms = {
  resolution: gl.getUniformLocation(skyProgram, 'uResolution'),
  time: gl.getUniformLocation(skyProgram, 'uTime'),
  exposure: gl.getUniformLocation(skyProgram, 'uExposure'),
  pointer: gl.getUniformLocation(skyProgram, 'uPointer'),
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
const random = mulberry32(0x7719A5C3);
function gaussian() {
  const u = Math.max(random(), 1e-7);
  const v = Math.max(random(), 1e-7);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
}

const PALETTE = [
  { limit: 0.72, color: [0.98, 0.985, 1.00] },
  { limit: 0.86, color: [1.00, 0.91, 0.76] },
  { limit: 0.95, color: [0.78, 0.88, 1.00] },
  { limit: 0.985, color: [0.68, 0.77, 0.91] },
  { limit: 1.00, color: [1.00, 0.70, 0.61] },
];
function pickColor(scale = 1) {
  const value = random();
  const entry = PALETTE.find(item => value <= item.limit) || PALETTE[0];
  const temperatureNoise = 0.97 + random() * 0.06;
  return entry.color.map(channel => Math.min(1, channel * temperatureNoise * scale));
}

const PRIMARY_PATH = [
  [-0.50, -1.30], [-0.18, -1.04], [0.10, -0.78], [0.35, -0.52], [0.55, -0.25],
  [0.70, 0.02], [0.82, 0.30], [0.96, 0.57], [1.16, 0.84], [1.43, 1.18],
];
const SECONDARY_PATH = [
  [-0.10, -1.28], [0.12, -1.00], [0.31, -0.73], [0.50, -0.48], [0.72, -0.20],
  [0.91, 0.10], [1.05, 0.41], [1.20, 0.72], [1.48, 1.13],
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
    0.5 * ((2*p1[0]) + (-p0[0]+p2[0])*u + (2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*u2 + (-p0[0]+3*p1[0]-3*p2[0]+p3[0])*u3),
    0.5 * ((2*p1[1]) + (-p0[1]+p2[1])*u + (2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*u2 + (-p0[1]+3*p1[1]-3*p2[1]+p3[1])*u3),
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
  stars.push(x, y, z, color[0], color[1], color[2], size, alpha, phase, rate, kind);
}
function streamWidth(t, secondary = false) {
  const wave = 0.5 + 0.5 * Math.sin(t * Math.PI * 3.6 + 0.8);
  const bulge = Math.exp(-Math.pow((t - 0.52) / 0.24, 2));
  const base = secondary ? 0.10 : 0.16;
  const variation = secondary ? 0.05 : 0.09;
  return base + variation * wave + bulge * (secondary ? 0.025 : 0.055);
}
function dustLaneOffset(t) {
  return -0.018 + Math.sin(t * 7.8 + 0.45) * 0.043;
}
function dustLaneWidth(t) {
  return 0.038 + (0.5 + 0.5 * Math.sin(t * 4.8 + 2.0)) * 0.026;
}

function addBackground(count) {
  for (let i = 0; i < count; i++) {
    const x = -2.26 + random() * 4.52;
    const y = -1.22 + random() * 2.44;
    const z = -0.98 + random() * 1.96;
    const rare = random();
    const size = rare > 0.991 ? 1.65 + random() * 1.25 : 0.45 + random() * 0.78;
    const alpha = rare > 0.991 ? 0.24 + random() * 0.28 : 0.025 + random() * 0.095;
    pushStar(x, y, z, pickColor(0.87), size, alpha, random() * 47, 0.30 + random() * 0.72, 0);
  }
}

function addStream(count, points, secondary = false) {
  let created = 0;
  let guard = 0;
  while (created < count && guard < count * 16) {
    guard++;
    const t = Math.pow(random(), secondary ? 1.02 : 0.96);
    const frame = pathFrame(points, t);
    const width = streamWidth(t, secondary);
    const offset = gaussian() * width;
    if (!secondary) {
      const laneDistance = Math.abs(offset - dustLaneOffset(t));
      if (laneDistance < dustLaneWidth(t) && random() < 0.84) continue;
    }
    const alongJitter = gaussian() * (secondary ? 0.014 : 0.020);
    const x = frame.x + frame.nx * offset + frame.tx * alongJitter;
    const y = frame.y + frame.ny * offset + frame.ty * alongJitter;
    const z = Math.max(-0.94, Math.min(0.92, gaussian() * (secondary ? 0.25 : 0.34) + (random() - 0.5) * 0.12));
    const coreDensity = Math.exp(-Math.pow((t - 0.50) / 0.34, 2));
    const size = 0.50 + Math.pow(random(), 1.45) * (1.15 + coreDensity * 0.28);
    const alpha = (0.045 + Math.pow(random(), 1.35) * 0.20) * (0.82 + coreDensity * 0.24) * (secondary ? 0.72 : 1.0);
    pushStar(x, y, z, pickColor(secondary ? 0.86 : 0.94), size, alpha, random() * 67, 0.34 + random() * 0.82, 1);
    created++;
  }
}

function addMidStars(count) {
  for (let i = 0; i < count; i++) {
    const t = 0.04 + random() * 0.92;
    const secondary = random() < 0.16;
    const frame = pathFrame(secondary ? SECONDARY_PATH : PRIMARY_PATH, t);
    const offset = gaussian() * streamWidth(t, secondary) * 0.86;
    const x = frame.x + frame.nx * offset;
    const y = frame.y + frame.ny * offset;
    const z = -0.30 + random() * 1.12;
    const size = 1.30 + Math.pow(random(), 1.7) * 1.85;
    const alpha = 0.28 + random() * 0.38;
    pushStar(x, y, z, pickColor(0.99), size, alpha, random() * 83, 0.34 + random() * 0.72, 1);
  }
}

function addBrightStars(count) {
  for (let i = 0; i < count; i++) {
    const t = 0.06 + random() * 0.88;
    const secondary = random() < 0.18;
    const frame = pathFrame(secondary ? SECONDARY_PATH : PRIMARY_PATH, t);
    const offset = gaussian() * streamWidth(t, secondary) * 0.70;
    const x = frame.x + frame.nx * offset;
    const y = frame.y + frame.ny * offset;
    const z = -0.05 + random() * 0.98;
    const size = 2.65 + Math.pow(random(), 1.6) * 2.85;
    const alpha = 0.55 + random() * 0.30;
    pushStar(x, y, z, pickColor(1.02), size, alpha, random() * 107, 0.28 + random() * 0.62, 2);
  }
}

const HERO_STARS = [
  { t:.17, offset:-.15, size:6.6, color:[0.98,0.99,1.00] },
  { t:.31, offset: .13, size:5.6, color:[1.00,0.91,0.76] },
  { t:.46, offset:-.17, size:7.7, color:[0.78,0.89,1.00] },
  { t:.58, offset: .09, size:6.2, color:[0.99,0.99,1.00] },
  { t:.72, offset:-.11, size:7.1, color:[1.00,0.91,0.75] },
  { t:.86, offset: .10, size:5.8, color:[0.80,0.90,1.00] },
];
function addHeroStars() {
  HERO_STARS.forEach((star, index) => {
    const frame = pathFrame(PRIMARY_PATH, star.t);
    const x = frame.x + frame.nx * star.offset;
    const y = frame.y + frame.ny * star.offset;
    const z = 0.58 + (index % 3) * 0.10;
    pushStar(x, y, z, star.color, star.size, 0.86 + (index % 2) * 0.06, 23 + index * 11.17, 0.24 + (index % 3) * 0.08, 3);
  });
}

addBackground(2200);
addStream(2200, PRIMARY_PATH, false);
addStream(700, SECONDARY_PATH, true);
addMidStars(320);
addBrightStars(28);
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

const starUniforms = {
  aspect: gl.getUniformLocation(starProgram, 'uAspect'),
  time: gl.getUniformLocation(starProgram, 'uTime'),
  dpr: gl.getUniformLocation(starProgram, 'uDpr'),
  exposure: gl.getUniformLocation(starProgram, 'uExposure'),
  pointerActive: gl.getUniformLocation(starProgram, 'uPointerActive'),
  pointer: gl.getUniformLocation(starProgram, 'uPointer'),
};

const state = {
  dpr: 1, width: 1, height: 1, aspect: 1,
  pointerTarget: [0, 0], pointer: [0, 0],
  pointerActiveTarget: 0, pointerActive: 0,
  startTime: performance.now(), lastFrame: performance.now(),
};

function resize() {
  state.dpr = Math.min(window.devicePixelRatio || 1, 1.45);
  state.width = Math.max(1, Math.round(window.innerWidth * state.dpr));
  state.height = Math.max(1, Math.round(window.innerHeight * state.dpr));
  state.aspect = window.innerWidth / Math.max(window.innerHeight, 1);
  if (canvas.width !== state.width) canvas.width = state.width;
  if (canvas.height !== state.height) canvas.height = state.height;
  gl.viewport(0, 0, state.width, state.height);
}
function onPointerMove(event) {
  state.pointerTarget[0] = (event.clientX / Math.max(window.innerWidth, 1)) * 2 - 1;
  state.pointerTarget[1] = -((event.clientY / Math.max(window.innerHeight, 1)) * 2 - 1);
  state.pointerActiveTarget = 1;
}
function onPointerLeave() { state.pointerActiveTarget = 0; }
function damp(current, target, speed, dt) {
  return current + (target - current) * (1 - Math.exp(-speed * dt));
}
function smoothstep01(value) {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
}

window.addEventListener('resize', resize, { passive: true });
window.addEventListener('pointermove', onPointerMove, { passive: true });
window.addEventListener('pointerleave', onPointerLeave, { passive: true });
window.addEventListener('blur', onPointerLeave, { passive: true });
canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault();
  document.body.classList.remove('webgl-ready');
  document.body.classList.add('webgl-failed');
  if (statusEl) statusEl.textContent = 'WebGL context lost';
});

resize();
document.body.classList.add('webgl-ready');
if (statusEl) statusEl.textContent = `WebGL2 · ${(starCount / 1000).toFixed(1)}k stars · volumetric dust`;

function render(now) {
  const seconds = (now - state.startTime) / 1000;
  const dt = Math.min(0.05, Math.max(0.001, (now - state.lastFrame) / 1000));
  state.lastFrame = now;

  if (reducedMotion) {
    state.pointer[0] = 0;
    state.pointer[1] = 0;
    state.pointerActive = 0;
  } else {
    state.pointer[0] = damp(state.pointer[0], state.pointerTarget[0], 4.2, dt);
    state.pointer[1] = damp(state.pointer[1], state.pointerTarget[1], 4.2, dt);
    state.pointerActive = damp(state.pointerActive, state.pointerActiveTarget, 3.6, dt);
  }

  const exposure = reducedMotion ? 1 : smoothstep01((seconds - 0.04) / 2.25);
  const skyTime = reducedMotion ? 0 : seconds;

  gl.disable(gl.BLEND);
  gl.useProgram(skyProgram);
  gl.uniform2f(skyUniforms.resolution, state.width, state.height);
  gl.uniform1f(skyUniforms.time, skyTime);
  gl.uniform1f(skyUniforms.exposure, exposure);
  gl.uniform2f(skyUniforms.pointer, state.pointer[0], state.pointer[1]);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  gl.enable(gl.BLEND);
  gl.blendEquation(gl.FUNC_ADD);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  gl.useProgram(starProgram);
  gl.bindVertexArray(starVao);
  gl.uniform1f(starUniforms.aspect, state.aspect);
  gl.uniform1f(starUniforms.time, seconds);
  gl.uniform1f(starUniforms.dpr, state.dpr);
  gl.uniform1f(starUniforms.exposure, exposure);
  gl.uniform1f(starUniforms.pointerActive, state.pointerActive);
  gl.uniform2f(starUniforms.pointer, state.pointer[0], state.pointer[1]);
  gl.drawArrays(gl.POINTS, 0, starCount);
  gl.bindVertexArray(null);

  requestAnimationFrame(render);
}
requestAnimationFrame(render);
