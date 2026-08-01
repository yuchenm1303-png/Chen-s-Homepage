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
    for (int i = 0; i < 4; i++) {
      value += amplitude * noise2(p);
      p = rotation * p * 2.03 + 13.7;
      amplitude *= 0.48;
    }
    return value;
  }

  float fourPointStar(vec2 p, float scale) {
    p *= scale;
    float core = smoothstep(0.10, 0.0, length(p));
    float horizontal = exp(-abs(p.y) * 34.0) * exp(-abs(p.x) * 4.2);
    float vertical = exp(-abs(p.x) * 34.0) * exp(-abs(p.y) * 4.2);
    return core + (horizontal + vertical) * 0.34;
  }

  vec3 scene(vec2 uv) {
    uv = clamp(uv, 0.0, 1.0);

    vec3 top = vec3(0.038, 0.018, 0.078);
    vec3 upper = vec3(0.205, 0.070, 0.235);
    vec3 lower = vec3(0.025, 0.080, 0.190);
    vec3 color = mix(top, upper, smoothstep(0.02, 0.53, 1.0 - uv.y));
    color = mix(color, lower, smoothstep(0.55, 1.0, 1.0 - uv.y));

    float drift = u_time * 0.010 * u_motion;
    float first = fbm(uv * vec2(3.0, 2.05) + vec2(drift, -drift * 0.45));
    float second = fbm(uv.yx * vec2(4.15, 2.85) + vec2(6.7, -drift));

    float pinkCloud = smoothstep(
      0.42,
      0.82,
      first + 0.31 * exp(-length((uv - vec2(0.24, 0.28)) * vec2(1.10, 1.85)))
    );
    float cyanCloud = smoothstep(
      0.47,
      0.84,
      second + 0.29 * exp(-length((uv - vec2(0.79, 0.32)) * vec2(1.22, 1.95)))
    );
    float violetCloud = smoothstep(0.52, 0.88, first * 0.55 + second * 0.52);

    color += vec3(0.50, 0.055, 0.32) * pinkCloud * 0.32;
    color += vec3(0.035, 0.32, 0.54) * cyanCloud * 0.30;
    color += vec3(0.20, 0.055, 0.39) * violetCloud * 0.16;

    vec2 grid = uv * vec2(25.0, 15.0);
    vec2 cell = floor(grid);
    vec2 local = fract(grid) - 0.5;
    float seed = hash21(cell + 7.1);
    vec2 jitter = vec2(hash21(cell + 2.3), hash21(cell + 9.6)) - 0.5;
    local -= jitter * 0.62;
    float tinyStar = smoothstep(0.024, 0.0, length(local)) * step(0.78, seed);
    vec3 tinyColor = mix(vec3(1.0, 0.48, 0.78), vec3(0.40, 0.90, 1.0), step(0.50, seed));
    tinyColor = mix(tinyColor, vec3(0.82, 0.68, 1.0), step(0.82, seed));
    color += tinyColor * tinyStar * (0.55 + 0.28 * sin(u_time * 0.52 + seed * 18.0));

    vec2 largeGrid = uv * vec2(7.0, 4.2);
    vec2 largeCell = floor(largeGrid);
    vec2 largeLocal = fract(largeGrid) - 0.5;
    float largeSeed = hash21(largeCell + 31.4);
    vec2 largeJitter = vec2(hash21(largeCell + 12.2), hash21(largeCell + 18.8)) - 0.5;
    largeLocal -= largeJitter * 0.44;
    float largeStar = fourPointStar(largeLocal, 7.8) * step(0.84, largeSeed);
    vec3 largeColor = mix(vec3(1.0, 0.60, 0.82), vec3(0.52, 0.92, 1.0), step(0.52, largeSeed));
    color += largeColor * largeStar * 0.62;

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

  vec3 sceneAtPixel(vec2 pixel) {
    return scene(pixel / u_resolution);
  }

  vec3 blurScene(vec2 pixel, float radiusPx) {
    vec2 dx = vec2(radiusPx, 0.0);
    vec2 dy = vec2(0.0, radiusPx);
    vec3 color = sceneAtPixel(pixel) * 0.40;
    color += sceneAtPixel(pixel + dx) * 0.15;
    color += sceneAtPixel(pixel - dx) * 0.15;
    color += sceneAtPixel(pixel + dy) * 0.15;
    color += sceneAtPixel(pixel - dy) * 0.15;
    return color;
  }

  vec3 blurPyramid(vec2 pixel, float amount) {
    float safeAmount = clamp(amount, 0.0, 3.0);
    vec3 clearColor = sceneAtPixel(pixel);
    vec3 lowColor = blurScene(pixel, 1.65);
    vec3 mediumColor = blurScene(pixel, 3.70);
    vec3 highColor = blurScene(pixel, 6.60);
    if (safeAmount < 1.0) return mix(clearColor, lowColor, safeAmount);
    if (safeAmount < 2.0) return mix(lowColor, mediumColor, safeAmount - 1.0);
    return mix(mediumColor, highColor, safeAmount - 2.0);
  }

  vec2 centerTransport(vec2 p, vec2 halfSize, float minSize) {
    vec2 unit = p / max(halfSize, vec2(1.0));
    vec2 unit2 = unit * unit;
    float envelope = exp(-(unit2.x * unit2.x + unit2.y * unit2.y) * 1.35);
    vec2 flow = vec2(
      unit.x * (1.0 - 0.23 * unit2.y),
      -0.34 * unit.y * (1.0 - 0.18 * unit2.x)
    );
    flow.x += unit.x * 0.15 * (1.0 - 0.58 * unit2.y);
    flow.y += unit.y * 0.24 * (1.0 - 0.66 * unit2.x);
    flow += vec2(-unit.y, unit.x) * 0.012;
    return flow * minSize * 0.054 * envelope;
  }

  vec4 newGlassAt(vec2 frag, vec4 rect, float radius, float intensity) {
    if (rect.z <= 1.0 || rect.w <= 1.0) return vec4(0.0);

    vec2 center = rect.xy + rect.zw * 0.5;
    vec2 halfSize = rect.zw * 0.5;
    vec2 p = frag - center;
    float minSize = min(rect.z, rect.w);
    float safeRadius = min(radius, minSize * 0.5);
    float sdf = roundedBoxSdf(p, halfSize, safeRadius);
    float mask = 1.0 - smoothstep(-0.65, 0.95, sdf);
    if (mask <= 0.001) return vec4(0.0);

    float depth = max(-sdf, 0.0);
    vec2 normal = perimeterNormal(p, halfSize, safeRadius);
    vec2 tangent = vec2(-normal.y, normal.x);

    float reach = min(max(safeRadius * 1.05, 30.0), minSize * 0.46);
    float depthRatio = sat(depth / max(reach, 1.0));
    float smoothDepth = depthRatio * depthRatio * (3.0 - 2.0 * depthRatio);
    float bodyWeight = pow(1.0 - smoothDepth, 1.46);
    float remaining = max(reach - depth, 0.0);
    float displacement = remaining
      * (1.0 - exp(-(29.0 * pow(bodyWeight, 1.24)) / max(remaining, 1.0)))
      * 0.98;

    vec2 sourcePoint = p;
    float sourceDepth = depth;
    vec2 sourceNormal = normal;

    float shoulderWidth = min(max(24.0, safeRadius * 0.94), minSize * 0.235);
    float shoulderX = sat(depth / max(shoulderWidth, 1.0));
    float shoulder = 1.0 - smoothstep(0.0, shoulderWidth, depth);

    if (depth < shoulderWidth) {
      float mappedDepth = shoulderWidth * mix(0.78, 0.98, pow(shoulderX, 0.58));
      float inwardDistance = max(mappedDepth - depth, 0.0);
      float cornerAmount = 1.0 - max(abs(normal.x), abs(normal.y));
      float tangentialDistance = sin((p.x - p.y) * 0.010) * shoulder * (2.4 + cornerAmount * 2.0);
      sourcePoint = p - normal * inwardDistance + tangent * tangentialDistance;
      sourceDepth = mappedDepth;
      sourceNormal = perimeterNormal(sourcePoint, halfSize, safeRadius);
    }

    float sourceRatio = sat(sourceDepth / max(reach, 1.0));
    float sourceSmooth = sourceRatio * sourceRatio * (3.0 - 2.0 * sourceRatio);
    float sourceWeight = pow(1.0 - sourceSmooth, 1.46);
    float sourceRemaining = max(reach - sourceDepth, 0.0);
    float sourceDisplacement = sourceRemaining
      * (1.0 - exp(-(29.0 * pow(sourceWeight, 1.24)) / max(sourceRemaining, 1.0)))
      * 0.98;

    vec2 opticalCoord = sourcePoint
      - sourceNormal * sourceDisplacement
      + centerTransport(sourcePoint, halfSize, minSize);

    vec2 pointerDelta = (u_pointer - frag) / max(u_resolution.x, u_resolution.y);
    float pointerField = exp(-dot(pointerDelta, pointerDelta) * 30.0);
    opticalCoord += pointerDelta * minSize * 0.018 * pointerField;
    opticalCoord = p + softLimit(opticalCoord - p, 82.0);

    vec2 sampledPixel = center + opticalCoord;
    float blurAmount = clamp(0.65 + sourceWeight * 1.15 + shoulder * 0.38, 0.0, 2.35);
    vec3 glassColor = blurPyramid(sampledPixel, blurAmount);

    float dispersionWidth = max(13.0, safeRadius * 0.52);
    float dispersionEnvelope = 1.0 - smoothstep(0.0, dispersionWidth, depth);
    float cornerAmount = 1.0 - max(abs(normal.x), abs(normal.y));
    float dispersionMask = pow(dispersionEnvelope, 1.62) * (0.48 + cornerAmount * 0.24);
    vec2 split = normal * (3.1 + shoulder * 2.0);
    vec3 redSample = blurPyramid(sampledPixel + split, blurAmount);
    vec3 blueSample = blurPyramid(sampledPixel - split, blurAmount);
    vec3 prismColor = vec3(redSample.r, (redSample.g + blueSample.g) * 0.5, blueSample.b);
    glassColor = mix(glassColor, prismColor, dispersionMask);

    glassColor *= 1.035 + sourceWeight * 0.075;
    glassColor -= vec3(0.020, 0.025, 0.035) * sourceWeight;

    vec2 lightDirection = normalize(vec2(-0.62, 0.78));
    float lightFacing = pow(sat(dot(normal, lightDirection)), 2.7);
    float outerRim = pow(shoulder, 2.8);
    float edgeLine = exp(-abs(sdf) * 0.45);
    float volumeShadow = 0.055 * shoulder * (0.30 + 0.70 * (1.0 - lightFacing));
    glassColor *= 1.0 - volumeShadow;
    glassColor = mix(glassColor, vec3(0.90, 0.965, 1.0), 0.075 * shoulder * lightFacing);
    glassColor = mix(glassColor, vec3(0.95, 0.985, 1.0), 0.13 * outerRim * lightFacing);
    glassColor += vec3(0.76, 0.88, 1.0) * edgeLine * 0.10;

    float opticalCoverage = mask * (0.90 + shoulder * 0.08) * intensity;
    return vec4(clamp(glassColor, 0.0, 1.0), clamp(opticalCoverage, 0.0, 1.0));
  }

  float legacyThickness(vec2 p, vec2 halfSize, float radius, float edgeWidth) {
    float sdf = roundedBoxSdf(p, halfSize, radius);
    float inside = max(-sdf, 0.0);
    float rimWide = 1.0 - smoothstep(0.0, edgeWidth, inside);
    float rimCore = 1.0 - smoothstep(0.0, max(edgeWidth * 0.28, 2.0), inside);
    vec2 unit = p / max(halfSize, vec2(1.0));
    float dome = pow(sat(1.0 - length(unit * vec2(0.42, 0.72)) * 0.74), 1.65);
    return dome * 0.20 + rimWide * 0.48 + rimCore * 0.36;
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
    float edgeWidth = clamp(minSize * 0.29, 8.0, 20.0);
    float coreWidth = max(edgeWidth * 0.28, 2.4);
    float rimWide = 1.0 - smoothstep(0.0, edgeWidth, inside);
    float rimCore = 1.0 - smoothstep(0.0, coreWidth, inside);
    vec2 normal = perimeterNormal(p, halfSize, safeRadius);
    vec2 tangent = vec2(-normal.y, normal.x);

    float stepPx = 1.5;
    float leftThickness = legacyThickness(p - vec2(stepPx, 0.0), halfSize, safeRadius, edgeWidth);
    float rightThickness = legacyThickness(p + vec2(stepPx, 0.0), halfSize, safeRadius, edgeWidth);
    float upThickness = legacyThickness(p - vec2(0.0, stepPx), halfSize, safeRadius, edgeWidth);
    float downThickness = legacyThickness(p + vec2(0.0, stepPx), halfSize, safeRadius, edgeWidth);
    vec2 gradient = vec2(rightThickness - leftThickness, downThickness - upThickness);
    float gradientLength = length(gradient);
    gradient *= smoothstep(0.0004, 0.012, gradientLength)
      * min(1.0, 0.22 / max(gradientLength, 0.0001));

    vec2 refraction = gradient * (46.0 + rimWide * 116.0);
    refraction += -normal * rimWide * 7.0;
    refraction = softLimit(refraction, 38.0 + rimWide * 24.0);

    vec2 sampledPixel = frag + refraction;
    vec3 glassColor = blurPyramid(sampledPixel, 0.45 + rimWide * 0.95);

    float dragPull = 10.0 + rimWide * 15.0;
    float smear = edgeWidth * 0.40;
    vec3 dragged = sceneAtPixel(frag - normal * dragPull + tangent * smear) * 0.35;
    dragged += sceneAtPixel(frag - normal * dragPull - tangent * smear) * 0.35;
    dragged += sceneAtPixel(frag - normal * dragPull * 1.75) * 0.30;
    glassColor = mix(glassColor, dragged, rimWide * 0.43);

    vec3 redSample = blurPyramid(sampledPixel + normal * 3.0, 0.60);
    vec3 blueSample = blurPyramid(sampledPixel - normal * 3.2, 0.60);
    vec3 prism = vec3(redSample.r, (redSample.g + blueSample.g) * 0.5, blueSample.b);
    glassColor = mix(glassColor, prism, rimCore * 0.48);

    float edgeLine = exp(-abs(sdf) * 0.56);
    float facing = pow(sat(dot(normal, normalize(vec2(-0.58, 0.82)))), 2.5);
    glassColor *= 1.02 + rimCore * 0.09;
    glassColor += vec3(0.92, 0.97, 1.0) * edgeLine * (0.16 + facing * 0.12);
    glassColor -= vec3(0.025, 0.020, 0.033) * rimWide * (1.0 - facing) * 0.55;

    float opticalCoverage = mask * (0.94 + rimCore * 0.05);
    return vec4(clamp(glassColor, 0.0, 1.0), clamp(opticalCoverage, 0.0, 1.0));
  }

  vec3 applyGlass(vec3 backgroundColor, vec4 glassLayer) {
    return mix(backgroundColor, glassLayer.rgb, glassLayer.a);
  }

  void main() {
    vec2 frag = gl_FragCoord.xy;
    vec3 color = scene(frag / u_resolution);

    color = applyGlass(color, newGlassAt(frag, u_mainRect, u_mainRadius, 1.0));
    color = applyGlass(color, newGlassAt(frag, u_sideRect, u_sideRadius, 0.94));

    for (int index = 0; index < 8; index++) {
      if (index >= u_controlCount) break;
      vec4 rect = u_controls[index];
      float radius = min(rect.w * 0.48, rect.z * 0.48);
      color = applyGlass(color, legacyGlassAt(frag, rect, radius));
    }

    float vignette = 1.0 - smoothstep(0.34, 0.94, distance(frag / u_resolution, vec2(0.5)));
    color *= 0.88 + vignette * 0.12;
    outColor = vec4(color, 1.0);
  }`;

  class BlogGlassRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.gl = canvas.getContext('webgl2', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
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
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW
      );
      gl.useProgram(program);
      gl.enableVertexAttribArray(this.locations.position);
      gl.vertexAttribPointer(this.locations.position, 2, gl.FLOAT, false, 0, 0);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      gl.disable(gl.BLEND);
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
      this.pointer.x += (event.clientX - this.pointer.x) * 0.30;
      this.pointer.y += (event.clientY - this.pointer.y) * 0.30;
    }

    resize() {
      const dprCap = innerWidth <= 560 ? 1.04 : innerWidth <= 1100 ? 1.18 : 1.38;
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
      gl.clearColor(0.02, 0.01, 0.05, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(this.program);
      gl.uniform2f(this.locations.resolution, this.canvas.width, this.canvas.height);
      gl.uniform1f(this.locations.time, (now - this.startTime) / 1000);
      gl.uniform4fv(this.locations.mainRect, this.toGlRect(this.mainElement, dpr));
      gl.uniform1f(this.locations.mainRadius, this.radiusFor(this.mainElement, dpr, 42));
      gl.uniform4fv(this.locations.sideRect, this.toGlRect(this.sideElement, dpr));
      gl.uniform1f(this.locations.sideRadius, this.radiusFor(this.sideElement, dpr, 26));

      const controls = new Float32Array(8 * 4);
      this.controlElements.forEach((element, index) => {
        controls.set(this.toGlRect(element, dpr), index * 4);
      });
      gl.uniform4fv(this.locations.controls, controls);
      gl.uniform1i(this.locations.controlCount, this.controlElements.length);
      gl.uniform2f(
        this.locations.pointer,
        this.pointer.x * dpr,
        (innerHeight - this.pointer.y) * dpr
      );
      gl.uniform1f(this.locations.motion, this.motion);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      this.raf = requestAnimationFrame(this.render);
    }
  }

  window.BlogGlassRenderer = BlogGlassRenderer;
})();
