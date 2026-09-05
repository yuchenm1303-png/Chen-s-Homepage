const sourceUrl = new URL('./astra-milkyway-layered.js', import.meta.url);
const response = await fetch(sourceUrl, { cache: 'no-store' });
if (!response.ok) throw new Error(`Failed to load layered star renderer: ${response.status}`);

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
  float value = noise2(p) * 0.64;
  p = p * 2.07 + vec2(17.31, 9.17);
  value += noise2(p) * 0.36;
  return value;
}

mat2 rot2(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, -s, s, c);
}

float ribbon(float y, float centre, float width) {
  float q = (y - centre) / max(width, 0.001);
  return exp(-q * q);
}

void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  vec3 rayDir = normalize(
    uCameraForward
    + uCameraRight * ndc.x * uAspect * uTanHalfFov
    + uCameraUp * ndc.y * uTanHalfFov
  );

  const float designAspect = 2.2;
  const float tNear = 6.0;
  const float tLegacyFar = 62.0;
  const float tVolumeFar = 360.0;
  const int steps = 16;
  const float legacyStep = (tLegacyFar - tNear) / 10.0;

  vec3 integrated = vec3(0.0);
  float transmission = 1.0;

  for (int i = 0; i < steps; i++) {
    // Preserve the approved 6..62 volume byte-for-byte in sampling density, then
    // append six sparse logarithmic samples behind it. This adds real distance
    // without softening or re-tuning the existing near/mid/far composition.
    float t;
    float integrationStep;
    if (i < 10) {
      t = tNear + (float(i) + 0.5) * legacyStep;
      integrationStep = legacyStep;
    } else {
      float farIndex = float(i) - 10.0;
      float q = (farIndex + 0.5) / 6.0;
      t = tLegacyFar + (tVolumeFar - tLegacyFar) * pow(q, 1.45);
      integrationStep = 13.0;
    }

    vec3 p = uCameraPosition + rayDir * t;
    float depth = max(-p.z, 1.0);

    float nx = p.x / max(uTanHalfFov * depth * 1.30 * designAspect, 0.001);
    float ny = p.y / max(uTanHalfFov * depth * 1.30, 0.001);
    vec2 sky = vec2(nx, ny);

    // Three approved foreground depth layers.
    vec2 farP = rot2(-0.53) * sky;
    farP += vec2((t - 46.0) * 0.0018, (t - 46.0) * -0.0007);
    float farWarp = (fbm2(farP * 2.15 + vec2(7.2, 3.8)) - 0.5) * 0.13;
    float farCentre = 0.08 * sin(farP.x * 2.6 + 0.35) + farWarp;
    float farBand = ribbon(farP.y, farCentre, 0.22);
    float farCloud = fbm2(farP * 3.05 + vec2(11.7, 19.3));
    float farMass = smoothstep(0.34, 0.79, farCloud);
    float farRidge = pow(1.0 - abs(noise2(farP * 6.0 + vec2(5.4, 13.8)) * 2.0 - 1.0), 3.0);
    float farVoid = smoothstep(0.77, 0.93, noise2(farP * 1.35 + vec2(28.0, 4.0)));
    float farWindow = gaussianWeight(t, 47.0, 15.0)
      * gaussianWeight(farP.x, 0.22, 1.28);
    float farDensity = farWindow * farBand
      * (0.14 + farMass * 0.92 + farRidge * 0.22)
      * (1.0 - farVoid * 0.72);

    // Deep background structures begin only after the approved volume ends.
    // Their different rotations, widths and depth centres make the Milky Way
    // continue behind itself rather than ending as a single translucent sheet.
    vec2 deepP = rot2(-0.49) * sky;
    deepP += vec2((t - 122.0) * -0.00072, (t - 122.0) * 0.00038);
    float deepNoise = fbm2(deepP * 2.20 + vec2(63.0, 21.0));
    float deepWarp = (deepNoise - 0.5) * 0.12;
    float deepCentre = 0.035 + 0.075 * sin(deepP.x * 2.15 - 0.32) + deepWarp;
    float deepBand = ribbon(deepP.y, deepCentre, 0.29 + deepNoise * 0.045);
    float deepMass = smoothstep(0.34, 0.77, deepNoise);
    float deepFilament = pow(1.0 - abs(noise2(deepP * 5.2 + vec2(17.0, 71.0)) * 2.0 - 1.0), 3.2);
    float deepVoid = smoothstep(0.76, 0.93, noise2(deepP * 1.30 + vec2(41.0, 9.0)));
    float deepGate = smoothstep(68.0, 92.0, t);
    float deepWindow = gaussianWeight(t, 122.0, 58.0)
      * gaussianWeight(deepP.x, 0.12, 1.52)
      * deepGate;
    float deepDensity = deepWindow * deepBand
      * (0.08 + deepMass * 0.72 + deepFilament * 0.18)
      * (1.0 - deepVoid * 0.76);

    vec2 ultraP = rot2(-0.39) * sky;
    ultraP += vec2((t - 250.0) * 0.00031, (t - 250.0) * -0.00019);
    float ultraNoise = fbm2(ultraP * 1.58 + vec2(103.0, 37.0));
    float ultraCentre = -0.025
      + 0.11 * sin(ultraP.x * 1.55 + 0.84)
      + (ultraNoise - 0.5) * 0.10;
    float ultraBand = ribbon(ultraP.y, ultraCentre, 0.40 + ultraNoise * 0.070);
    float ultraMass = smoothstep(0.38, 0.80, ultraNoise);
    float ultraVoid = smoothstep(0.74, 0.92, noise2(ultraP * 1.05 + vec2(8.0, 119.0)));
    float ultraGate = smoothstep(155.0, 205.0, t);
    float ultraWindow = gaussianWeight(t, 252.0, 108.0)
      * gaussianWeight(ultraP.x, -0.06, 1.78)
      * ultraGate;
    float ultraDensity = ultraWindow * ultraBand
      * (0.055 + ultraMass * 0.46)
      * (1.0 - ultraVoid * 0.82);

    vec2 midP = rot2(-0.60) * sky;
    midP += vec2((t - 31.0) * -0.0022, (t - 31.0) * 0.0012);
    float midNoise = fbm2(midP * 2.75 + vec2(31.1, 8.4));
    float midWarp = (midNoise - 0.5) * 0.16;
    float midCentre = -0.055 + 0.105 * sin(midP.x * 3.7 - 0.65) + midWarp;
    float midBand = ribbon(midP.y, midCentre, 0.155 + 0.035 * midNoise);
    float midMass = smoothstep(0.37, 0.76, midNoise);
    float midFilament = pow(1.0 - abs(noise2(midP * 7.1 + vec2(17.0, 29.0)) * 2.0 - 1.0), 4.0);
    float midVoid = smoothstep(0.73, 0.91, noise2(midP * 1.75 + vec2(2.0, 37.0)));
    float midWindow = gaussianWeight(t, 31.0, 11.5)
      * gaussianWeight(midP.x, 0.00, 1.12);
    float midDensity = midWindow * midBand
      * (0.18 + midMass * 1.18 + midFilament * 0.38)
      * (1.0 - midVoid * 0.82);

    vec2 nearP = rot2(-0.45) * sky;
    nearP += vec2((t - 17.0) * 0.0034, (t - 17.0) * -0.0020);
    float nearNoise = fbm2(nearP * 3.45 + vec2(9.0, 43.0));
    float nearCentre = -0.17
      + 0.075 * sin(nearP.x * 5.4 + 1.05)
      + (nearNoise - 0.5) * 0.11;
    float nearBand = ribbon(nearP.y, nearCentre, 0.105 + 0.026 * nearNoise);
    float nearMass = smoothstep(0.42, 0.79, nearNoise);
    float nearWindow = gaussianWeight(t, 17.0, 7.8)
      * gaussianWeight(nearP.x, -0.33, 0.92);
    float nearDensity = nearWindow * nearBand * (0.12 + nearMass * 0.88);

    // Localised bright complexes create visual anchors without turning the
    // whole field into a uniform grey sheet.
    float complexA = gaussianWeight(midP.x, 0.18, 0.24)
      * gaussianWeight(midP.y, midCentre + 0.028, 0.085)
      * gaussianWeight(t, 34.0, 8.0);
    float complexB = gaussianWeight(farP.x, 0.82, 0.27)
      * gaussianWeight(farP.y, farCentre - 0.035, 0.11)
      * gaussianWeight(t, 50.0, 10.0);
    float complexC = gaussianWeight(nearP.x, -0.62, 0.22)
      * gaussianWeight(nearP.y, nearCentre + 0.018, 0.070)
      * gaussianWeight(t, 18.0, 6.0);

    // Foreground dust carves multiple broken lanes through all emission layers.
    float dustNoise = fbm2(midP * 4.15 + vec2(51.0, 14.0));
    float dustWarp = (dustNoise - 0.5) * 0.075;
    float dustLane0 = ribbon(midP.y, midCentre - 0.028 + dustWarp, 0.030 + dustNoise * 0.018);
    float dustLane1 = ribbon(midP.y, midCentre + 0.105 - dustWarp * 0.55, 0.022)
      * gaussianWeight(midP.x, 0.26, 0.72);
    float dustLane2 = ribbon(nearP.y, nearCentre + 0.040, 0.020)
      * gaussianWeight(nearP.x, -0.36, 0.65);
    float dustClump = 0.24 + smoothstep(0.36, 0.80, dustNoise) * 1.06;
    float dust = (
      dustLane0 * gaussianWeight(t, 24.0, 13.0) * 0.92
      + dustLane1 * gaussianWeight(t, 29.0, 10.0) * 0.58
      + dustLane2 * gaussianWeight(t, 15.0, 7.0) * 0.40
    ) * dustClump;

    vec3 farColor = vec3(0.210, 0.285, 0.395);
    vec3 midColor = vec3(0.400, 0.405, 0.405);
    vec3 warmColor = vec3(0.590, 0.390, 0.255);
    vec3 roseColor = vec3(0.410, 0.245, 0.305);
    vec3 deepColor = vec3(0.145, 0.205, 0.300);
    vec3 ultraColor = vec3(0.085, 0.135, 0.225);

    vec3 emission = farColor * farDensity * 0.88
      + mix(midColor, warmColor, 0.34 + midMass * 0.24) * midDensity
      + mix(warmColor, roseColor, 0.22 + nearMass * 0.30) * nearDensity * 0.82;

    emission += deepColor * deepDensity * 0.46;
    emission += ultraColor * ultraDensity * 0.30;
    emission += warmColor * complexA * 0.95;
    emission += mix(farColor, vec3(0.325, 0.425, 0.520), 0.62) * complexB * 0.72;
    emission += mix(warmColor, roseColor, 0.42) * complexC * 0.58;

    integrated += emission * transmission * integrationStep * 0.0049;
    transmission *= exp(-dust * integrationStep * 0.108);
  }

  float reveal = smoothstep(0.0, 0.86, uIntroProgress);
  vec3 color = integrated * uIntensity * reveal;
  gl_FragColor = vec4(color, 1.0);
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

source = replaceOnce(source, continuumPattern, continuumReplacement, 'Deep nebula continuum shader');

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
  'Deep nebula composite builder',
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
  'Deep nebula scene split',
);

source = replaceOnce(
  source,
  /continuumField\.material\.uniforms\.uAspect\.value = camera\.aspect;/,
  `continuumField.material.uniforms.uAspect.value = camera.aspect;
  const continuumScale = width >= 1100 ? 0.40 : 0.48;
  const continuumWidth = Math.max(256, Math.min(960, Math.round(width * pixelRatio * continuumScale)));
  const continuumHeight = Math.max(144, Math.min(600, Math.round(height * pixelRatio * continuumScale)));
  continuumTarget.setSize(continuumWidth, continuumHeight);`,
  'Deep nebula target resize',
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
  'Deep nebula low-resolution render pass',
);

const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
try {
  await import(moduleUrl);
} finally {
  URL.revokeObjectURL(moduleUrl);
}
