import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const canvas = document.getElementById('galaxyCanvas');
if (!canvas) throw new Error('Galaxy canvas is required.');

// Astra's authored star rendering language is kept intact here: palette,
// sub-pixel filtered core, white-hot resolved cores, twinkle and bloom.
// Only the authored SVG/orbit layout has been removed. Positions now belong to
// our own perspective 3D star volume so later camera motion cannot expose a 2D plate.
const CONFIG = Object.freeze({
  bloomIntensity: 0.7,
  bloomThreshold: 0.08,
  bloomRadius: 0.72,
  intensity: 1.35,
  size: 2.05,
  twinkleSpeed: 0.62,
  starCount: 11800,
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

  // The official Astra renderer uses an orthographic camera. Our layout is a
  // true perspective volume, so the only spatial adaptation is a restrained
  // depth scale. The particle's optical construction remains unchanged.
  float depthScale = clamp(8.5 / cameraDepth, 0.28, 2.05);
  gl_PointSize = uPixelRatio
    * (0.35 + starScale * 3.8)
    * depthScale
    * (0.97 + twinkle * 0.03)
    * introParticleScale;

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

function pickAstraColor(seed) {
  if (seed < 0.36) return PALETTE[0];
  if (seed < 0.52) return PALETTE[1];
  if (seed < 0.64) return PALETTE[2];
  if (seed < 0.74) return PALETTE[3];
  return PALETTE[4];
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

  for (let i = 0; i < count; i++) {
    // Three broad depth populations create natural parallax without arranging
    // stars into any galaxy, spiral, logo or screen-space path.
    const shell = random();
    let depth;
    if (shell < 0.08) depth = 3.2 + Math.pow(random(), 0.72) * 6.8;
    else if (shell < 0.42) depth = 8.0 + Math.pow(random(), 0.78) * 14.0;
    else depth = 17.0 + Math.pow(random(), 0.86) * 30.0;

    const halfHeight = fovTan * depth * 1.30;
    const halfWidth = halfHeight * designAspect;

    // Mostly uniform sky with only very soft stochastic clustering. This is not
    // a Milky Way structure; it simply avoids a visibly synthetic even grid.
    const clusterMix = random();
    let x = (random() * 2 - 1) * halfWidth;
    let y = (random() * 2 - 1) * halfHeight;
    if (clusterMix < 0.17) {
      const anchorX = (random() * 2 - 1) * halfWidth * 0.82;
      const anchorY = (random() * 2 - 1) * halfHeight * 0.82;
      x = THREE.MathUtils.clamp(anchorX + gaussian() * halfWidth * 0.10, -halfWidth, halfWidth);
      y = THREE.MathUtils.clamp(anchorY + gaussian() * halfHeight * 0.10, -halfHeight, halfHeight);
    }

    const o = i * 3;
    positions[o] = x;
    positions[o + 1] = y;
    positions[o + 2] = -depth;

    const chance = random();
    let starScale;
    let starBrightness;
    let starOpacity;

    if (chance > 0.9984) {
      starScale = (1.45 + random() * 0.85) * CONFIG.size;
      starBrightness = 3.05 + random() * 0.75;
      starOpacity = 0.90 + random() * 0.09;
    } else if (chance > 0.983) {
      starScale = (0.62 + random() * 0.82) * CONFIG.size;
      starBrightness = 1.75 + random() * 1.12;
      starOpacity = 0.74 + random() * 0.22;
    } else {
      starScale = (0.055 + Math.pow(random(), 2.65) * 0.34) * CONFIG.size;
      starBrightness = 0.54 + random() * 0.82;
      starOpacity = 0.18 + random() * 0.58;
    }

    // Distant stars are quieter; near stars gain presence through geometry and
    // perspective instead of arbitrary screen-space scaling.
    const depthQuiet = THREE.MathUtils.clamp(1.12 - depth / 80, 0.58, 1.0);
    brightness[i] = starBrightness * depthQuiet;
    opacity[i] = starOpacity * (0.72 + 0.28 * depthQuiet);
    scale[i] = starScale;
    phase[i] = random() * Math.PI * 2;
    rate[i] = 0.65 + random() * 0.70;

    const color = pickAstraColor(random());
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
    // Translation plus orientation both happen in camera space. Different depth
    // shells therefore respond differently without any fake per-layer offsets.
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
