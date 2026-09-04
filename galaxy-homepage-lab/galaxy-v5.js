const canvas = document.getElementById('galaxyCanvas');

const gl = canvas.getContext('webgl2', {
  alpha: false,
  antialias: false,
  depth: false,
  stencil: false,
  premultipliedAlpha: false,
  powerPreference: 'high-performance',
});

if (!gl) throw new Error('WebGL2 is required.');

const floatColorBuffer = gl.getExtension('EXT_color_buffer_float');
const useHDR = Boolean(floatColorBuffer);

const STAR_VERTEX = `#version 300 es
precision highp float;

in vec2 aPosition;
in float aDepth;
in float aSize;
in float aBrightness;
in vec3 aColor;
in float aOpacity;
in float aHalo;
in float aRay;
in float aAngle;
in float aPhase;
in float aTwinkle;

uniform float uPixelRatio;
uniform float uTime;
uniform vec2 uAspectScale;

out float vDiameter;
out float vBrightness;
out vec3 vColor;
out float vOpacity;
out float vHalo;
out float vRay;
out float vAngle;

void main() {
  float depthScale = mix(0.72, 1.16, aDepth);
  vec2 p = aPosition;
  p.x *= uAspectScale.x;
  p *= depthScale;

  float twinkle = 1.0 + sin(aPhase + uTime * aTwinkle) * mix(0.012, 0.045, smoothstep(1.2, 5.0, aBrightness));
  float desired = aSize * mix(0.72, 1.28, aDepth) * twinkle * uPixelRatio;

  vDiameter = desired;
  vBrightness = aBrightness * twinkle;
  vColor = aColor;
  vOpacity = aOpacity;
  vHalo = aHalo;
  vRay = aRay;
  vAngle = aAngle;

  gl_PointSize = max(desired, 6.0 * uPixelRatio);
  gl_Position = vec4(p, 0.0, 1.0);
}
`;

const STAR_FRAGMENT = `#version 300 es
precision highp float;

in float vDiameter;
in float vBrightness;
in vec3 vColor;
in float vOpacity;
in float vHalo;
in float vRay;
in float vAngle;

uniform float uPixelRatio;
out vec4 outColor;

mat2 rotate2d(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c);
}

void main() {
  float spritePx = max(vDiameter, 6.0 * uPixelRatio);
  vec2 pixel = (gl_PointCoord - vec2(0.5)) * spritePx;
  float r2 = dot(pixel, pixel);

  float d = max(vDiameter, 0.28 * uPixelRatio);
  float resolved = smoothstep(1.25 * uPixelRatio, 4.5 * uPixelRatio, d);

  // Photographic stellar core: sub-pixel stars retain energy instead of becoming flat dots.
  float sigmaCore = mix(0.34, 0.74, resolved) * uPixelRatio + d * 0.055;
  float core = exp(-r2 / max(2.0 * sigmaCore * sigmaCore, 0.0001));
  float tinyCoverage = clamp((d * d) / max(2.5 * uPixelRatio * uPixelRatio, 0.0001), 0.12, 1.0);
  core *= mix(tinyCoverage, 1.0, resolved);

  // A compact inner glow gives bright stars a luminous spherical body.
  float sigmaInner = max(0.9 * uPixelRatio, d * 0.32);
  float inner = exp(-r2 / max(2.0 * sigmaInner * sigmaInner, 0.0001));

  // Wide halo is reserved for optically bright stars.
  float sigmaHalo = max(1.8 * uPixelRatio, d * 0.92 + 1.2 * uPixelRatio);
  float halo = exp(-r2 / max(2.0 * sigmaHalo * sigmaHalo, 0.0001)) * vHalo;

  // Only a very small subset gets diffraction rays, and each star has its own angle.
  vec2 q = rotate2d(vAngle) * pixel / uPixelRatio;
  float rayLength = max(2.5, d / uPixelRatio * 1.65);
  float majorRay = exp(-abs(q.y) * 4.8) * (1.0 - smoothstep(0.12, rayLength, abs(q.x)));
  float minorRay = exp(-abs(q.x) * 6.6) * (1.0 - smoothstep(0.10, rayLength * 0.58, abs(q.y)));
  float rays = (majorRay + minorRay * 0.34) * vRay;

  float whiteCore = smoothstep(1.55, 7.0, vBrightness) * (core * 0.88 + inner * 0.28);
  vec3 stellarColor = mix(vColor, vec3(1.0), clamp(whiteCore, 0.0, 0.92));

  float energy = core * 1.55 + inner * 0.52 + halo * 0.32 + rays * 0.22;
  energy *= vBrightness * vOpacity;

  // Keep the halo coloured while the nucleus trends toward white.
  vec3 emission = stellarColor * energy;
  emission += vColor * halo * vBrightness * 0.16;

  if (max(emission.r, max(emission.g, emission.b)) < 0.00035) discard;
  outColor = vec4(emission, 1.0);
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

const BLUR_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSource;
uniform vec2 uTexel;
uniform vec2 uDirection;
uniform float uThreshold;
uniform float uExtract;
out vec4 outColor;

vec3 sourceSample(vec2 uv) {
  vec3 c = texture(uSource, uv).rgb;
  if (uExtract > 0.5) {
    float l = max(c.r, max(c.g, c.b));
    c *= smoothstep(uThreshold, uThreshold + 0.8, l);
  }
  return c;
}

void main() {
  vec2 s = uTexel * uDirection;
  vec3 c = sourceSample(vUv) * 0.2270270270;
  c += (sourceSample(vUv + s * 1.3846153846) + sourceSample(vUv - s * 1.3846153846)) * 0.3162162162;
  c += (sourceSample(vUv + s * 3.2307692308) + sourceSample(vUv - s * 3.2307692308)) * 0.0702702703;
  outColor = vec4(c, 1.0);
}
`;

