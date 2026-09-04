const starCanvas = document.getElementById('galaxyCanvas');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!starCanvas) {
  throw new Error('Galaxy canvas is required before the nebula layer can mount.');
}

// Deep Milky Way structure is deliberately isolated from the approved stellar
// renderer. This layer is not a generic fog: it is a clumpy mixture of unresolved
// starlight, warm molecular-cloud mass, and dark dust rifts.
const canvas = document.createElement('canvas');
canvas.id = 'galaxyNebulaCanvas';
canvas.setAttribute('aria-hidden', 'true');
Object.assign(canvas.style, {
  position: 'fixed',
  inset: '0',
  width: '100vw',
  height: '100vh',
  display: 'block',
  pointerEvents: 'none',
  zIndex: '1',
});

starCanvas.style.zIndex = '0';
starCanvas.insertAdjacentElement('afterend', canvas);

const gl = canvas.getContext('webgl2', {
  alpha: true,
  antialias: false,
  depth: false,
  stencil: false,
  powerPreference: 'high-performance',
  premultipliedAlpha: false,
});

if (!gl) throw new Error('WebGL2 is required for the galaxy nebula layer.');

const VERTEX = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 p;
  if (gl_VertexID == 0) p = vec2(-1.0, -1.0);
  else if (gl_VertexID == 1) p = vec2(3.0, -1.0);
  else p = vec2(-1.0, 3.0);
  vUv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}
`;

const FRAGMENT = `#version 300 es
precision highp float;

in vec2 vUv;
uniform vec2 uResolution;
uniform vec2 uCamera;
uniform float uTime;
out vec4 outColor;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.52;
  mat2 octave = mat2(1.73, 1.08, -1.08, 1.73);

  for (int i = 0; i < 5; i++) {
    value += valueNoise(p) * amplitude;
    p = octave * p + vec2(0.19, -0.13);
    amplitude *= 0.49;
  }

  return value;
}

float ridgedFbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.54;
  mat2 octave = mat2(1.61, 1.17, -1.17, 1.61);

  for (int i = 0; i < 5; i++) {
    float n = valueNoise(p);
    float ridge = 1.0 - abs(n * 2.0 - 1.0);
    value += ridge * ridge * amplitude;
    p = octave * p + vec2(-0.23, 0.31);
    amplitude *= 0.50;
  }

  return value;
}

