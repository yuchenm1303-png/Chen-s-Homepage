const upstreamUrl = new URL('./astra-deep-nebula-loader.js', import.meta.url);
const response = await fetch(upstreamUrl, { cache: 'no-store' });
if (!response.ok) throw new Error(`Failed to load deep nebula baseline: ${response.status}`);

let source = await response.text();
const directoryUrl = new URL('./', import.meta.url).href;

function replaceOnce(input, search, replacement, label) {
  if (!input.includes(search)) {
    throw new Error(`${label} marker not found; refusing to patch an unknown baseline.`);
  }
  return input.replace(search, replacement);
}

// The upstream loader executes from a Blob below. Keep its layered renderer
// fetch rooted at the real repository directory rather than blob:.
source = replaceOnce(
  source,
  "new URL('./astra-milkyway-layered.js', import.meta.url)",
  `new URL('./astra-milkyway-layered.js', ${JSON.stringify(directoryUrl)})`,
  'Deep nebula source URL',
);

// Freeze the approved C / Split composition. This is byte-for-byte the split
// topology from the comparison build; only the runtime scheduling is optimized.
const baselineMid = `    vec2 midP = rot2(-0.60) * sky;
    midP += vec2((t - 31.0) * -0.0022, (t - 31.0) * 0.0012);
    float midNoise = fbm2(midP * 2.75 + vec2(31.1, 8.4));
    float midWarp = (midNoise - 0.5) * 0.16;
    float midCentre = -0.055 + 0.105 * sin(midP.x * 3.7 - 0.65) + midWarp;
    float midBand = ribbon(midP.y, midCentre, 0.155 + 0.035 * midNoise);
    float midMass = smoothstep(0.37, 0.76, midNoise);
    float midFilament = pow(1.0 - abs(noise2(midP * 7.1 + vec2(17.0, 29.0)) * 2.0 - 1.0), 4.0);
    float midVoid = smoothstep(0.73, 0.91, noise2(midP * 1.75 + vec2(2.0, 37.0)));
    float midWindow = gaussianWeight(t, 31.0, 11.5)
      * gaussianWeight(midP.x, 0.00, 1.12);
    float midDensity = midWindow * midBand
      * (0.18 + midMass * 1.18 + midFilament * 0.38)
      * (1.0 - midVoid * 0.82);`;

const splitMid = `    vec2 midP = rot2(-0.60) * sky;
    midP += vec2((t - 31.0) * -0.0022, (t - 31.0) * 0.0012);
    float midNoise = fbm2(midP * 2.75 + vec2(31.1, 8.4));
    float midWarp = (midNoise - 0.5) * 0.095;
    float splitAmount = 0.035 + smoothstep(-0.32, 0.56, midP.x) * 0.125;
    float trunkCentre = -0.075 + 0.070 * sin(midP.x * 2.8 - 0.50) + midWarp;
    float upperCentre = trunkCentre + splitAmount + 0.028 * sin(midP.x * 5.0 + 1.1);
    float lowerCentre = trunkCentre - splitAmount * 0.78 - 0.022 * sin(midP.x * 4.4 - 0.3);
    float branchWindow = smoothstep(-0.48, -0.10, midP.x);
    float trunk = ribbon(midP.y, trunkCentre, 0.118) * (1.0 - branchWindow * 0.72);
    float upperBranch = ribbon(midP.y, upperCentre, 0.092 + midNoise * 0.018) * branchWindow;
    float lowerBranch = ribbon(midP.y, lowerCentre, 0.088 + midNoise * 0.016) * branchWindow;
    float midCentre = trunkCentre;
    float midBand = max(trunk, max(upperBranch, lowerBranch) * 0.98);
    float midMass = smoothstep(0.35, 0.75, midNoise);
    float midFilament = pow(1.0 - abs(noise2(midP * 7.1 + vec2(17.0, 29.0)) * 2.0 - 1.0), 4.0);
    float valleyCentre = mix(trunkCentre, (upperCentre + lowerCentre) * 0.5, branchWindow);
    float splitValley = ribbon(midP.y, valleyCentre, 0.046)
      * branchWindow * gaussianWeight(midP.x, 0.28, 0.72);
    float midVoid = max(
      smoothstep(0.76, 0.92, noise2(midP * 1.75 + vec2(2.0, 37.0))),
      splitValley * 0.94
    );
    float midWindow = gaussianWeight(t, 31.0, 11.5)
      * gaussianWeight(midP.x, 0.00, 1.14);
    float midDensity = midWindow * midBand
      * (0.17 + midMass * 1.16 + midFilament * 0.36)
      * (1.0 - midVoid * 0.92);`;