const COMPOSITE_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uBloomStrength;
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
  vec3 scene = texture(uScene, vUv).rgb;
  vec3 bloom = texture(uBloom, vUv).rgb;
  vec3 hdr = (scene + bloom * uBloomStrength) * uExposure;
  vec3 mapped = aces(hdr);
  mapped = pow(mapped, vec3(1.0 / 2.2));
  outColor = vec4(mapped, 1.0);
}
`;

function compile(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(message || 'Shader compile failed');
  }
  return shader;
}

function program(vertex, fragment) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, vertex));
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'Program link failed');
  return p;
}

const starProgram = program(STAR_VERTEX, STAR_FRAGMENT);
const blurProgram = program(FULLSCREEN_VERTEX, BLUR_FRAGMENT);
const compositeProgram = program(FULLSCREEN_VERTEX, COMPOSITE_FRAGMENT);
const emptyVao = gl.createVertexArray();

function rng(seed = 0x6a09e667) {
  let s = seed >>> 0;
  return () => {
    s += 0x6D2B79F5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = rng(0x5A17BEEF);
const TAU = Math.PI * 2;

function normal() {
  const u = Math.max(1e-6, random());
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
}

function chooseTemperature() {
  const r = random();
  if (r < 0.63) return [0.96, 0.985, 1.00];       // neutral white
  if (r < 0.79) return [0.78, 0.88, 1.00];       // cool blue-white
  if (r < 0.93) return [1.00, 0.89, 0.72];       // warm cream
  if (r < 0.975) return [0.63, 0.78, 1.00];      // blue
  return [1.00, 0.70, 0.50];                     // rare amber
}

function makeStars() {
  const stars = [];

  // Far field: many almost-subpixel stars, intentionally sparse and quiet.
  for (let i = 0; i < 1550; i++) {
    const depth = Math.pow(random(), 1.75) * 0.68;
    const x = random() * 2.18 - 1.09;
    const y = random() * 2.10 - 1.05;
    const brightness = 0.10 + Math.pow(random(), 4.6) * 0.78;
    stars.push({
      x, y, depth,
      size: 0.34 + Math.pow(random(), 3.4) * 0.78,
      brightness,
      color: chooseTemperature(),
      opacity: 0.34 + random() * 0.42,
      halo: brightness > 0.55 ? 0.05 : 0.0,
      ray: 0,
      angle: random() * TAU,
      phase: random() * TAU,
      twinkle: 0.18 + random() * 0.34,
    });
  }

  // Mid-depth stars provide scale. They are fewer, clearer and slightly more colourful.
  for (let i = 0; i < 430; i++) {
    const depth = 0.38 + Math.pow(random(), 0.82) * 0.48;
    const x = random() * 2.08 - 1.04;
    const y = random() * 2.02 - 1.01;
    const brightness = 0.58 + Math.pow(random(), 2.1) * 1.85;
    stars.push({
      x, y, depth,
      size: 0.72 + Math.pow(random(), 1.85) * 1.55,
      brightness,
      color: chooseTemperature(),
      opacity: 0.66 + random() * 0.30,
      halo: 0.04 + Math.pow(brightness / 2.5, 1.5) * 0.12,
      ray: 0,
      angle: random() * TAU,
      phase: random() * TAU,
      twinkle: 0.12 + random() * 0.26,
    });
  }

  // Optical bright stars: the small set that creates the photographic depth cue.
  for (let i = 0; i < 28; i++) {
    const depth = 0.66 + random() * 0.34;
    const brightness = 2.3 + Math.pow(random(), 0.72) * 5.2;
    stars.push({
      x: random() * 1.94 - 0.97,
      y: random() * 1.86 - 0.93,
      depth,
      size: 1.75 + random() * 2.7,
      brightness,
      color: chooseTemperature(),
      opacity: 0.90 + random() * 0.10,
      halo: 0.20 + random() * 0.34,
      ray: random() < 0.46 ? 0.045 + random() * 0.10 : 0,
      angle: random() * TAU,
      phase: random() * TAU,
      twinkle: 0.08 + random() * 0.16,
    });
  }

  // Five hero stars are hand-positioned only to let us judge the material at different scales.
  const hero = [
    [-0.58,  0.38, 5.5, [0.72, 0.86, 1.00]],
    [ 0.42,  0.48, 8.6, [1.00, 0.90, 0.76]],
    [ 0.18, -0.20, 6.8, [0.93, 0.97, 1.00]],
    [-0.24, -0.55, 10.2,[0.77, 0.88, 1.00]],
    [ 0.70, -0.42, 7.8, [1.00, 0.82, 0.66]],
  ];
  for (const [x, y, brightness, color] of hero) {
    stars.push({
      x, y, depth: 0.94,
      size: 4.0 + brightness * 0.17,
      brightness,
      color,
      opacity: 1,
      halo: 0.48,
      ray: 0.10,
      angle: random() * TAU,
      phase: random() * TAU,
      twinkle: 0.07,
    });
  }

  return stars;
}

const stars = makeStars();
const stride = 14;
const data = new Float32Array(stars.length * stride);
for (let i = 0; i < stars.length; i++) {
  const s = stars[i];
  const o = i * stride;
  data[o + 0] = s.x;
  data[o + 1] = s.y;
  data[o + 2] = s.depth;
  data[o + 3] = s.size;
  data[o + 4] = s.brightness;
  data[o + 5] = s.color[0];
  data[o + 6] = s.color[1];
  data[o + 7] = s.color[2];
  data[o + 8] = s.opacity;
  data[o + 9] = s.halo;
  data[o + 10] = s.ray;
  data[o + 11] = s.angle;
  data[o + 12] = s.phase;
  data[o + 13] = s.twinkle;
}

const starVao = gl.createVertexArray();
const starBuffer = gl.createBuffer();
gl.bindVertexArray(starVao);
gl.bindBuffer(gl.ARRAY_BUFFER, starBuffer);
gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

function attrib(name, size, offset) {
  const loc = gl.getAttribLocation(starProgram, name);
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride * 4, offset * 4);
}
attrib('aPosition', 2, 0);
attrib('aDepth', 1, 2);
attrib('aSize', 1, 3);
attrib('aBrightness', 1, 4);
attrib('aColor', 3, 5);
attrib('aOpacity', 1, 8);
attrib('aHalo', 1, 9);
attrib('aRay', 1, 10);
attrib('aAngle', 1, 11);
attrib('aPhase', 1, 12);
attrib('aTwinkle', 1, 13);
gl.bindVertexArray(null);

function makeTarget(width, height) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  if (useHDR) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  return { texture, framebuffer, width, height };
}

function destroyTarget(target) {
  if (!target) return;
  gl.deleteTexture(target.texture);
  gl.deleteFramebuffer(target.framebuffer);
}

let width = 1;
let height = 1;
let dpr = 1;
let sceneTarget;
let blurA;
let blurB;

function resize() {
  const cssW = Math.max(1, Math.floor(window.innerWidth));
  const cssH = Math.max(1, Math.floor(window.innerHeight));
  const nextDpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  const w = Math.floor(cssW * nextDpr);
  const h = Math.floor(cssH * nextDpr);
  if (w === width && h === height && nextDpr === dpr) return;

  width = w;
  height = h;
  dpr = nextDpr;
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;

  destroyTarget(sceneTarget);
  destroyTarget(blurA);
  destroyTarget(blurB);
  sceneTarget = makeTarget(width, height);
  blurA = makeTarget(Math.max(1, Math.floor(width / 2)), Math.max(1, Math.floor(height / 2)));
  blurB = makeTarget(blurA.width, blurA.height);
}

function bindTexture(programObject, name, texture, unit) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(gl.getUniformLocation(programObject, name), unit);
}

function drawStars(time) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, sceneTarget.framebuffer);
  gl.viewport(0, 0, sceneTarget.width, sceneTarget.height);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.enable(gl.BLEND);
  gl.blendEquation(gl.FUNC_ADD);
  gl.blendFunc(gl.ONE, gl.ONE);
  gl.useProgram(starProgram);
  gl.bindVertexArray(starVao);
  gl.uniform1f(gl.getUniformLocation(starProgram, 'uPixelRatio'), dpr);
  gl.uniform1f(gl.getUniformLocation(starProgram, 'uTime'), time);
  const aspect = width / Math.max(height, 1);
  gl.uniform2f(gl.getUniformLocation(starProgram, 'uAspectScale'), aspect > 1 ? 1 / aspect : 1, aspect > 1 ? 1 : aspect);
  gl.drawArrays(gl.POINTS, 0, stars.length);
  gl.disable(gl.BLEND);
}

function blur(source, target, direction, extract) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
  gl.viewport(0, 0, target.width, target.height);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(blurProgram);
  gl.bindVertexArray(emptyVao);
  bindTexture(blurProgram, 'uSource', source.texture, 0);
  gl.uniform2f(gl.getUniformLocation(blurProgram, 'uTexel'), 1 / source.width, 1 / source.height);
  gl.uniform2f(gl.getUniformLocation(blurProgram, 'uDirection'), direction[0], direction[1]);
  gl.uniform1f(gl.getUniformLocation(blurProgram, 'uThreshold'), useHDR ? 1.20 : 0.72);
  gl.uniform1f(gl.getUniformLocation(blurProgram, 'uExtract'), extract ? 1 : 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function composite() {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, width, height);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(compositeProgram);
  gl.bindVertexArray(emptyVao);
  bindTexture(compositeProgram, 'uScene', sceneTarget.texture, 0);
  bindTexture(compositeProgram, 'uBloom', blurB.texture, 1);
  gl.uniform1f(gl.getUniformLocation(compositeProgram, 'uBloomStrength'), useHDR ? 0.78 : 0.34);
  gl.uniform1f(gl.getUniformLocation(compositeProgram, 'uExposure'), useHDR ? 1.12 : 0.88);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const start = performance.now();
function frame(now) {
  resize();
  const t = reducedMotion ? 0 : (now - start) / 1000;
  drawStars(t);
  blur(sceneTarget, blurA, [1, 0], true);
  blur(blurA, blurB, [0, 1], false);
  composite();
  requestAnimationFrame(frame);
}

window.addEventListener('resize', resize, { passive: true });
requestAnimationFrame(frame);
