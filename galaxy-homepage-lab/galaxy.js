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
  statusEl.textContent = 'WebGL2 unavailable';
  throw new Error('WebGL2 is required for the galaxy composition lab.');
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
uniform float uScroll;
uniform float uDpr;
uniform float uExposure;
uniform float uPointerActive;
uniform vec2 uPointer;

out vec3 vColor;
out float vAlpha;
flat out float vKind;
flat out float vPhase;

mat2 rotate2d(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat2(c, -s, s, c);
}

void main() {
  vec3 p = aPosition;
  float depth = clamp((p.z + 1.0) * 0.5, 0.0, 1.0);
  float scrollEase = uScroll * uScroll * (3.0 - 2.0 * uScroll);

  // The galaxy is a fixed world. Scroll behaves like a restrained camera move,
  // not like a background-position animation.
  p.x += sin(scrollEase * 4.35) * (0.055 + depth * 0.11);
  p.y += (scrollEase - 0.5) * (0.07 + depth * 0.20);

  // Subtle observation parallax. Near stars respond more than the field body.
  float parallax = mix(0.0035, 0.021, depth);
  p.xy += uPointer * parallax;

  // Local dust disturbance: intentionally much weaker than the OpenAI-style
  // global rotation interaction. The field should feel observed, not operated.
  vec2 pointerWorld = vec2(uPointer.x * uAspect, uPointer.y);
  vec2 delta = p.xy - pointerWorld;
  float dist2 = dot(delta, delta);
  float repel = exp(-dist2 * 15.0) * uPointerActive * (0.002 + 0.013 * depth);
  p.xy += normalize(delta + vec2(0.0001)) * repel;

  float angle = -0.017 + scrollEase * 0.072 + uPointer.x * 0.006;
  p.xy = rotate2d(angle) * p.xy;

  // On narrow screens compress the horizontal composition instead of cropping
  // the entire dense stream off-screen.
  float compact = 1.0 - smoothstep(0.78, 1.08, uAspect);
  p.x = mix(p.x, p.x * 0.58 - 0.04, compact);

  gl_Position = vec4(p.x / max(uAspect, 0.62), p.y, 0.0, 1.0);

  float twinkle = 0.94 + 0.06 * sin(uTime * aRate + aPhase);
  float heroBias = step(1.5, aKind) * 0.17 + step(2.5, aKind) * 0.12;
  float sequence = fract(aPhase * 0.173 + aPosition.x * 0.071 + aPosition.y * 0.113);
  float reveal = smoothstep(0.0, 1.0, clamp(uExposure * 1.22 + heroBias - sequence * 0.36, 0.0, 1.0));

  gl_PointSize = max(1.0, aSize * uDpr * twinkle * mix(0.82, 1.22, depth));
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

mat2 rotate2d(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat2(c, -s, s, c);
}

void main() {
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(uv, uv);
  if (r2 > 1.0) discard;

  // Haze particles are deliberately coreless. They supply the milkiness of the
  // galaxy without turning the field into a bright synthetic ribbon.
  if (vKind > 3.5) {
    float haze = exp(-r2 * 3.2) * (1.0 - smoothstep(0.62, 1.0, sqrt(r2)));
    float alpha = vAlpha * haze;
    vec3 hazeColor = vColor * (0.32 + haze * 0.72);
    outColor = vec4(hazeColor, alpha);
    return;
  }

  float core = exp(-r2 * 20.0);
  float halo = exp(-r2 * 5.2);
  float disc = 1.0 - smoothstep(0.58, 1.0, sqrt(r2));

  float bright = step(1.5, vKind);
  float hero = step(2.5, vKind);

  // Bright stars use a soft, irregular photographic streak rather than the
  // symmetric four-point diffraction language used by Astra.
  float angle = fract(vPhase * 0.159) * 6.28318530718;
  vec2 q = rotate2d(angle) * uv;
  float streak = exp(-abs(q.y) * 14.0) * exp(-abs(q.x) * 2.7);
  float offAxis = exp(-dot(uv - vec2(0.10, -0.055), uv - vec2(0.10, -0.055)) * 11.0);

  float normalEnergy = core * 1.20 + halo * 0.28 + disc * 0.24;
  float brightEnergy = core * 1.48 + halo * 0.54 + streak * 0.10;
  float heroEnergy = core * 1.72 + halo * 0.72 + streak * 0.17 + offAxis * 0.045;
  float energy = mix(normalEnergy, brightEnergy, bright);
  energy = mix(energy, heroEnergy, hero);

  float edgeFade = 1.0 - smoothstep(0.72, 1.0, sqrt(r2));
  float alpha = vAlpha * mix(edgeFade, max(edgeFade, halo * 0.58), bright);
  vec3 color = vColor * energy;

  outColor = vec4(color, alpha);
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

function createProgram() {
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(log || 'Program link failed');
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

const random = mulberry32(0x51A7F19D);

function gaussian() {
  const u = Math.max(random(), 1e-7);
  const v = Math.max(random(), 1e-7);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
}

const PALETTE = [
  { limit: 0.68, color: [0.97, 0.975, 1.00] },
  { limit: 0.82, color: [1.00, 0.90, 0.74] },
  { limit: 0.93, color: [0.76, 0.87, 1.00] },
  { limit: 0.98, color: [0.63, 0.73, 0.88] },
  { limit: 1.00, color: [1.00, 0.61, 0.55] },
];

function pickColor(scale = 1) {
  const value = random();
  const entry = PALETTE.find(item => value <= item.limit) || PALETTE[0];
  const temperatureNoise = 0.955 + random() * 0.09;
  return entry.color.map(channel => Math.min(1, channel * temperatureNoise * scale));
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
    0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * u + (2*p0[0] - 5*p1[0] + 4*p2[0] - p3[0]) * u2 + (-p0[0] + 3*p1[0] - 3*p2[0] + p3[0]) * u3),
    0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * u + (2*p0[1] - 5*p1[1] + 4*p2[1] - p3[1]) * u2 + (-p0[1] + 3*p1[1] - 3*p2[1] + p3[1]) * u3),
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
    const size = rare > 0.985 ? 1.65 + random() * 1.20 : 0.46 + random() * 0.82;
    const alpha = rare > 0.985 ? 0.26 + random() * 0.24 : 0.045 + random() * 0.15;
    pushStar(x, y, z, pickColor(0.86), size, alpha, random() * 39, 0.45 + random() * 0.90, 0);
  }
}

