import { readFile, writeFile, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const targetDir = resolve(process.argv[2] || '.');
const buildVersion = process.argv[3] || String(Date.now());
const terminalPattern = /const moduleUrl = URL\.createObjectURL\(new Blob\(\[source\], \{ type: 'text\/javascript' \}\)\);\s*try \{\s*await import\(moduleUrl\);\s*\} finally \{\s*URL\.revokeObjectURL\(moduleUrl\);\s*\}\s*$/;
const nativeFetch = globalThis.fetch;
let stageCounter = 0;

const STAR_CACHE_MAGIC = 'SMIRELST';
const STAR_CACHE_VERSION = 1;
const STAR_CACHE_HEADER_BYTES = 32;
const STAR_FLOATS_PER_POINT = 11;
const STAR_FIELD_LAYOUT = [
  ['positions', 3],
  ['brightness', 1],
  ['colors', 3],
  ['opacity', 1],
  ['scale', 1],
  ['phase', 1],
  ['rate', 1],
];

async function localFetch(input) {
  const href = typeof input === 'string'
    ? input
    : (input instanceof URL ? input.href : input?.url);
  if (!href) throw new Error('Build-time galaxy loader received an unreadable fetch input.');
  const url = new URL(href);
  if (url.protocol !== 'file:') {
    if (typeof nativeFetch === 'function') return nativeFetch(input);
    throw new Error(`Build-time galaxy loader tried to fetch an unsupported URL: ${url.href}`);
  }
  try {
    const text = await readFile(fileURLToPath(url), 'utf8');
    return { ok: true, status: 200, statusText: 'OK', text: async () => text };
  } catch (error) {
    return { ok: false, status: 404, statusText: 'Not Found', text: async () => '', error };
  }
}

async function executeLoader(loaderSource, label) {
  if (!terminalPattern.test(loaderSource)) {
    throw new Error(`${label}: final Blob import marker not found; refusing to flatten an unknown loader revision.`);
  }
  const executable = loaderSource.replace(
    terminalPattern,
    'globalThis.__SMIREL_GALAXY_BUILD_RESULT__ = source;\n',
  );
  const tempPath = join(
    targetDir,
    `.smirel-galaxy-build-${process.pid}-${Date.now()}-${stageCounter++}.mjs`,
  );
  await writeFile(tempPath, executable, 'utf8');
  delete globalThis.__SMIREL_GALAXY_BUILD_RESULT__;
  try {
    await import(`${pathToFileURL(tempPath).href}?stage=${stageCounter}`);
    const result = globalThis.__SMIREL_GALAXY_BUILD_RESULT__;
    if (typeof result !== 'string' || !result.trim()) {
      throw new Error(`${label}: loader did not return transformed source.`);
    }
    return result;
  } finally {
    delete globalThis.__SMIREL_GALAXY_BUILD_RESULT__;
    await unlink(tempPath).catch(() => {});
  }
}

async function expandRuntime() {
  const capturePath = join(targetDir, 'astra-homepage-glass-capture-loader.js');
  const captureSource = await readFile(capturePath, 'utf8');
  const transformedMid = await executeLoader(captureSource, 'homepage capture loader');
  const transformedDeep = await executeLoader(transformedMid, 'mid-nebula loader');
  const finalRuntime = await executeLoader(transformedDeep, 'deep-nebula loader');

  const requiredMarkers = [
    "import * as THREE from 'three';",
    'float splitAmount =',
    'antialias: false',
    'multisampling: 0',
    'window.__SMIREL_STAR_FLIGHT_INSTALL__',
    'window.__SMIREL_HOMEPAGE_GLASS_SYNC__',
    'const continuumMotionTarget = continuumTarget.clone();',
  ];
  for (const marker of requiredMarkers) {
    if (!finalRuntime.includes(marker)) {
      throw new Error(`Generated galaxy runtime is missing required marker: ${marker}`);
    }
  }
  const forbiddenMarkers = [
    "fetch(upstreamUrl, { cache: 'no-store' })",
    'URL.createObjectURL(new Blob([source]',
  ];
  for (const marker of forbiddenMarkers) {
    if (finalRuntime.includes(marker)) {
      throw new Error(`Generated galaxy runtime still contains runtime loader machinery: ${marker}`);
    }
  }
  return finalRuntime;
}

function srgbToLinear(value) {
  return value <= 0.04045
    ? value * 0.0773993808
    : Math.pow(value * 0.9478672986 + 0.0521327014, 2.4);
}

class BuildColor {
  constructor(style) {
    if (typeof style !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(style)) {
      throw new Error(`Unsupported build-time star color: ${style}`);
    }
    const hex = Number.parseInt(style.slice(1), 16);
    this.r = srgbToLinear(((hex >> 16) & 0xff) / 255);
    this.g = srgbToLinear(((hex >> 8) & 0xff) / 255);
    this.b = srgbToLinear((hex & 0xff) / 255);
  }
}

const BUILD_THREE = Object.freeze({
  Color: BuildColor,
  MathUtils: Object.freeze({
    clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    },
    degToRad(degrees) {
      return degrees * Math.PI / 180;
    },
  }),
});

