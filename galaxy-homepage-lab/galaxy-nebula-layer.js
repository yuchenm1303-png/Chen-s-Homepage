const starCanvas = document.getElementById('galaxyCanvas');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!starCanvas) {
  throw new Error('Galaxy canvas is required before the nebula layer can mount.');
}

// Keep the nebula independent from the stellar material so it can be tuned as a
// low-frequency Milky Way structure layer without disturbing the approved stars.
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
  mat2 octave = mat2(1.72, 1.12, -1.12, 1.72);

  for (int i = 0; i < 5; i++) {
    value += valueNoise(p) * amplitude;
    p = octave * p + 0.17;
    amplitude *= 0.49;
  }

  return value;
}

float ridge(float x) {
  return 1.0 - abs(x * 2.0 - 1.0);
}

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);

  // The nebula follows the same observer-camera model as the star field, but at
  // a smaller amplitude so it reads as a deeper layer rather than a glued overlay.
  p += vec2(uCamera.x * 0.0060, uCamera.y * 0.0045);

  // Bottom-left -> top-right Milky Way axis. Curvature is structural, not animated;
  // the field only drifts microscopically over time to avoid a smoke simulation.
  vec2 axis = normalize(vec2(0.69, 0.724));
  vec2 normal = vec2(-axis.y, axis.x);
  float along = dot(p, axis);
  float across = dot(p, normal);

  float curve = 0.052 * sin(along * 2.15 + 0.55)
              + 0.018 * sin(along * 5.20 - 0.40);
  across -= curve;

  float drift = uTime * 0.0017;
  vec2 slowDrift = vec2(drift, -drift * 0.46);

  // Large-scale domain warp gives the band a photographic irregularity while
  // keeping the silhouette coherent and recognisably galactic.
  float warpA = fbm(vec2(along * 0.72, across * 1.35) + vec2(3.8, -1.7) + slowDrift);
  float warpB = fbm(vec2(along * 1.25, across * 2.10) + vec2(-5.2, 4.1) - slowDrift * 0.5);
  float warpedAcross = across + (warpA - 0.5) * 0.115 + (warpB - 0.5) * 0.045;

  float broadBand = exp(-pow(abs(warpedAcross) / 0.365, 1.75));
  float innerBand = exp(-pow(abs(warpedAcross) / 0.220, 1.55));

  // Three spatial frequencies: broad molecular cloud mass, granular filaments,
  // and a high-frequency ridge signal for dark dust structure.
  float cloudMass = fbm(vec2(along * 0.82, warpedAcross * 1.55) + vec2(1.1, 7.4) + slowDrift);
  float filament = fbm(vec2(along * 2.10, warpedAcross * 4.40) + vec2(-8.3, 2.6) - slowDrift * 0.35);
  float fineDust = fbm(vec2(along * 4.60, warpedAcross * 10.0) + vec2(5.4, -9.2));

  float structure = clamp(cloudMass * 0.66 + filament * 0.34, 0.0, 1.0);
  float cloudVeil = smoothstep(0.40, 0.78, structure) * broadBand;
  float denseCloud = smoothstep(0.55, 0.86, structure) * innerBand;

  // Warm stellar-density regions are deliberately localised. This avoids the
  // old problem where the whole band became a beige/grey fog.
  float coreWindow = exp(-pow((along - 0.12) / 0.72, 2.0));
  float warmWindow = exp(-pow((along + 0.14) / 0.92, 2.0));
  float coolWindow = 0.42
    + 0.58 * exp(-pow((along - 0.68) / 0.78, 2.0));

  float warmEmission = cloudVeil * coreWindow
    * (0.42 + 0.58 * ridge(filament));
  float coolEmission = cloudVeil * coolWindow
    * smoothstep(0.46, 0.82, warpB);

  // A primary dust lane plus broken secondary lanes. These are absorption layers,
  // so they actually darken stars/clouds behind them rather than looking like glow.
  float laneMeander = (filament - 0.5) * 0.072
    + (fineDust - 0.5) * 0.030;
  float laneDistance = abs(warpedAcross + 0.018 + laneMeander);
  float primaryLane = exp(-pow(laneDistance / 0.052, 2.0));

  float secondaryLaneA = exp(-pow(
    abs(warpedAcross - 0.105 + (warpB - 0.5) * 0.055) / 0.035,
    2.0
  ));
  float secondaryLaneB = exp(-pow(
    abs(warpedAcross + 0.145 + (cloudMass - 0.5) * 0.060) / 0.043,
    2.0
  ));

  float broken = smoothstep(0.44, 0.72, fineDust);
  float dust = innerBand * clamp(
    primaryLane * (0.58 + 0.42 * broken)
      + secondaryLaneA * 0.36 * broken
      + secondaryLaneB * 0.25 * (1.0 - broken),
    0.0,
    1.0
  );

  // Extremely faint diffuse outskirts make the Milky Way read as a volume rather
  // than a line while preserving large areas of true black sky.
  float outskirts = broadBand * smoothstep(0.34, 0.68, cloudMass) * 0.48;

  vec3 warmColor = vec3(0.195, 0.092, 0.044);
  vec3 neutralDustGlow = vec3(0.083, 0.071, 0.064);
  vec3 coolColor = vec3(0.035, 0.068, 0.112);
  vec3 dustColor = vec3(0.0025, 0.0034, 0.0048);

  vec3 emissionColor = vec3(0.0);
  emissionColor += warmColor * warmEmission * warmWindow;
  emissionColor += coolColor * coolEmission;
  emissionColor += neutralDustGlow * denseCloud * 0.24;
  emissionColor += vec3(0.025, 0.030, 0.037) * outskirts;

  float emissionAlpha = clamp(
      cloudVeil * 0.070
    + denseCloud * 0.038
    + outskirts * 0.018,
    0.0,
    0.115
  );

  float dustAlpha = dust * (0.075 + denseCloud * 0.075);
  float alpha = clamp(emissionAlpha + dustAlpha, 0.0, 0.165);

  float dustMix = dustAlpha / max(alpha, 0.0001);
  vec3 color = mix(emissionColor / max(emissionAlpha, 0.018), dustColor, dustMix);

  // Gentle photographic grain breaks up procedural smoothness without adding
  // visible animated noise. It is stable in screen space.
  float grain = hash21(gl_FragCoord.xy + 19.73) - 0.5;
  color += grain * 0.0045;

  // Fade the procedural layer toward the viewport edges so no rectangular or
  // synthetic boundary can be perceived.
  vec2 edgeUv = abs(vUv - 0.5) * 2.0;
  float edgeFade = 1.0 - smoothstep(0.76, 1.04, max(edgeUv.x, edgeUv.y));
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
