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

const VERTEX_SHADER = `#version 300 es
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

  // A fixed scene with only observational parallax. The galaxy itself is not
  // rotated or scrolled around by the user.
  float parallax = mix(0.0018, 0.017, depth);
  p.xy += uPointer * parallax;

  // Very slow natural drift so the sky never feels like a static texture.
  p.x += sin(uTime * 0.045 + aPhase * 0.071) * (0.0015 + depth * 0.0038);
  p.y += cos(uTime * 0.038 + aPhase * 0.053) * (0.0012 + depth * 0.0030);

  // Weak local disturbance around the pointer. It is deliberately subtle and
  // affects near particles more than the distant field.
  vec2 pointerWorld = vec2(uPointer.x * uAspect, uPointer.y);
  vec2 delta = p.xy - pointerWorld;
  float dist2 = dot(delta, delta);
  float repel = exp(-dist2 * 12.0) * uPointerActive * (0.001 + depth * 0.0065);
  p.xy += normalize(delta + vec2(0.0001)) * repel;

  // Keep the authored right-biased stream visible on narrow displays.
  float compact = 1.0 - smoothstep(0.82, 1.08, uAspect);
  p.x = mix(p.x, p.x * 0.61 - 0.02, compact);

  gl_Position = vec4(p.x / max(uAspect, 0.62), p.y, 0.0, 1.0);

  float twinkleAmount = mix(0.025, 0.075, step(1.5, aKind));
  float twinkle = 1.0 - twinkleAmount + twinkleAmount * sin(uTime * aRate + aPhase);
  float depthScale = mix(0.84, 1.24, depth);
  gl_PointSize = max(1.15, aSize * uDpr * twinkle * depthScale);

  // Exposure reveal is weighted so the brightest stars arrive first, like a
  // long-exposure image gradually appearing from darkness.
  float heroBias = step(1.5, aKind) * 0.17 + step(2.5, aKind) * 0.16;
  float sequence = fract(aPhase * 0.173 + aPosition.x * 0.091 + aPosition.y * 0.137);
  float reveal = smoothstep(0.0, 1.0, clamp(uExposure * 1.28 + heroBias - sequence * 0.30, 0.0, 1.0));

  vColor = aColor;
  vAlpha = aAlpha * reveal;
  vKind = aKind;
  vPhase = aPhase;
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec3 vColor;
in float vAlpha;
flat in float vKind;
flat in float vPhase;

out vec4 outColor;

mat2 rotate2d(float a) {
  float s = sin(a);
  float c = cos(a);
  return mat2(c, -s, s, c);
}

void main() {
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float r = length(uv);
  if (r > 1.0) discard;

  // Large coreless particles build the milkiness of the band without turning
  // it into a synthetic neon ribbon.
  if (vKind > 3.5) {
    float cloud = exp(-r * r * 2.85) * (1.0 - smoothstep(0.64, 1.0, r));
    float coreLift = exp(-r * r * 8.0) * 0.10;
    vec3 color = vColor * (0.34 + cloud * 0.88 + coreLift);
    outColor = vec4(color, vAlpha * cloud);
    return;
  }

  float structured = step(0.5, vKind);
  float bright = step(1.5, vKind);
  float hero = step(2.5, vKind);

  float core = exp(-r * r * mix(30.0, 38.0, bright));
  float halo = exp(-r * r * mix(6.8, 4.9, bright));
  float disc = 1.0 - smoothstep(0.58, 1.0, r);

  // Only bright stars receive a faint, randomly oriented photographic streak.
  // It is asymmetric and much less graphic than a four-point diffraction star.
  float angle = fract(vPhase * 0.159) * 6.28318530718;
  vec2 q = rotate2d(angle) * uv;
  float streak = exp(-abs(q.y) * 16.0) * exp(-abs(q.x) * 2.9);
  float secondaryGlow = exp(-dot(uv - vec2(0.075, -0.04), uv - vec2(0.075, -0.04)) * 13.0);

  float baseEnergy = core * 1.34 + halo * (0.23 + structured * 0.10) + disc * 0.24;
  float brightEnergy = core * 1.72 + halo * 0.64 + streak * 0.11;
  float heroEnergy = core * 2.05 + halo * 0.88 + streak * 0.17 + secondaryGlow * 0.055;
  float energy = mix(baseEnergy, brightEnergy, bright);
  energy = mix(energy, heroEnergy, hero);

  float edgeFade = 1.0 - smoothstep(0.73, 1.0, r);
  float alphaShape = mix(edgeFade, max(edgeFade, halo * 0.62), bright);
  vec3 color = vColor * energy;

  outColor = vec4(color, vAlpha * alphaShape);
}
`;

