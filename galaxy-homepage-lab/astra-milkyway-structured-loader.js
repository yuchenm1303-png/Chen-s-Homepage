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
  float value = noise2(p) * 0.66;
  p = p * 2.11 + vec2(17.31, 9.17);
  value += noise2(p) * 0.34;
  return value;
}

void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  vec3 rayDir = normalize(
    uCameraForward
    + uCameraRight * ndc.x * uAspect * uTanHalfFov
    + uCameraUp * ndc.y * uTanHalfFov
  );

  const float c = 0.8290375726;
  const float s = 0.5591929035;
  const float designAspect = 2.2;
  const float tNear = 7.0;
  const float tFar = 62.0;
  const int steps = 12;
  float stepSize = (tFar - tNear) / float(steps);

  vec3 integrated = vec3(0.0);
  float transmission = 1.0;

  for (int i = 0; i < steps; i++) {
    float t = tNear + (float(i) + 0.5) * stepSize;
    vec3 p = uCameraPosition + rayDir * t;
    float depth = max(-p.z, 1.0);

    float nx = p.x / max(uTanHalfFov * depth * 1.30 * designAspect * 0.83, 0.001);
    float ny = p.y / max(uTanHalfFov * depth * 1.30 * 1.04, 0.001);
    float along = nx * c + ny * s;
    float across = -nx * s + ny * c;

    float centreWeight = gaussianWeight(along, 0.20, 0.36);
    float broadWeight = gaussianWeight(along, 0.03, 1.12);
    float centreLine = 0.024 * sin(along * 2.05 + 0.32)
      + 0.014 * sin(along * 5.5 - 0.50);
    float width = 0.128 + broadWeight * 0.052 + centreWeight * 0.112;
    float acrossNorm = (across - centreLine) / max(width, 0.001);
    float longitudinal = 1.0 - smoothstep(1.30, 1.66, abs(along));

    // Keep the structure coherent along the ray so integration preserves
    // stellar clouds instead of averaging them back into a smooth fog sheet.
    vec2 cloudCoord = vec2(
      along * 4.35 + t * 0.006,
      acrossNorm * 1.92 - t * 0.0025
    );
    float cloud = fbm2(cloudCoord);
    float ridgeNoise = noise2(cloudCoord * 2.55 + vec2(13.7, 7.4));
    float voidNoise = noise2(cloudCoord * 0.78 + vec2(27.1, 11.9));

    float cloudMass = smoothstep(0.36, 0.78, cloud);
    float filament = pow(1.0 - abs(ridgeNoise * 2.0 - 1.0), 3.2);
    float cavity = smoothstep(0.72, 0.91, voidNoise);
    float skirt = exp(-0.72 * acrossNorm * acrossNorm);
    float ridgeEnvelope = exp(-2.10 * acrossNorm * acrossNorm);
    float structure = skirt * (0.070 + cloud * 0.085)
      + ridgeEnvelope * (0.22 + cloudMass * 0.98 + filament * 0.52);
    structure *= 1.0 - cavity * 0.62;

    float complexPeak = max(
      max(gaussianWeight(along, -0.86, 0.20), gaussianWeight(along, -0.30, 0.19)),
      max(gaussianWeight(along, 0.13, 0.22), gaussianWeight(along, 0.56, 0.20))
    );
    float stellarDensity = longitudinal * structure
      * (0.70 + centreWeight * 1.02 + complexPeak * 0.30);

    // Great Rift is foreground extinction in the same 3D field, with irregular
    // width and clumping rather than a flat painted stripe.
    float dustNoise = noise2(cloudCoord * 1.72 + vec2(41.3, 5.7));
    float riftWarp = (dustNoise - 0.5) * (0.030 + centreWeight * 0.020);
    float mainRift = centreLine
      + 0.016 * sin(along * 5.1 + 0.62)
      - 0.018 * sin(along * 10.5 - 0.18)
      + riftWarp;
    float widthNoise = noise2(cloudCoord * 1.18 + vec2(8.2, 31.6));
    float mainWidth = (0.027 + broadWeight * 0.010 + centreWeight * 0.041)
      * mix(0.68, 1.38, widthNoise);
    float mainDust = gaussianWeight(across, mainRift, mainWidth);

    float branchWindow = gaussianWeight(along, 0.24, 0.62);
    float branchRift = centreLine - 0.093
      + 0.018 * sin(along * 8.2 + 1.08)
      - riftWarp * 0.42;
    float branchDust = gaussianWeight(
      across,
      branchRift,
      0.020 + branchWindow * 0.017
    ) * branchWindow;

    float dustDepthWindow = gaussianWeight(t, 22.0, 14.8);
    float dustClump = 0.28 + smoothstep(0.30, 0.78, dustNoise) * 0.96;
    float dust = (mainDust * 0.88 + branchDust * 0.50)
      * dustDepthWindow * dustClump;

    vec3 coolLight = vec3(0.300, 0.338, 0.382);
    vec3 warmLight = vec3(0.500, 0.408, 0.305);
    vec3 stellarColor = mix(coolLight, warmLight, 0.18 + centreWeight * 0.55);

    integrated += stellarColor * stellarDensity * transmission * stepSize * 0.0046;
    transmission *= exp(-dust * stepSize * 0.110);
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

source = replaceOnce(source, continuumPattern, continuumReplacement, 'Continuum shader');

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
  const continuumScale = width >= 1100 ? 0.42 : 0.50;
  const continuumWidth = Math.max(256, Math.min(1024, Math.round(width * pixelRatio * continuumScale)));
  const continuumHeight = Math.max(144, Math.min(640, Math.round(height * pixelRatio * continuumScale)));
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
