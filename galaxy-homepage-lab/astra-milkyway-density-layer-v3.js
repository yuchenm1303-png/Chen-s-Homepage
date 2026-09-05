import * as THREE from 'three';

const canvas = document.getElementById('galaxyDensityCanvas');
if (!canvas) throw new Error('Milky Way density canvas is required.');

const CONFIG = Object.freeze({
  starCount: 118000,
  fov: 55,
  near: 0.1,
  far: 60,
  intensity: 1.22,
  twinkleSpeed: 0.30,
});

const PALETTE = [
  new THREE.Color('#EAF1F8'),
  new THREE.Color('#DDEBFA'),
  new THREE.Color('#BFDFFF'),
  new THREE.Color('#F3D2B2'),
  new THREE.Color('#E9B287'),
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
  float depthScale = clamp(8.6 / cameraDepth, 0.24, 1.16);
  float twinkle = 0.95 + 0.05 * sin(twinklePhase + uTime * uTwinkleSpeed * twinkleRate);

  vBrightness = uIntensity * starBrightness * twinkle;
  vColor = starColor;
  vOpacity = starOpacity * (0.97 + twinkle * 0.03);

  float opticalDiameter = uPixelRatio
    * (0.30 + starScale * 3.4)
    * depthScale
    * (0.995 + twinkle * 0.005);

  // The previous density layer allowed distant stars to collapse far below one
  // pixel. Astra's filtered core then multiplied that tiny diameter by itself,
  // making most of the nominal 76k stars effectively invisible. Preserve the
  // sub-pixel look, but keep a minimum physical coverage footprint.
  vParticleDiameter = max(opticalDiameter, uPixelRatio * 0.72);
  gl_PointSize = max(vParticleDiameter, 4.0);
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
  float alpha = astraFilteredCore(pixel, 0.185) * vOpacity;
  if (alpha <= 0.000008) discard;
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

const random = seeded(0x4D494C5A);

function gaussian() {
  const u = Math.max(random(), 1e-7);
  const v = Math.max(random(), 1e-7);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
}

function gaussianWeight(value, centre, width) {
  return Math.exp(-Math.pow((value - centre) / width, 2));
}

function pickColor(centreWeight) {
  const seed = random();
  if (seed < 0.50 - centreWeight * 0.08) return PALETTE[0];
  if (seed < 0.70) return PALETTE[1];
  if (seed < 0.84 - centreWeight * 0.05) return PALETTE[2];
  if (seed < 0.96) return PALETTE[3];
  return PALETTE[4];
}

function sampleDepth() {
  const shell = random();
  if (shell < 0.012) return 5.5 + Math.pow(random(), 0.78) * 7.0;
  if (shell < 0.14) return 11.0 + Math.pow(random(), 0.84) * 14.0;
  return 20.0 + Math.pow(random(), 0.92) * 36.0;
}

function sampleAlong() {
  const mode = random();
  if (mode < 0.10) return -1.08 + gaussian() * 0.13;
  if (mode < 0.23) return -0.74 + gaussian() * 0.15;
  if (mode < 0.37) return -0.38 + gaussian() * 0.15;
  if (mode < 0.58) return 0.00 + gaussian() * 0.17;
  if (mode < 0.78) return 0.31 + gaussian() * 0.15;
  if (mode < 0.90) return 0.68 + gaussian() * 0.16;
  return random() * 3.12 - 1.56;
}

function sampleMilkyWayDirection() {
  for (let guard = 0; guard < 112; guard++) {
    const along = THREE.MathUtils.clamp(sampleAlong(), -1.58, 1.58);
    const centreWeight = gaussianWeight(along, 0.20, 0.38);
    const broadWeight = gaussianWeight(along, 0.03, 1.14);

    const centreLine =
      0.024 * Math.sin(along * 2.05 + 0.32)
      + 0.014 * Math.sin(along * 5.5 - 0.50);

    const baseWidth =
      0.155
      + broadWeight * 0.072
      + centreWeight * 0.155;

    const populationRoll = random();
    let population = 0;
    let widthScale = 0.72;
    if (populationRoll > 0.64 && populationRoll <= 0.90) {
      population = 1;
      widthScale = 1.24;
    } else if (populationRoll > 0.90) {
      population = 2;
      widthScale = 2.12;
    }

    const bulge = centreWeight > 0.08 && random() < centreWeight * 0.56;
    if (bulge) widthScale *= 1.42;

    const ridgeOffset =
      0.022 * Math.sin(along * 2.9 - 0.34)
      + 0.012 * Math.sin(along * 7.7 + 1.10);

    let across = centreLine + ridgeOffset + gaussian() * baseWidth * widthScale;

    const mainRift =
      centreLine
      + 0.016 * Math.sin(along * 5.1 + 0.62)
      - 0.018 * Math.sin(along * 10.5 - 0.18);

    const mainRiftWidth =
      0.032
      + broadWeight * 0.010
      + centreWeight * 0.046;

    if (Math.abs(across - mainRift) < mainRiftWidth) {
      const rejectBase = population === 0 ? 0.96 : population === 1 ? 0.84 : 0.54;
      if (random() < Math.min(0.992, rejectBase + centreWeight * 0.03)) continue;
    }

    const branchWindow = gaussianWeight(along, 0.24, 0.64);
    const branchRift =
      centreLine
      - 0.095
      + 0.018 * Math.sin(along * 8.2 + 1.08);

    if (Math.abs(across - branchRift) < 0.020 + branchWindow * 0.018) {
      const reject = (population === 0 ? 0.68 : population === 1 ? 0.44 : 0.22)
        * branchWindow;
      if (random() < reject) continue;
    }

    const complexA = gaussianWeight(along, -0.86, 0.22);
    const complexB = gaussianWeight(along, -0.30, 0.20);
    const complexC = gaussianWeight(along, 0.13, 0.23);
    const complexD = gaussianWeight(along, 0.56, 0.22);
    const complexPeak = Math.max(complexA, complexB, complexC, complexD);

    const granular =
      0.76
      + 0.10 * Math.sin(along * 11.6 + across * 16.0)
      + 0.08 * Math.sin(along * 20.7 - across * 23.0);

    const survival = THREE.MathUtils.clamp(
      granular + complexPeak * 0.20 + centreWeight * 0.10,
      population === 2 ? 0.42 : 0.58,
      1.0,
    );

    if (random() > survival) continue;

    across += gaussian() * 0.010 * (1.0 + Math.abs(along) * 0.28);

    return {
      along,
      across,
      centreWeight,
      population,
      bulge,
      complexPeak,
    };
  }

  return {
    along: random() * 2.9 - 1.45,
    across: gaussian() * 0.24,
    centreWeight: 0,
    population: 2,
    bulge: false,
    complexPeak: 0,
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

    const populationThickness =
      band.population === 0 ? 0.014
      : band.population === 1 ? 0.024
      : 0.040;

    const depthThickness =
      populationThickness
      + (1 - band.centreWeight) * 0.009
      + (band.bulge ? 0.015 : 0.0);

    x += gaussian() * depth * depthThickness;
    y += gaussian() * depth * depthThickness * 0.60;

    const o = i * 3;
    positions[o] = x;
    positions[o + 1] = y;
    positions[o + 2] = -depth;

    const centreBoost = 0.90 + band.centreWeight * 0.50;
    const complexBoost = 0.92 + band.complexPeak * 0.20;
    const populationQuiet =
      band.population === 0 ? 1.0
      : band.population === 1 ? 0.82
      : 0.62;
    const depthQuiet = THREE.MathUtils.clamp(1.14 - depth / 112, 0.64, 1.0);

    const opticalRoll = random();
    let opticalBrightness;
    let opticalOpacity;
    let opticalScale;

    if (opticalRoll < 0.58) {
      opticalBrightness = 0.40 + random() * 0.30;
      opticalOpacity = 0.28 + random() * 0.22;
      opticalScale = 0.020 + Math.pow(random(), 2.5) * 0.060;
    } else if (opticalRoll < 0.93) {
      opticalBrightness = 0.54 + random() * 0.38;
      opticalOpacity = 0.34 + random() * 0.28;
      opticalScale = 0.060 + Math.pow(random(), 2.4) * 0.115;
    } else {
      opticalBrightness = 0.72 + random() * 0.46;
      opticalOpacity = 0.46 + random() * 0.28;
      opticalScale = 0.145 + Math.pow(random(), 2.2) * 0.205;
    }

    brightness[i] = opticalBrightness
      * centreBoost
      * complexBoost
      * populationQuiet
      * depthQuiet;

    opacity[i] = opticalOpacity
      * (0.92 + band.centreWeight * 0.20)
      * populationQuiet;

    scale[i] = opticalScale;
    phase[i] = random() * Math.PI * 2;
    rate[i] = 0.72 + random() * 0.46;

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