function streamWidth(t, secondary = false) {
  const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 4.6 + 0.9);
  const body = secondary ? 0.055 : 0.082;
  const swell = secondary ? 0.055 : 0.105;
  return body + pulse * swell;
}

function dustLaneOffset(t) {
  return -0.018 + Math.sin(t * 8.4 + 0.6) * 0.025;
}

function dustLaneWidth(t) {
  return 0.020 + (0.5 + 0.5 * Math.sin(t * 5.8 + 2.1)) * 0.016;
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
    const z = Math.max(-0.88, Math.min(0.92, gaussian() * (secondary ? 0.26 : 0.34) + (random() - 0.5) * 0.15));

    const densityCenter = Math.exp(-Math.pow((t - 0.52) / 0.34, 2));
    const size = 0.58 + random() * (1.12 + densityCenter * 0.42);
    const alpha = (0.075 + random() * 0.27) * (0.78 + densityCenter * 0.28) * (secondary ? 0.80 : 1);
    const color = pickColor(secondary ? 0.84 : 0.92);

    pushStar(x, y, z, color, size, alpha, random() * 57, 0.55 + random() * 1.25, 1);
    created++;
  }
}

function addHaze(count) {
  for (let i = 0; i < count; i++) {
    const t = random();
    const frame = pathFrame(PRIMARY_PATH, t);
    const offset = gaussian() * (streamWidth(t, false) * 1.28);
    const x = frame.x + frame.nx * offset + gaussian() * 0.025;
    const y = frame.y + frame.ny * offset + gaussian() * 0.025;
    const z = -0.55 + random() * 0.52;
    const cool = random() < 0.72;
    const color = cool ? [0.66, 0.73, 0.85] : [0.82, 0.76, 0.70];
    const size = 7.0 + random() * 15.0;
    const alpha = 0.010 + random() * 0.025;
    pushStar(x, y, z, color, size, alpha, random() * 21, 0.20 + random() * 0.24, 4);
  }
}

