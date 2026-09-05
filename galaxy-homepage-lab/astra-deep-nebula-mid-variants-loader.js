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

// The baseline loader is executed from a Blob below, so keep its layered
// renderer fetch rooted at the real repository directory rather than blob:.
source = replaceOnce(
  source,
  "new URL('./astra-milkyway-layered.js', import.meta.url)",
  `new URL('./astra-milkyway-layered.js', ${JSON.stringify(directoryUrl)})`,
  'Deep nebula source URL',
);

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

const variants = {
  fold: `    vec2 midP = rot2(-0.60) * sky;
    midP += vec2((t - 31.0) * -0.0022, (t - 31.0) * 0.0012);
    float midNoise = fbm2(midP * 2.75 + vec2(31.1, 8.4));
    float midWarp = (midNoise - 0.5) * 0.12;
    float midCentre = -0.035 + 0.082 * sin(midP.x * 3.0 - 0.45) + midWarp;
    float foldCentre = 0.115 - 0.145 * sin(midP.x * 2.15 + 0.82) - midWarp * 0.55;
    float mainSheet = ribbon(midP.y, midCentre, 0.118 + 0.026 * midNoise);
    float crossingWindow = gaussianWeight(midP.x, 0.10, 0.72);
    float crossingSheet = ribbon(midP.y, foldCentre, 0.090 + 0.020 * midNoise) * crossingWindow;
    float bridge = ribbon(midP.y, mix(midCentre, foldCentre, 0.50), 0.060)
      * gaussianWeight(midP.x, 0.08, 0.34);
    float midBand = max(mainSheet, crossingSheet * 0.94) + bridge * 0.36;
    float midMass = smoothstep(0.36, 0.75, midNoise);
    float midFilament = pow(1.0 - abs(noise2(midP * 7.1 + vec2(17.0, 29.0)) * 2.0 - 1.0), 4.0);
    float foldCavity = gaussianWeight(midP.x, 0.18, 0.25)
      * gaussianWeight(midP.y, mix(midCentre, foldCentre, 0.50), 0.075);
    float midVoid = max(
      smoothstep(0.76, 0.92, noise2(midP * 1.75 + vec2(2.0, 37.0))),
      foldCavity * 0.82
    );
    float midWindow = gaussianWeight(t, 31.0, 11.5)
      * gaussianWeight(midP.x, 0.00, 1.12);
    float midDensity = midWindow * midBand
      * (0.17 + midMass * 1.16 + midFilament * 0.34)
      * (1.0 - midVoid * 0.86);`,

  shell: `    vec2 midP = rot2(-0.60) * sky;
    midP += vec2((t - 31.0) * -0.0022, (t - 31.0) * 0.0012);
    float midNoise = fbm2(midP * 2.75 + vec2(31.1, 8.4));
    float midWarp = (midNoise - 0.5) * 0.070;
    vec2 shellP = midP - vec2(0.12, -0.015);
    shellP.y += midWarp;
    float shellRadius = length(vec2(shellP.x / 0.72, shellP.y / 0.34));
    float shell = exp(-pow((shellRadius - 0.72) / 0.16, 2.0));
    float shellBreak = 0.52 + smoothstep(0.34, 0.78, midNoise) * 0.68;
    float tailCentre = -0.20 + 0.085 * sin(midP.x * 3.25 + 0.60) + midWarp;
    float tail = ribbon(midP.y, tailCentre, 0.095)
      * gaussianWeight(midP.x, -0.58, 0.58);
    float crown = ribbon(midP.y, 0.20 + 0.040 * sin(midP.x * 4.2), 0.080)
      * gaussianWeight(midP.x, 0.48, 0.46);
    float midCentre = tailCentre;
    float midBand = shell * shellBreak + tail * 0.68 + crown * 0.42;
    float midMass = smoothstep(0.36, 0.74, midNoise);
    float midFilament = pow(1.0 - abs(noise2(midP * 7.1 + vec2(17.0, 29.0)) * 2.0 - 1.0), 4.0);
    float hollow = 1.0 - smoothstep(0.47, 0.63, shellRadius);
    float midVoid = max(
      smoothstep(0.78, 0.93, noise2(midP * 1.75 + vec2(2.0, 37.0))),
      hollow * gaussianWeight(midP.x, 0.12, 0.60)
    );
    float midWindow = gaussianWeight(t, 31.0, 11.5)
      * gaussianWeight(midP.x, 0.05, 1.16);
    float midDensity = midWindow * midBand
      * (0.16 + midMass * 1.12 + midFilament * 0.40)
      * (1.0 - midVoid * 0.90);`,

  split: `    vec2 midP = rot2(-0.60) * sky;
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
      * (1.0 - midVoid * 0.92);`,
};

const requested = new URLSearchParams(window.location.search).get('mid') || 'fold';
const variant = Object.prototype.hasOwnProperty.call(variants, requested) ? requested : 'fold';
source = replaceOnce(source, baselineMid, variants[variant], `Mid-nebula ${variant}`);

const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
try {
  await import(moduleUrl);
} finally {
  URL.revokeObjectURL(moduleUrl);
}
