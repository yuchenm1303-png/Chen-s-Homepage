const sourceUrl = new URL('./astra-milkyway-layered.js', import.meta.url);
const response = await fetch(sourceUrl, { cache: 'no-store' });
if (!response.ok) throw new Error(`Failed to load layered Milky Way renderer: ${response.status}`);

let source = await response.text();

function replaceOnce(input, pattern, replacement, label) {
  if (!pattern.test(input)) {
    throw new Error(`${label} marker not found; refusing to patch an unknown renderer revision.`);
  }
  return input.replace(pattern, replacement);
}

const continuumPattern = /const CONTINUUM_FRAGMENT = `[\s\S]*?`;\n\nconst ASTRA_BLOOM_PREFILTER = `/;
const continuumReplacement = `const CONTINUUM_FRAGMENT = \`
uniform vec3 uCameraPosition;
uniform vec3 uCameraForward;
uniform vec3 uCameraRight;
uniform vec3 uCameraUp;
uniform float uAspect;
uniform float uTanHalfFov;
uniform float uIntroProgress;
uniform float uIntensity;
varying vec2 vUv;

float gaussianWeight(float value, float centre, float width) {
  float q = (value - centre) / width;
  return exp(-q * q);
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
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

float fbm2(vec2 p) {
  float value = noise2(p) * 0.67;
  p = p * 2.09 + vec2(17.31, 9.17);
  value += noise2(p) * 0.33;
  return value;
}

void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  vec3 rayDir = normalize(
    uCameraForward
    + uCameraRight * ndc.x * uAspect * uTanHalfFov
    + uCameraUp * ndc.y * uTanHalfFov
  );

  const vec3 galMajor = vec3(0.82903757, 0.55919290, 0.0);
  const vec3 galNormal = vec3(-0.55706501, 0.82588283, 0.08715574);
  const vec3 galDepth = vec3(-0.04873687, 0.07225539, -0.99619470);
  const vec3 galCenter = vec3(2.82980316, 6.53439458, -43.83256680);
  const float tNear = 6.0;
  const float tFar = 62.0;
  const int steps = 10;
  float stepSize = (tFar - tNear) / float(steps);

  vec3 integrated = vec3(0.0);
  float transmission = 1.0;

  for (int i = 0; i < steps; i++) {
    float t = tNear + (float(i) + 0.5) * stepSize;
    vec3 p = uCameraPosition + rayDir * t;
    vec3 q = p - galCenter;
    float gx = dot(q, galMajor);
    float gy = dot(q, galDepth);
    float gz = dot(q, galNormal);
    float radius = max(length(vec2(gx, gy)), 1.0);
    float theta = atan(gy, gx);

    float centreWeight = exp(-pow(radius / 12.5, 2.0));
    float diskScaleHeight = 2.35 + radius * 0.010 + centreWeight * 2.65;
    float vertical = exp(-0.82 * pow(gz / diskScaleHeight, 2.0));
    float radial = exp(-radius / 58.0);
    float bulge = centreWeight * exp(-0.38 * pow(gz / 4.4, 2.0));

    float logRadius = log(radius + 2.0);
    float armPhase = theta * 4.0 - logRadius * 3.15 + 0.72;
    float armRidge = pow(0.5 + 0.5 * cos(armPhase), 5.0);
    float secondaryArm = pow(0.5 + 0.5 * cos(armPhase + 2.15), 7.0) * 0.42;
    float armWeight = clamp(armRidge + secondaryArm, 0.0, 1.0);

    vec2 planeCoord = vec2(gx, gy) * 0.105;
    float cloud = fbm2(planeCoord + vec2(gz * 0.028, -gz * 0.019));
    float ridgeNoise = noise2(planeCoord * 2.35 + vec2(13.7, 7.4));
    float voidNoise = noise2(planeCoord * 0.74 + vec2(27.1, 11.9));
    float cloudMass = smoothstep(0.34, 0.78, cloud);
    float filament = pow(1.0 - abs(ridgeNoise * 2.0 - 1.0), 3.0);
    float cavity = smoothstep(0.74, 0.92, voidNoise);

    float stellarDensity = vertical
      * (0.17 + radial * 0.54 + bulge * 1.75)
      * (0.52 + armWeight * 0.78)
      * (0.48 + cloudMass * 0.78 + filament * 0.24)
      * (1.0 - cavity * 0.52);

    float dustPhase = theta * 4.0 - logRadius * 3.15 + 0.98;
    float dustArm = pow(0.5 + 0.5 * cos(dustPhase), 8.0);
    float dustClump = 0.28 + smoothstep(0.30, 0.80, noise2(planeCoord * 1.42 + vec2(41.3, 5.7))) * 0.94;
    float dustVertical = exp(-1.35 * pow(gz / 1.45, 2.0));
    float nearDust = 0.26 + gaussianWeight(t, 22.0, 15.5) * 0.92;
    float dust = dustVertical * nearDust * dustClump * (0.18 + dustArm * 1.08);

    vec3 coolLight = vec3(0.300, 0.338, 0.382);
    vec3 warmLight = vec3(0.515, 0.420, 0.310);
    vec3 stellarColor = mix(coolLight, warmLight, 0.12 + centreWeight * 0.72 + armWeight * 0.05);

    integrated += stellarColor * stellarDensity * transmission * stepSize * 0.0039;
    transmission *= exp(-dust * stepSize * 0.095);
  }

  float reveal = smoothstep(0.0, 0.86, uIntroProgress);
  vec3 emission = integrated * uIntensity * reveal;
  gl_FragColor = vec4(emission, 1.0);
}\`;

const CONTINUUM_COMPOSITE_VERTEX = \`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.9998, 1.0);
}\`;

const CONTINUUM_COMPOSITE_FRAGMENT = \`
uniform sampler2D uContinuumTexture;
varying vec2 vUv;
void main() {
  gl_FragColor = texture2D(uContinuumTexture, vUv);
}\`;

const ASTRA_BLOOM_PREFILTER = \``;

