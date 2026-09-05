const upstreamUrl = new URL('./astra-deep-nebula-mid-variants-loader.js', import.meta.url);
const response = await fetch(upstreamUrl, { cache: 'no-store' });
if (!response.ok) throw new Error(`Failed to load stable galaxy renderer: ${response.status}`);

let source = await response.text();
const directoryUrl = new URL('./', import.meta.url).href;

function replaceOnce(input, search, replacement, label) {
  if (!input.includes(search)) {
    throw new Error(`${label} marker not found; refusing to patch an unknown renderer revision.`);
  }
  return input.replace(search, replacement);
}

// This wrapper executes from a Blob, so keep the stable loader's nested fetches
// rooted at the real repository directory.
source = replaceOnce(
  source,
  "const upstreamUrl = new URL('./astra-deep-nebula-loader.js', import.meta.url);",
  `const upstreamUrl = new URL('./astra-deep-nebula-loader.js', ${JSON.stringify(directoryUrl)});`,
  'Stable loader upstream URL',
);
source = replaceOnce(
  source,
  "const directoryUrl = new URL('./', import.meta.url).href;",
  `const directoryUrl = ${JSON.stringify(directoryUrl)};`,
  'Stable loader directory URL',
);

// The liquid-glass adapter must read the WebGL canvas while its default
// framebuffer is still valid. Inject one callback immediately after the existing
// EffectComposer render instead of enabling preserveDrawingBuffer globally.
// Keep the callback isolated so a glass failure can never stop the galaxy loop.
const capturePatch = `
source = replaceOnce(
  source,
  /    composer\\.render\\(dt\\);\\n    lastCompositeMs = now;/,
  \`    composer.render(dt);\n    try {\n      window.__SMIREL_HOMEPAGE_GLASS_SYNC__?.(now);\n    } catch (error) {\n      console.warn('[homepage-liquid-glass] frame handoff failed', error);\n    }\n    lastCompositeMs = now;\`,
  'Synchronized homepage glass framebuffer handoff',
);
`;

// The stable loader first injects its performance patch into the deep-nebula
// loader. Put our small handoff patch after that transform so it targets the
// optimized final frame loop without changing any galaxy shader or parameters.
const stableModuleMarker = "const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));";
const bridgeInjection = `
const homepageGlassCapturePatch = ${JSON.stringify(capturePatch)};
source = replaceOnce(
  source,
  moduleMarker,
  homepageGlassCapturePatch + '\\n\\n' + moduleMarker,
  'Homepage glass capture patch insertion point',
);
`;

// stableModuleMarker also appears earlier as the string value assigned to
// moduleMarker. A normal String.replace() would patch that quoted occurrence and
// corrupt the loader itself. Insert only before the final executable statement.
const stableModuleIndex = source.lastIndexOf(stableModuleMarker);
if (stableModuleIndex < 0) {
  throw new Error('Homepage capture bridge insertion point not found; refusing to patch an unknown renderer revision.');
}
source = source.slice(0, stableModuleIndex)
  + bridgeInjection + '\n\n'
  + source.slice(stableModuleIndex);

const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
try {
  await import(moduleUrl);
} finally {
  URL.revokeObjectURL(moduleUrl);
}
