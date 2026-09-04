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

const colorBufferFloat = gl.getExtension('EXT_color_buffer_float');
const floatLinear = gl.getExtension('OES_texture_float_linear');
const useHDR = Boolean(colorBufferFloat);

const STAR_VERTEX = `#version 300 es
precision highp float;

in vec2 aPosition;
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

out float vSpritePx;
out float vCoreSize;
out float vBrightness;
out vec3 vColor;
out float vOpacity;
out float vHalo;
out float vRay;
out float vAngle;

void main() {
  float twinkle = 1.0 + sin(aPhase + uTime * aTwinkle) * mix(0.004, 0.018, smoothstep(0.8, 5.0, aBrightness));
  float corePx = max(aSize, 0.18) * uPixelRatio;
  float haloExtent = aHalo * (5.0 + min(aBrightness, 9.0) * 0.70) * uPixelRatio;
  float rayExtent = step(0.001, aRay) * (7.0 + min(aBrightness, 9.0) * 1.25) * uPixelRatio;
  float spritePx = max(1.15 * uPixelRatio, max(corePx * 3.0 + haloExtent * 2.0, rayExtent * 2.0));

  vSpritePx = spritePx;
  vCoreSize = aSize;
  vBrightness = aBrightness * twinkle;
  vColor = aColor;
  vOpacity = aOpacity;
  vHalo = aHalo;
  vRay = aRay;
  vAngle = aAngle;

  gl_PointSize = spritePx;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const STAR_FRAGMENT = `#version 300 es
precision highp float;

in float vSpritePx;
in float vCoreSize;
in float vBrightness;
in vec3 vColor;
in float vOpacity;
in float vHalo;
in float vRay;
in float vAngle;

uniform float uPixelRatio;
out vec4 outColor;

mat2 rot(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c);
}

void main() {
  vec2 pixel = (gl_PointCoord - vec2(0.5)) * (vSpritePx / uPixelRatio);
  float r2 = dot(pixel, pixel);

  // A tiny Moffat/Gaussian-like PSF. Small stars stay pin-point instead of becoming 6 px discs.
  float sigma = max(0.16, vCoreSize * 0.28);
  float core = exp(-r2 / max(2.0 * sigma * sigma, 0.00001));

  // Sub-pixel energy is deliberately restrained; far stars should live close to black.
  float coverage = clamp(vCoreSize * vCoreSize * 0.95, 0.055, 1.0);
  core *= mix(coverage, 1.0, smoothstep(0.72, 1.55, vCoreSize));

  float innerSigma = max(0.42, vCoreSize * 0.62);
  float inner = exp(-r2 / max(2.0 * innerSigma * innerSigma, 0.00001));

  float haloSigma = 1.35 + vHalo * (2.2 + min(vBrightness, 8.0) * 0.32);
  float halo = exp(-r2 / max(2.0 * haloSigma * haloSigma, 0.00001)) * vHalo;

  // Only genuinely bright stars receive a faint, asymmetric diffraction signature.
  vec2 q = rot(vAngle) * pixel;
  float rayLength = 3.4 + min(vBrightness, 9.0) * 0.64;
  float mainRay = exp(-abs(q.y) * 3.8) * (1.0 - smoothstep(0.35, rayLength, abs(q.x)));
  float crossRay = exp(-abs(q.x) * 5.6) * (1.0 - smoothstep(0.30, rayLength * 0.52, abs(q.y)));
  float rays = (mainRay + crossRay * 0.24) * vRay;

  float brightWeight = smoothstep(1.25, 6.5, vBrightness);
  float whiteNucleus = clamp((core * 0.96 + inner * 0.18) * brightWeight, 0.0, 0.92);
  vec3 nucleusColor = mix(vColor, vec3(1.0), whiteNucleus);

  float energy = core * 1.08;
  energy += inner * vHalo * 0.30;
  energy += halo * 0.085;
  energy += rays * 0.12;
  energy *= vBrightness * vOpacity;

  vec3 emission = nucleusColor * energy;
  emission += vColor * halo * vBrightness * vOpacity * 0.055;

  if (max(emission.r, max(emission.g, emission.b)) < 0.00012) discard;
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

vec3 sampleSource(vec2 uv) {
  vec3 c = texture(uSource, uv).rgb;
  if (uExtract > 0.5) {
    float peak = max(c.r, max(c.g, c.b));
    c *= smoothstep(uThreshold, uThreshold + 0.85, peak);
  }
  return c;
}

void main() {
  vec2 s = uTexel * uDirection;
  vec3 c = sampleSource(vUv) * 0.2270270270;
  c += (sampleSource(vUv + s * 1.3846153846) + sampleSource(vUv - s * 1.3846153846)) * 0.3162162162;
  c += (sampleSource(vUv + s * 3.2307692308) + sampleSource(vUv - s * 3.2307692308)) * 0.0702702703;
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
  // The floor is intentionally blue-black, not photographic grey.
  mapped += vec3(0.0015, 0.0030, 0.0070);
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

function link(vertexSource, fragmentSource) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(p) || 'Program link failed');
  }
  return p;
}