function compile(type, source) {
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

function createProgram() {
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || 'Program link failed';
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
}

const program = createProgram();
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

const random = mulberry32(0x63BDF019);

function gaussian() {
  const u = Math.max(random(), 1e-7);
  const v = Math.max(random(), 1e-7);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
}

const PALETTE = [
  { limit: 0.68, color: [0.98, 0.985, 1.00] },
  { limit: 0.82, color: [1.00, 0.91, 0.76] },
  { limit: 0.93, color: [0.77, 0.88, 1.00] },
  { limit: 0.98, color: [0.66, 0.76, 0.91] },
  { limit: 1.00, color: [1.00, 0.67, 0.59] },
];

function pickColor(scale = 1) {
  const value = random();
  const entry = PALETTE.find(item => value <= item.limit) || PALETTE[0];
  const temperatureNoise = 0.965 + random() * 0.07;
  return entry.color.map(channel => Math.min(1, channel * temperatureNoise * scale));
}

const PRIMARY_PATH = [
  [-0.58, -1.28],
  [-0.26, -1.02],
  [ 0.06, -0.78],
  [ 0.31, -0.53],
  [ 0.53, -0.27],
  [ 0.69,  0.00],
  [ 0.82,  0.28],
  [ 0.96,  0.55],
  [ 1.18,  0.82],
  [ 1.47,  1.17],
];

const SECONDARY_PATH = [
  [-0.18, -1.28],
  [ 0.08, -1.00],
  [ 0.28, -0.72],
  [ 0.48, -0.47],
  [ 0.71, -0.21],
  [ 0.91,  0.09],
  [ 1.06,  0.40],
  [ 1.20,  0.71],
  [ 1.49,  1.13],
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
  const wave = 0.5 + 0.5 * Math.sin(t * Math.PI * 4.15 + 0.72);
  const localBulge = Math.exp(-Math.pow((t - 0.53) / 0.22, 2));
  const base = secondary ? 0.068 : 0.108;
  const variable = secondary ? 0.058 : 0.105;
  return base + wave * variable + localBulge * (secondary ? 0.018 : 0.052);
}

function dustLaneOffset(t) {
  return -0.022 + Math.sin(t * 8.1 + 0.35) * 0.031;
}

function dustLaneWidth(t) {
  return 0.022 + (0.5 + 0.5 * Math.sin(t * 5.4 + 2.0)) * 0.022;
}

function addBackground(count) {
  for (let i = 0; i < count; i++) {
    const x = -2.25 + random() * 4.50;
    const y = -1.22 + random() * 2.44;
    const z = -0.96 + random() * 1.92;
    const rare = random();
    const size = rare > 0.982 ? 1.7 + random() * 1.35 : 0.72 + random() * 0.90;
    const alpha = rare > 0.982 ? 0.32 + random() * 0.32 : 0.065 + random() * 0.16;
    pushStar(x, y, z, pickColor(0.90), size, alpha, random() * 41, 0.35 + random() * 0.82, 0);
  }
}

function addStream(count, points, secondary = false) {
  let created = 0;
  let guard = 0;
  while (created < count && guard < count * 14) {
    guard++;
    const t = Math.pow(random(), secondary ? 1.02 : 0.94);
    const frame = pathFrame(points, t);
    const width = streamWidth(t, secondary);
    const offset = gaussian() * width;

    if (!secondary) {
      const laneDistance = Math.abs(offset - dustLaneOffset(t));
      if (laneDistance < dustLaneWidth(t) && random() < 0.76) continue;
    }

    const along = gaussian() * (secondary ? 0.012 : 0.016);
    const x = frame.x + frame.nx * offset + frame.tx * along;
    const y = frame.y + frame.ny * offset + frame.ty * along;
    const z = Math.max(-0.90, Math.min(0.94, gaussian() * (secondary ? 0.25 : 0.35) + (random() - 0.5) * 0.15));
    const densityCenter = Math.exp(-Math.pow((t - 0.52) / 0.32, 2));
    const size = 0.86 + random() * (1.28 + densityCenter * 0.50);
    const alpha = (0.135 + random() * 0.37) * (0.82 + densityCenter * 0.28) * (secondary ? 0.80 : 1.0);
    pushStar(x, y, z, pickColor(secondary ? 0.88 : 0.96), size, alpha, random() * 61, 0.42 + random() * 1.02, 1);
    created++;
  }
}

function addHaze(count) {
  for (let i = 0; i < count; i++) {
    const secondary = random() < 0.20;
    const points = secondary ? SECONDARY_PATH : PRIMARY_PATH;
    const t = random();
    const frame = pathFrame(points, t);
    const width = streamWidth(t, secondary) * (1.05 + random() * 0.55);
    const offset = gaussian() * width;
    const x = frame.x + frame.nx * offset + gaussian() * 0.020;
    const y = frame.y + frame.ny * offset + gaussian() * 0.020;
    const z = -0.62 + random() * 0.56;
    const warm = random() < 0.23;
    const color = warm ? [0.82,0.73,0.66] : [0.64,0.73,0.87];
    const size = 11 + random() * 19;
    const alpha = 0.025 + random() * 0.048;
    pushStar(x, y, z, color, size, alpha, random() * 23, 0.16 + random() * 0.22, 4);
  }
}

function addMidStars(count) {
  for (let i = 0; i < count; i++) {
    const t = 0.035 + random() * 0.93;
    const frame = pathFrame(PRIMARY_PATH, t);
    const offset = gaussian() * streamWidth(t, false) * 0.84;
    const x = frame.x + frame.nx * offset;
    const y = frame.y + frame.ny * offset;
    const z = -0.32 + random() * 1.15;
    const size = 1.85 + Math.pow(random(), 1.85) * 2.30;
    const alpha = 0.40 + random() * 0.46;
    pushStar(x, y, z, pickColor(1.02), size, alpha, random() * 77, 0.42 + random() * 0.88, 1);
  }
}

function addBrightStars(count) {
  for (let i = 0; i < count; i++) {
    const t = 0.045 + random() * 0.90;
    const secondary = random() < 0.20;
    const frame = pathFrame(secondary ? SECONDARY_PATH : PRIMARY_PATH, t);
    const offset = gaussian() * streamWidth(t, secondary) * 0.72;
    const x = frame.x + frame.nx * offset;
    const y = frame.y + frame.ny * offset;
    const z = -0.08 + random() * 1.02;
    const size = 3.8 + Math.pow(random(), 1.55) * 4.0;
    const alpha = 0.66 + random() * 0.30;
    pushStar(x, y, z, pickColor(1.05), size, alpha, random() * 101, 0.36 + random() * 0.72, 2);
  }
}

const HERO_STARS = [
  { t:.13, offset:-.092, size:8.8, color:[0.98,0.99,1.00] },
  { t:.22, offset: .126, size:7.1, color:[1.00,0.91,0.76] },
  { t:.32, offset:-.138, size:10.2, color:[0.77,0.89,1.00] },
  { t:.42, offset: .078, size:8.3, color:[0.98,0.99,1.00] },
  { t:.51, offset:-.118, size:11.1, color:[1.00,0.90,0.73] },
  { t:.60, offset: .112, size:8.6, color:[0.78,0.89,1.00] },
  { t:.69, offset:-.084, size:10.4, color:[0.99,0.99,1.00] },
  { t:.77, offset: .096, size:7.8, color:[1.00,0.93,0.81] },
  { t:.85, offset:-.056, size:9.0, color:[0.80,0.90,1.00] },
  { t:.91, offset: .074, size:7.0, color:[1.00,0.94,0.82] },
];

function addHeroStars() {
  HERO_STARS.forEach((star, index) => {
    const frame = pathFrame(PRIMARY_PATH, star.t);
    const x = frame.x + frame.nx * star.offset;
    const y = frame.y + frame.ny * star.offset;
    const z = 0.56 + (index % 4) * 0.08;
    pushStar(x, y, z, star.color, star.size, 0.91 + (index % 2) * 0.05, 19 + index * 8.73, 0.28 + (index % 4) * 0.09, 3);
  });
}

addBackground(4600);
addStream(5600, PRIMARY_PATH, false);
addStream(1900, SECONDARY_PATH, true);
addHaze(720);
addMidStars(900);
addBrightStars(78);
addHeroStars();

const starData = new Float32Array(stars);
const starCount = starData.length / STRIDE;
const buffer = gl.createBuffer();
const vao = gl.createVertexArray();

gl.bindVertexArray(vao);
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, starData, gl.STATIC_DRAW);