function replaceGeneratedOnce(input, pattern, replacement, label) {
  if (!pattern.test(input)) {
    throw new Error(`${label} marker not found; refusing to precompute an unknown star generator revision.`);
  }
  return input.replace(pattern, replacement);
}

async function generateStarPointData() {
  const rendererSource = await readFile(join(targetDir, 'astra-milkyway-layered.js'), 'utf8');
  const configStart = rendererSource.indexOf('const CONFIG = Object.freeze({');
  const filterStart = rendererSource.indexOf('const FILTERED_CORE =', configStart);
  const generatorStart = rendererSource.indexOf('function seeded(seed) {');
  const continuumStart = rendererSource.indexOf('function buildContinuumField() {', generatorStart);
  if (configStart < 0 || filterStart < 0 || generatorStart < 0 || continuumStart < 0) {
    throw new Error('Star generator source markers are incomplete; refusing to precompute unknown renderer data.');
  }

  const prelude = rendererSource.slice(configStart, filterStart);
  let generator = rendererSource.slice(generatorStart, continuumStart);
  generator = replaceGeneratedOnce(
    generator,
    /  return finishPoints\(data, BRIGHT_VERTEX, BRIGHT_FRAGMENT, \{[\s\S]*?\n  \}\);\n\}/,
    '  return data;\n}',
    'Bright-field build return',
  );
  generator = replaceGeneratedOnce(
    generator,
    /  const out = finishPoints\(data, MICRO_VERTEX, MICRO_FRAGMENT, \{[\s\S]*?\n  \}\);\n  out\.points\.renderOrder = -10;\n  return out;\n\}/,
    '  return data;\n}',
    'Micro-field build return',
  );

  const factory = new Function(
    'THREE',
    `"use strict";\n${prelude}\n${generator}\nreturn { config: CONFIG, bright: buildBrightField(), micro: buildMicroField() };`,
  );
  const result = factory(BUILD_THREE);
  const brightCount = Number(result?.config?.brightStarCount);
  const microCount = Number(result?.config?.microStarCount);
  if (!Number.isInteger(brightCount) || brightCount <= 0 || !Number.isInteger(microCount) || microCount <= 0) {
    throw new Error('Precomputed star counts are invalid.');
  }
  return { brightCount, microCount, bright: result.bright, micro: result.micro };
}

function appendFieldBuffers(chunks, data, count, label) {
  for (const [key, components] of STAR_FIELD_LAYOUT) {
    const array = data?.[key];
    const expectedLength = count * components;
    if (!(array instanceof Float32Array) || array.length !== expectedLength) {
      throw new Error(`${label}.${key} expected ${expectedLength} Float32 values.`);
    }
    chunks.push(Buffer.from(array.buffer, array.byteOffset, array.byteLength));
  }
}

