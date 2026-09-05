const upstreamUrl = new URL('./astra-deep-nebula-loader.js', import.meta.url);
const response = await fetch(upstreamUrl, { cache: 'no-store' });
if (!response.ok) throw new Error(`Failed to load deep-nebula renderer: ${response.status}`);

let source = await response.text();
const directoryUrl = new URL('./', import.meta.url).href;

function replaceOnce(input, search, replacement, label) {
  if (!input.includes(search)) {
    throw new Error(`${label} marker not found; refusing to patch an unknown renderer revision.`);
  }
  return input.replace(search, replacement);
}

// This loader executes the accepted deep-nebula experiment from a Blob URL.
// Preserve the real experiment directory so its layered-star dependency still resolves.
source = replaceOnce(
  source,
  "new URL('./astra-milkyway-layered.js', import.meta.url)",
  `new URL('./astra-milkyway-layered.js', ${JSON.stringify(directoryUrl)})`,
  'Deep-nebula upstream URL',
);

source = replaceOnce(
  source,
  `    float farBand = ribbon(farP.y, farCentre, 0.22);\n    float farCloud = fbm2(farP * 3.05 + vec2(11.7, 19.3));\n    float farMass = smoothstep(0.34, 0.79, farCloud);\n    float farRidge = pow(1.0 - abs(noise2(farP * 6.0 + vec2(5.4, 13.8)) * 2.0 - 1.0), 3.0);\n    float farVoid = smoothstep(0.77, 0.93, noise2(farP * 1.35 + vec2(28.0, 4.0)));\n    float farWindow = gaussianWeight(t, 47.0, 15.0)\n      * gaussianWeight(farP.x, 0.22, 1.28);\n    float farDensity = farWindow * farBand\n      * (0.14 + farMass * 0.92 + farRidge * 0.22)\n      * (1.0 - farVoid * 0.72);`,
  `    float farBand = ribbon(farP.y, farCentre, 0.255);\n    float farCloud = fbm2(farP * 3.05 + vec2(11.7, 19.3));\n    float farMass = smoothstep(0.32, 0.78, farCloud);\n    float farRidge = pow(1.0 - abs(noise2(farP * 6.0 + vec2(5.4, 13.8)) * 2.0 - 1.0), 3.0);\n    float farVoid = smoothstep(0.76, 0.92, noise2(farP * 1.35 + vec2(28.0, 4.0)));\n    float farWindow = gaussianWeight(t, 47.0, 15.5)\n      * gaussianWeight(farP.x, 0.22, 1.42);\n    float farDensity = farWindow * farBand\n      * (0.12 + farMass * 1.08 + farRidge * 0.32)\n      * (1.0 - farVoid * 0.78);`,
  'Far nebula scale',
);

source = replaceOnce(
  source,
  `    float midBand = ribbon(midP.y, midCentre, 0.155 + 0.035 * midNoise);\n    float midMass = smoothstep(0.37, 0.76, midNoise);\n    float midFilament = pow(1.0 - abs(noise2(midP * 7.1 + vec2(17.0, 29.0)) * 2.0 - 1.0), 4.0);\n    float midVoid = smoothstep(0.73, 0.91, noise2(midP * 1.75 + vec2(2.0, 37.0)));\n    float midWindow = gaussianWeight(t, 31.0, 11.5)\n      * gaussianWeight(midP.x, 0.00, 1.12);\n    float midDensity = midWindow * midBand\n      * (0.18 + midMass * 1.18 + midFilament * 0.38)\n      * (1.0 - midVoid * 0.82);`,
  `    float midBand = ribbon(midP.y, midCentre, 0.185 + 0.045 * midNoise);\n    float midMass = smoothstep(0.35, 0.75, midNoise);\n    float midFilament = pow(1.0 - abs(noise2(midP * 7.1 + vec2(17.0, 29.0)) * 2.0 - 1.0), 4.0);\n    float midVoid = smoothstep(0.72, 0.90, noise2(midP * 1.75 + vec2(2.0, 37.0)));\n    float midWindow = gaussianWeight(t, 31.0, 11.8)\n      * gaussianWeight(midP.x, 0.02, 1.22);\n    float midDensity = midWindow * midBand\n      * (0.14 + midMass * 1.35 + midFilament * 0.48)\n      * (1.0 - midVoid * 0.86);`,
  'Mid nebula scale',
);

source = replaceOnce(
  source,
  `    float nearBand = ribbon(nearP.y, nearCentre, 0.105 + 0.026 * nearNoise);\n    float nearMass = smoothstep(0.42, 0.79, nearNoise);\n    float nearWindow = gaussianWeight(t, 17.0, 7.8)\n      * gaussianWeight(nearP.x, -0.33, 0.92);\n    float nearDensity = nearWindow * nearBand * (0.12 + nearMass * 0.88);`,
  `    float nearBand = ribbon(nearP.y, nearCentre, 0.125 + 0.032 * nearNoise);\n    float nearMass = smoothstep(0.40, 0.78, nearNoise);\n    float nearWindow = gaussianWeight(t, 17.0, 8.0)\n      * gaussianWeight(nearP.x, -0.33, 1.02);\n    float nearDensity = nearWindow * nearBand * (0.10 + nearMass * 1.02);`,
  'Near nebula scale',
);

