(() => {
  'use strict';

  /*
   * Direct web port of the AI Ledger Shell press system from Glass.kt:
   * - ShellPressPreload / Sink / Release / Pulse easing curves
   * - shellPress + shellOpenGlPressAnim timelines
   * - OpenGLGlassDynamicSnapshot compression / rebound / optics envelope
   * - shellPressSurfaceOptics light-field drawing formula
   *
   * No blog-specific visual redesign is applied here.
   */

  const HOST_SELECTOR = '.article-glass-card, .article-control-bar, #articleToc';
  const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)');
  const DPR_LIMIT = 2;
  const PRISM_EDGE_HIGHLIGHT = 1;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const smoothStep = (value) => {
    const x = clamp(value, 0, 1);
    return x * x * (3 - 2 * x);
  };

  function cubicBezier(x1, y1, x2, y2) {
    const sampleCurveX = (t) => {
      const inv = 1 - t;
      return 3 * inv * inv * t * x1 + 3 * inv * t * t * x2 + t * t * t;
    };
    const sampleCurveY = (t) => {
      const inv = 1 - t;
      return 3 * inv * inv * t * y1 + 3 * inv * t * t * y2 + t * t * t;
    };
    const sampleDerivativeX = (t) => (
      3 * (1 - t) * (1 - t) * x1
      + 6 * (1 - t) * t * (x2 - x1)
      + 3 * t * t * (1 - x2)
    );

    return (progress) => {
      const x = clamp(progress, 0, 1);
      let t = x;
      for (let index = 0; index < 7; index += 1) {
        const error = sampleCurveX(t) - x;
        const derivative = sampleDerivativeX(t);
        if (Math.abs(error) < 1e-6 || Math.abs(derivative) < 1e-6) break;
        t = clamp(t - error / derivative, 0, 1);
      }

      let low = 0;
      let high = 1;
      for (let index = 0; index < 10; index += 1) {
        const sample = sampleCurveX(t);
        if (Math.abs(sample - x) < 1e-6) break;
        if (sample < x) low = t;
        else high = t;
        t = (low + high) * 0.5;
      }
      return sampleCurveY(t);
    };
  }

  const EASING = Object.freeze({
    preload: cubicBezier(0.20, 0.00, 0.18, 1.00),
    sink: cubicBezier(0.14, 0.00, 0.10, 1.00),
    release: cubicBezier(0.18, 0.00, 0.16, 1.00),
    pulse: cubicBezier(0.16, 0.00, 0.12, 1.00),
    fastOutSlowIn: cubicBezier(0.40, 0.00, 0.20, 1.00),
  });

  class ScalarTrack {
    constructor(onChange) {
      this.value = 0;
      this.generation = 0;
      this.onChange = onChange;
    }

    begin() {
      this.generation += 1;
      return this.generation;
    }

    set(value, generation = this.generation) {
      if (generation !== this.generation) return false;
      this.value = value;
      this.onChange(value);
      return true;
    }

    tweenTo(target, durationMs, easing, generation) {
      const start = this.value;
      const duration = Math.max(1, durationMs);
      const startedAt = performance.now();

      return new Promise((resolve) => {
        const frame = (now) => {
          if (generation !== this.generation) {
            resolve(false);
            return;
          }
          const progress = clamp((now - startedAt) / duration, 0, 1);
          this.set(start + (target - start) * easing(progress), generation);
          if (progress < 1) requestAnimationFrame(frame);
          else resolve(true);
        };
        requestAnimationFrame(frame);
      });
    }

    springTo(target, dampingRatio, stiffness, generation) {
      const start = this.value;
      const displacement = start - target;
      if (Math.abs(displacement) < 0.0001) {
        this.set(target, generation);
        return Promise.resolve(true);
      }

      const omega0 = Math.sqrt(Math.max(1, stiffness));
      const zeta = clamp(dampingRatio, 0.001, 0.999);
      const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
      const a = displacement;
      const b = (zeta * omega0 * a) / omegaD;
      const startedAt = performance.now();
      const maxDurationMs = stiffness <= 60 ? 2600 : 1800;

      return new Promise((resolve) => {
        const frame = (now) => {
          if (generation !== this.generation) {
            resolve(false);
            return;
          }
          const elapsedSeconds = Math.max(0, now - startedAt) / 1000;
          const decay = Math.exp(-zeta * omega0 * elapsedSeconds);
          const cos = Math.cos(omegaD * elapsedSeconds);
          const sin = Math.sin(omegaD * elapsedSeconds);
          const offset = decay * (a * cos + b * sin);
          const next = target + offset;
          this.set(next, generation);

          const settled = Math.abs(offset) < 0.0008 && elapsedSeconds > 0.18;
          if (!settled && now - startedAt < maxDurationMs) {
            requestAnimationFrame(frame);
          } else {
            this.set(target, generation);
            resolve(true);
          }
        };
        requestAnimationFrame(frame);
      });
    }
  }

  function roundRectPath(context, x, y, width, height, radius) {
    const safeRadius = clamp(radius, 0, Math.min(width, height) * 0.5);
    context.beginPath();
    if (typeof context.roundRect === 'function') {
      context.roundRect(x, y, width, height, safeRadius);
      return;
    }
    context.moveTo(x + safeRadius, y);
    context.lineTo(x + width - safeRadius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
    context.lineTo(x + width, y + height - safeRadius);
    context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
    context.lineTo(x + safeRadius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
    context.lineTo(x, y + safeRadius);
    context.quadraticCurveTo(x, y, x + safeRadius, y);
    context.closePath();
  }

  function addEvenStops(gradient, colors) {
    const denominator = Math.max(1, colors.length - 1);
    colors.forEach((color, index) => gradient.addColorStop(index / denominator, color));
    return gradient;
  }

  const rgba = (red, green, blue, alpha) => (
    `rgba(${red},${green},${blue},${clamp(alpha, 0, 1)})`
  );

  function fillWithBlend(context, brush, blend, width, height) {
    context.save();
    context.globalCompositeOperation = blend;
    context.fillStyle = brush;
    context.fillRect(0, 0, width, height);
    context.restore();
  }

  function strokeRoundRect(context, brush, blend, lineWidth, inset, radius, width, height) {
    context.save();
    context.globalCompositeOperation = blend;
    context.strokeStyle = brush;
    context.lineWidth = Math.max(0.2, lineWidth);
    roundRectPath(
      context,
      inset,
      inset,
      Math.max(1, width - inset * 2),
      Math.max(1, height - inset * 2),
      Math.max(0, radius),
    );
    context.stroke();
    context.restore();
  }

  class AppShellPressHost {
    constructor(element) {
      this.element = element;
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'app-shell-press-optics';
      this.canvas.setAttribute('aria-hidden', 'true');
      this.context = this.canvas.getContext('2d');
      this.element.appendChild(this.canvas);
      this.element.classList.add('app-shell-press-host');

      this.pressValue = 0;
      this.openGlPress = 0;
      this.pressCenter = { x: 0.50, y: 0.42 };
      this.rimFlowSeed = 0.50;
      this.rimFlowDirection = 1;
      this.rimFlowBand = 0;
      this.rimFlowStrength = 1;
      this.activePointerId = null;
      this.frame = 0;
      this.disposed = false;

      this.pressTrack = new ScalarTrack((value) => {
        this.pressValue = value;
        this.invalidate();
      });
      this.openGlTrack = new ScalarTrack((value) => {
        this.openGlPress = value;
        this.invalidate();
      });

      this.onPointerDown = this.onPointerDown.bind(this);
      this.onPointerMove = this.onPointerMove.bind(this);
      this.onPointerUp = this.onPointerUp.bind(this);
      this.onPointerCancel = this.onPointerCancel.bind(this);
      this.onLostPointerCapture = this.onLostPointerCapture.bind(this);

      this.element.addEventListener('pointerdown', this.onPointerDown);
      this.element.addEventListener('pointermove', this.onPointerMove);
      this.element.addEventListener('pointerup', this.onPointerUp);
      this.element.addEventListener('pointercancel', this.onPointerCancel);
      this.element.addEventListener('lostpointercapture', this.onLostPointerCapture);
      this.invalidate();
    }

    updatePressCenter(event) {
      const rect = this.element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      this.pressCenter.x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      this.pressCenter.y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
      this.invalidate();
    }

    onPointerDown(event) {
      if (REDUCED_MOTION.matches || this.activePointerId !== null) return;
      if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;

      this.activePointerId = event.pointerId;
      this.updatePressCenter(event);
      this.rimFlowSeed = Math.random();
      this.rimFlowDirection = Math.random() >= 0.5 ? 1 : -1;
      this.rimFlowBand = Math.floor(Math.random() * 4);
      this.rimFlowStrength = 0.86 + Math.random() * 0.52;

      try { this.element.setPointerCapture(event.pointerId); } catch (_) {}
      this.beginPress();
    }

    onPointerMove(event) {
      if (event.pointerId !== this.activePointerId) return;
      this.updatePressCenter(event);
    }

    onPointerUp(event) {
      if (event.pointerId !== this.activePointerId) return;
      this.updatePressCenter(event);
      this.activePointerId = null;
      this.releasePress(true);
    }

    onPointerCancel(event) {
      if (event.pointerId !== this.activePointerId) return;
      this.activePointerId = null;
      this.releasePress(false);
    }

    onLostPointerCapture(event) {
      if (event.pointerId !== this.activePointerId) return;
      this.activePointerId = null;
      this.releasePress(false);
    }

    beginPress() {
      const pressGeneration = this.pressTrack.begin();
      if (this.pressTrack.value < 0.18) this.pressTrack.set(0.18, pressGeneration);
      void (async () => {
        if (!await this.pressTrack.tweenTo(0.42, 150, EASING.pulse, pressGeneration)) return;
        if (!await this.pressTrack.tweenTo(0.62, 360, EASING.sink, pressGeneration)) return;
        if (!await this.pressTrack.tweenTo(0.76, 620, EASING.fastOutSlowIn, pressGeneration)) return;
        if (!await this.pressTrack.tweenTo(0.62, 680, EASING.fastOutSlowIn, pressGeneration)) return;
        await this.pressTrack.springTo(0.70, 0.95, 50, pressGeneration);
      })();

      const openGlGeneration = this.openGlTrack.begin();
      void (async () => {
        if (!await this.openGlTrack.tweenTo(0.26, 230, EASING.preload, openGlGeneration)) return;
        if (!await this.openGlTrack.tweenTo(0.72, 520, EASING.sink, openGlGeneration)) return;
        if (!await this.openGlTrack.tweenTo(0.88, 620, EASING.fastOutSlowIn, openGlGeneration)) return;
        if (!await this.openGlTrack.tweenTo(0.74, 680, EASING.fastOutSlowIn, openGlGeneration)) return;
        await this.openGlTrack.springTo(0.80, 0.95, 50, openGlGeneration);
      })();
    }

    releasePress(releasedInsideGesture) {
      const openGlGeneration = this.openGlTrack.begin();
      void (async () => {
        if (releasedInsideGesture && this.openGlTrack.value < 0.24) {
          if (!await this.openGlTrack.tweenTo(0.34, 120, EASING.pulse, openGlGeneration)) return;
        }
        await this.openGlTrack.tweenTo(
          0,
          releasedInsideGesture ? 560 : 380,
          EASING.fastOutSlowIn,
          openGlGeneration,
        );
      })();

      const pressGeneration = this.pressTrack.begin();
      void (async () => {
        if (!releasedInsideGesture) {
          await this.pressTrack.tweenTo(0, 430, EASING.fastOutSlowIn, pressGeneration);
          return;
        }

        if (this.pressTrack.value < 0.46) {
          if (!await this.pressTrack.tweenTo(0.52, 105, EASING.pulse, pressGeneration)) return;
          if (!await this.pressTrack.tweenTo(-0.060, 150, EASING.release, pressGeneration)) return;
        } else if (!await this.pressTrack.tweenTo(-0.065, 220, EASING.release, pressGeneration)) {
          return;
        }
        await this.pressTrack.springTo(0, 0.66, 200, pressGeneration);
      })();
    }

    dynamicSnapshot() {
      const pressCompression = smoothStep(clamp(Math.max(this.pressValue, 0) / 0.72, 0, 1));
      const pressRebound = smoothStep(clamp(-this.pressValue / 0.10, 0, 1));
      const surfaceOpticsPress = Math.max(
        Math.max(this.pressValue, 0),
        Math.max(clamp(this.openGlPress, 0, 1) * 0.62, pressRebound * 0.24),
      );
      return {
        pressCompression,
        pressRebound,
        surfaceOpticsPress,
        glassIntensityScale: 1 + pressCompression * 0.10,
      };
    }

    invalidate() {
      if (this.frame || this.disposed) return;
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        this.renderFrame();
      });
    }

    renderFrame() {
      if (this.disposed) return;
      const dynamic = this.dynamicSnapshot();
      const scaleX = 1 + dynamic.pressCompression * 0.014 - dynamic.pressRebound * 0.004;
      const scaleY = 1 - dynamic.pressCompression * 0.022 + dynamic.pressRebound * 0.008;
      const translateY = dynamic.pressCompression * 2.10 - dynamic.pressRebound * 0.80;

      this.element.style.setProperty('--app-shell-origin-x', `${this.pressCenter.x * 100}%`);
      this.element.style.setProperty('--app-shell-origin-y', `${this.pressCenter.y * 100}%`);
      this.element.style.setProperty('--app-shell-scale-x', scaleX.toFixed(6));
      this.element.style.setProperty('--app-shell-scale-y', scaleY.toFixed(6));
      this.element.style.setProperty('--app-shell-translate-y', `${translateY.toFixed(4)}px`);
      this.element.style.setProperty('--app-shell-glass-intensity-scale', dynamic.glassIntensityScale.toFixed(6));

      this.drawSurfaceOptics(dynamic.surfaceOpticsPress);
    }

    drawSurfaceOptics(surfaceOpticsPress) {
      if (!this.context) return;
      const rect = this.element.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      if (width <= 1 || height <= 1) return;

      const pixelRatio = Math.min(devicePixelRatio || 1, DPR_LIMIT);
      const canvasWidth = Math.max(1, Math.round(width * pixelRatio));
      const canvasHeight = Math.max(1, Math.round(height * pixelRatio));
      if (this.canvas.width !== canvasWidth) this.canvas.width = canvasWidth;
      if (this.canvas.height !== canvasHeight) this.canvas.height = canvasHeight;

      const context = this.context;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);

      const safePress = clamp(surfaceOpticsPress, 0, 1.08);
      if (safePress < 0.001) return;

      const computedRadius = parseFloat(getComputedStyle(this.element).borderTopLeftRadius) || 0;
      const radius = clamp(computedRadius, 0, Math.min(width, height) * 0.5);
      const raw = clamp(safePress / 0.72, 0, 1);
      const p = smoothStep(raw);
      const breath = smoothStep(clamp(safePress / 0.50, 0, 1))
        * (1 - 0.11 * smoothStep(clamp((safePress - 0.58) / 0.28, 0, 1)));
      const compression = p * p;
      const center = {
        x: clamp(this.pressCenter.x, 0, 1) * width,
        y: clamp(this.pressCenter.y, 0, 1) * height,
      };
      const maxSide = Math.max(width, height);
      const rimInset = 0.56;
      const rimRadius = Math.max(0, radius - rimInset);
      const pressGlow = p;
      const nearEdge = (distance) => clamp(1 - distance / 0.42, 0, 1) * pressGlow;
      const topNear = nearEdge(this.pressCenter.y);
      const bottomNear = nearEdge(1 - this.pressCenter.y);
      const leftNear = nearEdge(this.pressCenter.x);
      const rightNear = nearEdge(1 - this.pressCenter.x);
      const edgeStroke = 0.74 + 0.26 * p;
      const localEdgeStroke = 1.18 + 0.48 * p;
      const flow = smoothStep(clamp(safePress / 0.62, 0, 1));
      const seedShift = (this.rimFlowSeed - 0.5) * 0.36;
      const sweepX = this.rimFlowDirection >= 0
        ? -0.24 + seedShift + flow * 1.42
        : 1.24 + seedShift - flow * 1.42;
      const bandStartY = [0.02, 0.74, 0.10, 0.18][this.rimFlowBand % 4];
      const bandEndY = [0.26, 0.98, 0.92, 0.58][this.rimFlowBand % 4];
      const bandAlpha = breath * clamp(this.rimFlowStrength, 0.70, 1.45);
      const prism = clamp(PRISM_EDGE_HIGHLIGHT, 0, 2);
      const prismSoft = prism * 0.55;

      context.save();
      roundRectPath(context, 0, 0, width, height, radius);
      context.clip();

      const broadHalo = addEvenStops(
        context.createRadialGradient(width * 0.50, height * 0.40, 0, width * 0.50, height * 0.40, maxSide * 1.18),
        [rgba(255, 255, 255, 0.021 * breath), rgba(216, 255, 255, 0.014 * breath), rgba(0, 0, 0, 0)],
      );
      fillWithBlend(context, broadHalo, 'screen', width, height);

      const pressureField = addEvenStops(
        context.createRadialGradient(center.x, center.y, 0, center.x, center.y, maxSide * (0.86 + 0.06 * p)),
        [
          rgba(239, 255, 255, 0.066 * breath),
          rgba(184, 247, 255, 0.032 * breath),
          rgba(130, 232, 255, 0.010 * breath),
          rgba(0, 0, 0, 0),
        ],
      );
      fillWithBlend(context, pressureField, 'screen', width, height);

      const elasticSurfaceField = addEvenStops(
        context.createRadialGradient(center.x, center.y, 0, center.x, center.y, maxSide * (1.00 + 0.035 * p)),
        [rgba(0, 0, 0, 0), rgba(16, 44, 102, 0.006 * p), rgba(3, 11, 26, 0.034 * compression)],
      );
      fillWithBlend(context, elasticSurfaceField, 'multiply', width, height);

      const lowerWeight = addEvenStops(
        context.createLinearGradient(0, height * 0.44, 0, height),
        [rgba(0, 0, 0, 0), rgba(0, 0, 0, 0), rgba(2, 8, 21, 0.044 * compression)],
      );
      fillWithBlend(context, lowerWeight, 'multiply', width, height);

      const ambientRim = addEvenStops(
        context.createRadialGradient(center.x, center.y, 0, center.x, center.y, maxSide * 0.74),
        [
          rgba(239, 255, 255, 0.052 * breath),
          rgba(146, 255, 241, (0.018 + 0.020 * prismSoft) * breath),
          rgba(255, 139, 232, 0.014 * prismSoft * breath),
          rgba(0, 0, 0, 0),
        ],
      );
      strokeRoundRect(context, ambientRim, 'screen', edgeStroke, rimInset, rimRadius, width, height);

      const flowingRim = addEvenStops(
        context.createLinearGradient(
          width * (sweepX - 0.26),
          height * bandStartY,
          width * (sweepX + 0.22),
          height * bandEndY,
        ),
        [
          rgba(0, 0, 0, 0),
          rgba(255, 106, 219, 0.20 * prism * bandAlpha),
          rgba(255, 255, 255, 0.34 * bandAlpha),
          rgba(255, 224, 138, 0.18 * prism * bandAlpha),
          rgba(98, 255, 240, (0.14 + 0.16 * prism) * bandAlpha),
          rgba(146, 166, 255, 0.12 * prism * bandAlpha),
          rgba(0, 0, 0, 0),
        ],
      );
      strokeRoundRect(context, flowingRim, 'lighter', 0.82 + 0.20 * prism, rimInset, rimRadius, width, height);

      const prismHalo = (power, white, cyan) => [
        rgba(255, 255, 255, white * power),
        rgba(255, 125, 226, 0.050 * prism * power),
        rgba(255, 226, 138, 0.036 * prism * power),
        rgba(128, 255, 242, cyan * power * (0.65 + prism * 0.35)),
        rgba(0, 0, 0, 0),
      ];

      const topEdgeHalo = addEvenStops(
        context.createRadialGradient(center.x, rimInset, 0, center.x, rimInset, maxSide * 0.38),
        prismHalo(topNear, 0.23, 0.072),
      );
      const bottomEdgeHalo = addEvenStops(
        context.createRadialGradient(center.x, height - rimInset, 0, center.x, height - rimInset, maxSide * 0.36),
        prismHalo(bottomNear, 0.16, 0.054),
      );
      const leftEdgeHalo = addEvenStops(
        context.createRadialGradient(rimInset, center.y, 0, rimInset, center.y, maxSide * 0.34),
        prismHalo(leftNear, 0.18, 0.060),
      );
      const rightEdgeHalo = addEvenStops(
        context.createRadialGradient(width - rimInset, center.y, 0, width - rimInset, center.y, maxSide * 0.34),
        prismHalo(rightNear, 0.18, 0.060),
      );
      strokeRoundRect(context, topEdgeHalo, 'screen', localEdgeStroke, rimInset, rimRadius, width, height);
      strokeRoundRect(context, bottomEdgeHalo, 'screen', localEdgeStroke, rimInset, rimRadius, width, height);
      strokeRoundRect(context, leftEdgeHalo, 'screen', localEdgeStroke, rimInset, rimRadius, width, height);
      strokeRoundRect(context, rightEdgeHalo, 'screen', localEdgeStroke, rimInset, rimRadius, width, height);

      context.restore();
    }

    dispose() {
      this.disposed = true;
      this.pressTrack.begin();
      this.openGlTrack.begin();
      cancelAnimationFrame(this.frame);
      this.element.removeEventListener('pointerdown', this.onPointerDown);
      this.element.removeEventListener('pointermove', this.onPointerMove);
      this.element.removeEventListener('pointerup', this.onPointerUp);
      this.element.removeEventListener('pointercancel', this.onPointerCancel);
      this.element.removeEventListener('lostpointercapture', this.onLostPointerCapture);
      this.element.classList.remove('app-shell-press-host');
      this.canvas.remove();
    }
  }

  class AppShellPressManager {
    constructor(reader) {
      this.reader = reader;
      this.hosts = new Map();
      this.syncFrame = 0;
      this.scheduleSync = this.scheduleSync.bind(this);
      this.observer = new MutationObserver(this.scheduleSync);
      this.observer.observe(reader, { childList: true, subtree: true });
      reader.addEventListener('blog:glass-hosts-changed', this.scheduleSync);
      this.sync();
    }

    scheduleSync() {
      if (this.syncFrame) return;
      this.syncFrame = requestAnimationFrame(() => {
        this.syncFrame = 0;
        this.sync();
      });
    }

    sync() {
      const active = new Set(
        [...this.reader.querySelectorAll(HOST_SELECTOR)]
          .filter((element) => element.isConnected),
      );

      for (const element of active) {
        if (!this.hosts.has(element)) this.hosts.set(element, new AppShellPressHost(element));
      }

      for (const [element, host] of this.hosts) {
        if (active.has(element)) continue;
        host.dispose();
        this.hosts.delete(element);
      }
    }
  }

  function install(reader) {
    if (!reader || reader.__appShellPressManager) return;
    reader.__appShellPressManager = new AppShellPressManager(reader);
  }

  function initialise() {
    const reader = document.querySelector('.article-reader');
    if (reader) {
      install(reader);
      return;
    }
    const observer = new MutationObserver(() => {
      const next = document.querySelector('.article-reader');
      if (!next) return;
      observer.disconnect();
      install(next);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  initialise();
})();
