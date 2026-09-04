import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const canvas = document.getElementById('galaxyCanvas');

// High-fidelity standalone port of the Astra star-field core from the production
// chunks supplied during this design session. The Turbopack/runtime wrapper is
// intentionally removed; authored particle generation, palette, star material,
// orbit flow, intro pull, center cluster and lagged rotation are preserved.

const CONFIG = Object.freeze({
  animationPlaying: true,
  convergeDuration: 5.5,
  bloomIntensity: 0.7,
  bloomThreshold: 0.08,
  rotationDepth: 1.4,
  showCenterCluster: true,
  stars: Object.freeze({
    density: 4,
    densityFalloff: 0.22,
    flowInward: true,
    flowSpeed: 0.8,
    intensity: 1.35,
    scatter: 0.4,
    size: 2.05,
    sizeFalloff: 0.45,
    twinkleSpeed: 0.62,
  }),
});

const PALETTE = [
  new THREE.Color('#6DCBF4'),
  new THREE.Color('#7AB1FE'),
  new THREE.Color('#F87915'),
  new THREE.Color('#FA994C'),
  new THREE.Color('#F5F6FB'),
];

const ORBIT_SPECS = [
  { depth: 0.62, phase: 0.16, speed: 0.025, strong: true },
  { depth: -0.46, phase: 0.72, speed: -0.018, strong: false },
  { depth: 0.78, phase: 0.38, speed: 0.021, strong: true },
  { depth: -0.70, phase: 0.58, speed: -0.016, strong: false },
  { depth: 0.42, phase: 0.08, speed: 0.030, strong: true },
];

const SVG_PATHS = [
  'M128.472 2.36011C65.4727 24.3601 10.7725 93.1601 9.97246 162.36C8.97246 248.86 79.4138 262.86 87.9725 262.86C116.973 262.86 135.973 244.36 135.973 221.36C135.973 189.86 102.973 193.86 102.973 209.36',
  'M224.973 31.8602C132.473 3.86011 29.9727 75.8601 29.9727 159.86C29.9727 247.86 98.4726 259.86 126.473 247.86',
  'M126.473 215.359C124.639 222.692 117.073 237.159 101.473 236.359C89.1905 235.729 76.0585 219.995 76.4724 195.859C76.4724 165.859 100.473 142.859 132.473 142.859C171.973 142.859 213.473 171.36 213.473 231.36C213.473 276.36 170.473 328.36 85.9727 316.86',
  'M106.973 237.36C81.9727 240.36 61.4727 222.86 61.4727 184.86C61.4727 153.36 91.9727 123.36 132.473 123.36C172.973 123.36 227.973 149.86 227.973 225.36C227.973 287.36 168.473 322.36 121.473 322.36C53.4727 322.36 10.9727 264.86 2.47266 208.36',
  'M114.973 211.36C114.973 225.86 92.4727 226.86 92.4727 205.36C92.4727 183.86 109.938 175.36 127.973 175.36C146.008 175.36 174.473 195.86 174.473 230.86C174.473 264.36 148.473 281.86 133.973 287.36C119.473 292.86 81.6727 296.56 54.4727 269.36',
];

const ASTRA_FILTERED_CORE_GLSL = `
varying float vParticleDiameter;
float astraCubicCoverage(float coordinate) {
  float x = abs(coordinate);
  if (x < 1.0) return (4.0 - 6.0 * x * x + 3.0 * x * x * x) / 6.0;
  float tail = max(2.0 - x, 0.0);
  return tail * tail * tail / 6.0;
}
float astraFilteredCore(vec2 pixel, float area) {
  return astraCubicCoverage(pixel.x) * astraCubicCoverage(pixel.y)
    * area * vParticleDiameter * vParticleDiameter;
}
`;

