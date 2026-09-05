const sourceUrl = new URL('./astra-milkyway-layered.js', import.meta.url);
const response = await fetch(sourceUrl, { cache: 'no-store' });
if (!response.ok) throw new Error(`Failed to load layered Milky Way renderer: ${response.status}`);

const source = await response.text();
const continuumPattern = /const CONTINUUM_FRAGMENT = `[\s\S]*?`;\n\nconst ASTRA_BLOOM_PREFILTER = `/;

const replacement = `const CONTINUUM_FRAGMENT = \`
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
  float value = noise2(p) * 0.58;
  p = p * 2.07 + vec2(17.31, 9.17);
  value += noise2(p) * 0.28;
  p = p * 2.13 + vec2(7.11, 23.73);
  value += noise2(p) * 0.14;
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
  const int steps = 20;
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

    float centreWeight = gaussianWeight(along, 0.20, 0.38);
    float broadWeight = gaussianWeight(along, 0.03, 1.14);
    float centreLine = 0.024 * sin(along * 2.05 + 0.32)
      + 0.014 * sin(along * 5.5 - 0.50);
    float width = 0.155 + broadWeight * 0.072 + centreWeight * 0.145;
    float acrossNorm = (across - centreLine) / max(width, 0.001);
    float longitudinal = 1.0 - smoothstep(1.28, 1.66, abs(along));

    // Keep the density field coherent along the viewing ray. The previous low-
    // frequency sine modulation changed phase too quickly with depth, so the 20
    // integration samples averaged back into a smooth fog band.
    vec2 cloudCoord = vec2(
      along * 3.85 + t * 0.010,
      acrossNorm * 1.55 - t * 0.004
    );
    float cloud = fbm2(cloudCoord);
    float ridgeNoise = noise2(cloudCoord * 2.35 + vec2(13.7, 7.4));
    float voidNoise = noise2(cloudCoord * 0.82 + vec2(27.1, 11.9));

    float cloudMass = 0.16 + smoothstep(0.27, 0.76, cloud) * 0.94;
    float filament = pow(1.0 - abs(ridgeNoise * 2.0 - 1.0), 2.6);
    float cavity = smoothstep(0.70, 0.92, voidNoise);
    float skirt = exp(-0.58 * acrossNorm * acrossNorm);
    float ridgeEnvelope = exp(-1.55 * acrossNorm * acrossNorm);
    float structure = skirt * 0.18
      + ridgeEnvelope * (cloudMass + filament * 0.62);
    structure *= 1.0 - cavity * 0.55;

    float complexPeak = max(
      max(gaussianWeight(along, -0.86, 0.22), gaussianWeight(along, -0.30, 0.20)),
      max(gaussianWeight(along, 0.13, 0.23), gaussianWeight(along, 0.56, 0.22))
    );
    float stellarDensity = longitudinal * structure
      * (0.68 + centreWeight * 0.90 + complexPeak * 0.25);

    // The same coherent field breaks the Great Rift into irregular foreground
    // dust complexes instead of a mathematically smooth black stripe.
    float dustNoise = noise2(cloudCoord * 1.90 + vec2(41.3, 5.7));
    float riftWarp = (dustNoise - 0.5) * (0.028 + centreWeight * 0.018);
    float mainRift = centreLine
      + 0.016 * sin(along * 5.1 + 0.62)
      - 0.018 * sin(along * 10.5 - 0.18)
      + riftWarp;
    float widthNoise = noise2(cloudCoord * 1.25 + vec2(8.2, 31.6));
    float mainWidth = (0.028 + broadWeight * 0.010 + centreWeight * 0.040)
      * mix(0.72, 1.34, widthNoise);
    float mainDust = gaussianWeight(across, mainRift, mainWidth);

    float branchWindow = gaussianWeight(along, 0.24, 0.64);
    float branchRift = centreLine - 0.095
      + 0.018 * sin(along * 8.2 + 1.08)
      - riftWarp * 0.45;
    float branchDust = gaussianWeight(
      across,
      branchRift,
      0.021 + branchWindow * 0.017
    ) * branchWindow;

    float dustDepthWindow = gaussianWeight(t, 22.0, 15.5);
    float dustClump = 0.30 + smoothstep(0.30, 0.78, dustNoise) * 0.88;
    float dust = (mainDust * 0.82 + branchDust * 0.48)
      * dustDepthWindow * dustClump;

    vec3 coolLight = vec3(0.315, 0.355, 0.405);
    vec3 warmLight = vec3(0.505, 0.415, 0.315);
    vec3 stellarColor = mix(coolLight, warmLight, 0.20 + centreWeight * 0.52);

    integrated += stellarColor * stellarDensity * transmission * stepSize * 0.0046;
    transmission *= exp(-dust * stepSize * 0.105);
  }

  float reveal = smoothstep(0.0, 0.86, uIntroProgress);
  vec3 emission = integrated * uIntensity * reveal;
  gl_FragColor = vec4(emission, 1.0);
}\`;

const ASTRA_BLOOM_PREFILTER = \``;

if (!continuumPattern.test(source)) {
  throw new Error('Continuum shader marker not found; refusing to patch an unknown renderer revision.');
}

const patchedSource = source.replace(continuumPattern, replacement);
const moduleUrl = URL.createObjectURL(new Blob([patchedSource], { type: 'text/javascript' }));
try {
  await import(moduleUrl);
} finally {
  URL.revokeObjectURL(moduleUrl);
}