function addMidStars(count) {
  for (let i = 0; i < count; i++) {
    const t = 0.04 + random() * 0.92;
    const frame = pathFrame(PRIMARY_PATH, t);
    const offset = gaussian() * (streamWidth(t, false) * 0.86);
    const x = frame.x + frame.nx * offset;
    const y = frame.y + frame.ny * offset;
    const z = -0.35 + random() * 1.10;
    const size = 1.35 + Math.pow(random(), 2.1) * 1.75;
    const alpha = 0.30 + random() * 0.46;
    pushStar(x, y, z, pickColor(1.00), size, alpha, random() * 73, 0.58 + random() * 1.15, 1);
  }
}

function addBrightStars(count) {
  for (let i = 0; i < count; i++) {
    const t = 0.05 + random() * 0.90;
    const frame = pathFrame(random() < 0.78 ? PRIMARY_PATH : SECONDARY_PATH, t);
    const width = streamWidth(t, false);
    const offset = gaussian() * width * 0.78;
    const x = frame.x + frame.nx * offset;
    const y = frame.y + frame.ny * offset;
    const z = -0.12 + random() * 1.00;
    const size = 2.8 + Math.pow(random(), 1.6) * 3.2;
    const alpha = 0.58 + random() * 0.34;
    pushStar(x, y, z, pickColor(1.04), size, alpha, random() * 91, 0.48 + random() * 0.95, 2);
  }
}

const HERO_STARS = [
  { t: .18, offset: -.072, size: 7.6, color: [0.96, 0.98, 1.00] },
  { t: .31, offset:  .098, size: 5.8, color: [1.00, 0.90, 0.73] },
  { t: .42, offset: -.115, size: 8.8, color: [0.76, 0.88, 1.00] },
  { t: .53, offset:  .055, size: 6.5, color: [0.98, 0.98, 1.00] },
  { t: .61, offset: -.083, size: 9.4, color: [1.00, 0.89, 0.70] },
  { t: .70, offset:  .092, size: 6.9, color: [0.78, 0.88, 1.00] },
  { t: .79, offset: -.048, size: 7.9, color: [0.98, 0.99, 1.00] },
  { t: .88, offset:  .061, size: 5.9, color: [1.00, 0.93, 0.80] },
];

function addHeroStars() {
  HERO_STARS.forEach((star, index) => {
    const frame = pathFrame(PRIMARY_PATH, star.t);
    const x = frame.x + frame.nx * star.offset;
    const y = frame.y + frame.ny * star.offset;
    const z = 0.58 + (index % 3) * 0.09;
    pushStar(x, y, z, star.color, star.size, 0.88 + (index % 2) * 0.08, 17 + index * 8.31, 0.42 + (index % 4) * 0.11, 3);
  });
}

addBackground(5000);
addStream(4300, PRIMARY_PATH, false);
addStream(1450, SECONDARY_PATH, true);
addHaze(620);
addMidStars(650);
addBrightStars(52);
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
  scroll: gl.getUniformLocation(program, 'uScroll'),
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
  pointerTarget: [0, 0],
  pointer: [0, 0],
  pointerActiveTarget: 0,
  pointerActive: 0,
  scrollTarget: 0,
  scroll: 0,
  startTime: performance.now(),
  frame: 0,
};