const ASTRA_INTRO_GLSL = `
vec3 astraIntroMotion(
  vec3 position, vec3 scattered, float progress,
  float seed, float travelSeed
) {
  if (progress >= 1.0) return position;
  float start = 0.14 + seed * 0.18;
  float duration = 0.58 + travelSeed * 0.1;
  float local = clamp((progress - start) / duration, 0.0, 1.0);
  float smoothPull = local * local * local * (local * (local * 6.0 - 15.0) + 10.0);
  float pull = mix(smoothPull, sin(smoothPull * 3.14159265359 * 0.5), 0.5);
  float angle = sin(pull * 3.14159265359) * (0.44 + seed * 0.22);
  float c = cos(angle);
  float s = sin(angle);
  vec3 orbiting = vec3(
    scattered.x * c - scattered.y * s,
    scattered.x * s + scattered.y * c,
    scattered.z
  );
  return mix(orbiting, position, pull);
}
float astraParticleRevealProgress(float progress, float seed) {
  float delay = seed * 0.015;
  return smoothstep(delay, 0.14 + delay, progress)
    * mix(0.2, 1.0, smoothstep(0.2, 1.0, progress));
}
`;

const STAR_VERTEX = `
attribute float orbitProgress;
attribute float starAcrossOffset;
attribute float starBrightness;
attribute vec3 starColor;
attribute float starDepthOffset;
attribute float starHero;
attribute float starBackground;
attribute float starOpacity;
attribute float starScale;
attribute float twinklePhase;
attribute float twinkleRate;

uniform float uIntensity;
uniform float uIntroProgress;
uniform float uBackgroundStarsEnabled;
uniform mat4 uBackgroundModelMatrix;
uniform float uDensityFalloff;
uniform float uFlowSpeed;
uniform float uPathMotion;
uniform float uPathOffset;
uniform float uPathSampleCount;
uniform float uPathSpeed;
uniform sampler2D uPathTexture;
uniform float uPixelRatio;
uniform float uSizeFalloff;
uniform float uTime;
uniform float uTwinkleSpeed;
uniform vec2 uScatterSize;
uniform float uViewportAspect;

varying float vBrightness;
varying vec3 vColor;
varying float vOpacity;
varying float vRayStrength;
${ASTRA_FILTERED_CORE_GLSL}
${ASTRA_INTRO_GLSL}

vec3 samplePath(float progress) {
  float scaledProgress = clamp(progress, 0.0, 1.0) * (uPathSampleCount - 1.0);
  float lowerIndex = floor(scaledProgress);
  float upperIndex = min(lowerIndex + 1.0, uPathSampleCount - 1.0);
  float blend = fract(scaledProgress);
  vec3 lowerPoint = texture2D(uPathTexture, vec2((lowerIndex + 0.5) / uPathSampleCount, 0.5)).xyz;
  vec3 upperPoint = texture2D(uPathTexture, vec2((upperIndex + 0.5) / uPathSampleCount, 0.5)).xyz;
  return mix(lowerPoint, upperPoint, blend);
}

void main() {
  float pathPhase = fract(orbitProgress + uPathOffset);
  float progress = pathPhase + uDensityFalloff * sin(pathPhase * 6.28318530718) / 6.28318530718;
  float middleWeight = sin(clamp(progress, 0.0, 1.0) * 3.14159265359);
  float sizeEnvelope = mix(1.0, 0.14 + 0.86 * pow(max(middleWeight, 0.0), 0.68), uSizeFalloff);
  float endpointVisibility = smoothstep(0.0, 0.055, progress)
    * (1.0 - smoothstep(0.945, 1.0, progress));

  vec3 animatedPosition = position;
  if (uPathMotion > 0.5) {
    float tangentStep = 1.0 / max(uPathSampleCount - 1.0, 1.0);
    vec3 pathPosition = samplePath(progress);
    vec3 before = samplePath(max(progress - tangentStep, 0.0));
    vec3 after = samplePath(min(progress + tangentStep, 1.0));
    vec3 tangent = normalize(after - before);
    vec3 across = normalize(vec3(-tangent.y, tangent.x, 0.0));
    animatedPosition = pathPosition + across * starAcrossOffset + vec3(0.0, 0.0, starDepthOffset);
  } else {
    sizeEnvelope = 1.0;
    endpointVisibility = 1.0;
  }

  float scatterX = fract(sin(dot(vec2(orbitProgress, twinklePhase), vec2(127.1, 311.7))) * 43758.5453);
  float scatterY = fract(sin(dot(vec2(twinklePhase, starScale), vec2(269.5, 183.3))) * 43758.5453);
  float scatterZ = fract(sin(dot(vec2(orbitProgress, starBrightness), vec2(419.2, 371.9))) * 43758.5453);
  vec3 introScattered = vec3(
    (scatterX - 0.5) * uScatterSize.x,
    (fract(scatterY) - 0.5) * uScatterSize.y,
    (scatterZ - 0.5) * 0.5
  );

  float backgroundStar = starBackground * uBackgroundStarsEnabled;
  animatedPosition = mix(animatedPosition, introScattered, backgroundStar);
  animatedPosition = astraIntroMotion(
    animatedPosition,
    introScattered,
    mix(uIntroProgress, 1.0, backgroundStar),
    scatterZ,
    scatterY
  );

  float twinkle = 0.86 + 0.14 * sin(twinklePhase + uTime * uTwinkleSpeed * twinkleRate);
  vBrightness = uIntensity * starBrightness * twinkle;
  vColor = starColor;
  vOpacity = starOpacity * endpointVisibility * (0.92 + twinkle * 0.08);
  vRayStrength = smoothstep(1.45, 2.8, starBrightness);

  float introLocalProgress = astraParticleRevealProgress(uIntroProgress, scatterZ);
  float introParticleScale = sqrt(introLocalProgress);
  vOpacity *= smoothstep(0.0, 0.2, introLocalProgress);

  gl_PointSize = uPixelRatio
    * (0.35 + starScale * sizeEnvelope * endpointVisibility * 3.8)
    * (0.97 + twinkle * 0.03)
    * introParticleScale;

  vec4 viewPosition = modelViewMatrix * vec4(animatedPosition, 1.0);
  if (backgroundStar > 0.5) {
    viewPosition = viewMatrix * (uBackgroundModelMatrix * vec4(animatedPosition, 1.0));
  }
  vParticleDiameter = gl_PointSize;
  gl_PointSize = max(gl_PointSize, 4.0);
  gl_Position = projectionMatrix * viewPosition;
}
`;

