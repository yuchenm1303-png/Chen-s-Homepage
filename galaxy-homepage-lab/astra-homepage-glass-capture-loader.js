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
// framebuffer is still valid. The same final-renderer patch also installs the
// single interactive-star prototype without changing the approved galaxy math.
const capturePatch = `
source = replaceOnce(
  source,
  /    composer\\.render\\(dt\\);\\n    lastCompositeMs = now;/,
  \`    composer.render(dt);\n    try {\n      window.__SMIREL_HOMEPAGE_GLASS_SYNC__?.(now);\n    } catch (error) {\n      console.warn('[homepage-liquid-glass] frame handoff failed', error);\n    }\n    lastCompositeMs = now;\`,
  'Synchronized homepage glass framebuffer handoff',
);

source = replaceOnce(
  source,
  /const lookTarget = new THREE\\.Vector3\\(\\);\\nconst cameraForward = new THREE\\.Vector3\\(\\);/,
  \`const lookTarget = new THREE.Vector3();
const starFlight = window.__SMIREL_STAR_FLIGHT_INSTALL__?.({
  THREE,
  scene,
  camera,
  brightField,
  CONFIG,
  canvas,
  pointer,
  reducedMotion,
}) || null;
function normalizeInteractiveStarRenderOrder() {
  if (!starFlight || starFlight.__renderOrderNormalized) return;
  let coreFound = false;
  scene.traverse((object) => {
    const material = object.material;
    const fragmentShader = material?.fragmentShader || '';
    if (fragmentShader.includes('float hot = smoothstep(0.40, 0.86')) {
      material.transparent = true;
      material.depthWrite = false;
      material.depthTest = false;
      material.blending = THREE.NoBlending;
      material.needsUpdate = true;
      object.renderOrder = 30;
      coreFound = true;
    } else if (fragmentShader.includes('float fresnel = pow(1.0 - abs(dot')) {
      object.renderOrder = 29;
    }
  });
  if (coreFound) starFlight.__renderOrderNormalized = true;
}
const cameraForward = new THREE.Vector3();\`,
  'Interactive star runtime install',
);

source = replaceOnce(
  source,
  /  pointer\\.currentX = damp\\(pointer\\.currentX, pointer\\.targetX, 2\\.7, dt\\);[\\s\\S]*?  const intro =/,
  \`  const starFlightOwnsCamera = starFlight?.update(now, dt, elapsed) === true;
  normalizeInteractiveStarRenderOrder();
  if (!starFlightOwnsCamera) {
    pointer.currentX = damp(pointer.currentX, pointer.targetX, 2.7, dt);
    pointer.currentY = damp(pointer.currentY, pointer.targetY, 2.7, dt);
    if (!reducedMotion) {
      camera.position.x = pointer.currentX * 0.34;
      camera.position.y = pointer.currentY * 0.20;
      lookTarget.set(pointer.currentX * 1.05, pointer.currentY * 0.62, -12);
      camera.lookAt(lookTarget);
    } else {
      camera.position.set(0, 0, 0);
      camera.lookAt(0, 0, -12);
    }
  }
  const intro =\`,
  'Interactive star camera ownership',
);

source = replaceOnce(
  source,
  /  const interactionBudgetReady = now - continuumCache\\.lastRenderMs >= 30\\.0;/,
  \`  const interactionBudgetReady = starFlight?.needsContinuousRender === true
    || now - continuumCache.lastRenderMs >= 30.0;\`,
  'Interactive star continuum frame budget',
);

source = replaceOnce(
  source,
  /  const shouldRenderScene = frameDirty\\n    \\|\\| introActive/,
  \`  const shouldRenderScene = starFlight?.needsContinuousRender === true
    || frameDirty
    || introActive\`,
  'Interactive star continuous presentation',
);
`;

// The stable loader first injects its performance patch into the deep-nebula
// loader. Put our final-renderer patch after that transform so it targets the
// optimized frame loop without changing any galaxy shader or star distribution.
const stableModuleMarker = "const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));";
const bridgeInjection = `
const homepageGlassCapturePatch = ${JSON.stringify(capturePatch)};
source = replaceOnce(
  source,
  moduleMarker,
  homepageGlassCapturePatch + '\\n\\n' + moduleMarker,
  'Homepage glass and star-flight patch insertion point',
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