source = replaceOnce(source, continuumPattern, continuumReplacement, 'World-space continuum shader');

const worldHelpers = `
const GALACTIC_MAJOR = Object.freeze({ x: 0.82903757, y: 0.55919290, z: 0.0 });
const GALACTIC_NORMAL = Object.freeze({ x: -0.55706501, y: 0.82588283, z: 0.08715574 });
const GALACTIC_DEPTH = Object.freeze({ x: -0.04873687, y: 0.07225539, z: -0.99619470 });
const GALACTIC_CENTER = Object.freeze({ x: 2.82980316, y: 6.53439458, z: -43.83256680 });

function fract(value) {
  return value - Math.floor(value);
}
function fieldNoise2(x, y) {
  return fract(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453123);
}
function smooth01(edge0, edge1, value) {
  const t = THREE.MathUtils.clamp((value - edge0) / Math.max(edge1 - edge0, 1e-6), 0, 1);
  return t * t * (3 - 2 * t);
}
function galacticFieldAt(x, y, z) {
  const qx = x - GALACTIC_CENTER.x;
  const qy = y - GALACTIC_CENTER.y;
  const qz = z - GALACTIC_CENTER.z;
  const gx = qx * GALACTIC_MAJOR.x + qy * GALACTIC_MAJOR.y + qz * GALACTIC_MAJOR.z;
  const gy = qx * GALACTIC_DEPTH.x + qy * GALACTIC_DEPTH.y + qz * GALACTIC_DEPTH.z;
  const gz = qx * GALACTIC_NORMAL.x + qy * GALACTIC_NORMAL.y + qz * GALACTIC_NORMAL.z;
  const radius = Math.max(Math.hypot(gx, gy), 1.0);
  const theta = Math.atan2(gy, gx);
  const centreWeight = Math.exp(-Math.pow(radius / 12.5, 2));
  const diskScaleHeight = 2.35 + radius * 0.010 + centreWeight * 2.65;
  const vertical = Math.exp(-0.82 * Math.pow(gz / diskScaleHeight, 2));
  const radial = Math.exp(-radius / 58.0);
  const bulge = centreWeight * Math.exp(-0.38 * Math.pow(gz / 4.4, 2));
  const armPhase = theta * 4.0 - Math.log(radius + 2.0) * 3.15 + 0.72;
  const armRidge = Math.pow(0.5 + 0.5 * Math.cos(armPhase), 5.0);
  const secondaryArm = Math.pow(0.5 + 0.5 * Math.cos(armPhase + 2.15), 7.0) * 0.42;
  const armWeight = THREE.MathUtils.clamp(armRidge + secondaryArm, 0, 1);
  const px = gx * 0.105;
  const py = gy * 0.105;
  const cloud0 = fieldNoise2(Math.floor(px * 0.75), Math.floor(py * 0.75));
  const cloud1 = fieldNoise2(Math.floor(px * 1.85 + 17.0), Math.floor(py * 1.85 + 9.0));
  const cloudMass = 0.62 * cloud0 + 0.38 * cloud1;
  const cavity = smooth01(0.78, 0.96, fieldNoise2(Math.floor(px * 0.52 + 27.0), Math.floor(py * 0.52 + 12.0)));
  const density = vertical
    * (0.17 + radial * 0.54 + bulge * 1.75)
    * (0.52 + armWeight * 0.78)
    * (0.52 + cloudMass * 0.72)
    * (1 - cavity * 0.48);
  const dustPhase = theta * 4.0 - Math.log(radius + 2.0) * 3.15 + 0.98;
  const dustArm = Math.pow(0.5 + 0.5 * Math.cos(dustPhase), 8.0);
  const dustVertical = Math.exp(-1.35 * Math.pow(gz / 1.45, 2));
  const dustClump = 0.32 + fieldNoise2(Math.floor(px * 1.35 + 41.0), Math.floor(py * 1.35 + 6.0)) * 0.82;
  const dust = dustVertical * dustClump * (0.18 + dustArm * 1.08);
  return {
    density,
    centreWeight,
    armWeight,
    dustTransmission: THREE.MathUtils.clamp(Math.exp(-dust * 0.92), 0.12, 1.0),
  };
}

function sampleFrustumCandidate(random, depth) {
  const fovTan = Math.tan(THREE.MathUtils.degToRad(CONFIG.fov * 0.5));
  const halfHeight = fovTan * depth * 1.30;
  const halfWidth = halfHeight * 2.2;
  return {
    x: (random() * 2 - 1) * halfWidth,
    y: (random() * 2 - 1) * halfHeight,
    z: -depth,
  };
}

function sampleGalacticVolume(random, depthSampler, attempts = 28) {
  let best = null;
  let bestScore = -1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const depth = depthSampler();
    const p = sampleFrustumCandidate(random, depth);
    const field = galacticFieldAt(p.x, p.y, p.z);
    const score = THREE.MathUtils.clamp(field.density * 0.80, 0, 0.96);
    if (score > bestScore) {
      best = { ...p, ...field, depth };
      bestScore = score;
    }
    if (random() < score) return { ...p, ...field, depth };
  }
  return best;
}
`;