const STAR_FRAGMENT = `
varying float vBrightness;
varying vec3 vColor;
varying float vOpacity;
varying float vRayStrength;
${ASTRA_FILTERED_CORE_GLSL}

void main() {
  vec2 pixel = (gl_PointCoord - vec2(0.5)) * max(vParticleDiameter, 4.0);
  vec2 point = pixel * 2.0 / max(vParticleDiameter, 0.0001);
  float distanceToCenter = length(point);
  float disc = 1.0 - smoothstep(0.08, 1.0, distanceToCenter);
  float core = pow(disc, 2.2);
  float horizontalRay = exp(-abs(point.y) * 28.0)
    * (1.0 - smoothstep(0.18, 1.0, abs(point.x)));
  float verticalRay = exp(-abs(point.x) * 28.0)
    * (1.0 - smoothstep(0.18, 1.0, abs(point.y)));
  float rays = max(horizontalRay, verticalRay) * 0.28 * vRayStrength;
  float resolved = smoothstep(2.0, 4.0, vParticleDiameter);
  float alpha = mix(astraFilteredCore(pixel, 0.150904), max(core, rays), resolved) * vOpacity;
  if (alpha <= 0.0) discard;

  float whiteCore = mix(0.59228, core, resolved)
    * smoothstep(0.9, 2.8, vBrightness)
    * 0.82;
  float colorEnergy = 1.0 - min(vColor.r, min(vColor.g, vColor.b));
  vec3 emission = mix(vColor, vec3(1.0), whiteCore)
    * vBrightness
    * (1.0 + colorEnergy * 0.42);
  gl_FragColor = vec4(emission, alpha);
}
`;