float gaussian(float x, float width) {
  return exp(-pow(x / max(width, 0.0001), 2.0));
}

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);

  // The nebula is deeper than the resolved stars, so its camera parallax is tiny.
  p += vec2(uCamera.x * 0.0046, uCamera.y * 0.0035);

  vec2 axis = normalize(vec2(0.69, 0.724));
  vec2 normal = vec2(-axis.y, axis.x);
  float along = dot(p, axis);
  float across = dot(p, normal);

  // Preserve the authored sweep, but remove the visual impression of a perfect
  // diagonal tube by bending it at two independent spatial frequencies.
  float curve = 0.050 * sin(along * 1.86 + 0.42)
              + 0.015 * sin(along * 4.85 - 0.72);
  across -= curve;

  float drift = uTime * 0.00042;
  vec2 slowDrift = vec2(drift, -drift * 0.37);

  // Low-frequency warp describes the large galactic mass; secondary warp breaks
  // the centerline so the cloud body never reads as a blurred stripe.
  float warpLow = fbm(vec2(along * 0.54, across * 1.08) + vec2(2.9, -3.7) + slowDrift);
  float warpMid = fbm(vec2(along * 1.28, across * 2.25) + vec2(-4.6, 5.2) - slowDrift * 0.45);
  float warpedAcross = across
    + (warpLow - 0.5) * 0.145
    + (warpMid - 0.5) * 0.050;

  float broadBand = gaussian(warpedAcross, 0.445);
  float innerBand = gaussian(warpedAcross, 0.255);
  float coreBand = gaussian(warpedAcross, 0.165);

  // Different scales are multiplied rather than simply summed. Real Milky Way
  // structure is intermittent: large dark voids coexist with dense knots.
  float macroA = fbm(vec2(along * 0.61, warpedAcross * 1.22) + vec2(7.1, 1.8) + slowDrift);
  float macroB = fbm(vec2(along * 0.93, warpedAcross * 1.82) + vec2(-2.4, 9.6) - slowDrift * 0.32);
  float middle = fbm(vec2(along * 2.05, warpedAcross * 4.35) + vec2(-8.8, 3.5));
  float fine = fbm(vec2(along * 5.20, warpedAcross * 10.8) + vec2(4.3, -7.9));
  float ridges = ridgedFbm(vec2(along * 2.85, warpedAcross * 6.4) + vec2(11.2, -5.1));

  float macroMass = clamp(macroA * 0.58 + macroB * 0.42, 0.0, 1.0);
  float brokenMass = smoothstep(0.37, 0.71, macroMass)
    * (0.48 + 0.52 * smoothstep(0.30, 0.73, middle));
  float cloudBody = broadBand * brokenMass;

  // Two offset stellar-cloud shelves prevent a symmetric glowing ribbon. Their
  // visibility changes independently along the galactic axis.
  float shelfAOffset = 0.118 + (macroA - 0.5) * 0.070;
  float shelfBOffset = -0.155 + (macroB - 0.5) * 0.085;
  float shelfA = gaussian(warpedAcross - shelfAOffset, 0.135)
    * smoothstep(0.38, 0.72, middle)
    * broadBand;
  float shelfB = gaussian(warpedAcross - shelfBOffset, 0.165)
    * smoothstep(0.35, 0.69, macroA)
    * broadBand;

  // Filamentary unresolved starlight. It is still low-frequency enough not to
  // compete with the actual point-star renderer above it.
  float filamentLight = innerBand
    * smoothstep(0.40, 0.74, ridges)
    * (0.42 + 0.58 * brokenMass);
  float granularLight = coreBand
    * smoothstep(0.48, 0.77, middle)
    * smoothstep(0.34, 0.70, fine);

  // Wide, meandering dark rift plus secondary fragmented lanes and opaque cloud
  // pockets. These are what make the band read as Galactic dust rather than haze.
  float riftOffset = (middle - 0.5) * 0.095
    + (fine - 0.5) * 0.026
    + sin(along * 2.65 - 0.30) * 0.014;
  float primaryRift = gaussian(warpedAcross + 0.010 + riftOffset, 0.050)
    * (0.58 + 0.42 * smoothstep(0.40, 0.72, macroB));

  float secondaryRiftA = gaussian(
    warpedAcross - 0.095 + (macroA - 0.5) * 0.060,
    0.032
  ) * smoothstep(0.47, 0.74, fine);

  float secondaryRiftB = gaussian(
    warpedAcross + 0.175 + (middle - 0.5) * 0.065,
    0.042
  ) * (1.0 - smoothstep(0.42, 0.69, fine));

  float darkClouds = innerBand
    * smoothstep(0.58, 0.79, fbm(
      vec2(along * 3.55, warpedAcross * 7.6) + vec2(-13.0, 6.1)
    ));

  float dust = clamp(
      primaryRift * 0.88
    + secondaryRiftA * 0.46
    + secondaryRiftB * 0.34
    + darkClouds * 0.40,
    0.0,
    1.0
  );

  // Concentrate warm molecular-cloud colour around the denser middle of the field.
  // Outside it, the Milky Way is mostly neutral grey-brown, as in long-exposure sky.
  float centerWindow = gaussian(along - 0.08, 0.78);
  float warmWindow = centerWindow * (0.50 + 0.50 * smoothstep(0.42, 0.74, middle));
  float warmKnots = cloudBody * warmWindow * smoothstep(0.47, 0.75, ridges);

  // Very small HII-like patches, deliberately sparse and low saturation.
  float hiiWindowA = gaussian(along + 0.42, 0.20);
  float hiiWindowB = gaussian(along - 0.38, 0.24);
  float hii = innerBand
    * smoothstep(0.66, 0.86, fine)
    * max(hiiWindowA, hiiWindowB);

  // Cool scattering is kept secondary; it should never form a large blue cloud.
  float coolScattering = shelfA
    * smoothstep(0.54, 0.80, macroB)
    * (0.20 + 0.80 * (1.0 - centerWindow));

  float neutralMass = cloudBody * (0.55 + 0.45 * filamentLight)
    + shelfB * 0.52;
  float unresolved = filamentLight * 0.70 + granularLight * 0.58;

  vec3 neutralColor = vec3(0.205, 0.185, 0.165);
  vec3 warmColor = vec3(0.315, 0.165, 0.095);
  vec3 coolColor = vec3(0.090, 0.125, 0.165);
  vec3 hiiColor = vec3(0.250, 0.105, 0.095);
  vec3 stellarColor = vec3(0.225, 0.220, 0.205);
  vec3 dustColor = vec3(0.0020, 0.0027, 0.0038);

  float neutralWeight = neutralMass * 0.72;
  float warmWeight = warmKnots * 0.56;
  float coolWeight = coolScattering * 0.20;
  float hiiWeight = hii * 0.16;
  float stellarWeight = unresolved * 0.40;
  float emissionWeight = neutralWeight + warmWeight + coolWeight + hiiWeight + stellarWeight;

  vec3 emissionColor = (
      neutralColor * neutralWeight
    + warmColor * warmWeight
    + coolColor * coolWeight
    + hiiColor * hiiWeight
    + stellarColor * stellarWeight
  ) / max(emissionWeight, 0.0001);

  // Broad haze is intentionally almost absent. Most opacity comes from actual
  // clumps and filaments, giving the eye readable depth instead of coloured fog.
  float emissionAlpha = clamp(
      broadBand * brokenMass * 0.026
    + neutralMass * 0.070
    + warmKnots * 0.060
    + unresolved * 0.052
    + shelfA * 0.026
    + hii * 0.030,
    0.0,
    0.175
  );

  float dustAlpha = dust * (0.095 + coreBand * 0.085);
  float alpha = clamp(emissionAlpha + dustAlpha, 0.0, 0.225);

  float dustMix = dustAlpha / max(alpha, 0.0001);
  vec3 color = mix(emissionColor, dustColor, dustMix);

  // Dark rifts should feel denser than the surrounding emission. This local
  // contrast is much more important to realism than increasing global brightness.
  color *= 0.90 + 0.18 * smoothstep(0.40, 0.76, ridges);
  color *= 1.0 - dust * 0.20;

  // Stable fine photographic grain prevents the procedural clouds from becoming
  // plasticky while remaining visually static frame-to-frame.
  float grain = hash21(gl_FragCoord.xy + 37.17) - 0.5;
  color += grain * 0.0030;

  // Keep black sky around the structure and avoid any rectangular edge signature.
  vec2 edgeUv = abs(vUv - 0.5) * 2.0;
  float edgeFade = 1.0 - smoothstep(0.80, 1.05, max(edgeUv.x, edgeUv.y));
  alpha *= mix(0.80, 1.0, edgeFade);

  if (alpha <= 0.001) discard;
  outColor = vec4(max(color, vec3(0.0)), alpha);
}
`;

function compile(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(log || 'Nebula shader compilation failed');
  }
  return shader;
}

function link(vertexSource, fragmentSource) {
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(log || 'Nebula shader link failed');
  }
  return program;
}

const program = link(VERTEX, FRAGMENT);
const vao = gl.createVertexArray();
const uniforms = {
  resolution: gl.getUniformLocation(program, 'uResolution'),
  camera: gl.getUniformLocation(program, 'uCamera'),
  time: gl.getUniformLocation(program, 'uTime'),
};

const state = {
  width: 1,
  height: 1,
  dpr: 1,
  inputTarget: [0, 0],
  input: [0, 0],
  camera: [0, 0],
  active: false,
  startTime: performance.now(),
  lastFrame: 0,
};

function applyDeadZone(value, deadZone = 0.06) {
  const magnitude = Math.abs(value);
  if (magnitude <= deadZone) return 0;
  const sign = value < 0 ? -1 : 1;
  return sign * (magnitude - deadZone) / (1 - deadZone);
}

function damp(current, target, speed, dt) {
  return current + (target - current) * (1 - Math.exp(-speed * dt));
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.45);
  const width = Math.max(1, Math.round(window.innerWidth * dpr));
  const height = Math.max(1, Math.round(window.innerHeight * dpr));

  if (width === state.width && height === state.height && dpr === state.dpr) {
    return;
  }

  state.dpr = dpr;
  state.width = width;
  state.height = height;
  canvas.width = width;
  canvas.height = height;
}

function onPointerMove(event) {
  const rawX = (event.clientX / Math.max(window.innerWidth, 1)) * 2 - 1;
  const rawY = -((event.clientY / Math.max(window.innerHeight, 1)) * 2 - 1);
  state.inputTarget[0] = applyDeadZone(rawX);
  state.inputTarget[1] = applyDeadZone(rawY);
  state.active = true;
}

function onPointerLeave() {
  state.active = false;
  state.inputTarget[0] = 0;
  state.inputTarget[1] = 0;
}

window.addEventListener('resize', resize, { passive: true });
window.addEventListener('pointermove', onPointerMove, { passive: true });
window.addEventListener('pointerleave', onPointerLeave, { passive: true });
window.addEventListener('blur', onPointerLeave, { passive: true });

resize();
gl.disable(gl.DEPTH_TEST);
gl.disable(gl.BLEND);

function render(now) {
  resize();

  const seconds = (now - state.startTime) / 1000;
  const dt = Math.min(
    0.05,
    Math.max(0.001, state.lastFrame ? (now - state.lastFrame) / 1000 : 0.016)
  );
  state.lastFrame = now;

  if (reducedMotion) {
    state.input[0] = 0;
    state.input[1] = 0;
    state.camera[0] = 0;
    state.camera[1] = 0;
  } else {
    const targetX = state.active ? state.inputTarget[0] : 0;
    const targetY = state.active ? state.inputTarget[1] : 0;

    state.input[0] = damp(state.input[0], targetX, 7.0, dt);
    state.input[1] = damp(state.input[1], targetY, 7.0, dt);
    state.camera[0] = damp(state.camera[0], state.input[0], 3.0, dt);
    state.camera[1] = damp(state.camera[1], state.input[1], 3.0, dt);
  }

  gl.viewport(0, 0, state.width, state.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(program);
  gl.bindVertexArray(vao);
  gl.uniform2f(uniforms.resolution, state.width, state.height);
  gl.uniform2f(uniforms.camera, state.camera[0], state.camera[1]);
  gl.uniform1f(uniforms.time, reducedMotion ? 0 : seconds);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  requestAnimationFrame(render);
}

requestAnimationFrame(render);