function bindAttribute(name, size, offsetFloats) {
  const location = gl.getAttribLocation(program, name);
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

const uniforms = {
  aspect: gl.getUniformLocation(program, 'uAspect'),
  time: gl.getUniformLocation(program, 'uTime'),
  dpr: gl.getUniformLocation(program, 'uDpr'),
  exposure: gl.getUniformLocation(program, 'uExposure'),
  pointerActive: gl.getUniformLocation(program, 'uPointerActive'),
  pointer: gl.getUniformLocation(program, 'uPointer'),
};

const state = {
  dpr: 1,
  width: 1,
  height: 1,
  aspect: 1,
  pointerTarget: [0,0],
  pointer: [0,0],
  pointerActiveTarget: 0,
  pointerActive: 0,
  startTime: performance.now(),
  lastFrame: performance.now(),
};

function resize() {
  state.dpr = Math.min(window.devicePixelRatio || 1, 1.85);
  state.width = Math.max(1, Math.round(window.innerWidth * state.dpr));
  state.height = Math.max(1, Math.round(window.innerHeight * state.dpr));
  state.aspect = window.innerWidth / Math.max(window.innerHeight, 1);
  if (canvas.width !== state.width) canvas.width = state.width;
  if (canvas.height !== state.height) canvas.height = state.height;
  gl.viewport(0,0,state.width,state.height);
}

function onPointerMove(event) {
  state.pointerTarget[0] = (event.clientX / Math.max(window.innerWidth,1)) * 2 - 1;
  state.pointerTarget[1] = -((event.clientY / Math.max(window.innerHeight,1)) * 2 - 1);
  state.pointerActiveTarget = 1;
}

function onPointerLeave() {
  state.pointerActiveTarget = 0;
}

function damp(current, target, speed, dt) {
  return current + (target - current) * (1 - Math.exp(-speed * dt));
}

function smoothstep01(value) {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
}

window.addEventListener('resize', resize, { passive:true });
window.addEventListener('pointermove', onPointerMove, { passive:true });
window.addEventListener('pointerleave', onPointerLeave, { passive:true });
window.addEventListener('blur', onPointerLeave, { passive:true });

canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault();
  document.body.classList.remove('webgl-ready');
  document.body.classList.add('webgl-failed');
  if (statusEl) statusEl.textContent = 'WebGL context lost';
});

