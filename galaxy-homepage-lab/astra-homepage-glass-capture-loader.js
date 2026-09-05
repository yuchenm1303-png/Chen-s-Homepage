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
// framebuffer is still valid. The same final-renderer patch installs the single
// interactive-star prototype without changing approved galaxy shaders or star
// distribution. During star flight the hidden glass card is deliberately not
// recaptured, removing a 24 Hz WebGL->2D->WebGL copy from the critical path.
const capturePatch = `
source = replaceOnce(
  source,
  /    composer\\.render\\(dt\\);\\n    lastCompositeMs = now;/,
  \`    composer.render(dt);\n    if (!document.body.classList.contains('star-flight-active')) {\n      try {\n        window.__SMIREL_HOMEPAGE_GLASS_SYNC__?.(now);\n      } catch (error) {\n        console.warn('[homepage-liquid-glass] frame handoff failed', error);\n      }\n    }\n    lastCompositeMs = now;\`,
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
const cameraForward = new THREE.Vector3();\`,
  'Interactive star runtime install',
);

source = replaceOnce(
  source,
  /  pointer\\.currentX = damp\\(pointer\\.currentX, pointer\\.targetX, 2\\.7, dt\\);[\\s\\S]*?  const intro =/,
  \`  const starFlightOwnsCamera = starFlight?.update(now, dt, elapsed) === true;
  if (!starFlightOwnsCamera) {
    // The old home motion was dominated by view rotation: only ~0.34 world units
    // of lateral translation while the look target moved more than 1 unit. With
    // most stars now tens to hundreds of units deep, that collapses near/mid/far
    // layers into nearly the same screen motion. Drive the camera through real
    // space instead: stronger translation, a small forward dolly, and a quieter
    // look target that keeps the galaxy framed while preserving differential
    // parallax between foreground stars, nebula layers and the distant field.
    pointer.currentX = damp(pointer.currentX, pointer.targetX, 2.45, dt);
    pointer.currentY = damp(pointer.currentY, pointer.targetY, 2.45, dt);
    if (!reducedMotion) {
      const pointerEnergy = Math.min(
        1.0,
        Math.sqrt(pointer.currentX * pointer.currentX + pointer.currentY * pointer.currentY),
      );
      camera.position.set(
        pointer.currentX * 0.98,
        pointer.currentY * 0.58,
        -pointerEnergy * 0.46,
      );
      lookTarget.set(
        pointer.currentX * 0.18,
        pointer.currentY * 0.10,
        -14.5,
      );
      camera.lookAt(lookTarget);
    } else {
      camera.position.set(0, 0, 0);
      camera.lookAt(0, 0, -14.5);
    }
  }
  const intro =\`,
  'Spatial home-camera parallax',
);

// During flight, camera position and FOV change every presented frame. The
// continuum must follow that same temporal cadence or it visibly snaps between
// stale camera states. Keep it frame-synchronous, but temporarily lower the
// low-frequency render target to 42% of its normal linear resolution. The
// target returns to full quality as soon as the camera arrives.
source = replaceOnce(
  source,
  /  const targetChanged = continuumCache\\.width !== continuumTarget\\.width\\n    \\|\\| continuumCache\\.height !== continuumTarget\\.height;/,
  \`  const starFlightMoving = document.body.classList.contains('star-flight-active')
    && !document.body.classList.contains('star-flight-arrived');
  const baseContinuumScale = width >= 1100 ? 0.40 : 0.48;
  const flightContinuumScale = baseContinuumScale * (starFlightMoving ? 0.42 : 1.0);
  const desiredContinuumWidth = Math.max(
    256,
    Math.min(960, Math.round(width * pixelRatio * flightContinuumScale)),
  );
  const desiredContinuumHeight = Math.max(
    144,
    Math.min(600, Math.round(height * pixelRatio * flightContinuumScale)),
  );
  if (continuumTarget.width !== desiredContinuumWidth
      || continuumTarget.height !== desiredContinuumHeight) {
    continuumTarget.setSize(desiredContinuumWidth, desiredContinuumHeight);
    continuumCache.valid = false;
  }
  const targetChanged = continuumCache.width !== continuumTarget.width
    || continuumCache.height !== continuumTarget.height;\`,
  'Interactive star flight continuum LOD',
);

// FOV changes are projection changes too. Track tanHalfFov in the cache so the
// continuum cannot retain a texture rendered with the previous flight FOV.
source = replaceOnce(
  source,
  /  const projectionChanged = Math\\.abs\\(continuumCache\\.aspect - continuumUniforms\\.uAspect\\.value\\) > 1e-6;/,
  \`  const continuumTanHalfFov = continuumUniforms.uTanHalfFov.value;
  const cachedTanHalfFov = Number.isFinite(continuumCache.tanHalfFov)
    ? continuumCache.tanHalfFov
    : -1;
  const projectionChanged = Math.abs(continuumCache.aspect - continuumUniforms.uAspect.value) > 1e-6
    || Math.abs(cachedTanHalfFov - continuumTanHalfFov) > 1e-6;\`,
  'Interactive star FOV cache invalidation',
);
source = replaceOnce(
  source,
  /    continuumCache\\.aspect = continuumUniforms\\.uAspect\\.value;\\n    continuumCache\\.width =/,
  \`    continuumCache.aspect = continuumUniforms.uAspect.value;
    continuumCache.tanHalfFov = continuumUniforms.uTanHalfFov.value;
    continuumCache.width =\`,
  'Interactive star FOV cache state',
);

// Moving flight frames update the reduced continuum every rendered camera frame.
// Idle and arrived states keep the refined runtime's lower-frequency budgets.
source = replaceOnce(
  source,
  /  const interactionBudgetReady = now - continuumCache\\.lastRenderMs >= 30\\.0;/,
  \`  const continuumIntervalMs = starFlightMoving
    ? 0.0
    : (starFlight?.continuumIntervalMs ?? 30.0);
  const interactionBudgetReady = now - continuumCache.lastRenderMs >= continuumIntervalMs;\`,
  'Interactive star continuum frame budget',
);

// Flight and return still present every browser frame. Once the camera has
// arrived, the star surface is capped by the runtime presentation budget so the
// composer+bloom pipeline does not run unnecessarily at display refresh rate.
source = replaceOnce(
  source,
  /  const shouldRenderScene = frameDirty\\n    \\|\\| introActive/,
  \`  const starFlightFrameDue = starFlight?.shouldRenderFrame?.(now, lastCompositeMs) === true;
  const shouldRenderScene = starFlightFrameDue
    || frameDirty
    || introActive\`,
  'Interactive star presentation budget',
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
