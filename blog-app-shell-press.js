(() => {
  'use strict';

  /*
   * AI Ledger GlassRole.Shell 按压系统的网页移植版。
   * 按住阶段进入稳定压缩态；只有 pointerup / pointercancel 才释放。
   */
  const HOSTS = '.article-glass-card, .article-control-bar, #articleToc';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  const HOLD_PRESS = 0.90;
  const HOLD_OPEN_GL = 1.00;
  const OPTICS_GAIN = 1.38;
  const LIGHT_GAIN = 1.52;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const smooth = (value) => {
    const x = clamp(value, 0, 1);
    return x * x * (3 - 2 * x);
  };
  const rgba = (red, green, blue, alpha) =>
    `rgba(${red},${green},${blue},${clamp(alpha, 0, 1)})`;

  function bezier(x1, y1, x2, y2) {
    const xAt = (t) => 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t * t * x2 + t ** 3;
    const yAt = (t) => 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t * t * y2 + t ** 3;
    const dxAt = (t) =>
      3 * (1 - t) ** 2 * x1
      + 6 * (1 - t) * t * (x2 - x1)
      + 3 * t * t * (1 - x2);

    return (progress) => {
      const target = clamp(progress, 0, 1);
      let t = target;
      for (let index = 0; index < 7; index += 1) {
        const derivative = dxAt(t);
        if (Math.abs(derivative) < 1e-6) break;
        t = clamp(t - (xAt(t) - target) / derivative, 0, 1);
      }
      let low = 0;
      let high = 1;
      for (let index = 0; index < 10; index += 1) {
        const sampled = xAt(t);
        if (Math.abs(sampled - target) < 1e-6) break;
        if (sampled < target) low = t;
        else high = t;
        t = (low + high) * 0.5;
      }
      return yAt(t);
    };
  }

  const easing = Object.freeze({
    preload: bezier(0.20, 0.00, 0.18, 1.00),
    sink: bezier(0.14, 0.00, 0.10, 1.00),
    release: bezier(0.18, 0.00, 0.16, 1.00),
    pulse: bezier(0.16, 0.00, 0.12, 1.00),
    fast: bezier(0.40, 0.00, 0.20, 1.00),
  });

  class Track {
    constructor(onChange) {
      this.value = 0;
      this.version = 0;
      this.onChange = onChange;
    }

    begin() {
      this.version += 1;
      return this.version;
    }

    set(value, version = this.version) {
      if (version !== this.version) return false;
      this.value = value;
      this.onChange(value);
      return true;
    }

    tween(target, duration, curve, version) {
      const start = this.value;
      const startedAt = performance.now();
      return new Promise((resolve) => {
        const tick = (now) => {
          if (version !== this.version) {
            resolve(false);
            return;
          }
          const progress = clamp((now - startedAt) / Math.max(1, duration), 0, 1);
          this.set(start + (target - start) * curve(progress), version);
          if (progress < 1) requestAnimationFrame(tick);
          else resolve(true);
        };
        requestAnimationFrame(tick);
      });
    }

    spring(target, damping, stiffness, version) {
      const initial = this.value - target;
      if (Math.abs(initial) < 0.0001) {
        this.set(target, version);
        return Promise.resolve(true);
      }

      const omega0 = Math.sqrt(Math.max(1, stiffness));
      const zeta = clamp(damping, 0.001, 0.999);
      const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
      const second = (zeta * omega0 * initial) / omegaD;
      const startedAt = performance.now();

      return new Promise((resolve) => {
        const tick = (now) => {
          if (version !== this.version) {
            resolve(false);
            return;
          }
          const seconds = (now - startedAt) / 1000;
          const decay = Math.exp(-zeta * omega0 * seconds);
          const offset = decay * (
            initial * Math.cos(omegaD * seconds)
            + second * Math.sin(omegaD * seconds)
          );
          this.set(target + offset, version);
          if (Math.abs(offset) >= 0.0008 && now - startedAt < 2200) {
            requestAnimationFrame(tick);
          } else {
            this.set(target, version);
            resolve(true);
          }
        };
        requestAnimationFrame(tick);
      });
    }
  }

  function roundRect(context, x, y, width, height, radius) {
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

  function stops(gradient, colors) {
    const denominator = Math.max(1, colors.length - 1);
    colors.forEach((color, index) => gradient.addColorStop(index / denominator, color));
    return gradient;
  }

  function fill(context, brush, blend, width, height) {
    context.save();
    context.globalCompositeOperation = blend;
    context.fillStyle = brush;
    context.fillRect(0, 0, width, height);
    context.restore();
  }

  function stroke(context, brush, blend, lineWidth, inset, radius, width, height) {
    context.save();
    context.globalCompositeOperation = blend;
    context.strokeStyle = brush;
    context.lineWidth = Math.max(0.2, lineWidth);
    roundRect(
      context,
      inset,
      inset,
      Math.max(1, width - inset * 2),
      Math.max(1, height - inset * 2),
      radius,
    );
    context.stroke();
    context.restore();
  }

  class ShellPressHost {
    constructor(element) {
      this.element = element;
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'app-shell-press-optics';
      this.canvas.setAttribute('aria-hidden', 'true');
      this.context = this.canvas.getContext('2d');
      this.element.appendChild(this.canvas);
      this.element.classList.add('app-shell-press-host');

      this.press = 0;
      this.openGl = 0;
      this.center = { x: 0.50, y: 0.42 };
      this.seed = 0.50;
      this.direction = 1;
      this.band = 0;
      this.strength = 1;
      this.pointerId = null;
      this.frame = 0;
      this.disposed = false;

      this.pressTrack = new Track((value) => {
        this.press = value;
        this.invalidate();
      });
      this.openTrack = new Track((value) => {
        this.openGl = value;
        this.invalidate();
      });

      this.onDown = this.onDown.bind(this);
      this.onMove = this.onMove.bind(this);
      this.onUp = this.onUp.bind(this);
      this.onCancel = this.onCancel.bind(this);
      this.element.addEventListener('pointerdown', this.onDown);
      this.invalidate();
    }

    attachGlobalListeners() {
      addEventListener('pointermove', this.onMove, true);
      addEventListener('pointerup', this.onUp, true);
      addEventListener('pointercancel', this.onCancel, true);
    }

    detachGlobalListeners() {
      removeEventListener('pointermove', this.onMove, true);
      removeEventListener('pointerup', this.onUp, true);
      removeEventListener('pointercancel', this.onCancel, true);
    }

    updateCenter(event) {
      const rect = this.element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      this.center.x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      this.center.y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
      this.invalidate();
    }

    onDown(event) {
      if (reducedMotion.matches || this.pointerId !== null) return;
      if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;

      this.pointerId = event.pointerId;
      this.updateCenter(event);
      this.seed = Math.random();
      this.direction = Math.random() >= 0.5 ? 1 : -1;
      this.band = Math.floor(Math.random() * 4);
      this.strength = 0.98 + Math.random() * 0.47;
      this.attachGlobalListeners();
      this.beginPress();
    }

    onMove(event) {
      if (event.pointerId === this.pointerId) this.updateCenter(event);
    }

    onUp(event) {
      if (event.pointerId !== this.pointerId) return;
      this.updateCenter(event);
      this.pointerId = null;
      this.detachGlobalListeners();
      this.releasePress(true);
    }

    onCancel(event) {
      if (event.pointerId !== this.pointerId) return;
      this.pointerId = null;
      this.detachGlobalListeners();
      this.releasePress(false);
    }

    beginPress() {
      const pressVersion = this.pressTrack.begin();
      if (this.pressTrack.value < 0.22) this.pressTrack.set(0.22, pressVersion);
      void (async () => {
        if (!await this.pressTrack.tween(0.52, 125, easing.pulse, pressVersion)) return;
        if (!await this.pressTrack.tween(0.78, 260, easing.sink, pressVersion)) return;
        if (!await this.pressTrack.tween(HOLD_PRESS, 310, easing.fast, pressVersion)) return;
        if (this.pointerId !== null) this.pressTrack.set(HOLD_PRESS, pressVersion);
      })();

      const openVersion = this.openTrack.begin();
      void (async () => {
        if (!await this.openTrack.tween(0.34, 150, easing.preload, openVersion)) return;
        if (!await this.openTrack.tween(0.78, 285, easing.sink, openVersion)) return;
        if (!await this.openTrack.tween(HOLD_OPEN_GL, 340, easing.fast, openVersion)) return;
        if (this.pointerId !== null) this.openTrack.set(HOLD_OPEN_GL, openVersion);
      })();
    }

    releasePress(normalRelease) {
      const openVersion = this.openTrack.begin();
      void this.openTrack.tween(
        0,
        normalRelease ? 520 : 360,
        easing.fast,
        openVersion,
      );

      const pressVersion = this.pressTrack.begin();
      void (async () => {
        if (!normalRelease) {
          await this.pressTrack.tween(0, 360, easing.fast, pressVersion);
          return;
        }

        if (this.pressTrack.value < 0.48) {
          if (!await this.pressTrack.tween(0.58, 105, easing.pulse, pressVersion)) return;
          if (!await this.pressTrack.tween(-0.090, 155, easing.release, pressVersion)) return;
        } else if (!await this.pressTrack.tween(-0.105, 235, easing.release, pressVersion)) {
          return;
        }
        await this.pressTrack.spring(0, 0.62, 170, pressVersion);
      })();
    }

    snapshot() {
      const compression = smooth(Math.max(this.press, 0) / 0.82);
      const rebound = smooth(-this.press / 0.13);
      return {
        compression,
        rebound,
        optics: Math.max(
          Math.max(this.press, 0),
          clamp(this.openGl, 0, 1) * 0.72,
          rebound * 0.32,
        ),
      };
    }

    invalidate() {
      if (this.frame || this.disposed) return;
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        this.render();
      });
    }

    render() {
      if (this.disposed) return;
      const dynamic = this.snapshot();
      this.element.style.setProperty('--app-shell-origin-x', `${this.center.x * 100}%`);
      this.element.style.setProperty('--app-shell-origin-y', `${this.center.y * 100}%`);
      this.element.style.setProperty(
        '--app-shell-scale-x',
        (1 + dynamic.compression * 0.024 - dynamic.rebound * 0.008).toFixed(6),
      );
      this.element.style.setProperty(
        '--app-shell-scale-y',
        (1 - dynamic.compression * 0.038 + dynamic.rebound * 0.016).toFixed(6),
      );
      this.element.style.setProperty(
        '--app-shell-translate-y',
        `${(dynamic.compression * 4.40 - dynamic.rebound * 1.55).toFixed(4)}px`,
      );
      this.drawOptics(dynamic.optics);
    }

    drawOptics(optics) {
      if (!this.context) return;
      const width = this.element.clientWidth;
      const height = this.element.clientHeight;
      if (width <= 1 || height <= 1) return;

      const pixelRatio = Math.min(devicePixelRatio || 1, 2);
      const canvasWidth = Math.round(width * pixelRatio);
      const canvasHeight = Math.round(height * pixelRatio);
      if (this.canvas.width !== canvasWidth) this.canvas.width = canvasWidth;
      if (this.canvas.height !== canvasHeight) this.canvas.height = canvasHeight;

      const context = this.context;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);

      const safe = clamp(optics * OPTICS_GAIN, 0, 1.08);
      if (safe < 0.001) return;

      const radius = clamp(
        parseFloat(getComputedStyle(this.element).borderTopLeftRadius) || 0,
        0,
        Math.min(width, height) * 0.5,
      );
      const progress = smooth(safe / 0.72);
      const breath = smooth(safe / 0.50)
        * (1 - 0.11 * smooth((safe - 0.58) / 0.28));
      const compression = progress * progress;
      const center = { x: this.center.x * width, y: this.center.y * height };
      const maxSide = Math.max(width, height);
      const inset = 0.56;
      const rimRadius = Math.max(0, radius - inset);
      const near = (distance) => clamp(1 - distance / 0.42, 0, 1) * progress;
      const edgeStroke = 1.02 + 0.48 * progress;
      const localStroke = 1.56 + 0.74 * progress;
      const flow = smooth(safe / 0.62);
      const seedShift = (this.seed - 0.5) * 0.36;
      const sweepX = this.direction >= 0
        ? -0.24 + seedShift + flow * 1.42
        : 1.24 + seedShift - flow * 1.42;
      const startY = [0.02, 0.74, 0.10, 0.18][this.band % 4];
      const endY = [0.26, 0.98, 0.92, 0.58][this.band % 4];
      const bandAlpha = clamp(
        breath * clamp(this.strength, 0.70, 1.45) * 1.32,
        0,
        1.45,
      );
      const prism = 1;
      const prismSoft = 0.55;

      context.save();
      roundRect(context, 0, 0, width, height, radius);
      context.clip();

      fill(
        context,
        stops(
          context.createRadialGradient(
            width * 0.5,
            height * 0.4,
            0,
            width * 0.5,
            height * 0.4,
            maxSide * 1.18,
          ),
          [
            rgba(255, 255, 255, 0.021 * breath * LIGHT_GAIN),
            rgba(216, 255, 255, 0.014 * breath * LIGHT_GAIN),
            rgba(0, 0, 0, 0),
          ],
        ),
        'screen',
        width,
        height,
      );

      fill(
        context,
        stops(
          context.createRadialGradient(
            center.x,
            center.y,
            0,
            center.x,
            center.y,
            maxSide * (0.86 + 0.06 * progress),
          ),
          [
            rgba(239, 255, 255, 0.066 * breath * LIGHT_GAIN),
            rgba(184, 247, 255, 0.032 * breath * LIGHT_GAIN),
            rgba(130, 232, 255, 0.010 * breath * LIGHT_GAIN),
            rgba(0, 0, 0, 0),
          ],
        ),
        'screen',
        width,
        height,
      );

      fill(
        context,
        stops(
          context.createRadialGradient(
            center.x,
            center.y,
            0,
            center.x,
            center.y,
            maxSide * (1 + 0.035 * progress),
          ),
          [
            rgba(0, 0, 0, 0),
            rgba(16, 44, 102, 0.009 * progress),
            rgba(3, 11, 26, 0.050 * compression),
          ],
        ),
        'multiply',
        width,
        height,
      );

      fill(
        context,
        stops(
          context.createLinearGradient(0, height * 0.44, 0, height),
          [rgba(0, 0, 0, 0), rgba(0, 0, 0, 0), rgba(2, 8, 21, 0.064 * compression)],
        ),
        'multiply',
        width,
        height,
      );

      const ambient = stops(
        context.createRadialGradient(
          center.x,
          center.y,
          0,
          center.x,
          center.y,
          maxSide * 0.74,
        ),
        [
          rgba(239, 255, 255, 0.052 * breath * LIGHT_GAIN),
          rgba(146, 255, 241, (0.018 + 0.020 * prismSoft) * breath * LIGHT_GAIN),
          rgba(255, 139, 232, 0.014 * prismSoft * breath * LIGHT_GAIN),
          rgba(0, 0, 0, 0),
        ],
      );
      stroke(context, ambient, 'screen', edgeStroke, inset, rimRadius, width, height);

      const flowing = stops(
        context.createLinearGradient(
          width * (sweepX - 0.26),
          height * startY,
          width * (sweepX + 0.22),
          height * endY,
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
      stroke(context, flowing, 'lighter', 1.18, inset, rimRadius, width, height);

      const halo = (power, white, cyan) => [
        rgba(255, 255, 255, white * power * LIGHT_GAIN),
        rgba(255, 125, 226, 0.050 * prism * power * LIGHT_GAIN),
        rgba(255, 226, 138, 0.036 * prism * power * LIGHT_GAIN),
        rgba(128, 255, 242, cyan * power * (0.65 + prism * 0.35) * LIGHT_GAIN),
        rgba(0, 0, 0, 0),
      ];

      stroke(
        context,
        stops(
          context.createRadialGradient(center.x, inset, 0, center.x, inset, maxSide * 0.38),
          halo(near(this.center.y), 0.23, 0.072),
        ),
        'screen',
        localStroke,
        inset,
        rimRadius,
        width,
        height,
      );
      stroke(
        context,
        stops(
          context.createRadialGradient(
            center.x,
            height - inset,
            0,
            center.x,
            height - inset,
            maxSide * 0.36,
          ),
          halo(near(1 - this.center.y), 0.16, 0.054),
        ),
        'screen',
        localStroke,
        inset,
        rimRadius,
        width,
        height,
      );
      stroke(
        context,
        stops(
          context.createRadialGradient(inset, center.y, 0, inset, center.y, maxSide * 0.34),
          halo(near(this.center.x), 0.18, 0.060),
        ),
        'screen',
        localStroke,
        inset,
        rimRadius,
        width,
        height,
      );
      stroke(
        context,
        stops(
          context.createRadialGradient(
            width - inset,
            center.y,
            0,
            width - inset,
            center.y,
            maxSide * 0.34,
          ),
          halo(near(1 - this.center.x), 0.18, 0.060),
        ),
        'screen',
        localStroke,
        inset,
        rimRadius,
        width,
        height,
      );

      context.restore();
    }

    dispose() {
      this.disposed = true;
      this.pressTrack.begin();
      this.openTrack.begin();
      cancelAnimationFrame(this.frame);
      this.detachGlobalListeners();
      this.element.removeEventListener('pointerdown', this.onDown);
      this.element.classList.remove('app-shell-press-host');
      this.canvas.remove();
    }
  }

  class Manager {
    constructor(reader) {
      this.reader = reader;
      this.hosts = new Map();
      this.frame = 0;
      this.schedule = this.schedule.bind(this);
      this.observer = new MutationObserver(this.schedule);
      this.observer.observe(reader, { childList: true, subtree: true });
      reader.addEventListener('blog:glass-hosts-changed', this.schedule);
      this.sync();
    }

    schedule() {
      if (this.frame) return;
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        this.sync();
      });
    }

    sync() {
      const active = new Set(
        [...this.reader.querySelectorAll(HOSTS)].filter((node) => node.isConnected),
      );
      active.forEach((node) => {
        if (!this.hosts.has(node)) this.hosts.set(node, new ShellPressHost(node));
      });
      for (const [node, host] of this.hosts) {
        if (!active.has(node)) {
          host.dispose();
          this.hosts.delete(node);
        }
      }
    }
  }

  const install = (reader) => {
    if (reader && !reader.__appShellPressManager) {
      reader.__appShellPressManager = new Manager(reader);
    }
  };

  const reader = document.querySelector('.article-reader');
  if (reader) {
    install(reader);
  } else {
    const observer = new MutationObserver(() => {
      const next = document.querySelector('.article-reader');
      if (!next) return;
      observer.disconnect();
      install(next);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