class AstraCurve extends THREE.Curve {
  constructor(source, depth, rotationDepth, depthPhase) {
    super();
    this.source = source;
    this.depth = depth;
    this.rotationDepth = rotationDepth;
    this.depthPhase = depthPhase;
    this.arcLengthDivisions = 640;
  }
  getPoint(t, target = new THREE.Vector3()) {
    const p = this.source.getPointAt(THREE.MathUtils.clamp(t, 0, 1));
    const envelope = Math.sin(t * Math.PI);
    const z = Math.sin(t * Math.PI * 1.35 + this.depthPhase)
      * this.depth * this.rotationDepth * envelope;
    return target.set(
      (p.x - 114.973) * (9.7 / 325),
      (211.36 - p.y) * (9.7 / 325),
      z,
    );
  }
}

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

function positiveModulo(value, mod) {
  return ((value % mod) + mod) % mod;
}

function densityProgress(value, amount) {
  const p = positiveModulo(value, 1);
  return p + THREE.MathUtils.clamp(amount, 0, 0.98) * Math.sin(p * Math.PI * 2) / (2 * Math.PI);
}

function writeStarColor(array, offset, seed) {
  const c = seed < 0.36 ? PALETTE[0]
    : seed < 0.52 ? PALETTE[1]
      : seed < 0.64 ? PALETTE[2]
        : seed < 0.74 ? PALETTE[3]
          : PALETTE[4];
  array[offset] = c.r;
  array[offset + 1] = c.g;
  array[offset + 2] = c.b;
}

function makePathTexture(curve) {
  const samples = new Float32Array(512 * 4);
  const p = new THREE.Vector3();
  for (let i = 0; i < 512; i++) {
    curve.getPointAt(i / 511, p);
    const o = i * 4;
    samples[o] = p.x;
    samples[o + 1] = p.y;
    samples[o + 2] = p.z;
    samples[o + 3] = 1;
  }
  const texture = new THREE.DataTexture(samples, 512, 1, THREE.RGBAFormat, THREE.FloatType);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

function makeMaterial(pathTexture, pixelRatio, intensity = CONFIG.stars.intensity) {
  return new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    transparent: true,
    toneMapped: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneFactor,
    blendEquationAlpha: THREE.AddEquation,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    vertexShader: STAR_VERTEX,
    fragmentShader: STAR_FRAGMENT,
    uniforms: {
      uIntensity: { value: intensity },
      uIntroProgress: { value: 0 },
      uBackgroundStarsEnabled: { value: 1 },
      uBackgroundModelMatrix: { value: new THREE.Matrix4() },
      uDensityFalloff: { value: CONFIG.stars.densityFalloff },
      uFlowSpeed: { value: CONFIG.stars.flowSpeed },
      uPathMotion: { value: pathTexture ? 1 : 0 },
      uPathOffset: { value: 0 },
      uPathSampleCount: { value: 512 },
      uPathSpeed: { value: 0 },
      uPathTexture: { value: pathTexture },
      uPixelRatio: { value: pixelRatio },
      uSizeFalloff: { value: CONFIG.stars.sizeFalloff },
      uTime: { value: 0 },
      uTwinkleSpeed: { value: CONFIG.stars.twinkleSpeed },
      uScatterSize: { value: new THREE.Vector2(12, 12) },
      uViewportAspect: { value: 1 },
    },
  });
}

function addParticleMotionUv(geometry, count, brightness) {
  const data = new Float32Array(count * 3);
  const side = Math.ceil(Math.sqrt(count));
  for (let i = 0; i < count; i++) {
    data[i * 3] = ((i % side) + 0.5) / side;
    data[i * 3 + 1] = (Math.floor(i / side) + 0.5) / side;
    data[i * 3 + 2] = THREE.MathUtils.lerp(0.65, 2.4, THREE.MathUtils.smoothstep(brightness[i], 1, 14));
  }
  geometry.setAttribute('particleMotionUv', new THREE.Float32BufferAttribute(data, 3));
}