function resize() {
  state.dpr = Math.min(window.devicePixelRatio || 1, 1.85);
  state.width = Math.max(1, Math.round(window.innerWidth * state.dpr));
  state.height = Math.max(1, Math.round(window.innerHeight * state.dpr));
  state.aspect = window.innerWidth / Math.max(window.innerHeight, 1);

  if (canvas.width !== state.width) canvas.width = state.width;
  if (canvas.height !== state.height) canvas.height = state.height;
  gl.viewport(0, 0, state.width, state.height);
}

function updateScrollTarget() {
  const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  state.scrollTarget = Math.max(0, Math.min(1, window.scrollY / max));
}

function onPointerMove(event) {
  state.pointerTarget[0] = (event.clientX / Math.max(window.innerWidth, 1)) * 2 - 1;
  state.pointerTarget[1] = -((event.clientY / Math.max(window.innerHeight, 1)) * 2 - 1);
  state.pointerActiveTarget = 1;
}

function onPointerLeave() {
  state.pointerActiveTarget = 0;
}

window.addEventListener('resize', resize, { passive: true });
window.addEventListener('scroll', updateScrollTarget, { passive: true });
window.addEventListener('pointermove', onPointerMove, { passive: true });
window.addEventListener('pointerleave', onPointerLeave, { passive: true });
window.addEventListener('blur', onPointerLeave, { passive: true });

canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault();
  document.body.classList.remove('webgl-ready');
  document.body.classList.add('webgl-failed');
  statusEl.textContent = 'WebGL context lost';
});

resize();
updateScrollTarget();

gl.useProgram(program);
gl.disable(gl.DEPTH_TEST);
gl.enable(gl.BLEND);
gl.blendEquation(gl.FUNC_ADD);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
gl.clearColor(0.003, 0.006, 0.012, 1);

document.body.classList.add('webgl-ready');
statusEl.textContent = `WebGL2 · ${(starCount / 1000).toFixed(1)}k stars`;

function damp(current, target, speed, dt) {
  const factor = 1 - Math.exp(-speed * dt);
  return current + (target - current) * factor;
}

function easeInOut(value) {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
}

function render(now) {
  const seconds = (now - state.startTime) / 1000;
  const dt = Math.min(0.05, Math.max(0.001, state.frame ? (now - state.frame) / 1000 : 0.016));
  state.frame = now;

  const pointerSpeed = reducedMotion ? 0 : 5.2;
  if (reducedMotion) {
    state.pointer[0] = 0;
    state.pointer[1] = 0;
    state.pointerActive = 0;
    state.scroll = state.scrollTarget;
  } else {
    state.pointer[0] = damp(state.pointer[0], state.pointerTarget[0], pointerSpeed, dt);
    state.pointer[1] = damp(state.pointer[1], state.pointerTarget[1], pointerSpeed, dt);
    state.pointerActive = damp(state.pointerActive, state.pointerActiveTarget, 4.4, dt);
    state.scroll = damp(state.scroll, state.scrollTarget, 3.2, dt);
  }

  const exposure = reducedMotion ? 1 : easeInOut(Math.max(0, Math.min(1, (seconds - 0.10) / 2.45)));

  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(program);
  gl.bindVertexArray(vao);

  gl.uniform1f(uniforms.aspect, state.aspect);
  gl.uniform1f(uniforms.time, seconds);
  gl.uniform1f(uniforms.scroll, state.scroll);
  gl.uniform1f(uniforms.dpr, state.dpr);
  gl.uniform1f(uniforms.exposure, exposure);
  gl.uniform1f(uniforms.pointerActive, state.pointerActive);
  gl.uniform2f(uniforms.pointer, state.pointer[0], state.pointer[1]);

  gl.drawArrays(gl.POINTS, 0, starCount);
  gl.bindVertexArray(null);

  requestAnimationFrame(render);
}

requestAnimationFrame(render);
