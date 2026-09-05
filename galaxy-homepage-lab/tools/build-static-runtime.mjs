import { readFile, writeFile, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const targetDir = resolve(process.argv[2] || '.');
const buildVersion = process.argv[3] || String(Date.now());
const terminalPattern = /const moduleUrl = URL\.createObjectURL\(new Blob\(\[source\], \{ type: 'text\/javascript' \}\)\);\s*try \{\s*await import\(moduleUrl\);\s*\} finally \{\s*URL\.revokeObjectURL\(moduleUrl\);\s*\}\s*$/;
const nativeFetch = globalThis.fetch;
let stageCounter = 0;

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

async function rewriteIndex(runtimeHash) {
  const indexPath = join(targetDir, 'index.html');
  let html = await readFile(indexPath, 'utf8');

  html = html.replace(/\s*<link rel="modulepreload" href="\.\/astra-homepage-glass-capture-loader\.js[^\"]*" \/>/g, '');
  html = html.replace(/\s*<script src="\.\/homepage-galaxy-preload\.js[^\"]*"><\/script>/g, '');

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
  const runtime = await expandRuntime();
  const runtimeHash = createHash('sha256').update(runtime).digest('hex');
  const outputPath = join(targetDir, 'astra-homepage-runtime.generated.js');
  await writeFile(outputPath, runtime, 'utf8');
  await rewriteIndex(runtimeHash);
  console.log(`Generated ${outputPath} (${runtime.length} bytes, sha256 ${runtimeHash})`);
} finally {
  globalThis.fetch = nativeFetch;
}
