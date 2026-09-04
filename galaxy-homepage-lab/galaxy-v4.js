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

if (!gl) throw new Error('WebGL2 is required for the galaxy study.');

const extColorBufferFloat = gl.getExtension('EXT_color_buffer_float');
gl.getExtension('OES_texture_float_linear');

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
}`;

const GALAXY_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
uniform vec2 uResolution;
uniform float uExposure;
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
  float v = 0.0;
  float a = 0.52;
  mat2 m = mat2(1.63, 1.17, -1.17, 1.63);
  for (int i = 0; i < 6; i++) {
    v += a * noise2(p);
    p = m * p + 7.17;
    a *= 0.50;
  }
  return v;
}

float ridge(vec2 p) {
  float n = fbm(p);
  return 1.0 - abs(n * 2.0 - 1.0);
}

float gaussian(float x, float sigma) {
  return exp(-(x * x) / max(2.0 * sigma * sigma, 1e-5));
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 p = (frag - 0.5 * uResolution) / max(uResolution.y, 1.0);

  float ang = -0.94;
  mat2 R = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
  vec2 q = R * (p - vec2(0.18, -0.02));

  float warpA = fbm(q * 1.14 + vec2(3.7, -1.9));
  float warpB = fbm(q * 2.05 + vec2(-5.1, 4.4));
  q.y += (warpA - 0.5) * 0.25;
  q.x += (warpB - 0.5) * 0.08;

  float bend = 0.10 * sin(q.x * 2.45 + 0.45) + 0.035 * sin(q.x * 7.1 - 1.7);
  float cross = q.y - bend;
  float ax = q.x;

  float width = 0.22 + 0.08 * fbm(vec2(ax * 1.25, 2.4))
                   + 0.055 * gaussian(ax - 0.05, 0.62);
  float envelope = exp(-pow(abs(cross) / max(width, 0.05), 1.42));
  envelope *= smoothstep(-1.28, -0.98, ax) * (1.0 - smoothstep(1.18, 1.48, ax));

  float macro = fbm(q * vec2(1.55, 1.10) + vec2(8.1, 2.6));
  float meso = fbm(q * vec2(4.2, 2.9) + vec2(-2.4, 7.8));
  float fine = ridge(q * vec2(10.5, 6.4) + vec2(1.3, -3.7));
  float clump = smoothstep(0.38, 0.86, macro * 0.72 + meso * 0.38);

  float knotA = gaussian(ax + 0.42, 0.28) * gaussian(cross - 0.025, 0.15);
  float knotB = gaussian(ax - 0.10, 0.33) * gaussian(cross + 0.02, 0.18);
  float knotC = gaussian(ax - 0.58, 0.24) * gaussian(cross - 0.05, 0.14);
  float largeMass = max(max(knotA * 0.82, knotB), knotC * 0.74);

  float laneWarp = (fbm(q * 3.1 + vec2(12.7, -4.8)) - 0.5) * 0.085;
  float lane1 = exp(-pow(abs(cross - 0.015 - laneWarp) / 0.040, 1.55));
  float lane2Center = -0.105 + 0.055 * sin(ax * 3.3 + 1.2);
  float lane2 = exp(-pow(abs(cross - lane2Center + laneWarp * 0.55) / 0.052, 1.7));
  float holes = smoothstep(0.61, 0.88, fbm(q * 5.7 + vec2(-8.0, 13.4)));
  float extinction = clamp(lane1 * 0.82 + lane2 * 0.47 + holes * envelope * 0.24, 0.0, 0.93);

  float filaments = smoothstep(0.63, 0.96, fine) * smoothstep(0.28, 0.85, meso);
  float density = envelope * (0.08 + clump * 0.55 + largeMass * 0.58 + filaments * 0.12);
  density *= (1.0 - extinction);

  float coreGlow = envelope * gaussian(cross, 0.105) * (0.28 + largeMass * 0.82);
  float coolVeil = envelope * smoothstep(0.42, 0.78, fbm(q * 2.6 + 21.3)) * 0.17;
  float warmDust = envelope * smoothstep(0.50, 0.84, macro) * (0.12 + knotB * 0.18);
  warmDust *= (1.0 - extinction * 0.82);

  vec3 neutral = vec3(0.56, 0.60, 0.65);
  vec3 cool = vec3(0.29, 0.39, 0.52);
  vec3 warm = vec3(0.54, 0.37, 0.26);

  vec3 galaxy = neutral * density * 0.58;
  galaxy += neutral * coreGlow * 0.34;
  galaxy += cool * coolVeil * 0.36;
  galaxy += warm * warmDust * 0.31;

  vec2 cell = floor(frag * 0.63);
  float grainSeed = hash21(cell);
  float grain = smoothstep(0.987, 1.0, grainSeed) * envelope;
  grain *= (0.15 + 0.85 * clump) * (1.0 - extinction);
  galaxy += mix(vec3(0.62, 0.69, 0.78), vec3(0.88, 0.78, 0.63), hash21(cell + 7.0)) * grain * 0.42;

  float radial = length(p * vec2(0.72, 1.0));
  vec3 sky = vec3(0.0015, 0.0023, 0.0040);
  sky += vec3(0.004, 0.006, 0.010) * (1.0 - smoothstep(0.12, 1.18, radial));

  vec3 color = sky + galaxy * uExposure;
  outColor = vec4(color, 1.0);
}`;