resize();
gl.useProgram(program);
gl.disable(gl.DEPTH_TEST);
gl.enable(gl.BLEND);
gl.blendEquation(gl.FUNC_ADD);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
gl.clearColor(0.002,0.004,0.008,1);

document.body.classList.add('webgl-ready');
if (statusEl) statusEl.textContent = `WebGL2 · ${(starCount/1000).toFixed(1)}k stars`;

function render(now) {
  const seconds = (now - state.startTime) / 1000;
  const dt = Math.min(0.05, Math.max(0.001, (now - state.lastFrame) / 1000));
  state.lastFrame = now;

  if (reducedMotion) {
    state.pointer[0] = 0;
    state.pointer[1] = 0;
    state.pointerActive = 0;
  } else {
    state.pointer[0] = damp(state.pointer[0], state.pointerTarget[0], 4.6, dt);
    state.pointer[1] = damp(state.pointer[1], state.pointerTarget[1], 4.6, dt);
    state.pointerActive = damp(state.pointerActive, state.pointerActiveTarget, 3.8, dt);
  }

  const exposure = reducedMotion ? 1 : smoothstep01((seconds - 0.06) / 2.05);

  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(program);
  gl.bindVertexArray(vao);
  gl.uniform1f(uniforms.aspect, state.aspect);
  gl.uniform1f(uniforms.time, seconds);
  gl.uniform1f(uniforms.dpr, state.dpr);
  gl.uniform1f(uniforms.exposure, exposure);
  gl.uniform1f(uniforms.pointerActive, state.pointerActive);
  gl.uniform2f(uniforms.pointer, state.pointer[0], state.pointer[1]);
  gl.drawArrays(gl.POINTS, 0, starCount);
  gl.bindVertexArray(null);
  requestAnimationFrame(render);
}

requestAnimationFrame(render);
