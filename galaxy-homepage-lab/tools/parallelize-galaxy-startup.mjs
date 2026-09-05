import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const targetDir = resolve(process.argv[2] || '.');
const runtimePath = join(targetDir, 'astra-homepage-runtime.generated.js');
const indexPath = join(targetDir, 'index.html');

const runtime = await readFile(runtimePath, 'utf8');
let html = await readFile(indexPath, 'utf8');

const cacheUrlMatch = runtime.match(/\.\/astra-starfield-cache\.bin\?v=([0-9a-f]{16})/i);
if (!cacheUrlMatch) {
  throw new Error('Generated runtime star-cache URL marker not found.');
}
const cacheHash = cacheUrlMatch[1];
const cacheUrl = `./astra-starfield-cache.bin?v=${cacheHash}`;

const cacheStartMarker = 'const __smirelStarCachePromise = fetch(';
const wrapperOpenMarker = '\n\n__smirelStarCachePromise.then((__smirelStarCache) => {\n';
const cacheStart = runtime.indexOf(cacheStartMarker);
const wrapperOpen = runtime.indexOf(wrapperOpenMarker, cacheStart);
if (cacheStart < 0 || wrapperOpen < 0) {
  throw new Error('Generated runtime still does not expose the expected serialized star-cache gate.');
}

const fieldMarker = `const microField = __smirelStarCache
  ? finishMicroFieldFromData(__smirelStarCache.micro)
  : buildMicroField();
const brightField = __smirelStarCache
  ? finishBrightFieldFromData(__smirelStarCache.bright)
  : buildBrightField();`;
const fieldIndex = runtime.indexOf(fieldMarker, wrapperOpen + wrapperOpenMarker.length);
if (fieldIndex < 0) {
  throw new Error('Generated runtime cached star-field construction marker not found.');
}

const rendererIndex = runtime.indexOf('const renderer = new THREE.WebGLRenderer({', wrapperOpen + wrapperOpenMarker.length);
const continuumTargetIndex = runtime.indexOf('const continuumTarget = new THREE.WebGLRenderTarget(', rendererIndex);
const continuumSceneIndex = runtime.indexOf('const continuumScene = new THREE.Scene();', rendererIndex);
if (rendererIndex < 0 || continuumTargetIndex < 0 || continuumSceneIndex < 0
    || rendererIndex > fieldIndex || continuumTargetIndex > fieldIndex || continuumSceneIndex > fieldIndex) {
  throw new Error('Renderer/continuum initialization is not safely located before star-field binding.');
}

const cachePromiseReplacement = `const __smirelStarCacheBufferPromise = window.__SMIREL_STAR_CACHE_BUFFER_PROMISE__
  || fetch(
    new URL('${cacheUrl}', import.meta.url),
    { cache: 'force-cache' },
  )
    .then((response) => {
      if (!response.ok) throw new Error(\`Star cache request failed: \${response.status}\`);
      return response.arrayBuffer();
    })
    .catch((error) => {
      console.warn('Early star cache unavailable; falling back to runtime request/generation.', error);
      return null;
    });

const __smirelStarCachePromise = __smirelStarCacheBufferPromise
  .then((buffer) => buffer ? __smirelDecodeStarCache(buffer) : null)
  .catch((error) => {
    console.warn('Precomputed star cache unavailable; falling back to deterministic runtime generation.', error);
    return null;
  });`;

let output = runtime.slice(0, cacheStart)
  + cachePromiseReplacement
  + runtime.slice(wrapperOpen + wrapperOpenMarker.length);

const warmupMarker = `let __smirelContinuumWarmupPromise = Promise.resolve();
if (typeof renderer.compileAsync === 'function') {
  const __smirelPreviousRenderTarget = renderer.getRenderTarget();
  try {
    renderer.setRenderTarget(continuumTarget);
    __smirelContinuumWarmupPromise = Promise.resolve(
      renderer.compileAsync(continuumScene, continuumCamera),
    )
      .catch((error) => {
        console.warn('Continuum shader warmup did not complete asynchronously.', error);
      })
      .finally(() => {
        renderer.setRenderTarget(__smirelPreviousRenderTarget);
      });
  } catch (error) {
    renderer.setRenderTarget(__smirelPreviousRenderTarget);
    console.warn('Continuum shader warmup could not start.', error);
  }
}

Promise.all([__smirelStarCachePromise, __smirelContinuumWarmupPromise])
  .then(([__smirelStarCache]) => {
`;

const outputFieldIndex = output.indexOf(fieldMarker);
if (outputFieldIndex < 0) {
  throw new Error('Star-field marker disappeared while removing serialized startup gate.');
}
output = output.slice(0, outputFieldIndex)
  + warmupMarker
  + output.slice(outputFieldIndex);

const requiredRuntimeMarkers = [
  'window.__SMIREL_STAR_CACHE_BUFFER_PROMISE__',
  'renderer.compileAsync(continuumScene, continuumCamera)',
  'Promise.all([__smirelStarCachePromise, __smirelContinuumWarmupPromise])',
  fieldMarker,
  "window.__SMIREL_STAR_FLIGHT_INSTALL__",
  "window.__SMIREL_HOMEPAGE_GLASS_SYNC__",
];
for (const marker of requiredRuntimeMarkers) {
  if (!output.includes(marker)) {
    throw new Error(`Parallelized runtime is missing required marker: ${marker.slice(0, 96)}`);
  }
}
if (output.includes(wrapperOpenMarker.trim())) {
  throw new Error('Serialized whole-runtime star-cache gate still remains after parallelization.');
}

html = html.replace(/\s*<script id="smirel-star-cache-bootstrap">[\s\S]*?<\/script>/g, '');
html = html.replace(/\s*<link rel="preload" href="\.\/astra-starfield-cache\.bin[^\"]*" as="fetch"[^>]*>/g, '');
const headMarker = '<head>';
if (!html.includes(headMarker)) {
  throw new Error('index.html head marker not found while installing early star-cache fetch.');
}
const earlyFetchScript = `${headMarker}\n  <script id="smirel-star-cache-bootstrap">\n    (() => {\n      const url = ${JSON.stringify(cacheUrl)};\n      window.__SMIREL_STAR_CACHE_BUFFER_PROMISE__ = fetch(url, { cache: 'force-cache' })\n        .then((response) => {\n          if (!response.ok) throw new Error(\`Star cache request failed: \${response.status}\`);\n          return response.arrayBuffer();\n        })\n        .catch((error) => {\n          console.warn('Early star cache fetch failed; runtime fallback remains available.', error);\n          return null;\n        });\n    })();\n  </script>`;
html = html.replace(headMarker, earlyFetchScript);

if (!html.includes('id="smirel-star-cache-bootstrap"')) {
  throw new Error('Early star-cache bootstrap was not inserted into index.html.');
}
if (html.includes('rel="preload" href="./astra-starfield-cache.bin')) {
  throw new Error('Legacy star-cache preload hint remains beside the active early fetch.');
}

await writeFile(runtimePath, output, 'utf8');
await writeFile(indexPath, html, 'utf8');
console.log(`Parallelized galaxy startup in ${targetDir}: early ${cacheUrl} fetch + continuum shader warmup.`);
