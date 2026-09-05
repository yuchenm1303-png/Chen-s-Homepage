const starCanvas = document.getElementById('galaxyCanvas');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!starCanvas) {
  throw new Error('Galaxy canvas is required before the nebula layer can mount.');
}

// Photographic Milky Way structure layer. Keep the approved point-star renderer
// untouched; this canvas contributes only unresolved starlight and dust structure.
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
  return smoothstep(0.052, 0.0, d) * gate;
}

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);

  // The cloud layer is farther away than the resolved stars, so it barely follows
  // the observer. It should feel fixed in deep space, not like smoke under a cursor.
  p += vec2(uCamera.x * 0.0028, uCamera.y * 0.0020);

  vec2 axis = normalize(vec2(0.69, 0.724));
  vec2 normal = vec2(-axis.y, axis.x);
  float along = dot(p, axis);
  float across = dot(p, normal);

  float curve = 0.040 * sin(along * 1.60 + 0.50)
              + 0.011 * sin(along * 4.05 - 0.64);
  across -= curve;

  // Milky Way structure is effectively static on this time scale.
  float drift = uTime * 0.000035;
  vec2 slowDrift = vec2(drift, -drift * 0.27);

  float warpLarge = fbm(
    vec2(along * 0.54, across * 1.02) + vec2(3.7, -2.7) + slowDrift
  );
  float warpMiddle = fbm(
    vec2(along * 1.30, across * 2.30) + vec2(-5.5, 6.7) - slowDrift * 0.35
  );

  float warpedAcross = across
    + (warpLarge - 0.5) * 0.112
    + (warpMiddle - 0.5) * 0.042;

  // Keep the structure physically narrow. On portrait screens a slight width
  // reduction prevents the cloud body from swallowing the entire viewport.
  float widthScale = mix(0.82, 1.0, smoothstep(0.78, 1.08, aspect));
  float outerBand = gaussian(warpedAcross, 0.285 * widthScale);
  float innerBand = gaussian(warpedAcross, 0.165 * widthScale);
  float coreBand = gaussian(warpedAcross, 0.085 * widthScale);

  float leftWindow = gaussian(along + 0.78, 0.62);
  float centreWindow = gaussian(along + 0.08, 0.48);
  float rightWindow = gaussian(along - 0.62, 0.64);
  float farWindow = gaussian(along - 1.04, 0.46);

  // One strong centre plus dimmer shoulders. Real Milky Way photos have enormous
  // dynamic range along the plane; they are not a uniformly bright coloured strip.
  float longitudinal = clamp(
      leftWindow * 0.34
    + centreWindow * 0.94
    + rightWindow * 0.44
    + farWindow * 0.22,
    0.0,
    1.0
  );

  float macroA = fbm(
    vec2(along * 0.76, warpedAcross * 1.45) + vec2(7.8, 1.2)
  );
  float macroB = fbm(
    vec2(along * 1.10, warpedAcross * 1.95) + vec2(-3.3, 9.0)
  );
  float middle = fbm(
    vec2(along * 2.55, warpedAcross * 4.70) + vec2(-9.0, 2.9)
  );
  float fine = fbm(
    vec2(along * 5.90, warpedAcross * 11.5) + vec2(4.8, -8.0)
  );
  float ridges = ridgedFbm(
    vec2(along * 3.10, warpedAcross * 7.20) + vec2(11.4, -5.0)
  );

  float macroMix = macroA * 0.58 + macroB * 0.42;
  float macroMass = smoothstep(0.42, 0.70, macroMix);
  float midMass = smoothstep(0.37, 0.72, middle);

  // Cloud complexes are intermittent. Multiplication creates real holes and gaps
  // instead of the previous broad beige veil.
  float cloudMass = outerBand
    * longitudinal
    * macroMass
    * (0.30 + 0.70 * midMass);

  float stellarLane = innerBand
    * longitudinal
    * (0.18 + 0.82 * macroMass)
    * (0.42 + 0.58 * smoothstep(0.36, 0.72, ridges));

  float filament = innerBand
    * longitudinal
    * smoothstep(0.47, 0.76, ridges)
    * smoothstep(0.38, 0.72, middle);

  float granular = innerBand
    * longitudinal
    * smoothstep(0.48, 0.76, middle)
    * smoothstep(0.42, 0.72, fine);

  // The galactic centre is bright but still broken by dust and mottling.
  float coreMottle = 0.30
    + 0.42 * smoothstep(0.38, 0.72, ridges)
    + 0.28 * smoothstep(0.42, 0.73, middle);
  float coreLight = coreBand
    * centreWindow
    * (0.30 + 0.70 * macroMass)
    * coreMottle;

  // Broad irregular dark rift. This crosses the bright centre and is essential to
  // the photographic Milky Way silhouette.
  float riftOffset = (middle - 0.5) * 0.090
    + (fine - 0.5) * 0.030
    + sin(along * 2.20 - 0.18) * 0.014;

  float mainRift = gaussian(warpedAcross + 0.012 + riftOffset, 0.052 * widthScale)
    * (0.40 + 0.60 * smoothstep(0.40, 0.70, macroB));

  float branchA = gaussian(
    warpedAcross - 0.094 + (macroA - 0.5) * 0.060,
    0.034 * widthScale
  ) * smoothstep(0.50, 0.76, fine);

  float branchB = gaussian(
    warpedAcross + 0.128 + (middle - 0.5) * 0.065,
    0.040 * widthScale
  ) * (1.0 - smoothstep(0.45, 0.70, fine));

  float pocketA = fbm(
    vec2(along * 3.80, warpedAcross * 8.6) + vec2(-12.4, 5.2)
  );
  float pocketB = fbm(
    vec2(along * 4.70, warpedAcross * 10.2) + vec2(6.6, 12.0)
  );
  float darkPockets = innerBand
    * longitudinal
    * clamp(
        smoothstep(0.61, 0.78, pocketA) * 0.62
      + smoothstep(0.65, 0.81, pocketB) * 0.42,
      0.0,
      1.0
    );

  float dust = clamp(
      mainRift * 0.90
    + branchA * 0.42
    + branchB * 0.32
    + darkPockets * 0.72,
    0.0,
    1.0
  );

  // Colour hierarchy from real night-sky references: neutral grey-brown dominates,
  // the centre is warm cream, and blue-violet / rose exist only in small pockets.
  float warmMask = centreWindow
    * (0.38 + 0.62 * smoothstep(0.43, 0.72, macroA));
  float roseMask = innerBand
    * longitudinal
    * smoothstep(0.60, 0.79, fine)
    * smoothstep(0.50, 0.75, middle);
  float coolMask = outerBand
    * (1.0 - centreWindow)
    * smoothstep(0.58, 0.80, macroB)
    * smoothstep(0.45, 0.75, ridges);

  vec3 neutralColor = vec3(0.175, 0.165, 0.158);
  vec3 warmColor = vec3(0.330, 0.235, 0.175);
  vec3 coreColor = vec3(0.455, 0.385, 0.300);
  vec3 roseColor = vec3(0.220, 0.145, 0.165);
  vec3 coolColor = vec3(0.115, 0.145, 0.205);
  vec3 dustColor = vec3(0.0018, 0.0022, 0.0028);

  float neutralWeight = cloudMass * 0.72 + stellarLane * 0.30;
  float warmWeight = stellarLane * warmMask * 0.46;
  float coreWeight = coreLight * 0.72;
  float roseWeight = roseMask * 0.10;
  float coolWeight = coolMask * 0.12;
  float totalWeight = neutralWeight + warmWeight + coreWeight + roseWeight + coolWeight;

  vec3 emissionColor = (
      neutralColor * neutralWeight
    + warmColor * warmWeight
    + coreColor * coreWeight
    + roseColor * roseWeight
    + coolColor * coolWeight
  ) / max(totalWeight, 0.0001);

  // Opacity is intentionally low. The real Milky Way is mostly unresolved light
  // and texture, not an opaque cloud sitting on top of the stars.
  float emissionAlpha = clamp(
      cloudMass * 0.040
    + stellarLane * 0.054
    + filament * 0.034
    + granular * 0.022
    + coreLight * 0.105
    + roseMask * 0.012
    + coolMask * 0.010
    + outerBand * longitudinal * macroMass * 0.006,
    0.0,
    0.175
  );

  float dustAlpha = dust * (0.065 + innerBand * 0.060);
  float alpha = clamp(emissionAlpha + dustAlpha, 0.0, 0.205);

  float dustMix = dustAlpha / max(alpha, 0.0001);
  vec3 color = mix(emissionColor, dustColor, dustMix);

  // Very sparse embedded points help the cloudy body resolve into stellar texture,
  // but the dedicated star renderer remains the dominant source of point stars.
  float embeddedMask = clamp(
    innerBand * longitudinal * (0.20 + 0.80 * macroMass) * (1.0 - dust * 0.88),
    0.0,
    1.0
  );
  float microA = microStarLayer(p + vec2(1.7, -2.2), 165.0, 0.991);
  float microB = microStarLayer(p + vec2(-3.1, 1.4), 255.0, 0.996);
  float microStars = (microA * 0.48 + microB * 0.34) * embeddedMask;
  color += vec3(0.72, 0.73, 0.70) * microStars * 0.12;
  alpha = clamp(alpha + microStars * 0.045, 0.0, 0.21);

  // Increase local contrast, not global brightness. Dark gaps stay genuinely dark.
  float textureContrast = smoothstep(0.46, 0.76, ridges) * cloudMass;
  color *= 0.88 + textureContrast * 0.28;
  color *= 1.0 - dust * 0.28;

  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  float saturationMask = smoothstep(0.035, 0.14, emissionAlpha);
  color = mix(vec3(luma), color, 1.0 + saturationMask * 0.08);

  float grain = hash21(gl_FragCoord.xy + 41.37) - 0.5;
  color += vec3(grain * 0.0015);

  vec2 edgeUv = abs(vUv - 0.5) * 2.0;
  float edgeFade = 1.0 - smoothstep(0.80, 1.05, max(edgeUv.x, edgeUv.y));
  alpha *= mix(0.74, 1.0, edgeFade);

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
