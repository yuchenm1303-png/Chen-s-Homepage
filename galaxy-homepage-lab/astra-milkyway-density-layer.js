import * as THREE from 'three';

const canvas = document.getElementById('galaxyDensityCanvas');
if (!canvas) throw new Error('Milky Way density canvas is required.');

const CONFIG = Object.freeze({
  starCount: 26000,
  fov: 55,
  near: 0.1,
  far: 56,
  intensity: 0.92,
  twinkleSpeed: 0.48,
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
uniform float uPixelRatio;
uniform float uTime;
uniform float uTwinkleSpeed;

varying float vBrightness;
varying vec3 vColor;
varying float vOpacity;
${ASTRA_FILTERED_CORE_GLSL}

void main() {
  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
  float cameraDepth = max(-viewPosition.z, 0.2);
  float depthScale = clamp(7.6 / cameraDepth, 0.24, 1.28);
  float twinkle = 0.90 + 0.10 * sin(twinklePhase + uTime * uTwinkleSpeed * twinkleRate);

  vBrightness = uIntensity * starBrightness * twinkle;
  vColor = starColor;
  vOpacity = starOpacity * (0.94 + twinkle * 0.06);

  gl_PointSize = uPixelRatio
    * (0.26 + starScale * 3.1)
    * depthScale
    * (0.98 + twinkle * 0.02);
  vParticleDiameter = gl_PointSize;
  gl_PointSize = max(gl_PointSize, 4.0);
  gl_Position = projectionMatrix * viewPosition;
}
`;

const STAR_FRAGMENT = `
varying float vBrightness;
varying vec3 vColor;
varying float vOpacity;
${ASTRA_FILTERED_CORE_GLSL}

void main() {
  vec2 pixel = (gl_PointCoord - vec2(0.5)) * max(vParticleDiameter, 4.0);
  float alpha = astraFilteredCore(pixel, 0.150904) * vOpacity;
  if (alpha <= 0.00001) discard;
  gl_FragColor = vec4(vColor * vBrightness, alpha);
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

const random = seeded(0x4D494C4B);

function gaussian() {
  const u = Math.max(random(), 1e-7);
  const v = Math.max(random(), 1e-7);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
}

function pickColor(centreWeight) {
  let seed = random();
  if (centreWeight > 0 && random() < centreWeight * 0.38) {
    seed = 0.60 + random() * 0.40;
  }
  if (seed < 0.34) return PALETTE[0];
  if (seed < 0.50) return PALETTE[1];
  if (seed < 0.60) return PALETTE[2];
  if (seed < 0.70) return PALETTE[3];
  return PALETTE[4];
}

function sampleDepth() {
  const shell = random();
  if (shell < 0.035) return 5.0 + Math.pow(random(), 0.74) * 6.0;
  if (shell < 0.30) return 9.0 + Math.pow(random(), 0.80) * 13.0;
  return 17.0 + Math.pow(random(), 0.90) * 33.0;
}

function sampleAlong() {
  const mode = random();
  if (mode < 0.10) return -0.94 + gaussian() * 0.13;
  if (mode < 0.22) return -0.62 + gaussian() * 0.15;
  if (mode < 0.36) return -0.27 + gaussian() * 0.14;
  if (mode < 0.55) return 0.10 + gaussian() * 0.16;
  if (mode < 0.73) return 0.38 + gaussian() * 0.15;
  if (mode < 0.86) return 0.70 + gaussian() * 0.14;
  return random() * 2.82 - 1.41;
}

function sampleMilkyWayDirection() {
  for (let guard = 0; guard < 64; guard++) {
    const along = THREE.MathUtils.clamp(sampleAlong(), -1.46, 1.46);
    const centreWeight = Math.exp(-Math.pow((along - 0.18) / 0.34, 2));
    const midWeight = Math.exp(-Math.pow(along / 0.88, 2));

    const centreLine = 0.028 * Math.sin(along * 2.35 + 0.38)
      + 0.013 * Math.sin(along * 6.1 - 0.62);

    const baseWidth = 0.092
      + midWeight * 0.034
      + centreWeight * 0.060;

    const halo = random() < 0.22;
    const width = baseWidth * (halo ? 1.72 : 0.92);
    const ridgeOffset = 0.018 * Math.sin(along * 3.1 - 0.4)
      + 0.010 * Math.sin(along * 8.4 + 1.2);
    let across = centreLine + ridgeOffset + gaussian() * width;

    const mainRift = centreLine
      + 0.010 * Math.sin(along * 5.9 + 0.55)
      - 0.013 * Math.sin(along * 11.8 - 0.3);
    const mainRiftWidth = 0.018 + centreWeight * 0.020 + midWeight * 0.006;
    if (Math.abs(across - mainRift) < mainRiftWidth) {
      const reject = 0.74 + centreWeight * 0.18;
      if (random() < reject) continue;
    }

    const secondaryWindow = Math.exp(-Math.pow((along - 0.24) / 0.58, 2));
    const secondaryRift = centreLine - 0.060
      + 0.013 * Math.sin(along * 9.2 + 1.1);
    if (Math.abs(across - secondaryRift) < 0.014 + secondaryWindow * 0.010) {
      if (random() < 0.30 + secondaryWindow * 0.34) continue;
    }

    // Break the Gaussian edges into stellar cloud complexes instead of a clean ribbon.
    const cloudModulation = 0.76
      + 0.15 * Math.sin(along * 10.7 + across * 25.0)
      + 0.12 * Math.sin(along * 19.1 - across * 17.0);
    if (random() > THREE.MathUtils.clamp(cloudModulation, 0.42, 1.0)) continue;

    across += gaussian() * 0.007 * (1.0 + Math.abs(along) * 0.35);
    return { along, across, centreWeight, halo };
  }

  return {
    along: random() * 2.6 - 1.3,
    across: gaussian() * 0.14,
    centreWeight: 0,
    halo: true,
  };
}

function buildDensityField() {
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
    const depth = sampleDepth();
    const halfHeight = fovTan * depth * 1.30;
    const halfWidth = halfHeight * designAspect;
    const band = sampleMilkyWayDirection();

    const nx = band.along * bandCos - band.across * bandSin;
    const ny = band.along * bandSin + band.across * bandCos;

    let x = nx * halfWidth * 0.83;
    let y = ny * halfHeight * 1.04;

    // A real depth thickness keeps the dense lane volumetric during camera motion.
    const depthThickness = (band.halo ? 0.030 : 0.014)
      + (1 - band.centreWeight) * 0.010;
    x += gaussian() * depth * depthThickness;
    y += gaussian() * depth * depthThickness * 0.54;

    const o = i * 3;
    positions[o] = x;
    positions[o + 1] = y;
    positions[o + 2] = -depth;

    const centreBoost = 0.82 + band.centreWeight * 0.34;
    const haloQuiet = band.halo ? 0.70 : 1.0;
    const depthQuiet = THREE.MathUtils.clamp(1.08 - depth / 92, 0.60, 1.0);

    brightness[i] = (0.48 + random() * 0.70) * centreBoost * haloQuiet * depthQuiet;
    opacity[i] = (0.16 + random() * 0.46) * centreBoost * haloQuiet;
    scale[i] = 0.055 + Math.pow(random(), 2.45) * 0.28;
    phase[i] = random() * Math.PI * 2;
    rate[i] = 0.66 + random() * 0.62;

    const color = pickColor(band.centreWeight);
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
  alpha: true,
  antialias: true,
  depth: false,
  premultipliedAlpha: false,
  powerPreference: 'high-performance',
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(CONFIG.fov, 1, CONFIG.near, CONFIG.far);
camera.position.set(0, 0, 0);

const field = buildDensityField();
scene.add(field.points);

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
    lookTarget.set(pointer.currentX * 1.05, pointer.currentY * 0.62, -12);
    camera.lookAt(lookTarget);
  } else {
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -12);
  }

  field.material.uniforms.uTime.value = reducedMotion ? 0 : elapsed;
  field.material.uniforms.uTwinkleSpeed.value = reducedMotion ? 0 : CONFIG.twinkleSpeed;

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

window.addEventListener('resize', resize, { passive: true });
resize();
requestAnimationFrame(frame);
