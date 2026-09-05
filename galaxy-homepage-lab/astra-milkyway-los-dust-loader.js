const upstreamUrl = new URL('./astra-milkyway-center-contrast-loader.js', import.meta.url);
const response = await fetch(upstreamUrl, { cache: 'no-store' });
if (!response.ok) throw new Error(`Failed to load centre-contrast Milky Way renderer: ${response.status}`);

let source = await response.text();
const directoryUrl = new URL('./', import.meta.url).href;

function replaceOnce(input, search, replacement, label) {
  if (!input.includes(search)) {
    throw new Error(`${label} marker not found; refusing to patch an unknown renderer revision.`);
  }
  return input.replace(search, replacement);
}

// This loader itself executes from a real module URL, but the fetched centre-
// contrast loader will execute from a blob URL. Pin every relative base that
// centre-contrast derives from import.meta.url before creating that blob.
source = replaceOnce(
  source,
  "new URL('./astra-milkyway-worldspace-loader.js', import.meta.url)",
  `new URL('./astra-milkyway-worldspace-loader.js', ${JSON.stringify(directoryUrl)})`,
  'Centre-contrast upstream URL',
);
source = replaceOnce(
  source,
  "const directoryUrl = new URL('./', import.meta.url).href;",
  `const directoryUrl = ${JSON.stringify(directoryUrl)};`,
  'Centre-contrast directory URL',
);

const dustReturnSearch = `  const dust = dustVertical * dustClump * (0.18 + dustArm * 1.08);
  return {
    density,
    centreWeight,
    armWeight,
    dustTransmission: THREE.MathUtils.clamp(Math.exp(-dust * 0.92), 0.12, 1.0),
  };
}

function sampleFrustumCandidate(random, depth) {`;

const dustReturnReplacement = `  const dust = dustVertical * dustClump * (0.18 + dustArm * 1.08);
  return {
    density,
    centreWeight,
    armWeight,
    dustDensity: dust,
    dustTransmission: THREE.MathUtils.clamp(Math.exp(-dust * 0.92), 0.12, 1.0),
  };
}

function integrateDustTransmissionToStar(x, y, z) {
  const distance = Math.max(Math.hypot(x, y, z), 0.001);
  const steps = 7;
  const stepSize = distance / steps;
  let opticalDepth = 0;
  for (let i = 0; i < steps; i++) {
    const fraction = (i + 0.5) / steps;
    const sx = x * fraction;
    const sy = y * fraction;
    const sz = z * fraction;
    const field = galacticFieldAt(sx, sy, sz);
    const sampleDistance = distance * fraction;
    const q = (sampleDistance - 22.0) / 15.5;
    const nearDust = 0.26 + Math.exp(-(q * q)) * 0.92;
    opticalDepth += field.dustDensity * nearDust * stepSize * 0.095;
  }
  return THREE.MathUtils.clamp(Math.exp(-opticalDepth), 0.055, 1.0);
}

function sampleFrustumCandidate(random, depth) {`;

const brightOpacitySearch =
  `    data.opacity[i] = opacity * (0.72 + 0.28 * depthQuiet) * (isBand ? sample.dustTransmission : 1);`;

const brightOpacityReplacement =
  `    const lineOfSightDust = isBand
      ? integrateDustTransmissionToStar(sample.x, sample.y, sample.z)
      : 1;
    data.opacity[i] = opacity * (0.72 + 0.28 * depthQuiet) * lineOfSightDust;`;

const microOpacitySearch = `    data.opacity[i] = (0.24 + random() * 0.34)
      * sample.dustTransmission
      * (0.90 + sample.centreWeight * 0.12);`;

const microOpacityReplacement = `    const lineOfSightDust = integrateDustTransmissionToStar(sample.x, sample.y, sample.z);
    data.opacity[i] = (0.24 + random() * 0.34)
      * lineOfSightDust
      * (0.90 + sample.centreWeight * 0.12);`;

const injection = `
source = replaceOnce(
  source,
  ${JSON.stringify(dustReturnSearch)},
  ${JSON.stringify(dustReturnReplacement)},
  'Line-of-sight dust helper',
);

source = replaceOnce(
  source,
  ${JSON.stringify(brightOpacitySearch)},
  ${JSON.stringify(brightOpacityReplacement)},
  'Bright-star foreground dust',
);

source = replaceOnce(
  source,
  ${JSON.stringify(microOpacitySearch)},
  ${JSON.stringify(microOpacityReplacement)},
  'Micro-star foreground dust',
);

`;

source = replaceOnce(
  source,
  "const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));",
  `${injection}const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));`,
  'Line-of-sight dust patch insertion',
);

const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
try {
  await import(moduleUrl);
} finally {
  URL.revokeObjectURL(moduleUrl);
}