function buildOrbit(curve, spec, index, mainCount, backgroundCount, pixelRatio) {
  const count = mainCount + backgroundCount;
  const positions = new Float32Array(count * 3);
  const orbitProgress = new Float32Array(count);
  const acrossOffset = new Float32Array(count);
  const brightness = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  const depthOffset = new Float32Array(count);
  const hero = new Float32Array(count);
  const background = new Float32Array(count);
  const opacity = new Float32Array(count);
  const scale = new Float32Array(count);
  const twinklePhase = new Float32Array(count);
  const twinkleRate = new Float32Array(count);

  const rand = seeded(0x243f6a88 ^ ((index + 1) * 0x9e3779b9));
  const colorRand = seeded(0xa4093822 ^ ((index + 1) * 0x299f31d0));
  const point = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const normal = new THREE.Vector3();
  let heroIndex = 0;
  let maxScale = -Infinity;

  for (let i = 0; i < count; i++) {
    const seed = rand();
    const progress = densityProgress(seed, CONFIG.stars.densityFalloff);
    const middle = Math.sin(progress * Math.PI);
    curve.getPointAt(progress, point);
    curve.getTangentAt(progress, tangent).normalize();
    normal.set(-tangent.y, tangent.x, 0).normalize();

    const width = CONFIG.stars.scatter
      * THREE.MathUtils.lerp(0.3, 1, middle)
      * (0.22 + 0.78 * rand());
    const across = (rand() + rand() - 1) * width;
    const depth = (rand() + rand() - 1) * width * 0.65;
    point.addScaledVector(normal, across);
    point.z += depth;

    const heroChance = THREE.MathUtils.lerp(
      (spec.strong ? 0.085 : 0.055) * 0.22,
      spec.strong ? 0.085 : 0.055,
      middle,
    );
    const isBright = rand() < heroChance;
    const starScale = (isBright ? 0.85 + 1.25 * rand() : 0.12 + rand() ** 2.4 * 0.68)
      * CONFIG.stars.size;
    const starBrightness = (isBright ? 2 + 1.5 * rand() : 0.56 + 0.78 * rand())
      * (spec.strong ? 1 : 0.82);

    const o = i * 3;
    positions[o] = point.x;
    positions[o + 1] = point.y;
    positions[o + 2] = point.z;
    orbitProgress[i] = seed;
    acrossOffset[i] = across;
    brightness[i] = starBrightness;
    writeStarColor(colors, o, colorRand());
    depthOffset[i] = depth;
    background[i] = i >= mainCount ? 1 : 0;
    opacity[i] = 0.82 + 0.16 * rand();
    scale[i] = starScale;
    twinklePhase[i] = rand() * Math.PI * 2;
    twinkleRate[i] = 0.65 + 0.7 * rand();

    if (i < mainCount && starScale > maxScale) {
      maxScale = starScale;
      heroIndex = i;
    }
  }

  scale[heroIndex] = Math.max(scale[heroIndex], (spec.strong ? 2.2 : 2.05) * CONFIG.stars.size);
  brightness[heroIndex] = Math.max(brightness[heroIndex], spec.strong ? 3.35 : 2.85);
  hero[heroIndex] = 1;
  writeStarColor(colors, heroIndex * 3, [0.08, 0.58, 0.22, 0.68, 0.44][index] ?? 0.08);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('orbitProgress', new THREE.BufferAttribute(orbitProgress, 1));
  geometry.setAttribute('starAcrossOffset', new THREE.BufferAttribute(acrossOffset, 1));
  geometry.setAttribute('starDepthOffset', new THREE.BufferAttribute(depthOffset, 1));
  geometry.setAttribute('starHero', new THREE.BufferAttribute(hero, 1));
  geometry.setAttribute('starBackground', new THREE.BufferAttribute(background, 1));
  geometry.setAttribute('starBrightness', new THREE.BufferAttribute(brightness, 1));
  geometry.setAttribute('starColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('starOpacity', new THREE.BufferAttribute(opacity, 1));
  geometry.setAttribute('starScale', new THREE.BufferAttribute(scale, 1));
  geometry.setAttribute('twinklePhase', new THREE.BufferAttribute(twinklePhase, 1));
  geometry.setAttribute('twinkleRate', new THREE.BufferAttribute(twinkleRate, 1));
  addParticleMotionUv(geometry, count, brightness);

  const pathTexture = makePathTexture(curve);
  const material = makeMaterial(pathTexture, pixelRatio);
  material.uniforms.uPathSpeed.value = spec.speed;
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 40 + index;

  const group = new THREE.Group();
  group.add(points);
  return {
    group,
    points,
    geometry,
    material,
    pathTexture,
    speed: spec.speed,
    phase: spec.phase,
    lag: 0.18 + 0.17 * index,
    motionOffset: 0,
    spin: new THREE.Vector2(),
  };
}

function buildCore(pixelRatio) {
  const count = Math.max(18, Math.round(24 * CONFIG.stars.density));
  const positions = new Float32Array(count * 3);
  const orbitProgress = new Float32Array(count);
  const across = new Float32Array(count);
  const depth = new Float32Array(count);
  const hero = new Float32Array(count);
  const background = new Float32Array(count);
  const brightness = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  const opacity = new Float32Array(count);
  const scale = new Float32Array(count);
  const phase = new Float32Array(count);
  const rate = new Float32Array(count);
  const rand = seeded(0xb7e15162);
  const colorRand = seeded(0xc0ac29b7);
  let best = 0;
  let bestEnergy = -Infinity;

  for (let i = 0; i < count; i++) {
    const radius = rand() ** 2.4 * 0.42;
    const angle = rand() * Math.PI * 2;
    const o = i * 3;
    positions[o] = Math.cos(angle) * radius;
    positions[o + 1] = Math.sin(angle) * radius * 0.72;
    positions[o + 2] = (rand() - 0.5) * 0.16;
    const center = 1 - radius / 0.42;
    brightness[i] = 1.2 + 2.8 * center + 0.6 * rand();
    writeStarColor(colors, o, center > 0.74 ? 0.99 : colorRand());
    opacity[i] = 0.62 + 0.38 * center;
    scale[i] = (0.28 + 1.45 * center + 0.45 * rand()) * CONFIG.stars.size * 0.8;
    phase[i] = rand() * Math.PI * 2;
    rate[i] = 0.55 + 0.45 * rand();
    const energy = brightness[i] * scale[i];
    if (energy > bestEnergy) {
      bestEnergy = energy;
      best = i;
    }
  }
  hero[best] = 1;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('orbitProgress', new THREE.BufferAttribute(orbitProgress, 1));
  geometry.setAttribute('starAcrossOffset', new THREE.BufferAttribute(across, 1));
  geometry.setAttribute('starDepthOffset', new THREE.BufferAttribute(depth, 1));
  geometry.setAttribute('starHero', new THREE.BufferAttribute(hero, 1));
  geometry.setAttribute('starBackground', new THREE.BufferAttribute(background, 1));
  geometry.setAttribute('starBrightness', new THREE.BufferAttribute(brightness, 1));
  geometry.setAttribute('starColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('starOpacity', new THREE.BufferAttribute(opacity, 1));
  geometry.setAttribute('starScale', new THREE.BufferAttribute(scale, 1));
  geometry.setAttribute('twinklePhase', new THREE.BufferAttribute(phase, 1));
  geometry.setAttribute('twinkleRate', new THREE.BufferAttribute(rate, 1));
  addParticleMotionUv(geometry, count, brightness);

  const material = makeMaterial(null, pixelRatio, CONFIG.stars.intensity * 1.22);
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 100;
  return { points, geometry, material };
}

function parseAuthoredCurves() {
  const svg = `<svg viewBox="0 0 231 325" xmlns="http://www.w3.org/2000/svg">${SVG_PATHS.map(d => `<path d="${d}"/>`).join('')}</svg>`;
  const parsed = new SVGLoader().parse(svg);
  return parsed.paths.map((path, i) => {
    const source = path.subPaths[0];
    return new AstraCurve(source, ORBIT_SPECS[i].depth, CONFIG.rotationDepth, 0.82 * i);
  });
}

const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: false,
  antialias: true,
  depth: false,
  powerPreference: 'high-performance',
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.setClearColor(0x000000, 1);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 40);
camera.position.set(0, 1.2, 12);

const animationRoot = new THREE.Group();
const spinRoot = new THREE.Group();
scene.add(animationRoot);
animationRoot.add(spinRoot);

const curves = parseAuthoredCurves();
const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
const orbits = [];
for (let i = 0; i < curves.length; i++) {
  const spec = ORBIT_SPECS[i];
  const mainCount = Math.max(8, Math.round((spec.strong ? 220 : 170) * CONFIG.stars.density));
  const backgroundCount = Math.ceil(0.12 * mainCount / 0.88);
  const orbit = buildOrbit(curves[i], spec, i, mainCount, backgroundCount, dpr);
  spinRoot.add(orbit.group);
  orbits.push(orbit);
}

const core = buildCore(dpr);
spinRoot.add(core.points);

spinRoot.position.set(0, -0.62, 0);
spinRoot.rotation.set(0.08, -0.06, -0.025);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(1, 1),
  CONFIG.bloomIntensity,
  0.72,
  CONFIG.bloomThreshold,
);
composer.addPass(bloom);
composer.addPass(new OutputPass());