async function buildStarCache() {
  const generated = await generateStarPointData();
  const header = Buffer.alloc(STAR_CACHE_HEADER_BYTES);
  header.write(STAR_CACHE_MAGIC, 0, 8, 'ascii');
  header.writeUInt32LE(STAR_CACHE_VERSION, 8);
  header.writeUInt32LE(generated.brightCount, 12);
  header.writeUInt32LE(generated.microCount, 16);
  header.writeUInt32LE(STAR_FLOATS_PER_POINT, 20);

  const chunks = [header];
  appendFieldBuffers(chunks, generated.bright, generated.brightCount, 'bright');
  appendFieldBuffers(chunks, generated.micro, generated.microCount, 'micro');
  const payload = Buffer.concat(chunks);
  const expectedBytes = STAR_CACHE_HEADER_BYTES
    + (generated.brightCount + generated.microCount) * STAR_FLOATS_PER_POINT * Float32Array.BYTES_PER_ELEMENT;
  if (payload.length !== expectedBytes) {
    throw new Error(`Star cache byte size mismatch: expected ${expectedBytes}, got ${payload.length}.`);
  }

  const hash = createHash('sha256').update(payload).digest('hex');
  const outputPath = join(targetDir, 'astra-starfield-cache.bin');
  await writeFile(outputPath, payload);
  return {
    hash,
    outputPath,
    bytes: payload.length,
    brightCount: generated.brightCount,
    microCount: generated.microCount,
  };
}

function injectStarCache(runtime, cache) {
  const finishHelpers = `
function finishBrightFieldFromData(data) {
  return finishPoints(data, BRIGHT_VERTEX, BRIGHT_FRAGMENT, {
    uIntensity: { value: CONFIG.intensity },
    uIntroProgress: { value: 0 },
    uPixelRatio: { value: 1 },
    uTime: { value: 0 },
    uTwinkleSpeed: { value: CONFIG.twinkleSpeed },
  });
}

function finishMicroFieldFromData(data) {
  const out = finishPoints(data, MICRO_VERTEX, MICRO_FRAGMENT, {
    uIntensity: { value: CONFIG.microIntensity },
    uIntroProgress: { value: 0 },
    uPixelRatio: { value: 1 },
    uTime: { value: 0 },
    uTwinkleSpeed: { value: CONFIG.microTwinkleSpeed },
  });
  out.points.renderOrder = -10;
  return out;
}

`;
  const continuumMarker = 'function buildContinuumField() {';
  if (!runtime.includes(continuumMarker)) {
    throw new Error('Continuum builder marker not found while injecting precomputed star data.');
  }
  runtime = runtime.replace(continuumMarker, `${finishHelpers}${continuumMarker}`);

  const fieldMarker = `const microField = buildMicroField();
const brightField = buildBrightField();`;
  if (!runtime.includes(fieldMarker)) {
    throw new Error('Star field construction marker not found while injecting precomputed star data.');
  }
  runtime = runtime.replace(
    fieldMarker,
    `const microField = __smirelStarCache
  ? finishMicroFieldFromData(__smirelStarCache.micro)
  : buildMicroField();
const brightField = __smirelStarCache
  ? finishBrightFieldFromData(__smirelStarCache.bright)
  : buildBrightField();`,
  );

  const bodyMarker = "const canvas = document.getElementById('galaxyCanvas');";
  const bodyIndex = runtime.indexOf(bodyMarker);
  if (bodyIndex < 0) {
    throw new Error('Galaxy runtime body marker not found while injecting star cache bootstrap.');
  }
  const imports = runtime.slice(0, bodyIndex);
  const body = runtime.slice(bodyIndex);
  const bootstrap = `
const __SMIREL_STAR_CACHE_MAGIC__ = [83, 77, 73, 82, 69, 76, 83, 84];
const __SMIREL_STAR_CACHE_HEADER_BYTES__ = ${STAR_CACHE_HEADER_BYTES};
const __SMIREL_STAR_FLOATS_PER_POINT__ = ${STAR_FLOATS_PER_POINT};

function __smirelDecodeField(buffer, startOffset, count) {
  let offset = startOffset;
  const take = (components) => {
    const length = count * components;
    const out = new Float32Array(buffer, offset, length);
    offset += out.byteLength;
    return out;
  };
  return {
    data: {
      positions: take(3),
      brightness: take(1),
      colors: take(3),
      opacity: take(1),
      scale: take(1),
      phase: take(1),
      rate: take(1),
    },
    offset,
  };
}

function __smirelDecodeStarCache(buffer) {
  const view = new DataView(buffer);
  if (buffer.byteLength < __SMIREL_STAR_CACHE_HEADER_BYTES__) throw new Error('Star cache is truncated.');
  for (let i = 0; i < __SMIREL_STAR_CACHE_MAGIC__.length; i++) {
    if (view.getUint8(i) !== __SMIREL_STAR_CACHE_MAGIC__[i]) throw new Error('Star cache magic mismatch.');
  }
  const version = view.getUint32(8, true);
  const brightCount = view.getUint32(12, true);
  const microCount = view.getUint32(16, true);
  const floatsPerPoint = view.getUint32(20, true);
  if (version !== ${STAR_CACHE_VERSION}) throw new Error('Unsupported star cache version.');
  if (brightCount !== ${cache.brightCount} || microCount !== ${cache.microCount}) throw new Error('Star cache count mismatch.');
  if (floatsPerPoint !== __SMIREL_STAR_FLOATS_PER_POINT__) throw new Error('Star cache layout mismatch.');
  const expectedBytes = __SMIREL_STAR_CACHE_HEADER_BYTES__
    + (brightCount + microCount) * floatsPerPoint * Float32Array.BYTES_PER_ELEMENT;
  if (buffer.byteLength !== expectedBytes) throw new Error('Star cache byte length mismatch.');
  const bright = __smirelDecodeField(buffer, __SMIREL_STAR_CACHE_HEADER_BYTES__, brightCount);
  const micro = __smirelDecodeField(buffer, bright.offset, microCount);
  if (micro.offset !== buffer.byteLength) throw new Error('Star cache decode did not consume the full payload.');
  return { bright: bright.data, micro: micro.data };
}

const __smirelStarCachePromise = fetch(
  new URL('./astra-starfield-cache.bin?v=${cache.hash.slice(0, 16)}', import.meta.url),
  { cache: 'force-cache' },
)
  .then((response) => {
    if (!response.ok) throw new Error(\`Star cache request failed: \${response.status}\`);
    return response.arrayBuffer();
  })
  .then(__smirelDecodeStarCache)
  .catch((error) => {
    console.warn('Precomputed star cache unavailable; falling back to deterministic runtime generation.', error);
    return null;
  });

__smirelStarCachePromise.then((__smirelStarCache) => {
${body}
}).catch((error) => {
  console.error('Galaxy runtime initialization failed.', error);
});
`;
  return `${imports}${bootstrap}`;
}

