(() => {
  const VERTEX_SHADER = `#version 300 es
  in vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }`;

  const FRAGMENT_SHADER = `#version 300 es
  precision highp float;

  uniform vec2 u_resolution;
  uniform float u_time;
  uniform vec4 u_mainRect;
  uniform float u_mainRadius;
  uniform vec4 u_sideRect;
  uniform float u_sideRadius;
  uniform vec4 u_controls[8];
  uniform int u_controlCount;
  uniform vec2 u_pointer;
  uniform float u_motion;

  out vec4 outColor;

  float sat(float value) {
    return clamp(value, 0.0, 1.0);
  }

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise2(vec2 p) {
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
    mat2 rotation = mat2(0.82, -0.57, 0.57, 0.82);
    for (int i = 0; i < 3; i++) {
      value += amplitude * noise2(p);
      p = rotation * p * 2.03 + 13.7;
      amplitude *= 0.48;
    }
    return value;
  }

  vec3 scene(vec2 uv) {
    uv = clamp(uv, 0.0, 1.0);
    vec3 top = vec3(0.055, 0.020, 0.105);
    vec3 middle = vec3(0.27, 0.085, 0.29);
    vec3 lower = vec3(0.028, 0.090, 0.22);
    vec3 color = mix(top, middle, smoothstep(0.02, 0.54, 1.0 - uv.y));
    color = mix(color, lower, smoothstep(0.58, 1.0, 1.0 - uv.y));

    float drift = u_time * 0.010 * u_motion;
    float first = fbm(uv * vec2(3.1, 2.15) + vec2(drift, -drift * 0.48));
    float second = fbm(uv.yx * vec2(4.4, 3.0) + vec2(7.0, -drift));
    float pink = smoothstep(0.43, 0.80, first + 0.22 * exp(-length((uv - vec2(0.22, 0.28)) * vec2(1.25, 2.0))));
    float cyan = smoothstep(0.48, 0.84, second + 0.24 * exp(-length((uv - vec2(0.80, 0.31)) * vec2(1.35, 2.15))));
    float violet = smoothstep(0.54, 0.90, first * 0.54 + second * 0.52);

    color += vec3(0.42, 0.055, 0.30) * pink * 0.31;
    color += vec3(0.035, 0.31, 0.50) * cyan * 0.29;
    color += vec3(0.19, 0.055, 0.36) * violet * 0.17;

    vec2 grid = uv * vec2(20.0, 12.0);
    vec2 cell = floor(grid);
    vec2 local = fract(grid) - 0.5;
    float seed = hash21(cell + 7.1);
    vec2 jitter = vec2(hash21(cell + 2.3), hash21(cell + 9.6)) - 0.5;
    local -= jitter * 0.58;
    float star = smoothstep(0.018, 0.0, length(local)) * step(0.79, seed);
    vec3 starColor = mix(vec3(1.0, 0.54, 0.82), vec3(0.46, 0.90, 1.0), step(0.53, seed));
    starColor = mix(starColor, vec3(0.82, 0.66, 1.0), step(0.82, seed));
    color += starColor * star * (0.36 + 0.30 * sin(u_time * 0.48 + seed * 18.0));
    return color;
  }

  float roundedBoxSdf(vec2 p, vec2 halfSize, float radius) {
    vec2 q = abs(p) - halfSize + radius;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - radius;
  }

  vec2 perimeterNormal(vec2 p, vec2 halfSize, float radius) {
    vec2 core = max(halfSize - vec2(radius), vec2(0.0));
    vec2 nearest = clamp(p, -core, core);
    vec2 radial = p - nearest;
    float radialLength = length(radial);
    if (radialLength > 0.0001) return radial / radialLength;
    vec2 ratio = abs(p) / max(core, vec2(1.0));
    if (ratio.x > ratio.y) return vec2(p.x < 0.0 ? -1.0 : 1.0, 0.0);
    return vec2(0.0, p.y < 0.0 ? -1.0 : 1.0);
  }

  vec2 softLimit(vec2 vector, float limitPx) {
    float vectorLength = length(vector);
    float softened = vectorLength / (1.0 + vectorLength / max(limitPx, 1.0));
    return vector * (softened / max(vectorLength, 0.0001));
  }

  vec3 blurScene(vec2 frag, vec2 offset, float radiusPx) {
    vec2 uv = (frag + offset) / u_resolution;
    vec2 stepUv = vec2(radiusPx) / u_resolution;
    vec3 color = scene(uv) * 0.42;
    color += scene(uv + vec2(stepUv.x, 0.0)) * 0.145;
    color += scene(uv - vec2(stepUv.x, 0.0)) * 0.145;
    color += scene(uv + vec2(0.0, stepUv.y)) * 0.145;
    color += scene(uv - vec2(0.0, stepUv.y)) * 0.145;
    return color;
  }

  vec4 overPremultiplied(vec4 underColor, vec4 overColor) {
    return overColor + underColor * (1.0 - overColor.a);
  }

  vec4 newGlassAt(vec2 frag, vec4 rect, float radius, float intensity) {
    if (rect.z <= 1.0 || rect.w <= 1.0) return vec4(0.0);
    vec2 center = rect.xy + rect.zw * 0.5;
    vec2 halfSize = rect.zw * 0.5;
    vec2 p = frag - center;
    float minSize = min(rect.z, rect.w);
    float safeRadius = min(radius, minSize * 0.5);
    float sdf = roundedBoxSdf(p, halfSize, safeRadius);
    float mask = 1.0 - smoothstep(-0.65, 0.85, sdf);
    if (mask <= 0.001) return vec4(0.0);

    float depth = max(-sdf, 0.0);
    vec2 normal = perimeterNormal(p, halfSize, safeRadius);
    float reach = min(max(safeRadius * 0.92, 18.0), minSize * 0.45);
    float depthRatio = sat(depth / max(reach, 1.0));
    float smoothDepth = depthRatio * depthRatio * (3.0 - 2.0 * depthRatio);
    float bodyWeight = pow(1.0 - smoothDepth, 1.38);

    float remaining = max(reach - depth, 0.0);
    float displacement = remaining * (1.0 - exp(-(17.0 * pow(bodyWeight, 1.25)) / max(remaining, 1.0))) * 0.82;
    vec2 mainFlow = -normal * displacement;

    vec2 unit = p / max(halfSize, vec2(1.0));
    vec2 unitSquared = unit * unit;
    float envelope = exp(-(unitSquared.x * unitSquared.x + unitSquared.y * unitSquared.y) * 1.55);
    vec2 centerTransport = vec2(
      unit.x * (1.0 - 0.18 * unitSquared.y),
      -0.27 * unit.y * (1.0 - 0.14 * unitSquared.x)
    );
    centerTransport += vec2(-unit.y, unit.x) * 0.009;
    centerTransport *= minSize * 0.031 * envelope;

    float shoulderWidth = min(max(17.0, safeRadius * 0.76), minSize * 0.19);
    float shoulder = 1.0 - smoothstep(0.0, shoulderWidth, depth);
    vec2 tangent = vec2(-normal.y, normal.x);
    float tangentialFlow = sin((p.x + p.y) * 0.013) * shoulder * 1.55;
    vec2 opticalFlow = softLimit(mainFlow + centerTransport + tangent * tangentialFlow, 58.0);

    vec2 pointerDelta = (u_pointer - frag) / max(u_resolution.x, u_resolution.y);
    float pointerField = exp(-dot(pointerDelta, pointerDelta) * 28.0);
    opticalFlow += pointerDelta * minSize * 0.010 * pointerField;

    float blurAmount = 1.2 + bodyWeight * 1.55 + shoulder * 0.52;
    vec3 bodyColor = blurScene(frag, opticalFlow, blurAmount);

    float dispersionEdge = 1.0 - smoothstep(0.0, max(10.0, safeRadius * 0.46), depth);
    float dispersionMask = pow(dispersionEdge, 1.65) * 0.42;
    vec2 split = normal * (1.7 + shoulder * 1.1);
    vec3 redSample = blurScene(frag, opticalFlow + split, blurAmount);
    vec3 blueSample = blurScene(frag, opticalFlow - split, blurAmount);
    vec3 prism = vec3(redSample.r, (redSample.g + blueSample.g) * 0.5, blueSample.b);
    bodyColor = mix(bodyColor, prism, dispersionMask);

    float luminance = dot(bodyColor, vec3(0.299, 0.587, 0.114));
    bodyColor = mix(bodyColor, vec3(luminance), 0.035);
    bodyColor *= 1.015 + bodyWeight * 0.055;
    bodyColor -= vec3(0.012, 0.016, 0.023) * bodyWeight;

    vec2 lightDirection = normalize(vec2(-0.62, 0.78));
    float facing = pow(sat(dot(normal, lightDirection)), 2.6);
    float edgeLine = exp(-abs(sdf) * 0.48);
    float reflection = shoulder * facing;
    bodyColor += vec3(0.90, 0.96, 1.0) * reflection * 0.10;
    bodyColor += vec3(0.92, 0.82, 1.0) * edgeLine * 0.14;
    bodyColor -= vec3(0.025, 0.020, 0.034) * shoulder * (1.0 - facing) * 0.48;

    float alpha = mask * (0.105 + bodyWeight * 0.075 + shoulder * 0.075 + edgeLine * 0.10) * intensity;
    alpha = clamp(alpha, 0.0, 0.38);
    return vec4(clamp(bodyColor, 0.0, 1.0) * alpha, alpha);
  }

  float legacyThickness(vec2 p, vec2 halfSize, float radius, float edgeWidth) {
    float sdf = roundedBoxSdf(p, halfSize, radius);
    float inside = max(-sdf, 0.0);
    float rimWide = 1.0 - smoothstep(0.0, edgeWidth, inside);
    float rimCore = 1.0 - smoothstep(0.0, max(edgeWidth * 0.28, 2.0), inside);
    vec2 unit = p / max(halfSize, vec2(1.0));
    float dome = pow(sat(1.0 - length(unit * vec2(0.42, 0.72)) * 0.74), 1.65);
    return dome * 0.18 + rimWide * 0.48 + rimCore * 0.36;
  }

  vec4 legacyGlassAt(vec2 frag, vec4 rect, float radius) {
    if (rect.z <= 1.0 || rect.w <= 1.0) return vec4(0.0);
    vec2 center = rect.xy + rect.zw * 0.5;
    vec2 halfSize = rect.zw * 0.5;
    vec2 p = frag - center;
    float minSize = min(rect.z, rect.w);
    float safeRadius = min(radius, minSize * 0.5);
    float sdf = roundedBoxSdf(p, halfSize, safeRadius);
    float mask = 1.0 - smoothstep(0.0, 1.25, sdf);
    if (mask <= 0.001) return vec4(0.0);

    float inside = max(-sdf, 0.0);
    float edgeWidth = clamp(minSize * 0.28, 7.0, 18.0);
    float coreWidth = max(edgeWidth * 0.28, 2.4);
    float rimWide = 1.0 - smoothstep(0.0, edgeWidth, inside);
    float rimCore = 1.0 - smoothstep(0.0, coreWidth, inside);
    vec2 normal = perimeterNormal(p, halfSize, safeRadius);

    float stepPx = 1.5;
    float leftThickness = legacyThickness(p - vec2(stepPx, 0.0), halfSize, safeRadius, edgeWidth);
    float rightThickness = legacyThickness(p + vec2(stepPx, 0.0), halfSize, safeRadius, edgeWidth);
    float upThickness = legacyThickness(p - vec2(0.0, stepPx), halfSize, safeRadius, edgeWidth);
    float downThickness = legacyThickness(p + vec2(0.0, stepPx), halfSize, safeRadius, edgeWidth);
    vec2 gradient = vec2(rightThickness - leftThickness, downThickness - upThickness);
    float gradientLength = length(gradient);
    gradient *= smoothstep(0.0004, 0.012, gradientLength) * min(1.0, 0.22 / max(gradientLength, 0.0001));

    vec2 refract = gradient * (34.0 + rimWide * 82.0);
    refract += -normal * rimWide * 4.5;
    refract = softLimit(refract, 32.0 + rimWide * 20.0);
    vec3 bodyColor = blurScene(frag, refract, 0.85 + rimWide * 1.15);

    vec2 tangent = vec2(-normal.y, normal.x);
    float pull = 7.0 + rimWide * 12.0;
    vec3 dragged = scene((frag - normal * pull + tangent * edgeWidth * 0.32) / u_resolution) * 0.5;
    dragged += scene((frag - normal * pull - tangent * edgeWidth * 0.32) / u_resolution) * 0.5;
    bodyColor = mix(bodyColor, dragged, rimWide * 0.20);

    float facing = pow(sat(dot(normal, normalize(vec2(-0.58, 0.82)))), 2.8);
    float edgeLine = exp(-abs(sdf) * 0.58);
    bodyColor *= 1.0 + rimCore * 0.07;
    bodyColor += vec3(0.94, 0.97, 1.0) * (edgeLine * 0.22 + rimCore * facing * 0.10);
    bodyColor -= vec3(0.035, 0.025, 0.042) * rimWide * (1.0 - facing) * 0.50;

    float alpha = mask * (0.035 + rimWide * 0.11 + rimCore * 0.10 + edgeLine * 0.12);
    alpha = clamp(alpha, 0.0, 0.34);
    return vec4(clamp(bodyColor, 0.0, 1.0) * alpha, alpha);
  }

  void main() {
    vec2 frag = gl_FragCoord.xy;
    vec4 glass = vec4(0.0);
    glass = overPremultiplied(glass, newGlassAt(frag, u_mainRect, u_mainRadius, 1.0));
    glass = overPremultiplied(glass, newGlassAt(frag, u_sideRect, u_sideRadius, 0.86));

    for (int index = 0; index < 8; index++) {
      if (index >= u_controlCount) break;
      vec4 rect = u_controls[index];
      float radius = min(rect.w * 0.48, rect.z * 0.48);
      glass = overPremultiplied(glass, legacyGlassAt(frag, rect, radius));
    }

    outColor = glass;
  }`;

  class BlogGlassRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.gl = canvas.getContext('webgl2', {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: true,
        powerPreference: 'high-performance'
      });
      this.program = null;
      this.locations = null;
      this.mainElement = null;
      this.sideElement = null;
      this.controlElements = [];
      this.pointer = { x: innerWidth * 0.5, y: innerHeight * 0.4 };
      this.running = false;
      this.motion = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1;
      this.startTime = performance.now();
      this.raf = 0;
      this.lastFrame = 0;
      this.resizeObserver = null;
      this.onPointerMove = this.onPointerMove.bind(this);
      this.render = this.render.bind(this);
    }

    initialise() {
      if (!this.gl) return false;
      const gl = this.gl;
      const vertex = this.compile(gl.VERTEX_SHADER, VERTEX_SHADER);
      const fragment = this.compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
      if (!vertex || !fragment) return false;
      const program = gl.createProgram();
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.warn('Blog glass program link failed:', gl.getProgramInfoLog(program));
        return false;
      }
      this.program = program;
      this.locations = {
        position: gl.getAttribLocation(program, 'a_position'),
        resolution: gl.getUniformLocation(program, 'u_resolution'),
        time: gl.getUniformLocation(program, 'u_time'),
        mainRect: gl.getUniformLocation(program, 'u_mainRect'),
        mainRadius: gl.getUniformLocation(program, 'u_mainRadius'),
        sideRect: gl.getUniformLocation(program, 'u_sideRect'),
        sideRadius: gl.getUniformLocation(program, 'u_sideRadius'),
        controls: gl.getUniformLocation(program, 'u_controls[0]'),
        controlCount: gl.getUniformLocation(program, 'u_controlCount'),
        pointer: gl.getUniformLocation(program, 'u_pointer'),
        motion: gl.getUniformLocation(program, 'u_motion')
      };
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
      gl.useProgram(program);
      gl.enableVertexAttribArray(this.locations.position);
      gl.vertexAttribPointer(this.locations.position, 2, gl.FLOAT, false, 0, 0);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      return true;
    }

    compile(type, source) {
      const gl = this.gl;
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn('Blog glass shader compile failed:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    bind(mainElement, controlElements) {
      this.mainElement = mainElement;
      this.sideElement = document.getElementById('articleToc');
      this.controlElements = [...controlElements].slice(0, 8);
      this.resizeObserver?.disconnect();
      this.resizeObserver = new ResizeObserver(() => this.resize());
      if (this.mainElement) this.resizeObserver.observe(this.mainElement);
      if (this.sideElement) this.resizeObserver.observe(this.sideElement);
      this.controlElements.forEach((element) => this.resizeObserver.observe(element));
      this.resize();
    }

    start() {
      if (!this.program || this.running) return;
      this.running = true;
      addEventListener('pointermove', this.onPointerMove, { passive: true });
      this.raf = requestAnimationFrame(this.render);
    }

    stop() {
      this.running = false;
      cancelAnimationFrame(this.raf);
      removeEventListener('pointermove', this.onPointerMove);
      this.resizeObserver?.disconnect();
    }

    onPointerMove(event) {
      this.pointer.x += (event.clientX - this.pointer.x) * 0.28;
      this.pointer.y += (event.clientY - this.pointer.y) * 0.28;
    }

    resize() {
      const dprCap = innerWidth <= 560 ? 1.04 : innerWidth <= 1100 ? 1.16 : 1.34;
      const dpr = Math.min(devicePixelRatio || 1, dprCap);
      const width = Math.max(1, Math.round(innerWidth * dpr));
      const height = Math.max(1, Math.round(innerHeight * dpr));
      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.canvas.style.width = `${innerWidth}px`;
        this.canvas.style.height = `${innerHeight}px`;
      }
    }

    toGlRect(element, dpr) {
      if (!element || element.hidden) return [0, 0, 0, 0];
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return [0, 0, 0, 0];
      return [
        rect.left * dpr,
        (innerHeight - rect.bottom) * dpr,
        rect.width * dpr,
        rect.height * dpr
      ];
    }

    radiusFor(element, dpr, fallback) {
      if (!element) return fallback * dpr;
      return (parseFloat(getComputedStyle(element).borderTopLeftRadius) || fallback) * dpr;
    }

    render(now) {
      if (!this.running || !this.program) return;
      const frameInterval = innerWidth <= 1100 ? 1000 / 30 : 1000 / 42;
      if (now - this.lastFrame < frameInterval) {
        this.raf = requestAnimationFrame(this.render);
        return;
      }
      this.lastFrame = now;
      this.resize();
      const gl = this.gl;
      const dpr = this.canvas.width / Math.max(innerWidth, 1);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(this.program);
      gl.uniform2f(this.locations.resolution, this.canvas.width, this.canvas.height);
      gl.uniform1f(this.locations.time, (now - this.startTime) / 1000);
      gl.uniform4fv(this.locations.mainRect, this.toGlRect(this.mainElement, dpr));
      gl.uniform1f(this.locations.mainRadius, this.radiusFor(this.mainElement, dpr, 42));
      gl.uniform4fv(this.locations.sideRect, this.toGlRect(this.sideElement, dpr));
      gl.uniform1f(this.locations.sideRadius, this.radiusFor(this.sideElement, dpr, 26));
      const controls = new Float32Array(8 * 4);
      this.controlElements.forEach((element, index) => controls.set(this.toGlRect(element, dpr), index * 4));
      gl.uniform4fv(this.locations.controls, controls);
      gl.uniform1i(this.locations.controlCount, this.controlElements.length);
      gl.uniform2f(this.locations.pointer, this.pointer.x * dpr, (innerHeight - this.pointer.y) * dpr);
      gl.uniform1f(this.locations.motion, this.motion);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      this.raf = requestAnimationFrame(this.render);
    }
  }

  window.BlogGlassRenderer = BlogGlassRenderer;
})();