source = replaceOnce(source, baselineMid, splitMid, 'C / Split mid-nebula topology');

// Inject a cache into the final renderer after the upstream low-resolution
// continuum pass has been installed. The volumetric shader has no time input,
// so re-running it at 60 Hz while the camera is unchanged is pure duplicate
// work. During interaction it is capped near 33 Hz; stars/twinkle remain at the
// browser frame rate. Intro, resize and projection changes always redraw.
const moduleMarker = "const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));";
const performancePatch = `source = replaceOnce(
  source,
  /updateContinuumCameraUniforms\\(intro\\);\\n  renderer\\.setRenderTarget\\(continuumTarget\\);\\n  renderer\\.clear\\(\\);\\n  renderer\\.render\\(continuumScene, continuumCamera\\);\\n  renderer\\.setRenderTarget\\(null\\);\\n  composer\\.render\\(dt\\);/,
  \`updateContinuumCameraUniforms(intro);
  const continuumCache = continuumField.mesh.userData.continuumCache
    || (continuumField.mesh.userData.continuumCache = {
      valid: false,
      px: 0, py: 0, pz: 0,
      fx: 0, fy: 0, fz: -1,
      intro: -1,
      aspect: -1,
      width: 0,
      height: 0,
      lastRenderMs: -1e9,
    });
  const continuumUniforms = continuumField.material.uniforms;
  const cachedPosition = continuumUniforms.uCameraPosition.value;
  const cachedForward = continuumUniforms.uCameraForward.value;
  const positionDeltaSq =
      (cachedPosition.x - continuumCache.px) * (cachedPosition.x - continuumCache.px)
    + (cachedPosition.y - continuumCache.py) * (cachedPosition.y - continuumCache.py)
    + (cachedPosition.z - continuumCache.pz) * (cachedPosition.z - continuumCache.pz);
  const directionDeltaSq =
      (cachedForward.x - continuumCache.fx) * (cachedForward.x - continuumCache.fx)
    + (cachedForward.y - continuumCache.fy) * (cachedForward.y - continuumCache.fy)
    + (cachedForward.z - continuumCache.fz) * (cachedForward.z - continuumCache.fz);
  const targetChanged = continuumCache.width !== continuumTarget.width
    || continuumCache.height !== continuumTarget.height;
  const projectionChanged = Math.abs(continuumCache.aspect - continuumUniforms.uAspect.value) > 1e-6;
  const revealChanged = Math.abs(continuumCache.intro - intro) > 1e-4;
  const cameraChanged = positionDeltaSq > 1e-6 || directionDeltaSq > 2.5e-8;
  const interactionBudgetReady = now - continuumCache.lastRenderMs >= 30.0;
  const shouldRenderContinuum = !continuumCache.valid
    || targetChanged
    || projectionChanged
    || revealChanged
    || (cameraChanged && interactionBudgetReady);

  if (shouldRenderContinuum) {
    renderer.setRenderTarget(continuumTarget);
    renderer.clear();
    renderer.render(continuumScene, continuumCamera);
    renderer.setRenderTarget(null);
    continuumCache.valid = true;
    continuumCache.px = cachedPosition.x;
    continuumCache.py = cachedPosition.y;
    continuumCache.pz = cachedPosition.z;
    continuumCache.fx = cachedForward.x;
    continuumCache.fy = cachedForward.y;
    continuumCache.fz = cachedForward.z;
    continuumCache.intro = intro;
    continuumCache.aspect = continuumUniforms.uAspect.value;
    continuumCache.width = continuumTarget.width;
    continuumCache.height = continuumTarget.height;
    continuumCache.lastRenderMs = now;
  }
  composer.render(dt);\`,
  'Continuum dirty-cache render scheduling',
);`;

source = replaceOnce(
  source,
  moduleMarker,
  `${performancePatch}\n\n${moduleMarker}`,
  'Performance patch insertion point',
);

const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
try {
  await import(moduleUrl);
} finally {
  URL.revokeObjectURL(moduleUrl);
}