let width = 1;
let height = 1;
let pixelRatio = dpr;
function resize() {
  const w = Math.max(1, Math.floor(canvas.clientWidth));
  const h = Math.max(1, Math.floor(canvas.clientHeight));
  const nextDpr = Math.min(window.devicePixelRatio || 1, 1.5);
  if (w === width && h === height && nextDpr === pixelRatio) return;
  width = w;
  height = h;
  pixelRatio = nextDpr;
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height, false);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(width, height);
  camera.left = -width / 2;
  camera.right = width / 2;
  camera.top = height / 2;
  camera.bottom = -height / 2;
  camera.zoom = height / 10.9;
  camera.updateProjectionMatrix();
  bloom.setSize(width, height);
  for (const orbit of orbits) {
    orbit.material.uniforms.uPixelRatio.value = pixelRatio;
    orbit.material.uniforms.uViewportAspect.value = width / Math.max(height, 1);
    orbit.material.uniforms.uBackgroundModelMatrix.value.copy(animationRoot.matrixWorld);
  }
  core.material.uniforms.uPixelRatio.value = pixelRatio;
  core.material.uniforms.uViewportAspect.value = width / Math.max(height, 1);
}

const pointer = {
  down: false,
  lastX: 0,
  lastY: 0,
  targetX: 0,
  targetY: 0,
  currentX: 0,
  currentY: 0,
};