source = replaceOnce(
  source,
  /function buildBrightField\(\) \{/,
  `${worldHelpers}\nfunction buildBrightField() {`,
  'World-space helpers insertion',
);

source = replaceOnce(
  source,
  /function buildBrightField\(\) \{[\s\S]*?\n\}\n\nfunction buildMicroField\(\) \{/,
  `function buildBrightField() {
  const random = seeded(0xA57A2D31);
  const data = makePointData(CONFIG.brightStarCount);
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
  for (let i = 0; i < CONFIG.brightStarCount; i++) {
    const isBand = random() >= CONFIG.backgroundFraction;
    let sample;
    if (isBand) {
      sample = sampleGalacticVolume(random, () => sampleDepth(true), 24);
    } else {
      const depth = sampleDepth(false);
      const p = sampleFrustumCandidate(random, depth);
      sample = { ...p, depth, centreWeight: 0, armWeight: 0, dustTransmission: 1 };
    }
    const o = i * 3;
    data.positions[o] = sample.x;
    data.positions[o + 1] = sample.y;
    data.positions[o + 2] = sample.z;
    const chance = random();
    const centreWeight = sample.centreWeight || 0;
    const armWeight = sample.armWeight || 0;
    const heroCutoff = isBand ? 0.9978 - centreWeight * 0.0009 : 0.9987;
    const brightCutoff = isBand ? 0.980 - centreWeight * 0.005 - armWeight * 0.002 : 0.985;
    let scale;
    let brightness;
    let opacity;
    if (chance > heroCutoff) {
      scale = (1.45 + random() * 0.85) * CONFIG.size;
      brightness = 3.05 + random() * 0.75;
      opacity = 0.90 + random() * 0.09;
    } else if (chance > brightCutoff) {
      scale = (0.62 + random() * 0.82) * CONFIG.size;
      brightness = 1.75 + random() * 1.12;
      opacity = 0.74 + random() * 0.22;
    } else {
      const presence = isBand ? 0.88 + centreWeight * 0.17 + armWeight * 0.05 : 0.78;
      scale = (0.055 + Math.pow(random(), 2.65) * 0.34) * CONFIG.size;
      brightness = (0.54 + random() * 0.82) * presence;
      opacity = (0.18 + random() * 0.58) * presence;
    }
    const depthQuiet = THREE.MathUtils.clamp(1.12 - sample.depth / 80, 0.58, 1.0);
    data.brightness[i] = brightness * depthQuiet;
    data.opacity[i] = opacity * (0.72 + 0.28 * depthQuiet) * (isBand ? sample.dustTransmission : 1);
    data.scale[i] = scale;
    data.phase[i] = random() * Math.PI * 2;
    data.rate[i] = 0.65 + random() * 0.70;
    const color = pickBrightColor(random, isBand ? centreWeight : 0);
    data.colors[o] = color.r;
    data.colors[o + 1] = color.g;
    data.colors[o + 2] = color.b;
  }
  return finishPoints(data, BRIGHT_VERTEX, BRIGHT_FRAGMENT, {
    uIntensity: { value: CONFIG.intensity },
    uIntroProgress: { value: 0 },
    uPixelRatio: { value: 1 },
    uTime: { value: 0 },
    uTwinkleSpeed: { value: CONFIG.twinkleSpeed },
  });
}

function buildMicroField() {`,
  'World-space bright field',
);

source = replaceOnce(
  source,
  /function buildMicroField\(\) \{[\s\S]*?\n\}\n\nfunction buildContinuumField\(\) \{/,
  `function buildMicroField() {
  const random = seeded(0x4D494352);
  const data = makePointData(CONFIG.microStarCount);
  function sampleDepth() {
    const shell = random();
    return shell < 0.18
      ? 12 + Math.pow(random(), 0.82) * 16
      : 24 + Math.pow(random(), 0.92) * 34;
  }
  for (let i = 0; i < CONFIG.microStarCount; i++) {
    const sample = sampleGalacticVolume(random, sampleDepth, 30);
    const o = i * 3;
    data.positions[o] = sample.x;
    data.positions[o + 1] = sample.y;
    data.positions[o + 2] = sample.z;
    const centreBoost = 0.86 + sample.centreWeight * 0.46;
    const armBoost = 0.90 + sample.armWeight * 0.18;
    const depthQuiet = THREE.MathUtils.clamp(1.10 - sample.depth / 120, 0.64, 1.0);
    data.brightness[i] = (0.46 + random() * 0.46) * centreBoost * armBoost * depthQuiet;
    data.opacity[i] = (0.24 + random() * 0.34)
      * sample.dustTransmission
      * (0.90 + sample.centreWeight * 0.12);
    data.scale[i] = 0.045 + Math.pow(random(), 2.4) * 0.15;
    data.phase[i] = random() * Math.PI * 2;
    data.rate[i] = 0.78 + random() * 0.38;
    const color = pickDensityColor(random, sample.centreWeight);
    data.colors[o] = color.r;
    data.colors[o + 1] = color.g;
    data.colors[o + 2] = color.b;
  }
  const out = finishPoints(data, MICRO_VERTEX, MICRO_FRAGMENT, {
    uIntensity: { value: CONFIG.microIntensity },
    uIntroProgress: { value: 0 },
    uPixelRatio: { value: 1 },
    uTime: { value: 0 },
    uTwinkleSpeed: { value: CONFIG.microTwinkleSpeed },
  });
  out.points.renderOrder = -10;
  return out;
}

function buildContinuumField() {`,
  'World-space micro field',
);

source = replaceOnce(
  source,
  /const renderer = new THREE\.WebGLRenderer\(\{/,
  `function buildContinuumComposite(texture) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -1, -1, 0,
     3, -1, 0,
    -1,  3, 0,
  ], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([
    0, 0,
    2, 0,
    0, 2,
  ], 2));
  const material = new THREE.ShaderMaterial({
    vertexShader: CONTINUUM_COMPOSITE_VERTEX,
    fragmentShader: CONTINUUM_COMPOSITE_FRAGMENT,
    uniforms: { uContinuumTexture: { value: texture } },
    depthTest: false,
    depthWrite: false,
    transparent: false,
    blending: THREE.NoBlending,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -100;
  return { mesh, geometry, material };
}

const renderer = new THREE.WebGLRenderer({`,
  'Continuum composite builder',
);

source = replaceOnce(
  source,
  /const continuumField = buildContinuumField\(\);\nconst microField = buildMicroField\(\);\nconst brightField = buildBrightField\(\);\nscene\.add\(continuumField\.mesh\);\nscene\.add\(microField\.points\);\nscene\.add\(brightField\.points\);/,
  `const continuumField = buildContinuumField();
const continuumScene = new THREE.Scene();
const continuumCamera = new THREE.Camera();
continuumScene.add(continuumField.mesh);
const continuumTarget = new THREE.WebGLRenderTarget(1, 1, {
  type: THREE.HalfFloatType,
  depthBuffer: false,
  stencilBuffer: false,
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
  generateMipmaps: false,
});
continuumTarget.texture.colorSpace = THREE.NoColorSpace;
const continuumComposite = buildContinuumComposite(continuumTarget.texture);
const microField = buildMicroField();
const brightField = buildBrightField();
scene.add(continuumComposite.mesh);
scene.add(microField.points);
scene.add(brightField.points);`,
  'Continuum scene split',
);

source = replaceOnce(
  source,
  /continuumField\.material\.uniforms\.uAspect\.value = camera\.aspect;/,
  `continuumField.material.uniforms.uAspect.value = camera.aspect;
  const continuumScale = width >= 1100 ? 0.40 : 0.48;
  const continuumWidth = Math.max(256, Math.min(960, Math.round(width * pixelRatio * continuumScale)));
  const continuumHeight = Math.max(144, Math.min(600, Math.round(height * pixelRatio * continuumScale)));
  continuumTarget.setSize(continuumWidth, continuumHeight);`,
  'Continuum target resize',
);

source = replaceOnce(
  source,
  /updateContinuumCameraUniforms\(intro\);\n  composer\.render\(dt\);/,
  `updateContinuumCameraUniforms(intro);
  renderer.setRenderTarget(continuumTarget);
  renderer.clear();
  renderer.render(continuumScene, continuumCamera);
  renderer.setRenderTarget(null);
  composer.render(dt);`,
  'Continuum low-resolution render pass',
);

const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
try {
  await import(moduleUrl);
} finally {
  URL.revokeObjectURL(moduleUrl);
}