const starProgram = link(STAR_VERTEX, STAR_FRAGMENT);
const blurProgram = link(FULLSCREEN_VERTEX, BLUR_FRAGMENT);
const compositeProgram = link(FULLSCREEN_VERTEX, COMPOSITE_FRAGMENT);
const emptyVao = gl.createVertexArray();

function rng(seed = 0x8e7f31ab) {
  let s = seed >>> 0;
  return () => {
    s += 0x6D2B79F5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = rng();
const TAU = Math.PI * 2;

function gaussian() {
  const u = Math.max(1e-7, random());
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
}

function starColor(strength = 1) {
  const r = random();
  let c;
  if (r < 0.46) c = [0.88, 0.94, 1.00];
  else if (r < 0.68) c = [0.68, 0.82, 1.00];
  else if (r < 0.88) c = [1.00, 0.84, 0.66];
  else if (r < 0.96) c = [0.52, 0.72, 1.00];
  else c = [1.00, 0.64, 0.40];
  const neutral = [0.92, 0.95, 1.0];
  const sat = 0.34 + 0.38 * strength;
  return [
    neutral[0] + (c[0] - neutral[0]) * sat,
    neutral[1] + (c[1] - neutral[1]) * sat,
    neutral[2] + (c[2] - neutral[2]) * sat,
  ];
}

const clusterSeeds = [
  [-0.64, 0.46], [0.51, 0.53], [-0.22, -0.38],
  [0.68, -0.31], [0.08, 0.08], [-0.76, -0.58],
];

function positionFor(layer) {
  if (random() < (layer === 'far' ? 0.24 : 0.32)) {
    const [cx, cy] = clusterSeeds[Math.floor(random() * clusterSeeds.length)];
    const spread = layer === 'far' ? 0.22 : 0.16;
    return [
      Math.max(-1.04, Math.min(1.04, cx + gaussian() * spread)),
      Math.max(-1.04, Math.min(1.04, cy + gaussian() * spread)),
    ];
  }
  return [random() * 2.08 - 1.04, random() * 2.08 - 1.04];
}

function makeStars() {
  const stars = [];

  // Far stars: almost-black, mostly sub-pixel. They should be discovered, not announced.
  for (let i = 0; i < 760; i++) {
    const [x, y] = positionFor('far');
    const rare = Math.pow(random(), 7.0);
    const brightness = 0.018 + rare * 0.16;
    stars.push({
      x, y,
      size: 0.28 + Math.pow(random(), 3.5) * 0.50,
      brightness,
      color: starColor(0.18),
      opacity: 0.30 + random() * 0.42,
      halo: rare > 0.45 ? 0.035 : 0,
      ray: 0,
      angle: random() * TAU,
      phase: random() * TAU,
      twinkle: 0.08 + random() * 0.16,
    });
  }

  // Middle layer: where colour temperature starts to become visible.
  for (let i = 0; i < 165; i++) {
    const [x, y] = positionFor('mid');
    const t = Math.pow(random(), 2.6);
    const brightness = 0.16 + t * 0.92;
    stars.push({
      x, y,
      size: 0.58 + Math.pow(random(), 2.0) * 0.86,
      brightness,
      color: starColor(0.62),
      opacity: 0.54 + random() * 0.34,
      halo: 0.015 + t * 0.055,
      ray: 0,
      angle: random() * TAU,
      phase: random() * TAU,
      twinkle: 0.06 + random() * 0.12,
    });
  }

  // A tiny optical-bright population creates the depth hierarchy.
  for (let i = 0; i < 17; i++) {
    const [x, y] = positionFor('bright');
    const t = Math.pow(random(), 0.78);
    const brightness = 1.45 + t * 3.9;
    stars.push({
      x, y,
      size: 1.05 + random() * 1.15,
      brightness,
      color: starColor(0.92),
      opacity: 0.82 + random() * 0.16,
      halo: 0.10 + random() * 0.16,
      ray: random() < 0.24 ? 0.018 + random() * 0.028 : 0,
      angle: random() * TAU,
      phase: random() * TAU,
      twinkle: 0.045 + random() * 0.065,
    });
  }

  // Three reference hero stars only; these tell us whether the material itself feels luminous.
  const hero = [
    [-0.48, 0.29, 5.9, [0.66, 0.82, 1.00]],
    [0.37, 0.43, 7.7, [1.00, 0.82, 0.62]],
    [0.16, -0.31, 6.8, [0.84, 0.91, 1.00]],
  ];

  for (const [x, y, brightness, color] of hero) {
    stars.push({
      x, y,
      size: 1.85 + brightness * 0.055,
      brightness,
      color,
      opacity: 0.97,
      halo: 0.31,
      ray: 0.045,
      angle: random() * TAU,
      phase: random() * TAU,
      twinkle: 0.035,
    });
  }

  return stars;
}

const stars = makeStars();
const stride = 13;
const data = new Float32Array(stars.length * stride);
for (let i = 0; i < stars.length; i++) {
  const s = stars[i];
  const o = i * stride;
  data[o + 0] = s.x;
  data[o + 1] = s.y;
  data[o + 2] = s.size;
  data[o + 3] = s.brightness;
  data[o + 4] = s.color[0];
  data[o + 5] = s.color[1];
  data[o + 6] = s.color[2];
  data[o + 7] = s.opacity;
  data[o + 8] = s.halo;
  data[o + 9] = s.ray;
  data[o + 10] = s.angle;
  data[o + 11] = s.phase;
  data[o + 12] = s.twinkle;
}

const starVao = gl.createVertexArray();
const starBuffer = gl.createBuffer();
gl.bindVertexArray(starVao);
gl.bindBuffer(gl.ARRAY_BUFFER, starBuffer);
gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

function attr(name, size, offsetFloats) {
  const loc = gl.getAttribLocation(starProgram, name);
  if (loc < 0) return;
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride * 4, offsetFloats * 4);
}

attr('aPosition', 2, 0);
attr('aSize', 1, 2);
attr('aBrightness', 1, 3);
attr('aColor', 3, 4);
attr('aOpacity', 1, 7);
attr('aHalo', 1, 8);
attr('aRay', 1, 9);
attr('aAngle', 1, 10);
attr('aPhase', 1, 11);
attr('aTwinkle', 1, 12);
gl.bindVertexArray(null);

function createTarget(width, height) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  const hdr = useHDR;
  const internalFormat = hdr ? gl.RGBA16F : gl.RGBA8;
  const type = hdr ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, gl.RGBA, type, null);
  const filter = hdr && !floatLinear ? gl.NEAREST : gl.LINEAR;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error('Framebuffer incomplete');
  }

  return { texture, framebuffer, width, height };
}