canvas.addEventListener('pointerdown', (event) => {
  pointer.down = true;
  pointer.lastX = event.clientX;
  pointer.lastY = event.clientY;
  canvas.setPointerCapture?.(event.pointerId);
});
canvas.addEventListener('pointermove', (event) => {
  if (!pointer.down) return;
  const dx = event.clientX - pointer.lastX;
  const dy = event.clientY - pointer.lastY;
  pointer.lastX = event.clientX;
  pointer.lastY = event.clientY;
  pointer.targetY += dx * 0.0042;
  pointer.targetX += dy * 0.0038;
  const limit = Math.PI * 4;
  pointer.targetX = THREE.MathUtils.clamp(pointer.targetX, -limit, limit);
  pointer.targetY = THREE.MathUtils.clamp(pointer.targetY, -limit, limit);
});
function endPointer(event) {
  pointer.down = false;
  try { canvas.releasePointerCapture?.(event.pointerId); } catch {}
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

window.addEventListener('keydown', (event) => {
  const step = 0.13;
  if (event.key === 'ArrowLeft') pointer.targetY -= step;
  else if (event.key === 'ArrowRight') pointer.targetY += step;
  else if (event.key === 'ArrowUp') pointer.targetX -= step;
  else if (event.key === 'ArrowDown') pointer.targetX += step;
  else return;
  event.preventDefault();
});

const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
const started = performance.now();
let previousTime = started;
let coreTargetRotation = 0;
let coreRotation = 0;

function frame(now) {
  resize();
  const dt = Math.min((now - previousTime) / 1000, 0.05);
  previousTime = now;
  const elapsed = (now - started) / 1000;
  const intro = reducedMotion ? 1 : THREE.MathUtils.clamp(elapsed / CONFIG.convergeDuration, 0, 1);

  const pointerDamping = 1 - Math.exp(-(pointer.down ? 14 : 5.5) * dt);
  pointer.currentX = THREE.MathUtils.lerp(pointer.currentX, pointer.targetX, pointerDamping);
  pointer.currentY = THREE.MathUtils.lerp(pointer.currentY, pointer.targetY, pointerDamping);

  const rotationLag = 0.68;
  for (const orbit of orbits) {
    const lagDamping = 1 - Math.exp(-(14 / (1 + orbit.lag * rotationLag * 2.5)) * dt);
    orbit.spin.x = THREE.MathUtils.lerp(orbit.spin.x, pointer.currentX, lagDamping);
    orbit.spin.y = THREE.MathUtils.lerp(orbit.spin.y, pointer.currentY, lagDamping);
    orbit.group.rotation.set(
      orbit.spin.x - spinRoot.rotation.x,
      orbit.spin.y - spinRoot.rotation.y,
      0,
    );

    if (!reducedMotion) {
      orbit.motionOffset = positiveModulo(
        orbit.motionOffset + dt * orbit.speed * CONFIG.stars.flowSpeed,
        1,
      );
    }
    orbit.material.uniforms.uPathOffset.value = reducedMotion ? 0 : orbit.motionOffset;
    orbit.material.uniforms.uTime.value = reducedMotion ? 0 : elapsed;
    orbit.material.uniforms.uIntroProgress.value = intro;
    orbit.material.uniforms.uTwinkleSpeed.value = reducedMotion ? 0 : CONFIG.stars.twinkleSpeed;
    orbit.material.uniforms.uIntensity.value = CONFIG.stars.intensity;
  }

  if (CONFIG.showCenterCluster) {
    const direction = CONFIG.stars.flowInward ? 1 : -1;
    coreTargetRotation = positiveModulo(
      coreTargetRotation + dt * 0.36 * CONFIG.stars.flowSpeed * direction + Math.PI,
      Math.PI * 2,
    ) - Math.PI;
    const coreDamping = 1 - Math.exp(-14 * dt);
    const delta = Math.atan2(
      Math.sin(coreTargetRotation - coreRotation),
      Math.cos(coreTargetRotation - coreRotation),
    );
    coreRotation = positiveModulo(coreRotation + delta * coreDamping + Math.PI, Math.PI * 2) - Math.PI;
    core.points.rotation.set(
      reducedMotion ? 0 : 0.08 * Math.sin(0.22 * elapsed),
      reducedMotion ? 0 : 0.14 * Math.cos(0.28 * elapsed),
      reducedMotion ? 0 : coreRotation,
    );
    core.material.uniforms.uTime.value = reducedMotion ? 0 : elapsed;
    core.material.uniforms.uIntroProgress.value = intro;
    core.material.uniforms.uTwinkleSpeed.value = reducedMotion ? 0 : CONFIG.stars.twinkleSpeed;
  }

  animationRoot.updateMatrixWorld(true);
  for (const orbit of orbits) {
    orbit.material.uniforms.uBackgroundModelMatrix.value.copy(animationRoot.matrixWorld);
  }

  composer.render(dt);
  requestAnimationFrame(frame);
}

window.addEventListener('resize', resize, { passive: true });
resize();
requestAnimationFrame(frame);
