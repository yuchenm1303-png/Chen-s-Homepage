const starCanvas = document.getElementById('galaxyCanvas');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!starCanvas) {
  throw new Error('Galaxy canvas is required before the nebula layer can mount.');
}

// This layer supplies only the unresolved Milky Way body: broad stellar haze,
// mottled warm dust and dark absorption clouds. The approved point-star renderer
// remains untouched and keeps ownership of resolved stars / bloom / interaction.
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
  float amplitude = 0.53;
  mat2 octave = mat2(1.71, 1.09, -1.09, 1.71);

  for (int i = 0; i < 6; i++) {
    value += valueNoise(p) * amplitude;
    p = octave * p + vec2(0.17, -0.21);
    amplitude *= 0.48;
  }

  return value;
}

float ridgedFbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.54;
  mat2 octave = mat2(1.63, 1.14, -1.14, 1.63);

  for (int i = 0; i < 5; i++) {
    float n = valueNoise(p);
    float ridge = 1.0 - abs(n * 2.0 - 1.0);
    value += ridge * ridge * amplitude;
    p = octave * p + vec2(-0.27, 0.23);
    amplitude *= 0.49;
  }

  return value;
}

float gaussian(float x, float width) {
  return exp(-pow(x / max(width, 0.0001), 2.0));
}

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);

  // The unresolved cloud body lives farther away than the resolved star field.
  // Its parallax is intentionally tiny and contains no cursor-local deformation.
  p += vec2(uCamera.x * 0.0038, uCamera.y * 0.0028);

  vec2 axis = normalize(vec2(0.69, 0.724));
  vec2 normal = vec2(-axis.y, axis.x);
  float along = dot(p, axis);
  float across = dot(p, normal);

  // Keep the existing authored sweep, but let the Milky Way body wander instead
  // of reading as one mathematically straight diagonal ribbon.
  float curve = 0.046 * sin(along * 1.72 + 0.52)
              + 0.014 * sin(along * 4.35 - 0.74);
  across -= curve;

  // Effectively static on human timescales; enough to avoid a frozen shader feel.
  float drift = uTime * 0.00010;
  vec2 slowDrift = vec2(drift, -drift * 0.31);

  float warpLarge = fbm(vec2(along * 0.48, across * 0.92) + vec2(3.7, -2.8) + slowDrift);
  float warpMiddle = fbm(vec2(along * 1.18, across * 2.05) + vec2(-5.8, 6.6) - slowDrift * 0.4);
  float warpedAcross = across
    + (warpLarge - 0.5) * 0.155
    + (warpMiddle - 0.5) * 0.055;

  // The reference is not a uniformly bright band. It is a broad, irregular
  // concentration of unresolved light with several overlapping cloud complexes.
  float lobe0 = gaussian(along + 0.70, 0.50) * gaussian(warpedAcross + 0.015, 0.30);
  float lobe1 = gaussian(along + 0.18, 0.62) * gaussian(warpedAcross - 0.010, 0.34);
  float lobe2 = gaussian(along - 0.38, 0.56) * gaussian(warpedAcross + 0.025, 0.31);
  float lobe3 = gaussian(along - 0.88, 0.46) * gaussian(warpedAcross - 0.035, 0.27);
  float diffuseSpine = gaussian(warpedAcross, 0.47) * 0.22;
  float envelope = clamp(
    max(max(lobe0 * 0.62, lobe1), max(lobe2 * 0.78, lobe3 * 0.48))
      + diffuseSpine,
    0.0,
    1.0
  );

  float macroA = fbm(vec2(along * 0.70, warpedAcross * 1.28) + vec2(8.1, 1.3));
  float macroB = fbm(vec2(along * 1.03, warpedAcross * 1.74) + vec2(-3.0, 9.2));
  float middle = fbm(vec2(along * 2.25, warpedAcross * 4.15) + vec2(-9.4, 3.1));
  float fine = fbm(vec2(along * 5.45, warpedAcross * 9.8) + vec2(4.6, -8.4));
  float ridges = ridgedFbm(vec2(along * 2.70, warpedAcross * 6.1) + vec2(11.7, -5.3));

  // Multiplicative cloud density makes large patches, holes and filament clusters
  // rather than a soft coloured wash.
  float macroMass = smoothstep(0.34, 0.70, macroA * 0.56 + macroB * 0.44);
  float middleMass = 0.30 + 0.70 * smoothstep(0.30, 0.72, middle);
  float clumpMass = envelope * macroMass * middleMass;

  // Raise the unresolved stellar body without changing its silhouette. The added
  // energy stays inside actual cloud complexes instead of becoming a global veil.
  float stellarCloud = clumpMass
    * (0.57 + 0.63 * smoothstep(0.33, 0.70, ridges));
  float granularCloud = envelope
    * smoothstep(0.37, 0.73, middle)
    * smoothstep(0.29, 0.68, fine);

  float bulge = gaussian(along + 0.02, 0.58)
    * gaussian(warpedAcross - (macroB - 0.5) * 0.045, 0.31)
    * (0.56 + 0.60 * macroMass);

  // Real photographs show broad irregular absorption patches, not just razor-thin
  // lanes. The main rift meanders through the luminous body and partially breaks.
  float riftOffset = (middle - 0.5) * 0.115
    + (fine - 0.5) * 0.035
    + sin(along * 2.30 - 0.20) * 0.017;
  float mainRift = gaussian(warpedAcross + 0.020 + riftOffset, 0.068)
    * (0.40 + 0.60 * smoothstep(0.36, 0.69, macroB));

  float branchRiftA = gaussian(
    warpedAcross - 0.130 + (macroA - 0.5) * 0.075,
    0.046
  ) * smoothstep(0.45, 0.73, fine);

  float branchRiftB = gaussian(
    warpedAcross + 0.185 + (middle - 0.5) * 0.080,
    0.055
  ) * (1.0 - smoothstep(0.43, 0.70, fine));

  float pocketNoise = fbm(vec2(along * 3.35, warpedAcross * 7.25) + vec2(-12.6, 5.4));
  float darkPockets = envelope * smoothstep(0.55, 0.76, pocketNoise);

  float dust = clamp(
      mainRift * 0.82
    + branchRiftA * 0.38
    + branchRiftB * 0.30
    + darkPockets * 0.58,
    0.0,
    1.0
  );

  float warmWindow = gaussian(along + 0.03, 0.68)
    * (0.52 + 0.48 * smoothstep(0.38, 0.73, macroA));
  float warmDust = stellarCloud * warmWindow;
  float neutralDust = clumpMass * (0.54 + 0.46 * (1.0 - warmWindow));
  float stellarHaze = clamp(granularCloud * 0.82 + bulge * 0.62, 0.0, 1.0);

  // Localised cool scattering gives the field richer depth without creating a
  // synthetic blue fog bank. It lives mainly in outer stellar-cloud knots.
  float coolCloud = envelope
    * smoothstep(0.55, 0.80, macroB)
    * smoothstep(0.40, 0.74, ridges)
    * (0.28 + 0.72 * (1.0 - warmWindow));

  // Small HII-like knots provide restrained magenta/red complexity in the dense
  // body while still occupying only a tiny part of the whole field.
  float hiiA = gaussian(along + 0.43, 0.17)
    * gaussian(warpedAcross - 0.055, 0.115);
  float hiiB = gaussian(along - 0.36, 0.19)
    * gaussian(warpedAcross + 0.070, 0.125);
  float hii = max(hiiA, hiiB) * smoothstep(0.53, 0.78, fine) * envelope;

  // Richer photographic palette: warm amber/brown dominates, cool blue stays
  // local, and HII colour is present but never turns the whole galaxy pink.
  vec3 neutralColor = vec3(0.300, 0.260, 0.205);
  vec3 warmColor = vec3(0.485, 0.255, 0.125);
  vec3 stellarColor = vec3(0.345, 0.330, 0.285);
  vec3 coolColor = vec3(0.115, 0.170, 0.275);
  vec3 hiiColor = vec3(0.430, 0.155, 0.150);
  vec3 dustColor = vec3(0.0030, 0.0034, 0.0033);

  float neutralWeight = neutralDust * 0.88;
  float warmWeight = warmDust * 0.96;
  float stellarWeight = stellarHaze * 0.66;
  float coolWeight = coolCloud * 0.30;
  float hiiWeight = hii * 0.24;
  float totalWeight = neutralWeight + warmWeight + stellarWeight + coolWeight + hiiWeight;

  vec3 emissionColor = (
      neutralColor * neutralWeight
    + warmColor * warmWeight
    + stellarColor * stellarWeight
    + coolColor * coolWeight
    + hiiColor * hiiWeight
  ) / max(totalWeight, 0.0001);

  // Roughly one stop more visible than the previous pass, but the added opacity is
  // still structure-driven so the Milky Way keeps black gaps and dark rifts.
  float emissionAlpha = clamp(
      envelope * macroMass * 0.030
    + clumpMass * 0.145
    + stellarCloud * 0.135
    + granularCloud * 0.078
    + bulge * 0.095
    + coolCloud * 0.045
    + hii * 0.060
    + diffuseSpine * macroMass * 0.026,
    0.0,
    0.345
  );

  float dustAlpha = dust * (0.105 + envelope * 0.115);
  float alpha = clamp(emissionAlpha + dustAlpha, 0.0, 0.365);

  float dustMix = dustAlpha / max(alpha, 0.0001);
  vec3 color = mix(emissionColor, dustColor, dustMix);

  // Preserve dust contrast while adding a modest photographic colour/luminance
  // lift only where real nebular emission exists.
  float textureContrast = smoothstep(0.40, 0.76, ridges) * clumpMass;
  color *= 0.96 + textureContrast * 0.22;
  color *= 1.0 - dust * 0.19;

  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  float colorLift = smoothstep(0.045, 0.24, emissionAlpha);
  color = mix(vec3(luma), color, 1.0 + colorLift * 0.24);
  color *= 1.0 + colorLift * 0.16;

  float grain = hash21(gl_FragCoord.xy + 41.37) - 0.5;
  color += vec3(grain * 0.0026);

  vec2 edgeUv = abs(vUv - 0.5) * 2.0;
  float edgeFade = 1.0 - smoothstep(0.79, 1.05, max(edgeUv.x, edgeUv.y));
  alpha *= mix(0.78, 1.0, edgeFade);

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