function destroyTarget(target) {
  if (!target) return;
  gl.deleteTexture(target.texture);
  gl.deleteFramebuffer(target.framebuffer);
}

let sceneTarget = null;
let bloomA = null;
let bloomB = null;
let width = 0;
let height = 0;
let dpr = 1;

function resize() {
  const cssWidth = Math.max(1, Math.floor(canvas.clientWidth));
  const cssHeight = Math.max(1, Math.floor(canvas.clientHeight));
  const nextDpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.floor(cssWidth * nextDpr));
  const h = Math.max(1, Math.floor(cssHeight * nextDpr));

  if (w === width && h === height && nextDpr === dpr) return;
  width = w;
  height = h;
  dpr = nextDpr;
  canvas.width = width;
  canvas.height = height;

  destroyTarget(sceneTarget);
  destroyTarget(bloomA);
  destroyTarget(bloomB);
  sceneTarget = createTarget(width, height);
  const bw = Math.max(1, Math.floor(width * 0.5));
  const bh = Math.max(1, Math.floor(height * 0.5));
  bloomA = createTarget(bw, bh);
  bloomB = createTarget(bw, bh);
}

const starUniforms = {
  pixelRatio: gl.getUniformLocation(starProgram, 'uPixelRatio'),
  time: gl.getUniformLocation(starProgram, 'uTime'),
};