source = replaceOnce(
  source,
  `    float complexC = gaussianWeight(nearP.x, -0.62, 0.22)\n      * gaussianWeight(nearP.y, nearCentre + 0.018, 0.070)\n      * gaussianWeight(t, 18.0, 6.0);`,
  `    float complexC = gaussianWeight(nearP.x, -0.62, 0.22)\n      * gaussianWeight(nearP.y, nearCentre + 0.018, 0.070)\n      * gaussianWeight(t, 18.0, 6.0);\n\n    // Large-scale energy anchors: one warm cathedral-like core, a cold distant\n    // crown and a luminous cavity rim. These reuse existing field values, so\n    // the extra visual scale costs only cheap Gaussian math, not more noise.\n    float warmHalo = gaussianWeight(midP.x, 0.24, 0.46)\n      * gaussianWeight(midP.y, midCentre + 0.018, 0.205)\n      * gaussianWeight(t, 34.0, 9.6);\n    float coreBurst = gaussianWeight(midP.x, 0.24, 0.145)\n      * gaussianWeight(midP.y, midCentre + 0.020, 0.060)\n      * gaussianWeight(t, 34.0, 7.2);\n    float cathedralSpine = gaussianWeight(midP.x, -0.08, 0.58)\n      * ribbon(midP.y, midCentre - 0.070, 0.038)\n      * gaussianWeight(t, 32.0, 10.0)\n      * (0.42 + midFilament * 0.78);\n\n    float coldCrown = gaussianWeight(farP.x, 0.70, 0.50)\n      * gaussianWeight(farP.y, farCentre - 0.085, 0.210)\n      * gaussianWeight(t, 50.0, 12.0)\n      * (0.38 + farMass * 0.78);\n\n    float cavityRadius = length(vec2(\n      (midP.x - 0.24) / 0.40,\n      (midP.y - (midCentre + 0.018)) / 0.165\n    ));\n    float cavityRim = exp(-pow((cavityRadius - 1.0) / 0.19, 2.0))\n      * gaussianWeight(t, 34.0, 8.5)\n      * (0.46 + midMass * 0.54);\n\n    float roseKnot = gaussianWeight(nearP.x, -0.48, 0.30)\n      * gaussianWeight(nearP.y, nearCentre - 0.010, 0.095)\n      * gaussianWeight(t, 18.0, 6.8)\n      * (0.42 + nearMass * 0.68);`,
  'Nebula energy anchors',
);

source = replaceOnce(
  source,
  `    float dust = (\n      dustLane0 * gaussianWeight(t, 24.0, 13.0) * 0.92\n      + dustLane1 * gaussianWeight(t, 29.0, 10.0) * 0.58\n      + dustLane2 * gaussianWeight(t, 15.0, 7.0) * 0.40\n    ) * dustClump;`,
  `    float dust = (\n      dustLane0 * gaussianWeight(t, 24.0, 13.0) * 1.06\n      + dustLane1 * gaussianWeight(t, 29.0, 10.0) * 0.72\n      + dustLane2 * gaussianWeight(t, 15.0, 7.0) * 0.48\n    ) * dustClump;`,
  'Nebula dust contrast',
);

source = replaceOnce(
  source,
  `    vec3 farColor = vec3(0.210, 0.285, 0.395);\n    vec3 midColor = vec3(0.400, 0.405, 0.405);\n    vec3 warmColor = vec3(0.590, 0.390, 0.255);\n    vec3 roseColor = vec3(0.410, 0.245, 0.305);\n\n    vec3 emission = farColor * farDensity * 0.88\n      + mix(midColor, warmColor, 0.34 + midMass * 0.24) * midDensity\n      + mix(warmColor, roseColor, 0.22 + nearMass * 0.30) * nearDensity * 0.82;\n\n    emission += warmColor * complexA * 0.95;\n    emission += mix(farColor, vec3(0.325, 0.425, 0.520), 0.62) * complexB * 0.72;\n    emission += mix(warmColor, roseColor, 0.42) * complexC * 0.58;`,
  `    vec3 farColor = vec3(0.185, 0.270, 0.405);\n    vec3 iceColor = vec3(0.265, 0.410, 0.585);\n    vec3 midColor = vec3(0.390, 0.405, 0.430);\n    vec3 warmColor = vec3(0.620, 0.400, 0.245);\n    vec3 goldColor = vec3(0.735, 0.535, 0.325);\n    vec3 roseColor = vec3(0.455, 0.245, 0.325);\n\n    vec3 emission = farColor * farDensity * 0.94\n      + mix(midColor, warmColor, 0.31 + midMass * 0.28) * midDensity * 1.08\n      + mix(warmColor, roseColor, 0.20 + nearMass * 0.34) * nearDensity * 0.88;\n\n    emission += warmColor * complexA * 1.28;\n    emission += mix(farColor, iceColor, 0.74) * complexB * 0.96;\n    emission += mix(warmColor, roseColor, 0.48) * complexC * 0.78;\n\n    emission += mix(warmColor, goldColor, 0.52) * warmHalo * 0.42;\n    emission += goldColor * coreBurst * 1.62;\n    emission += warmColor * cathedralSpine * 0.72;\n    emission += iceColor * coldCrown * 0.74;\n    emission += mix(iceColor, vec3(0.430, 0.495, 0.575), 0.42) * cavityRim * 0.56;\n    emission += roseColor * roseKnot * 0.62;`,
  'Nebula colour and energy hierarchy',
);

source = replaceOnce(
  source,
  `    transmission *= exp(-dust * stepSize * 0.108);`,
  `    transmission *= exp(-dust * stepSize * 0.118);`,
  'Nebula dust depth',
);

const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
try {
  await import(moduleUrl);
} finally {
  URL.revokeObjectURL(moduleUrl);
}