const STAR_VERTEX = `#version 300 es
precision highp float;
in vec3 aPosition;
in vec3 aColor;
in float aSize;
in float aIntensity;
in float aKind;
uniform float uAspect;
uniform float uDpr;
uniform float uExposure;
out vec3 vColor;
out float vIntensity;
flat out float vKind;
void main() {
  vec3 p = aPosition;
  gl_Position = vec4(p.x / max(uAspect, 0.62), p.y, 0.0, 1.0);
  float depth = clamp((p.z + 1.0) * 0.5, 0.0, 1.0);
  gl_PointSize = max(1.0, aSize * uDpr * mix(0.82, 1.16, depth));
  vColor = aColor;
  vIntensity = aIntensity * uExposure;
  vKind = aKind;
}`;

const STAR_FRAGMENT = `#version 300 es
precision highp float;
in vec3 vColor;
in float vIntensity;
flat in float vKind;
out vec4 outColor;
void main() {
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(uv, uv);
  if (r2 > 1.0) discard;
  float bright = step(1.5, vKind);
  float hero = step(2.5, vKind);
  float core = exp(-r2 * mix(30.0, 44.0, bright));
  float halo = exp(-r2 * mix(8.0, 4.4, bright));
  float energy = core * (1.00 + bright * 1.45 + hero * 0.85)
               + halo * (0.11 + bright * 0.48 + hero * 0.22);
  float alpha = (1.0 - smoothstep(0.58, 1.0, sqrt(r2))) * vIntensity;
  vec3 color = vColor * energy * vIntensity;
  outColor = vec4(color, alpha);
}`;

const BLOOM_EXTRACT_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSource;
out vec4 outColor;
void main() {
  vec3 c = texture(uSource, vUv).rgb;
  float l = max(max(c.r, c.g), c.b);
  float knee = smoothstep(0.56, 1.35, l);
  outColor = vec4(c * knee, 1.0);
}`;

const BLUR_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSource;
uniform vec2 uTexel;
uniform vec2 uDirection;
out vec4 outColor;
void main() {
  vec2 s = uTexel * uDirection;
  vec3 c = texture(uSource, vUv).rgb * 0.2270270270;
  c += texture(uSource, vUv + s * 1.3846153846).rgb * 0.3162162162;
  c += texture(uSource, vUv - s * 1.3846153846).rgb * 0.3162162162;
  c += texture(uSource, vUv + s * 3.2307692308).rgb * 0.0702702703;
  c += texture(uSource, vUv - s * 3.2307692308).rgb * 0.0702702703;
  outColor = vec4(c, 1.0);
}`;

const COMPOSITE_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform vec2 uResolution;
out vec4 outColor;