async function rewriteIndex(runtimeHash, starCacheHash) {
  const indexPath = join(targetDir, 'index.html');
  let html = await readFile(indexPath, 'utf8');

  html = html.replace(/\s*<link rel="modulepreload" href="\.\/astra-homepage-glass-capture-loader\.js[^\"]*" \/>/g, '');
  html = html.replace(/\s*<script src="\.\/homepage-galaxy-preload\.js[^\"]*"><\/script>/g, '');

  const starPreloadPattern = /\s*<link rel="preload" href="\.\/astra-starfield-cache\.bin[^\"]*" as="fetch"[^>]*>/g;
  html = html.replace(starPreloadPattern, '');
  const headClose = '</head>';
  if (!html.includes(headClose)) throw new Error('index.html head closing tag not found.');
  html = html.replace(
    headClose,
    `  <link rel="preload" href="./astra-starfield-cache.bin?v=${starCacheHash.slice(0, 16)}" as="fetch" crossorigin="anonymous">\n${headClose}`,
  );

  const loaderScriptPattern = /<script type="module" src="\.\/astra-homepage-glass-capture-loader\.js[^\"]*"><\/script>/;
  if (!loaderScriptPattern.test(html)) {
    throw new Error('index.html galaxy runtime loader tag not found; refusing to rewrite an unknown page revision.');
  }
  html = html.replace(
    loaderScriptPattern,
    `<script type="module" src="./astra-homepage-runtime.generated.js?v=${buildVersion}-${runtimeHash.slice(0, 12)}"></script>`,
  );
  await writeFile(indexPath, html, 'utf8');
}

globalThis.fetch = localFetch;
try {
  const starCache = await buildStarCache();
  const expandedRuntime = await expandRuntime();
  const runtime = injectStarCache(expandedRuntime, starCache);
  const runtimeHash = createHash('sha256').update(runtime).digest('hex');
  const outputPath = join(targetDir, 'astra-homepage-runtime.generated.js');
  await writeFile(outputPath, runtime, 'utf8');
  await rewriteIndex(runtimeHash, starCache.hash);
  console.log(`Generated ${outputPath} (${runtime.length} bytes, sha256 ${runtimeHash})`);
  console.log(`Generated ${starCache.outputPath} (${starCache.bytes} bytes, sha256 ${starCache.hash})`);
} finally {
  globalThis.fetch = nativeFetch;
}
