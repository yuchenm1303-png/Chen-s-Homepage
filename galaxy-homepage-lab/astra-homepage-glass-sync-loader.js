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

// This wrapper itself executes from a Blob. Pin every relative lookup in the
// stable loader back to the real repository directory so the existing nested
// loader chain keeps resolving exactly as before.
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

// A WebGL drawing buffer created with preserveDrawingBuffer=false is only
// guaranteed while the owning renderer is actively presenting it. Capturing
// the galaxy later from a separate requestAnimationFrame can therefore return
// an invalidated/black buffer. Run the liquid-glass handoff synchronously,
// immediately after the final composer render, while the pixels are valid.
source = replaceOnce(
  source,
  "    composer.render(dt);\n    lastCompositeMs = now;",
  `    composer.render(dt);
    const afterRender = window.__ASTRA_AFTER_RENDER__;
    if (typeof afterRender === 'function') {
      try {
        afterRender(now);
      } catch (error) {
        console.warn('[astra-after-render] consumer failed', error);
      }
    }
    lastCompositeMs = now;`,
  'Post-render liquid glass synchronization hook',
);

const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
try {
  await import(moduleUrl);
} finally {
  URL.revokeObjectURL(moduleUrl);
}
