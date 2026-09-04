const starCanvas = document.getElementById('galaxyCanvas');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!starCanvas) {
  throw new Error('Galaxy canvas is required before the nebula layer can mount.');
}

// Photographic Milky Way structure layer. Resolved stars remain in the approved
// stellar renderer; this canvas contributes unresolved starlight, dust and dark rifts.
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

vec2 hash22(vec2 p) {
  float n = sin(dot(p, vec2(41.0, 289.0)));
  return fract(vec2(262144.0, 32768.0) * n);
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

float microStarLayer(vec2 p, float scale, float threshold) {
  vec2 cellCoord = p * scale;
  vec2 cell = floor(cellCoord);
  vec2 local = fract(cellCoord) - 0.5;
  vec2 jitter = (hash22(cell + 7.31) - 0.5) * 0.72;
  float d = length(local - jitter);
  float seed = hash21(cell + 31.77);
  float gate = smoothstep(threshold, 1.0, seed);
  return smoothstep(0.060, 0.0, d) * gate;
}

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);

  // The nebula sits behind the resolved stars, so pointer parallax stays tiny.
  p += vec2(uCamera.x * 0.0035, uCamera.y * 0.0026);

  vec2 axis = normalize(vec2(0.69, 0.724));
  vec2 normal = vec2(-axis.y, axis.x);
  float along = dot(p, axis);
  float across = dot(p, normal);

  // The Milky Way does not read as a perfect diagonal tube in photographs.
  // A slow structural bend plus low-frequency warp gives it a natural sweep.
  float curve = 0.045 * sin(along * 1.66 + 0.50)
              + 0.013 * sin(along * 4.10 - 0.66);
  across -= curve;

  float drift = uTime * 0.000075;
  vec2 slowDrift = vec2(drift, -drift * 0.29);

  float warpLarge = fbm(
    vec2(along * 0.50, across * 0.94) + vec2(3.8, -2.6) + slowDrift
  );
  float warpMiddle = fbm(
    vec2(along * 1.22, across * 2.10) + vec2(-5.6, 6.8) - slowDrift * 0.35
  );

  float warpedAcross = across
    + (warpLarge - 0.5) * 0.150
    + (warpMiddle - 0.5) * 0.052;

  // A broad unresolved body with one stronger galactic-centre complex and several
  // weaker shelves. This is intentionally asymmetric, like the reference photos.
  float spine = gaussian(warpedAcross, 0.46);
  float innerSpine = gaussian(warpedAcross, 0.265);

  float outerLeft = gaussian(along + 0.82, 0.55)
    * gaussian(warpedAcross + 0.025, 0.31);
  float coreComplex = gaussian(along + 0.10, 0.53)
    * gaussian(warpedAcross - 0.015, 0.29);
  float outerRight = gaussian(along - 0.62, 0.58)
    * gaussian(warpedAcross + 0.035, 0.32);
  float farShoulder = gaussian(along - 1.02, 0.46)
    * gaussian(warpedAcross - 0.045, 0.25);

  float envelope = clamp(
      spine * 0.18
    + outerLeft * 0.42
    + coreComplex * 0.92
    + outerRight * 0.54
    + farShoulder * 0.30,
    0.0,
    1.0
  );

  float macroA = fbm(
    vec2(along * 0.72, warpedAcross * 1.30) + vec2(8.0, 1.4)
  );
  float macroB = fbm(
    vec2(along * 1.02, warpedAcross * 1.78) + vec2(-3.2, 9.1)
  );
  float middle = fbm(
    vec2(along * 2.30, warpedAcross * 4.25) + vec2(-9.2, 3.0)
  );
  float fine = fbm(
    vec2(along * 5.40, warpedAcross * 10.2) + vec2(4.7, -8.1)
  );
  float ridges = ridgedFbm(
    vec2(along * 2.82, warpedAcross * 6.25) + vec2(11.6, -5.2)
  );

  // Large-scale mass is broken up before colour is applied. That keeps the body
  // granular and cloud-like instead of becoming a smooth coloured fog.
  float macroMass = smoothstep(0.33, 0.69, macroA * 0.56 + macroB * 0.44);
  float midMass = 0.25 + 0.75 * smoothstep(0.29, 0.70, middle);
  float clumpMass = envelope * macroMass * midMass;

  float filamentMass = envelope
    * smoothstep(0.38, 0.73, ridges)
    * (0.36 + 0.64 * macroMass);

  float granularMass = innerSpine
    * smoothstep(0.39, 0.72, middle)
    * smoothstep(0.31, 0.68, fine)
    * (0.36 + 0.64 * envelope);

  // Dense unresolved light around the galactic centre. The modulation is important:
  // the real core is bright but mottled by dust, never a clean glowing ellipse.
  float coreMottle = 0.42
    + 0.34 * smoothstep(0.34, 0.72, ridges)
    + 0.24 * smoothstep(0.36, 0.71, middle);

  float coreLight = coreComplex
    * (0.42 + 0.58 * macroMass)
    * coreMottle;

  float stellarCloud = clumpMass
    * (0.50 + 0.50 * smoothstep(0.34, 0.71, ridges));

  // A broad dark rift plus branched lanes and cloud pockets. These are allowed to
  // cross the bright centre so the layer reads as Milky Way dust, not a nebula blob.
  float riftOffset = (middle - 0.5) * 0.120
    + (fine - 0.5) * 0.038
    + sin(along * 2.25 - 0.20) * 0.018;

  float mainRift = gaussian(warpedAcross + 0.018 + riftOffset, 0.072)
    * (0.40 + 0.60 * smoothstep(0.35, 0.69, macroB));

  float branchA = gaussian(
    warpedAcross - 0.125 + (macroA - 0.5) * 0.082,
    0.048
  ) * smoothstep(0.43, 0.73, fine);

  float branchB = gaussian(
    warpedAcross + 0.180 + (middle - 0.5) * 0.082,
    0.056
  ) * (1.0 - smoothstep(0.42, 0.69, fine));

  float pocketNoise = fbm(
    vec2(along * 3.40, warpedAcross * 7.45) + vec2(-12.7, 5.3)
  );
  float pocketNoise2 = fbm(
    vec2(along * 4.30, warpedAcross * 8.60) + vec2(6.4, 12.2)
  );

  float darkPockets = envelope
    * clamp(
        smoothstep(0.54, 0.76, pocketNoise) * 0.62
      + smoothstep(0.61, 0.80, pocketNoise2) * 0.42,
      0.0,
      1.0
    );

  float dust = clamp(
      mainRift * 0.88
    + branchA * 0.44
    + branchB * 0.34
    + darkPockets * 0.64,
    0.0,
    1.0
  );

  // Photographic colour hierarchy: pale warm-white core, rose/brown dust, faint
  // blue-violet scattering in outer star clouds. Saturation stays moderate.
  float warmWindow = gaussian(along + 0.08, 0.66)
    * (0.48 + 0.52 * smoothstep(0.36, 0.72, macroA));

  float warmDust = stellarCloud * warmWindow;
  float neutralDust = clumpMass * (0.58 + 0.42 * (1.0 - warmWindow));

  float coolWindow = (1.0 - gaussian(along + 0.05, 0.70))
    * smoothstep(0.52, 0.79, macroB);
  float coolScattering = envelope
    * coolWindow
    * smoothstep(0.40, 0.74, ridges);

  float roseCloud = envelope
    * gaussian(along + 0.12, 0.72)
    * smoothstep(0.52, 0.78, fine)
    * smoothstep(0.42, 0.72, middle);

  // Very small HII-like patches: visible as texture, never as large pink clouds.
  float hiiA = gaussian(along + 0.46, 0.14)
    * gaussian(warpedAcross - 0.060, 0.100);
  float hiiB = gaussian(along - 0.34, 0.17)
    * gaussian(warpedAcross + 0.072, 0.110);
  float hii = max(hiiA, hiiB)
    * smoothstep(0.56, 0.80, fine)
    * envelope;

  vec3 neutralColor = vec3(0.365, 0.350, 0.335);
  vec3 coreColor = vec3(0.640, 0.545, 0.445);
  vec3 warmColor = vec3(0.455, 0.285, 0.215);
  vec3 roseColor = vec3(0.315, 0.205, 0.235);
  vec3 coolColor = vec3(0.175, 0.225, 0.315);
  vec3 hiiColor = vec3(0.390, 0.175, 0.190);
  vec3 dustColor = vec3(0.0022, 0.0027, 0.0033);

  float neutralWeight = neutralDust * 0.80;
  float coreWeight = coreLight * 0.74;
  float warmWeight = warmDust * 0.70;
  float roseWeight = roseCloud * 0.22;
  float coolWeight = coolScattering * 0.24;
  float hiiWeight = hii * 0.18;

  float totalWeight = neutralWeight
    + coreWeight
    + warmWeight
    + roseWeight
    + coolWeight
    + hiiWeight;

  vec3 emissionColor = (
      neutralColor * neutralWeight
    + coreColor * coreWeight
    + warmColor * warmWeight
    + roseColor * roseWeight
    + coolColor * coolWeight
    + hiiColor * hiiWeight
  ) / max(totalWeight, 0.0001);

  // The core should be clearly present, while the outer Milky Way remains dimmer.
  // Opacity is driven by structure rather than a uniform band.
  float emissionAlpha = clamp(
      clumpMass * 0.105
    + filamentMass * 0.075
    + granularMass * 0.060
    + stellarCloud * 0.070
    + coreLight * 0.155
    + coolScattering * 0.035
    + roseCloud * 0.042
    + hii * 0.040
    + spine * macroMass * 0.014,
    0.0,
    0.315
  );

  float dustAlpha = dust * (0.115 + envelope * 0.120);
  float alpha = clamp(emissionAlpha + dustAlpha, 0.0, 0.345);

  float dustMix = dustAlpha / max(alpha, 0.0001);
  vec3 color = mix(emissionColor, dustColor, dustMix);

  // Fine unresolved star texture only inside the galactic body. These tiny points
  // bridge the visual gap between the smooth cloud layer and the resolved star field.
  float embeddedMask = clamp(
    envelope * (0.35 + 0.65 * macroMass) * (1.0 - dust * 0.78),
    0.0,
    1.0
  );
  float microA = microStarLayer(p + vec2(1.7, -2.2), 145.0, 0.986);
  float microB = microStarLayer(p + vec2(-3.1, 1.4), 235.0, 0.994);
  float microStars = (microA * 0.70 + microB * 0.55) * embeddedMask;

  vec3 microColor = mix(
    vec3(0.62, 0.70, 0.82),
    vec3(0.95, 0.82, 0.66),
    hash21(floor(p * 137.0) + 5.3)
  );

  color += microColor * microStars * 0.22;
  alpha = clamp(alpha + microStars * 0.10, 0.0, 0.36);

  // Local contrast reveals dark knots and mottled star clouds without pushing the
  // whole layer toward an HDR / overprocessed look.
  float textureContrast = smoothstep(0.38, 0.76, ridges) * clumpMass;
  color *= 0.94 + textureContrast * 0.23;
  color *= 1.0 - dust * 0.21;

  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  float colorLift = smoothstep(0.06, 0.28, emissionAlpha);
  color = mix(vec3(luma), color, 1.0 + colorLift * 0.12);
  color *= 1.0 + colorLift * 0.08;

  float grain = hash21(gl_FragCoord.xy + 41.37) - 0.5;
  color += vec3(grain * 0.0022);

  vec2 edgeUv = abs(vUv - 0.5) * 2.0;
  float edgeFade = 1.0 - smoothstep(0.79, 1.05, max(edgeUv.x, edgeUv.y));
  alpha *= mix(0.76, 1.0, edgeFade);

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