vec3 aces(vec3 x) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec3 scene = texture(uScene, vUv).rgb;
  vec3 bloom = texture(uBloom, vUv).rgb;
  vec3 color = scene + bloom * 0.72;

  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) / max(uResolution.y, 1.0);
  float vig = smoothstep(1.05, 0.12, length(p * vec2(0.72, 1.0)));
  color *= mix(0.72, 1.0, vig);

  color = aces(color * 1.20);
  color = pow(color, vec3(1.0 / 2.2));

  float dither = (hash21(gl_FragCoord.xy) - 0.5) / 255.0;
  color += dither * 0.28;
  outColor = vec4(color, 1.0);
}`;

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

function program(vertex, fragment) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, vertex));
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(p) || 'Program link failed';
    gl.deleteProgram(p);
    throw new Error(message);
  }
  return p;
}

const galaxyProgram = program(FULLSCREEN_VERTEX, GALAXY_FRAGMENT);
const starProgram = program(STAR_VERTEX, STAR_FRAGMENT);
const extractProgram = program(FULLSCREEN_VERTEX, BLOOM_EXTRACT_FRAGMENT);
const blurProgram = program(FULLSCREEN_VERTEX, BLUR_FRAGMENT);
const compositeProgram = program(FULLSCREEN_VERTEX, COMPOSITE_FRAGMENT);

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(0xA57A41D3);
function gaussian() {
  const u = Math.max(random(), 1e-7);
  const v = Math.max(random(), 1e-7);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
}

const STAR_PATH = [
  [-0.76, -1.18], [-0.48, -0.92], [-0.20, -0.66], [0.05, -0.42],
  [0.24, -0.18], [0.38, 0.06], [0.51, 0.30], [0.67, 0.54],
  [0.87, 0.79], [1.11, 1.06]
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

function frameAt(t) {
  const p = catmullRom(STAR_PATH, t);
  const a = catmullRom(STAR_PATH, Math.max(0, t - 0.003));
  const b = catmullRom(STAR_PATH, Math.min(0.9999, t + 0.003));
  let tx = b[0] - a[0];
  let ty = b[1] - a[1];
  const len = Math.max(Math.hypot(tx, ty), 1e-6);
  tx /= len;
  ty /= len;
  return { x: p[0], y: p[1], tx, ty, nx: -ty, ny: tx };
}

const palette = [
  [0.93, 0.95, 1.00], [0.78, 0.86, 1.00], [1.00, 0.91, 0.75], [0.88, 0.90, 0.94]
];

function pickColor() {
  const r = random();
  if (r < 0.71) return palette[0];
  if (r < 0.83) return palette[3];
  if (r < 0.93) return palette[1];
  return palette[2];
}

const starFloats = [];
function pushStar(x, y, z, color, size, intensity, kind) {
  starFloats.push(x, y, z, color[0], color[1], color[2], size, intensity, kind);
}

for (let i = 0; i < 2500; i++) {
  const x = -2.35 + random() * 4.70;
  const y = -1.28 + random() * 2.56;
  const z = -0.98 + random() * 1.90;
  const rare = random() > 0.992;
  const size = rare ? 1.75 + random() * 1.10 : 0.52 + random() * 0.78;
  const intensity = rare ? 0.30 + random() * 0.26 : 0.055 + random() * 0.13;
  pushStar(x, y, z, pickColor(), size, intensity, 0);
}

for (let i = 0; i < 620; i++) {
  const t = 0.02 + random() * 0.96;
  const f = frameAt(t);
  const width = 0.075 + 0.085 * (0.5 + 0.5 * Math.sin(t * 9.0 + 0.6));
  const offset = gaussian() * width;
  const x = f.x + f.nx * offset + gaussian() * 0.010;
  const y = f.y + f.ny * offset + gaussian() * 0.010;
  const z = -0.62 + random() * 1.35;
  const size = 0.75 + Math.pow(random(), 1.8) * 1.55;
  const intensity = 0.12 + random() * 0.27;
  pushStar(x, y, z, pickColor(), size, intensity, 1);
}

for (let i = 0; i < 18; i++) {
  const t = 0.07 + random() * 0.86;
  const f = frameAt(t);
  const offset = gaussian() * 0.095;
  const x = f.x + f.nx * offset;
  const y = f.y + f.ny * offset;
  const z = 0.15 + random() * 0.74;
  const size = 3.0 + random() * 3.0;
  const intensity = 0.58 + random() * 0.34;
  pushStar(x, y, z, pickColor(), size, intensity, 2);
}

const HERO = [
  { t: 0.20, o: -0.105, s: 6.3, c: [0.96,0.98,1.0] },
  { t: 0.36, o:  0.118, s: 5.2, c: [0.76,0.87,1.0] },
  { t: 0.52, o: -0.064, s: 7.0, c: [1.0,0.91,0.75] },
  { t: 0.69, o:  0.082, s: 5.8, c: [0.98,0.99,1.0] },
  { t: 0.83, o: -0.052, s: 4.9, c: [0.80,0.89,1.0] },
];
for (const h of HERO) {
  const f = frameAt(h.t);
  pushStar(f.x + f.nx * h.o, f.y + f.ny * h.o, 0.78, h.c, h.s, 1.0, 3);
}

const STRIDE = 9;
const starData = new Float32Array(starFloats);
const starCount = starData.length / STRIDE;
const starVao = gl.createVertexArray();
const starBuffer = gl.createBuffer();
gl.bindVertexArray(starVao);
gl.bindBuffer(gl.ARRAY_BUFFER, starBuffer);
gl.bufferData(gl.ARRAY_BUFFER, starData, gl.STATIC_DRAW);

function attrib(name, size, offset) {
  const loc = gl.getAttribLocation(starProgram, name);
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, size, gl.FLOAT, false, STRIDE * 4, offset * 4);
}
attrib('aPosition', 3, 0);
attrib('aColor', 3, 3);
attrib('aSize', 1, 6);
attrib('aIntensity', 1, 7);
attrib('aKind', 1, 8);
gl.bindVertexArray(null);

function makeTarget(width, height, preferFloat = true) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const useFloat = preferFloat && !!extColorBufferFloat;
  const internal = useFloat ? gl.RGBA16F : gl.RGBA8;
  const type = useFloat ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, width, height, 0, gl.RGBA, type, null);

  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error('Unable to create galaxy render target.');
  }
  return { texture, framebuffer, width, height };
}

function destroyTarget(target) {
  if (!target) return;
  gl.deleteFramebuffer(target.framebuffer);
  gl.deleteTexture(target.texture);
}

let sceneTarget = null;
let bloomA = null;
let bloomB = null;
let width = 1;
let height = 1;
let dpr = 1;
let aspect = 1;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  width = Math.max(1, Math.round(window.innerWidth * dpr));
  height = Math.max(1, Math.round(window.innerHeight * dpr));
  aspect = window.innerWidth / Math.max(window.innerHeight, 1);
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;

  destroyTarget(sceneTarget);
  destroyTarget(bloomA);
  destroyTarget(bloomB);
  sceneTarget = makeTarget(width, height, true);
  const bw = Math.max(1, Math.floor(width * 0.36));
  const bh = Math.max(1, Math.floor(height * 0.36));
  bloomA = makeTarget(bw, bh, true);
  bloomB = makeTarget(bw, bh, true);
}

function textureUniform(programObject, name, unit, texture) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(gl.getUniformLocation(programObject, name), unit);
}

function render() {
  const exposure = reducedMotion ? 1.0 : 1.0;

  gl.bindFramebuffer(gl.FRAMEBUFFER, sceneTarget.framebuffer);
  gl.viewport(0, 0, sceneTarget.width, sceneTarget.height);
  gl.disable(gl.BLEND);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(galaxyProgram);
  gl.uniform2f(gl.getUniformLocation(galaxyProgram, 'uResolution'), sceneTarget.width, sceneTarget.height);
  gl.uniform1f(gl.getUniformLocation(galaxyProgram, 'uExposure'), exposure);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  gl.enable(gl.BLEND);
  gl.blendEquation(gl.FUNC_ADD);
  gl.blendFunc(gl.ONE, gl.ONE);
  gl.useProgram(starProgram);
  gl.bindVertexArray(starVao);
  gl.uniform1f(gl.getUniformLocation(starProgram, 'uAspect'), aspect);
  gl.uniform1f(gl.getUniformLocation(starProgram, 'uDpr'), dpr);
  gl.uniform1f(gl.getUniformLocation(starProgram, 'uExposure'), exposure);
  gl.drawArrays(gl.POINTS, 0, starCount);
  gl.bindVertexArray(null);
  gl.disable(gl.BLEND);

  gl.bindFramebuffer(gl.FRAMEBUFFER, bloomA.framebuffer);
  gl.viewport(0, 0, bloomA.width, bloomA.height);
  gl.useProgram(extractProgram);
  textureUniform(extractProgram, 'uSource', 0, sceneTarget.texture);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  gl.bindFramebuffer(gl.FRAMEBUFFER, bloomB.framebuffer);
  gl.viewport(0, 0, bloomB.width, bloomB.height);
  gl.useProgram(blurProgram);
  textureUniform(blurProgram, 'uSource', 0, bloomA.texture);
  gl.uniform2f(gl.getUniformLocation(blurProgram, 'uTexel'), 1 / bloomA.width, 1 / bloomA.height);
  gl.uniform2f(gl.getUniformLocation(blurProgram, 'uDirection'), 1, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  gl.bindFramebuffer(gl.FRAMEBUFFER, bloomA.framebuffer);
  gl.useProgram(blurProgram);
  textureUniform(blurProgram, 'uSource', 0, bloomB.texture);
  gl.uniform2f(gl.getUniformLocation(blurProgram, 'uTexel'), 1 / bloomB.width, 1 / bloomB.height);
  gl.uniform2f(gl.getUniformLocation(blurProgram, 'uDirection'), 0, 1);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, width, height);
  gl.useProgram(compositeProgram);
  textureUniform(compositeProgram, 'uScene', 0, sceneTarget.texture);
  textureUniform(compositeProgram, 'uBloom', 1, bloomA.texture);
  gl.uniform2f(gl.getUniformLocation(compositeProgram, 'uResolution'), width, height);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

window.addEventListener('resize', () => {
  resize();
  render();
}, { passive: true });

canvas.addEventListener('webglcontextlost', event => event.preventDefault());

resize();
render();
