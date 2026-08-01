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
  uniform vec4 u_controls[8];
  uniform int u_controlCount;
  uniform vec2 u_pointer;
  uniform float u_motion;

  out vec4 outColor;

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
    float amp = 0.52;
    mat2 rot = mat2(0.82, -0.57, 0.57, 0.82);
    for (int i = 0; i < 3; i++) {
      value += amp * noise2(p);
      p = rot * p * 2.03 + 13.7;
      amp *= 0.48;
    }
    return value;
  }

  float starShape(vec2 p, float flare) {
    float core = 0.0018 / max(dot(p, p), 0.00002);
    float rays = max(0.0, 1.0 - abs(p.x * p.y) * 1700.0);
    rays *= max(0.0, 1.0 - length(p) * 10.0);
    return core * 0.018 + rays * flare;
  }

  vec3 starLayer(vec2 uv) {
    vec2 grid = uv * vec2(19.0, 11.0);
    vec2 cell = floor(grid);
    vec2 local = fract(grid) - 0.5;
    float seed = hash21(cell + 7.1);
    vec2 jitter = vec2(hash21(cell + 2.3), hash21(cell + 9.6)) - 0.5;
    local -= jitter * 0.58;
    float size = mix(0.25, 0.70, hash21(cell + 4.2));
    float star = smoothstep(0.026 * size, 0.0, length(local));
    star *= step(0.77, seed);
    vec3 palette = mix(
      mix(vec3(1.0, 0.42, 0.78), vec3(0.30, 0.88, 1.0), step(0.34, seed)),
      mix(vec3(0.70, 0.45, 1.0), vec3(1.0, 0.78, 0.34), step(0.86, seed)),
      step(0.66, seed)
    );
    return palette * star * (0.50 + 0.55 * sin(u_time * 0.55 + seed * 20.0));
  }

  vec3 scene(vec2 uv) {
    uv = clamp(uv, 0.0, 1.0);
    vec3 top = vec3(0.055, 0.020, 0.105);
    vec3 mid = vec3(0.26, 0.08, 0.29);
    vec3 low = vec3(0.025, 0.085, 0.21);
    vec3 base = mix(top, mid, smoothstep(0.02, 0.52, 1.0 - uv.y));
    base = mix(base, low, smoothstep(0.56, 1.0, 1.0 - uv.y));

    float drift = u_time * 0.012 * u_motion;
    float n1 = fbm(uv * vec2(3.2, 2.2) + vec2(drift, -drift * 0.55));
    float n2 = fbm(uv.yx * vec2(4.6, 3.1) + vec2(7.0, -drift));

    float pink = smoothstep(0.40, 0.78, n1 + 0.24 * exp(-length((uv - vec2(0.23, 0.28)) * vec2(1.2, 2.0))));
    float cyan = smoothstep(0.46, 0.82, n2 + 0.28 * exp(-length((uv - vec2(0.80, 0.32)) * vec2(1.3, 2.2))));
    float violet = smoothstep(0.52, 0.88, n1 * 0.55 + n2 * 0.55);

    base += vec3(0.46, 0.08, 0.34) * pink * 0.38;
    base += vec3(0.06, 0.36, 0.56) * cyan * 0.34;
    base += vec3(0.22, 0.07, 0.42) * violet * 0.22;
    base += starLayer(uv);

    vec2 hero = uv - vec2(0.49, 0.18);
    float heroStar = starShape(hero, 0.48);
    base += vec3(0.68, 0.88, 1.0) * heroStar * 0.42;
    return base;
  }

  float sdRoundRect(vec2 p, vec2 halfSize, float radius) {
    vec2 q = abs(p) - halfSize + radius;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - radius;
  }

  vec2 sdfNormal(vec2 p, vec2 halfSize, float radius) {
    float e = 1.0;
    float dx = sdRoundRect(p + vec2(e, 0.0), halfSize, radius) - sdRoundRect(p - vec2(e, 0.0), halfSize, radius);
    float dy = sdRoundRect(p + vec2(0.0, e), halfSize, radius) - sdRoundRect(p - vec2(0.0, e), halfSize, radius);
    return normalize(vec2(dx, dy) + 0.0001);
  }

  vec3 blurredScene(vec2 frag, vec2 offset, float radiusPx) {
    vec2 uv = (frag + offset) / u_resolution;
    vec2 stepUv = vec2(radiusPx) / u_resolution;
    vec3 color = scene(uv) * 0.40;
    color += scene(uv + vec2(stepUv.x, 0.0)) * 0.15;
    color += scene(uv - vec2(stepUv.x, 0.0)) * 0.15;
    color += scene(uv + vec2(0.0, stepUv.y)) * 0.15;
    color += scene(uv - vec2(0.0, stepUv.y)) * 0.15;
    return color;
  }

  vec3 applyNewGlass(vec3 base, vec2 frag, vec4 rect, float radius) {
    vec2 center = rect.xy + rect.zw * 0.5;
    vec2 p = frag - center;
    vec2 halfSize = rect.zw * 0.5;
    float d = sdRoundRect(p, halfSize, radius);
    float inside = smoothstep(1.8, -1.8, d);
    if (inside <= 0.001) return base;

    vec2 normal = sdfNormal(p, halfSize, radius);
    float edgeDistance = max(-d, 0.0);
    float shoulder = 1.0 - smoothstep(5.0, 42.0, edgeDistance);
    float body = smoothstep(0.0, 54.0, edgeDistance);
    vec2 pointerDelta = (u_pointer - frag) / max(u_resolution.x, u_resolution.y);
    float pointerWave = exp(-dot(pointerDelta, pointerDelta) * 22.0) * 0.8;

    float pull = 7.0 + shoulder * 21.0 + body * 3.0 + pointerWave * 5.0;
    vec2 offset = -normal * pull;
    vec3 blur = blurredScene(frag, offset, 2.8 + body * 4.6);

    float dispersion = shoulder * 0.64;
    vec3 refracted;
    refracted.r = scene((frag + offset + normal * 3.2 * dispersion) / u_resolution).r;
    refracted.g = blur.g;
    refracted.b = scene((frag + offset - normal * 3.6 * dispersion) / u_resolution).b;

    float topLight = smoothstep(-0.25, 0.85, normal.y) * shoulder;
    float lowerShade = smoothstep(-0.15, 0.85, -normal.y) * shoulder;
    float edgeLine = exp(-abs(d) * 0.34);
    vec3 glass = mix(blur, refracted, 0.54);
    glass *= 0.91 + body * 0.06;
    glass += vec3(0.055, 0.040, 0.075) * body;
    glass += vec3(0.74, 0.86, 1.0) * topLight * 0.17;
    glass -= vec3(0.10, 0.045, 0.12) * lowerShade * 0.22;
    glass += vec3(0.90, 0.66, 1.0) * edgeLine * 0.10;

    return mix(base, glass, inside * 0.94);
  }

  vec3 applyLegacyControl(vec3 base, vec2 frag, vec4 rect, float radius) {
    vec2 center = rect.xy + rect.zw * 0.5;
    vec2 p = frag - center;
    vec2 halfSize = rect.zw * 0.5;
    float d = sdRoundRect(p, halfSize, radius);
    float inside = smoothstep(1.4, -1.4, d);
    if (inside <= 0.001) return base;

    vec2 normal = sdfNormal(p, halfSize, radius);
    float inward = max(-d, 0.0);
    float ring = 1.0 - smoothstep(2.0, min(18.0, min(rect.z, rect.w) * 0.34), inward);
    float core = smoothstep(6.0, 20.0, inward);
    vec2 pull = -normal * (4.0 + ring * 15.0);
    vec3 centerScene = blurredScene(frag, pull, 1.2 + core * 1.4);
    vec3 edgeScene;
    edgeScene.r = scene((frag + pull + normal * 2.8) / u_resolution).r;
    edgeScene.g = centerScene.g;
    edgeScene.b = scene((frag + pull - normal * 3.0) / u_resolution).b;
    vec3 glass = mix(centerScene, edgeScene, ring * 0.70);
    float rimLight = exp(-abs(d) * 0.50) + ring * 0.16;
    glass += vec3(0.95, 0.80, 1.0) * rimLight * 0.19;
    glass -= vec3(0.10, 0.04, 0.12) * ring * 0.13;
    glass = mix(glass, glass * 1.08, core * 0.36);
    return mix(base, glass, inside * 0.96);
  }

  void main() {
    vec2 frag = gl_FragCoord.xy;
    vec2 uv = frag / u_resolution;
    vec3 raw = scene(uv);
    vec3 color = raw * 0.64;
    color = applyNewGlass(color, frag, u_mainRect, u_mainRadius);

    for (int i = 0; i < 8; i++) {
      if (i >= u_controlCount) break;
      vec4 rect = u_controls[i];
      float radius = min(rect.w * 0.48, 22.0);
      color = applyLegacyControl(color, frag, rect, radius);
    }

    float vignette = 1.0 - smoothstep(0.24, 0.90, distance(uv, vec2(0.5)));
    color *= 0.80 + vignette * 0.24;
    outColor = vec4(color, 0.965);
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
      this.controlElements = [...controlElements].slice(0, 8);
      this.resizeObserver?.disconnect();
      this.resizeObserver = new ResizeObserver(() => this.resize());
      if (mainElement) this.resizeObserver.observe(mainElement);
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
      this.pointer.x += (event.clientX - this.pointer.x) * 0.32;
      this.pointer.y += (event.clientY - this.pointer.y) * 0.32;
    }

    resize() {
      const dprCap = innerWidth <= 560 ? 1.08 : innerWidth <= 1100 ? 1.20 : 1.45;
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
      if (!element) return [0, 0, 0, 0];
      const rect = element.getBoundingClientRect();
      return [
        rect.left * dpr,
        (innerHeight - rect.bottom) * dpr,
        rect.width * dpr,
        rect.height * dpr
      ];
    }

    render(now) {
      if (!this.running || !this.program) return;
      const frameInterval = innerWidth <= 1100 ? 1000 / 30 : 1000 / 45;
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
      const mainRect = this.toGlRect(this.mainElement, dpr);
      gl.uniform4fv(this.locations.mainRect, mainRect);
      const radiusCss = parseFloat(getComputedStyle(this.mainElement).borderTopLeftRadius) || 42;
      gl.uniform1f(this.locations.mainRadius, radiusCss * dpr);
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
