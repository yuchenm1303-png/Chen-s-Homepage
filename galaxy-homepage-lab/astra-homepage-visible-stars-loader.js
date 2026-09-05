const upstreamUrl = new URL('./astra-homepage-glass-capture-loader.js', import.meta.url);
const response = await fetch(upstreamUrl, { cache: 'no-store' });
if (!response.ok) throw new Error(`Failed to load homepage galaxy adapter: ${response.status}`);

let source = await response.text();
const directoryUrl = new URL('./', import.meta.url).href;

function replaceUnique(input, search, replacement, label) {
  const first = input.indexOf(search);
  if (first < 0) {
    throw new Error(`[homepage-visible-stars] ${label} marker not found; refusing to patch an unknown revision.`);
  }
  if (input.indexOf(search, first + search.length) >= 0) {
    throw new Error(`[homepage-visible-stars] ${label} marker is ambiguous; refusing to patch.`);
  }
  return input.slice(0, first) + replacement + input.slice(first + search.length);
}

// This adapter executes the existing homepage loader from a Blob. Preserve the
// loader's real repository base URL so its nested renderer fetches still resolve
// to galaxy-homepage-lab rather than blob:.
source = replaceUnique(
  source,
  "const upstreamUrl = new URL('./astra-deep-nebula-mid-variants-loader.js', import.meta.url);",
  `const upstreamUrl = new URL('./astra-deep-nebula-mid-variants-loader.js', ${JSON.stringify(directoryUrl)});`,
  'Stable loader upstream URL',
);
source = replaceUnique(
  source,
  "const directoryUrl = new URL('./', import.meta.url).href;",
  `const directoryUrl = ${JSON.stringify(directoryUrl)};`,
  'Stable loader directory URL',
);

// Keep the approved 48.8k point population exactly intact. The problem is that
// a large share of the 34k micro stars reaches the screen as sub-pixel energy,
// so raising point count mostly adds GPU work without adding visible stars.
// Patch only the final renderer's micro-star visibility floor and source energy.
source = replaceUnique(
  source,
  'const capturePatch = `',
  'let capturePatch = `',
  'Mutable final-renderer patch',
);

const visibilityPatch = `
// Visibility-only experiment: do not change star count, placement, palettes,
// bloom, camera, or flight behavior. Lift only micro-star energy that was being
// lost below the practical display threshold.
source = replaceOnce(
  source,
  /vParticleDiameter = max\\(opticalDiameter, uPixelRatio \\* 0\\.58\\);/,
  'vParticleDiameter = max(opticalDiameter, uPixelRatio * 0.90);',
  'Micro-star minimum optical footprint',
);
source = replaceOnce(
  source,
  /vFluxCompensation = clamp\\(ratio \\* ratio, 1\\.0, 1\\.85\\);/,
  'vFluxCompensation = clamp(ratio * ratio, 1.0, 2.35);',
  'Micro-star sub-pixel flux compensation',
);
source = replaceOnce(
  source,
  /data\\.brightness\\[i\\] = \\(0\\.46 \\+ random\\(\\) \\* 0\\.46\\) \\* centreBoost \\* complexBoost \\* depthQuiet;/,
  'data.brightness[i] = (0.54 + random() * 0.44) * centreBoost * complexBoost * depthQuiet;',
  'Micro-star source brightness floor',
);
source = replaceOnce(
  source,
  /data\\.opacity\\[i\\] = \\(0\\.24 \\+ random\\(\\) \\* 0\\.34\\) \\* band\\.dustTransmission \\* \\(0\\.90 \\+ band\\.centreWeight \\* 0\\.12\\);/,
  'data.opacity[i] = (0.30 + random() * 0.34) * band.dustTransmission * (0.92 + band.centreWeight * 0.12);',
  'Micro-star source opacity floor',
);
`;

const captureAppendMarker = `// The stable loader first injects its performance patch into the deep-nebula
// loader. Put our final-renderer patch after that transform so it targets the
// optimized frame loop without changing any galaxy shader or star distribution.`;
source = replaceUnique(
  source,
  captureAppendMarker,
  `capturePatch += ${JSON.stringify(visibilityPatch)};\n\n${captureAppendMarker}`,
  'Visibility patch append point',
);

const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
try {
  await import(moduleUrl);
} finally {
  URL.revokeObjectURL(moduleUrl);
}
