const upstreamUrl = new URL('./astra-milkyway-worldspace-loader.js', import.meta.url);
const response = await fetch(upstreamUrl, { cache: 'no-store' });
if (!response.ok) throw new Error(`Failed to load world-space Milky Way renderer: ${response.status}`);

let source = await response.text();
const directoryUrl = new URL('./', import.meta.url).href;

function replaceOnce(input, search, replacement, label) {
  if (!input.includes(search)) {
    throw new Error(`${label} marker not found; refusing to patch an unknown renderer revision.`);
  }
  return input.replace(search, replacement);
}

// The fetched loader will execute from a blob URL, so preserve its original
// directory as the base for loading astra-milkyway-layered.js.
source = replaceOnce(
  source,
  "new URL('./astra-milkyway-layered.js', import.meta.url)",
  `new URL('./astra-milkyway-layered.js', ${JSON.stringify(directoryUrl)})`,
  'World-space source URL',
);

source = replaceOnce(
  source,
  `    float centreWeight = exp(-pow(radius / 12.5, 2.0));\n    float diskScaleHeight = 2.35 + radius * 0.010 + centreWeight * 2.65;\n    float vertical = exp(-0.82 * pow(gz / diskScaleHeight, 2.0));\n    float radial = exp(-radius / 58.0);\n    float bulge = centreWeight * exp(-0.38 * pow(gz / 4.4, 2.0));`,
  `    float centreWeight = exp(-pow(radius / 10.8, 2.0));\n    float diskScaleHeight = 1.72 + radius * 0.008 + centreWeight * 3.55;\n    float vertical = exp(-0.94 * pow(gz / diskScaleHeight, 2.0));\n    float radial = exp(-radius / 50.0);\n    float bulge = centreWeight * exp(-0.31 * pow(gz / 5.1, 2.0));\n    float barX = gx * 0.8660254 + gy * 0.5;\n    float barY = -gx * 0.5 + gy * 0.8660254;\n    float bar = exp(-pow(barX / 13.5, 2.0) - pow(barY / 5.2, 2.0) - pow(gz / 4.1, 2.0));`,
  'GLSL bulge model',
);

source = replaceOnce(
  source,
  `    float stellarDensity = vertical\n      * (0.17 + radial * 0.54 + bulge * 1.75)\n      * (0.52 + armWeight * 0.78)`,
  `    float stellarDensity = vertical\n      * (0.075 + radial * 0.41 + bulge * 2.85 + bar * 1.10)\n      * (0.50 + armWeight * 0.80)`,
  'GLSL stellar density contrast',
);

source = replaceOnce(
  source,
  `    vec3 coolLight = vec3(0.300, 0.338, 0.382);\n    vec3 warmLight = vec3(0.515, 0.420, 0.310);\n    vec3 stellarColor = mix(coolLight, warmLight, 0.12 + centreWeight * 0.72 + armWeight * 0.05);`,
  `    vec3 coolLight = vec3(0.292, 0.330, 0.376);\n    vec3 warmLight = vec3(0.545, 0.435, 0.305);\n    vec3 stellarColor = mix(coolLight, warmLight, 0.10 + centreWeight * 0.82 + bar * 0.18 + armWeight * 0.04);`,
  'GLSL centre colour hierarchy',
);

source = replaceOnce(
  source,
  `  const centreWeight = Math.exp(-Math.pow(radius / 12.5, 2));\n  const diskScaleHeight = 2.35 + radius * 0.010 + centreWeight * 2.65;\n  const vertical = Math.exp(-0.82 * Math.pow(gz / diskScaleHeight, 2));\n  const radial = Math.exp(-radius / 58.0);\n  const bulge = centreWeight * Math.exp(-0.38 * Math.pow(gz / 4.4, 2));`,
  `  const centreWeight = Math.exp(-Math.pow(radius / 10.8, 2));\n  const diskScaleHeight = 1.72 + radius * 0.008 + centreWeight * 3.55;\n  const vertical = Math.exp(-0.94 * Math.pow(gz / diskScaleHeight, 2));\n  const radial = Math.exp(-radius / 50.0);\n  const bulge = centreWeight * Math.exp(-0.31 * Math.pow(gz / 5.1, 2));\n  const barX = gx * 0.8660254 + gy * 0.5;\n  const barY = -gx * 0.5 + gy * 0.8660254;\n  const bar = Math.exp(\n    -Math.pow(barX / 13.5, 2)\n    -Math.pow(barY / 5.2, 2)\n    -Math.pow(gz / 4.1, 2)\n  );`,
  'CPU bulge model',
);

source = replaceOnce(
  source,
  `  const density = vertical\n    * (0.17 + radial * 0.54 + bulge * 1.75)\n    * (0.52 + armWeight * 0.78)`,
  `  const density = vertical\n    * (0.075 + radial * 0.41 + bulge * 2.85 + bar * 1.10)\n    * (0.50 + armWeight * 0.80)`,
  'CPU stellar density contrast',
);

const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
try {
  await import(moduleUrl);
} finally {
  URL.revokeObjectURL(moduleUrl);
}