const blurUniforms = {
  source: gl.getUniformLocation(blurProgram, 'uSource'),
  texel: gl.getUniformLocation(blurProgram, 'uTexel'),
  direction: gl.getUniformLocation(blurProgram, 'uDirection'),
  threshold: gl.getUniformLocation(blurProgram, 'uThreshold'),
  extract: gl.getUniformLocation(blurProgram, 'uExtract'),
};

const compositeUniforms = {
  scene: gl.getUniformLocation(compositeProgram, 'uScene'),
  bloom: gl.getUniformLocation(compositeProgram, 'uBloom'),
  bloomStrength: gl.getUniformLocation(compositeProgram, 'uBloomStrength'),
  exposure: gl.getUniformLocation(compositeProgram, 'uExposure'),
};

function bindTexture(unit, texture) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
}

function blurPass(source, target, direction, extract, sourceWidth, sourceHeight) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
  gl.viewport(0, 0, target.width, target.height);
  gl.disable(gl.BLEND);
  gl.useProgram(blurProgram);
  gl.bindVertexArray(emptyVao);
  bindTexture(0, source.texture);
  gl.uniform1i(blurUniforms.source, 0);
  gl.uniform2f(blurUniforms.texel, 1 / sourceWidth, 1 / sourceHeight);
  gl.uniform2f(blurUniforms.direction, direction[0], direction[1]);
  gl.uniform1f(blurUniforms.threshold, useHDR ? 1.15 : 0.66);
  gl.uniform1f(blurUniforms.extract, extract ? 1 : 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

const startedAt = performance.now();
function frame(now) {
  resize();
  const time = (now - startedAt) * 0.001;

  gl.bindFramebuffer(gl.FRAMEBUFFER, sceneTarget.framebuffer);
  gl.viewport(0, 0, width, height);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.BLEND);
  gl.blendEquation(gl.FUNC_ADD);
  gl.blendFunc(gl.ONE, gl.ONE);
  gl.useProgram(starProgram);
  gl.bindVertexArray(starVao);
  gl.uniform1f(starUniforms.pixelRatio, dpr);
  gl.uniform1f(starUniforms.time, time);
  gl.drawArrays(gl.POINTS, 0, stars.length);
  gl.disable(gl.BLEND);

  // Bloom is deliberately selective: only optical-bright stars should leak light.
  blurPass(sceneTarget, bloomA, [1, 0], true, width, height);
  blurPass(bloomA, bloomB, [0, 1], false, bloomA.width, bloomA.height);
  blurPass(bloomB, bloomA, [1, 0], false, bloomB.width, bloomB.height);
  blurPass(bloomA, bloomB, [0, 1], false, bloomA.width, bloomA.height);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, width, height);
  gl.useProgram(compositeProgram);
  gl.bindVertexArray(emptyVao);
  bindTexture(0, sceneTarget.texture);
  bindTexture(1, bloomB.texture);
  gl.uniform1i(compositeUniforms.scene, 0);
  gl.uniform1i(compositeUniforms.bloom, 1);
  gl.uniform1f(compositeUniforms.bloomStrength, useHDR ? 0.46 : 0.30);
  gl.uniform1f(compositeUniforms.exposure, useHDR ? 0.52 : 0.72);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  requestAnimationFrame(frame);
}

window.addEventListener('resize', resize, { passive: true });
resize();
requestAnimationFrame(frame);
