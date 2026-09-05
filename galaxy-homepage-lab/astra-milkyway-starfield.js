import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const canvas = document.getElementById('galaxyCanvas');
if (!canvas) throw new Error('Galaxy canvas is required.');

// Keep Astra's optical language intact: filtered sub-pixel core, white-hot
// resolved cores, temperature palette, twinkle and bloom. Only the spatial
// distribution changes here: stars now form our own 3D Milky Way sky.
const CONFIG = Object.freeze({
  bloomIntensity: 0.54,
  bloomThreshold: 0.16,
  bloomRadius: 0.52,
  intensity: 1.35,
  size: 2.05,
  twinkleSpeed: 0.62,
  starCount: 14800,
  backgroundFraction: 0.27,
  fov: 55,
  near: 0.1,
  far: 54,
});

const PALETTE = [
  new THREE.Color('#6DCBF4'),
  new THREE.Color('#7AB1FE'),
  new THREE.Color('#F87915'),
  new THREE.Color('#FA994C'),
  new THREE.Color('#F5F6FB'),
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

const STAR_VERTEX = `
attribute float starBrightness;
attribute vec3 starColor;
attribute float starOpacity;
attribute float starScale;
attribute float twinklePhase;
attribute float twinkleRate;

uniform float uIntensity;
uniform float uIntroProgress;
uniform float uPixelRatio;
uniform float uTime;
uniform float uTwinkleSpeed;

varying float vBrightness;
varying vec3 vColor;
varying float vOpacity;
varying float vRayStrength;
${ASTRA_FILTERED_CORE_GLSL}

float astraParticleRevealProgress(float progress, float seed) {
  float delay = seed * 0.015;
  return smoothstep(delay, 0.14 + delay, progress)
    * mix(0.2, 1.0, smoothstep(0.2, 1.0, progress));
}

void main() {
  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
  float cameraDepth = max(-viewPosition.z, 0.2);

  float twinkle = 0.86 + 0.14 * sin(twinklePhase + uTime * uTwinkleSpeed * twinkleRate);
  vBrightness = uIntensity * starBrightness * twinkle;
  vColor = starColor;
  vOpacity = starOpacity * (0.92 + twinkle * 0.08);
  vRayStrength = smoothstep(1.45, 2.8, starBrightness);

  float revealSeed = fract(twinklePhase * 0.159 + starScale * 0.317);
  float introLocalProgress = astraParticleRevealProgress(uIntroProgress, revealSeed);
  float introParticleScale = sqrt(introLocalProgress);
  vOpacity *= smoothstep(0.0, 0.2, introLocalProgress);

  float depthScale = clamp(8.5 / cameraDepth, 0.28, 2.05);
  float opticalDiameter = uPixelRatio
    * (0.35 + starScale * 3.8)
    * depthScale
    * (0.97 + twinkle * 0.03)
    * introParticleScale;

  // Keep Astra's optical diameter, but render it inside a larger transparent
  // point sprite. This gives the radial falloff enough room to reach near-zero
  // before the square sprite boundary, so bloom no longer reveals that boundary.
  vParticleDiameter = opticalDiameter;
  gl_PointSize = max(opticalDiameter * 1.55, 6.0);
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
  float spriteDiameter = max(vParticleDiameter * 1.55, 6.0);
  vec2 pixel = (gl_PointCoord - vec2(0.5)) * spriteDiameter;
  vec2 point = pixel * 2.0 / max(vParticleDiameter, 0.0001);
  float r2 = dot(point, point);
  float r = sqrt(r2);

  // Sub-pixel stars retain Astra's filtered coverage. Resolved stars switch to
  // a radial optical model so their glow source is circular rather than a
  // magnified square point-sprite footprint.
  float filteredCore = astraFilteredCore(pixel, 0.150904);
  float needle = exp(-r2 * 42.0);
  float photosphere = exp(-r2 * 10.5);
  float corona = exp(-r2 * 3.2);

  float horizontalRay = exp(-abs(point.y) * 34.0)
    * exp(-abs(point.x) * 2.9)
    * (1.0 - smoothstep(0.20, 1.55, abs(point.x)));
  float verticalRay = exp(-abs(point.x) * 34.0)
    * exp(-abs(point.y) * 2.9)
    * (1.0 - smoothstep(0.20, 1.55, abs(point.y)));
  float rays = max(horizontalRay, verticalRay) * 0.16 * vRayStrength;

  float resolved = smoothstep(1.25, 2.85, vParticleDiameter);
  float radialAlpha = clamp(
      needle * 1.18
    + photosphere * 0.72
    + corona * 0.16
    + rays,
    0.0,
    1.0
  );

  // Extra radial guard removes any residual corner energy before the sprite edge.
  float edgeGuard = 1.0 - smoothstep(1.52, 2.05, r);
  radialAlpha *= edgeGuard;

  float alpha = mix(filteredCore, radialAlpha, resolved) * vOpacity;
  if (alpha <= 0.00008) discard;

  float whiteCore = clamp(
      needle * 1.12
    + photosphere * 0.36,
    0.0,
    1.0
  ) * smoothstep(0.9, 2.8, vBrightness) * 0.86;

  float colorEnergy = 1.0 - min(vColor.r, min(vColor.g, vColor.b));
  vec3 emission = mix(vColor, vec3(1.0), whiteCore)
    * vBrightness
    * (1.0 + colorEnergy * 0.42);

  gl_FragColor = vec4(emission, alpha);
}
`;

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

const random = seeded(0xA57A2D31);

function gaussian() {
  const u = Math.max(random(), 1e-7);
  const v = Math.max(random(), 1e-7);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
}

function pickAstraColor(seed, centreWeight = 0) {
  // Preserve Astra's palette, but let the denser galactic-centre region contain
  // slightly more white/warm stars. This changes population, not star rendering.
  const adjusted = centreWeight > 0 && random() < centreWeight * 0.28
    ? 0.64 + random() * 0.36
    : seed;
  if (adjusted < 0.36) return PALETTE[0];
  if (adjusted < 0.52) return PALETTE[1];
  if (adjusted < 0.64) return PALETTE[2];
  if (adjusted < 0.74) return PALETTE[3];
  return PALETTE[4];
}

function sampleDepth(isBand) {
  const shell = random();
  if (isBand) {
    if (shell < 0.045) return 4.5 + Math.pow(random(), 0.72) * 6.0;
    if (shell < 0.36) return 9.0 + Math.pow(random(), 0.78) * 15.0;
    return 18.0 + Math.pow(random(), 0.88) * 31.0;
  }
  if (shell < 0.08) return 3.2 + Math.pow(random(), 0.72) * 6.8;
  if (shell < 0.42) return 8.0 + Math.pow(random(), 0.78) * 14.0;
  return 17.0 + Math.pow(random(), 0.86) * 30.0;
}

function sampleMilkyWayDirection() {
  // Angular-space layout only determines where rays leave the observer. Every
  // accepted star still receives an independent physical depth, so the band is
  // a real 3D volume with parallax rather than a textured screen stripe.
  for (let guard = 0; guard < 40; guard++) {
    const complex = random();
    let along;
    if (complex < 0.16) along = -0.58 + gaussian() * 0.16;
    else if (complex < 0.36) along = -0.10 + gaussian() * 0.18;
    else if (complex < 0.58) along = 0.28 + gaussian() * 0.17;
    else if (complex < 0.72) along = 0.63 + gaussian() * 0.13;
    else along = random() * 2.55 - 1.28;

    along = THREE.MathUtils.clamp(along, -1.34, 1.34);
    const centreWeight = Math.exp(-Math.pow((along - 0.18) / 0.38, 2));
    const width = 0.070
      + 0.050 * (1 - Math.min(1, Math.abs(along) / 1.34))
      + 0.040 * centreWeight;

    const centreLine = 0.025 * Math.sin(along * 2.6 + 0.45)
      + 0.014 * Math.sin(along * 6.4 - 0.8);
    let across = centreLine + gaussian() * width;

    // Reserve a broken Great-Rift-like underdensity using missing stars only.
    // No black paint, fog or 2D mask is introduced at this stage.
    const rift = centreLine
      + 0.010 * Math.sin(along * 7.2 + 0.6)
      - 0.008 * Math.sin(along * 13.0);
    const riftWidth = 0.014 + centreWeight * 0.013;
    const inRift = Math.abs(across - rift) < riftWidth;
    const riftStrength = 0.42 + 0.36 * centreWeight;
    if (inRift && random() < riftStrength) continue;

    // Give the band ragged rather than Gaussian-clean outer edges.
    across += (random() - 0.5) * 0.010 * (1 + Math.abs(along));
    return { along, across, centreWeight };
  }
  return { along: random() * 2.4 - 1.2, across: gaussian() * 0.11, centreWeight: 0 };
}

function buildSpatialStarfield() {
  const count = CONFIG.starCount;
  const positions = new Float32Array(count * 3);
  const brightness = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  const opacity = new Float32Array(count);
  const scale = new Float32Array(count);
  const phase = new Float32Array(count);
  const rate = new Float32Array(count);

  const fovTan = Math.tan(THREE.MathUtils.degToRad(CONFIG.fov * 0.5));
  const designAspect = 2.2;
  const bandAngle = THREE.MathUtils.degToRad(34);
  const bandCos = Math.cos(bandAngle);
  const bandSin = Math.sin(bandAngle);

  for (let i = 0; i < count; i++) {
    const isBand = random() >= CONFIG.backgroundFraction;
    const depth = sampleDepth(isBand);
    const halfHeight = fovTan * depth * 1.30;
    const halfWidth = halfHeight * designAspect;

    let x;
    let y;
    let centreWeight = 0;

    if (isBand) {
      const band = sampleMilkyWayDirection();
      centreWeight = band.centreWeight;

      // Rotate our authored galactic coordinates into the viewport. These are
      // angular directions, then expanded by depth into physical x/y positions.
      const nx = band.along * bandCos - band.across * bandSin;
      const ny = band.along * bandSin + band.across * bandCos;
      x = nx * halfWidth * 0.82;
      y = ny * halfHeight * 1.04;

      // True 3D thickness: nearby and far stars do not sit on one mathematical
      // sheet. The perturbation scales less than linearly with distance.
      const spatialThickness = 0.018 + 0.022 * (1 - centreWeight);
      x += gaussian() * depth * spatialThickness;
      y += gaussian() * depth * spatialThickness * 0.55;
    } else {
      x = (random() * 2 - 1) * halfWidth;
      y = (random() * 2 - 1) * halfHeight;
    }

    const o = i * 3;
    positions[o] = x;
    positions[o + 1] = y;
    positions[o + 2] = -depth;

    const chance = random();
    let starScale;
    let starBrightness;
    let starOpacity;

    const heroCutoff = isBand ? 0.9978 - centreWeight * 0.0008 : 0.9987;
    const brightCutoff = isBand ? 0.979 - centreWeight * 0.005 : 0.985;

    if (chance > heroCutoff) {
      starScale = (1.45 + random() * 0.85) * CONFIG.size;
      starBrightness = 3.05 + random() * 0.75;
      starOpacity = 0.90 + random() * 0.09;
    } else if (chance > brightCutoff) {
      starScale = (0.62 + random() * 0.82) * CONFIG.size;
      starBrightness = 1.75 + random() * 1.12;
      starOpacity = 0.74 + random() * 0.22;
    } else {
      const densityPresence = isBand ? 0.92 + centreWeight * 0.15 : 0.78;
      starScale = (0.055 + Math.pow(random(), 2.65) * 0.34) * CONFIG.size;
      starBrightness = (0.54 + random() * 0.82) * densityPresence;
      starOpacity = (0.18 + random() * 0.58) * densityPresence;
    }

    const depthQuiet = THREE.MathUtils.clamp(1.12 - depth / 80, 0.58, 1.0);
    brightness[i] = starBrightness * depthQuiet;
    opacity[i] = starOpacity * (0.72 + 0.28 * depthQuiet);
    scale[i] = starScale;
    phase[i] = random() * Math.PI * 2;
    rate[i] = 0.65 + random() * 0.70;

    const color = pickAstraColor(random(), isBand ? centreWeight : 0);
    colors[o] = color.r;
    colors[o + 1] = color.g;
    colors[o + 2] = color.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('starBrightness', new THREE.BufferAttribute(brightness, 1));
  geometry.setAttribute('starColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('starOpacity', new THREE.BufferAttribute(opacity, 1));
  geometry.setAttribute('starScale', new THREE.BufferAttribute(scale, 1));
  geometry.setAttribute('twinklePhase', new THREE.BufferAttribute(phase, 1));
  geometry.setAttribute('twinkleRate', new THREE.BufferAttribute(rate, 1));

  const material = new THREE.ShaderMaterial({
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
      uIntensity: { value: CONFIG.intensity },
      uIntroProgress: { value: 0 },
      uPixelRatio: { value: 1 },
      uTime: { value: 0 },
      uTwinkleSpeed: { value: CONFIG.twinkleSpeed },
    },
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return { points, geometry, material };
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

const camera = new THREE.PerspectiveCamera(CONFIG.fov, 1, CONFIG.near, CONFIG.far);
camera.position.set(0, 0, 0);

const field = buildSpatialStarfield();
scene.add(field.points);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(1, 1),
  CONFIG.bloomIntensity,
  CONFIG.bloomRadius,
  CONFIG.bloomThreshold,
);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
const pointer = {
  targetX: 0,
  targetY: 0,
  currentX: 0,
  currentY: 0,
};

let width = 1;
let height = 1;
let pixelRatio = 1;

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
  bloom.setSize(width, height);

  camera.aspect = width / Math.max(height, 1);
  camera.updateProjectionMatrix();
  field.material.uniforms.uPixelRatio.value = pixelRatio;
}

function shapeAxis(value) {
  const dead = 0.045;
  const a = Math.abs(value);
  if (a <= dead) return 0;
  const n = Math.min(1, (a - dead) / (1 - dead));
  return Math.sign(value) * n * n * (3 - 2 * n);
}

window.addEventListener('pointermove', (event) => {
  if (reducedMotion) return;
  pointer.targetX = shapeAxis(event.clientX / Math.max(window.innerWidth, 1) * 2 - 1);
  pointer.targetY = shapeAxis(-(event.clientY / Math.max(window.innerHeight, 1) * 2 - 1));
}, { passive: true });

function resetPointer() {
  pointer.targetX = 0;
  pointer.targetY = 0;
}
window.addEventListener('pointerleave', resetPointer, { passive: true });
window.addEventListener('blur', resetPointer, { passive: true });

function damp(current, target, speed, dt) {
  return current + (target - current) * (1 - Math.exp(-speed * dt));
}

const started = performance.now();
let previous = started;
const lookTarget = new THREE.Vector3();

function frame(now) {
  resize();

  const dt = Math.min(0.05, Math.max(0.001, (now - previous) / 1000));
  previous = now;
  const elapsed = (now - started) / 1000;

  pointer.currentX = damp(pointer.currentX, pointer.targetX, 2.7, dt);
  pointer.currentY = damp(pointer.currentY, pointer.targetY, 2.7, dt);

  if (!reducedMotion) {
    camera.position.x = pointer.currentX * 0.34;
    camera.position.y = pointer.currentY * 0.20;
    lookTarget.set(
      pointer.currentX * 1.05,
      pointer.currentY * 0.62,
      -12,
    );
    camera.lookAt(lookTarget);
  } else {
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -12);
  }

  const intro = reducedMotion ? 1 : THREE.MathUtils.clamp(elapsed / 1.65, 0, 1);
  field.material.uniforms.uIntroProgress.value = intro;
  field.material.uniforms.uTime.value = reducedMotion ? 0 : elapsed;
  field.material.uniforms.uTwinkleSpeed.value = reducedMotion ? 0 : CONFIG.twinkleSpeed;

  composer.render(dt);
  requestAnimationFrame(frame);
}

window.addEventListener('resize', resize, { passive: true });
resize();
requestAnimationFrame(frame);
