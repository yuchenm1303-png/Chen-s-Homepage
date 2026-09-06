import * as THREE from 'three';

export const SOURCE_RELEASE = 'eb8b75ed5ea62a7e00c312637c030fd8ff7a2936';
export const STAR_COUNT = 14800;
export const FIELD_SEED = 0xA57A2D31;
export const FOV = 55;
const PRODUCTION_SIZE = 2.05;
const BACKGROUND_FRACTION = 0.27;

const BRIGHT_PALETTE = Object.freeze([
  '#6DCBF4', '#7AB1FE', '#F87915', '#FA994C', '#F5F6FB',
]);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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

function gaussian(random) {
  const u = Math.max(random(), 1e-7);
  const v = Math.max(random(), 1e-7);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
}

function gaussianWeight(value, centre, width) {
  return Math.exp(-Math.pow((value - centre) / width, 2));
}

function sampleAlong(random) {
  const mode = random();
  if (mode < 0.10) return -1.08 + gaussian(random) * 0.13;
  if (mode < 0.23) return -0.74 + gaussian(random) * 0.15;
  if (mode < 0.37) return -0.38 + gaussian(random) * 0.15;
  if (mode < 0.58) return 0.00 + gaussian(random) * 0.17;
  if (mode < 0.78) return 0.31 + gaussian(random) * 0.15;
  if (mode < 0.90) return 0.68 + gaussian(random) * 0.16;
  return random() * 3.12 - 1.56;
}

function sampleMilkyWayBand(random) {
  const along = clamp(sampleAlong(random), -1.58, 1.58);
  const centreWeight = gaussianWeight(along, 0.20, 0.38);
  const broadWeight = gaussianWeight(along, 0.03, 1.14);
  const centreLine = 0.024 * Math.sin(along * 2.05 + 0.32)
    + 0.014 * Math.sin(along * 5.5 - 0.50);
  const baseWidth = 0.145 + broadWeight * 0.065 + centreWeight * 0.125;
  const widthScale = 0.62 + random() * 0.72;
  let across = centreLine
    + 0.020 * Math.sin(along * 2.9 - 0.34)
    + 0.010 * Math.sin(along * 7.7 + 1.10)
    + gaussian(random) * baseWidth * widthScale;
  across += gaussian(random) * 0.008 * (1 + Math.abs(along) * 0.22);

  // Production computes these values before returning. They do not consume more
  // random numbers, but keeping the full function makes this an auditable copy of
  // astra-milkyway-layered.js rather than a visually similar approximation.
  const mainRift = centreLine
    + 0.016 * Math.sin(along * 5.1 + 0.62)
    - 0.018 * Math.sin(along * 10.5 - 0.18);
  const mainRiftWidth = 0.032 + broadWeight * 0.010 + centreWeight * 0.046;
  const mainDust = Math.exp(-Math.pow((across - mainRift) / mainRiftWidth, 2));
  const branchWindow = gaussianWeight(along, 0.24, 0.64);
  const branchRift = centreLine - 0.095 + 0.018 * Math.sin(along * 8.2 + 1.08);
  const branchWidth = 0.025 + branchWindow * 0.018;
  const branchDust = Math.exp(-Math.pow((across - branchRift) / branchWidth, 2)) * branchWindow;
  const dustTransmission = clamp(
    1.0 - mainDust * (0.76 + centreWeight * 0.12) - branchDust * 0.48,
    0.10,
    1.0,
  );
  const complexPeak = Math.max(
    gaussianWeight(along, -0.86, 0.22),
    gaussianWeight(along, -0.30, 0.20),
    gaussianWeight(along, 0.13, 0.23),
    gaussianWeight(along, 0.56, 0.22),
  );
  return { along, across, centreWeight, complexPeak, dustTransmission };
}

function pickBrightColorIndex(random, centreWeight) {
  const seed = centreWeight > 0 && random() < centreWeight * 0.28
    ? 0.64 + random() * 0.36
    : random();
  if (seed < 0.36) return 0;
  if (seed < 0.52) return 1;
  if (seed < 0.64) return 2;
  if (seed < 0.74) return 3;
  return 4;
}

export function buildProductionBrightField() {
  const random = seeded(FIELD_SEED);
  const positions = new Float32Array(STAR_COUNT * 3);
  const brightness = new Float32Array(STAR_COUNT);
  const opacity = new Float32Array(STAR_COUNT);
  const scale = new Float32Array(STAR_COUNT);
  const colors = new Float32Array(STAR_COUNT * 3);
  const fovTan = Math.tan(THREE.MathUtils.degToRad(FOV * 0.5));
  const designAspect = 2.2;
  const angle = THREE.MathUtils.degToRad(34);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const palette = BRIGHT_PALETTE.map((hex) => new THREE.Color(hex));

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

  for (let i = 0; i < STAR_COUNT; i++) {
    const isBand = random() >= BACKGROUND_FRACTION;
    const depth = sampleDepth(isBand);
    const halfHeight = fovTan * depth * 1.30;
    const halfWidth = halfHeight * designAspect;
    let x;
    let y;
    let centreWeight = 0;

    if (isBand) {
      const b = sampleMilkyWayBand(random);
      centreWeight = b.centreWeight;
      const nx = b.along * c - b.across * s;
      const ny = b.along * s + b.across * c;
      const thickness = 0.018 + 0.022 * (1 - centreWeight);
      x = nx * halfWidth * 0.82 + gaussian(random) * depth * thickness;
      y = ny * halfHeight * 1.04 + gaussian(random) * depth * thickness * 0.55;
    } else {
      x = (random() * 2 - 1) * halfWidth;
      y = (random() * 2 - 1) * halfHeight;
    }

    const o = i * 3;
    positions[o] = x;
    positions[o + 1] = y;
    positions[o + 2] = -depth;

    const chance = random();
    const heroCutoff = isBand ? 0.9978 - centreWeight * 0.0008 : 0.9987;
    const brightCutoff = isBand ? 0.979 - centreWeight * 0.005 : 0.985;
    let starScale;
    let starBrightness;
    let starOpacity;

    if (chance > heroCutoff) {
      starScale = (1.45 + random() * 0.85) * PRODUCTION_SIZE;
      starBrightness = 3.05 + random() * 0.75;
      starOpacity = 0.90 + random() * 0.09;
    } else if (chance > brightCutoff) {
      starScale = (0.62 + random() * 0.82) * PRODUCTION_SIZE;
      starBrightness = 1.75 + random() * 1.12;
      starOpacity = 0.74 + random() * 0.22;
    } else {
      const presence = isBand ? 0.92 + centreWeight * 0.15 : 0.78;
      starScale = (0.055 + Math.pow(random(), 2.65) * 0.34) * PRODUCTION_SIZE;
      starBrightness = (0.54 + random() * 0.82) * presence;
      starOpacity = (0.18 + random() * 0.58) * presence;
    }

    const depthQuiet = clamp(1.12 - depth / 80, 0.58, 1.0);
    brightness[i] = starBrightness * depthQuiet;
    opacity[i] = starOpacity * (0.72 + 0.28 * depthQuiet);
    scale[i] = starScale;

    // Phase and rate are not rendered by the picker, but production consumes these
    // random values before the next star. Skipping them would shift every later index.
    random();
    random();
    const color = palette[pickBrightColorIndex(random, isBand ? centreWeight : 0)];
    colors[o] = color.r;
    colors[o + 1] = color.g;
    colors[o + 2] = color.b;
  }

  return { positions, brightness, opacity, scale, colors };
}

export function verifyProductionGenerator(field) {
  const checks = [
    { index: 4887, world: [-10.2889143962, -5.7146870273, -20.2491372325] },
    { index: 2091, world: [-47.5304656737, -19.6620532803, -39.3071167567] },
  ];
  for (const check of checks) {
    const o = check.index * 3;
    for (let axis = 0; axis < 3; axis++) {
      if (Math.abs(field.positions[o + axis] - Math.fround(check.world[axis])) > 1e-4) return false;
    }
  }
  return true;
}

export const productionBrightField = buildProductionBrightField();
